"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type MatchOpportunityActionsProps = {
  ownIntentId: string;
  targetIntentId: string;
};

export default function MatchOpportunityActions({
  ownIntentId,
  targetIntentId,
}: MatchOpportunityActionsProps) {
  const router = useRouter();

  const [
    isRequestOpen,
    setIsRequestOpen,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    workingAction,
    setWorkingAction,
  ] = useState<
    "ignore" |
    "request" |
    null
  >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function ignoreMatch() {
    setWorkingAction(
      "ignore"
    );
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "ignore_intent_match",
        {
          p_own_intent_id:
            ownIntentId,

          p_target_intent_id:
            targetIntentId,
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
          : "The Match could not be ignored."
      );

      setWorkingAction(null);
    }
  }

  async function sendRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setWorkingAction(
      "request"
    );
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "create_intent_match_request",
        {
          p_own_intent_id:
            ownIntentId,

          p_target_intent_id:
            targetIntentId,

          p_message:
            message.trim() ||
            null,
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
          : "The request could not be sent."
      );

      setWorkingAction(null);
    }
  }

  return (
    <div className="mt-5">
      {!isRequestOpen ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={
              workingAction !==
              null
            }
            onClick={
              ignoreMatch
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {workingAction ===
            "ignore"
              ? "Ignoring..."
              : "Ignore"}
          </button>

          <button
            type="button"
            disabled={
              workingAction !==
              null
            }
            onClick={() => {
              setIsRequestOpen(
                true
              );
              setErrorMessage("");
            }}
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            Send Request
          </button>
        </div>
      ) : (
        <form
          onSubmit={
            sendRequest
          }
          className="rounded-2xl border border-green-200 bg-green-50/60 p-4"
        >
          <label>
            <span className="text-sm font-semibold text-gray-700">
              Message
            </span>

            <textarea
              value={message}
              rows={4}
              maxLength={1000}
              disabled={
                workingAction !==
                null
              }
              placeholder="Explain why your Intents could become one Activity."
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              className="mt-2 w-full resize-y rounded-xl border border-green-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={
                workingAction !==
                null
              }
              onClick={() => {
                setIsRequestOpen(
                  false
                );
                setMessage("");
                setErrorMessage("");
              }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                workingAction !==
                null
              }
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {workingAction ===
              "request"
                ? "Sending..."
                : "Send Request"}
            </button>
          </div>
        </form>
      )}

      {errorMessage && (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
