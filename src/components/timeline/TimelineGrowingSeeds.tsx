"use client";

import Link from "next/link";
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

type SeedFilter = "all" | "growing" | "completed" | "intent";

const PAGE_SIZE = 6;

const FILTERS: Array<{
  value: SeedFilter;
  label: string;
}> = [
  { value: "all", label: "Tümü" },
  { value: "growing", label: "Aktif" },
  { value: "completed", label: "Yaşanan" },
  { value: "intent", label: "Sosyal Niyete Dönüşen" },
];

function matchesFilter(seed: SeedRecord, filter: SeedFilter) {
  if (filter === "growing") return seed.status === "active" && !isSeedPastDue(seed);
  if (filter === "completed") return seed.status === "completed";
  if (filter === "intent") return toSeedCount(seed.grown_intent_count) > 0;
  return seed.status !== "archived" && !isSeedPastDue(seed);
}

export default function TimelineGrowingSeeds({ seeds }: TimelineGrowingSeedsProps) {
  const [filter, setFilter] = useState<SeedFilter>("all");
  const [page, setPage] = useState(0);
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

  const counts = useMemo(
    () => ({
      all: orderedSeeds.filter((seed) => seed.status !== "archived" && !isSeedPastDue(seed)).length,
      growing: orderedSeeds.filter((seed) => seed.status === "active" && !isSeedPastDue(seed)).length,
      completed: orderedSeeds.filter((seed) => seed.status === "completed").length,
      intent: orderedSeeds.filter(
        (seed) => seed.status !== "archived" && toSeedCount(seed.grown_intent_count) > 0
      ).length,
    }),
    [orderedSeeds]
  );

  const filteredSeeds = useMemo(
    () => orderedSeeds.filter((seed) => matchesFilter(seed, filter)),
    [filter, orderedSeeds]
  );

  const pageCount = Math.max(1, Math.ceil(filteredSeeds.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleSeeds = useMemo(
    () =>
      filteredSeeds.slice(
        safePage * PAGE_SIZE,
        safePage * PAGE_SIZE + PAGE_SIZE
      ),
    [filteredSeeds, safePage]
  );

  useEffect(() => {
    setPage(0);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
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
    const visibleIndex = filteredSeeds.findIndex((seed) => seed.seed_id === seedId);
    const targetVisible = filteredSeeds[visibleIndex + direction];

    if (visibleIndex < 0 || !targetVisible) return;

    const currentIndex = orderedSeeds.findIndex((seed) => seed.seed_id === seedId);
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
    setOrderMessage("Saving order…");

    try {
      await setMyProfileDisplayOrder(
        "seed",
        next
          .filter((seed) => seed.status !== "archived")
          .map((seed) => seed.seed_id)
      );
      setOrderMessage("Order saved");
    } catch (error) {
      setOrderedSeeds(previous);
      setOrderMessage(
        error instanceof Error ? error.message : "Order could not be saved."
      );
    }
  }

  if (orderedSeeds.filter((seed) => seed.status !== "archived").length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[28px] border border-green-100 bg-gradient-to-br from-green-50 via-white to-lime-50 p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
            KİŞİSEL NİYETLER
          </p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">Kişisel Niyetlerim</h2>
          <p className="mt-1 text-sm text-gray-500">
            Aktif, yaşanmış veya sosyal bir niyete dönüşmüş kişisel niyetlerin.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  filter === item.value
                    ? "bg-gray-950 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    filter === item.value
                      ? "bg-white/15 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {counts[item.value]}
                </span>
              </button>
            ))}
          </div>

          {filteredSeeds.length > PAGE_SIZE && (
            <div className="flex items-center rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                aria-label="Previous Seeds"
                disabled={safePage === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                className="rounded-xl px-3 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ←
              </button>
              <span className="min-w-20 px-2 text-center text-[11px] font-bold text-gray-500">
                {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filteredSeeds.length)} of{" "}
                {filteredSeeds.length}
              </span>
              <button
                type="button"
                aria-label="Next Seeds"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((value) => Math.min(pageCount - 1, value + 1))
                }
                className="rounded-xl px-3 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}

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
              {reordering ? "Done ordering" : "Reorder"}
            </button>
          )}

          <Link
            href="/seeds"
            className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
          >
            Tümünü gör
          </Link>
        </div>
      </div>

      {reordering && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white/80 px-4 py-3 text-xs text-gray-600">
          <span>Use the arrows above each visible Seed card.</span>
          {orderMessage && (
            <span className="font-bold text-green-800">{orderMessage}</span>
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
                    aria-label={`Move ${seed.title} earlier`}
                    disabled={filterIndex <= 0}
                    onClick={() => void moveSeed(seed.seed_id, -1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${seed.title} later`}
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
    </section>
  );
}
