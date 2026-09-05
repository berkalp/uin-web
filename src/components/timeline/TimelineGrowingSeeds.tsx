"use client";

import { useEffect, useMemo, useState } from "react";

import SeedCard from "@/components/seeds/SeedCard";
import { setMyProfileDisplayOrder } from "@/services/profileDisplayOrderService";
import { supabase } from "@/utils/supabase/client";
import { isSeedPastDue, toSeedCount, type SeedRecord } from "@/utils/seeds";

type TimelineGrowingSeedsProps = {
  seeds: SeedRecord[];
};

type ReminderClock = {
  targetTime: string;
  timezone: string;
};

type SeedFilter = "all" | "growing" | "intent";

const PAGE_SIZE = 6;

function isConverted(seed: SeedRecord) {
  return toSeedCount(seed.grown_intent_count) > 0;
}

function isActivePersonalIntent(seed: SeedRecord) {
  return seed.status === "active" && !isSeedPastDue(seed);
}

function belongsToPersonalIntentArea(seed: SeedRecord) {
  if (seed.status === "archived") return false;

  // Deneyim tamamlanmış olsa bile gerçekten bir Sosyal Niyete
  // dönüşmüş kaynak kişisel niyet görünmeye devam edebilir.
  return isActivePersonalIntent(seed) || isConverted(seed);
}

function matchesFilter(seed: SeedRecord, filter: SeedFilter) {
  if (!belongsToPersonalIntentArea(seed)) return false;

  if (filter === "growing") {
    return isActivePersonalIntent(seed);
  }

  if (filter === "intent") {
    return isConverted(seed);
  }

  return true;
}

