import Link from "next/link";
import { commonIntentTitle } from "@/utils/commonIntentTitle";
import { liveSportTitle } from "@/utils/liveSportTitle";
import UinCard, { cardPrimary } from "@/components/cards/UinCard";
import PersonalLibraryCard from "@/components/cards/PersonalLibraryCard";
import CardRatingBadge from "@/components/cards/CardRatingBadge";
import LifecycleCurrentDate from "@/components/activities/LifecycleCurrentDate";
import IntentReactionBar from "@/components/reactions/IntentReactionBar";

import EyeIcon from "@/components/ui/EyeIcon";

import CanonicalActivityCardBody from "@/components/cards/CanonicalActivityCardBody";
import CanonicalActivityCardDetails from "@/components/cards/CanonicalActivityCardDetails";
import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import CompactIntentReactionBar from "@/components/reactions/CompactIntentReactionBar";
import UserDiscoveryControlsMenu from "@/components/privacy/UserDiscoveryControlsMenu";
import ParticipantEligibilityBadge from "@/components/intents/ParticipantEligibilityBadge";
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
      label: "Gelecek",
      helper:
        "Katılım dönemi başlamadı",
      badgeClasses:
        "bg-blue-100 text-blue-800",
    };
  }

  if (lifecycle === "forming") {
    return {
      label: "Şekilleniyor",
      helper: "Planlama devam ediyor",
      badgeClasses: "bg-violet-100 text-violet-800",
    };
  }

  if (lifecycle === "planned") {
    return {
      label: "Planlandı",
      helper:
        "Program kesinleşti",
      badgeClasses:
        "bg-indigo-100 text-indigo-800",
    };
  }

  if (lifecycle === "closed") {
    return {
      label: "Kapalı",
      helper:
        "Yeni katılım kabul etmiyor",
      badgeClasses:
        "bg-gray-200 text-gray-700",
    };
  }

  if (lifecycle === "completed") {
    return {
      label: "Tamamlandı",
      helper:
        "Etkinlik tamamlandı",
      badgeClasses:
        "bg-purple-100 text-purple-800",
    };
  }

  if (lifecycle === "cancelled") {
    return {
      label: "İptal edildi",
      helper:
        "Etkinlik iptal edildi",
      badgeClasses:
        "bg-red-100 text-red-800",
    };
  }

  if (lifecycle === "expired") {
    return {
      label: "Süresi geçti",
      helper:
        "Planlanmış bir etkinliğe dönüşmedi",
      badgeClasses:
        "bg-orange-100 text-orange-800",
    };
  }

  return {
    label: "Açık",
    helper:
      "Katılım kabul ediyor",
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
  publicMeetingPoint = null,
  mapPointContext = null,
  activityPeople = [],
  viewerLineage = null,
  actionMode = "default",
  fallbackCommunityName = null,
  fallbackCommunityHref = null,
  intentNote = null,
  commonTarget = null,
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
  publicMeetingPoint?: string | null;
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
  commonTarget?: { id: string; title: string } | null;
}) {
  const activityPeopleFromQuery =
    activityPeople.length > 0
      ? activityPeople
      : intent.activity_people ?? [];

  const resolvedActivityPeople = activityPeopleFromQuery.some(
    (person) => person.userId === intent.owner_user_id
  )
    ? activityPeopleFromQuery
    : [
        {
          userId: intent.owner_user_id,
          fullName: intent.owner_full_name,
          username: intent.owner_username,
          avatarUrl: intent.owner_avatar_url,
          role: "host",
        },
        ...activityPeopleFromQuery,
      ];

  const resolvedViewerLineage =
    viewerLineage ?? intent.viewer_lineage ?? null;


  const primaryCommunityName: string | null = null;

  const baseTitle = displayTitle?.trim() || intent.activity_name;
  const cardTitle = liveSportTitle(baseTitle, intent.sport_name, null);

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
    "UIN üyesi";

  const isOwner =
    intent.owner_user_id ===
    currentUserId;

  const viewerPlanPerson = resolvedActivityPeople.find(
    (person) => person.userId === currentUserId
  ) ?? null;

  const viewerPlanRoleLabel =
    viewerPlanPerson?.role === "host"
      ? "Sen · Yürütücü"
      : viewerPlanPerson?.role === "co_host"
        ? "Sen · Eş yürütücü"
        : viewerPlanPerson?.role === "participant"
          ? "Sen · Katılımcı"
          : null;

  const lifecycle =
    getLifecyclePresentation(
      intent.lifecycle_status
    );

  const lifecycleSurfaceClasses =
    getLifecycleSurfaceClasses(
      intent.lifecycle_status
    );

  const participantCount = Math.max(
    toNumber(intent.active_participant_count),
    resolvedActivityPeople.length
  );

  const participants = resolvedActivityPeople.filter(
    (person) => person.userId !== intent.owner_user_id
  );

  const visibleParticipants = participants.slice(0, 2);
  const hiddenParticipantCount = Math.max(0, participants.length - visibleParticipants.length);

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
      ? "Plan bütçesi"
      : "Tahmini kişi başı maliyet";

  const costValue =
    intent.plan_id
      ? budget === null
        ? "Belirtilmedi"
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

  const detailHref = `/activities/${encodeURIComponent(intent.plan_id ?? intent.resource_id ?? intent.intent_id)}`;
  const editHref = `/intents/${encodeURIComponent(intent.intent_id)}/edit`;
  const rawDate = intent.scheduled_start || intent.start_date;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? new Intl.DateTimeFormat("tr-TR", {timeZone:intent.timezone||"Europe/Istanbul",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(parsedDate)
    : "Tarih netleşmedi";
  const locationLabel = mapLocationLabel || "Konum netleşmedi";
  const isArchived =
    intent.lifecycle_status === "cancelled" ||
    intent.lifecycle_status === "expired";
  const action = isArchived
    ? <Link href={detailHref} className="flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-white/20 bg-slate-700 px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-600">Etkinliği görüntüle</Link>
    : isOwner
    ? <Link href={editHref} className="flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-amber-200 bg-amber-500 px-3 py-2.5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-amber-400">✎ Etkinliği düzenle</Link>
    : intent.viewer_is_member && memberRoomHref
      ? <Link href={memberRoomHref} className="flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-emerald-200 bg-emerald-600 px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700">✓ Etkinliğe katılıyorum</Link>
      : canDisplayJoinAction
        ? <div className="[&_button]:!min-h-11 [&_button]:!w-full [&_button]:!rounded-xl [&_button]:!border-2 [&_button]:!border-violet-300 [&_button]:!bg-violet-600 [&_button]:!px-3 [&_button]:!py-2.5 [&_button]:!text-sm [&_button]:!font-black [&_button]:!text-white [&_button]:!shadow-sm [&_button]:!transition hover:[&_button]:!bg-violet-500">
            <PublicIntentJoinButton
              intentId={intent.intent_id} planId={intent.plan_id} activityName={cardTitle}
              recruitmentStatus={intent.recruitment_status === "full" ? "full" : "open"}
              visibility={intent.visibility} viewerCanRequest={intent.viewer_can_request}
              viewerIsEligible={intent.viewer_is_eligible ?? (intent.viewer_can_request || intent.viewer_is_member)}
              viewerIsMember={intent.viewer_is_member} viewerInvitationStatus={intent.viewer_invitation_status}
              initialRequestStatus={intent.viewer_request_status} initialRequestId={intent.viewer_request_id}
              isAuthenticated={isAuthenticated} />
          </div>
        : <Link href={detailHref} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-black text-white hover:bg-violet-800">Etkinliği aç</Link>;

  return <PersonalLibraryCard
    title={cardTitle}
    coverUrl={coverUrl}
    badge="ETKİNLİK"
    icon={sportPresentation?.icon||"✦"}
    href={detailHref}
    cornerMeta={<span className="flex flex-col items-end gap-1"><CardRatingBadge targetId={commonTarget?.id} compact/><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-violet-800 shadow-sm">{lifecycle.label}</span><span className="rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-bold text-emerald-800 shadow-sm">{intent.visibility==="public"?"Herkese açık":getActivityVisibilityLabel(intent.visibility)}</span></span>}
    summary={<div className="space-y-1.5"><p>📅 {dateLabel}</p><p className="line-clamp-1">📍 {locationLabel}</p><p className="line-clamp-1">Düzenleyen · {ownerName}</p></div>}
    metrics={<div className="grid grid-cols-3 gap-1.5 text-center"><div className="rounded-xl border border-white/15 bg-white/10 p-2"><p className="text-[9px] text-white/70">Katılımcılar</p><b>{participantCount}</b></div><div className="rounded-xl border border-white/15 bg-white/10 p-2"><p className="text-[9px] text-white/70">Kontenjan</p><b>{participantLimit}</b></div><div className="rounded-xl border border-white/15 bg-white/10 p-2"><p className="text-[9px] text-white/70">Durum</p><b className="text-xs">{lifecycle.label}</b></div></div>}
    action={action}
  />;
}
