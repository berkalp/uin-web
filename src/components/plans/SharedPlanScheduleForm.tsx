"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { finalizeActivity } from "@/services/planService";
import { supabase } from "@/utils/supabase/client";

type SharedPlanScheduleFormProps = {
  planId: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  meetingPoint: string | null;
  meetingLocationSameAsActivity: boolean;
  activityLocationName: string | null;
  scheduleNotes: string | null;
  actorRole: "host" | "co_host";
  recruitmentStatus: "open" | "full" | "closed";
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000
  );

  return localDate.toISOString().slice(0, 16);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The schedule draft could not be updated.";
}

function createScheduleKey(
  startValue: string,
  endValue: string,
  timezoneValue: string,
  notesValue: string
) {
  return JSON.stringify({
    startValue,
    endValue,
    timezoneValue,
    notesValue: notesValue.trim(),
  });
}

export default function SharedPlanScheduleForm({
  planId,
  windowStart,
  windowEnd,
  timezone,
  scheduledStart,
  scheduledEnd,
  meetingPoint,
  meetingLocationSameAsActivity,
  activityLocationName,
  scheduleNotes,
  actorRole,
  recruitmentStatus,
}: SharedPlanScheduleFormProps) {
  const router = useRouter();
  const initialStartValue = toDateTimeLocal(scheduledStart);
  const initialEndValue = toDateTimeLocal(scheduledEnd);
  const initialTimezoneValue = timezone || "Europe/Istanbul";
  const initialNotesValue = scheduleNotes ?? "";

  const [startValue, setStartValue] = useState(initialStartValue);
  const [endValue, setEndValue] = useState(initialEndValue);
  const [timezoneValue, setTimezoneValue] = useState(initialTimezoneValue);
  const [notesValue, setNotesValue] = useState(initialNotesValue);
  const [savedScheduleKey, setSavedScheduleKey] = useState(
    scheduledStart && scheduledEnd
      ? createScheduleKey(
          initialStartValue,
          initialEndValue,
          initialTimezoneValue,
          initialNotesValue
        )
      : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [continueRecruitment, setContinueRecruitment] = useState(
    recruitmentStatus !== "closed"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveMeetingPoint =
    (meetingLocationSameAsActivity ? activityLocationName : meetingPoint) ||
    activityLocationName ||
    meetingPoint ||
    "To be confirmed";

  const isScheduleValid =
    Boolean(startValue) &&
    Boolean(endValue) &&
    new Date(endValue).getTime() > new Date(startValue).getTime();

  const currentScheduleKey = useMemo(
    () =>
      createScheduleKey(
        startValue,
        endValue,
        timezoneValue,
        notesValue
      ),
    [endValue, notesValue, startValue, timezoneValue]
  );

  const hasSavedSchedule =
    isScheduleValid &&
    Boolean(savedScheduleKey) &&
    savedScheduleKey === currentScheduleKey;

  const canSave = isScheduleValid && !isSaving && !isConfirming;
  const canConfirm =
    actorRole === "host" &&
    hasSavedSchedule &&
    !isSaving &&
    !isConfirming;

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
    setConfirmError("");
  }

  async function saveSchedule() {
    if (!canSave) return;

    setIsSaving(true);
    clearMessages();

    try {
      const { error } = await supabase.rpc("update_shared_plan_schedule", {
        p_plan_id: planId,
        p_scheduled_start: new Date(startValue).toISOString(),
        p_scheduled_end: new Date(endValue).toISOString(),
        p_timezone: timezoneValue,
        p_meeting_point: effectiveMeetingPoint,
        p_schedule_notes: notesValue.trim() || null,
      });

      if (error) throw error;

      setSavedScheduleKey(currentScheduleKey);
      setSuccessMessage(
        actorRole === "co_host"
          ? "The Co-host schedule draft has been saved."
          : "The schedule draft has been saved."
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function openConfirmDialog() {
    setConfirmError("");

    if (!hasSavedSchedule) {
      setErrorMessage("Save the current schedule draft before confirming the Plan.");
      return;
    }

    setIsConfirmOpen(true);
  }

  async function confirmSchedule() {
    if (!canConfirm) return;

    setIsConfirming(true);
    setConfirmError("");

    try {
      await finalizeActivity({
        planId,
        continueRecruitment,
      });

      router.push(`/plans/${planId}/activity`);
      router.refresh();
    } catch (error) {
      setConfirmError(
        error instanceof Error
          ? error.message
          : "The schedule could not be confirmed."
      );
    } finally {
      setIsConfirming(false);
    }
  }

  const confirmDialog =
    isMounted && isConfirmOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isConfirming) {
                setIsConfirmOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-schedule-title"
              className="w-full max-w-lg rounded-3xl border border-green-100 bg-white p-6 shadow-2xl md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                    Confirm Plan
                  </p>
                  <h2
                    id="confirm-schedule-title"
                    className="mt-1 text-2xl font-bold text-gray-950"
                  >
                    Confirm the Schedule
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => setIsConfirmOpen(false)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm leading-6 text-green-950">
                <p>
                  Confirming the schedule archives the Planning Room and opens the Activity Room.
                </p>
                <p className="mt-3 font-semibold">
                  The date, time, and meeting point cannot be changed after confirmation.
                </p>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
                <input
                  type="checkbox"
                  checked={continueRecruitment}
                  onChange={(event) =>
                    setContinueRecruitment(event.target.checked)
                  }
                  disabled={recruitmentStatus === "full" || isConfirming}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span>
                  <span className="block font-semibold text-gray-950">
                    Continue accepting participants
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-gray-500">
                    New users will see the confirmed schedule before requesting to join.
                  </span>
                </span>
              </label>

              {recruitmentStatus === "full" && (
                <p className="mt-3 text-sm font-semibold text-amber-700">
                  Participant capacity is already full.
                </p>
              )}

              {confirmError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  {confirmError}
                </p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => setIsConfirmOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={confirmSchedule}
                  className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isConfirming ? "Confirming..." : "Confirm Schedule"}
                </button>
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <section
        id="schedule"
        className="scroll-mt-24 rounded-3xl border border-amber-200 bg-white p-5 shadow-sm md:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              Schedule draft
            </p>
            <h2 className="mt-1 text-xl font-bold text-gray-950">
              When the Activity happens
            </h2>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Must stay inside {windowStart} → {windowEnd}. Locations are managed separately above.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            {hasSavedSchedule ? "Saved draft" : "Draft"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Starts
            </span>
            <input
              type="datetime-local"
              value={startValue}
              disabled={isSaving || isConfirming}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setStartValue(event.target.value);
                clearMessages();
                if (
                  endValue &&
                  event.target.value &&
                  endValue <= event.target.value
                ) {
                  setEndValue("");
                }
              }}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ends
            </span>
            <input
              type="datetime-local"
              min={startValue || undefined}
              value={endValue}
              disabled={isSaving || isConfirming}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setEndValue(event.target.value);
                clearMessages();
              }}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Timezone
            </span>
            <select
              value={timezoneValue}
              disabled={isSaving || isConfirming}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setTimezoneValue(event.target.value);
                clearMessages();
              }}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            >
              <option value="Europe/Istanbul">Europe/Istanbul</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </label>
        </div>

        <details className="mt-3 rounded-xl border border-amber-100 bg-amber-50/50">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-700">
            Schedule notes
            <span className="float-right text-gray-400">⌄</span>
          </summary>
          <div className="border-t border-amber-100 p-4">
            <textarea
              value={notesValue}
              disabled={isSaving || isConfirming}
              maxLength={2000}
              rows={3}
              onChange={(event) => {
                setNotesValue(event.target.value);
                clearMessages();
              }}
              placeholder="Optional details for the team"
              className="w-full resize-y rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>
        </details>

        {errorMessage && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {successMessage}
          </p>
        )}

        <div
          className={`mt-4 grid gap-3 ${
            actorRole === "host" ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <button
            type="button"
            disabled={!canSave}
            onClick={saveSchedule}
            className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Save draft"}
          </button>

          {actorRole === "host" && (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={openConfirmDialog}
              title={
                hasSavedSchedule
                  ? "Confirm the saved schedule"
                  : "Save the current schedule draft first"
              }
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm
            </button>
          )}
        </div>

        {actorRole === "host" && !hasSavedSchedule && (
          <p className="mt-2 text-center text-[11px] text-gray-500">
            Save the current draft to enable confirmation.
          </p>
        )}
      </section>

      {confirmDialog}
    </>
  );
}
