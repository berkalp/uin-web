"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import SeedCard from "@/components/seeds/SeedCard";
import { supabase } from "@/utils/supabase/client";
import type { SeedRecord } from "@/utils/seeds";

type TimelineGrowingSeedsProps = {
  seeds: SeedRecord[];
};

type ReminderClock = {
  targetTime: string;
  timezone: string;
};

const PAGE_SIZE = 4;

export default function TimelineGrowingSeeds({ seeds }: TimelineGrowingSeedsProps) {
  const [page, setPage] = useState(0);
  const [clocks, setClocks] = useState<Record<string, ReminderClock>>({});
  const [fallbackClock, setFallbackClock] = useState<ReminderClock>({
    targetTime: "09:00",
    timezone: "Europe/Istanbul",
  });

  const pageCount = Math.max(1, Math.ceil(seeds.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleSeeds = useMemo(
    () => seeds.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [safePage, seeds]
  );

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

      const defaults = defaultsResult.data as { seed_target_time?: string | null; timezone?: string | null } | null;
      setFallbackClock({
        targetTime: typeof defaults?.seed_target_time === "string" ? defaults.seed_target_time.slice(0, 5) : "09:00",
        timezone: typeof defaults?.timezone === "string" ? defaults.timezone : "Europe/Istanbul",
      });

      const next: Record<string, ReminderClock> = {};
      for (const row of settingsResult.data ?? []) {
        if (typeof row.resource_id !== "string") continue;
        next[row.resource_id] = {
          targetTime: typeof row.seed_target_time === "string" ? row.seed_target_time.slice(0, 5) : "09:00",
          timezone: typeof row.timezone === "string" ? row.timezone : "Europe/Istanbul",
        };
      }
      setClocks(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [seeds]);

  if (seeds.length === 0) return null;

  return (
    <section className="mt-8 rounded-[28px] border border-green-100 bg-gradient-to-br from-green-50 via-white to-lime-50 p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Kişisel katman</p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">Büyüyen Tohumlar</h2>
          <p className="mt-1 text-sm text-gray-500">Bir Niyete dönüşmeden önce büyümeye devam eden kişisel olasılıkların.</p>
        </div>

        <div className="flex items-center gap-2">
          {pageCount > 1 && (
            <div className="flex items-center rounded-xl border border-green-100 bg-white p-1 shadow-sm">
              <button type="button" aria-label="Önceki Tohumlar" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-gray-700 hover:bg-green-50 disabled:opacity-30">←</button>
              <span className="min-w-14 px-1 text-center text-[10px] font-bold text-gray-500">{safePage + 1} / {pageCount}</span>
              <button type="button" aria-label="Sonraki Tohumlar" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-gray-700 hover:bg-green-50 disabled:opacity-30">→</button>
            </div>
          )}
          <Link href="/seeds" className="rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-black text-green-800 transition hover:bg-green-100">Tüm Tohumları Gör</Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleSeeds.map((seed) => {
          const clock = clocks[seed.seed_id] ?? fallbackClock;
          return (
            <SeedCard
              key={seed.seed_id}
              seed={seed}
              isAuthenticated
              reminderTargetTime={clock.targetTime}
              reminderTimezone={clock.timezone}
              variant="timeline"
            />
          );
        })}
      </div>
    </section>
  );
}
