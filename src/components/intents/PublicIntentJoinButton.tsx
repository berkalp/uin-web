"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type Visibility =
  | "public"
  | "friends"
  | "except_friends"
  | "invite_only"
  | "private";

type PublicIntentJoinButtonProps = {
  intentId: string;
  planId?: string | null;
  activityName: string;
  recruitmentStatus:
    | "open"
    | "full";
  visibility: Visibility;
  viewerCanRequest: boolean;
  viewerIsMember?: boolean;
  viewerInvitationStatus?:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired"
    | null;
  initialRequestStatus:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | null;
  initialRequestId: string | null;
  isAuthenticated: boolean;
};

export default function PublicIntentJoinButton({
  intentId,
  planId = null,
  activityName,
  recruitmentStatus,
  visibility,
  viewerCanRequest,
  viewerIsMember = false,
  viewerInvitationStatus = null,
  initialRequestStatus,
  initialRequestId,
  isAuthenticated,
}: PublicIntentJoinButtonProps) {
  const router = useRouter();

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    isWorking,
    setIsWorking,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    requestStatus,
    setRequestStatus,
  ] = useState(
    initialRequestStatus
  );

  const [
    requestId,
    setRequestId,
  ] = useState(
    initialRequestId
  );

  async function submitRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "create_intent_join_request",
        {
          p_intent_id:
            intentId,

          p_message:
            message.trim() ||
            null,
        }
      );

      if (error) {
        throw error;
      }

      setRequestId(
        typeof data === "string"
          ? data
          : null
      );

      setRequestStatus(
        "pending"
      );

      setIsOpen(false);
      setMessage("");

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Join request could not be sent."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function withdrawRequest() {
    if (!requestId) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "withdraw_intent_join_request",
        {
          p_request_id:
            requestId,
        }
      );

      if (error) {
        throw error;
      }

      setRequestStatus(
        "withdrawn"
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Join request could not be withdrawn."
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (
    viewerIsMember ||
    requestStatus ===
      "accepted" ||
    viewerInvitationStatus ===
      "accepted"
  ) {
    return (
      <a
        href={
          planId
            ? `/plans/${encodeURIComponent(
                planId
              )}/planning`
            : "/timeline?view=participating"
        }
        className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100"
      >
        Open Shared Plan
      </a>
    );
  }

  if (
    visibility ===
      "invite_only"
  ) {
    if (
      viewerInvitationStatus ===
        "pending"
    ) {
      return (
        <a
          href="/intent-invitations"
          className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
        >
          View Invitation
        </a>
      );
    }

    return (
      <span className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700">
        Invite Only
      </span>
    );
  }

  if (
    recruitmentStatus ===
      "full"
  ) {
    return (
      <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
        Capacity Full
      </span>
    );
  }

  if (
    requestStatus ===
      "pending"
  ) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          Request Pending
        </span>

        <button
          type="button"
          disabled={isWorking}
          onClick={withdrawRequest}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Withdraw
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <a
        href="/"
        className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
      >
        Sign in to join
      </a>
    );
  }

  if (!viewerCanRequest) {
    return (
      <span className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600">
        Not Available to Join
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setErrorMessage("");
        }}
        className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
      >
        I&apos;m in
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-950/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !isWorking
            ) {
              setIsOpen(false);
            }
          }}
        >
          <form
            onSubmit={
              submitRequest
            }
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Request to Join
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Join {activityName}
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-500">
              The Primary Host or a
              Co-host will review your
              request.
            </p>

            <label className="mt-6 block">
              <span className="text-sm font-semibold text-gray-700">
                Message
              </span>

              <textarea
                value={message}
                disabled={isWorking}
                maxLength={500}
                rows={5}
                placeholder="Optional"
                onChange={(event) => {
                  setMessage(
                    event.target.value
                  );
                  setErrorMessage("");
                }}
                className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />

              <p className="mt-2 text-right text-xs text-gray-400">
                {message.length}/500
              </p>
            </label>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isWorking}
                onClick={() =>
                  setIsOpen(false)
                }
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isWorking}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {isWorking
                  ? "Sending..."
                  : "Send Request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
