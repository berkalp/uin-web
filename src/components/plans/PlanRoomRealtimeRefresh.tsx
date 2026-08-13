"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type PlanRoomRealtimeRefreshProps = {
  planId: string;
  roomPhase: "planning" | "activity";
  currentUserId: string;
};

type RealtimePlanMessageRow = {
  room_phase?: string | null;
  sender_id?: string | null;
};

export default function PlanRoomRealtimeRefresh({
  planId,
  roomPhase,
  currentUserId,
}: PlanRoomRealtimeRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`plan-room:${planId}:${roomPhase}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
          filter: `plan_id=eq.${planId}`,
        },
        (payload) => {
          const message = payload.new as RealtimePlanMessageRow;

          if (
            message.room_phase !== roomPhase ||
            message.sender_id === currentUserId
          ) {
            return;
          }

          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, planId, roomPhase, router]);

  return null;
}
