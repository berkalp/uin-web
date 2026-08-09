import Link from "next/link";

import ActivityLifecycleTimeline from "@/components/activities/ActivityLifecycleTimeline";
import ActivityPeopleStrip from "@/components/activities/ActivityPeopleStrip";
import CommunityContextList from "@/components/communities/CommunityContextList";
import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import UserDiscoveryControlsMenu from "@/components/privacy/UserDiscoveryControlsMenu";
import ParticipantEligibilityBadge from "@/components/intents/ParticipantEligibilityBadge";
import IntentReactionBar from "@/components/reactions/IntentReactionBar";
import IntentLinksDisplay from "@/components/intents/IntentLinksDisplay";
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
import TimelineShareButton from "@/components/timeline/TimelineShareButton";
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
  activityPeople = [],
  viewerLineage = null,
  actionMode = "default",
  showEmbeddedMap = true,
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
  activityPeople?: ActivityPersonView[];
  viewerLineage?: ViewerPlanLineage | null;
  actionMode?: "default" | "profile";
  showEmbeddedMap?: boolean;
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
      ? "You Â· Host"
      : viewerPlanPerson?.role === "co_host"
        ? "You Â· Co-host"
        : viewerPlanPerson?.role === "participant"
          ? "You Â· Participant"
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
      ? "âˆ"
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

  const locationLabel = [
    intent.district,
    intent.city,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery =
    locationLabel ||
    intent.city;

  const mapEmbedUrl =
    mapQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          mapQuery
        )}&z=10&output=embed`
      : null;

  const publicVenueName =
    publicActivityLocationName?.trim() ||
    intent.public_activity_location_name?.trim() ||
    null;

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

  return (
    <article
      className={`relative flex h-full min-w-0 flex-col overflow-visible rounded-3xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${lifecycleSurfaceClasses}`}
    >
      <div className="relative h-36 overflow-hidden rounded-t-3xl bg-gray-950">
        <img
          src={coverUrl}
          alt={`${cardTitle} cover`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/35" />

        <div className="absolute inset-x-3 top-3 flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${lifecycle.badgeClasses}`}
            >
              {lifecycle.label}
            </span>

            <ParticipantEligibilityBadge
              eligibility={
                intent.participant_eligibility
              }
            />

            {intent.plan_id && viewerPlanRoleLabel ? (
              <span className="rounded-full bg-gray-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                {viewerPlanRoleLabel}
              </span>
            ) : actionMode === "profile" &&
            intent.profile_role_label &&
            intent.profile_role !== "host" ? (
              <span className="rounded-full bg-gray-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                {intent.profile_role_label}
              </span>
            ) : actionMode !== "profile" && isOwner ? (
              <span className="rounded-full bg-gray-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                Hosted by you
              </span>
            ) : null}
          </div>

          {intent.sport_name &&
            sportPresentation && (
            <span
              className="inline-flex max-w-[45%] shrink-0 items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] shadow-sm"
              style={{
                backgroundColor:
                  sportPresentation.backgroundColor,
                borderColor:
                  sportPresentation.borderColor,
                color:
                  sportPresentation.textColor,
              }}
            >
              <span
                aria-hidden="true"
                className="shrink-0"
              >
                {sportPresentation.icon}
              </span>

              <span className="truncate">
                {intent.sport_name}
              </span>
            </span>
          )}
        </div>

        {intent.plan_id && intent.lifecycle_status === "planned" ? (
          <PlanWeatherBadges
            planId={intent.plan_id}
            className="absolute right-3 top-12 z-10"
          />
        ) : intent.lifecycle_status === "open" ||
          intent.lifecycle_status === "future" ||
          intent.lifecycle_status === "forming" ? (
          <IntentWeatherBadge
            intentId={intent.intent_id}
            className="absolute right-3 top-12 z-10"
          />
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-green-300">
              {intent.category_name}
            </p>

          </div>

          <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-tight text-white">
            {cardTitle}
          </h2>

          <CommunityContextList
            communities={resolvedCommunities}
            variant="card"
          />
        </div>
      </div>

      {showEmbeddedMap ? (
        <div className="grid grid-cols-2 border-b border-black/5">
          <div className="min-w-0 p-4">
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
            />
          </div>

          <div className="relative min-h-[184px] overflow-hidden border-l border-black/5 bg-gray-100">
            {mapEmbedUrl ? (
              <iframe
                title={`${cardTitle} approximate area`}
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

            {publicVenueName ? (
              <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[9px] font-bold text-gray-950 shadow-sm backdrop-blur">
                Venue Â· {publicVenueName}
              </span>
            ) : null}

            {mapEmbedUrl && (
              <span className="absolute bottom-2 left-2 max-w-[150px] truncate rounded-full bg-gray-950/80 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">
                Approximate area{intent.district ? ` Â· ${intent.district}` : ""}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="border-b border-black/5 p-4">
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
          />

          <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-950/80 px-2.5 py-1 text-[9px] font-semibold text-white">
              <span aria-hidden="true">âŒ–</span>
              <span className="truncate">
                Approximate area
                {locationLabel ? ` Â· ${locationLabel}` : ""}
              </span>
            </span>

            {publicVenueName ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[9px] font-semibold text-green-800">
                <span aria-hidden="true">â—</span>
                <span className="truncate">Venue Â· {publicVenueName}</span>
              </span>
            ) : null}
          </div>
        </div>
      )}

      {resolvedViewerLineage && intent.plan_id ? (
        <div className="border-b border-black/5 bg-white/55 px-4 py-3">
          <Link
            href={resolvedViewerLineage.sourceIntentHref}
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 transition hover:border-emerald-200 hover:bg-emerald-100"
          >
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-700">
                {resolvedViewerLineage.sourceCount > 1
                  ? `${resolvedViewerLineage.sourceCount} Intents matched â†’ 1 Activity`
                  : "Your Intent â†’ this Activity"}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-black text-gray-900">
                Your Intent Â· {resolvedViewerLineage.sourceIntentName ?? intent.activity_name}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-black text-emerald-800">â†—</span>
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 p-4 text-xs">
        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Participants
          </p>

          <p className="mt-1 font-bold text-gray-950">
            {participantCount}
            {" / "}
            {participantLimit}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Visibility
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {getActivityVisibilityLabel(
              intent.visibility
            )}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Recurrence
          </p>

          <p className="mt-1 truncate font-bold capitalize text-gray-950">
            {intent.recurrence}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            {costLabel}
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {costValue}
          </p>
        </div>
      </div>

      <div className="flex h-[58px] items-center border-t border-black/5 bg-white/35 px-4 py-3">
        <div className="min-w-0 flex-1">
          <IntentLinksDisplay
            links={relatedLinks}
            compact
            maxItems={1}
            emptyLabel="No related link attached"
            singleLine
          />
        </div>
      </div>

      <div className="border-t border-black/5 bg-white/55 px-4 py-3">
        <IntentReactionBar
          intentId={intent.intent_id}
          initialContext={intent.reaction_context ?? null}
          isAuthenticated={isAuthenticated}
          isOwner={isOwner}
          variant="card"
        />
      </div>

      <div className="mt-auto rounded-b-3xl border-t border-black/5 bg-white/45 p-4">
        {resolvedActivityPeople.length > 0 ? (
          <ActivityPeopleStrip
            people={resolvedActivityPeople}
            currentUserId={currentUserId}
            activityHref={`/activities/${encodeURIComponent(
              intent.plan_id ?? intent.resource_id ?? intent.intent_id
            )}`}
            variant="compact"
            maxVisible={5}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            {intent.owner_avatar_url ? (
              <img
                src={intent.owner_avatar_url}
                alt={ownerName}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
                {getInitial(ownerName)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                {isOwner ? "Hosted by you" : "Hosted by"}
              </p>

              {ownerProfileHref && !isOwner ? (
                <Link
                  href={ownerProfileHref}
                  className="block truncate text-xs font-bold text-gray-950 transition hover:text-green-700"
                >
                  {ownerName}
                </Link>
              ) : (
                <p className="truncate text-xs font-bold text-gray-950">
                  {ownerName}
                </p>
              )}
            </div>
          </div>
        )}

        {isOwner &&
        actionMode ===
          "profile" ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link
              href={`/activities/${encodeURIComponent(
                intent.plan_id ??
                  intent.resource_id ??
                  intent.intent_id
              )}`}
              className="flex min-h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
            >
              View
            </Link>

            <TimelineShareButton
              title={`${cardTitle} Intent`}
              text={`I have a ${cardTitle} Intent on UIN. Are you in?`}
              url={`/activities/${encodeURIComponent(
                intent.plan_id ??
                  intent.resource_id ??
                  intent.intent_id
              )}`}
            />

            <details className="group relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-1 rounded-xl bg-gray-950 px-2 text-xs font-semibold text-white transition hover:bg-gray-800">
                Manage
                <span className="text-[9px] transition group-open:rotate-180">
                  â–¼
                </span>
              </summary>

              <div className="absolute bottom-full right-0 z-50 mb-2 w-[270px] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
                <div className="grid gap-2">
                  <Link
                    href={
                      ownerAction.href
                    }
                    className="rounded-xl bg-gray-950 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    {ownerAction.label}
                  </Link>

                  {!intent.plan_id && (
                    <Link
                      href={`/intents/${encodeURIComponent(
                        intent.intent_id
                      )}/visibility`}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Manage Visibility
                    </Link>
                  )}

                  <Link
                    href="/timeline"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                  >
                    Open Timeline
                  </Link>
                </div>
              </div>
            </details>
          </div>
        ) : (
          <>
            {!isOwner && isAuthenticated && (
              <div className="mb-3 flex justify-end">
                <UserDiscoveryControlsMenu
                  targetUserId={intent.owner_user_id}
                  targetDisplayName={ownerName}
                  compact
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/activities/${encodeURIComponent(
                intent.plan_id ??
                  intent.resource_id ??
                  intent.intent_id
              )}`}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-center text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
            >
              View
            </Link>

            {isOwner ? (
              <Link
                href={
                  ownerAction.href
                }
                className="flex-1 rounded-xl bg-gray-950 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-gray-800"
              >
                {ownerAction.label}
              </Link>
            ) : intent.viewer_is_member &&
              memberRoomHref ? (
              <Link
                href={
                  memberRoomHref
                }
                className="flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-green-700"
              >
                Open Room
              </Link>
            ) : canDisplayJoinAction ? (
              <PublicIntentJoinButton
                intentId={
                  intent.intent_id
                }
                planId={
                  intent.plan_id
                }
                activityName={
                  cardTitle
                }
                recruitmentStatus={
                  intent.recruitment_status ===
                    "full"
                    ? "full"
                    : "open"
                }
                visibility={
                  intent.visibility
                }
                viewerCanRequest={
                  intent.viewer_can_request
                }
                viewerIsEligible={
                  intent.viewer_is_eligible ??
                  (intent.viewer_can_request ||
                    intent.viewer_is_member)
                }
                viewerIsMember={
                  intent.viewer_is_member
                }
                viewerInvitationStatus={
                  intent.viewer_invitation_status
                }
                initialRequestStatus={
                  intent.viewer_request_status
                }
                initialRequestId={
                  intent.viewer_request_id
                }
                isAuthenticated={
                  isAuthenticated
                }
              />
            ) : (
              <span className="flex-1 rounded-xl bg-gray-100 px-3 py-2.5 text-center text-xs font-semibold text-gray-500">
                {lifecycle.label}
              </span>
            )}
          </div>
          </>
        )}
      </div>
    </article>
  );
}

