"use client";

import Link from "next/link";

import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import {
  toSeedCount,
  type PublicSeedRecord,
} from "@/utils/seeds";

type SeedSquareCardProps = {
  seed: PublicSeedRecord;
  isAuthenticated: boolean;
  isOwner: boolean;
};

export default function SeedSquareCard({
  seed,
  isAuthenticated,
  isOwner,
}: SeedSquareCardProps) {
  const grownIntentCount = toSeedCount(seed.grown_intent_count);
  const journalCount = toSeedCount(seed.journal_count);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
}
