"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type ToastNotification = {
  id: string;
  notification_type: string | null;
  title: string | null;
  body: string | null;
  action_url: string | null;
};

const POPUP_TYPES = new Set([
  "activity_reminder",
  "activity_started",
  "activity_scheduled_end",
  "seed_reminder",
  "seed_target_due",
  "activity_feedback",
  "activity_completed",
]);

export default function ReminderToastListener() {
  const router = useRouter();
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

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
          (payload) => {
            const record = payload.new as ToastNotification;
            if (!POPUP_TYPES.has((record.notification_type ?? "").toLowerCase())) return;

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setToast(record);
            timeoutRef.current = setTimeout(() => setToast(null), 9000);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

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
    <div className="fixed right-4 top-4 z-[1000] w-[min(420px,calc(100vw-2rem))] rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl">
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${isTimeEvent ? "bg-amber-100" : "bg-green-100"}`} aria-hidden="true">
          {isTimeEvent ? "⏱" : "✓"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-green-700">UIN</p>
          <h3 className="mt-1 text-base font-black text-gray-950">{toast.title || "Hatırlatma"}</h3>
          {toast.body && <p className="mt-1 text-sm leading-6 text-gray-600">{toast.body}</p>}
          <div className="mt-4 flex gap-2">
            {toast.action_url && (
              <button type="button" onClick={open} className="rounded-xl bg-gray-950 px-4 py-2 text-xs font-black text-white">
                Aç →
              </button>
            )}
            <button type="button" onClick={() => setToast(null)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600">
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
