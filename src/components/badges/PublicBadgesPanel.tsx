"use client";

import { useEffect, useState } from "react";

import BadgeIcon from "@/components/badges/BadgeIcon";
import ProfilePagination from "@/components/profile/ProfilePagination";
import { setMyProfileDisplayOrder } from "@/services/profileDisplayOrderService";
import {
  getBadgeScopeLabel,
  getBadgeToneClasses,
  type PublicBadge,
} from "@/utils/badges";

const PAGE_SIZE = 12;

export default function PublicBadgesPanel({
  badges,
  isOwner = false,
}: {
  badges: PublicBadge[];
  isOwner?: boolean;
}) {
  const [orderedBadges, setOrderedBadges] = useState(badges);
  const [page, setPage] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrderedBadges(badges);
  }, [badges]);

  const pageCount = Math.max(1, Math.ceil(orderedBadges.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleBadges = orderedBadges.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  async function moveBadge(badgeId: string, direction: -1 | 1) {
    const index = orderedBadges.findIndex((badge) => badge.id === badgeId);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= orderedBadges.length) {
      return;
    }

    const previous = orderedBadges;
    const next = [...orderedBadges];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrderedBadges(next);
    setOrderMessage("Saving order…");

    try {
      await setMyProfileDisplayOrder(
        "badge",
        next.map((badge) => badge.id)
      );
      setOrderMessage("Order saved");
    } catch (error) {
      setOrderedBadges(previous);
      setOrderMessage(
        error instanceof Error ? error.message : "Order could not be saved."
      );
    }
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Badges
          </p>

          <h2 className="mt-1.5 text-xl font-bold text-gray-950">
            Recognitions
          </h2>

          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-500">
            Verified patterns and UIN recognitions. Badges describe a specific contribution or context, not a person&apos;s worth.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            {orderedBadges.length} {orderedBadges.length === 1 ? "badge" : "badges"}
          </span>

          {isOwner && orderedBadges.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setReordering((value) => !value);
                setOrderMessage(null);
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                reordering
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {reordering ? "Done ordering" : "Reorder"}
            </button>
          )}
        </div>
      </div>

      {reordering && (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-gray-600">
          Use the arrows on each badge to set the order shown on the profile.
          {orderMessage && (
            <span className="ml-2 font-bold text-amber-800">{orderMessage}</span>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {visibleBadges.map((badge) => {
          const tone = getBadgeToneClasses(badge.tone);
          const contextLabel = getBadgeScopeLabel({
            scopeType: badge.scope_type,
            categoryName: badge.category_name,
            activityName: badge.activity_name,
          });
          const globalIndex = orderedBadges.findIndex(
            (item) => item.id === badge.id
          );

          return (
            <article
              key={badge.id}
              title={badge.description}
              className={`relative min-w-0 rounded-2xl border p-3 ${tone.wrapper}`}
            >
              {reordering && (
                <div className="absolute right-2 top-2 flex gap-1 rounded-lg bg-white/90 p-0.5 shadow-sm">
                  <button
                    type="button"
                    aria-label={`Move ${badge.name} earlier`}
                    disabled={globalIndex <= 0}
                    onClick={() => void moveBadge(badge.id, -1)}
                    className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-black hover:bg-gray-100 disabled:opacity-25"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${badge.name} later`}
                    disabled={globalIndex >= orderedBadges.length - 1}
                    onClick={() => void moveBadge(badge.id, 1)}
                    className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-black hover:bg-gray-100 disabled:opacity-25"
                  >
                    →
                  </button>
                </div>
              )}

              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${tone.icon}`}
              >
                <BadgeIcon
                  iconKey={badge.icon_key}
                  iconUrl={badge.icon_url}
                  className="h-5 w-5"
                  imageClassName="h-6 w-6 object-contain"
                />
              </div>

              <h3 className="mt-3 truncate text-sm font-bold text-current">
                {badge.name}
              </h3>

              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide opacity-65">
                {contextLabel}
              </p>

              <p className="mt-2 line-clamp-2 text-[11px] leading-5 opacity-75">
                {badge.description}
              </p>

              <p className="mt-2 truncate text-[10px] font-semibold opacity-70">
                {badge.award_source === "automatic"
                  ? "Earned from verified history"
                  : "Awarded by UIN"}
              </p>
            </article>
          );
        })}
      </div>

      <ProfilePagination
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
        label="Badge pages"
      />
    </section>
  );
}
