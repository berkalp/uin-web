"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/utils/supabase/client";

function formatBadge(value: number) {
  return value > 9 ? "9+" : String(value);
}

function BellIcon() {
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
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export default function NotificationBellButton({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [count, setCount] = useState(initialUnreadCount);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshCount() {
      const { data, error } = await supabase.rpc(
        "get_my_unread_update_notification_count"
      );

      if (!isMounted || error) {
        return;
      }

      const nextCount = Number(data ?? 0);
      setCount(Number.isFinite(nextCount) ? nextCount : 0);
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

      if (!isMounted || !user) {
        return;
      }

      channel = supabase
        .channel(`web-notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleRefresh
        )
        .subscribe();

      void refreshCount();
    }

    const handleLocalChange = () => {
      scheduleRefresh();
    };

    window.addEventListener(
      "uin:notifications-changed",
      handleLocalChange
    );

    void subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener(
        "uin:notifications-changed",
        handleLocalChange
      );

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <Link
      href="/notifications"
      title="Notifications"
      aria-label={
        count > 0
          ? `Notifications, ${count} unread`
          : "Notifications"
      }
      className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-700"
    >
      <BellIcon />

      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-gray-950 px-1.5 text-[11px] font-bold text-white ring-2 ring-gray-50">
          {formatBadge(count)}
        </span>
      )}
    </Link>
  );
}
