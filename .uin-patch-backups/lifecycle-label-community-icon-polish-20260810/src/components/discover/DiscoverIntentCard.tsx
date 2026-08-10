import Link from "next/link";

import ActivityLifecycleTimeline from "@/components/activities/ActivityLifecycleTimeline";
import LifecycleCurrentDate from "@/components/activities/LifecycleCurrentDate";
import ActivityPeopleStrip from "@/components/activities/ActivityPeopleStrip";
import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import UserDiscoveryControlsMenu from "@/components/privacy/UserDiscoveryControlsMenu";
import ParticipantEligibilityBadge from "@/components/intents/ParticipantEligibilityBadge";
import CompactIntentReactionBar from "@/components/reactions/CompactIntentReactionBar";
import {
  getActivityVisibilityLabel,
  type ActivityVisibility,
} from "@/utils/activityVisibility";
import {
  resolveActivityCover,
} from "@/utils/activityCover";
import type { IntentLinkView } from "@/utils/intentLinks";
import type { IntentCommunityContext } from "@/utils/communities";
import { getSportPresentation } from "@/utils/sportPresentation";
import { formatEstimatedCost } from "@/utils/estimatedCost";
import PlanWeatherBadges from "@/components/weather/PlanWeatherBadges";
import IntentWeatherBadge from "@/components/weather/IntentWeatherBadge";
import type { ParticipantEligibility } from "@/utils/participationEligibility";
import type { IntentReactionContext } from "@/utils/intentReactions";
import type { ActivityPersonView } from "@/utils/activityPeople";

export type IntentLifecycleStatus =
  | "open"
  | "future"
  | "forming"
  | "planned"
  | "closed"
  | "completed"
  | "cancelled"
  | "expired";

export type DiscoverIntentRow = {
  intent_id: string;
  plan_id: string | null;
  plan_status: string | null;

  owner_user_id: string;
  owner_full_name: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;

  activity_id: string;
  activity_name: string;
  activity_cover_url: string | null;

  sport_id?: string | null;
  sport_name?: string | null;

  category_id: string;
  category_name: string;
  category_cover_url: string | null;

  location_id: string;
  city: string | null;
  district: string | null;

  start_date: string;
  end_date: string;
  timezone: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  cancelled_at: string | null;

  people: string;
  budget:
    | number
    | string
    | null;
  recurrence: string;
  visibility: ActivityVisibility;
  intent_type: string;

  intent_status:
    | "active"
    | "planned"
    | "completed"
    | "cancelled";

  recruitment_status:
    | "open"
    | "full"
    | "closed";

  matching_status:
    | "open"
    | "paused"
    | "matched"
    | "closed";

  expired_at: string | null;
  lifecycle_status: IntentLifecycleStatus;

  max_participants:
    | number
    | null;

  active_participant_count:
    | number
    | string;

  participant_eligibility: ParticipantEligibility;
  viewer_is_eligible?: boolean;

  viewer_can_request: boolean;
  viewer_is_member: boolean;

  viewer_invitation_status:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired"
    | null;

  viewer_request_status:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | null;

  viewer_request_id:
    | string
    | null;

  created_at: string;
  relevance:
    | number
    | string;
  total_count:
    | number
    | string;

  resource_id?: string | null;
  plan_cover_url?: string | null;

  profile_role?:
    | "host"
    | "co_host"
    | "participant";
  profile_role_label?: string | null;
  community_contexts?: IntentCommunityContext[];
  context_cover_url?: string | null;
  public_activity_location_name?: string | null;
  reaction_context?: IntentReactionContext | null;
  activity_people?: ActivityPersonView[];
  viewer_lineage?: {
    sourceCount: number;
    sourceIntentId: string;
    sourceIntentName: string | null;
    sourceIntentHref: string;
  } | null;
};

export type ViewerPlanLineage = {
  sourceCount: number;
  sourceIntentId: string;
  sourceIntentName: string | null;
  sourceIntentHref: string;
};

type LifecyclePresentation = {
  label: string;
  helper: string;
  badgeClasses: string;
};

function toNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function getInitial(
  value:
    | string
    | null
    | undefined
) {
  return (
    value
      ?.trim()
      .charAt(0)
      .toUpperCase() ||
    "?"
  );
}

