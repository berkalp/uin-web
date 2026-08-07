"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { SeedRecord } from "@/utils/seeds";

type TimelineGrowingSeedsProps = {
  seeds: SeedRecord[];
};

const PAGE_SIZE = 5;

function formatTargetDate(value: string | null) {
  if (!value) {
    return "No target date";
  }

  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function TimelineGrowingSeeds({
  seeds,
}: TimelineGrowingSeedsProps) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(seeds.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleSeeds = useMemo(
    () =>
      seeds.slice(
        safePage * PAGE_SIZE,
        safePage * PAGE_SIZE + PAGE_SIZE
      ),
    [safePage, seeds]
  );

  if (seeds.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[28px] border border-green-100 bg-gradient-to-br from-green-50 via-white to-lime-50 p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
            Personal layer
          </p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">
            Growing Seeds
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Personal possibilities still growing before they become an Intent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pageCount > 1 && (
            <div className="flex items-center rounded-2xl border border-green-100 bg-white p-1 shadow-sm">
              <button
                type="button"
                aria-label="Previous Seeds"
                disabled={safePage === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-black text-gray-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ←
              </button>
              <span className="min-w-16 px-2 text-center text-[11px] font-bold text-gray-500">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next Seeds"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((value) => Math.min(pageCount - 1, value + 1))
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-black text-gray-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}

          <Link
            href="/seeds"
            className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-bold text-green-800 transition hover:bg-green-100"
          >
            View all Seeds
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {visibleSeeds.map((seed) => (
          <Link
            key={seed.seed_id}
            href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
            className="group relative min-h-44 overflow-hidden rounded-[22px] border border-white/90 bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {seed.cover_url && (
              <img
                src={seed.cover_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/20" />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              <span className="max-w-[72%] truncate rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur">
                {seed.seed_type_icon} {seed.seed_type_name}
              </span>
              <span className="rounded-full bg-green-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-green-800">
                Growing
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <h3 className="line-clamp-2 text-base font-black leading-tight">
                {seed.title}
              </h3>
              {seed.subtitle && (
                <p className="mt-1 truncate text-[11px] font-semibold text-white/75">
                  {seed.subtitle}
                </p>
              )}
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-white/65">
                {formatTargetDate(seed.target_date)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
