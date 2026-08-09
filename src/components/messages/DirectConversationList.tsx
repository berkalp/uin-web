"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { DirectConversationSummary } from "@/services/directMessageService";
import { supabase } from "@/utils/supabase/client";

type DirectConversationListProps = {
  initialConversations: DirectConversationSummary[];
  initialLoadFailed?: boolean;
};

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

function sameConversationSnapshot(
  previous: DirectConversationSummary[],
  next: DirectConversationSummary[]
) {
  if (previous.length !== next.length) return false;

  return previous.every((conversation, index) => {
    const candidate = next[index];

    return (
      candidate?.conversation_id === conversation.conversation_id &&
      candidate?.last_message_at === conversation.last_message_at &&
      candidate?.last_message_body === conversation.last_message_body &&
      toNumber(candidate?.unread_count) === toNumber(conversation.unread_count) &&
      candidate?.viewer_can_send === conversation.viewer_can_send &&
      candidate?.viewer_access_expires_at === conversation.viewer_access_expires_at
    );
  });
}

export default function DirectConversationList({
  initialConversations,
  initialLoadFailed = false,
}: DirectConversationListProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);

  useEffect(() => {
    setConversations(initialConversations);
    setLoadFailed(initialLoadFailed);
  }, [initialConversations, initialLoadFailed]);

  const refreshConversations = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_direct_conversations");

    if (error) {
      console.error("Live direct conversations refresh failed:", error);
      setLoadFailed(true);
      return;
    }

    const next = (data ?? []) as unknown as DirectConversationSummary[];

    setLoadFailed(false);
    setConversations((previous) =>
      sameConversationSnapshot(previous, next) ? previous : next
    );
  }, []);

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

  return (
    <>
      <header className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
              Direct conversations
            </p>
            <h1 className="mt-3 text-4xl font-bold text-gray-950">Messages</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500">
              Staff-created conversations live here. General member-to-member DMs remain closed.
            </p>
          </div>

          <span className="rounded-full bg-gray-950 px-4 py-2 text-sm font-bold text-white">
            {unreadTotal} unread
          </span>
        </div>
      </header>

      <section className="mt-6 space-y-3">
        {loadFailed && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Conversations could not be refreshed.
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

        {conversations.map((conversation) => {
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
      </section>
    </>
  );
}