function getLifecyclePresentation(
  lifecycle:
    IntentLifecycleStatus
): LifecyclePresentation {
  if (lifecycle === "future") {
    return {
      label: "Future",
      helper:
        "Availability has not started",
      badgeClasses:
        "bg-blue-100 text-blue-800",
    };
  }

  if (lifecycle === "forming") {
    return {
      label: "Forming",
      helper: "Planning in progress",
      badgeClasses: "bg-violet-100 text-violet-800",
    };
  }

  if (lifecycle === "planned") {
    return {
      label: "Planned",
      helper:
        "Schedule confirmed",
      badgeClasses:
        "bg-indigo-100 text-indigo-800",
    };
  }

  if (lifecycle === "closed") {
    return {
      label: "Closed",
      helper:
        "Not accepting matches",
      badgeClasses:
        "bg-gray-200 text-gray-700",
    };
  }

  if (lifecycle === "completed") {
    return {
      label: "Completed",
      helper:
        "Activity completed",
      badgeClasses:
        "bg-purple-100 text-purple-800",
    };
  }

  if (lifecycle === "cancelled") {
    return {
      label: "Cancelled",
      helper:
        "Activity cancelled",
      badgeClasses:
        "bg-red-100 text-red-800",
    };
  }

  if (lifecycle === "expired") {
    return {
      label: "Expired",
      helper:
        "Did not reach a scheduled Activity",
      badgeClasses:
        "bg-orange-100 text-orange-800",
    };
  }

  return {
    label: "Open",
    helper:
      "Accepting matches",
    badgeClasses:
      "bg-green-100 text-green-800",
  };
}

function getLifecycleSurfaceClasses(
  lifecycle: IntentLifecycleStatus
) {
  if (lifecycle === "future") {
    return "border-sky-200 bg-gradient-to-b from-sky-50 via-sky-50/45 to-white";
  }

  if (lifecycle === "forming") {
    return "border-violet-200 bg-gradient-to-b from-violet-50 via-violet-50/45 to-white";
  }

  if (lifecycle === "planned") {
    return "border-indigo-200 bg-gradient-to-b from-indigo-50 via-indigo-50/45 to-white";
  }

  if (lifecycle === "closed") {
    return "border-slate-300 bg-gradient-to-b from-slate-100 via-slate-50/70 to-white";
  }

  if (lifecycle === "completed") {
    return "border-emerald-200 bg-gradient-to-b from-emerald-50 via-emerald-50/45 to-white";
  }

  if (lifecycle === "cancelled") {
    return "border-rose-200 bg-gradient-to-b from-rose-50 via-rose-50/55 to-white";
  }

  if (lifecycle === "expired") {
    return "border-amber-200 bg-gradient-to-b from-stone-100 via-amber-50/55 to-white";
  }

  return "border-green-200 bg-gradient-to-b from-green-50 via-green-50/45 to-white";
}

function getOwnerAction({
  intent,
}: {
  intent: DiscoverIntentRow;
}) {
  if (!intent.plan_id) {
    if (
      intent.intent_status ===
        "active"
    ) {
      return {
        href:
          `/intents/${encodeURIComponent(
            intent.intent_id
          )}/edit`,
        label:
          "Edit Intent",
      };
    }

    return {
      href:
        `/activities/${encodeURIComponent(
          intent.intent_id
        )}`,
      label:
        "View record",
    };
  }

  if (
    intent.plan_status ===
      "forming"
  ) {
    return {
      href:
        `/plans/${encodeURIComponent(
          intent.plan_id
        )}/planning`,
      label:
        "Open Planning Room",
    };
  }

  return {
    href:
      `/plans/${encodeURIComponent(
        intent.plan_id
      )}/activity`,
    label:
      intent.lifecycle_status ===
        "completed"
        ? "Open Activity Archive"
        : "Open Activity Room",
  };
}

function getMemberRoomHref(
  intent: DiscoverIntentRow
) {
  if (!intent.plan_id) {
    return null;
  }

  return intent.plan_status ===
    "forming"
    ? `/plans/${encodeURIComponent(
        intent.plan_id
      )}/planning`
    : `/plans/${encodeURIComponent(
        intent.plan_id
      )}/activity`;
}

