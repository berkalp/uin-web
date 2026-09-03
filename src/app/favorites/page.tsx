import { redirect } from "next/navigation";

import FavoritesManager, { type FavoriteItem } from "@/components/preferences/FavoritesManager";
import { createClient } from "@/utils/supabase/server";

type RawFavorite = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeFavorite(raw: unknown): FavoriteItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as RawFavorite;
  const id = text(row.id) || text(row.catalog_item_id);
  const title = text(row.title);
  if (!id || !title) return null;

  return {
    catalogItemId: id,
    sourceType: text(row.source_type) === "subject" ? "subject" : "catalog",
    title,
    creatorName: text(row.creator_name) || null,
    coverUrl: text(row.cover_url) || null,
    itemKind: text(row.item_kind) || null,
    isPublic: row.is_public !== false,
    isFeatured: row.is_featured === true,
  };
}

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  let preferencesResult = await supabase.rpc("get_my_preferences_v2922");
  if (preferencesResult.error) {
    preferencesResult = await supabase.rpc("get_my_preferences_v2921");
  }

  const payload = (preferencesResult.data ?? {}) as { favorites?: unknown[] };
  const favorites = (Array.isArray(payload.favorites) ? payload.favorites : [])
    .map(normalizeFavorite)
    .filter((item): item is FavoriteItem => Boolean(item));

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">SEVDİKLERİN</p>
          <h1 className="mt-2 text-4xl font-black text-gray-950">Sevdiklerim</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            Sevdiğin kişi, eser, yer, kulüp, spor, hobi ve aktiviteler. Bunlar deneyimlerin veya yapmak istediklerin değil; kalıcı olarak sevdiğin şeyler.
          </p>
        </header>

        {preferencesResult.error ? (
          <section className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
            Sevdiklerin şu anda yüklenemedi: {preferencesResult.error.message}
          </section>
        ) : (
          <FavoritesManager initialItems={favorites} />
        )}
      </div>
    </main>
  );
}

