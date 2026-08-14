"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { supabase } from "@/utils/supabase/client";

export default function RoomMessagesRealtimeRefresh() {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function scheduleRefresh() {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (isMounted) router.refresh();
      }, 150);
    }

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;

      channel = supabase
        .channel(`room-message-center:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const nextRow = (payload.new ?? {}) as { notification_type?: string };
            const previousRow = (payload.old ?? {}) as { notification_type?: string };
            const type = String(
              nextRow.notification_type ?? previousRow.notification_type ?? ""
            ).toLowerCase();

            if (type.includes("room_message")) scheduleRefresh();
          }
        )
        .subscribe();
    }

    const reconcile = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    void subscribe();

    return () => {
      isMounted = false;
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
