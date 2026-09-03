"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import SeedCard from "@/components/seeds/SeedCard";
import {
  getLocalDateKey,
  getSeedDashboardStatus,
  type SeedDashboardStatus,
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

const tabs: Array<{
  value: SeedDashboardStatus;
  label: string;
}> = [
  { value: "active", label: "Aktif" },
  { value: "past_due", label: "Süresi geçti" },
  { value: "completed", label: "Deneyimler" },
  { value: "archived", label: "Kapananlar" },
];

const PAGE_SIZE = 6;

export default function SeedDashboard({
  seeds,
  isAuthenticated,
  mode = "intentions",
}: SeedDashboardProps) {
  const [activeTab, setActiveTab] = useState<SeedDashboardStatus>(mode === "experiences" ? "completed" : "active");
  const [scope, setScope] = useState<"all" | "library" | "private">("all");
  const [page, setPage] = useState(0);

  const today = useMemo(() => getLocalDateKey(), []);

  const counts = useMemo(
    () => ({
      active: seeds.filter((seed) => getSeedDashboardStatus(seed, today) === "active").length,
      past_due: seeds.filter((seed) => getSeedDashboardStatus(seed, today) === "past_due").length,
      completed: seeds.filter((seed) => getSeedDashboardStatus(seed, today) === "completed").length,
      archived: seeds.filter((seed) => getSeedDashboardStatus(seed, today) === "archived").length,
    }),
    [seeds, today]
  );

  const visibleSeeds = useMemo(
    () => seeds.filter((seed) => getSeedDashboardStatus(seed, today) === activeTab && (scope === "all" || seed.seed_scope === scope)),
    [activeTab, scope, seeds, today]
  );

  const pageCount = Math.max(1, Math.ceil(visibleSeeds.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSeeds = useMemo(
    () => visibleSeeds.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [safePage, visibleSeeds]
  );

  useEffect(() => {
    setPage(0);
  }, [activeTab, scope]);

  return (
    <>
      <section className="mt-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm">
        <div className={`grid gap-2 ${mode === "experiences" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3"}`}>
          {tabs.filter((tab) => mode === "experiences" ? tab.value === "completed" : tab.value !== "completed").map((tab) => {
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "Tümü" },
            { value: "library", label: "Kütüphaneden" },
            { value: "private", label: "🔒 Kendi eklediklerim" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setScope(item.value as "all" | "library" | "private")}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${scope === item.value ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-700 hover:border-emerald-400"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            {safePage > 0 && <button type="button" aria-label="Önceki Tohumlar" onClick={() => setPage((value) => Math.max(0, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-sm font-black text-emerald-800 hover:bg-emerald-50">←</button>}
            <span className="px-1 text-[9px] font-bold text-gray-400">{safePage + 1}/{pageCount}</span>
            {safePage < pageCount - 1 && <button type="button" aria-label="Sonraki Tohumları Gör" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-sm font-black text-emerald-800 hover:bg-emerald-50">→</button>}
          </div>
        )}
      </div>

      {visibleSeeds.length > 0 ? (
        <section className="mt-5 grid items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {pageSeeds.map((seed) => (
            <SeedCard
              key={seed.seed_id}
              seed={seed}
              isAuthenticated={isAuthenticated}
              reminderTargetTime={seed.reminder_target_time}
              reminderTimezone={seed.reminder_timezone}
            />
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-[32px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="text-5xl" aria-hidden="true">
            🌱
          </div>
          <h2 className="mt-5 text-2xl font-black text-gray-950">
            {activeTab === "past_due"
              ? "Süresi geçen Tohum yok"
              : activeTab === "archived"
                ? "Kapanan Tohum yok"
                : `No ${activeTab} Seeds`}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-gray-500">
            {activeTab === "past_due"
              ? "Hedef tarihi geçen ama tamamlanmamış Tohumlar burada kalır. Tarihini bugüne veya geleceğe taşıdığında otomatik olarak yeniden Active olur."
              : activeTab === "archived"
                ? "Vazgeçtiğin, iptal ettiğin veya artık peşinden gitmediğin Tohumlar burada tutulur."
                : "Seeds are personal possibilities. They do not need a date, location or participant list until you decide to turn them into something social."}
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
