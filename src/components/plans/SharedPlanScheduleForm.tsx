"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type SharedPlanScheduleFormProps = {
  planId: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  meetingPoint: string | null;
  scheduleNotes: string | null;
  actorRole: "host" | "co_host";
};

function toDateTimeLocal(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const localDate =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60 *
          1000
    );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function getErrorMessage(
  error: unknown
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message ===
      "string"
  ) {
    return error.message;
  }

  return "The schedule draft could not be updated.";
}

export default function SharedPlanScheduleForm({
  planId,
  windowStart,
  windowEnd,
  timezone,
  scheduledStart,
  scheduledEnd,
  meetingPoint,
  scheduleNotes,
  actorRole,
}: SharedPlanScheduleFormProps) {
  const router = useRouter();

  const [
    startValue,
    setStartValue,
  ] = useState(
    toDateTimeLocal(
      scheduledStart
    )
  );

  const [
    endValue,
    setEndValue,
  ] = useState(
    toDateTimeLocal(
      scheduledEnd
    )
  );

  const [
    timezoneValue,
    setTimezoneValue,
  ] = useState(
    timezone ||
      "Europe/Istanbul"
  );

  const [
    meetingPointValue,
    setMeetingPointValue,
  ] = useState(
    meetingPoint ?? ""
  );

  const [
    notesValue,
    setNotesValue,
  ] = useState(
    scheduleNotes ?? ""
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const canSave =
    Boolean(startValue) &&
    Boolean(endValue) &&
    Boolean(
      meetingPointValue.trim()
    ) &&
    new Date(
      endValue
    ).getTime() >
      new Date(
        startValue
      ).getTime() &&
    !isSaving;

  async function saveSchedule() {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "update_shared_plan_schedule",
        {
          p_plan_id:
            planId,

          p_scheduled_start:
            new Date(
              startValue
            ).toISOString(),

          p_scheduled_end:
            new Date(
              endValue
            ).toISOString(),

          p_timezone:
            timezoneValue,

          p_meeting_point:
            meetingPointValue.trim(),

          p_schedule_notes:
            notesValue.trim() ||
            null,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        actorRole === "co_host"
          ? "The Co-host schedule draft has been saved."
          : "The schedule draft has been saved."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Schedule Draft
      </p>

      <h2 className="mt-2 text-xl font-bold text-gray-950">
        Prepare the confirmed schedule
      </h2>

      <p className="mt-3 text-sm leading-7 text-gray-600">
        The schedule must stay inside{" "}
        <span className="font-semibold text-gray-800">
          {windowStart} →{" "}
          {windowEnd}
        </span>
        . A Co-host can edit the draft,
        while only the Primary Host
        confirms the Activity.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">
            Start
          </span>

          <input
            type="datetime-local"
            value={startValue}
            disabled={isSaving}
            onChange={(event) => {
              setStartValue(
                event.target.value
              );
              setErrorMessage("");
              setSuccessMessage("");

              if (
                endValue &&
                event.target.value &&
                endValue <=
                  event.target.value
              ) {
                setEndValue("");
              }
            }}
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-700">
            End
          </span>

          <input
            type="datetime-local"
            min={
              startValue ||
              undefined
            }
            value={endValue}
            disabled={isSaving}
            onChange={(event) => {
              setEndValue(
                event.target.value
              );
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gray-700">
            Timezone
          </span>

          <select
            value={
              timezoneValue
            }
            disabled={isSaving}
            onChange={(event) =>
              setTimezoneValue(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="Europe/Istanbul">
              Europe/Istanbul
            </option>

            <option value="Europe/London">
              Europe/London
            </option>

            <option value="Europe/Berlin">
              Europe/Berlin
            </option>

            <option value="America/New_York">
              America/New_York
            </option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gray-700">
            Meeting point
          </span>

          <input
            type="text"
            value={
              meetingPointValue
            }
            disabled={isSaving}
            maxLength={500}
            onChange={(event) => {
              setMeetingPointValue(
                event.target.value
              );
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-gray-700">
            Schedule notes
          </span>

          <textarea
            value={notesValue}
            disabled={isSaving}
            maxLength={2000}
            rows={4}
            onChange={(event) => {
              setNotesValue(
                event.target.value
              );
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className="mt-2 w-full resize-y rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </label>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">
            {successMessage}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={saveSchedule}
        className="mt-6 w-full rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving
          ? "Saving Schedule..."
          : "Save Schedule Draft"}
      </button>
    </section>
  );
}
