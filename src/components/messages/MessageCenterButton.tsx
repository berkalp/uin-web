"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/utils/supabase/client";

function formatBadge(value: number) {
  return value > 9 ? "9+" : String(value);
}

function MessagesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h16v11H8l-4 3V5Z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

type PlanConversationSummary = {
  unread_count?: number | string | null;
};

export default function MessageCenterButton({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [count, setCount] = useState(initialUnreadCount);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    let roomChannel: ReturnType<typeof supabase.channel> | null = null;
    let directChannel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshCount() {
      const [directResult, roomResult] = await Promise.all([
        supabase.rpc("get_my_unread_direct_message_count"),
        supabase.rpc("get_plan_conversation_summaries"),
      ]);

      if (!isMounted) return;

      const directUnread = directResult.error ? 0 : toNumber(directResult.data);
      const roomUnread = roomResult.error
        ? 0
        : ((roomResult.data ?? []) as PlanConversationSummary[]).reduce(
            (total, summary) => total + toNumber(summary.unread_count),
            0
          );

      if (!directResult.error || !roomResult.error) {
        setCount(directUnread + roomUnread);
      }
    }

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        void refreshCount();
      }, 120);
    }

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;

      roomChannel = supabase
        .channel(`message-center-room:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = (payload.new ?? {}) as { notification_type?: string };
            if (String(row.notification_type ?? "").toLowerCase().includes("room_message")) {
              scheduleRefresh();
            }
          }
        )
        .subscribe();

      directChannel = supabase
        .channel(`message-center-direct:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_message_realtime_signals",
          },
          scheduleRefresh
        )
        .subscribe();

      void refreshCount();
    }

    const reconcile = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("uin:messages-changed", scheduleRefresh);

    void subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("uin:messages-changed", scheduleRefresh);

      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (roomChannel) void supabase.removeChannel(roomChannel);
      if (directChannel) void supabase.removeChannel(directChannel);
    };
  }, []);

  return (
    <Link
      href="/messages"
      title="Messages"
      aria-label={count > 0 ? `Messages, ${count} unread` : "Messages"}
      className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-700"
    >
      <MessagesIcon />

      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-gray-950 px-1.5 text-[11px] font-bold text-white ring-2 ring-gray-50">
          {formatBadge(count)}
        </span>
      )}
    </Link>
  );
}
