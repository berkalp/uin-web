"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/utils/supabase/client";

type IntentInvitationRevokeButtonProps = {
  invitationId: string;
  invitedName: string;
};

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

  return "The Intent invitation could not be revoked.";
}

export default function IntentInvitationRevokeButton({
  invitationId,
  invitedName,
}: IntentInvitationRevokeButtonProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function revokeInvitation() {
    const confirmed =
      window.confirm(
        `Revoke the invitation sent to ${invitedName}?`
      );

    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const { error } =
        await supabase.rpc(
          "revoke_intent_invitation",
          {
            p_invitation_id:
              invitationId,
          }
        );

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={isWorking}
        onClick={revokeInvitation}
        className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isWorking
          ? "Revoking..."
          : "Revoke Invitation"}
      </button>

      {errorMessage && (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
