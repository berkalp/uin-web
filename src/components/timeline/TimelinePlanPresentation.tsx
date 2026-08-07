import ActivityLifecycleTimeline from "../activities/ActivityLifecycleTimeline";
import CommunityContextList from "../communities/CommunityContextList";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import PlanWeatherBadges from "../weather/PlanWeatherBadges";
import type {
  IntentCommunityContext,
} from "../../utils/communities";
import type {
  IntentLinkView,
} from "../../utils/intentLinks";

type TimelinePlanMember = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
};

type TimelinePlanPresentationProps = {
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
  members: TimelinePlanMember[];
  participantCount: number;
  participantLimit: string;
  committedBudget: number;
  targetBudget: number | null;
  relationshipLabel: string;
  relationshipClasses: string;
  statusLabel: string;
  statusClasses: string;
  planStatus:
    | "forming"
    | "planned"
    | "completed"
    | "cancelled";
  recruitmentStatus:
    | "open"
    | "full"
    | "closed";
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
  relatedLinks: IntentLinkView[];
  communities: IntentCommunityContext[];
  [key: string]: unknown;
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 2,
    }
  ).format(value);
}

export default function TimelinePlanPresentation({
  planId,
  title,
  canonicalActivityName: _canonicalActivityName,
  categoryName,
  coverUrl,
  countryName,
  city,
  district,
  activityLocationName,
  activityAddressText,
  latitude,
  longitude,
  mapUrl,
  hostName,
  hostAvatarUrl,
  isCurrentUserHost,
  members,
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
  relatedLinks,
  communities,
}: TimelinePlanPresentationProps) {
  // The canonical Activity remains part of the component contract for callers,
  // but a private Shared Plan title replaces it visually instead of being repeated.
  void _canonicalActivityName;

  const hasExactActivityLocation =
    Boolean(
      activityLocationName ||
      activityAddressText ||
      (
        latitude !== null &&
        longitude !== null
      )
    );

  const locationLabel =
    hasExactActivityLocation
      ? [
          activityLocationName,
          activityAddressText,
        ]
          .filter(Boolean)
          .join(", ")
      : [
          district,
          city,
          countryName,
        ]
          .filter(Boolean)
          .join(", ");

  const coordinateQuery =
    hasExactActivityLocation &&
    latitude !== null &&
    longitude !== null
      ? `${latitude},${longitude}`
      : null;

  const mapQuery =
    coordinateQuery ||
    locationLabel;

  const mapEmbedUrl =
    mapQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          mapQuery
        )}&z=${
          hasExactActivityLocation
            ? 15
            : 11
        }&output=embed`
      : null;

  return (
    <div className="min-w-0">
      <div className="relative h-40 overflow-hidden rounded-t-3xl bg-gray-950">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`${title} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-gray-800 to-gray-950" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/35" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${statusClasses}`}
            >
              {statusLabel}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${relationshipClasses}`}
            >
              {relationshipLabel}
            </span>
          </div>

          {recruitmentStatus !==
            "open" && (
            <span className="rounded-full bg-gray-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {recruitmentStatus}
            </span>
          )}
        </div>

        {planStatus === "planned" && (
          <PlanWeatherBadges
            planId={planId}
            className="absolute right-3 top-12 z-10"
          />
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-blue-300">
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
              windowStart
            }
            targetEnd={
              windowEnd
            }
            scheduledStart={
              scheduledStart
            }
            scheduledEnd={
              scheduledEnd
            }
            completedAt={
              completedAt
            }
            cancelledAt={
              cancelledAt
            }
            expiredAt={
              expiredAt
            }
            status={
              planStatus
            }
            timezone={
              timezone
            }
            variant="compact"
          />
        </div>

        <div className="relative min-h-[184px] overflow-hidden border-l border-black/5 bg-gray-100">
          {mapEmbedUrl ? (
            <iframe
              title={`${title} location`}
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

          {mapEmbedUrl && (
            <span className="absolute bottom-2 left-2 max-w-[150px] truncate rounded-full bg-gray-950/80 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">
              {hasExactActivityLocation
                ? "Activity location"
                : "Approximate area"}
            </span>
          )}

          {mapUrl && (
            <a
              href={
                mapUrl
              }
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="absolute bottom-2 right-2 rounded-lg bg-white px-2 py-1 text-[9px] font-bold text-blue-700 shadow"
            >
              Map ↗
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 text-xs">
        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Participants
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {participantCount} / {participantLimit}
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
            Committed
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {formatMoney(
              committedBudget
            )} TL
          </p>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-2.5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Target
          </p>

          <p className="mt-1 truncate font-bold text-gray-950">
            {targetBudget ===
            null
              ? "Not set"
              : `${formatMoney(
                  targetBudget
                )} TL`}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
          <div className="flex min-w-0 items-center gap-2">
            {hostAvatarUrl ? (
              <img
                src={
                  hostAvatarUrl
                }
                alt={
                  hostName
                }
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-700">
                {hostName
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-gray-950">
                {hostName}
              </p>

              <p className="text-[9px] uppercase tracking-wide text-gray-400">
                {isCurrentUserHost
                  ? "Hosted by you"
                  : "Host"}
              </p>
            </div>
          </div>

          <div className="flex -space-x-2">
            {members
              .slice(0, 4)
              .map(
                (member) =>
                  member.avatarUrl ? (
                    <img
                      key={
                        member.id
                      }
                      src={
                        member.avatarUrl
                      }
                      alt={
                        member.fullName ??
                        "Member"
                      }
                      className="h-7 w-7 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <div
                      key={
                        member.id
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[9px] font-bold text-gray-600"
                    >
                      {(member.fullName ??
                        "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )
              )}
          </div>
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
