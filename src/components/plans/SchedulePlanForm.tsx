"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  schedulePlan,
} from "@/services/planService";

type SchedulePlanFormProps = {
  planId: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  meetingPoint?: string | null;
  scheduleNotes?: string | null;
};

type ZonedInputParts = {
  date: string;
  time: string;
};

function getZonedInputParts(
  isoDate: string | null | undefined,
  timezone: string
): ZonedInputParts | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    );

  const parts =
    formatter.formatToParts(date);

  const getPart = (type: string) =>
    parts.find(
      (part) => part.type === type
    )?.value ?? "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");

  if (
    !year ||
    !month ||
    !day ||
    !hour ||
    !minute
  ) {
    return null;
  }

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

export default function SchedulePlanForm({
  planId,
  windowStart,
  windowEnd,
  timezone,
  scheduledStart,
  scheduledEnd,
  meetingPoint,
  scheduleNotes,
}: SchedulePlanFormProps) {
  const router = useRouter();

  const initialStart =
    useMemo(
      () =>
        getZonedInputParts(
          scheduledStart,
          timezone
        ),
      [
        scheduledStart,
        timezone,
      ]
    );

  const initialEnd =
    useMemo(
      () =>
        getZonedInputParts(
          scheduledEnd,
          timezone
        ),
      [
        scheduledEnd,
        timezone,
      ]
    );

  const [startDate, setStartDate] =
    useState(
      initialStart?.date ??
        windowStart
    );

  const [startTime, setStartTime] =
    useState(
      initialStart?.time ?? ""
    );

  const [endDate, setEndDate] =
    useState(
      initialEnd?.date ??
        initialStart?.date ??
        windowStart
    );

  const [endTime, setEndTime] =
    useState(
      initialEnd?.time ?? ""
    );

  const [
    currentMeetingPoint,
    setCurrentMeetingPoint,
  ] = useState(
    meetingPoint ?? ""
  );

  const [
    currentScheduleNotes,
    setCurrentScheduleNotes,
  ] = useState(
    scheduleNotes ?? ""
  );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);

  const hasExistingDraft = Boolean(
    scheduledStart &&
      scheduledEnd
  );

  function handleStartDateChange(
    value: string
  ) {
    setStartDate(value);

    if (
      !endDate ||
      endDate < value
    ) {
      setEndDate(value);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (
      !startDate ||
      !startTime
    ) {
      setErrorMessage(
        "Start date and time are required."
      );

      return;
    }

    if (
      !endDate ||
      !endTime
    ) {
      setErrorMessage(
        "End date and time are required."
      );

      return;
    }

    if (
      startDate < windowStart ||
      startDate > windowEnd
    ) {
      setErrorMessage(
        "Start date must be within the Plan availability window."
      );

      return;
    }

    if (
      endDate < windowStart ||
      endDate > windowEnd
    ) {
      setErrorMessage(
        "End date must be within the Plan availability window."
      );

      return;
    }

    const localScheduledStart =
      `${startDate}T${startTime}`;

    const localScheduledEnd =
      `${endDate}T${endTime}`;

    if (
      localScheduledEnd <=
      localScheduledStart
    ) {
      setErrorMessage(
        "End time must be later than start time."
      );

      return;
    }

    if (
      !currentMeetingPoint.trim()
    ) {
      setErrorMessage(
        "Meeting point is required."
      );

      return;
    }

    try {
      setIsSubmitting(true);

      await schedulePlan({
        planId,
        scheduledStart:
          localScheduledStart,
        scheduledEnd:
          localScheduledEnd,
        timezone,
        meetingPoint:
          currentMeetingPoint,
        scheduleNotes:
          currentScheduleNotes,
      });

      setSuccessMessage(
        hasExistingDraft
          ? "Schedule draft updated."
          : "Schedule draft saved."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The schedule draft could not be saved."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Schedule Draft
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-900">
            {hasExistingDraft
              ? "Update the proposed schedule"
              : "Add a proposed schedule"}
          </h3>

          <p className="mt-2 text-sm text-gray-600">
            Discuss the details in the
            Planning Room before finalizing
            the Activity.
          </p>

          <p className="mt-2 text-sm text-gray-600">
            Available window:{" "}
            <span className="font-semibold">
              {windowStart}
            </span>{" "}
            to{" "}
            <span className="font-semibold">
              {windowEnd}
            </span>
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-blue-700">
          {timezone}
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor={`start-date-${planId}`}
              className="text-sm font-semibold text-gray-700"
            >
              Start date
            </label>

            <input
              id={`start-date-${planId}`}
              type="date"
              min={windowStart}
              max={windowEnd}
              value={startDate}
              onChange={(event) =>
                handleStartDateChange(
                  event.target.value
                )
              }
              required
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor={`start-time-${planId}`}
              className="text-sm font-semibold text-gray-700"
            >
              Start time
            </label>

            <input
              id={`start-time-${planId}`}
              type="time"
              value={startTime}
              onChange={(event) =>
                setStartTime(
                  event.target.value
                )
              }
              required
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor={`end-date-${planId}`}
              className="text-sm font-semibold text-gray-700"
            >
              End date
            </label>

            <input
              id={`end-date-${planId}`}
              type="date"
              min={windowStart}
              max={windowEnd}
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
              required
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor={`end-time-${planId}`}
              className="text-sm font-semibold text-gray-700"
            >
              End time
            </label>

            <input
              id={`end-time-${planId}`}
              type="time"
              value={endTime}
              onChange={(event) =>
                setEndTime(
                  event.target.value
                )
              }
              required
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`meeting-point-${planId}`}
            className="text-sm font-semibold text-gray-700"
          >
            Meeting point
          </label>

          <input
            id={`meeting-point-${planId}`}
            type="text"
            value={
              currentMeetingPoint
            }
            onChange={(event) =>
              setCurrentMeetingPoint(
                event.target.value
              )
            }
            placeholder="Example: Üsküdar Ferry Terminal entrance"
            maxLength={250}
            required
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor={`schedule-notes-${planId}`}
            className="text-sm font-semibold text-gray-700"
          >
            Schedule notes
          </label>

          <textarea
            id={`schedule-notes-${planId}`}
            value={
              currentScheduleNotes
            }
            onChange={(event) =>
              setCurrentScheduleNotes(
                event.target.value
              )
            }
            placeholder="What should participants know before arriving?"
            rows={4}
            maxLength={1000}
            className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <p className="mt-1 text-right text-xs text-gray-400">
            {
              currentScheduleNotes.length
            }
            /1000
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Saving draft..."
            : hasExistingDraft
              ? "Update Schedule Draft"
              : "Save Schedule Draft"}
        </button>
      </form>
    </section>
  );
}