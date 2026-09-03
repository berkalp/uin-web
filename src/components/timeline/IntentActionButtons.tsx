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
  compact?: boolean;
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
  compact = false,
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

  const wrapperClass = compact
    ? "mt-2 border-t border-gray-100 pt-2"
    : "mt-6 border-t border-gray-100 pt-5";
  const headingClass = compact
    ? "mb-1.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-gray-500"
    : "mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500";
  const actionBase = compact
    ? "inline-flex h-7 w-full items-center justify-center rounded-md px-2 text-[9.5px] font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-50"
    : "rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={wrapperClass}>
      <p className={headingClass}>
        {status === "planned"
          ? "Aktiviteyi Yönet"
          : "Niyeti Yönet"}
      </p>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className={compact ? "grid gap-1.5" : "flex flex-wrap gap-3"}>
        {status === "active" && (
          <Link
            href={`/intents/${intentId}/edit`}
            className={`${actionBase} bg-gray-900 text-white hover:bg-gray-700`}
          >
            Niyeti Düzenle
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
            className={`${actionBase} bg-green-600 text-white hover:bg-green-700`}
          >
            {pendingAction ===
            "start_planning"
              ? "Niyet Odası açılıyor..."
              : "Planlamaya Başla"}
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
              className={`${actionBase} border border-gray-200 bg-white text-gray-700 hover:border-gray-400`}
            >
              {pendingAction ===
              "close"
                ? "Kapatılıyor..."
                : "Katılımı Kapat"}
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
              className={`${actionBase} border border-green-200 bg-green-50 text-green-700 hover:bg-green-100`}
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
            className={`${actionBase} bg-purple-600 text-white hover:bg-purple-700`}
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
          className={`${actionBase} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
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