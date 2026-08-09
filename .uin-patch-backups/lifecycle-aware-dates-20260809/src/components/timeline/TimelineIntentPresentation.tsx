import ActivityLifecycleTimeline from "../activities/ActivityLifecycleTimeline";
import CommunityContextList from "../communities/CommunityContextList";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import {
  resolveActivityCover,
} from "../../utils/activityCover";
import {
  formatEstimatedCost,
} from "../../utils/estimatedCost";
import {
  getSportPresentation,
} from "../../utils/sportPresentation";
import type {
  IntentCommunityContext,
} from "../../utils/communities";
import type {
  IntentLinkView,
} from "../../utils/intentLinks";
import IntentWeatherBadge from "../weather/IntentWeatherBadge";

type TimelineIntentPresentationProps = {
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
  lifecycleStatus:
    | "open"
    | "future"
    | "forming"
    | "planned"
    | "closed"
    | "completed"
    | "cancelled"
    | "expired";
  expiredAt: string | null;
  intentType: string;
  statusLabel: string;
  statusClasses: string;
  recruitmentStatus:
    | "open"
    | "full"
    | "closed";
  matchingStatus:
    | "open"
    | "paused"
    | "matched"
    | "closed";
  requestCount: number;
  participantLimit: string;
  budget: number | null;
  visibilityLabel: string;
  people: string;
  recurrence: string;
  relatedLinks: IntentLinkView[];
  communities: IntentCommunityContext[];
  sportName?: string | null;
  [key: string]: unknown;
};

function getLocationLabel({
  district,
  city,
  countryName,
}: {
  district: string | null;
  city: string | null;
  countryName: string | null;
}) {
  return [
    district,
    city,
    countryName,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function TimelineIntentPresentation({
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
}: TimelineIntentPresentationProps) {
  const coverUrl =
    resolveActivityCover({
      planCoverUrl: null,
      activityCoverUrl,
      categoryCoverUrl,
      categoryName,
      activityName: title,
    });

  const locationLabel =
    getLocationLabel({
      district,
      city,
      countryName,
    });

  const mapEmbedUrl =
    locationLabel
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          locationLabel
        )}&z=10&output=embed`
      : null;

  const sportPresentation =
    sportName
      ? getSportPresentation(
          sportName
        )
      : null;

  return (
    <div className="min-w-0">
      <div className="relative h-36 overflow-hidden rounded-t-3xl bg-gray-950">
        <img
          src={coverUrl}
          alt={`${title} cover`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/35" />

        <div className="absolute inset-x-3 top-3 flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${statusClasses}`}
            >
              {statusLabel}
            </span>

            {recruitmentStatus !==
              "open" && (
              <span className="rounded-full bg-gray-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                {recruitmentStatus}
              </span>
            )}

            {matchingStatus !==
              "open" && (
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-700">
                Matching {matchingStatus}
              </span>
            )}
          </div>

          {sportPresentation && (
            <span
              className="inline-flex max-w-[48%] shrink-0 items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] shadow-sm"
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
                {sportName}
              </span>
            </span>
          )}
        </div>

        {(lifecycleStatus === "open" || lifecycleStatus === "future" || lifecycleStatus === "forming") && (
          <IntentWeatherBadge
            intentId={intentId}
            className="absolute right-3 top-12 z-10"
          />
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-green-300">
            {categoryName}
          </p>

          <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-tight text-white">
            {title}
          </h2>

          <CommunityContextList
            communities={
              communities
            }
            variant="card"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-black/5">
        <div className="min-w-0 p-4">
          <ActivityLifecycleTimeline
            targetStart={
              startDate
            }
            targetEnd={
              endDate
            }
            scheduledStart={
              null
            }
            scheduledEnd={
              null
            }
            completedAt={
              lifecycleStatus ===
              "completed"
                ? endDate
                : null
            }
            cancelledAt={
              lifecycleStatus ===
              "cancelled"
                ? endDate
                : null
            }
            expiredAt={
              expiredAt
            }
            status={
              lifecycleStatus
            }
            timezone="Europe/Istanbul"
            variant="compact"
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
            Capacity
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            0 / {participantLimit}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Visibility
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {visibilityLabel}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Preference
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {people}
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Est. cost / person
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {formatEstimatedCost(
              budget,
              {
                includePerPerson:
                  false,
              }
            )}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
          <span className="capitalize">
            {intentType.replace(
              /-/g,
              " "
            )} Intent
          </span>

          <span>
            Recurrence: {recurrence}
          </span>
        </div>

        {requestCount > 0 && (
          <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            {requestCount} request
            {requestCount ===
            1
              ? ""
              : "s"} waiting
          </p>
        )}

        {relatedLinks.length >
          0 && (
          <div className="mt-3">
            <IntentLinksDisplay
              links={
                relatedLinks
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
