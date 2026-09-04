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

const PAGE_SIZE = 6;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const visibleSeeds =
    mode === "experiences"
      ? completedSeeds.slice(0, visibleCount)
      : filteredIntentions.slice(0, visibleCount);

  const totalVisiblePool =
    mode === "experiences"
      ? completedSeeds
      : filteredIntentions;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, scope, mode]);

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
                        value + PAGE_SIZE,
                        completedSeeds.length
                      )
                    )
                  }
                  className="rounded-xl border border-purple-200 bg-white px-6 py-3 text-sm font-black text-purple-700 hover:bg-purple-50"
                >
                  Devamını gör
                  <span className="ml-2 text-xs">
                    +{Math.min(PAGE_SIZE, completedSeeds.length - visibleSeeds.length)}
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-black transition ${
              filter === "active"
                ? "border-green-600 bg-green-600 text-white"
                : "border-green-200 bg-green-50 text-green-800 hover:border-green-400"
            }`}
          >
            <span aria-hidden="true">🌱</span>
            <span>{counts.active}</span>
          </button>

          <button
            type="button"
            title="Sosyal Niyete dönüşen kişisel niyetler"
            onClick={() => setFilter("converted")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-black transition ${
              filter === "converted"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400"
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

          {visibleSeeds.length < totalVisiblePool.length && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((value) =>
                    Math.min(
                      value + PAGE_SIZE,
                      totalVisiblePool.length
                    )
                  )
                }
                className="rounded-xl border border-emerald-200 bg-white px-6 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-50"
              >
                Devamını gör
                <span className="ml-2 text-xs">
                  +{Math.min(
                    PAGE_SIZE,
                    totalVisiblePool.length - visibleSeeds.length
                  )}
                </span>
              </button>
            </div>
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