"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  updateIntentRequestStatus,
  type DeclineReason,
} from "@/services/intentRequestService";

type RequestActionButtonsProps = {
  requestId: string;
  canAccept: boolean;
  unavailableReason?: string | null;
};

type LoadingAction =
  | "accepted"
  | "rejected"
  | null;

const DECLINE_REASONS: Array<{
  value: DeclineReason;
  label: string;
}> = [
  {
    value: "plans_changed",
    label: "My plans changed",
  },
  {
    value: "capacity_complete",
    label: "Participant capacity is complete",
  },
  {
    value: "dates_incompatible",
    label: "Dates are no longer compatible",
  },
  {
    value: "group_format",
    label: "The group format is not suitable",
  },
  {
    value: "accepted_another",
    label: "I accepted another matching request",
  },
  {
    value: "prefer_not_to_say",
    label: "Prefer not to say",
  },
];

export default function RequestActionButtons({
  requestId,
  canAccept,
  unavailableReason,
}: RequestActionButtonsProps) {
  const router = useRouter();

  const [loadingAction, setLoadingAction] =
    useState<LoadingAction>(null);

  const [showDeclineOptions, setShowDeclineOptions] =
    useState(false);

  const [declineReason, setDeclineReason] =
    useState<DeclineReason | "">("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const handleAccept = async () => {
    if (!canAccept) {
      return;
    }

    setErrorMessage("");
    setLoadingAction("accepted");

    try {
      await updateIntentRequestStatus(
        requestId,
        "accepted"
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The request could not be accepted."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDecline = async () => {
    if (!declineReason) {
      setErrorMessage(
        "Please select a reason before declining the request."
      );

      return;
    }

    setErrorMessage("");
    setLoadingAction("rejected");

    try {
      await updateIntentRequestStatus(
        requestId,
        "rejected",
        declineReason
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The request could not be declined."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const isLoading =
    loadingAction !== null;

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      {!canAccept && unavailableReason && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {unavailableReason}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canAccept || isLoading}
          onClick={handleAccept}
          className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loadingAction === "accepted"
            ? "Accepting..."
            : "Accept"}
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            setErrorMessage("");
            setShowDeclineOptions(
              (currentValue) => !currentValue
            );
          }}
          className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Decline
        </button>
      </div>

      {showDeclineOptions && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">
              Why are you declining this request?
            </span>

            <select
              value={declineReason}
              disabled={isLoading}
              onChange={(event) =>
                setDeclineReason(
                  event.target
                    .value as DeclineReason
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-red-400"
            >
              <option value="">
                Select a reason
              </option>

              {DECLINE_REASONS.map(
                (reason) => (
                  <option
                    key={reason.value}
                    value={reason.value}
                  >
                    {reason.label}
                  </option>
                )
              )}
            </select>
          </label>

          <p className="mt-3 text-xs leading-5 text-gray-500">
            The requester will see this reason.
            Declining does not affect their UIN
            reputation.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                !declineReason || isLoading
              }
              onClick={handleDecline}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loadingAction === "rejected"
                ? "Declining..."
                : "Confirm Decline"}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setShowDeclineOptions(false);
                setDeclineReason("");
                setErrorMessage("");
              }}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Keep Request
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}