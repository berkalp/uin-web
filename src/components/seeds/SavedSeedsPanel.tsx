"use client";

import SeedSquareCard from "@/components/seeds/SeedSquareCard";
import type { PublicSeedRecord } from "@/utils/seeds";

type SavedSeedsPanelProps = {
  seeds: PublicSeedRecord[];
  isAuthenticated: boolean;
};

export default function SavedSeedsPanel({
  seeds,
  isAuthenticated,
}: SavedSeedsPanelProps) {
  if (seeds.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[32px] border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-sm md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
        Saved Seeds
      </p>
      <h2 className="mt-2 text-2xl font-black text-gray-950">
        Seeds you kept for later
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-600">
        This collection is private. Saving does not notify the person who planted the Seed.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {seeds.map((seed) => (
          <SeedSquareCard
            key={seed.seed_id}
            seed={seed}
            isAuthenticated={isAuthenticated}
            isOwner={false}
          />
        ))}
      </div>
    </section>
  );
}
