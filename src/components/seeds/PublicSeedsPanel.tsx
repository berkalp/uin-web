"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import { setMyProfileDisplayOrder } from "@/services/profileDisplayOrderService";
import {
  toSeedCount,
  type PublicSeedRecord,
} from "@/utils/seeds";

type PublicSeedsPanelProps = {
  displayName: string;
  seeds: PublicSeedRecord[];
  isOwner: boolean;
  isAuthenticated: boolean;
};

type SeedFilter =
  | "all"
  | "growing"
  | "completed"
  | "intent";

const PAGE_SIZE = 5;

const filters: Array<{
  value: SeedFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "growing", label: "Growing" },
  { value: "completed", label: "Completed" },
  { value: "intent", label: "Grew into Intent" },
];

function matchesFilter(seed: PublicSeedRecord, filter: SeedFilter) {
  if (filter === "growing") {
    return seed.status === "active";
  }

  if (filter === "completed") {
    return seed.status === "completed";
  }

  if (filter === "intent") {
    return toSeedCount(seed.grown_intent_count) > 0;
  }

  return true;
}

export default function PublicSeedsPanel({
  displayName,
  seeds,
  isOwner,
  isAuthenticated,
}: PublicSeedsPanelProps) {
  const [filter, setFilter] = useState<SeedFilter>("all");
  const [page, setPage] = useState(0);
  const [orderedSeeds, setOrderedSeeds] = useState(seeds);
  const [reordering, setReordering] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrderedSeeds(seeds);
  }, [seeds]);

  const counts = useMemo(
    () => ({
      all: orderedSeeds.length,
      growing: orderedSeeds.filter((seed) => seed.status === "active").length,
      completed: orderedSeeds.filter((seed) => seed.status === "completed").length,
      intent: orderedSeeds.filter(
        (seed) => toSeedCount(seed.grown_intent_count) > 0
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
  const visibleSeeds = filteredSeeds.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  useEffect(() => {
    setPage(0);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

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
        next.map((seed) => seed.seed_id)
      );
      setOrderMessage("Order saved");
    } catch (error) {
      setOrderedSeeds(previous);
      setOrderMessage(
        error instanceof Error ? error.message : "Order could not be saved."
      );
    }
  }

  if (seeds.length === 0 && !isOwner) {
    return null;
  }

  return (
    <section className="mt-10 rounded-[32px] border border-green-100 bg-gradient-to-br from-green-50 via-white to-lime-50 p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
            Planted Seeds
          </p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">
            Seeds {displayName} has planted
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-600">
            Personal ideas, goals and possibilities that can remain personal,
            be completed, or grow into social Intents.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {orderedSeeds.length > 0 && (
            <div className="flex flex-wrap rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
              {filters.map((item) => (
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
          )}

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

          {isOwner && orderedSeeds.length > 1 && (
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

          {isOwner && (
            <Link
              href="/seeds"
              className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              Manage Seeds
            </Link>
          )}
        </div>
      </div>

      {reordering && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white/80 px-4 py-3 text-xs text-gray-600">
          <span>
            Use the arrows on each visible card. This order is saved to the public profile.
          </span>
          {orderMessage && (
            <span className="font-bold text-green-800">{orderMessage}</span>
          )}
        </div>
      )}

      {visibleSeeds.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {visibleSeeds.map((seed) => {
            const grownIntentCount = toSeedCount(seed.grown_intent_count);
            const journalCount = toSeedCount(seed.journal_count);
            const filterIndex = filteredSeeds.findIndex(
              (item) => item.seed_id === seed.seed_id
            );

            return (
              <article
                key={seed.seed_id}
                className="relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {reordering && (
                  <div className="absolute right-2 top-2 z-20 flex gap-1 rounded-xl bg-white/95 p-1 shadow-md backdrop-blur">
                    <button
                      type="button"
                      aria-label={`Move ${seed.title} earlier`}
                      disabled={filterIndex <= 0}
                      onClick={() => void moveSeed(seed.seed_id, -1)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${seed.title} later`}
                      disabled={filterIndex >= filteredSeeds.length - 1}
                      onClick={() => void moveSeed(seed.seed_id, 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black text-gray-800 transition hover:bg-gray-100 disabled:opacity-25"
                    >
                      →
                    </button>
                  </div>
                )}

                <Link
                  href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
                  className="relative block aspect-square overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700"
                >
                  {seed.cover_url && (
                    <img
                      src={seed.cover_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />

                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                    <span className="max-w-[70%] truncate rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
                      {seed.seed_type_icon} {seed.seed_type_name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                        seed.status === "completed"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {seed.status === "completed" ? "Done" : "Growing"}
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <h3 className="line-clamp-2 text-base font-black leading-tight sm:text-lg">
                      {seed.title}
                    </h3>
                    {seed.subtitle && (
                      <p className="mt-1 truncate text-[11px] font-semibold text-white/75">
                        {seed.subtitle}
                      </p>
                    )}
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-3.5">
                  {seed.key_takeaway && (
                    <p className="line-clamp-2 text-xs font-semibold leading-5 text-purple-800">
                      “{seed.key_takeaway}”
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    {grownIntentCount > 0 && (
                      <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                        ↗ {grownIntentCount} Intent
                      </span>
                    )}
                    {journalCount > 0 && (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">
                        ✎ {journalCount}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3">
                    <SeedReactionBar
                      seedId={seed.seed_id}
                      initialContext={seed.reaction_context}
                      isAuthenticated={isAuthenticated}
                      isOwner={isOwner}
                      variant="compact"
                    />

                    <Link
                      href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
                      className="mt-2 flex w-full justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 transition hover:border-green-300 hover:bg-green-50"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : orderedSeeds.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-green-200 bg-white/70 p-7 text-center text-sm text-gray-500">
          No Seeds match this filter.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-green-200 bg-white/70 p-7 text-center text-sm text-gray-500">
          Seeds shared with friends or everyone will appear here, including completed Seeds and their reflections.
        </div>
      )}
    </section>
  );
}
