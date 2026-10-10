"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ProfileSeedCard from "@/components/seeds/ProfileSeedCard";
import { setMyProfileDisplayOrder } from "@/services/profileDisplayOrderService";
import {
  type PublicProfileSeedRecord,
} from "@/utils/seeds";

type PublicSeedsMode =
  | "all"
  | "active"
  | "completed";

type PublicSeedsPanelProps = {
  displayName: string;
  seeds: PublicProfileSeedRecord[];
  isOwner: boolean;
  mode?: PublicSeedsMode;
  eyebrow?: string;
  title?: string;
  description?: string;
};

type SeedFilter =
  | "all"
  | "growing"
  | "completed";

type ExperienceSort =
  | "date-desc"
  | "date-asc"
  | "rating-desc"
  | "rating-asc";

const PAGE_SIZE = 6;

const filters: Array<{
  value: SeedFilter;
  label: string;
}> = [
  { value: "all", label: "Tümü" },
  { value: "growing", label: "Aktif" },
  { value: "completed", label: "Yaşanan" },
];

function matchesFilter(seed: PublicProfileSeedRecord, filter: SeedFilter) {
  if (filter === "growing") {
    return seed.status === "active";
  }

  if (filter === "completed") {
    return seed.status === "completed";
  }

  return true;
}

