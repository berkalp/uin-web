import type { ReactNode } from "react";
import Link from "next/link";

import ActivityLifecycleTimeline from "../activities/ActivityLifecycleTimeline";
import LifecycleCurrentDate from "../activities/LifecycleCurrentDate";
import ActivityPeopleStrip from "../activities/ActivityPeopleStrip";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import PlanWeatherBadges from "../weather/PlanWeatherBadges";
import type { IntentCommunityContext } from "../../utils/communities";
import type { IntentLinkView } from "../../utils/intentLinks";
import type { ActivityPersonView } from "../../utils/activityPeople";

export type TimelinePlanPresentationProps = {
  detailToggleId: string;
  planId: string;
  title: string;
  canonicalActivityName: string;
  categoryName: string;
  coverUrl: string | null;
  countryName: string | null;
  locationScope: string | null;
  city: string | null;
  district: string | null;
  activityLocationName: string | null;
  activityAddressText: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  mapUrl: string | null;
  hostName: string;
  hostAvatarUrl: string | null;
  isCurrentUserHost: boolean;
  people: ActivityPersonView[];
  currentUserId: string;
  activityHref: string;
  participantCount: number;
  participantLimit: string;
  committedBudget: number;
  targetBudget: number | null;
  relationshipLabel: string;
  relationshipClasses: string;
  statusLabel: string;
  statusClasses: string;
  planStatus: "forming" | "planned" | "completed" | "cancelled";
  recruitmentStatus: "open" | "full" | "closed";
  requestCount: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  timezone: string;
  windowStart: string;
  windowEnd: string;
  completedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  visibilityLabel: string;
  recurrence: string;
  relatedLinks: IntentLinkView[];
  communities: IntentCommunityContext[];
  notes?: string | null;
  attendanceLabel?: string | null;
  attendanceClasses?: string;
  detailExtra?: ReactNode;
  meetingPoint?: string | null;
  meetingAddressText?: string | null;
  meetingLocationSameAsActivity?: boolean;
  activityLocationVisibility?: "members" | "public" | null;
  scheduleNotes?: string | null;
  plannedAt?: string | null;
  createdAt?: string | null;
  sourceIntentLabel?: string | null;
  sourceIntentHref?: string | null;
  [key: string]: unknown;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function readableChoice(value: string | null | undefined) {
  if (!value) return "Belirtilmedi";
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    open: "Açık",
    full: "Dolu",
    closed: "Kapalı",
    members: "Üyeler",
    public: "Herkes",
    "one-time": "Tek seferlik",
    one_time: "Tek seferlik",
    host: "Host",
    co_host: "Co-host",
    participant: "Katılımcı",
  };
  return known[normalized] ?? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null | undefined, timezone: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: timezone || "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
      <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-gray-950" title={value}>{value}</p>
    </div>
  );
}

