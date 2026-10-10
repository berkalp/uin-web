"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { DirectConversationSummary } from "@/services/directMessageService";
import { supabase } from "@/utils/supabase/client";

type DirectConversationListProps = {
  initialConversations: DirectConversationSummary[];
  initialLoadFailed?: boolean;
  page?: number;
  roomPage?: number;
};

type ConversationListState = {
  conversations: DirectConversationSummary[];
  loadFailed: boolean;
  previousInitialConversations: DirectConversationSummary[];
  previousInitialLoadFailed: boolean;
  hasClientSnapshotSinceServer: boolean;
  serverGeneration: number;
};

const PAGE_SIZE = 5;

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function formatDateTime(value: string | null) {
  if (!value) return "No messages yet";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isConversationSummary(value: unknown): value is DirectConversationSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const unreadCount = row.unread_count;
  const parsedUnread = unreadCount === null ||
    ((typeof unreadCount === "number" || typeof unreadCount === "string") &&
      Number.isFinite(Number(unreadCount)) && Number(unreadCount) >= 0);

  return typeof row.conversation_id === "string" &&
    typeof row.other_user_id === "string" &&
    isNullableString(row.other_full_name) &&
    isNullableString(row.other_username) &&
    isNullableString(row.other_avatar_url) &&
    isNullableString(row.last_message_body) &&
    isNullableString(row.last_message_at) &&
    isNullableString(row.last_message_sender_id) &&
    parsedUnread &&
    typeof row.viewer_can_send === "boolean" &&
    (row.viewer_access_kind === null || row.viewer_access_kind === "staff" || row.viewer_access_kind === "granted") &&
    isNullableString(row.viewer_access_expires_at);
}

function sameConversation(
  previous: DirectConversationSummary,
  next: DirectConversationSummary | undefined
) {
  return next?.conversation_id === previous.conversation_id &&
    next.other_user_id === previous.other_user_id &&
    next.other_full_name === previous.other_full_name &&
    next.other_username === previous.other_username &&
    next.other_avatar_url === previous.other_avatar_url &&
    next.last_message_at === previous.last_message_at &&
    next.last_message_body === previous.last_message_body &&
    next.last_message_sender_id === previous.last_message_sender_id &&
    toNumber(next.unread_count) === toNumber(previous.unread_count) &&
    next.viewer_can_send === previous.viewer_can_send &&
    next.viewer_access_kind === previous.viewer_access_kind &&
    next.viewer_access_expires_at === previous.viewer_access_expires_at;
}

function sameConversationSnapshot(
  previous: DirectConversationSummary[],
  next: DirectConversationSummary[]
) {
  return previous.length === next.length &&
    previous.every((conversation, index) => sameConversation(conversation, next[index]));
}

