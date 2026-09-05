"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

const FAVORITES_PAGE_SIZE = 12;

const labels: Record<
  string,
  {
    label: string;
    icon: string;
  }
> = {
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

export default function FavoritesManager({
  initialItems,
}: {
  initialItems: FavoriteItem[];
}) {
  const [items, setItems] =
    useState(initialItems);

  const [query, setQuery] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  const [page, setPage] =
    useState(1);

  const [working, setWorking] =
    useState("");

  const [error, setError] =
    useState("");

  const counts = useMemo(() => {
    const result =
      new Map<string, number>();

    for (const item of items) {
      const kind = kindOf(item);

      result.set(
        kind,
        (result.get(kind) ?? 0) + 1
      );
    }

    return [...result.entries()].sort(
      (a, b) => {
        const left =
          labels[a[0]]?.label ?? a[0];

        const right =
          labels[b[0]]?.label ?? b[0];

        return left.localeCompare(
          right,
          "tr"
        );
      }
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery =
      query
        .trim()
        .toLocaleLowerCase("tr-TR");

    return items.filter((item) => {
      if (
        filter !== "all" &&
        kindOf(item) !== filter
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${item.title} ${item.creatorName ?? ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery);
    });
  }, [filter, items, query]);

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredItems.length /
        FAVORITES_PAGE_SIZE
    )
  );

  const safePage = Math.min(
    page,
    pageCount
  );

  const visibleItems =
    filteredItems.slice(
      (safePage - 1) *
        FAVORITES_PAGE_SIZE,
      safePage *
        FAVORITES_PAGE_SIZE
    );

  useEffect(() => {
    setPage(1);
  }, [filter, query]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const publicCount =
    items.filter(
      (item) => item.isPublic
    ).length;

  const featuredCount =
    items.filter(
      (item) => item.isFeatured
    ).length;

  async function setVisibility(
    item: FavoriteItem,
    isPublic: boolean,
    isFeatured: boolean
  ) {
    const key =
      `visibility:${item.sourceType}:${item.catalogItemId}`;

    setWorking(key);
    setError("");

    try {
      const result =
        await supabase.rpc(
          "set_my_preference_visibility_v2921",
          {
            p_kind: "favorite",
            p_id: item.catalogItemId,
            p_public: isPublic,
            p_featured: isFeatured,
          }
        );

      if (
        result.error &&
        item.sourceType === "subject"
      ) {
        const fallback =
          await supabase.rpc(
            "set_my_loved_subject_visibility_v2922",
            {
              p_subject_id:
                item.catalogItemId,
              p_public:
                isPublic,
              p_featured:
                isFeatured,
            }
          );

        if (fallback.error) {
          throw fallback.error;
        }
      } else if (result.error) {
        throw result.error;
      }

      setItems((current) =>
        current.map((candidate) =>
          candidate.catalogItemId ===
            item.catalogItemId &&
          candidate.sourceType ===
            item.sourceType
            ? {
                ...candidate,
                isPublic,
                isFeatured:
                  isPublic
                    ? isFeatured
                    : false,
              }
            : candidate
        )
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Görünürlük değiştirilemedi."
      );
    } finally {
      setWorking("");
    }
  }

  async function toggleFeatured(
    item: FavoriteItem
  ) {
    if (
      !item.isFeatured &&
      featuredCount >= 9
    ) {
      setError(
        "Profilinde en fazla 9 sevdiğini öne çıkarabilirsin. Önce birini vitrinden kaldır."
      );

      return;
    }

    await setVisibility(
      item,
      true,
      !item.isFeatured
    );
  }

  async function removeItem(
    item: FavoriteItem
  ) {
    const key =
      `remove:${item.sourceType}:${item.catalogItemId}`;

    setWorking(key);
    setError("");

    try {
      if (
        item.sourceType === "subject"
      ) {
        const result =
          await supabase.rpc(
            "remove_my_loved_subject_v2922",
            {
              p_subject_id:
                item.catalogItemId,
            }
          );

        if (result.error) {
          throw result.error;
        }
      } else {
        const result =
          await supabase.rpc(
            "toggle_my_favorite_v2921",
            {
              p_catalog_item_id:
                item.catalogItemId,
              p_favorite: false,
            }
          );

        if (result.error) {
          throw result.error;
        }
      }

      setItems((current) =>
        current.filter(
          (candidate) =>
            candidate.catalogItemId !==
              item.catalogItemId ||
            candidate.sourceType !==
              item.sourceType
        )
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sevdiklerinden kaldırılamadı."
      );
    } finally {
      setWorking("");
    }
  }

  return (
    <>
      <Link
        href="/favorite/new"
        className="mt-6 flex items-center justify-between gap-4 rounded-[24px] bg-rose-600 px-5 py-4 text-white shadow-sm transition hover:bg-rose-700"
      >
        <div>
          <p className="text-base font-black">
            ＋ Sevdiğin bir şey ekle
          </p>

          <p className="mt-1 text-xs font-semibold text-rose-100">
            Kişi, eser, yer, kulüp, spor, hobi veya aktivite
          </p>
        </div>

        <span
          className="text-xl"
          aria-hidden
        >
          ›
        </span>
      </Link>

      <section className="mt-5 grid grid-cols-3 gap-3 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <Stat
          value={items.length}
          label="Sevdiğim"
        />

        <Stat
          value={counts.length}
          label="Kategori"
        />

        <Stat
          value={publicCount}
          label="Herkese açık"
        />
      </section>

      <section className="mt-5 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <input
          value={query}
          onChange={(event) =>
            setQuery(
              event.target.value
            )
          }
          placeholder="Sevdiğin kişi, eser veya konuyu ara"
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-gray-400 focus:bg-white"
        />

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <FilterButton
            active={filter === "all"}
            onClick={() =>
              setFilter("all")
            }
          >
            Tümü {items.length}
          </FilterButton>

          {counts.map(
            ([kind, count]) => (
              <FilterButton
                key={kind}
                active={
                  filter === kind
                }
                onClick={() =>
                  setFilter(kind)
                }
              >
                {labels[kind]?.icon ??
                  "•"}{" "}
                {labels[kind]?.label ??
                  kind}{" "}
                {count}
              </FilterButton>
            )
          )}
        </div>
      </section>

      {featuredCount > 0 && (
        <div className="mt-5 flex justify-end">
          <p className="text-xs font-black text-gray-500">
            Profil vitrini · {featuredCount}/9
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {visibleItems.length > 0 ? (
        <>
          <section className="mt-5 grid items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {visibleItems.map(
              (item) => {
                const key =
                  `${item.sourceType}:${item.catalogItemId}`;

                const busy =
                  working.includes(key);

                const kind =
                  kindOf(item);

                const href =
                  `/loved/${item.sourceType}/${encodeURIComponent(
                    item.catalogItemId
                  )}`;

                return (
                  <article
                    key={key}
                    className="group flex min-h-[350px] min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Link
                      href={href}
                      className="relative block aspect-[4/5] overflow-hidden bg-gray-950"
                    >
                      {item.coverUrl ? (
                        <img
                          src={
                            item.coverUrl
                          }
                          alt=""
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-rose-50 text-5xl">
                          ♡
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-12">
                        <p className="truncate text-sm font-black text-white">
                          {item.title}
                        </p>

                        {item.creatorName && (
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-white/75">
                            {item.creatorName}
                          </p>
                        )}
                      </div>

                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black uppercase text-white backdrop-blur">
                        {labels[kind]?.icon ??
                          "•"}{" "}
                        {labels[kind]?.label ??
                          "Diğer"}
                      </span>

                      <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[9px] font-black text-rose-600 shadow-sm">
                        ♥ SEVİLEN
                      </span>
                    </Link>

                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex flex-wrap gap-2 text-[10px] font-black">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void setVisibility(
                              item,
                              !item.isPublic,
                              false
                            )
                          }
                          className="rounded-full border border-gray-200 px-2.5 py-1.5 text-gray-600 transition hover:border-gray-400 hover:text-gray-950 disabled:opacity-40"
                        >
                          {item.isPublic
                            ? "Herkese açık"
                            : "Gizli"}
                        </button>

                        {item.isPublic && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void toggleFeatured(
                                item
                              )
                            }
                            className={
                              item.isFeatured
                                ? "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-700 disabled:opacity-40"
                                : "rounded-full border border-gray-200 px-2.5 py-1.5 text-gray-600 transition hover:border-gray-400 hover:text-gray-950 disabled:opacity-40"
                            }
                          >
                            {item.isFeatured
                              ? "★ Öne çıkarıldı"
                              : "☆ Öne çıkar"}
                          </button>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void removeItem(
                              item
                            )
                          }
                          className="rounded-xl px-2 py-2 text-[10px] font-black text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          Kaldır
                        </button>

                        <Link
                          href={href}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black text-gray-700 transition hover:bg-gray-50"
                        >
                          Detaylar →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </section>

          {pageCount > 1 && (
            <nav
              className="mt-7 flex flex-wrap items-center justify-center gap-2"
              aria-label="Sevdiklerim sayfaları"
            >
              <button
                type="button"
                aria-label="Önceki sayfa"
                disabled={safePage === 1}
                onClick={() =>
                  setPage((value) =>
                    Math.max(
                      1,
                      value - 1
                    )
                  )
                }
                className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ←
              </button>

              {Array.from(
                {
                  length:
                    pageCount,
                },
                (_, index) =>
                  index + 1
              ).map(
                (pageNumber) => (
                  <button
                    key={
                      pageNumber
                    }
                    type="button"
                    onClick={() =>
                      setPage(
                        pageNumber
                      )
                    }
                    aria-current={
                      safePage ===
                      pageNumber
                        ? "page"
                        : undefined
                    }
                    className={
                      safePage ===
                      pageNumber
                        ? "flex h-10 min-w-10 items-center justify-center rounded-xl bg-gray-950 px-3 text-sm font-black text-white"
                        : "flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:bg-gray-50"
                    }
                  >
                    {pageNumber}
                  </button>
                )
              )}

              <button
                type="button"
                aria-label="Sonraki sayfa"
                disabled={
                  safePage ===
                  pageCount
                }
                onClick={() =>
                  setPage((value) =>
                    Math.min(
                      pageCount,
                      value + 1
                    )
                  )
                }
                className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                →
              </button>
            </nav>
          )}
        </>
      ) : (
        <section className="mt-5 rounded-[28px] border border-dashed border-gray-300 bg-white p-10 text-center">
          <h3 className="text-xl font-black text-gray-950">
            Bu filtrede bir kayıt yok
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            Aramayı veya kategori filtresini değiştir.
          </p>
        </section>
      )}
    </>
  );
}

function Stat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black text-gray-950">
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-gray-500">
        {label}
      </p>
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