export default function DiscoverIntentCard({
  intent,
  currentUserId,
  isAuthenticated = true,
  relatedLinks = [],
  communities = [],
  displayTitle = null,
  privateCoverUrl,
  contextCoverUrl = null,
  publicActivityLocationName = null,
  mapPointContext = null,
  activityPeople = [],
  viewerLineage = null,
  actionMode = "default",
  fallbackCommunityName = null,
  fallbackCommunityHref = null,
  intentNote = null,
}: {
  intent: DiscoverIntentRow;
  currentUserId: string;
  isAuthenticated?: boolean;
  relatedLinks?: IntentLinkView[];
  communities?: IntentCommunityContext[];
  displayTitle?: string | null;
  privateCoverUrl?: string | null;
  contextCoverUrl?: string | null;
  publicActivityLocationName?: string | null;
  mapPointContext?: {
    location_query: string | null;
    public_location_name: string | null;
    location_precision: "public_venue" | "approximate";
  } | null;
  activityPeople?: ActivityPersonView[];
  viewerLineage?: ViewerPlanLineage | null;
  actionMode?: "default" | "profile";
  showEmbeddedMap?: boolean;
  fallbackCommunityName?: string | null;
  fallbackCommunityHref?: string | null;
  intentNote?: string | null;
}) {
  const resolvedActivityPeople =
    activityPeople.length > 0
      ? activityPeople
      : intent.activity_people ?? [];

  const resolvedViewerLineage =
    viewerLineage ?? intent.viewer_lineage ?? null;

  const cardTitle =
    displayTitle?.trim() ||
    intent.activity_name;

  const resolvedCommunities =
    communities.length > 0
      ? communities
      : intent.community_contexts ?? [];

  const primaryCommunity =
    resolvedCommunities.find(
      (community) =>
        community.isPrimary
    ) ??
    resolvedCommunities[0] ??
    null;

  const primaryCommunityName =
    primaryCommunity?.name ||
    fallbackCommunityName?.trim() ||
    null;

  const primaryCommunityAccent =
    primaryCommunity?.accentColor ||
    "#059669";

  const primaryCommunityHref =
    primaryCommunity?.slug
      ? `/communities/${encodeURIComponent(primaryCommunity.slug)}`
      : fallbackCommunityHref;

  const resolvedContextCoverUrl =
    contextCoverUrl ||
    intent.context_cover_url ||
    null;

  const sportPresentation =
    intent.sport_name
      ? getSportPresentation(
          intent.sport_name
        )
      : null;

  const ownerName =
    intent.owner_full_name ||
    intent.owner_username ||
    "UIN member";

  const isOwner =
    intent.owner_user_id ===
    currentUserId;

  const viewerPlanPerson = resolvedActivityPeople.find(
    (person) => person.userId === currentUserId
  ) ?? null;

  const viewerPlanRoleLabel =
    viewerPlanPerson?.role === "host"
      ? "You · Host"
      : viewerPlanPerson?.role === "co_host"
        ? "You · Co-host"
        : viewerPlanPerson?.role === "participant"
          ? "You · Participant"
          : null;

  const lifecycle =
    getLifecyclePresentation(
      intent.lifecycle_status
    );

  const lifecycleSurfaceClasses =
    getLifecycleSurfaceClasses(
      intent.lifecycle_status
    );

  const participantCount =
    toNumber(
      intent.active_participant_count
    );

  const participantLimit =
    intent.max_participants ===
    null
      ? "∞"
      : String(
          intent.max_participants
        );

  const budget =
    intent.budget === null
      ? null
      : toNumber(
          intent.budget
        );

  const costLabel =
    intent.plan_id
      ? "Plan budget"
      : "Est. cost / person";

  const costValue =
    intent.plan_id
      ? budget === null
        ? "Not set"
        : `${budget.toLocaleString(
            "en-US"
          )} TL`
      : formatEstimatedCost(
          intent.budget,
          {
            includePerPerson:
              false,
          }
        );

  const resolvedPlanCoverUrl =
    privateCoverUrl !== undefined
      ? privateCoverUrl
      : intent.plan_cover_url;

  const coverUrl =
    resolveActivityCover({
      planCoverUrl:
        resolvedPlanCoverUrl ||
        resolvedContextCoverUrl,
      activityCoverUrl:
        intent.activity_cover_url,
      categoryCoverUrl:
        intent.category_cover_url,
      categoryName:
        intent.category_name,
      activityName:
        intent.activity_name,
    });

  const approximateLocationLabel = [
    intent.district,
    intent.city,
  ]
    .filter(Boolean)
    .join(", ");

  const legacyPublicVenueName =
    publicActivityLocationName?.trim() ||
    intent.public_activity_location_name?.trim() ||
    null;

  // One canonical location context drives BOTH the map and its label.
  // This prevents an approximate Intent location from being rendered next
  // to a different public Activity venue. Meeting points never belong here.
  const mapPrecision =
    mapPointContext?.location_precision ??
    (legacyPublicVenueName ? "public_venue" : "approximate");

  const mapQuery =
    mapPointContext?.location_query?.trim() ||
    (mapPrecision === "public_venue"
      ? legacyPublicVenueName
      : null) ||
    approximateLocationLabel ||
    intent.city;

  const mapLocationLabel =
    mapPointContext?.public_location_name?.trim() ||
    (mapPrecision === "public_venue"
      ? legacyPublicVenueName
      : approximateLocationLabel || intent.city) ||
    null;

  const mapEmbedUrl =
    mapQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          mapQuery
        )}&z=10&output=embed`
      : null;

  const ownerProfileHref =
    intent.owner_username
      ? `/u/${encodeURIComponent(
          intent.owner_username
        )}`
      : null;

  const ownerAction =
    getOwnerAction({
      intent,
    });

  const memberRoomHref =
    getMemberRoomHref(
      intent
    );

  const canDisplayJoinAction =
    !isOwner &&
    (
      intent.lifecycle_status ===
        "open" ||
      intent.lifecycle_status ===
        "future" ||
      intent.lifecycle_status ===
        "forming"
    ) &&
    (
      intent.recruitment_status ===
        "open" ||
      intent.recruitment_status ===
        "full"
    );

  const detailToggleId =
    `intent-card-details-${intent.intent_id}`;

  return (
    <article
      className={`relative flex h-[400px] min-w-0 flex-col overflow-hidden rounded-3xl border shadow-sm transition hover:shadow-md ${lifecycleSurfaceClasses}`}
    >
      <input
        id={detailToggleId}
        type="checkbox"
        className="peer sr-only"
        aria-label={`Toggle details for ${cardTitle}`}
      />

      {/* Cover is intentionally outside the front/back swap. Details never replace it. */}
      <div className="relative h-[128px] shrink-0 overflow-hidden bg-gray-950">
        <img
          src={coverUrl}
          alt={`${cardTitle} cover`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/45" />

        <div className="absolute inset-x-3 top-3 flex min-w-0 items-start justify-between gap-2">
          <div className="flex max-w-[70%] min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex h-5 items-center rounded-full px-2 py-0 text-[8.5px] font-bold uppercase leading-none tracking-[0.04em] shadow-sm ${lifecycle.badgeClasses}`}
            >
              {lifecycle.label}
            </span>

            <div className="flex h-5 items-center [&>*]:!h-5 [&>*]:!min-h-0 [&>*]:!rounded-full [&>*]:!px-2 [&>*]:!py-0 [&>*]:!text-[8.5px] [&>*]:!leading-none">
              <ParticipantEligibilityBadge
                eligibility={intent.participant_eligibility}
              />
            </div>

            {!isOwner &&
            intent.plan_id &&
            viewerPlanRoleLabel ? (
              <span className="max-w-[130px] truncate rounded-full bg-gray-950/80 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.03em] text-white backdrop-blur">
                {viewerPlanRoleLabel.replace(/^You · /, "")}
              </span>
            ) : actionMode === "profile" &&
              intent.profile_role_label &&
              intent.profile_role !== "host" ? (
              <span className="max-w-[130px] truncate rounded-full bg-gray-950/80 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.03em] text-white backdrop-blur">
                {intent.profile_role_label}
              </span>
            ) : null}
          </div>

          <div className="flex max-w-[42%] shrink-0 items-center gap-1.5">
            {intent.sport_name && sportPresentation && (
              <span
                className="inline-flex max-w-[118px] items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.05em] shadow-sm"
                style={{
                  backgroundColor: sportPresentation.backgroundColor,
                  borderColor: sportPresentation.borderColor,
                  color: sportPresentation.textColor,
                }}
              >
                <span aria-hidden="true">
                  {sportPresentation.icon}
                </span>
                <span className="truncate">
                  {intent.sport_name}
                </span>
              </span>
            )}

            {!isOwner && isAuthenticated && (
              <UserDiscoveryControlsMenu
                targetUserId={intent.owner_user_id}
                targetDisplayName={ownerName}
                compact
              />
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
          <p className="h-3 truncate text-[9px] font-bold uppercase tracking-[0.11em] text-green-300">
            {intent.category_name}
          </p>

          <div className="mt-0.5 flex h-[38px] min-w-0 items-end justify-between gap-2">
            <h2 className="min-w-0 flex-1 line-clamp-2 text-[17px] font-bold leading-[1.12] text-white">
              {cardTitle}
            </h2>

            <div className="mb-0.5 shrink-0">
              {intent.plan_id &&
              intent.lifecycle_status === "planned" ? (
                <PlanWeatherBadges
                  planId={intent.plan_id}
                  compact
                />
              ) : intent.lifecycle_status === "open" ||
                intent.lifecycle_status === "future" ||
                intent.lifecycle_status === "forming" ? (
                <IntentWeatherBadge
                  intentId={intent.intent_id}
                  compact
                />
              ) : null}
            </div>
          </div>

          <div className="mt-1 flex h-6 min-w-0 items-center">
            {primaryCommunityName ? (
              primaryCommunityHref ? (
                <Link
                  href={primaryCommunityHref}
                  title={`Open ${primaryCommunityName} Community`}
                  className="inline-flex min-w-0 max-w-[74%] items-center gap-1.5 rounded-full border bg-white/95 px-1.5 py-0.5 text-[8.5px] font-semibold text-gray-900 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-white"
                  style={{ borderColor: primaryCommunityAccent }}
                >
                  {primaryCommunity?.iconUrl ? (
                    <img
                      src={primaryCommunity.iconUrl}
                      alt=""
                      className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: primaryCommunityAccent }}
                    />
                  )}
                  <span className="truncate">{primaryCommunityName}</span>
                  {resolvedCommunities.length > 1 && (
                    <span className="shrink-0 text-gray-500">
                      +{resolvedCommunities.length - 1}
                    </span>
                  )}
                </Link>
              ) : (
                <span
                  className="inline-flex min-w-0 max-w-[74%] items-center gap-1.5 rounded-full border bg-white/95 px-1.5 py-0.5 text-[8.5px] font-semibold text-gray-900 shadow-sm backdrop-blur"
                  style={{ borderColor: primaryCommunityAccent }}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: primaryCommunityAccent }}
                  />
                  <span className="truncate">{primaryCommunityName}</span>
                </span>
              )
            ) : (
              <span aria-hidden="true" className="block h-6 w-1" />
            )}
          </div>
        </div>
      </div>

      {/* Normal card body. Cover stays fixed; only this body swaps with Details. */}
      <div className="flex min-h-0 flex-1 flex-col peer-checked:hidden">
        <div className="shrink-0 border-b border-black/5 px-2.5 py-2">
          <LifecycleCurrentDate
            targetStart={intent.start_date}
            targetEnd={intent.end_date}
            scheduledStart={intent.scheduled_start}
            scheduledEnd={intent.scheduled_end}
            completedAt={intent.completed_at}
            cancelledAt={intent.cancelled_at}
            expiredAt={intent.expired_at}
            status={intent.lifecycle_status}
            timezone={intent.timezone}
            compact
            className="w-full"
          />
        </div>

        <div className="relative h-[118px] shrink-0 overflow-hidden border-b border-black/5 bg-gray-100">
          {mapEmbedUrl ? (
            <iframe
              title={`${cardTitle} location preview`}
              src={mapEmbedUrl}
              className="pointer-events-none absolute -top-9 left-0 h-[calc(100%+36px)] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              tabIndex={-1}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-gray-500">
              No map
            </div>
          )}

          {mapLocationLabel && (
            <span className="absolute bottom-2 left-2 max-w-[78%] truncate rounded-full bg-gray-950/80 px-2 py-0.5 text-[8.5px] font-semibold text-white backdrop-blur">
              {mapPrecision === "public_venue" ? "📍" : "≈"} {mapLocationLabel}
            </span>
          )}
        </div>

        <div className="flex h-[52px] shrink-0 min-w-0 items-center justify-between gap-3 border-b border-black/5 px-3">
          <div className="min-w-0 flex-1">
            {resolvedActivityPeople.length > 0 ? (
              <ActivityPeopleStrip
                people={resolvedActivityPeople}
                currentUserId={currentUserId}
                activityHref={`/activities/${encodeURIComponent(
                  intent.plan_id ??
                    intent.resource_id ??
                    intent.intent_id
                )}`}
                variant="compact"
                maxVisible={4}
              />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                {intent.owner_avatar_url ? (
                  <img
                    src={intent.owner_avatar_url}
                    alt={ownerName}
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-[10px] font-semibold text-green-700">
                    {getInitial(ownerName)}
                  </div>
                )}

                <div className="min-w-0">
                  {ownerProfileHref && !isOwner ? (
                    <Link
                      href={ownerProfileHref}
                      className="block truncate text-[12px] font-semibold leading-tight text-gray-950 transition hover:text-green-700"
                    >
                      {ownerName}
                    </Link>
                  ) : (
                    <p className="truncate text-[12px] font-semibold leading-tight text-gray-950">
                      {ownerName}
                    </p>
                  )}
                  <p className="mt-0.5 text-[9px] font-medium text-gray-400">
                    Host
                  </p>
                </div>
              </div>
            )}
          </div>

          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm">
            {participantCount} / {participantLimit}
          </span>
        </div>
      </div>

      {/* Detail face keeps the cover and swaps only the area below it. */}
      <div className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white/85 px-2.5 py-2 peer-checked:block">
        <div className="shrink-0">
          <ActivityLifecycleTimeline
            targetStart={intent.start_date}
            targetEnd={intent.end_date}
            scheduledStart={intent.scheduled_start}
            scheduledEnd={intent.scheduled_end}
            completedAt={intent.completed_at}
            cancelledAt={intent.cancelled_at}
            expiredAt={intent.expired_at}
            status={intent.lifecycle_status}
            timezone={intent.timezone}
            variant="compact"
            hideCompactTitle
          />
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9.5px]">
          <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">
              Participants
            </p>
            <p className="mt-0.5 truncate font-semibold text-gray-950">
              {participantCount} / {participantLimit}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">
              Visibility
            </p>
            <p className="mt-0.5 truncate font-semibold text-gray-950">
              {getActivityVisibilityLabel(intent.visibility)}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">
              Recurrence
            </p>
            <p className="mt-0.5 truncate font-semibold capitalize text-gray-950">
              {intent.recurrence}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">
              {costLabel}
            </p>
            <p className="mt-0.5 truncate font-semibold text-gray-950">
              {costValue}
            </p>
          </div>
        </div>

        {(primaryCommunityName || mapLocationLabel) && (
          <div className="mt-1 flex min-w-0 gap-1 overflow-hidden">
            {primaryCommunityName &&
              (primaryCommunityHref ? (
                <Link
                  href={primaryCommunityHref}
                  className="inline-flex min-w-0 max-w-[58%] items-center gap-1 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[8.5px] font-semibold text-green-800 transition hover:bg-green-100"
                >
                  <span aria-hidden="true">●</span>
                  <span className="truncate">{primaryCommunityName}</span>
                  {resolvedCommunities.length > 1 && (
                    <span className="shrink-0 text-green-600">
                      +{resolvedCommunities.length - 1}
                    </span>
                  )}
                </Link>
              ) : (
                <span className="inline-flex min-w-0 max-w-[58%] items-center gap-1 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[8.5px] font-semibold text-green-800">
                  <span aria-hidden="true">●</span>
                  <span className="truncate">{primaryCommunityName}</span>
                </span>
              ))}

            {mapLocationLabel && (
              <span className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[8.5px] font-medium text-gray-600">
                <span aria-hidden="true">{mapPrecision === "public_venue" ? "📍" : "≈"}</span>
                <span className="truncate">{mapLocationLabel}</span>
              </span>
            )}
          </div>
        )}

        {intentNote?.trim() && (
          <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-1.5">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-blue-500">
              Note
            </p>
            <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-3.5 text-gray-700">
              {intentNote.trim()}
            </p>
          </div>
        )}

        <div className="mt-1 flex min-w-0 items-center gap-2 text-[8.5px] text-gray-500">
          <span className="shrink-0">
            {relatedLinks.length} {relatedLinks.length === 1 ? "link" : "links"}
          </span>

          {resolvedViewerLineage && intent.plan_id && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={resolvedViewerLineage.sourceIntentHref}
                className="min-w-0 truncate font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Origin · {resolvedViewerLineage.sourceIntentName ?? intent.activity_name}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex h-[34px] shrink-0 items-center gap-1 border-t border-black/5 bg-white/95 px-1.5">
        <CompactIntentReactionBar
          intentId={intent.intent_id}
          initialContext={intent.reaction_context ?? null}
          isAuthenticated={isAuthenticated}
          isOwner={isOwner}
        />

        <Link
          href={`/activities/${encodeURIComponent(
            intent.plan_id ?? intent.resource_id ?? intent.intent_id
          )}`}
          title="View"
          aria-label={`View ${cardTitle}`}
          className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-[11px] text-gray-600 transition hover:border-green-300 hover:text-green-700"
        >
          ◉
        </Link>

        {isOwner ? (
          <Link
            href={ownerAction.href}
            title={ownerAction.label}
            aria-label={ownerAction.label}
            className="flex h-6 w-8 shrink-0 items-center justify-center rounded-md bg-gray-950 text-[11px] font-semibold text-white transition hover:bg-gray-800"
          >
            ✎
          </Link>
        ) : intent.viewer_is_member && memberRoomHref ? (
          <Link
            href={memberRoomHref}
            className="flex h-6 min-w-[52px] shrink-0 items-center justify-center rounded-md bg-green-600 px-2 text-[9.5px] font-semibold text-white transition hover:bg-green-700"
          >
            Room
          </Link>
        ) : canDisplayJoinAction ? (
          <div className="shrink-0 [&_button]:!h-6 [&_button]:!min-h-0 [&_button]:!w-auto [&_button]:!min-w-[68px] [&_button]:!rounded-md [&_button]:!px-2 [&_button]:!py-0 [&_button]:!text-[9.5px] [&_button]:!leading-none">
            <PublicIntentJoinButton
              intentId={intent.intent_id}
              planId={intent.plan_id}
              activityName={cardTitle}
              recruitmentStatus={intent.recruitment_status === "full" ? "full" : "open"}
              visibility={intent.visibility}
              viewerCanRequest={intent.viewer_can_request}
              viewerIsEligible={
                intent.viewer_is_eligible ??
                (intent.viewer_can_request || intent.viewer_is_member)
              }
              viewerIsMember={intent.viewer_is_member}
              viewerInvitationStatus={intent.viewer_invitation_status}
              initialRequestStatus={intent.viewer_request_status}
              initialRequestId={intent.viewer_request_id}
              isAuthenticated={isAuthenticated}
            />
          </div>
        ) : (
          <span className="flex h-6 min-w-[58px] shrink-0 items-center justify-center rounded-md bg-gray-100 px-2 text-[9px] font-semibold text-gray-500">
            {lifecycle.label}
          </span>
        )}

        <label
          htmlFor={detailToggleId}
          className="ml-auto flex h-6 w-[56px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white px-1.5 text-[9.5px] font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700 after:ml-1 after:content-['▾'] peer-checked:after:content-['▴']"
        >
          Details
        </label>
      </div>
    </article>
  );
}
