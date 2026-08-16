"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CommunityContextList from "@/components/communities/CommunityContextList";
import ProfilePagination from "@/components/profile/ProfilePagination";
import { resolveActivityCover } from "@/utils/activityCover";
import type { IntentCommunityContext } from "@/utils/communities";
import { getSportPresentation } from "@/utils/sportPresentation";

export type ProfileIntentReactionItem = {
  reactionId: string;
  reactionType: "save" | "paw";
  reactionVisibility: "only_me" | "friends" | "everyone";
  reactedAt: string;
  intentId: string;
  resourceId: string;
  planId: string | null;
  ownerUserId: string;
  ownerFullName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  activityName: string;
  displayTitle?: string | null;
  activityCoverUrl: string | null;
  categoryName: string;
  categoryCoverUrl: string | null;
  city: string | null;
  district: string | null;
  startDate: string;
  endDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  lifecycleStatus: string;
  sportName: string | null;
  contextCoverUrl: string | null;
  communities: IntentCommunityContext[];
};

type ProfileIntentReactionsProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: ProfileIntentReactionItem[];
  emptyTitle: string;
  emptyDescription: string;
  privateSection?: boolean;
};

const PAGE_SIZE = 8;

function lifecycleLabel(value: string) {
  if (value === "forming") return "Forming";
  if (value === "planned") return "Planned";
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";
  if (value === "expired") return "Expired";
  if (value === "closed") return "Closed";
  if (value === "future") return "Future";
  return "Open";
}

function formatReactionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ProfileIntentReactions({
  eyebrow,
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  privateSection = false,
}: ProfileIntentReactionsProps) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleItems = useMemo(
    () =>
      items.slice(
        safePage * PAGE_SIZE,
        safePage * PAGE_SIZE + PAGE_SIZE
      ),
    [items, safePage]
  );

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  return (
    <section className="mt-10 scroll-mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>

        {privateSection && (
          <span className="self-start rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">
            🔒 Only you
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visibleItems.map((item) => {
              const ownerName =
                item.ownerFullName || item.ownerUsername || "UIN member";
              const coverUrl = resolveActivityCover({
                planCoverUrl: item.contextCoverUrl,
                activityCoverUrl: item.activityCoverUrl,
                categoryCoverUrl: item.categoryCoverUrl,
                categoryName: item.categoryName,
                activityName: item.activityName,
              });
              const sport = item.sportName
                ? getSportPresentation(item.sportName)
                : null;
              const location = [item.district, item.city]
                .filter(Boolean)
                .join(", ");

              return (
                <article
                  key={item.reactionId}
                  className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-40 overflow-hidden bg-gray-950">
                    <img
                      src={coverUrl}
                      alt={`${item.displayTitle || item.activityName} cover`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/35" />

                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-800 shadow-sm">
                        {lifecycleLabel(item.lifecycleStatus)}
                      </span>
                      <span className="rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                        {item.reactionType === "save" ? "♥ Saved" : "🐾 Pawed"}
                      </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green-300">
                          {item.categoryName}
                        </p>
                        {item.sportName && sport && (
                          <span
                            className="rounded-full border px-2 py-0.5 text-[9px] font-bold"
                            style={{
                              backgroundColor: sport.backgroundColor,
                              borderColor: sport.borderColor,
                              color: sport.textColor,
                            }}
                          >
                            {sport.icon} {item.sportName}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-xl font-black leading-tight">
                        {item.displayTitle || item.activityName}
                      </h3>
                      <CommunityContextList
                        communities={item.communities}
                        variant="card"
                      />
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {item.ownerAvatarUrl ? (
                        <img
                          src={item.ownerAvatarUrl}
                          alt={ownerName}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-green-50 text-xs font-black text-green-700">
                          {ownerName.trim().charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-gray-950">
                          {ownerName}
                        </p>
                        <p className="truncate text-[11px] text-gray-500">
                          {location || "Location not set"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                      <span className="text-[11px] font-semibold text-gray-400">
                        {item.reactionType === "save" ? "Saved" : "Pawed"}{" "}
                        {formatReactionDate(item.reactedAt)}
                      </span>
                      <Link
                        href={`/activities/${encodeURIComponent(item.resourceId)}`}
                        className="rounded-xl bg-gray-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <ProfilePagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            label={`${eyebrow} pages`}
          />
        </>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-gray-950">{emptyTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {emptyDescription}
          </p>
        </div>
      )}
    </section>
  );
}