export default function TimelineGrowingSeeds({
  seeds,
}: TimelineGrowingSeedsProps) {
  const [filter, setFilter] = useState<SeedFilter>("all");
  const [page, setPage] = useState(1);
  const [orderedSeeds, setOrderedSeeds] = useState(seeds);
  const [reordering, setReordering] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [clocks, setClocks] = useState<Record<string, ReminderClock>>({});
  const [fallbackClock, setFallbackClock] = useState<ReminderClock>({
    targetTime: "09:00",
    timezone: "Europe/Istanbul",
  });

  useEffect(() => {
    setOrderedSeeds(seeds);
  }, [seeds]);

  const personalIntentSeeds = useMemo(
    () => orderedSeeds.filter(belongsToPersonalIntentArea),
    [orderedSeeds]
  );

  const counts = useMemo(
    () => ({
      all: personalIntentSeeds.length,
      growing: personalIntentSeeds.filter(isActivePersonalIntent).length,
      intent: personalIntentSeeds.filter(isConverted).length,
    }),
    [personalIntentSeeds]
  );

  const filteredSeeds = useMemo(
    () => personalIntentSeeds.filter((seed) => matchesFilter(seed, filter)),
    [filter, personalIntentSeeds]
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filteredSeeds.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, pageCount);

  const visibleSeeds = useMemo(
    () =>
      filteredSeeds.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
      ),
    [filteredSeeds, safePage]
  );

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    if (seeds.length === 0) return;

    let cancelled = false;

    void (async () => {
      const ids = seeds.map((seed) => seed.seed_id);

      const [settingsResult, defaultsResult] = await Promise.all([
        supabase
          .from("user_resource_reminder_settings")
          .select("resource_id, seed_target_time, timezone")
          .eq("resource_type", "seed")
          .in("resource_id", ids),
        supabase.rpc("get_my_reminder_defaults"),
      ]);

      if (cancelled) return;

      const defaults = defaultsResult.data as {
        seed_target_time?: string | null;
        timezone?: string | null;
      } | null;

      setFallbackClock({
        targetTime:
          typeof defaults?.seed_target_time === "string"
            ? defaults.seed_target_time.slice(0, 5)
            : "09:00",
        timezone:
          typeof defaults?.timezone === "string"
            ? defaults.timezone
            : "Europe/Istanbul",
      });

      const next: Record<string, ReminderClock> = {};

      for (const row of settingsResult.data ?? []) {
        if (typeof row.resource_id !== "string") continue;

        next[row.resource_id] = {
          targetTime:
            typeof row.seed_target_time === "string"
              ? row.seed_target_time.slice(0, 5)
              : "09:00",
          timezone:
            typeof row.timezone === "string"
              ? row.timezone
              : "Europe/Istanbul",
        };
      }

      setClocks(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [seeds]);

  async function moveSeed(seedId: string, direction: -1 | 1) {
    const visibleIndex = filteredSeeds.findIndex(
      (seed) => seed.seed_id === seedId
    );

    const targetVisible = filteredSeeds[visibleIndex + direction];

    if (visibleIndex < 0 || !targetVisible) return;

    const currentIndex = orderedSeeds.findIndex(
      (seed) => seed.seed_id === seedId
    );

    const targetIndex = orderedSeeds.findIndex(
      (seed) => seed.seed_id === targetVisible.seed_id
    );

    if (currentIndex < 0 || targetIndex < 0) return;

    const previous = orderedSeeds;
    const next = [...orderedSeeds];

    [next[currentIndex], next[targetIndex]] = [
      next[targetIndex],
      next[currentIndex],
    ];

    setOrderedSeeds(next);
    setOrderMessage("Sıralama kaydediliyor…");

    try {
      await setMyProfileDisplayOrder(
        "seed",
        next
          .filter((seed) => seed.status !== "archived")
          .map((seed) => seed.seed_id)
      );

      setOrderMessage("Sıralama kaydedildi");
    } catch (error) {
      setOrderedSeeds(previous);

      setOrderMessage(
        error instanceof Error
          ? error.message
          : "Sıralama kaydedilemedi."
      );
    }
  }

  if (personalIntentSeeds.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[28px] border border-green-100 bg-gradient-to-br from-green-50 via-white to-lime-50 p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
                  <h2 className="text-2xl font-black text-gray-950">
            Kişisel Niyetlerim
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Aktif veya Sosyal Niyete dönüşmüş kişisel niyetlerin.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              title="Aktif kişisel niyetler"
              onClick={() =>
                setFilter((current) =>
                  current === "growing" ? "all" : "growing"
                )
              }
              className={`inline-flex items-center gap-1 text-sm font-black transition ${
                filter === "growing"
                  ? "text-green-900"
                  : "text-green-700 hover:text-green-900"
              }`}
            >
              <span aria-hidden="true">🌱</span>
              <span>{counts.growing}</span>
            </button>

            <button
              type="button"
              title="Sosyal Niyete dönüşen kişisel niyetler"
              onClick={() =>
                setFilter((current) =>
                  current === "intent" ? "all" : "intent"
                )
              }
              className={`inline-flex items-center gap-1 text-sm font-black transition ${
                filter === "intent"
                  ? "text-blue-900"
                  : "text-blue-700 hover:text-blue-900"
              }`}
            >
              <span aria-hidden="true">✅</span>
              <span>{counts.intent}</span>
            </button>
          </div>
          {orderedSeeds.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setReordering((value) => !value);
                setOrderMessage(null);
              }}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                reordering
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-green-200 bg-white text-green-800 hover:bg-green-100"
              }`}
            >
              {reordering ? "Sıralamayı bitir" : "Sırala"}
            </button>
          )}
        </div>
      </div>

      {reordering && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white/80 px-4 py-3 text-xs text-gray-600">
          <span>
            Kartların üzerindeki oklarla sıralamayı değiştirebilirsin.
          </span>

          {orderMessage && (
            <span className="font-bold text-green-800">
              {orderMessage}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {visibleSeeds.map((seed) => {
          const clock = clocks[seed.seed_id] ?? fallbackClock;

          const filterIndex = filteredSeeds.findIndex(
            (item) => item.seed_id === seed.seed_id
          );

          return (
            <div key={seed.seed_id} className="min-w-0">
              {reordering && (
                <div className="mb-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`${seed.title} daha önce`}
                    disabled={filterIndex <= 0}
                    onClick={() => void moveSeed(seed.seed_id, -1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    aria-label={`${seed.title} daha sonra`}
                    disabled={filterIndex >= filteredSeeds.length - 1}
                    onClick={() => void moveSeed(seed.seed_id, 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                  >
                    →
                  </button>
                </div>
              )}

              <SeedCard
                seed={seed}
                isAuthenticated
                reminderTargetTime={clock.targetTime}
                reminderTimezone={clock.timezone}
                variant="timeline"
              />
            </div>
          );
        })}
      </div>
      {pageCount > 1 && (
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          aria-label="Kişisel Niyetler sayfaları"
        >
          <button
            type="button"
            aria-label="Önceki sayfa"
            disabled={safePage === 1}
            onClick={() =>
              setPage((value) => Math.max(1, value - 1))
            }
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-green-300 hover:text-green-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300"
          >
            ←
          </button>

          {Array.from(
            { length: pageCount },
            (_, index) => index + 1
          ).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`min-w-10 rounded-xl px-3.5 py-2 text-center text-sm font-black transition ${
                pageNumber === safePage
                  ? "bg-gray-950 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
              }`}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            aria-label="Sonraki sayfa"
            disabled={safePage === pageCount}
            onClick={() =>
              setPage((value) =>
                Math.min(pageCount, value + 1)
              )
            }
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-green-300 hover:text-green-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300"
          >
            →
          </button>
        </nav>
      )}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}