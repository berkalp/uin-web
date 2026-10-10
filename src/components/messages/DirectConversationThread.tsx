"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type DirectConversationDetail,
  type DirectConversationMessage,
  extendDirectConversationAccess,
  markDirectConversationRead,
  revokeDirectConversationAccess,
  sendDirectMessage,
} from "@/services/directMessageService";
import { supabase } from "@/utils/supabase/client";

type AccessPreset = "1d" | "7d" | "30d" | "1y" | "20y" | "custom";

type DirectConversationThreadProps = {
  currentUserId: string;
  detail: DirectConversationDetail;
  messages: DirectConversationMessage[];
};

type ThreadSnapshotState = {
  conversationId: string;
  liveMessages: DirectConversationMessage[];
  previousMessages: DirectConversationMessage[];
  refreshError: boolean;
  hasClientSnapshotSinceServer: boolean;
  serverGeneration: number;
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function addPreset(now: Date, preset: AccessPreset) {
  const result = new Date(now);
  if (preset === "1d") result.setDate(result.getDate() + 1);
  if (preset === "7d") result.setDate(result.getDate() + 7);
  if (preset === "30d") result.setDate(result.getDate() + 30);
  if (preset === "1y") result.setFullYear(result.getFullYear() + 1);
  if (preset === "20y") result.setFullYear(result.getFullYear() + 20);
  return result;
}

function sameMessageSnapshot(
  previous: DirectConversationMessage[],
  next: DirectConversationMessage[]
) {
  if (previous.length !== next.length) return false;
  return previous.every((message, index) => {
    const candidate = next[index];
    return candidate?.message_id === message.message_id &&
      candidate?.sender_id === message.sender_id &&
      candidate?.sender_full_name === message.sender_full_name &&
      candidate?.sender_username === message.sender_username &&
      candidate?.sender_avatar_url === message.sender_avatar_url &&
      candidate?.body === message.body &&
      candidate?.created_at === message.created_at;
  });
}

function messageVersion(message: DirectConversationMessage | undefined) {
  if (!message) return { timestamp: 0, id: "" };
  const parsed = Date.parse(message.created_at);
  return {
    timestamp: Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY,
    id: message.message_id,
  };
}

function compareMessageSnapshots(
  current: DirectConversationMessage[],
  candidate: DirectConversationMessage[]
) {
  const currentVersion = messageVersion(current[current.length - 1]);
  const candidateVersion = messageVersion(candidate[candidate.length - 1]);
  if (candidateVersion.timestamp !== currentVersion.timestamp) {
    return candidateVersion.timestamp - currentVersion.timestamp;
  }
  if (candidateVersion.id === currentVersion.id) return 0;
  return candidateVersion.id > currentVersion.id ? 1 : -1;
}

function isConversationMessage(value: unknown): value is DirectConversationMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;

  return typeof row.message_id === "string" &&
    typeof row.sender_id === "string" &&
    (row.sender_full_name === null || typeof row.sender_full_name === "string") &&
    (row.sender_username === null || typeof row.sender_username === "string") &&
    (row.sender_avatar_url === null || typeof row.sender_avatar_url === "string") &&
    typeof row.body === "string" &&
    typeof row.created_at === "string";
}

