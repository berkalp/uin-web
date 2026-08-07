"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../../utils/supabase/client";

type MemberRole =
  | "host"
  | "co_host"
  | "participant";

type PlanMemberManagementControlsProps = {
  planId: string;
  planStatus:
    | "forming"
    | "planned"
    | "completed"
    | "cancelled";
  actorUserId: string;
  actorRole:
    | "host"
    | "co_host"
    | "participant";
  memberUserId: string;
  memberName: string;
  memberRole: MemberRole;
};

type ActionMode =
  | "role"
  | "transfer"
  | "remove";

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

  return "The Plan member could not be updated.";
}

export default function PlanMemberManagementControls({
  planId,
  planStatus,
  actorUserId,
  actorRole,
  memberUserId,
  memberName,
  memberRole,
}: PlanMemberManagementControlsProps) {
  const router = useRouter();

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    actionMode,
    setActionMode,
  ] = useState<ActionMode>(
    "role"
  );

  const [
    selectedRole,
    setSelectedRole,
  ] = useState<
    "co_host" | "participant"
  >(
    memberRole === "co_host"
      ? "co_host"
      : "participant"
  );

  const [
    previousHostRole,
    setPreviousHostRole,
  ] = useState<
    "co_host" | "participant"
  >("co_host");

  const [
    removalReason,
    setRemovalReason,
  ] = useState("");

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const isSelf =
    actorUserId ===
    memberUserId;

  const isEditableState =
    planStatus === "forming" ||
    planStatus === "planned";

  const canAssignRole =
    actorRole === "host" &&
    !isSelf &&
    memberRole !== "host" &&
    isEditableState;

  const canTransferHost =
    actorRole === "host" &&
    !isSelf &&
    memberRole !== "host" &&
    isEditableState;

  const canRemove =
    !isSelf &&
    memberRole !== "host" &&
    isEditableState &&
    (
      actorRole === "host" ||
      (
        actorRole === "co_host" &&
        memberRole ===
          "participant"
      )
    );

  const canManage =
    canAssignRole ||
    canTransferHost ||
    canRemove;

  if (!canManage) {
    return null;
  }

  function openModal() {
    setActionMode(
      canAssignRole
        ? "role"
        : "remove"
    );
    setSelectedRole(
      memberRole === "co_host"
        ? "co_host"
        : "participant"
    );
    setPreviousHostRole(
      "co_host"
    );
    setRemovalReason("");
    setErrorMessage("");
    setIsOpen(true);
  }

  function closeModal() {
    if (isWorking) {
      return;
    }

    setIsOpen(false);
    setErrorMessage("");
    setRemovalReason("");
  }

  async function ensurePlanLeadEligibility() {
    const {
      data: isEligible,
      error,
    } = await supabase.rpc(
      "can_current_user_assign_plan_lead",
      {
        p_plan_id:
          planId,
        p_user_id:
          memberUserId,
      }
    );

    if (error) {
      throw error;
    }

    if (!isEligible) {
      throw new Error(
        "This person does not match the participant eligibility of every linked Intent."
      );
    }
  }

  async function updateRole() {
    if (
      selectedRole ===
        memberRole
    ) {
      closeModal();
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      if (selectedRole === "co_host") {
        await ensurePlanLeadEligibility();
      }

      const {
        error,
      } = await supabase.rpc(
        "set_shared_plan_member_role",
        {
          p_plan_id:
            planId,

          p_member_user_id:
            memberUserId,

          p_role:
            selectedRole,
        }
      );

      if (error) {
        throw error;
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function transferHost() {
    setIsWorking(true);
    setErrorMessage("");

    try {
      await ensurePlanLeadEligibility();

      const {
        error,
      } = await supabase.rpc(
        "transfer_shared_plan_primary_host",
        {
          p_plan_id:
            planId,

          p_new_host_user_id:
            memberUserId,

          p_previous_host_role:
            previousHostRole,
        }
      );

      if (error) {
        throw error;
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function removeMember() {
    const cleanedReason =
      removalReason.trim();

    if (!cleanedReason) {
      setErrorMessage(
        "A removal reason is required."
      );
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "remove_shared_plan_member",
        {
          p_plan_id:
            planId,

          p_member_user_id:
            memberUserId,

          p_reason:
            cleanedReason,
        }
      );

      if (error) {
        throw error;
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
      >
        Manage Member
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-950/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`plan-member-management-${memberUserId}`}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Shared Plan Member
                </p>

                <h2
                  id={`plan-member-management-${memberUserId}`}
                  className="mt-2 text-2xl font-bold text-gray-950"
                >
                  Manage {memberName}
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Current role:{" "}
                  <span className="font-semibold text-gray-800">
                    {memberRole ===
                    "co_host"
                      ? "Co-host"
                      : "Participant"}
                  </span>
                </p>
              </div>

              <button
                type="button"
                disabled={isWorking}
                onClick={closeModal}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 rounded-2xl bg-gray-100 p-1.5 sm:grid-cols-3">
              {canAssignRole && (
                <button
                  type="button"
                  onClick={() => {
                    setActionMode(
                      "role"
                    );
                    setErrorMessage("");
                  }}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    actionMode ===
                    "role"
                      ? "bg-white text-gray-950 shadow-sm"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Role
                </button>
              )}

              {canTransferHost && (
                <button
                  type="button"
                  onClick={() => {
                    setActionMode(
                      "transfer"
                    );
                    setErrorMessage("");
                  }}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    actionMode ===
                    "transfer"
                      ? "bg-white text-purple-700 shadow-sm"
                      : "text-gray-500 hover:text-purple-700"
                  }`}
                >
                  Transfer Host
                </button>
              )}

              {canRemove && (
                <button
                  type="button"
                  onClick={() => {
                    setActionMode(
                      "remove"
                    );
                    setErrorMessage("");
                  }}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    actionMode ===
                    "remove"
                      ? "bg-white text-red-700 shadow-sm"
                      : "text-gray-500 hover:text-red-700"
                  }`}
                >
                  Remove
                </button>
              )}
            </div>

            {actionMode ===
              "role" &&
              canAssignRole && (
              <section className="mt-6 rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-950">
                  Change Plan role
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Co-hosts can manage
                  planning, participants
                  and attendance. The
                  Primary Host keeps final
                  ownership authority.
                </p>

                <select
                  value={
                    selectedRole
                  }
                  disabled={isWorking}
                  onChange={(event) =>
                    setSelectedRole(
                      event.target
                        .value as
                        | "co_host"
                        | "participant"
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                >
                  <option value="co_host">
                    Co-host
                  </option>

                  <option value="participant">
                    Participant
                  </option>
                </select>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={
                    updateRole
                  }
                  className="mt-4 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {isWorking
                    ? "Updating..."
                    : "Update Role"}
                </button>
              </section>
            )}

            {actionMode ===
              "transfer" &&
              canTransferHost && (
              <section className="mt-6 rounded-2xl border border-purple-200 bg-purple-50 p-5">
                <h3 className="font-bold text-purple-950">
                  Transfer Primary Host
                </h3>

                <p className="mt-2 text-sm leading-6 text-purple-700">
                  {memberName} will become
                  the single Primary Host.
                  Choose your own role
                  after the transfer.
                </p>

                <select
                  value={
                    previousHostRole
                  }
                  disabled={isWorking}
                  onChange={(event) =>
                    setPreviousHostRole(
                      event.target
                        .value as
                        | "co_host"
                        | "participant"
                    )
                  }
                  className="mt-5 w-full rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="co_host">
                    Become Co-host
                  </option>

                  <option value="participant">
                    Become Participant
                  </option>
                </select>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={
                    transferHost
                  }
                  className="mt-4 w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {isWorking
                    ? "Transferring..."
                    : "Confirm Host Transfer"}
                </button>
              </section>
            )}

            {actionMode ===
              "remove" &&
              canRemove && (
              <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
                <h3 className="font-bold text-red-950">
                  Remove from Shared Plan
                </h3>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  The member leaves the
                  active Plan. The removal
                  and reason remain in
                  history.
                </p>

                <textarea
                  value={
                    removalReason
                  }
                  disabled={isWorking}
                  maxLength={500}
                  rows={5}
                  placeholder="Removal reason"
                  onChange={(event) => {
                    setRemovalReason(
                      event.target.value
                    );
                    setErrorMessage("");
                  }}
                  className="mt-5 w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />

                <p className="mt-2 text-right text-xs text-red-500">
                  {
                    removalReason.length
                  }
                  /500
                </p>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={
                    removeMember
                  }
                  className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {isWorking
                    ? "Removing..."
                    : "Remove Member"}
                </button>
              </section>
            )}

            {errorMessage && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
