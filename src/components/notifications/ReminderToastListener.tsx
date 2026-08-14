"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type ToastNotification = {
  id: string;
  notification_type: string | null;
  title: string | null;
  body: string | null;
  action_url: string | null;
  created_at?: string | null;
};

const POPUP_TYPES = [
  "activity_reminder",
  "activity_started",
  "activity_scheduled_end",
  "seed_reminder",
  "seed_target_due",
  "activity_feedback",
  "activity_completed",
] as const;

const POPUP_TYPE_SET = new Set<string>(POPUP_TYPES);
const RECENT_WINDOW_MS = 2 * 60 * 1000;

export default function ReminderToastListener() {
  const router = useRouter();
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const showToast = useCallback((record: ToastNotification) => {
    const type = (record.notification_type ?? "").toLowerCase();
    if (!POPUP_TYPE_SET.has(type)) return;
    if (lastShownIdRef.current === record.id) return;

    lastShownIdRef.current = record.id;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(record);
    timeoutRef.current = setTimeout(() => setToast(null), 9000);
  }, []);

  const recoverRecentPopup = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;

    const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
    const { data } = await supabase
      .from("notifications")
      .select("id, notification_type, title, body, action_url, created_at")
      .eq("user_id", userId)
      .is("read_at", null)
      .in("notification_type", [...POPUP_TYPES])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) showToast(data as ToastNotification);
  }, [showToast]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const onFocus = () => void recoverRecentPopup();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void recoverRecentPopup();
    };

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userIdRef.current = user.id;

      channel = supabase
        .channel(`uin-reminder-popups-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => showToast(payload.new as ToastNotification)
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void recoverRecentPopup();
        });

      // Realtime can miss an INSERT while the tab sleeps, reconnects or is
      // background-throttled. This tiny fallback only checks recent unread
      // reminder/lifecycle events, so the in-app popup catches up without
      // duplicating the notification feed or native push.
      pollId = setInterval(() => void recoverRecentPopup(), 15000);
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibility);
      void recoverRecentPopup();
    })();

    return () => {
      cancelled = true;
      userIdRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pollId) clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [recoverRecentPopup, showToast]);

  if (!toast) return null;

  const type = (toast.notification_type ?? "").toLowerCase();
  const isTimeEvent = type.includes("reminder") || type.includes("started") || type.includes("end") || type.includes("target");

  async function open() {
    try {
      await supabase.rpc("mark_notification_read", { p_notification_id: toast!.id });
    } catch {
      // Opening must not be blocked by a read-state failure.
    }
    if (toast?.action_url) router.push(toast.action_url);
    setToast(null);
  }

  return (
    <div className="fixed right-4 top-4 z-[1000] w-[min(390px,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${isTimeEvent ? "bg-amber-100" : "bg-green-100"}`} aria-hidden="true">
          {isTimeEvent ? "⏱" : "✓"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-green-700">UIN</p>
          <h3 className="mt-1 text-sm font-black text-gray-950">{toast.title || "Hatırlatma"}</h3>
          {toast.body && <p className="mt-1 text-xs leading-5 text-gray-600">{toast.body}</p>}
          <div className="mt-3 flex gap-2">
            {toast.action_url && <button type="button" onClick={open} className="rounded-lg bg-gray-950 px-3 py-1.5 text-[10px] font-black text-white">Aç →</button>}
            <button type="button" onClick={() => setToast(null)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold text-gray-600">Kapat</button>
          </div>
        </div>
      </div>
    </div>
  );
}
