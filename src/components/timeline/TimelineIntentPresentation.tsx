import Link from "next/link";

import ActivityLifecycleTimeline from "../activities/ActivityLifecycleTimeline";
import LifecycleCurrentDate from "../activities/LifecycleCurrentDate";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import IntentWeatherBadge from "../weather/IntentWeatherBadge";
import { resolveActivityCover } from "../../utils/activityCover";
import { formatEstimatedCost } from "../../utils/estimatedCost";
import { getSportPresentation } from "../../utils/sportPresentation";
import type { IntentCommunityContext } from "../../utils/communities";
import type { IntentLinkView } from "../../utils/intentLinks";

export type TimelineIntentPresentationProps = {
  detailToggleId: string;
  intentId: string;
  title: string;
  categoryName: string;
  activityCoverUrl: string | null;
  categoryCoverUrl: string | null;
  countryName: string | null;
  locationScope: string | null;
  city: string | null;
  district: string | null;
  startDate: string;
  endDate: string;
  lifecycleStatus: "open" | "future" | "forming" | "planned" | "closed" | "completed" | "cancelled" | "expired";
  expiredAt: string | null;
  intentType: string;
  statusLabel: string;
  statusClasses: string;
  recruitmentStatus: "open" | "full" | "closed";
  matchingStatus: "open" | "paused" | "matched" | "closed";
  requestCount: number;
  participantLimit: string;
  budget: number | null;
  visibilityLabel: string;
  people: string;
  recurrence: string;
  relatedLinks: IntentLinkView[];
  communities: IntentCommunityContext[];
  sportName?: string | null;
  journeySummary?: { text: string; href: string | null } | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export default function TimelineIntentPresentation(props: TimelineIntentPresentationProps) {
  const {
    intentId,
    title,
    categoryName,
    activityCoverUrl,
    categoryCoverUrl,
    countryName,
    city,
    district,
    startDate,
    endDate,
    lifecycleStatus,
    expiredAt,
    intentType,
    statusLabel,
    statusClasses,
    recruitmentStatus,
    matchingStatus,
    requestCount,
    participantLimit,
    budget,
    visibilityLabel,
    people,
    recurrence,
    relatedLinks,
    communities,
    sportName = null,
    journeySummary = null,
    ownerName,
    ownerAvatarUrl,
    notes = null,
  } = props;

  const coverUrl = resolveActivityCover({
    planCoverUrl: null,
    activityCoverUrl,
    categoryCoverUrl,
    categoryName,
    activityName: title,
  });
  const locationLabel = [district, city, countryName].filter(Boolean).join(", ");
  const mapEmbedUrl = locationLabel
    ? `https://www.google.com/maps?q=${encodeURIComponent(locationLabel)}&z=10&output=embed`
    : null;
  const sportPresentation = sportName ? getSportPresentation(sportName) : null;
  const primaryCommunity = communities.find((item) => item.isPrimary) ?? communities[0] ?? null;

  return (
    <>
      <div className="relative h-[128px] shrink-0 overflow-hidden bg-gray-950">
        <img src={coverUrl} alt={`${title} cover`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/45" />

        <div className="absolute inset-x-3 top-3 flex min-w-0 items-start justify-between gap-2">
          <div className="flex max-w-[72%] min-w-0 flex-wrap items-center gap-1.5">
            <span className={`inline-flex h-5 items-center rounded-full px-2 text-[8.5px] font-bold uppercase leading-none tracking-[0.04em] ${statusClasses}`}>
              {statusLabel}
            </span>
            {recruitmentStatus !== "open" && (
              <span className="inline-flex h-5 items-center rounded-full bg-gray-950/80 px-2 text-[8.5px] font-semibold uppercase leading-none text-white">
                {recruitmentStatus}
              </span>
            )}
          </div>

          {sportPresentation && (
            <span
              className="inline-flex h-5 max-w-[42%] items-center gap-1 truncate rounded-full border px-2 text-[8.5px] font-bold uppercase leading-none"
              style={{
                backgroundColor: sportPresentation.backgroundColor,
                borderColor: sportPresentation.borderColor,
                color: sportPresentation.textColor,
              }}
            >
              {sportPresentation.icon} <span className="truncate">{sportName}</span>
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
          <p className="h-3 truncate text-[9px] font-bold uppercase tracking-[0.11em] text-green-300">
            {categoryName}
          </p>
          <div className="mt-0.5 flex h-[38px] min-w-0 items-end justify-between gap-2">
            <h2 className="min-w-0 flex-1 line-clamp-2 text-[17px] font-bold leading-[1.12] text-white">
              {title}
            </h2>
            {(lifecycleStatus === "open" || lifecycleStatus === "future" || lifecycleStatus === "forming") && (
              <div className="mb-0.5 shrink-0">
                <IntentWeatherBadge intentId={intentId} compact />
              </div>
            )}
          </div>
          <div className="mt-1 flex h-6 min-w-0 items-center">
            {primaryCommunity ? (
              <Link
                href={`/communities/${encodeURIComponent(primaryCommunity.slug)}`}
                className="inline-flex min-w-0 max-w-[74%] items-center gap-1.5 rounded-full border bg-white/95 px-1.5 py-0.5 text-[8.5px] font-semibold text-gray-900"
                style={{ borderColor: primaryCommunity.accentColor }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: primaryCommunity.accentColor }} />
                <span className="truncate">{primaryCommunity.name}</span>
              </Link>
            ) : (
              <span aria-hidden="true" className="block h-6 w-1" />
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col peer-checked:hidden">
        <div className="shrink-0 border-b border-black/5 px-2.5 py-2">
          <LifecycleCurrentDate
            targetStart={startDate}
            targetEnd={endDate}
            completedAt={lifecycleStatus === "completed" ? endDate : null}
            cancelledAt={lifecycleStatus === "cancelled" ? endDate : null}
            expiredAt={expiredAt}
            status={lifecycleStatus}
            timezone="Europe/Istanbul"
            compact
            className="w-full"
          />
        </div>

        <div className="relative h-[118px] shrink-0 overflow-hidden border-b border-black/5 bg-gray-100">
          {mapEmbedUrl ? (
            <iframe
              title={`${title} approximate area`}
              src={mapEmbedUrl}
              className="pointer-events-none absolute -top-9 left-0 h-[calc(100%+36px)] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              tabIndex={-1}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-gray-400">No map</div>
          )}
          {locationLabel && (
            <span className="absolute bottom-2 left-2 max-w-[78%] truncate rounded-full bg-gray-950/80 px-2 py-0.5 text-[8.5px] font-semibold text-white">
              ≈ {locationLabel}
            </span>
          )}
        </div>

        <div className="flex h-[52px] shrink-0 min-w-0 items-center justify-between gap-3 border-b border-black/5 px-3">
          <div className="flex min-w-0 items-center gap-2">
            {ownerAvatarUrl ? (
              <img src={ownerAvatarUrl} alt={ownerName} className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-[10px] font-semibold text-green-700">
                {initials(ownerName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold leading-tight text-gray-950">{ownerName}</p>
              <p className="mt-0.5 text-[9px] font-medium text-gray-400">Host</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm">
            0 / {participantLimit}
          </span>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white/85 px-2.5 py-2 peer-checked:block">
        <ActivityLifecycleTimeline
          targetStart={startDate}
          targetEnd={endDate}
          completedAt={lifecycleStatus === "completed" ? endDate : null}
          cancelledAt={lifecycleStatus === "cancelled" ? endDate : null}
          expiredAt={expiredAt}
          status={lifecycleStatus}
          timezone="Europe/Istanbul"
          variant="compact"
          hideCompactTitle
        />

        <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9.5px]">
          {[
            ["Capacity", `0 / ${participantLimit}`],
            ["Visibility", visibilityLabel],
            ["Preference", people],
            ["Est. cost / person", formatEstimatedCost(budget, { includePerPerson: false })],
            ["Intent type", intentType.replace(/-/g, " ")],
            ["Recurrence", recurrence],
            ["Recruitment", recruitmentStatus],
            ["Matching", matchingStatus],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-gray-400">{label}</p>
              <p className="mt-0.5 truncate font-semibold capitalize text-gray-950">{value}</p>
            </div>
          ))}
        </div>

        {journeySummary && (
          journeySummary.href ? (
            <Link href={journeySummary.href} className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[9px] font-semibold text-emerald-800">
              <span className="min-w-0 truncate">↺ {journeySummary.text}</span><span>→</span>
            </Link>
          ) : (
            <div className="mt-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[9px] font-semibold text-emerald-800">↺ {journeySummary.text}</div>
          )
        )}

        {notes?.trim() && (
          <div className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-1.5">
            <p className="text-[7.5px] font-semibold uppercase text-blue-500">Note</p>
            <p className="mt-0.5 line-clamp-3 text-[9.5px] leading-3.5 text-gray-700">{notes.trim()}</p>
          </div>
        )}

        {relatedLinks.length > 0 && (
          <div className="mt-1.5"><IntentLinksDisplay links={relatedLinks} /></div>
        )}

        {requestCount > 0 && (
          <p className="mt-1.5 rounded-lg bg-green-50 px-2 py-1.5 text-[9px] font-semibold text-green-700">
            {requestCount} request{requestCount === 1 ? "" : "s"} waiting
          </p>
        )}
      </div>
    </>
  );
}
