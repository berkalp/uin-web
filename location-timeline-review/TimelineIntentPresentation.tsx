"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  resolveActivityCover,
} from "../../utils/activityCover";
import IntentLinksDisplay from "../intents/IntentLinksDisplay";
import type { IntentLinkView } from "../../utils/intentLinks";

type TimelineIntentPresentationProps = {
  title: string;
  categoryName: string;
  activityCoverUrl: string | null;
  categoryCoverUrl: string | null;
  city: string | null;
  district: string | null;
  startDate: string;
  endDate: string;
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
  relatedLinks?: IntentLinkView[];
};

type AvailabilityState = {
  label: string;
  toneClasses: string;
};

function formatDuration(
  milliseconds: number
) {
  const totalMinutes =
    Math.max(
      Math.floor(
        milliseconds / 60000
      ),
      0
    );

  if (totalMinutes < 1) {
    return "less than a minute";
  }

  const days =
    Math.floor(
      totalMinutes / 1440
    );

  const hours =
    Math.floor(
      (totalMinutes % 1440) /
        60
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

function getAvailabilityState(
  now: number | null,
  startDate: string,
  endDate: string
): AvailabilityState {
  if (now === null) {
    return {
      label:
        "Availability window",
      toneClasses:
        "bg-white text-gray-700",
    };
  }

  const startTime =
    new Date(
      `${startDate}T00:00:00+03:00`
    ).getTime();

  const endTime =
    new Date(
      `${endDate}T23:59:59+03:00`
    ).getTime();

  if (
    Number.isFinite(
      startTime
    ) &&
    now < startTime
  ) {
    return {
      label: `Opens in ${formatDuration(
        startTime - now
      )}`,
      toneClasses:
        "bg-blue-100 text-blue-800",
    };
  }

  if (
    Number.isFinite(endTime) &&
    now <= endTime
  ) {
    const remaining =
      endTime - now;

    if (
      remaining <=
      24 * 60 * 60 * 1000
    ) {
      return {
        label:
          "Ends today",
        toneClasses:
          "bg-amber-100 text-amber-800",
      };
    }

    return {
      label: `${formatDuration(
        remaining
      )} remaining`,
      toneClasses:
        "bg-emerald-100 text-emerald-800",
    };
  }

  return {
    label: "Expired",
    toneClasses:
      "bg-gray-200 text-gray-700",
  };
}

function formatDateParts(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  return {
    month:
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: "UTC",
          month: "short",
        }
      )
        .format(date)
        .toUpperCase(),

    day:
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: "UTC",
          day: "2-digit",
        }
      ).format(date),

    year:
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: "UTC",
          year: "numeric",
        }
      ).format(date),
  };
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

export default function TimelineIntentPresentation({
  title,
  categoryName,
  activityCoverUrl,
  categoryCoverUrl,
  city,
  district,
  startDate,
  endDate,
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
  relatedLinks = [],
}: TimelineIntentPresentationProps) {
  const [
    now,
    setNow,
  ] = useState<number | null>(
    null
  );

  useEffect(() => {
    const updateNow = () =>
      setNow(Date.now());

    updateNow();

    const interval =
      window.setInterval(
        updateNow,
        60_000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  const availabilityState =
    useMemo(
      () =>
        getAvailabilityState(
          now,
          startDate,
          endDate
        ),
      [
        now,
        startDate,
        endDate,
      ]
    );

  const startParts =
    formatDateParts(
      startDate
    );

  const endParts =
    formatDateParts(
      endDate
    );

  const coverUrl =
    resolveActivityCover({
      activityCoverUrl,
      categoryCoverUrl,
      categoryName,
      activityName: title,
    });

  const locationLabel = [
    district,
    city,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery =
    locationLabel || city;

  const mapEmbedUrl =
    mapQuery
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          mapQuery
        )}&z=11&output=embed`
      : null;

  const externalMapUrl =
    mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          mapQuery
        )}`
      : null;

  const matchingLabel =
    recruitmentStatus ===
      "full"
      ? "Capacity full"
      : recruitmentStatus ===
          "closed" ||
        matchingStatus ===
          "paused" ||
        matchingStatus ===
          "closed"
        ? "Matching closed"
        : "Matching open";

  return (
    <section>
      <div className="relative h-52 overflow-hidden bg-gray-950 md:h-60">
        <img
          src={coverUrl}
          alt={`${title} cover`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-gray-950 shadow-sm backdrop-blur">
            Open Intent
          </span>

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${statusClasses}`}
          >
            {statusLabel}
          </span>

          <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            {matchingLabel}
          </span>

          {requestCount >
            0 && (
            <span className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
              {requestCount} request
              {requestCount ===
              1
                ? ""
                : "s"}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-300">
              {categoryName}
            </p>

            <h3 className="mt-2 text-3xl font-bold text-white">
              {title}
            </h3>

            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/75">
              {intentType}
            </p>
          </div>

          {locationLabel && (
            <span className="rounded-full border border-white/20 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
              Approximate area ·{" "}
              {locationLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid bg-white md:grid-cols-[minmax(0,1fr)_285px]">
        <div className="space-y-4 p-5">
          <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
            <div className="grid grid-cols-[76px_minmax(0,1fr)]">
              <div className="flex flex-col items-center justify-center border-r border-amber-200 bg-white px-3 py-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-red-600">
                  {startParts.month}
                </p>

                <p className="mt-1 text-3xl font-black text-gray-950">
                  {startParts.day}
                </p>

                <p className="mt-1 text-[11px] font-semibold text-gray-400">
                  {startParts.year}
                </p>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Availability
                    </p>

                    <p className="mt-1 text-lg font-bold text-gray-950">
                      {startParts.day}{" "}
                      {startParts.month} →{" "}
                      {endParts.day}{" "}
                      {endParts.month}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${availabilityState.toneClasses}`}
                  >
                    {
                      availabilityState.label
                    }
                  </span>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Date range only. Exact
                  schedule will be set in
                  the Planning Room.
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Capacity
              </p>

              <p className="mt-1 font-bold text-gray-950">
                0 /{" "}
                {participantLimit}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Visibility
              </p>

              <p className="mt-1 truncate font-bold text-gray-950">
                {
                  visibilityLabel
                }
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Preference
              </p>

              <p className="mt-1 truncate font-bold capitalize text-gray-950">
                {people}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Budget
              </p>

              <p className="mt-1 truncate font-bold text-gray-950">
                {budget === null
                  ? "Not set"
                  : `${formatBudget(
                      budget
                    )} TL`}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Recurrence:{" "}
            <span className="font-semibold capitalize text-gray-700">
              {recurrence}
            </span>
          </p>

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
        </div>

        <div className="relative min-h-56 border-t border-gray-200 bg-gray-100 md:border-l md:border-t-0">
          {mapEmbedUrl ? (
            <iframe
              title={`${title} approximate area`}
              src={mapEmbedUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full min-h-56 items-center justify-center p-6 text-center">
              <p className="text-sm text-gray-500">
                Approximate map is not
                available.
              </p>
            </div>
          )}

          <span className="absolute left-3 top-3 rounded-full bg-gray-950/85 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur">
            Approximate area
          </span>

          {externalMapUrl && (
            <a
              href={externalMapUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 right-3 rounded-xl border border-white/60 bg-white/95 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              Open map ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
