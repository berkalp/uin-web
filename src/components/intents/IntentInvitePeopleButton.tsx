"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type IntentInvitePeopleButtonProps = {
  intentId: string;
  activityLabel: string;
  compact?: boolean;
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

  return "The Intent invitation could not be sent.";
}

export default function IntentInvitePeopleButton({
  intentId,
  activityLabel,
  compact = false,
}: IntentInvitePeopleButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);
  const [username, setUsername] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [isSending, setIsSending] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  function closeModal() {
    if (isSending) {
      return;
    }

    setIsOpen(false);
    setUsername("");
    setMessage("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedUsername =
      username
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

    if (!cleanedUsername) {
      setErrorMessage(
        "Enter the exact UIN username."
      );
      return;
    }

    setIsSending(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username"
        )
        .ilike(
          "username",
          cleanedUsername
        )
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        throw new Error(
          "No UIN profile was found with that username."
        );
      }

      const {
        error: invitationError,
      } = await supabase.rpc(
        "create_intent_invitation",
        {
          p_intent_id:
            intentId,
          p_invited_user_id:
            profile.id,
          p_message:
            message.trim() ||
            null,
        }
      );

      if (invitationError) {
        throw invitationError;
      }

      setSuccessMessage(
        `Invitation sent to @${profile.username}.`
      );
      setUsername("");
      setMessage("");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setErrorMessage("");
          setSuccessMessage("");
        }}
        className={
          compact
            ? "rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
            : "rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
        }
      >
        Invite People
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-gray-950/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`intent-invite-title-${intentId}`}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                  Intent Invitation
                </p>

                <h2
                  id={`intent-invite-title-${intentId}`}
                  className="mt-2 text-2xl font-bold text-gray-950"
                >
                  Invite someone to join
                </h2>
              </div>

              <button
                type="button"
                disabled={isSending}
                onClick={closeModal}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Activity
              </p>

              <p className="mt-2 font-bold text-purple-950">
                {activityLabel}
              </p>

              <p className="mt-2 text-sm leading-6 text-purple-700">
                The invited person joins
                as a Participant after
                accepting. A Shared Plan
                is created automatically
                when needed.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  UIN username
                </span>

                <div className="mt-2 flex rounded-xl border border-gray-200 bg-white focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100">
                  <span className="flex items-center pl-4 text-gray-400">
                    @
                  </span>

                  <input
                    type="text"
                    value={username}
                    disabled={isSending}
                    maxLength={40}
                    autoComplete="off"
                    placeholder="username"
                    onChange={(event) => {
                      setUsername(
                        event.target.value
                      );
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-3 text-sm text-gray-900 outline-none disabled:cursor-not-allowed"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  Invitation message
                </span>

                <textarea
                  value={message}
                  disabled={isSending}
                  maxLength={500}
                  rows={5}
                  placeholder="Optional"
                  onChange={(event) => {
                    setMessage(
                      event.target.value
                    );
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:bg-gray-100"
                />

                <p className="mt-2 text-right text-xs text-gray-400">
                  {message.length}/500
                </p>
              </label>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {errorMessage}
                  </p>
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-800">
                    {successMessage}
                  </p>

                  <a
                    href="/intent-invitations?view=sent"
                    className="mt-2 inline-flex text-sm font-semibold text-green-700 underline"
                  >
                    View sent invitations
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={isSending}
                className="w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending
                  ? "Sending Invitation..."
                  : "Send Invitation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
