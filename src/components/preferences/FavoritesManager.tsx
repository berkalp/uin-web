"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/utils/supabase/client";

export type FavoriteItem = {
  catalogItemId: string;
  sourceType: "catalog" | "subject";
  title: string;
  creatorName: string | null;
  coverUrl: string | null;
  itemKind: string | null;
  isPublic: boolean;
  isFeatured: boolean;
};

const labels: Record<string, { label: string; icon: string }> = {
  artist: { label: "Sanatçı", icon: "🎵" },
  book: { label: "Kitap", icon: "📚" },
  movie: { label: "Film", icon: "🎬" },
  series: { label: "Dizi", icon: "📺" },
  game: { label: "Oyun", icon: "🎮" },
  place: { label: "Yer", icon: "📍" },
  director: { label: "Yönetmen", icon: "🎥" },
  actor: { label: "Oyuncu", icon: "🎭" },
  writer: { label: "Yazar", icon: "✍️" },
  comedian: { label: "Komedyen", icon: "🎙️" },
  theatre_artist: { label: "Tiyatrocu", icon: "🎭" },
  athlete: { label: "Sporcu", icon: "🏅" },
  club: { label: "Spor kulübü", icon: "⚽" },
  sport: { label: "Spor", icon: "🏃" },
  hobby: { label: "Hobi", icon: "🧩" },
  activity: { label: "Aktivite", icon: "✨" },
  other: { label: "Diğer", icon: "•" },
};

function kindOf(item: FavoriteItem) {
  return item.itemKind || "other";
}