export default function TimelinePlanPresentation(props: TimelinePlanPresentationProps) {
  const {
    planId,
    title,
    canonicalActivityName,
    categoryName,
    coverUrl,
    countryName,
    locationScope,
    city,
    district,
    activityLocationName,
    activityAddressText,
    latitude,
    longitude,
    mapUrl,
    hostName,
    people,
    currentUserId,
    activityHref,
    participantCount,
    participantLimit,
    committedBudget,
    targetBudget,
    relationshipLabel,
    relationshipClasses,
    statusLabel,
    statusClasses,
    planStatus,
    recruitmentStatus,
    requestCount,
    scheduledStart,
    scheduledEnd,
    timezone,
    windowStart,
    windowEnd,
    completedAt,
    cancelledAt,
    expiredAt,
    visibilityLabel,
    recurrence,
    relatedLinks,
    communities,
    notes = null,
    attendanceLabel = null,
    attendanceClasses = "bg-green-50 text-green-700",
    detailExtra = null,
    meetingPoint = null,
    meetingAddressText = null,
    meetingLocationSameAsActivity = false,
    activityLocationVisibility = null,
    scheduleNotes = null,
    plannedAt = null,
    createdAt = null,
    sourceIntentLabel = null,
    sourceIntentHref = null,
  } = props;

  const exact = Boolean(activityLocationName || activityAddressText || (latitude !== null && longitude !== null));
  const locationLabel = exact
    ? [activityLocationName, activityAddressText].filter(Boolean).join(", ")
    : [district, city, countryName].filter(Boolean).join(", ");
  const query = exact && latitude !== null && longitude !== null ? `${latitude},${longitude}` : locationLabel;
  const mapEmbedUrl = query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${exact ? 15 : 11}&output=embed` : null;
  const primaryCommunity = communities.find((community) => community.isPrimary) ?? communities[0] ?? null;
  const meetingLabel = meetingLocationSameAsActivity
    ? "Aktivite konumuyla aynı"
    : [meetingPoint, meetingAddressText].filter(Boolean).join(", ") || "Belirlenmedi";
  const createdLabel = formatDateTime(createdAt, timezone);
  const plannedLabel = formatDateTime(plannedAt, timezone);

  return (
    <>
      <div className="relative h-[128px] shrink-0 overflow-hidden bg-gray-950">
        {coverUrl ? (
          <img src={coverUrl} alt={`${title} cover`} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full bg-gradient-to-br from-gray-800 to-gray-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/45" />
        <div className="absolute inset-x-3 top-3 flex min-w-0 items-start justify-between gap-2">
          <div className="flex max-w-[76%] min-w-0 flex-wrap items-center gap-1.5">
            <span className={`inline-flex h-5 items-center rounded-full px-2 text-[8.5px] font-bold uppercase leading-none ${statusClasses}`}>{statusLabel}</span>
            <span className={`inline-flex h-5 max-w-[130px] items-center truncate rounded-full px-2 text-[8.5px] font-semibold uppercase leading-none ${relationshipClasses}`}>{relationshipLabel}</span>
          </div>
          {recruitmentStatus !== "open" && (
            <span className="inline-flex h-5 items-center rounded-full bg-black/70 px-2 text-[8.5px] font-semibold uppercase leading-none text-white">{readableChoice(recruitmentStatus)}</span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
          <p className="h-3 truncate text-[9px] font-bold uppercase tracking-[0.11em] text-green-300">{categoryName}</p>
          <div className="mt-0.5 flex h-[38px] min-w-0 items-end justify-between gap-2">
            <h2 className="min-w-0 flex-1 line-clamp-2 text-[17px] font-bold leading-[1.12] text-white">{title}</h2>
            {planStatus === "planned" && <div className="mb-0.5 shrink-0"><PlanWeatherBadges planId={planId} compact /></div>}
          </div>
          <div className="mt-1 flex h-6 min-w-0 items-center">
            {primaryCommunity ? (
              <Link href={`/communities/${encodeURIComponent(primaryCommunity.slug)}`} className="inline-flex min-w-0 max-w-[74%] items-center gap-1.5 rounded-full border bg-white/95 px-1.5 py-0.5 text-[8.5px] font-semibold text-gray-900" style={{ borderColor: primaryCommunity.accentColor }}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: primaryCommunity.accentColor }} />
                <span className="truncate">{primaryCommunity.name}</span>
              </Link>
            ) : <span aria-hidden="true" className="block h-6 w-1" />}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col peer-checked:hidden">
        <div className="shrink-0 border-b border-black/5 px-2.5 py-2">
          <LifecycleCurrentDate
            targetStart={windowStart}
            targetEnd={windowEnd}
            scheduledStart={scheduledStart}
            scheduledEnd={scheduledEnd}
            completedAt={completedAt}
            cancelledAt={cancelledAt}
            expiredAt={expiredAt}
            status={planStatus}
            timezone={timezone}
            compact
            className="w-full"
          />
        </div>

        <div className="relative h-[118px] shrink-0 overflow-hidden border-b border-black/5 bg-gray-100">
          {mapEmbedUrl ? (
            <iframe title={`${title} location`} src={mapEmbedUrl} className="pointer-events-none absolute -top-9 left-0 h-[calc(100%+36px)] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" tabIndex={-1} />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-gray-400">No map</div>
          )}
          {locationLabel && <span className="absolute bottom-2 left-2 max-w-[78%] truncate rounded-full bg-gray-950/80 px-2 py-0.5 text-[8.5px] font-semibold text-white">{exact ? "📍" : "≈"} {locationLabel}</span>}
          {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer nofollow" className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-[8.5px] font-semibold text-blue-700 shadow-sm">Harita ↗</a>}
        </div>

        <div className="flex h-[52px] shrink-0 min-w-0 items-center justify-between gap-2 border-b border-black/5 px-3">
          <div className="min-w-0 flex-1">
            <ActivityPeopleStrip people={people} currentUserId={currentUserId} activityHref={activityHref} variant="compact" maxVisible={4} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {attendanceLabel && <span className={`inline-flex h-6 items-center rounded-full px-2 text-[9px] font-bold ${attendanceClasses}`}>{attendanceLabel}</span>}
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm">{participantCount} / {participantLimit}</span>
          </div>
        </div>
      </div>

      {/* Discover parity: same lifecycle + metrics + context + notes + links, then Timeline-only plan detail. */}
      <div className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white/85 px-2.5 py-2 peer-checked:block">
        <ActivityLifecycleTimeline
          targetStart={windowStart}
          targetEnd={windowEnd}
          scheduledStart={scheduledStart}
          scheduledEnd={scheduledEnd}
          completedAt={completedAt}
          cancelledAt={cancelledAt}
          expiredAt={expiredAt}
          status={planStatus}
          timezone={timezone}
          variant="compact"
          hideCompactTitle
        />

        <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9.5px]">
          <DetailMetric label="Katılımcılar" value={`${participantCount} / ${participantLimit}`} />
          <DetailMetric label="Görünürlük" value={visibilityLabel} />
          <DetailMetric label="Tekrar" value={readableChoice(recurrence)} />
          <DetailMetric label="Plan bütçesi" value={targetBudget === null ? `${money(committedBudget)} TL` : `${money(targetBudget)} TL`} />
        </div>

        {(primaryCommunity || locationLabel) && (
          <div className="mt-1 flex min-w-0 gap-1 overflow-hidden">
            {primaryCommunity && (
              <Link
                href={`/communities/${encodeURIComponent(primaryCommunity.slug)}`}
                className="inline-flex min-w-0 max-w-[58%] items-center gap-1 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[8.5px] font-semibold text-green-800 transition hover:bg-green-100"
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: primaryCommunity.accentColor }} />
                <span className="truncate">{primaryCommunity.name}</span>
                {communities.length > 1 && <span className="shrink-0 text-green-600">+{communities.length - 1}</span>}
              </Link>
            )}

            {locationLabel && (
              <span className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[8.5px] font-medium text-gray-600">
                <span aria-hidden="true">{exact ? "📍" : "≈"}</span>
                <span className="truncate">{locationLabel}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-1.5 rounded-xl border border-gray-100 bg-gray-50/70 p-2">
          <p className="text-[7.5px] font-bold uppercase tracking-[0.08em] text-gray-400">Plan / Aktivite detayları</p>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[9.5px]">
            <DetailMetric label="Rolün" value={relationshipLabel} />
            <DetailMetric label="Katılım" value={attendanceLabel ?? "Aktif"} />
            <DetailMetric label="Katılım alımı" value={readableChoice(recruitmentStatus)} />
            <DetailMetric label="Bekleyen istek" value={String(requestCount)} />
            <DetailMetric label="Host" value={hostName} />
            <DetailMetric label="Konum görünürlüğü" value={readableChoice(activityLocationVisibility)} />
            <DetailMetric label="Konum kapsamı" value={readableChoice(locationScope)} />
            <DetailMetric label="Aktivite" value={canonicalActivityName} />
          </div>
        </div>

        <div className="mt-1.5 grid gap-1">
          <div className="rounded-lg border border-gray-100 bg-white px-2 py-1.5">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">Aktivite konumu</p>
            <p className="mt-0.5 text-[9.5px] font-semibold leading-4 text-gray-800">{locationLabel || "Belirlenmedi"}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white px-2 py-1.5">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">Buluşma noktası</p>
            <p className="mt-0.5 text-[9.5px] font-semibold leading-4 text-gray-800">{meetingLabel}</p>
          </div>
          {scheduleNotes?.trim() && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-1.5">
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-amber-600">Planlama notu</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[9.5px] leading-4 text-gray-700">{scheduleNotes.trim()}</p>
            </div>
          )}
        </div>

        {notes?.trim() && (
          <div className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-1.5">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-blue-500">Not</p>
            <p className="mt-0.5 whitespace-pre-wrap text-[9.5px] leading-3.5 text-gray-700">{notes.trim()}</p>
          </div>
        )}

        <div className="mt-1.5 rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-[8.5px] text-gray-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{relatedLinks.length} bağlantı</span>
            {createdLabel && <span>Oluşturuldu · {createdLabel}</span>}
            {plannedLabel && <span>Planlandı · {plannedLabel}</span>}
          </div>
          {sourceIntentLabel && (
            sourceIntentHref ? (
              <Link href={sourceIntentHref} className="mt-1 block truncate font-semibold text-emerald-700 hover:text-emerald-800">Kaynak Niyet · {sourceIntentLabel} ↗</Link>
            ) : (
              <p className="mt-1 truncate font-semibold text-emerald-700">Kaynak Niyet · {sourceIntentLabel}</p>
            )
          )}
        </div>

        {relatedLinks.length > 0 && (
          <div className="mt-1.5">
            <IntentLinksDisplay links={relatedLinks} />
          </div>
        )}

        {detailExtra}
      </div>
    </>
  );
}