export default function DirectConversationThread({
  currentUserId,
  detail,
  messages,
}: DirectConversationThreadProps) {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const [snapshotState, setSnapshotState] = useState<ThreadSnapshotState>(() => ({
    conversationId: detail.conversation_id,
    liveMessages: messages,
    previousMessages: messages,
    refreshError: false,
    hasClientSnapshotSinceServer: false,
    serverGeneration: 0,
  }));
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preset, setPreset] = useState<AccessPreset>("1d");
  const [customExpiry, setCustomExpiry] = useState(() =>
    toLocalDateTimeInput(addPreset(new Date(), "1d"))
  );
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const refreshGenerationRef = useRef(0);

  if (snapshotState.conversationId !== detail.conversation_id) {
    // Invalidate every request captured by the previous route before showing
    // the next conversation's server-verified snapshot.
    setSnapshotState({
      conversationId: detail.conversation_id,
      liveMessages: messages,
      previousMessages: messages,
      refreshError: false,
      hasClientSnapshotSinceServer: false,
      serverGeneration: snapshotState.serverGeneration + 1,
    });
  } else if (snapshotState.previousMessages !== messages) {
    const comparison = compareMessageSnapshots(snapshotState.liveMessages, messages);
    if ((!snapshotState.hasClientSnapshotSinceServer && comparison >= 0) ||
      comparison > 0 || sameMessageSnapshot(snapshotState.liveMessages, messages)) {
      // An RSC refresh may resolve behind the realtime read. Last message
      // timestamp + UUID is the database ordering/version for this append-only
      // message window, so an older server snapshot must not roll it back.
      setSnapshotState({
        conversationId: detail.conversation_id,
        liveMessages: messages,
        previousMessages: messages,
        refreshError: false,
        hasClientSnapshotSinceServer: false,
        serverGeneration: snapshotState.serverGeneration + 1,
      });
    } else {
      setSnapshotState({ ...snapshotState, previousMessages: messages });
    }
  }

  const { liveMessages, refreshError, serverGeneration } = snapshotState;

  const refreshMessages = useCallback(async () => {
    const conversationId = detail.conversation_id;
    const requestGeneration = ++refreshGenerationRef.current;
    const requestServerGeneration = serverGeneration;
    const { data, error } = await supabase.rpc(
      "get_direct_conversation_messages",
      {
        p_conversation_id: conversationId,
        p_limit: 300,
      }
    );

    if (requestGeneration !== refreshGenerationRef.current) return null;

    if (error || !Array.isArray(data) || !data.every(isConversationMessage)) {
      console.error(
        "Live direct message refresh failed:",
        error ?? "Incomplete message payload"
      );
      setSnapshotState((current) =>
        requestServerGeneration === current.serverGeneration &&
        conversationId === current.conversationId
          ? { ...current, refreshError: true }
          : current
      );
      return null;
    }

    const next = data as DirectConversationMessage[];

    setSnapshotState((current) => {
      if (requestServerGeneration !== current.serverGeneration ||
        conversationId !== current.conversationId) return current;
      const liveMessages = compareMessageSnapshots(current.liveMessages, next) < 0
        ? current.liveMessages
        : sameMessageSnapshot(current.liveMessages, next)
          ? current.liveMessages
          : next;
      return {
        ...current,
        liveMessages,
        refreshError: false,
        hasClientSnapshotSinceServer: true,
      };
    });

    return next;
  }, [detail.conversation_id, serverGeneration]);

  useEffect(() => {
    void markDirectConversationRead(detail.conversation_id).catch(() => {
      // Reading the thread should never be blocked by a badge update failure.
    });
  }, [detail.conversation_id]);

  useEffect(() => {
    const channel = supabase
      .channel(`direct-conversation:${detail.conversation_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_message_realtime_signals",
          filter: `conversation_id=eq.${detail.conversation_id}`,
        },
        async () => {
          const next = await refreshMessages();
          const latest = next?.[next.length - 1];

          if (
            latest &&
            latest.sender_id !== currentUserId &&
            document.visibilityState === "visible"
          ) {
            void markDirectConversationRead(detail.conversation_id).catch(() => {
              // The message should remain visible even if the read marker fails.
            });
          }
        }
      )
      .subscribe();

    const reconcile = async () => {
      if (document.visibilityState !== "visible") return;

      const next = await refreshMessages();
      const latest = next?.[next.length - 1];

      if (latest && latest.sender_id !== currentUserId) {
        void markDirectConversationRead(detail.conversation_id).catch(() => {
          // Do not block message refresh because of a read-marker failure.
        });
      }
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    // Reconcile occasionally in case a laptop sleeps or the realtime socket
    // briefly disconnects. Normal delivery is event-driven, not polling.
    const fallbackTimer = window.setInterval(() => {
      void reconcile();
    }, 15_000);

    void reconcile();

    return () => {
      refreshGenerationRef.current += 1;
      window.clearInterval(fallbackTimer);
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      void supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    detail.conversation_id,
    refreshMessages,
  ]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) return;

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, [liveMessages.length]);

  const otherName = detail.other_full_name || detail.other_username || "UIN member";
  const otherProfileHref = detail.other_username
    ? `/u/${encodeURIComponent(detail.other_username)}`
    : null;

  const accessSummary = useMemo(() => {
    if (detail.viewer_access_kind === "staff") {
      return detail.viewer_can_send
        ? "Staff messaging access is active."
        : "Your staff messaging permission is not active.";
    }

    if (!detail.viewer_access_expires_at) {
      return detail.viewer_can_send
        ? "Messaging access is active."
        : "Messaging access is not active.";
    }

    return detail.viewer_can_send
      ? `You can send messages until ${formatDateTime(detail.viewer_access_expires_at)}.`
      : `Your send access expired on ${formatDateTime(detail.viewer_access_expires_at)}.`;
  }, [
    detail.viewer_access_expires_at,
    detail.viewer_access_kind,
    detail.viewer_can_send,
  ]);

  function resolveExpiry() {
    if (preset === "custom") {
      const parsed = new Date(customExpiry);
      if (!Number.isFinite(parsed.getTime())) {
        throw new Error("Choose a valid expiry.");
      }
      return parsed.toISOString();
    }

    return addPreset(new Date(), preset).toISOString();
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const cleanBody = body.trim();
    if (!cleanBody) return;

    try {
      setIsSending(true);
      await sendDirectMessage(detail.conversation_id, cleanBody);
      setBody("");

      // Do not wait for the realtime round-trip to show the sender's own message.
      await refreshMessages();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The message could not be sent."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleExtendAccess() {
    setErrorMessage(null);

    try {
      setIsUpdatingAccess(true);
      await extendDirectConversationAccess({
        conversationId: detail.conversation_id,
        targetUserId: detail.other_user_id,
        expiresAt: resolveExpiry(),
      });
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Access could not be updated."
      );
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  async function handleRevokeAccess() {
    if (
      !window.confirm(
        `Stop ${otherName} from sending new messages in this conversation?`
      )
    ) {
      return;
    }

    setErrorMessage(null);

    try {
      setIsUpdatingAccess(true);
      await revokeDirectConversationAccess({
        conversationId: detail.conversation_id,
        targetUserId: detail.other_user_id,
      });
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Access could not be revoked."
      );
    } finally {
      setIsUpdatingAccess(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-100 px-5 py-4 md:px-6">
          <div className="flex items-center gap-3">
            {detail.other_avatar_url ? (
              <img
                src={detail.other_avatar_url}
                alt={otherName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600">
                {getInitial(otherName)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {otherProfileHref ? (
                <Link
                  href={otherProfileHref}
                  className="font-bold text-gray-950 hover:text-green-700"
                >
                  {otherName}
                </Link>
              ) : (
                <p className="font-bold text-gray-950">{otherName}</p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {detail.other_username && <span>@{detail.other_username}</span>}

                {detail.other_is_staff && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                    UIN staff
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div
          ref={messageListRef}
          className="max-h-[62vh] min-h-[420px] space-y-4 overflow-y-auto bg-gray-50/60 p-5 md:p-6"
        >
          {liveMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              No messages yet.
            </div>
          ) : (
            liveMessages.map((message) => {
              const isMine = message.sender_id === currentUserId;

              return (
                <div
                  key={message.message_id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <article
                    className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[72%] ${
                      isMine
                        ? "bg-green-600 text-white"
                        : "border border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                      {message.body}
                    </p>

                    <p
                      className={`mt-2 text-[11px] ${
                        isMine ? "text-green-100" : "text-gray-400"
                      }`}
                    >
                      {formatDateTime(message.created_at)}
                    </p>
                  </article>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="border-t border-gray-100 p-4 md:p-5"
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={!detail.viewer_can_send || isSending}
            maxLength={5000}
            rows={3}
            placeholder={
              detail.viewer_can_send
                ? `Message ${otherName}...`
                : "Messaging access is closed. You can still read the conversation."
            }
            className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          />

          {errorMessage && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          {refreshError && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              <p>New messages could not be verified. The previous verified conversation is still shown.</p>
              <button
                type="button"
                onClick={() => void refreshMessages()}
                className="mt-2 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p
              className={`text-xs font-semibold ${
                detail.viewer_can_send ? "text-green-700" : "text-amber-700"
              }`}
            >
              {accessSummary}
            </p>

            <button
              type="submit"
              disabled={!detail.viewer_can_send || isSending || !body.trim()}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
            Conversation access
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">
            {detail.other_is_staff ? "Staff channel" : "Member access"}
          </h2>

          {detail.other_is_staff ? (
            <p className="mt-3 text-sm leading-6 text-gray-600">
              This staff-to-staff thread stays open while both staff accounts retain messaging permission.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {detail.other_access_revoked_at
                  ? `Sending access was revoked on ${formatDateTime(detail.other_access_revoked_at)}.`
                  : detail.other_access_expires_at
                    ? `This member may send messages until ${formatDateTime(detail.other_access_expires_at)}.`
                    : "This member does not currently have send access."}
              </p>

              {detail.viewer_can_manage_access && (
                <div className="mt-5 border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Change access
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {([
                      ["1d", "1 day"],
                      ["7d", "7 days"],
                      ["30d", "30 days"],
                      ["1y", "1 year"],
                      ["20y", "20 years"],
                      ["custom", "Custom"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setPreset(value);

                          if (value !== "custom") {
                            setCustomExpiry(
                              toLocalDateTimeInput(
                                addPreset(new Date(), value)
                              )
                            );
                          }
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          preset === value
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:border-green-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {preset === "custom" && (
                    <input
                      type="datetime-local"
                      value={customExpiry}
                      onChange={(event) => setCustomExpiry(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                    />
                  )}

                  <button
                    type="button"
                    disabled={isUpdatingAccess}
                    onClick={handleExtendAccess}
                    className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isUpdatingAccess ? "Updating..." : "Apply new access"}
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingAccess}
                    onClick={handleRevokeAccess}
                    className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke sending access
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-3xl border border-blue-200 bg-blue-50/50 p-5 text-sm leading-6 text-blue-900">
          UIN does not enable general member-to-member DMs. This conversation exists because a staff messaging channel was explicitly opened.
        </section>
      </aside>
    </div>
  );
}
