export type RoomConversationLifecyclePlan = {
  status: string | null;
  expired_at?: string | null;
  window_end?: string | null;
  timezone?: string | null;
};

function currentDateInTimezone(timezone: string | null | undefined) {
  const safeTimezone = timezone?.trim() || "UTC";

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function isRoomConversationClosed(
  plan: RoomConversationLifecyclePlan
) {
  if (plan.status === "completed" || plan.status === "cancelled") {
    return true;
  }

  if (plan.status !== "forming") {
    return false;
  }

  if (plan.expired_at) {
    return true;
  }

  if (!plan.window_end) {
    return false;
  }

  return (
    plan.window_end <
    currentDateInTimezone(plan.timezone)
  );
}

export function isRoomConversationOpen(
  plan: RoomConversationLifecyclePlan
) {
  return !isRoomConversationClosed(plan);
}