export default function FavoritesManager({ initialItems }: { initialItems: FavoriteItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of items) {
      const kind = kindOf(item);
      result.set(kind, (result.get(kind) ?? 0) + 1);
    }
    return [...result.entries()].sort((a, b) => {
      const left = labels[a[0]]?.label ?? a[0];
      const right = labels[b[0]]?.label ?? b[0];
      return left.localeCompare(right, "tr");
    });
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return items.filter((item) => {
      if (filter !== "all" && kindOf(item) !== filter) return false;
      if (!normalizedQuery) return true;
      return `${item.title} ${item.creatorName ?? ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery);
    });
  }, [filter, items, query]);

  const publicCount = items.filter((item) => item.isPublic).length;
  const featuredCount = items.filter((item) => item.isFeatured).length;

  async function setVisibility(item: FavoriteItem, isPublic: boolean, isFeatured: boolean) {
    const key = `visibility:${item.sourceType}:${item.catalogItemId}`;
    setWorking(key);
    setError("");
    try {
      const result = await supabase.rpc("set_my_preference_visibility_v2921", {
        p_kind: "favorite",
        p_id: item.catalogItemId,
        p_public: isPublic,
        p_featured: isFeatured,
      });

      if (result.error && item.sourceType === "subject") {
        const fallback = await supabase.rpc("set_my_loved_subject_visibility_v2922", {
          p_subject_id: item.catalogItemId,
          p_public: isPublic,
          p_featured: isFeatured,
        });
        if (fallback.error) throw fallback.error;
      } else if (result.error) {
        throw result.error;
      }

      setItems((current) =>
        current.map((candidate) =>
          candidate.catalogItemId === item.catalogItemId && candidate.sourceType === item.sourceType
            ? { ...candidate, isPublic, isFeatured: isPublic ? isFeatured : false }
            : candidate
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görünürlük değiştirilemedi.");
    } finally {
      setWorking("");
    }
  }

  async function toggleFeatured(item: FavoriteItem) {
    if (!item.isFeatured && featuredCount >= 9) {
      setError("Profilinde en fazla 9 sevdiğini öne çıkarabilirsin. Önce birini vitrinden kaldır.");
      return;
    }
    await setVisibility(item, true, !item.isFeatured);
  }

  async function removeItem(item: FavoriteItem) {
    const key = `remove:${item.sourceType}:${item.catalogItemId}`;
    setWorking(key);
    setError("");
    try {
      if (item.sourceType === "subject") {
        const result = await supabase.rpc("remove_my_loved_subject_v2922", {
          p_subject_id: item.catalogItemId,
        });
        if (result.error) throw result.error;
      } else {
        const result = await supabase.rpc("toggle_my_favorite_v2921", {
          p_catalog_item_id: item.catalogItemId,
          p_favorite: false,
        });
        if (result.error) throw result.error;
      }

      setItems((current) =>
        current.filter(
          (candidate) =>
            candidate.catalogItemId !== item.catalogItemId || candidate.sourceType !== item.sourceType
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sevdiklerinden kaldırılamadı.");
    } finally {
      setWorking("");
    }
  }

  return (
    <>
      <Link
        href="/seeds/explore?mode=favorite"
        className="mt-6 flex items-center justify-between gap-4 rounded-[24px] bg-rose-600 px-5 py-4 text-white shadow-sm transition hover:bg-rose-700"
      >
        <div>
          <p className="text-base font-black">＋ Sevdiğin bir şey ekle</p>
          <p className="mt-1 text-xs font-semibold text-rose-100">
            Kişi, eser, yer, kulüp, spor, hobi veya aktivite
          </p>
        </div>
        <span className="text-xl" aria-hidden>›</span>
      </Link>

      <section className="mt-5 grid grid-cols-3 gap-3 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <Stat value={items.length} label="Sevdiğim" />
        <Stat value={counts.length} label="Kategori" />
        <Stat value={publicCount} label="Herkese açık" />
      </section>

      <section className="mt-5 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sevdiğin kişi, eser veya konuyu ara"
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-gray-400 focus:bg-white"
        />

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            Tümü {items.length}
          </FilterButton>
          {counts.map(([kind, count]) => (
            <FilterButton key={kind} active={filter === kind} onClick={() => setFilter(kind)}>
              {labels[kind]?.icon ?? "•"} {labels[kind]?.label ?? kind} {count}
            </FilterButton>
          ))}
        </div>
      </section>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-950">Sevdiklerim</h2>
          <p className="mt-1 text-sm text-gray-500">
            Deneyimlemek ve sevmek farklıdır. Burada kalıcı olarak sevdiklerin bulunur.
          </p>
        </div>
        {featuredCount > 0 && (
          <p className="text-xs font-black text-gray-500">Profil vitrini · {featuredCount}/9</p>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {visibleItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleItems.map((item) => {
            const key = `${item.sourceType}:${item.catalogItemId}`;
            const busy = working.includes(key);
            const kind = kindOf(item);
            return (
              <article
                key={key}
                className="flex items-center gap-4 rounded-[22px] border border-gray-200 bg-white p-3 shadow-sm"
              >
                <Link href={`/loved/${item.sourceType}/${encodeURIComponent(item.catalogItemId)}`} className="shrink-0">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" className="h-20 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-20 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl">♡</div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link href={`/loved/${item.sourceType}/${encodeURIComponent(item.catalogItemId)}`}>
                    <p className="truncate text-base font-black text-gray-950 hover:text-rose-700">{item.title}</p>
                  </Link>
                  {item.creatorName && <p className="mt-0.5 truncate text-sm text-gray-500">{item.creatorName}</p>}
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {labels[kind]?.icon ?? "•"} {labels[kind]?.label ?? "Diğer"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-black">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setVisibility(item, !item.isPublic, false)}
                      className="text-gray-600 hover:text-gray-950 disabled:opacity-40"
                    >
                      {item.isPublic ? "Herkese açık" : "Gizli"}
                    </button>
                    {item.isPublic && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleFeatured(item)}
                        className={item.isFeatured ? "text-amber-600 disabled:opacity-40" : "text-gray-600 hover:text-gray-950 disabled:opacity-40"}
                      >
                        {item.isFeatured ? "★ Öne çıkarıldı" : "☆ Profilde öne çıkar"}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeItem(item)}
                  className="rounded-xl px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Kaldır
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="mt-4 rounded-[28px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <h3 className="text-xl font-black text-gray-950">Bu filtrede bir kayıt yok</h3>
          <p className="mt-2 text-sm text-gray-500">Aramayı veya kategori filtresini değiştir.</p>
        </section>
      )}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-gray-500">{label}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
        active
          ? "border-gray-950 bg-gray-950 text-white"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

