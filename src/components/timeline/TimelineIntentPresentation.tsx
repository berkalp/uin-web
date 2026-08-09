import Link from "next/link";

import LifecycleCurrentDate from "../activities/LifecycleCurrentDate";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import IntentWeatherBadge from "../weather/IntentWeatherBadge";
import { resolveActivityCover } from "../../utils/activityCover";
import { formatEstimatedCost } from "../../utils/estimatedCost";
import { getSportPresentation } from "../../utils/sportPresentation";
import type { IntentCommunityContext } from "../../utils/communities";
import type { IntentLinkView } from "../../utils/intentLinks";

type TimelineIntentPresentationProps = {
  intentId: string; title: string; categoryName: string; activityCoverUrl: string | null;
  categoryCoverUrl: string | null; countryName: string | null; locationScope: string | null;
  city: string | null; district: string | null; startDate: string; endDate: string;
  lifecycleStatus: "open" | "future" | "forming" | "planned" | "closed" | "completed" | "cancelled" | "expired";
  expiredAt: string | null; intentType: string; statusLabel: string; statusClasses: string;
  recruitmentStatus: "open" | "full" | "closed"; matchingStatus: "open" | "paused" | "matched" | "closed";
  requestCount: number; participantLimit: string; budget: number | null; visibilityLabel: string;
  people: string; recurrence: string; relatedLinks: IntentLinkView[]; communities: IntentCommunityContext[];
  sportName?: string | null; [key: string]: unknown;
};

export default function TimelineIntentPresentation(props: TimelineIntentPresentationProps) {
  const { intentId, title, categoryName, activityCoverUrl, categoryCoverUrl, countryName, city, district,
    startDate, endDate, lifecycleStatus, expiredAt, intentType, statusLabel, statusClasses, recruitmentStatus,
    matchingStatus, requestCount, participantLimit, budget, visibilityLabel, people, recurrence, relatedLinks,
    communities, sportName = null } = props;

  const coverUrl = resolveActivityCover({ planCoverUrl: null, activityCoverUrl, categoryCoverUrl, categoryName, activityName: title });
  const locationLabel = [district, city, countryName].filter(Boolean).join(", ");
  const mapEmbedUrl = locationLabel ? `https://www.google.com/maps?q=${encodeURIComponent(locationLabel)}&z=10&output=embed` : null;
  const sportPresentation = sportName ? getSportPresentation(sportName) : null;
  const primaryCommunity = communities.find((item) => item.isPrimary) ?? communities[0] ?? null;

  return (
    <div className="min-w-0">
      <div className="relative h-32 overflow-hidden rounded-t-3xl bg-gray-950">
        <img src={coverUrl} alt={`${title} cover`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          <div className="flex min-w-0 gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${statusClasses}`}>{statusLabel}</span>
            {recruitmentStatus !== "open" && <span className="rounded-full bg-black/65 px-2 py-0.5 text-[8px] font-semibold uppercase text-white">{recruitmentStatus}</span>}
          </div>
          {sportPresentation && (
            <span className="inline-flex max-w-[42%] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[8px] font-semibold" style={{ backgroundColor: sportPresentation.backgroundColor, borderColor: sportPresentation.borderColor, color: sportPresentation.textColor }}>
              {sportPresentation.icon} <span className="truncate">{sportName}</span>
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5">
          <p className="truncate text-[8px] font-bold uppercase tracking-[0.11em] text-green-300">{categoryName}</p>
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <h2 className="min-w-0 flex-1 line-clamp-2 text-[16px] font-bold leading-[1.1] text-white">{title}</h2>
            {(lifecycleStatus === "open" || lifecycleStatus === "future" || lifecycleStatus === "forming") && <IntentWeatherBadge intentId={intentId} compact />}
          </div>
          <div className="mt-1 h-5">
            {primaryCommunity && (
              <Link href={`/communities/${encodeURIComponent(primaryCommunity.slug)}`} className="inline-flex max-w-[72%] items-center gap-1 rounded-full border bg-white/95 px-2 py-0.5 text-[8.5px] font-semibold text-gray-900" style={{ borderColor: primaryCommunity.accentColor }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryCommunity.accentColor }} />
                <span className="truncate">{primaryCommunity.name}</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-black/5 p-2">
        <LifecycleCurrentDate targetStart={startDate} targetEnd={endDate} completedAt={lifecycleStatus === "completed" ? endDate : null} cancelledAt={lifecycleStatus === "cancelled" ? endDate : null} expiredAt={expiredAt} status={lifecycleStatus} timezone="Europe/Istanbul" compact className="w-full" />
      </div>

      <div className="relative h-28 overflow-hidden border-b border-black/5 bg-gray-100">
        {mapEmbedUrl ? <iframe title={`${title} approximate area`} src={mapEmbedUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="flex h-full items-center justify-center text-[10px] text-gray-400">No map</div>}
        {locationLabel && <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-full bg-gray-950/80 px-2 py-1 text-[8.5px] font-semibold text-white">📍 {locationLabel}</span>}
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-2 text-[10px]">
        {[
          ["Capacity", `0 / ${participantLimit}`],
          ["Visibility", visibilityLabel],
          ["Preference", people],
          ["Est. cost / person", formatEstimatedCost(budget, { includePerPerson: false })],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
            <p className="truncate text-[7.5px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-0.5 truncate font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="px-2 pb-2">
        <div className="flex items-center justify-between gap-2 text-[8.5px] text-gray-500">
          <span className="truncate capitalize">{intentType.replace(/-/g, " ")} Intent</span>
          <span className="shrink-0">Repeat · {recurrence}</span>
        </div>
        {requestCount > 0 && <p className="mt-1.5 rounded-lg bg-green-50 px-2 py-1.5 text-[9px] font-semibold text-green-700">{requestCount} request{requestCount === 1 ? "" : "s"} waiting</p>}
        {relatedLinks.length > 0 && <div className="mt-1.5"><IntentLinksDisplay links={relatedLinks} /></div>}
      </div>
    </div>
  );
}
