"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import SeedCard from "@/components/seeds/SeedCard";
import {
  type SeedRecord,
  type SeedStatus,
} from "@/utils/seeds";

type SeedDashboardProps = {
  seeds: SeedRecord[];
  isAuthenticated: boolean;
};

const tabs: Array<{
  value: SeedStatus;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export default function SeedDashboard({
  seeds,
  isAuthenticated,
}: SeedDashboardProps) {
  const [activeTab, setActiveTab] = useState<SeedStatus>("active");

  const counts = useMemo(
    () => ({
      active: seeds.filter((seed) => seed.status === "active").length,
      completed: seeds.filter((seed) => seed.status === "completed").length,
      archived: seeds.filter((seed) => seed.status === "archived").length,
    }),
    [seeds]
  );

  const visibleSeeds = useMemo(
    () => seeds.filter((seed) => seed.status === activeTab),
    [activeTab, seeds]
  );

  return (
    <>
      <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => {
            const selected = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-2xl px-4 py-4 text-left transition ${
                  selected
                    ? "bg-gray-950 text-white shadow-sm"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
                  {tab.label}
                </span>
                <span className="mt-2 block text-2xl font-black">
                  {counts[tab.value]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {visibleSeeds.length > 0 ? (
        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleSeeds.map((seed) => (
            <SeedCard
              key={seed.seed_id}
              seed={seed}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-[32px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden="true">
            🌱
          </div>
          <h2 className="mt-5 text-2xl font-black text-gray-950">
            No {activeTab} Seeds
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-gray-500">
            Seeds are personal possibilities. They do not need a date, location or participant list until you decide to turn them into something social.
          </p>
          {activeTab === "active" && (
            <Link
              href="/seeds/new"
              className="mt-6 inline-flex rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-700"
            >
              Plant your first Seed
            </Link>
          )}
        </section>
      )}
    </>
  );
}
