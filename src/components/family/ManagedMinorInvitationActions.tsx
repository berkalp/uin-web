"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type GuardianOption = {
  guardian_user_id: string;
  full_name: string | null;
  username: string;
  guardian_role:
    | "primary_guardian"
    | "guardian";
};

type ManagedMinorInvitationActionsProps = {
  invitationId: string;
  currentGuardianUserId: string;
  guardians: GuardianOption[];
};

export default function ManagedMinorInvitationActions({
  invitationId,
  currentGuardianUserId,
  guardians,
}: ManagedMinorInvitationActionsProps) {
  const router = useRouter();

  const defaultGuardianId =
    useMemo(() => {
      const current =
        guardians.find(
          (guardian) =>
            guardian.guardian_user_id ===
            currentGuardianUserId
        );

      if (current) {
        return current.guardian_user_id;
      }

      const primary =
        guardians.find(
          (guardian) =>
            guardian.guardian_role ===
            "primary_guardian"
        );

      return (
        primary?.guardian_user_id ??
        guardians[0]?.guardian_user_id ??
        ""
      );
    }, [
      currentGuardianUserId,
      guardians,
    ]);

  const [
    supervisingGuardianId,
    setSupervisingGuardianId,
  ] = useState(
    defaultGuardianId
  );

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function respond(
    response:
      | "accept"
      | "decline"
  ) {
    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "respond_managed_minor_intent_invitation",
        {
          p_invitation_id:
            invitationId,

          p_response:
            response,

          p_supervising_guardian_user_id:
            response === "accept"
              ? supervisingGuardianId
              : null,
        }
      );

      if (error) {
        throw error;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The invitation could not be updated."
      );
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        Guardian Approval
      </p>

      <p className="mt-2 text-sm leading-6 text-blue-950">
        A supervising guardian must join
        the Activity with the child.
      </p>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-gray-700">
          Supervising guardian
        </span>

        <select
          value={
            supervisingGuardianId
          }
          disabled={isWorking}
          onChange={(event) =>
            setSupervisingGuardianId(
              event.target.value
            )
          }
          className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
        >
          {guardians.map(
            (guardian) => (
              <option
                key={
                  guardian.guardian_user_id
                }
                value={
                  guardian.guardian_user_id
                }
              >
                {guardian.full_name ||
                  guardian.username}
                {" · "}
                {guardian.guardian_role ===
                "primary_guardian"
                  ? "Primary Guardian"
                  : "Guardian"}
              </option>
            )
          )}
        </select>
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isWorking}
          onClick={() =>
            respond("decline")
          }
          className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          Decline
        </button>

        <button
          type="button"
          disabled={
            isWorking ||
            !supervisingGuardianId
          }
          onClick={() =>
            respond("accept")
          }
          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {isWorking
            ? "Saving..."
            : "Approve Participation"}
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
