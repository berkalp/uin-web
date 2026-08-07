"use client";

import { useEffect, useMemo, useState } from "react";

import { resolveActivityCover } from "../../utils/activityCover";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import type { IntentLinkView } from "../../utils/intentLinks";

type TimelinePlanMemberPreview = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "host" | "co_host" | "participant";
};

type TimelinePlanPresentationProps = {
  title: string;
  categoryName: string;
  coverUrl: string | null;
  city: string | null;
  district: string | null;
  meetingPoint: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  mapUrl: string | null;
  hostName: string;
  hostAvatarUrl: string | null;
  isCurrentUserHost: boolean;
  members: TimelinePlanMemberPreview[];
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
  recruitmentStatus: string;
  requestCount: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  timezone: string;
  windowStart: string;
  windowEnd: string;
  visibilityLabel: string;
  relatedLinks?: IntentLinkView[];
};

type CountdownState = {
  label: string;
  toneClasses: string;
};

function getInitial(
  value: string | null | undefined
) {
  return (
    value
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function toCoordinate(
  value: number | string | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : null;
}

function formatBudget(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatDuration(
  milliseconds: number
) {
  const totalMinutes = Math.max(
    Math.floor(
      milliseconds / 60000
    ),
    0
  );

  if (totalMinutes < 1) {
    return "less than a minute";
  }

  const days = Math.floor(
    totalMinutes / 1440
  );

  const hours = Math.floor(
    (totalMinutes % 1440) / 60
  );

  const minutes =
    totalMinutes % 60;

  if (days > 0) {
    return hours > 0
      ? `${days}d ${hours}h`
      : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }

  return `${minutes}m`;
}

function getCountdownState(
  now: number | null,
  scheduledStart: string | null,
  scheduledEnd: string | null,
  windowEnd: string,
  planStatus:
    | "forming"
    | "planned"
    | "completed"
    | "cancelled"
): CountdownState {
  if (planStatus === "completed") {
    return {
      label: "Completed",
      toneClasses:
        "bg-purple-100 text-purple-800",
    };
  }

  if (planStatus === "cancelled") {
    return {
      label: "Cancelled",
      toneClasses:
        "bg-red-100 text-red-800",
    };
  }

  if (now === null) {
    return {
      label: scheduledStart
        ? "Schedule set"
        : "Planning window open",
      toneClasses:
        "bg-white text-gray-700",
    };
  }

  if (scheduledStart) {
    const startTime =
      new Date(
        scheduledStart
      ).getTime();

    const endTime =
      scheduledEnd
        ? new Date(
            scheduledEnd
          ).getTime()
        : null;

    if (
      Number.isFinite(startTime) &&
      now < startTime
    ) {
      return {
        label: `Starts in ${formatDuration(
          startTime - now
        )}`,
        toneClasses:
          "bg-emerald-100 text-emerald-800",
      };
    }

    if (
      Number.isFinite(startTime) &&
      endTime !== null &&
      Number.isFinite(endTime) &&
      now >= startTime &&
      now < endTime
    ) {
      return {
        label: `In progress · ${formatDuration(
          endTime - now
        )} left`,
        toneClasses:
          "bg-blue-100 text-blue-800",
      };
    }

    if (
      endTime !== null &&
      Number.isFinite(endTime) &&
      now >= endTime
    ) {
      return {
        label: "Activity ended",
        toneClasses:
          "bg-amber-100 text-amber-800",
      };
    }
  }

  const windowEndTime =
    new Date(
      `${windowEnd}T23:59:59`
    ).getTime();

  if (
    Number.isFinite(
      windowEndTime
    ) &&
    now < windowEndTime
  ) {
    return {
      label: `Planning window · ${formatDuration(
        windowEndTime - now
      )} left`,
      toneClasses:
        "bg-violet-100 text-violet-800",
    };
  }

  return {
    label: "Planning window ended",
    toneClasses:
      "bg-gray-200 text-gray-700",
  };
}

function formatCalendarParts(
  value: string,
  timezone: string
) {
  const date = new Date(value);

  return {
    month: new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: timezone,
        month: "short",
      }
    )
      .format(date)
      .toUpperCase(),

    day: new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: timezone,
        day: "2-digit",
      }
    ).format(date),

    weekday:
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: timezone,
          weekday: "short",
        }
      ).format(date),

    fullDate:
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: timezone,
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      ).format(date),
  };
}