function experienceTimestamp(seed: PublicProfileSeedRecord) {
  if (seed.experience_precision === "year" && seed.experience_year) {
    return Date.UTC(seed.experience_year, 0, 1);
  }

  if (seed.experience_precision === "unknown" || !seed.experience_date) {
    return null;
  }

  const timestamp = new Date(seed.experience_date).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc"
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

function sortExperiences(
  seeds: PublicProfileSeedRecord[],
  sort: ExperienceSort
) {
  return [...seeds].sort((left, right) => {
    const comparison = sort.startsWith("rating")
      ? compareNullableNumbers(
          left.personal_rating,
          right.personal_rating,
          sort.endsWith("asc") ? "asc" : "desc"
        )
      : compareNullableNumbers(
          experienceTimestamp(left),
          experienceTimestamp(right),
          sort.endsWith("asc") ? "asc" : "desc"
        );

    if (comparison !== 0) return comparison;
    return right.updated_at.localeCompare(left.updated_at);
  });
}

export default function PublicSeedsPanel({
  displayName,
  seeds,
  isOwner,
  mode = "all",
  eyebrow = "Kişisel Niyetler",
  title,
  description = "Aktif, yaşanmış veya sosyal bir niyete dönüşmüş kişisel kayıtlar.",
}: PublicSeedsPanelProps) {
  const [filter, setFilter] = useState<SeedFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [orderedSeedIds, setOrderedSeedIds] = useState(() =>
    seeds.map((seed) => seed.seed_id)
  );
  const [experienceSort, setExperienceSort] =
    useState<ExperienceSort>("date-desc");
  const [reordering, setReordering] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  const orderedSeeds = useMemo(() => {
    const byId = new Map(seeds.map((seed) => [seed.seed_id, seed]));
    const ordered = orderedSeedIds.flatMap((seedId) => {
      const seed = byId.get(seedId);
      if (!seed) return [];
      byId.delete(seedId);
      return [seed];
    });

    return [...ordered, ...byId.values()];
  }, [orderedSeedIds, seeds]);

  const counts = useMemo(
    () => ({
      all: orderedSeeds.length,
      growing: orderedSeeds.filter((seed) => seed.status === "active").length,
      completed: orderedSeeds.filter((seed) => seed.status === "completed").length,
    }),
    [orderedSeeds]
  );

  const filteredSeeds = useMemo(() => {
    if (mode === "active") {
      return orderedSeeds.filter((seed) => seed.status === "active");
    }

    if (mode === "completed") {
      return sortExperiences(
        orderedSeeds.filter((seed) => seed.status === "completed"),
        experienceSort
      );
    }

    return orderedSeeds.filter((seed) => matchesFilter(seed, filter));
  }, [experienceSort, filter, mode, orderedSeeds]);


  const visibleSeeds = reordering
    ? filteredSeeds
    : filteredSeeds.slice(0, visibleCount);

  const hasMoreSeeds =
    !reordering && visibleCount < filteredSeeds.length;

  const hasExpandedSeeds =
    !reordering && filteredSeeds.length > PAGE_SIZE;

  async function moveSeed(seedId: string, direction: -1 | 1) {
    const visibleIndex = filteredSeeds.findIndex(
      (seed) => seed.seed_id === seedId
    );
    const targetVisible = filteredSeeds[visibleIndex + direction];

    if (visibleIndex < 0 || !targetVisible) {
      return;
    }

    const currentIndex = orderedSeeds.findIndex(
      (seed) => seed.seed_id === seedId
    );
    const targetIndex = orderedSeeds.findIndex(
      (seed) => seed.seed_id === targetVisible.seed_id
    );

    if (currentIndex < 0 || targetIndex < 0) {
      return;
    }

    const previousOrder = orderedSeedIds;
    const next = [...orderedSeeds];
    [next[currentIndex], next[targetIndex]] = [
      next[targetIndex],
      next[currentIndex],
    ];

    const nextOrder = next.map((seed) => seed.seed_id);
    setOrderedSeedIds(nextOrder);
    setOrderMessage("Sıralama kaydediliyor…");

    try {
      await setMyProfileDisplayOrder(
        "seed",
        nextOrder
      );
      setOrderMessage("Sıralama kaydedildi");
    } catch (error) {
      setOrderedSeedIds(previousOrder);
      setOrderMessage(
        error instanceof Error ? error.message : "Sıralama kaydedilemedi."
      );
    }
  }

  return (
    <section className="mt-8 scroll-mt-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            {title ?? `${displayName} · ${eyebrow}`}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {mode === "all" && orderedSeeds.length > 0 && (
            <div className="inline-flex max-w-full overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setFilter(item.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    filter === item.value
                      ? "bg-gray-950 text-white"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-950"
                  }`}
                >
                  {item.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      filter === item.value
                        ? "bg-white/15 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {counts[item.value]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {mode === "completed" && counts.completed > 0 && (
            <label className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                Sırala
              </span>
              <select
                value={experienceSort}
                onChange={(event) => {
                  setExperienceSort(event.target.value as ExperienceSort);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="min-w-0 flex-1 border-0 bg-transparent p-1 text-sm font-bold text-gray-700 outline-none"
                aria-label="Deneyimleri sırala"
              >
                <option value="date-desc">En yeni deneyim</option>
                <option value="date-asc">En eski deneyim</option>
                <option value="rating-desc">Puanı yüksek</option>
                <option value="rating-asc">Puanı düşük</option>
              </select>
            </label>
          )}


          {isOwner && mode === "all" && orderedSeeds.length > 1 && (
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

          {isOwner && (
            <Link
              href="/seeds"
              className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              Tümünü gör
            </Link>
          )}
        </div>
      </div>

      {reordering && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white/80 px-4 py-3 text-xs text-gray-600">
          <span>
            Görünen kartları oklarla sırala. Bu sıra herkese açık profiline kaydedilir.
          </span>
          {orderMessage && (
            <span className="font-bold text-green-800">{orderMessage}</span>
          )}
        </div>
      )}

      {visibleSeeds.length > 0 ? (
      <>
        <div className="uin-card-grid mt-6 grid items-stretch gap-5">
          {visibleSeeds.map((seed) => {
            const filterIndex = filteredSeeds.findIndex(
              (item) => item.seed_id === seed.seed_id
            );

            return (
              <div
                key={seed.seed_id}
                className="relative min-w-0"
              >
                {reordering && (
                  <div className="absolute right-2 top-2 z-20 flex gap-1 rounded-xl bg-white/95 p-1 shadow-md backdrop-blur">
                    <button
                      type="button"
                      aria-label={`${seed.title} kaydını öne taşı`}
                      disabled={filterIndex <= 0}
                      onClick={() => void moveSeed(seed.seed_id, -1)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label={`${seed.title} kaydını geriye taşı`}
                      disabled={filterIndex >= filteredSeeds.length - 1}
                      onClick={() => void moveSeed(seed.seed_id, 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                    >
                      →
                    </button>
                  </div>
                )}

                <ProfileSeedCard
                  seed={seed}
                  displayName={displayName}
                  isOwner={isOwner}
                />
              </div>
            );
          })}
        </div>

        {hasExpandedSeeds && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((current) =>
                  hasMoreSeeds
                    ? Math.min(current + PAGE_SIZE, filteredSeeds.length)
                    : PAGE_SIZE
                )
              }
              className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-800"
            >
              {hasMoreSeeds ? "Devamını gör" : "Daha az göster"}
            </button>
          </div>
        )}
      </>
      ) : orderedSeeds.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-green-200 bg-white/70 p-7 text-center text-sm text-gray-500">
          Bu filtreye uyan kayıt yok.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-green-200 bg-white/70 p-7 text-center text-sm text-gray-500">
          Arkadaşlarla veya herkesle paylaşılan kişisel niyetler ve deneyimler burada görünür.
        </div>
      )}
    </section>
  );
}
