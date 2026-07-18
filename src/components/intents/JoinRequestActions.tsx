"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type JoinRequestActionsProps = {
  requestId: string;
  requesterName: string;
};

export default function JoinRequestActions({
  requestId,
  requesterName,
}: JoinRequestActionsProps) {
  const router = useRouter();

  const [
    reason,
    setReason,
  ] = useState("");

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
        data,
        error,
      } = await supabase.rpc(
        "respond_intent_join_request",
        {
          p_request_id:
            requestId,

          p_response:
            response,

          p_reason:
            response === "decline"
              ? reason.trim() ||
                null
              : null,
        }
      );

      if (error) {
        throw error;
      }

      if (
        response === "accept" &&
        typeof data === "string"
      ) {
        router.push(
          `/plans/${encodeURIComponent(
            data
          )}/planning`
        );
        return;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Join request could not be updated."
      );
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-5">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Decline reason
        </span>

        <textarea
          value={reason}
          disabled={isWorking}
          maxLength={500}
          rows={3}
          placeholder="Optional"
          onChange={(event) => {
            setReason(
              event.target.value
            );
            setErrorMessage("");
          }}
          className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none focus:border-red-500"
        />
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
          disabled={isWorking}
          onClick={() =>
            respond("accept")
          }
          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {isWorking
            ? "Updating..."
            : `Accept ${requesterName}`}
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
