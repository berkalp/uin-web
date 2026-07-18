"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  removeIntentParticipant,
  type ParticipantRemovalReason,
} from "@/services/intentParticipantService";

type RemoveParticipantButtonProps = {
  participantId: string;
  participantName: string;
};

const REMOVAL_REASONS: Array<{
  value: ParticipantRemovalReason;
  label: string;
}> = [
  {
    value: "participant_withdrew",
    label: "Participant asked to leave",
  },
  {
    value: "plans_changed",
    label: "Plans changed",
  },
  {
    value: "no_response",
    label: "Participant is not responding",
  },
  {
    value: "group_changed",
    label: "The group plan changed",
  },
  {
    value: "other",
    label: "Other",
  },
];

export default function RemoveParticipantButton({
  participantId,
  participantName,
}: RemoveParticipantButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);

  const [reason, setReason] =
    useState<ParticipantRemovalReason | "">("");

  const [isRemoving, setIsRemoving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const handleRemove = async () => {
    if (!reason) {
      setErrorMessage(
        "Please select a reason."
      );

      return;
    }

    const confirmed = window.confirm(
      `Remove ${participantName} from this Activity?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setIsRemoving(true);

    try {
      await removeIntentParticipant(
        participantId,
        reason
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The participant could not be removed."
      );
    } finally {
      setIsRemoving(false);
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
        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
      >
        Remove
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-red-100 bg-red-50/50 p-3">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-gray-700">
          Why is this participant being removed?
        </span>

        <select
          value={reason}
          disabled={isRemoving}
          onChange={(event) =>
            setReason(
              event.target
                .value as ParticipantRemovalReason
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400"
        >
          <option value="">
            Select a reason
          </option>

          {REMOVAL_REASONS.map(
            (removalReason) => (
              <option
                key={removalReason.value}
                value={removalReason.value}
              >
                {removalReason.label}
              </option>
            )
          )}
        </select>
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!reason || isRemoving}
          onClick={handleRemove}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isRemoving
            ? "Removing..."
            : "Confirm Removal"}
        </button>

        <button
          type="button"
          disabled={isRemoving}
          onClick={() => {
            setIsOpen(false);
            setReason("");
            setErrorMessage("");
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
        >
          Keep Participant
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}