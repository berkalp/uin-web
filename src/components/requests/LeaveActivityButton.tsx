"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  withdrawIntentParticipation,
  type ParticipationWithdrawalReason,
} from "@/services/intentParticipantService";

type LeaveActivityButtonProps = {
  participantId: string;
  activityName: string;
};

const WITHDRAWAL_REASONS: Array<{
  value: ParticipationWithdrawalReason;
  label: string;
}> = [
  {
    value: "plans_changed",
    label: "My plans changed",
  },
  {
    value: "unexpected_event",
    label: "Something unexpected happened",
  },
  {
    value: "no_longer_available",
    label: "I am no longer available",
  },
  {
    value: "joined_by_mistake",
    label: "I joined by mistake",
  },
  {
    value: "prefer_not_to_say",
    label: "Prefer not to say",
  },
];

export default function LeaveActivityButton({
  participantId,
  activityName,
}: LeaveActivityButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);

  const [reason, setReason] =
    useState<
      ParticipationWithdrawalReason | ""
    >("");

  const [isLeaving, setIsLeaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const handleLeave = async () => {
    if (!reason) {
      setErrorMessage(
        "Please select a reason."
      );

      return;
    }

    const confirmed = window.confirm(
      `Leave ${activityName}? The Intent owner will be informed.`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setIsLeaving(true);

    try {
      await withdrawIntentParticipation(
        participantId,
        reason
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "You could not leave this Activity."
      );
    } finally {
      setIsLeaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setErrorMessage("");
        }}
        className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        Leave Activity
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Why are you leaving this Activity?
        </span>

        <select
          value={reason}
          disabled={isLeaving}
          onChange={(event) =>
            setReason(
              event.target
                .value as ParticipationWithdrawalReason
            )
          }
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-red-400"
        >
          <option value="">
            Select a reason
          </option>

          {WITHDRAWAL_REASONS.map(
            (withdrawalReason) => (
              <option
                key={withdrawalReason.value}
                value={withdrawalReason.value}
              >
                {withdrawalReason.label}
              </option>
            )
          )}
        </select>
      </label>

      <p className="mt-3 text-xs leading-5 text-gray-500">
        The Intent owner will see the selected
        reason. This does not currently affect
        your UIN reputation.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!reason || isLeaving}
          onClick={handleLeave}
          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isLeaving
            ? "Leaving..."
            : "Confirm Leave"}
        </button>

        <button
          type="button"
          disabled={isLeaving}
          onClick={() => {
            setIsOpen(false);
            setReason("");
            setErrorMessage("");
          }}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
        >
          Stay in Activity
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}