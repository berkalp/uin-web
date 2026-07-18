"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  finalizeActivity,
} from "@/services/planService";

type ConfirmActivityPlanButtonProps = {
  planId: string;
  hasSchedule: boolean;
  recruitmentStatus:
    | "open"
    | "full"
    | "closed";
};

export default function ConfirmActivityPlanButton({
  planId,
  hasSchedule,
  recruitmentStatus,
}: ConfirmActivityPlanButtonProps) {
  const router = useRouter();

  const [
    continueRecruitment,
    setContinueRecruitment,
  ] = useState(
    recruitmentStatus !== "closed"
  );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function handleConfirmSchedule() {
    setErrorMessage(null);

    if (!hasSchedule) {
      setErrorMessage(
        "Save the schedule draft before confirming the schedule."
      );

      return;
    }

    const confirmed = window.confirm(
      "Confirm this schedule and open the Activity Room? The date, time, and meeting point cannot be changed afterward."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);

      await finalizeActivity({
        planId,
        continueRecruitment,
      });

      router.push(
        `/plans/${planId}/activity`
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The schedule could not be confirmed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-green-200 bg-green-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
        Confirm Plan
      </p>

      <h3 className="mt-1 text-xl font-bold text-gray-900">
        Confirm the Schedule
      </h3>

      <p className="mt-2 text-sm text-gray-600">
        Confirming the schedule archives the
        Planning Room and opens the Activity
        Room.
      </p>

      <p className="mt-2 text-sm font-semibold text-gray-700">
        The date, time, and meeting point cannot
        be changed after confirmation.
      </p>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-green-100 bg-white p-4">
        <input
          type="checkbox"
          checked={continueRecruitment}
          onChange={(event) =>
            setContinueRecruitment(
              event.target.checked
            )
          }
          disabled={
            recruitmentStatus === "full"
          }
          className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />

        <span>
          <span className="block font-semibold text-gray-900">
            Continue accepting participants
          </span>

          <span className="mt-1 block text-sm text-gray-500">
            New users will see the confirmed
            schedule before requesting to join.
          </span>
        </span>
      </label>

      {recruitmentStatus === "full" && (
        <p className="mt-3 text-sm font-semibold text-amber-700">
          Participant capacity is already full.
        </p>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={
          handleConfirmSchedule
        }
        disabled={
          isSubmitting ||
          !hasSchedule
        }
        className="mt-5 w-full rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Confirming Schedule..."
          : "Confirm Schedule"}
      </button>

      {!hasSchedule && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Save a schedule draft before confirming
          the Plan.
        </p>
      )}
    </section>
  );
}