function formatTime(
  value: string,
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(new Date(value));
}

function formatWindowDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(
      `${value}T00:00:00Z`
    )
  );
}

export default function TimelinePlanPresentation({
  title,
  categoryName,
  coverUrl,
  city,
  district,
  meetingPoint,
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
  visibilityLabel,
  relatedLinks = [],
}: TimelinePlanPresentationProps) {
  const [now, setNow] =
    useState<number | null>(
      null
    );

  useEffect(() => {
    const updateNow = () => {
      setNow(Date.now());
    };

    updateNow();

    const intervalId =
      window.setInterval(
        updateNow,
        60000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, []);

  const parsedLatitude =
    toCoordinate(latitude);

  const parsedLongitude =
    toCoordinate(longitude);

  const locationLabel = [
    district,
    city,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery =
    parsedLatitude !== null &&
    parsedLongitude !== null
      ? `${parsedLatitude},${parsedLongitude}`
      : meetingPoint ||
        locationLabel;

  const mapEmbedUrl =
    mapQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          mapQuery
        )}&z=${
          parsedLatitude !== null &&
          parsedLongitude !== null
            ? 15
            : 12
        }&output=embed`
      : null;

  const visibleMembers =
    members.slice(0, 4);

  const remainingMemberCount =
    Math.max(
      members.length -
        visibleMembers.length,
      0
    );

  const budgetProgress =
    targetBudget !== null &&
    targetBudget > 0
      ? (
          committedBudget /
          targetBudget
        ) * 100
      : null;

  const progressBarWidth =
    budgetProgress === null
      ? 0
      : Math.min(
          Math.max(
            budgetProgress,
            0
          ),
          100
        );

  const displayedProgress =
    budgetProgress === null
      ? null
      : Math.round(
          budgetProgress * 10
        ) / 10;

  const countdown =
    useMemo(
      () =>
        getCountdownState(
          now,
          scheduledStart,
          scheduledEnd,
          windowEnd,
          planStatus
        ),
      [
        now,
        scheduledStart,
        scheduledEnd,
        windowEnd,
        planStatus,
      ]
    );

  const calendarParts =
    scheduledStart
      ? formatCalendarParts(
          scheduledStart,
          timezone
        )
      : null;

  const hasStarted =
    now !== null &&
    scheduledStart !== null &&
    now >=
      new Date(
        scheduledStart
      ).getTime();

  const effectiveRecruitmentStatus =
    hasStarted ||
    planStatus === "completed" ||
    planStatus === "cancelled"
      ? "closed"
      : recruitmentStatus;

  const resolvedCoverUrl =
    resolveActivityCover({
      planCoverUrl: coverUrl,
      categoryName,
      activityName: title,
    });

  return (
    <section className="overflow-hidden rounded-[28px] bg-white">
      <div className="relative h-52 overflow-hidden md:h-64">
        <img
          src={resolvedCoverUrl}
          alt={`${title} cover`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/35" />

        <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${relationshipClasses}`}
            >
              {relationshipLabel}
            </span>

            <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
              Shared Plan
            </span>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${statusClasses}`}
            >
              {statusLabel}
            </span>

            <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11px] font-bold capitalize text-white backdrop-blur">
              Recruitment: {effectiveRecruitmentStatus}
            </span>

            {requestCount > 0 && (
              <span className="rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
                {requestCount} request
                {requestCount > 1
                  ? "s"
                  : ""}
              </span>
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-300">
              {categoryName}
            </p>

            <h3 className="mt-1 text-2xl font-bold text-white md:text-3xl">
              {title}
            </h3>
          </div>

          {locationLabel && (
            <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              📍 {locationLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4 p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,1.15fr)]">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              {hostAvatarUrl ? (
                <img
                  src={hostAvatarUrl}
                  alt={hostName}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-800">
                  {getInitial(
                    hostName
                  )}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                  Hosted by
                </p>

                <p className="truncate text-sm font-bold text-gray-950">
                  {hostName}

                  {isCurrentUserHost && (
                    <span className="ml-2 text-xs font-medium text-cyan-700">
                      You
                    </span>
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Visible to {visibilityLabel}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
              {calendarParts &&
              scheduledStart ? (
                <div className="flex min-h-28">
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-amber-200 bg-white text-center">
                    <p className="text-xs font-bold tracking-[0.18em] text-red-600">
                      {calendarParts.month}
                    </p>

                    <p className="mt-1 text-4xl font-black leading-none text-gray-950">
                      {calendarParts.day}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {calendarParts.weekday}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        {planStatus ===
                        "forming"
                          ? "Schedule draft"
                          : "Activity schedule"}
                      </p>

                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${countdown.toneClasses}`}
                      >
                        {countdown.label}
                      </span>
                    </div>

                    <p className="mt-2 text-2xl font-black tracking-tight text-gray-950">
                      {formatTime(
                        scheduledStart,
                        timezone
                      )}
                      {scheduledEnd
                        ? ` – ${formatTime(
                            scheduledEnd,
                            timezone
                          )}`
                        : ""}
                    </p>

                    <p className="mt-1 text-xs text-gray-600">
                      {calendarParts.fullDate} · {timezone}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-28 items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Availability window
                    </p>

                    <p className="mt-2 text-lg font-black text-gray-950">
                      {formatWindowDate(
                        windowStart
                      )}
                      {" → "}
                      {formatWindowDate(
                        windowEnd
                      )}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${countdown.toneClasses}`}
                  >
                    {countdown.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {visibleMembers.map(
                  (member) => (
                    <div
                      key={member.id}
                      title={
                        member.fullName ??
                        "UIN member"
                      }
                    >
                      {member.avatarUrl ? (
                        <img
                          src={
                            member.avatarUrl
                          }
                          alt={
                            member.fullName ??
                            "Plan member"
                          }
                          className="h-9 w-9 rounded-full border-2 border-white object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-bold text-gray-600">
                          {getInitial(
                            member.fullName
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}

                {remainingMemberCount >
                  0 && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-xs font-bold text-white">
                    +
                    {
                      remainingMemberCount
                    }
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                <p className="font-semibold text-gray-900">
                  {members.length} members
                </p>

                <p className="mt-0.5">
                  {participantCount} / {participantLimit} participants
                </p>
              </div>
            </div>

            <p className="text-xs font-medium text-gray-500">
              Plan team
            </p>
          </div>

          {relatedLinks.length >
            0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <IntentLinksDisplay
                links={
                  relatedLinks
                }
                compact
                showHeading
              />
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Budget
                </p>

                <p className="mt-1 text-sm font-bold text-gray-950">
                  {formatBudget(
                    committedBudget
                  )}{" "}
                  TL committed
                </p>
              </div>

              <div className="text-right text-xs text-gray-500">
                <p>
                  {targetBudget ===
                  null
                    ? "No target set"
                    : `${formatBudget(
                        targetBudget
                      )} TL target`}
                </p>

                {displayedProgress !==
                  null && (
                  <p className="mt-1 font-bold text-emerald-700">
                    {
                      displayedProgress
                    }
                    %
                  </p>
                )}
              </div>
            </div>

            {targetBudget !== null &&
              targetBudget > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${progressBarWidth}%`,
                    }}
                  />
                </div>
              )}
          </div>
        </div>

        <div className="relative min-h-64 border-t border-gray-200 bg-gray-100 md:min-h-full md:border-l md:border-t-0">
          {mapEmbedUrl ? (
            <iframe
              title={`${title} map`}
              src={mapEmbedUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center p-6 text-center">
              <p className="text-sm text-gray-500">
                Map preview is not available.
              </p>
            </div>
          )}

          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 right-3 rounded-xl border border-white/60 bg-white/90 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              Open map ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
