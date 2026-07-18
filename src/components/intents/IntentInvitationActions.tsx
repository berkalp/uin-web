"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/utils/supabase/client";

type IntentInvitationActionsProps = {
  invitationId: string;
  activityName: string;
};

type InvitationAction =
  | "accept"
  | "decline";

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

  return "The Intent invitation could not be updated.";
}

export default function IntentInvitationActions({
  invitationId,
  activityName,
}: IntentInvitationActionsProps) {
  const router = useRouter();
  const [selectedAction, setSelectedAction] =
    useState<InvitationAction | null>(null);
  const [isWorking, setIsWorking] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function respond(
    action: InvitationAction
  ) {
    setSelectedAction(action);
    setIsWorking(true);
    setErrorMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "respond_intent_invitation",
          {
            p_invitation_id:
              invitationId,
            p_response:
              action,
          }
        );

      if (error) {
        throw error;
      }

      if (action === "accept") {
        if (typeof data !== "string") {
          throw new Error(
            "The Shared Plan could not be opened."
          );
        }

        router.push(
          `/plans/${encodeURIComponent(
            data
          )}/planning`
        );
        router.refresh();
        return;
      }

      setSelectedAction(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
      setSelectedAction(null);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={isWorking}
          onClick={() =>
            respond("decline")
          }
          className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isWorking &&
          selectedAction === "decline"
            ? "Declining..."
            : "Decline"}
        </button>

        <button
          type="button"
          disabled={isWorking}
          onClick={() =>
            respond("accept")
          }
          className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isWorking &&
          selectedAction === "accept"
            ? "Accepting..."
            : `Join ${activityName}`}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
