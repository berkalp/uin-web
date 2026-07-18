"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  cancelIntent,
  closeIntentRecruitment,
  markIntentCompleted,
  reopenIntentRecruitment,
} from "@/services/intentLifecycleService";

import {
  startPlanningFromIntent,
} from "@/services/intentPlanningService";

type IntentStatus =
  | "active"
  | "planned"
  | "completed"
  | "cancelled";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type IntentActionButtonsProps = {
  intentId: string;
  status: IntentStatus;
  recruitmentStatus: RecruitmentStatus;
};

type PendingAction =
  | "start_planning"
  | "close"
  | "reopen"
  | "complete"
  | "cancel"
  | null;

export default function IntentActionButtons({
  intentId,
  status,
  recruitmentStatus,
}: IntentActionButtonsProps) {
  const router = useRouter();

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const isSubmitting =
    pendingAction !== null;

  async function runAction(
    action: Exclude<
      PendingAction,
      null
    >
  ) {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);

    try {
      setPendingAction(action);

      if (
        action ===
        "start_planning"
      ) {
        const planId =
          await startPlanningFromIntent(
            intentId
          );

        router.push(
          `/plans/${planId}/planning`
        );

        router.refresh();

        return;
      }

      if (action === "close") {
        await closeIntentRecruitment(
          intentId
        );
      }

      if (action === "reopen") {
        await reopenIntentRecruitment(
          intentId
        );
      }

      if (action === "complete") {
        const confirmed =
          window.confirm(
            "Mark this Activity as completed?"
          );

        if (!confirmed) {
          return;
        }

        await markIntentCompleted(
          intentId
        );
      }

      if (action === "cancel") {
        const confirmationText =
          status === "planned"
            ? "Cancel this Activity? This action cannot be undone."
            : "Cancel this Intent? This action cannot be undone.";

        const confirmed =
          window.confirm(
            confirmationText
          );

        if (!confirmed) {
          return;
        }

        await cancelIntent(
          intentId
        );
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Intent could not be updated."
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (
    status === "completed" ||
    status === "cancelled"
  ) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {status === "planned"
          ? "Manage Activity"
          : "Manage Intent"}
      </p>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "active" && (
          <Link
            href={`/intents/${intentId}/edit`}
            className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            Edit Intent
          </Link>
        )}

        {status === "active" && (
          <button
            type="button"
            onClick={() =>
              runAction(
                "start_planning"
              )
            }
            disabled={isSubmitting}
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction ===
            "start_planning"
              ? "Opening Planning Room..."
              : "Start Planning"}
          </button>
        )}

        {status === "active" &&
          (
            recruitmentStatus ===
              "open" ||
            recruitmentStatus ===
              "full"
          ) && (
            <button
              type="button"
              onClick={() =>
                runAction("close")
              }
              disabled={isSubmitting}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction ===
              "close"
                ? "Closing..."
                : "Close Recruitment"}
            </button>
          )}

        {status === "active" &&
          recruitmentStatus ===
            "closed" && (
            <button
              type="button"
              onClick={() =>
                runAction("reopen")
              }
              disabled={isSubmitting}
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction ===
              "reopen"
                ? "Reopening..."
                : "Reopen Recruitment"}
            </button>
          )}

        {status === "planned" && (
          <button
            type="button"
            onClick={() =>
              runAction("complete")
            }
            disabled={isSubmitting}
            className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction ===
            "complete"
              ? "Completing..."
              : "Mark as Completed"}
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            runAction("cancel")
          }
          disabled={isSubmitting}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction ===
          "cancel"
            ? "Cancelling..."
            : status === "planned"
              ? "Cancel Activity"
              : "Cancel Intent"}
        </button>
      </div>
    </div>
  );
}