function messageTimestamp(value: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function isConversationSnapshotAtLeastAsFresh(
  current: DirectConversationSummary[],
  candidate: DirectConversationSummary[]
) {
  const candidateById = new Map(
    candidate.map((conversation) => [conversation.conversation_id, conversation])
  );

  return current.every((conversation) => {
    const next = candidateById.get(conversation.conversation_id);
    return Boolean(
      next &&
      messageTimestamp(next.last_message_at) >= messageTimestamp(conversation.last_message_at)
    );
  });
}

function canServerSnapshotReplaceClient(
  current: DirectConversationSummary[],
  candidate: DirectConversationSummary[]
) {
  const candidateById = new Map(
    candidate.map((conversation) => [conversation.conversation_id, conversation])
  );

  return current.every((conversation) => {
    const next = candidateById.get(conversation.conversation_id);
    if (!next) return false;
    const nextTimestamp = messageTimestamp(next.last_message_at);
    const currentTimestamp = messageTimestamp(conversation.last_message_at);
    return nextTimestamp > currentTimestamp || sameConversation(conversation, next);
  });
}

export default function DirectConversationList({
  initialConversations,
  initialLoadFailed = false,
  page = 1,
  roomPage = 1,
}: DirectConversationListProps) {
  const [listState, setListState] = useState<ConversationListState>(() => ({
    conversations: initialConversations,
    loadFailed: initialLoadFailed,
    previousInitialConversations: initialConversations,
    previousInitialLoadFailed: initialLoadFailed,
    hasClientSnapshotSinceServer: false,
    serverGeneration: 0,
  }));
  const refreshGenerationRef = useRef(0);

  if (
    listState.previousInitialConversations !== initialConversations ||
    listState.previousInitialLoadFailed !== initialLoadFailed
  ) {
    if (initialLoadFailed || !initialConversations.every(isConversationSummary)) {
      // A server refresh may transiently fail and send an empty placeholder.
      // Keep the last verified client snapshot instead of erasing the inbox.
      setListState({
        ...listState,
        loadFailed: true,
        previousInitialConversations: initialConversations,
        previousInitialLoadFailed: initialLoadFailed,
      });
    } else if (!listState.hasClientSnapshotSinceServer ||
      canServerSnapshotReplaceClient(listState.conversations, initialConversations)) {
      // A server refresh can finish after a newer realtime client read. Only a
      // snapshot that preserves identical rows or advances their last-message
      // timestamp may replace that newer client snapshot.
      setListState({
        conversations: initialConversations,
        loadFailed: false,
        previousInitialConversations: initialConversations,
        previousInitialLoadFailed: initialLoadFailed,
        hasClientSnapshotSinceServer: false,
        serverGeneration: listState.serverGeneration + 1,
      });
    } else {
      setListState({
        ...listState,
        previousInitialConversations: initialConversations,
        previousInitialLoadFailed: initialLoadFailed,
      });
    }
  }

  const { conversations, loadFailed, serverGeneration } = listState;

  const refreshConversations = useCallback(async () => {
    const requestGeneration = ++refreshGenerationRef.current;
    const requestServerGeneration = serverGeneration;
    const { data, error } = await supabase.rpc("get_my_direct_conversations");

    if (requestGeneration !== refreshGenerationRef.current) return;

    if (error || !Array.isArray(data) || !data.every(isConversationSummary)) {
      console.error(
        "Live direct conversations refresh failed:",
        error ?? "Incomplete conversation payload"
      );
      setListState((current) => requestServerGeneration === current.serverGeneration
        ? { ...current, loadFailed: true }
        : current);
      return;
    }

    const next = data as DirectConversationSummary[];

    setListState((current) => {
      if (requestServerGeneration !== current.serverGeneration) return current;
      const conversations = isConversationSnapshotAtLeastAsFresh(
        current.conversations,
        next
      )
        ? sameConversationSnapshot(current.conversations, next)
          ? current.conversations
          : next
        : current.conversations;
      return {
        ...current,
        conversations,
        loadFailed: false,
        hasClientSnapshotSinceServer: true,
      };
    });
  }, [serverGeneration]);

  useEffect(() => {
    const channel = supabase
      .channel("direct-message-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_message_realtime_signals",
        },
        () => {
          void refreshConversations();
        }
      )
      .subscribe();

    const reconcile = () => {
      if (document.visibilityState === "visible") {
        void refreshConversations();
      }
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    // Safety reconciliation in case the browser briefly loses the realtime socket.
    const fallbackTimer = window.setInterval(reconcile, 30_000);

    return () => {
      refreshGenerationRef.current += 1;
      window.clearInterval(fallbackTimer);
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      void supabase.removeChannel(channel);
    };
  }, [refreshConversations]);

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (total, conversation) => total + toNumber(conversation.unread_count),
        0
      ),
    [conversations]
  );

  const pageCount = Math.max(1, Math.ceil(conversations.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const visibleConversations = conversations.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    params.set("roomPage", String(roomPage));
    params.set("directPage", String(targetPage));
    return `/messages?${params.toString()}`;
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Direct conversations
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">Direct Messages</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Staff-created one-to-one conversations. General member-to-member DMs remain closed.
          </p>
        </div>

        <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          {loadFailed ? "— unread" : `${unreadTotal} unread`}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loadFailed && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            <p>Conversations could not be refreshed. The previous verified list is kept on screen.</p>
            <button
              type="button"
              onClick={() => void refreshConversations()}
              className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white"
            >
              Retry
            </button>
          </div>
        )}

        {!loadFailed && conversations.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-bold text-gray-900">No conversations yet</p>
            <p className="mt-2 text-sm text-gray-500">
              A staff member can open a direct channel when there is a reason to talk.
            </p>
          </div>
        )}

        {visibleConversations.map((conversation) => {
          const displayName =
            conversation.other_full_name ||
            conversation.other_username ||
            "UIN member";
          const unreadCount = toNumber(conversation.unread_count);

          return (
            <Link
              key={conversation.conversation_id}
              href={`/messages/${encodeURIComponent(conversation.conversation_id)}`}
              className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
            >
              {conversation.other_avatar_url ? (
                <img
                  src={conversation.other_avatar_url}
                  alt={displayName}
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-50 text-lg font-bold text-green-700">
                  {getInitial(displayName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-bold text-gray-950">{displayName}</h2>

                  {conversation.viewer_access_kind === "staff" && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      STAFF CHANNEL
                    </span>
                  )}

                  {!conversation.viewer_can_send && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                      READ ONLY
                    </span>
                  )}
                </div>

                <p className="mt-1 truncate text-sm text-gray-500">
                  {conversation.last_message_body || "Conversation opened"}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {formatDateTime(conversation.last_message_at)}
                </p>
              </div>

              {unreadCount > 0 && (
                <span className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-green-600 px-2 text-xs font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}

              <span className="text-gray-300">→</span>
            </Link>
          );
        })}

        {conversations.length > PAGE_SIZE && (
          <nav
            aria-label="Direct conversation pages"
            className="flex flex-wrap items-center justify-between gap-3 pt-2"
          >
            <p className="text-xs font-semibold text-gray-400">
              Sayfa {safePage} / {pageCount} · Her sayfada en fazla {PAGE_SIZE} konuşma
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={pageHref(Math.max(1, safePage - 1))}
                aria-disabled={safePage === 1}
                className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                  safePage === 1
                    ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
                    : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
                }`}
              >
                Önceki
              </Link>

              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={pageHref(pageNumber)}
                    className={`min-w-10 rounded-xl px-3.5 py-2 text-center text-sm font-black transition ${
                      pageNumber === safePage
                        ? "bg-gray-950 text-white"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
                    }`}
                  >
                    {pageNumber}
                  </Link>
                )
              )}

              <Link
                href={pageHref(Math.min(pageCount, safePage + 1))}
                aria-disabled={safePage === pageCount}
                className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
                  safePage === pageCount
                    ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
                    : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
                }`}
              >
                Sonraki
              </Link>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}
