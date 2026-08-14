"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { supabase } from "@/utils/supabase/client";

export default function NotificationsRealtimeRefresh() {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function scheduleRefresh() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (isMounted) {
          router.refresh();
        }
      }, 150);
    }

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) {
        return;
      }

      channel = supabase
        .channel(`web-notifications-page:${user.id}`)
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
  }, [router]);

  return null;
}
