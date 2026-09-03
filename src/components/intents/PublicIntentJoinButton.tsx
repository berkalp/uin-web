"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";
import {
  DEFAULT_JOIN_MESSAGE_PROMPT,
  normalizeJoinMessageMode,
  normalizeJoinMessagePrompt,
  type JoinMessageMode,
} from "@/utils/joinRequestMessage";

type Visibility =
  | "public"
  | "friends"
  | "except_friends"
  | "invite_only"
  | "private";

type JoinMessageSettingsRow = {
  join_message_mode?: unknown;
  join_message_prompt?: unknown;
};

type PublicIntentJoinButtonProps = {
  intentId: string;
  planId?: string | null;
  activityName: string;
  recruitmentStatus:
    | "open"
    | "full";
  visibility: Visibility;
  viewerCanRequest: boolean;
  viewerIsEligible?: boolean;
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
  viewerIsEligible = true,
  viewerIsMember = false,
  viewerInvitationStatus = null,
  initialRequestStatus,
  initialRequestId,
  isAuthenticated,
}: PublicIntentJoinButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [joinMessageMode, setJoinMessageMode] =
    useState<JoinMessageMode>(
      "optional"
    );

  const [joinMessagePrompt, setJoinMessagePrompt] =
    useState(
      DEFAULT_JOIN_MESSAGE_PROMPT
    );

  const [isLoadingSettings, setIsLoadingSettings] =
    useState(false);

  const [hasLoadedSettings, setHasLoadedSettings] =
    useState(false);

  const [isWorking, setIsWorking] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [requestStatus, setRequestStatus] =
    useState(initialRequestStatus);

  const [requestId, setRequestId] =
    useState(initialRequestId);

  async function openRequestDialog() {
    setIsOpen(true);
    setIsLoadingSettings(true);
    setHasLoadedSettings(false);
    setErrorMessage("");
    setMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "get_intent_join_message_settings",
          {
            p_intent_id: intentId,
          }
        );

      if (error) {
        throw error;
      }

      const row =
        Array.isArray(data)
          ? (data[0] as JoinMessageSettingsRow | undefined)
          : (data as JoinMessageSettingsRow | null);

      if (!row) {
        throw new Error(
          "Katılım isteği ayarları yüklenemedi."
        );
      }

      const nextMode =
        normalizeJoinMessageMode(
          row.join_message_mode
        );

      setJoinMessageMode(
        nextMode
      );

      setJoinMessagePrompt(
        normalizeJoinMessagePrompt(
          nextMode,
          row.join_message_prompt
        )
      );

      setHasLoadedSettings(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Katılım isteği ayarları yüklenemedi."
      );
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function submitRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!hasLoadedSettings) {
      setErrorMessage(
        "Katılım isteği ayarları yüklenemedi."
      );
      return;
    }

    const cleanedMessage =
      message.trim();

    if (
      joinMessageMode ===
        "required" &&
      !cleanedMessage
    ) {
      setErrorMessage(
        "İsteği göndermeden önce yürütücünün sorusunu yanıtla."
      );
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "create_intent_join_request",
          {
            p_intent_id:
              intentId,
            p_message:
              joinMessageMode ===
              "none"
                ? null
                : cleanedMessage ||
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
          : "Katılım isteği gönderilemedi."
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
      const { error } =
        await supabase.rpc(
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
          : "Katılım isteği geri çekilemedi."
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
        Niyet Odasını Aç
      </a>
    );
  }

  if (!viewerIsEligible) {
    return (
      <span className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        Bu Niyete katılma koşullarını karşılamıyorsun.
      </span>
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
          Daveti Gör
        </a>
      );
    }

    return (
      <span className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700">
        Yalnız Davet
      </span>
    );
  }

  if (
    recruitmentStatus ===
      "full"
  ) {
    return (
      <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
        Kontenjan Dolu
      </span>
    );
  }

  if (
    requestStatus ===
      "pending"
  ) {
    return (
      <div className="inline-flex max-w-full items-center gap-1">
        <span className="inline-flex h-6 items-center whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-2 text-[9px] font-semibold leading-none text-amber-700">
          İstek Bekliyor
        </span>

        <button
          type="button"
          disabled={isWorking}
          onClick={withdrawRequest}
          className="inline-flex h-6 items-center whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 text-[9px] font-semibold leading-none text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Geri Çek
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

  const answerIsMissing =
    joinMessageMode ===
      "required" &&
    !message.trim();

  return (
    <>
      <button
        type="button"
        onClick={openRequestDialog}
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
            onSubmit={submitRequest}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Katılım İsteği
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              {activityName} için Ben de varım
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-500">
              Ana Yürüten veya Birlikte Yürüten isteğini değerlendirecek.
            </p>

            {isLoadingSettings ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm font-semibold text-gray-600">
                Loading request settings...
              </div>
            ) : joinMessageMode ===
              "none" ? (
              <div className="mt-6 rounded-2xl border border-green-100 bg-green-50 p-5">
                <p className="text-sm font-semibold text-green-900">
                  No message is requested
                </p>

                <p className="mt-2 text-sm leading-6 text-green-800">
                  The host only needs your participation request. You can send it without writing a message.
                </p>
              </div>
            ) : (
              <label className="mt-6 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Host asks
                </span>

                <span className="mt-2 block text-base font-semibold leading-7 text-gray-900">
                  {joinMessagePrompt}
                </span>

                <textarea
                  value={message}
                  disabled={isWorking}
                  required={
                    joinMessageMode ===
                    "required"
                  }
                  maxLength={500}
                  rows={5}
                  placeholder={
                    joinMessageMode ===
                    "required"
                      ? "Yanıtın"
                      : "İsteğe bağlı yanıt"
                  }
                  onChange={(event) => {
                    setMessage(
                      event.target.value
                    );
                    setErrorMessage("");
                  }}
                  className="mt-3 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />

                <p className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                  <span>
                    {joinMessageMode ===
                    "required"
                      ? "Zorunlu"
                      : "İsteğe bağlı"}
                  </span>

                  <span>
                    {message.length}/500
                  </span>
                </p>
              </label>
            )}

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
                disabled={
                  isWorking ||
                  isLoadingSettings ||
                  !hasLoadedSettings ||
                  answerIsMissing
                }
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWorking
                  ? "Gönderiliyor..."
                  : "İsteği Gönder"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

