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
  initialUnreadCount: number | null;
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

      const nextCount = Number(data);
      setCount(data != null && Number.isFinite(nextCount) ? Math.max(0, nextCount) : null);
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
      title="Bildirimler"
      aria-label={
        count == null
          ? "Bildirimler, okunmamış sayısı şu anda bilinmiyor"
          : count > 0
          ? `Bildirimler, ${count} okunmamış`
          : "Bildirimler"
      }
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-700"
    >
      <BellIcon />

      {count == null ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-800 ring-2 ring-white" title="Bildirim sayısı yüklenemedi">
          ?
        </span>
      ) : count > 0 && (
        <span className="absolute right-1 top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-gray-950 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
          {formatBadge(count)}
        </span>
      )}
    </Link>
  );
}
