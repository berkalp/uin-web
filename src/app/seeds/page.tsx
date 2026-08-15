import Link from "next/link";
import { redirect } from "next/navigation";

import SavedSeedsPanel from "@/components/seeds/SavedSeedsPanel";
import SeedDashboard from "@/components/seeds/SeedDashboard";
import {
  parseSeedLinks,
  parseSeedReactionContexts,
  type PublicSeedRecord,
  type SeedRecord,
} from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

export default async function SeedsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [mySeedsResult, savedSeedsResult] = await Promise.all([
    supabase.rpc("get_my_seeds_v2", {
      p_status: null,
    }),
    supabase.rpc("get_my_saved_seeds", {
      p_limit: 30,
      p_offset: 0,
    }),
  ]);

  if (mySeedsResult.error) {
    console.error("My Seeds query failed:", mySeedsResult.error);
  }

  if (savedSeedsResult.error) {
    console.warn(
      "Saved Seeds are temporarily unavailable:",
      savedSeedsResult.error.message
    );
  }

  const baseSeeds = ((mySeedsResult.data ?? []) as SeedRecord[]).map(
    (seed) => ({
      ...seed,
      links: parseSeedLinks(seed.links),
    })
  );

  const baseSavedSeeds = (
    savedSeedsResult.data ?? []
  ) as PublicSeedRecord[];

  const reminderResult =
    baseSeeds.length > 0
      ? await supabase
          .from("user_resource_reminder_settings")
          .select("resource_id, seed_target_time, timezone")
          .eq("resource_type", "seed")
          .in("resource_id", baseSeeds.map((seed) => seed.seed_id))
      : { data: [], error: null };

  if (reminderResult.error) {
    console.warn(
      "Seed reminder times are temporarily unavailable:",
      reminderResult.error.message
    );
  }

  const reminderBySeedId = new Map(
    (reminderResult.data ?? []).map((row) => [
      String(row.resource_id),
      {
        targetTime:
          typeof row.seed_target_time === "string"
            ? row.seed_target_time.slice(0, 5)
            : "09:00",
        timezone:
          typeof row.timezone === "string" && row.timezone
            ? row.timezone
            : "Europe/Istanbul",
      },
    ])
  );

  const reactionSeedIds = [
    ...new Set([
      ...baseSeeds.map((seed) => seed.seed_id),
      ...baseSavedSeeds.map((seed) => seed.seed_id),
    ]),
  ];

  const reactionResult =
    reactionSeedIds.length > 0
      ? await supabase.rpc("get_visible_seed_reaction_context", {
          p_seed_ids: reactionSeedIds,
        })
      : { data: [], error: null };

  if (reactionResult.error) {
    console.warn(
      "Seed reaction counts are temporarily unavailable:",
      reactionResult.error.message
    );
  }

  const reactionBySeedId = new Map(
    parseSeedReactionContexts(reactionResult.data).map((context) => [
      context.seed_id,
      context,
    ])
  );

  const seeds = baseSeeds.map((seed) => {
    const reminder = reminderBySeedId.get(seed.seed_id);
    return {
      ...seed,
      reaction_context: reactionBySeedId.get(seed.seed_id) ?? null,
      reminder_target_time: reminder?.targetTime ?? "09:00",
      reminder_timezone: reminder?.timezone ?? "Europe/Istanbul",
    };
  });

  const savedSeeds = baseSavedSeeds.map((seed) => ({
    ...seed,
    reaction_context: reactionBySeedId.get(seed.seed_id) ?? null,
  }));

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_420px]">
            <div className="p-6 md:p-9">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-green-800">
                  Your Seed layer
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                  Before an Intent
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-black text-gray-950 md:text-5xl">
                My Seeds
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-8 text-gray-600">
                Keep private thoughts separate from moderated Library Seeds, then let one or several Seeds grow into social Intents when they are ready.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/seeds/new?mode=private"
                  className="inline-flex h-9 items-center rounded-lg bg-green-600 px-3 text-xs font-black text-white transition hover:bg-green-700"
                >
                  🔒 Create Private Seed
                </Link>

                <Link
                  href="/seeds/explore"
                  className="inline-flex h-9 items-center rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-black text-green-800 transition hover:border-green-400 hover:bg-green-100"
                >
                  🌱 Seed Library
                </Link>

                <Link
                  href="/timeline"
                  aria-label="UIN Timeline"
                  className="inline-flex h-11 items-center rounded-xl border border-gray-200 bg-white px-3 transition hover:border-green-400"
                >
                  <img src="/uin-logo.png" alt="uin? logo" className="h-8 w-auto" />
                </Link>
              </div>
            </div>

            <div className="relative min-h-64 overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-600 p-8 text-white">
              <div
                className="absolute -right-10 -top-14 text-[180px] opacity-15"
                aria-hidden="true"
              >
                🌱
              </div>
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-200">
                  UIN lifecycle
                </p>
                <div className="mt-6 space-y-3 text-lg font-black">
                  <p>Seed</p>
                  <p className="pl-5 text-white/45">↓</p>
                  <p>Intent</p>
                  <p className="pl-5 text-white/45">↓</p>
                  <p>Plan</p>
                  <p className="pl-5 text-white/45">↓</p>
                  <p>Activity</p>
                  <p className="pl-5 text-white/45">↓</p>
                  <p>Memory</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {mySeedsResult.error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Seeds could not be loaded. Run migration 033 and refresh this page.
          </section>
        )}

        {!mySeedsResult.error && (
          <SeedDashboard seeds={seeds} isAuthenticated={Boolean(user)} />
        )}

        <SavedSeedsPanel
          seeds={savedSeeds}
          isAuthenticated={Boolean(user)}
        />
      </div>
    </main>
  );
}
