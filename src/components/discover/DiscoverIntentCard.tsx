import Link from "next/link";
import { commonIntentTitle } from "@/utils/commonIntentTitle";
import { liveSportTitle } from "@/utils/liveSportTitle";
import UinCard, { cardPrimary } from "@/components/cards/UinCard";
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
  return (
    <UinCard title={cardTitle} subtitle={commonTarget ? <Link href={`/intentions/${encodeURIComponent(commonTarget.id)}`} className="font-bold text-emerald-700 hover:underline">▦ UIN kartı: {commonIntentTitle(commonTarget.title)}</Link> : mapLocationLabel || primaryCommunityName}
      category={intent.category_name} icon={sportPresentation?.icon || "♧"} coverUrl={coverUrl}
      href={detailHref} badge={intent.lifecycle_status === "completed" ? "DENEYİM" : "ETKİNLİK"}
      tone={intent.lifecycle_status === "completed" ? "experience" : "plan"}
      badgeExtra={<><span className="rounded-full bg-white/95 px-2 py-1.5 text-[10px] font-semibold text-emerald-800">{intent.visibility === "public" ? "Herkese Açık" : getActivityVisibilityLabel(intent.visibility)}</span>{primaryCommunityName && <span className="max-w-full truncate rounded-full bg-white/95 px-2 py-1.5 text-[10px] font-semibold text-violet-800" title={primaryCommunityName}>{primaryCommunityName}</span>}{intent.sport_name && <span className="rounded-full bg-white/95 px-2 py-1.5 text-[10px] font-semibold text-emerald-800">{intent.sport_name}</span>}</>}
      detailContent={<div className="space-y-4">
        {commonTarget && <div className="space-y-2 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-800">Ana UIN kartı</p><Link href={`/intentions/${encodeURIComponent(commonTarget.id)}`} className="block font-black text-emerald-700 hover:underline">💡 {commonIntentTitle(commonTarget.title)}</Link><p className="text-xs font-black text-gray-500">Etkinliğin adı</p><Link href={detailHref} className="block font-black text-gray-950 hover:text-violet-700">{cardTitle}</Link></div>}
        <p className="rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-950"><span className="font-black">Buluşma adresi:</span> {publicMeetingPoint || "Henüz netleşmedi"}</p>
        <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-950"><span className="font-black">Etkinlik adresi:</span> {mapLocationLabel || "Henüz netleşmedi"}</p>
        <div className="rounded-2xl bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">ETKİNLİK</p><p className="mt-1 font-semibold">{primaryCommunityName || intent.category_name}{intent.sport_name ? ` · ${intent.sport_name}` : ""}</p></div>
        <LifecycleCurrentDate targetStart={intent.start_date} targetEnd={intent.end_date} scheduledStart={intent.scheduled_start} scheduledEnd={intent.scheduled_end} status={intent.lifecycle_status} timezone={intent.timezone} />
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-gray-500">Tahmini kişi başı maliyet</dt><dd>{formatEstimatedCost(intent.budget)}</dd></div><div><dt className="text-gray-500">Kontenjan</dt><dd>{participantCount} / {participantLimit}</dd></div><div><dt className="text-gray-500">Düzenleyen</dt><dd>{ownerName}</dd></div><div><dt className="text-gray-500">Katılım koşulu</dt><dd><ParticipantEligibilityBadge eligibility={intent.participant_eligibility} /></dd></div></dl>
        {relatedLinks.length > 0 && <div><h3 className="font-semibold">Etkinlik ve bilet bağlantıları</h3>{relatedLinks.map(link => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-emerald-700 underline">{link.label || link.url}</a>)}</div>}
        <IntentReactionBar intentId={intent.intent_id} initialContext={intent.reaction_context ?? null} isAuthenticated={isAuthenticated} isOwner={isOwner} variant="detail" />
        <Link href={detailHref} className={cardPrimary}>Tüm etkinlik detayları</Link>
      </div>}
      controls={!isOwner && isAuthenticated ? <UserDiscoveryControlsMenu targetUserId={intent.owner_user_id} targetDisplayName={ownerName} compact /> : null}
      primary={isOwner ? null
        : intent.viewer_is_member && memberRoomHref ? <Link href={memberRoomHref} className="flex min-h-10 w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-100 px-2 text-xs font-black text-amber-800 transition hover:bg-amber-200">✓ Katılıyorum</Link>
        : canDisplayJoinAction ? <div className="[&_button]:!h-10 [&_button]:!min-h-10 [&_button]:!w-full [&_button]:!rounded-xl [&_button]:!px-2 [&_button]:!py-2 [&_button]:!text-[11px] [&_button]:!font-semibold">
          <PublicIntentJoinButton
            intentId={intent.intent_id} planId={intent.plan_id} activityName={cardTitle}
            recruitmentStatus={intent.recruitment_status === "full" ? "full" : "open"}
            visibility={intent.visibility} viewerCanRequest={intent.viewer_can_request}
            viewerIsEligible={intent.viewer_is_eligible ?? (intent.viewer_can_request || intent.viewer_is_member)}
            viewerIsMember={intent.viewer_is_member} viewerInvitationStatus={intent.viewer_invitation_status}
            initialRequestStatus={intent.viewer_request_status} initialRequestId={intent.viewer_request_id}
            isAuthenticated={isAuthenticated} />
        </div> : null}
      secondary={<CompactIntentReactionBar intentId={intent.intent_id} initialContext={intent.reaction_context ?? null} isAuthenticated={isAuthenticated} isOwner={isOwner} card />}>
      <div className="space-y-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-800">
          <span className="shrink-0 font-black">Düzenleyen:</span>
          {ownerProfileHref ? <Link href={ownerProfileHref} className="flex min-w-0 items-center gap-1.5 hover:text-emerald-700 hover:underline" title={ownerName}>{intent.owner_avatar_url ? <img src={intent.owner_avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 font-black">{ownerName.charAt(0)}</span>}<span className="truncate font-semibold">{ownerName}</span></Link> : <span className="flex min-w-0 items-center gap-1.5">{intent.owner_avatar_url ? <img src={intent.owner_avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 font-black">{ownerName.charAt(0)}</span>}<span className="truncate font-semibold">{ownerName}</span></span>}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-800">
          <span className="shrink-0 font-black">Katılımcılar:</span>
          {participants.length > 0 ? <div className="flex min-w-0 items-center gap-2">
            {visibleParticipants.map((person) => {
              const participantName = person.fullName || person.username || "UIN üyesi";
              const participantContent = <>{person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 font-black">{participantName.charAt(0)}</span>}<span className="max-w-24 truncate font-semibold">{participantName}</span></>;
              return person.username ? <Link key={person.userId} href={`/u/${encodeURIComponent(person.username)}`} className="flex min-w-0 items-center gap-1.5 hover:text-emerald-700 hover:underline" title={participantName}>{participantContent}</Link> : <span key={person.userId} className="flex min-w-0 items-center gap-1.5" title={participantName}>{participantContent}</span>;
            })}
            {hiddenParticipantCount > 0 && <details className="relative shrink-0"><summary className="grid h-7 min-w-7 cursor-pointer list-none place-items-center rounded-full bg-violet-50 px-1.5 font-black text-violet-700 hover:bg-violet-100">+{hiddenParticipantCount}</summary><div className="absolute left-0 top-9 z-30 w-56 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Tüm katılımcılar</p>{participants.map((person) => <div key={person.userId} className="flex items-center gap-2 py-1.5">{person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-gray-100 font-black">{(person.fullName || person.username || "?").charAt(0)}</span>}<span className="truncate font-semibold">{person.fullName || person.username || "UIN üyesi"}</span></div>)}</div></details>}
          </div> : <span className="text-gray-500">Katılımcılar bekleniyor</span>}
        </div>
        <p className="truncate text-xs text-cyan-950" title={publicMeetingPoint || "Henüz netleşmedi"}><span className="font-black">Buluşma:</span> {publicMeetingPoint || "Henüz netleşmedi"}</p>
        <p className="truncate text-xs text-blue-950" title={mapLocationLabel || "Henüz netleşmedi"}><span className="font-black">Etkinlik:</span> {mapLocationLabel || "Henüz netleşmedi"}</p>
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-gray-700">
          <LifecycleCurrentDate targetStart={intent.start_date} targetEnd={intent.end_date}
            scheduledStart={intent.scheduled_start} scheduledEnd={intent.scheduled_end}
            completedAt={intent.completed_at} cancelledAt={intent.cancelled_at} expiredAt={intent.expired_at}
            status={intent.lifecycle_status} timezone={intent.timezone} compact />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs">
          <span>{participantCount} katılımcı · {participantLimit === "∞" || participantLimit === "Unlimited" ? "Sınırsız" : `${participantLimit} kişilik`}</span>
          <span className="text-violet-700">{lifecycle.label}</span>
        </div>
      </div>
    </UinCard>
  );
}
