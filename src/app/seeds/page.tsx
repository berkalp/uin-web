import Link from "next/link";
import { redirect } from "next/navigation";

import PublicFavoritesPanel, { type PublicFavoriteItem } from "@/components/profile/PublicFavoritesPanel";
import SeedDashboard from "@/components/seeds/SeedDashboard";
import {
  parseSeedLinks,
  parseSeedReactionContexts,
  type SeedRecord,
} from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

export default async function SeedsPage({ searchParams }: { searchParams: Promise<{ alan?: string | string[] }> }) {
  const requestedArea = (await searchParams).alan;
  const areaValue = Array.isArray(requestedArea) ? requestedArea[0] : requestedArea;
  const activeArea = areaValue === "deneyimler" || areaValue === "sevdiklerim" ? areaValue : "niyetler";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [mySeedsResult, profileResult] = await Promise.all([
    supabase.rpc("get_my_seeds_v2", {
      p_status: null,
    }),
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
  ]);

  if (mySeedsResult.error) {
    console.error("My Seeds query failed:", mySeedsResult.error);
  }

  const baseSeeds = ((mySeedsResult.data ?? []) as SeedRecord[]).map(
    (seed) => ({
      ...seed,
      links: parseSeedLinks(seed.links),
    })
  );

  const username = typeof profileResult.data?.username === "string" ? profileResult.data.username : null;
  const favoritesResult = username
    ? await supabase.rpc("get_public_preferences_v2921", { p_username: username })
    : { data: null, error: null };
  const preferences = (favoritesResult.data ?? {}) as { favorites?: PublicFavoriteItem[] };
  const favorites = Array.isArray(preferences.favorites) ? preferences.favorites : [];

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

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-9">
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${activeArea === "deneyimler" ? "text-purple-700" : "text-rose-600"}`}>
            {activeArea === "deneyimler" ? "DENEYİMLER" : activeArea === "sevdiklerim" ? "SEVDİKLERİN" : "KİŞİSEL NİYETLER"}
          </p>
          <h1 className="mt-2 text-4xl font-black text-gray-950">
            {activeArea === "deneyimler" ? "Deneyimlerim" : activeArea === "sevdiklerim" ? "Sevdiklerim" : "Kişisel Niyetlerim"}
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            {activeArea === "deneyimler" ? "Tamamladığın kişisel ve sosyal deneyimler." : activeArea === "sevdiklerim" ? "Sevdiğin kişi, eser, yer, konu ve aktiviteler; kategorilerine göre." : "Yapmak, görmek, okumak, izlemek, öğrenmek veya deneyimlemek istediğin kişisel niyetlerin."}
          </p>
        </header>

        {mySeedsResult.error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Seeds could not be loaded. Run migration 033 and refresh this page.
          </section>
        )}

        {activeArea === "deneyimler" && <nav className="mt-6 grid gap-3 rounded-[28px] border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-3">
          <span className="rounded-2xl bg-gray-950 px-5 py-4 text-center font-black text-white">Tümü</span>
          <span className="rounded-2xl bg-gray-50 px-5 py-4 text-center font-black text-gray-700">Kişisel · {seeds.filter((seed) => seed.status === "completed").length}</span>
          <Link href="/timeline?view=completed" className="rounded-2xl bg-gray-50 px-5 py-4 text-center font-black text-gray-700 hover:bg-gray-100">Sosyal deneyimler</Link>
        </nav>}

        {!mySeedsResult.error && activeArea !== "sevdiklerim" && (
          <SeedDashboard seeds={seeds} isAuthenticated={Boolean(user)} mode={activeArea === "deneyimler" ? "experiences" : "intentions"} />
        )}

        {activeArea === "sevdiklerim" && (
          favorites.length > 0
            ? <PublicFavoritesPanel items={favorites} />
            : <section className="mt-6 rounded-[32px] border border-dashed border-gray-300 bg-white p-10 text-center"><h2 className="text-2xl font-black">Henüz Sevdiklerin yok</h2><p className="mt-2 text-sm text-gray-500">Beğendiğin film, kitap, sanatçı ve yerler burada görünecek.</p></section>
        )}
      </div>
    </main>
  );
}
