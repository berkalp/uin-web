"use client";

import Link from "next/link";

import LifecycleCurrentDate from "../activities/LifecycleCurrentDate";
import { resolveActivityCover } from "../../utils/activityCover";

type TimelineExpiredPresentationProps = {
  itemType: "intent" | "plan";
  title: string;
  activityName: string | null;
  categoryName: string | null;
  coverUrl: string | null;
  city: string | null;
  district: string | null;
  windowStart: string;
  windowEnd: string;
  expiredAt: string;
  roleLabel: string;
  participantCount: number;
  maxParticipants: number | null;
  personalBudget: number | null;
  committedBudget: number | null;
  targetBudget: number | null;
  visibility: string | null;
  notes: string | null;
  recruitmentStatus: string | null;
  matchingStatus: string | null;
  copiedFromIntentId: string | null;
  planId: string | null;
  sourceIntentId: string | null;
  canCreateAgain: boolean;
};

function formatBudget(value: number | null) {
  if (value === null) {
    return "Not set";
  }

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} TL`;
}

function getVisibilityLabel(value: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "Not specified";
  }

  if (normalized === "public" || normalized === "anyone") {
    return "Anyone";
  }

  if (normalized === "friends") {
    return "Friends only";
  }

  if (normalized === "except_friends") {
    return "Anyone except friends";
  }

  if (normalized === "invite_only") {
    return "Invite only";
  }

  if (normalized === "private" || normalized === "only_me") {
    return "Only me";
  }

  return normalized.replace(/_/g, " ");
}

export default function TimelineExpiredPresentation({
  itemType,
  title,
  activityName,
  categoryName,
  coverUrl,
  city,
  district,
  windowStart,
  windowEnd,
  expiredAt,
  roleLabel,
  participantCount,
  maxParticipants,
  personalBudget,
  committedBudget,
  targetBudget,
  visibility,
  notes,
  recruitmentStatus,
  matchingStatus,
  planId,
  sourceIntentId,
  canCreateAgain,
}: TimelineExpiredPresentationProps) {
  const locationLabel = [district, city].filter(Boolean).join(", ");
  const mapEmbedUrl = locationLabel
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        locationLabel
      )}&z=10&output=embed`
    : null;

  const resolvedCoverUrl = resolveActivityCover({
    planCoverUrl: coverUrl,
    categoryName,
    activityName: activityName || title,
  });

  const viewHref = planId
    ? `/plans/${encodeURIComponent(planId)}/planning`
    : sourceIntentId
      ? `/activities/${encodeURIComponent(sourceIntentId)}`
      : null;

  return (
    <article className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-36 overflow-hidden bg-gray-950">
        <img
          src={resolvedCoverUrl}
          alt={`${title} cover`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/35" />

        <div className="absolute inset-x-3 top-3 flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-800 shadow-sm">
              Expired
            </span>

            <span className="max-w-full truncate rounded-full bg-gray-950/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur">
              {roleLabel}
            </span>
          </div>

          <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-700 shadow-sm">
            Closed
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-green-300">
            {categoryName ?? "Activity"}
          </p>

          <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-tight text-white">
            {title}
          </h2>

          <p className="mt-1 text-[10px] font-medium text-white/75">
            {itemType === "plan" ? "Shared Plan" : "Personal Intent"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-black/5">
        <div className="min-w-0 p-4">
          <LifecycleCurrentDate
            targetStart={windowStart}
            targetEnd={windowEnd}
            expiredAt={expiredAt}
            status="expired"
            timezone="Europe/Istanbul"
            compact
            className="w-full"
          />
        </div>

        <div className="relative min-h-[184px] overflow-hidden border-l border-black/5 bg-gray-100">
          {mapEmbedUrl ? (
            <iframe
              title={`${title} approximate area`}
              src={mapEmbedUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-[10px] text-gray-400">
              No map
            </div>
          )}

          {district && (
            <span className="absolute bottom-2 left-2 max-w-[96px] truncate rounded-full bg-gray-950/80 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">
              {district}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 text-xs">
        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Participants
          </p>
          <p className="mt-1 truncate font-bold text-gray-950">
            {participantCount} / {maxParticipants ?? "Unlimited"}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Visibility
          </p>
          <p className="mt-1 truncate font-bold capitalize text-gray-950">
            {getVisibilityLabel(visibility)}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Committed
          </p>
          <p className="mt-1 truncate font-bold text-gray-950">
            {formatBudget(committedBudget)}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Target
          </p>
          <p className="mt-1 truncate font-bold text-gray-950">
            {formatBudget(targetBudget ?? personalBudget)}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
          <span className="capitalize">
            Recruitment: {recruitmentStatus ?? "closed"}
          </span>
          <span className="capitalize">
            Matching: {matchingStatus ?? "closed"}
          </span>
        </div>

        {notes && (
          <p className="mt-3 line-clamp-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">
            {notes}
          </p>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-100 bg-white p-3">
        {viewHref ? (
          <Link
            href={viewHref}
            className="flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-2 text-center text-xs font-semibold text-gray-700 transition hover:border-orange-300 hover:text-orange-700"
          >
            {planId ? "View Planning Archive" : "View"}
          </Link>
        ) : (
          <span className="flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-2 text-center text-xs font-semibold text-gray-400">
            View unavailable
          </span>
        )}

        {canCreateAgain && sourceIntentId ? (
          <Link
            href={`/onboarding?copyFrom=${encodeURIComponent(sourceIntentId)}`}
            className="flex min-h-10 items-center justify-center rounded-xl bg-green-600 px-2 text-center text-xs font-semibold text-white transition hover:bg-green-700"
          >
            Create Again
          </Link>
        ) : (
          <span className="flex min-h-10 items-center justify-center rounded-xl bg-gray-100 px-2 text-center text-xs font-semibold text-gray-400">
            Create Again
          </span>
        )}
      </div>
    </article>
  );
}
