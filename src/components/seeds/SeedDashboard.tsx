"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import SeedCard from "@/components/seeds/SeedCard";
import {
  getLocalDateKey,
  getSeedDashboardStatus,
  isSeedPastDue,
  toSeedCount,
  type SeedRecord,
} from "@/utils/seeds";

type SeedWithReminder = SeedRecord & {
  reminder_target_time?: string | null;
  reminder_timezone?: string | null;
};

type SeedDashboardProps = {
  seeds: SeedWithReminder[];
  isAuthenticated: boolean;
  mode?: "intentions" | "experiences";
};

type IntentFilter = "all" | "active" | "converted";

const EXPERIENCE_PAGE_SIZE = 6;
const INTENTION_PAGE_SIZE = 12;

function isConverted(seed: SeedRecord) {
  return toSeedCount(seed.grown_intent_count) > 0;
}

function isActiveIntent(seed: SeedRecord) {
  return seed.status === "active" && !isSeedPastDue(seed);
}

function belongsToIntentions(seed: SeedRecord) {
  if (seed.status === "archived") return false;

  return isActiveIntent(seed) || isConverted(seed);
}

export default function SeedDashboard({
  seeds,
  isAuthenticated,
  mode = "intentions",
}: SeedDashboardProps) {
  const [filter, setFilter] = useState<IntentFilter>("all");
  const [scope, setScope] = useState<"all" | "library" | "private">("all");
  const [visibleCount, setVisibleCount] = useState(EXPERIENCE_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const today = useMemo(() => getLocalDateKey(), []);

  const completedSeeds = useMemo(
    () =>
      seeds.filter(
        (seed) =>
          getSeedDashboardStatus(seed, today) === "completed"
      ),
    [seeds, today]
  );

  const intentionSeeds = useMemo(
    () => seeds.filter(belongsToIntentions),
    [seeds]
  );

  const counts = useMemo(
    () => ({
      all: intentionSeeds.length,
      active: intentionSeeds.filter(isActiveIntent).length,
      converted: intentionSeeds.filter(isConverted).length,
    }),
    [intentionSeeds]
  );

  const scopedIntentions = useMemo(
    () =>
      intentionSeeds.filter(
        (seed) =>
          scope === "all" ||
          seed.seed_scope === scope
      ),
    [intentionSeeds, scope]
  );

  const filteredIntentions = useMemo(() => {
    if (filter === "active") {
      return scopedIntentions.filter(isActiveIntent);
    }

    if (filter === "converted") {
      return scopedIntentions.filter(isConverted);
    }

    return scopedIntentions;
  }, [filter, scopedIntentions]);

  const totalVisiblePool =
    mode === "experiences"
      ? completedSeeds
      : filteredIntentions;

  const intentionPageCount = Math.max(
    1,
    Math.ceil(filteredIntentions.length / INTENTION_PAGE_SIZE)
  );

  const safePage = Math.min(page, intentionPageCount);

  const visibleSeeds =
    mode === "experiences"
      ? completedSeeds.slice(0, visibleCount)
      : filteredIntentions.slice(
          (safePage - 1) * INTENTION_PAGE_SIZE,
          safePage * INTENTION_PAGE_SIZE
        );

  useEffect(() => {
    setVisibleCount(EXPERIENCE_PAGE_SIZE);
  }, [mode]);

  useEffect(() => {
    setPage(1);
  }, [filter, scope, mode]);

  useEffect(() => {
    if (page > intentionPageCount) {
      setPage(intentionPageCount);
    }
  }, [page, intentionPageCount]);

  if (mode === "experiences") {
    return (
      <>
        {completedSeeds.length > 0 ? (
          <>
            <section className="mt-6 grid items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {visibleSeeds.map((seed) => (
                <SeedCard
                  key={seed.seed_id}
                  seed={seed}
                  isAuthenticated={isAuthenticated}
                  reminderTargetTime={seed.reminder_target_time}
                  reminderTimezone={seed.reminder_timezone}
                />
              ))}
            </section>

            {visibleSeeds.length < completedSeeds.length && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((value) =>
                      Math.min(
                        value + EXPERIENCE_PAGE_SIZE,
                        completedSeeds.length
                      )
                    )
                  }
                  className="rounded-xl border border-purple-200 bg-white px-6 py-3 text-sm font-black text-purple-700 hover:bg-purple-50"
                >
                  Devamını gör
                  <span className="ml-2 text-xs">
                    +{Math.min(EXPERIENCE_PAGE_SIZE, completedSeeds.length - visibleSeeds.length)}
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          <section className="mt-6 rounded-[32px] border border-dashed border-gray-300 bg-white p-10 text-center">
            <h2 className="text-2xl font-black text-gray-950">
              Henüz kişisel deneyimin yok
            </h2>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Aktif kişisel niyetler"
            onClick={() => setFilter("active")}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-black transition ${
              filter === "active"
                ? "text-green-700"
                : "text-green-700 hover:bg-green-50"
            }`}
          >
            <span aria-hidden="true">🌱</span>
            <span>{counts.active}</span>
          </button>

          <button
            type="button"
            title="Sosyal Niyete dönüşen kişisel niyetler"
            onClick={() => setFilter("converted")}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-black transition ${
              filter === "converted"
                ? "text-blue-700"
                : "text-blue-700 hover:bg-blue-50"
            }`}
          >
            <span aria-hidden="true">✅</span>
            <span>{counts.converted}</span>
          </button>

          {(filter === "active" || filter === "converted") && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 transition hover:bg-gray-50"
            >
              Tümü {counts.all}
            </button>
          )}
        </div>

        <Link
          href="/seeds/new?mode=personal"
          className="inline-flex items-center rounded-xl bg-green-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-green-700"
        >
          + Kişisel niyet oluştur
        </Link>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { value: "all", label: "Tümü" },
          { value: "library", label: "Kütüphaneden" },
          { value: "private", label: "Kendi eklediklerim" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() =>
              setScope(
                item.value as "all" | "library" | "private"
              )
            }
            className={`rounded-full px-4 py-2 text-xs font-black transition ${
              scope === item.value
                ? "bg-emerald-700 text-white"
                : "border border-gray-200 bg-white text-gray-700 hover:border-emerald-400"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredIntentions.length > 0 ? (
        <>
          <section className="mt-5 grid items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {visibleSeeds.map((seed) => (
              <SeedCard
                key={seed.seed_id}
                seed={seed}
                isAuthenticated={isAuthenticated}
                reminderTargetTime={seed.reminder_target_time}
                reminderTimezone={seed.reminder_timezone}
              />
            ))}
          </section>
        {intentionPageCount > 1 && (
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
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300"
            >
              ←
            </button>

            {Array.from(
              { length: intentionPageCount },
              (_, index) => index + 1
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`min-w-10 rounded-xl px-3.5 py-2 text-center text-sm font-black transition ${
                  pageNumber === safePage
                    ? "bg-gray-950 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              aria-label="Sonraki sayfa"
              disabled={safePage === intentionPageCount}
              onClick={() =>
                setPage((value) =>
                  Math.min(intentionPageCount, value + 1)
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-300"
            >
              →
            </button>
          </nav>
        )}
        </>
      ) : (
        <section className="mt-6 rounded-[32px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-4xl" aria-hidden="true">
            🌱
          </div>

          <h2 className="mt-4 text-2xl font-black text-gray-950">
            Burada henüz kişisel niyet yok
          </h2>

          <Link
            href="/seeds/new?mode=personal"
            className="mt-6 inline-flex rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-700"
          >
            + Kişisel niyet oluştur
          </Link>
        </section>
      )}
    </>
  );
}