"use client";

import Link from "next/link";
import { useRef } from "react";

import type { ProfileIntentReactionItem } from "@/components/profile/ProfileIntentReactions";
import { resolveActivityCover } from "@/utils/activityCover";

function formatReactionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function InterestCard({ item }: { item: ProfileIntentReactionItem }) {
  const ownerName = item.ownerFullName || item.ownerUsername || "UIN üyesi";
  const coverUrl = resolveActivityCover({
    planCoverUrl: item.contextCoverUrl,
    activityCoverUrl: item.activityCoverUrl,
    categoryCoverUrl: item.categoryCoverUrl,
    categoryName: item.categoryName,
    activityName: item.activityName,
  });
  const location = [item.district, item.city].filter(Boolean).join(", ");

  return (
    <article className="w-[230px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[250px]">
      <div className="relative h-28 overflow-hidden bg-gray-950">
        <img
          src={coverUrl}
          alt={`${item.activityName} cover`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/25" />
        <span className="absolute right-2.5 top-2.5 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
          {item.reactionType === "save" ? "♥ Kaydedildi" : "🐾 Pati bırakıldı"}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-green-300">
            {item.categoryName}
          </p>
          <h3 className="mt-1 line-clamp-1 text-base font-black leading-tight">
            {item.activityName}
          </h3>
        </div>
      </div>

      <div className="p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {item.ownerAvatarUrl ? (
            <img
              src={item.ownerAvatarUrl}
              alt={ownerName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-green-50 text-[11px] font-black text-green-700">
              {ownerName.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-gray-950">{ownerName}</p>
            <p className="truncate text-[10px] text-gray-500">
              {location || "Konum belirtilmedi"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
          <span className="truncate text-[10px] font-semibold text-gray-400">
            {formatReactionDate(item.reactedAt)}
          </span>
          <Link
            href={`/activities/${encodeURIComponent(item.resourceId)}`}
            className="rounded-lg bg-gray-950 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-gray-800"
          >
            Görüntüle
          </Link>
        </div>
      </div>
    </article>
  );
}

function InterestRail({
  title,
  subtitle,
  items,
  privateRail = false,
}: {
  title: string;
  subtitle: string;
  items: ProfileIntentReactionItem[];
  privateRail?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    railRef.current?.scrollBy({
      left: direction * Math.max(260, railRef.current.clientWidth * 0.8),
      behavior: "smooth",
    });
  }

  return (
    <div className="min-w-0 rounded-3xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-gray-950">{title}</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 shadow-sm">
              {items.length}
            </span>
            {privateRail && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 shadow-sm">
                🔒 Yalnızca sen
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        </div>

        {items.length > 1 && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label={`${title} sola kaydır`}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-700 shadow-sm transition hover:border-green-300 hover:text-green-700"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label={`${title} sağa kaydır`}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-700 shadow-sm transition hover:border-green-300 hover:text-green-700"
            >
              →
            </button>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div
          ref={railRef}
          className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
        >
          {items.map((item) => (
            <InterestCard key={item.reactionId} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center text-xs text-gray-500">
          Henüz burada bir Niyet yok.
        </div>
      )}
    </div>
  );
}

export default function TimelineInterestsPanel({
  pawedItems,
  savedItems,
}: {
  pawedItems: ProfileIntentReactionItem[];
  savedItems: ProfileIntentReactionItem[];
}) {
  if (pawedItems.length === 0 && savedItems.length === 0) return null;

  return (
    <section className="mt-10 rounded-[28px] border border-amber-100 bg-white p-5 shadow-sm md:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
          İLGİMİ ÇEKENLER
        </p>
        <h2 className="mt-2 text-2xl font-black text-gray-950">
          Sonra dönmek istediklerim
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Pati bıraktığın ve kaydettiğin Niyetler tek yerde. Kartlar küçük kalır; devamını yatay kaydırarak görürsün.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InterestRail
          title="Pati bıraktıklarım"
          subtitle="Başkalarına önerdiğin veya ilgini açıkça belli ettiğin Niyetler."
          items={pawedItems}
        />
        <InterestRail
          title="Kaydettiklerim"
          subtitle="Daha sonra dönmek için kendine ayırdığın özel Niyet listesi."
          items={savedItems}
          privateRail
        />
      </div>
    </section>
  );
}
