export type CollaborationActivityStatus = "unresolved" | "preparing" | "forming" | "planned" | "completed" | "cancelled";

export type CollaborationEventResolution = "none" | "intent_only" | "plan_resolved";

export type CollaborationActivitySummary = {
  intentId: string;
  planId: string | null;
  title: string;
  status: CollaborationActivityStatus;
  windowStart: string | null;
  windowEnd: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  timezone: string | null;
  locationName: string | null;
  meetingPoint: string | null;
  city: string | null;
  district: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  cancellationPhase: "planning" | "activity" | null;
  viewerCanOpenRoom: boolean;
  eventResolution: Exclude<CollaborationEventResolution, "none">;
};

export type CollaborationActivityStage =
  | "unresolved"
  | "preparing"
  | "forming"
  | "future"
  | "current"
  | "awaiting_result"
  | "expired"
  | "completed"
  | "cancelled";

export type EventStatusKind =
  | "planning"
  | "planned"
  | "active"
  | "awaiting_result"
  | "completed"
  | "cancelled"
  | "expired"
  | "unverified";

export type CollaborationActivityTone = "amber" | "green" | "slate" | "red";

export type EventStatusPresentation = {
  kind: EventStatusKind;
  label: string;
  tone: CollaborationActivityTone;
};

export const EVENT_STATUS_PRESENTATIONS: Record<EventStatusKind, EventStatusPresentation> = {
  planning: { kind: "planning", label: "Planlanıyor", tone: "amber" },
  planned: { kind: "planned", label: "Planlandı", tone: "amber" },
  active: { kind: "active", label: "Aktif", tone: "green" },
  awaiting_result: { kind: "awaiting_result", label: "Sonuç bekleniyor", tone: "slate" },
  completed: { kind: "completed", label: "Tamamlandı", tone: "slate" },
  cancelled: { kind: "cancelled", label: "Gerçekleşmedi / İptal", tone: "red" },
  expired: { kind: "expired", label: "Süresi doldu", tone: "slate" },
  unverified: { kind: "unverified", label: "Durum doğrulanamadı", tone: "red" },
};

export type CollaborationActivityPresentation = {
  stage: CollaborationActivityStage;
  label: string;
  tone: CollaborationActivityTone;
  dateLabel: string;
  locationLabel: string | null;
  href: string;
  actionLabel: string;
};

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_STATUSES = new Set(["forming", "planned", "completed", "cancelled"]);
const RESOLUTIONS = new Set<CollaborationEventResolution>(["none", "intent_only", "plan_resolved"]);
const DEFAULT_TIMEZONE = "Europe/Istanbul";
const validTimezoneCache = new Map<string, string>();

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && DATE_PATTERN.test(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function clean(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

/**
 * Parse the activity projection returned by the v170 collaboration RPCs.
 * A malformed or internally inconsistent projection is rejected instead of
 * turning a missing event into a generic or stale card.
 */
export function parseCollaborationActivity(
  value: unknown,
  fallbackTitle: string,
): CollaborationActivitySummary | null {
  if (!isRecord(value) || !fallbackTitle.trim()) {
    throw new Error("Etkinlik özeti doğrulanamadı. Lütfen yeniden deneyin.");
  }

  const resolution = value.event_resolution;
  if (typeof resolution !== "string" || !RESOLUTIONS.has(resolution as CollaborationEventResolution)
    || !isNullableUuid(value.planning_intent_id)
    || !isNullableUuid(value.plan_id)
    || !isNullableString(value.activity_title)
    || !isNullableString(value.activity_status)
    || !isNullableDate(value.window_start)
    || !isNullableDate(value.window_end)
    || !isNullableTimestamp(value.scheduled_start)
    || !isNullableTimestamp(value.scheduled_end)
    || !isNullableString(value.timezone)
    || !isNullableString(value.activity_location_name)
    || !isNullableString(value.meeting_point)
    || !isNullableString(value.activity_city)
    || !isNullableString(value.activity_district)
    || !isNullableTimestamp(value.cancelled_at)
    || !isNullableTimestamp(value.completed_at)
    || !isNullableTimestamp(value.expired_at)
    || (value.cancellation_phase !== null && value.cancellation_phase !== "planning" && value.cancellation_phase !== "activity")
    || typeof value.viewer_can_open_room !== "boolean") {
    throw new Error("Etkinlik özeti eksik. Lütfen yeniden deneyin.");
  }

  if (resolution === "none") {
    if (value.planning_intent_id !== null
      || value.plan_id !== null
      || value.activity_title !== null
      || value.activity_status !== null
      || value.window_start !== null
      || value.window_end !== null
      || value.scheduled_start !== null
      || value.scheduled_end !== null
      || value.cancelled_at !== null
      || value.completed_at !== null
      || value.expired_at !== null
      || value.viewer_can_open_room) {
      throw new Error("Etkinlik bağlantısı tutarsız. Lütfen yeniden deneyin.");
    }
    return null;
  }

  if (!isUuid(value.planning_intent_id)) {
    throw new Error("Etkinlik bağlantısı eksik. Lütfen yeniden deneyin.");
  }

  if (resolution === "intent_only") {
    if (value.plan_id !== null
      || value.activity_title !== null
      || value.activity_status !== null
      || value.window_start !== null
      || value.window_end !== null
      || value.scheduled_start !== null
      || value.scheduled_end !== null
      || value.cancelled_at !== null
      || value.completed_at !== null
      || value.expired_at !== null
      || value.cancellation_phase !== null
      || value.viewer_can_open_room) {
      throw new Error("Etkinlik bağlantısı tutarsız. Lütfen yeniden deneyin.");
    }
    return {
      intentId: value.planning_intent_id,
      planId: null,
      title: clean(value.activity_title) ?? fallbackTitle.trim(),
      status: "unresolved",
      windowStart: value.window_start,
      windowEnd: value.window_end,
      scheduledStart: value.scheduled_start,
      scheduledEnd: value.scheduled_end,
      timezone: clean(value.timezone),
      locationName: clean(value.activity_location_name),
      meetingPoint: clean(value.meeting_point),
      city: clean(value.activity_city),
      district: clean(value.activity_district),
      cancelledAt: value.cancelled_at,
      completedAt: value.completed_at,
      expiredAt: value.expired_at,
      cancellationPhase: value.cancellation_phase,
      viewerCanOpenRoom: false,
      eventResolution: "intent_only",
    };
  }

  const title = clean(value.activity_title);
  if (!isUuid(value.plan_id) || !title || typeof value.activity_status !== "string" || !PLAN_STATUSES.has(value.activity_status)) {
    throw new Error("Etkinlik planı eksik. Lütfen yeniden deneyin.");
  }

  return {
    intentId: value.planning_intent_id,
    planId: value.plan_id,
    title,
    status: value.activity_status as Exclude<CollaborationActivityStatus, "preparing">,
    windowStart: value.window_start,
    windowEnd: value.window_end,
    scheduledStart: value.scheduled_start,
    scheduledEnd: value.scheduled_end,
    timezone: clean(value.timezone),
    locationName: clean(value.activity_location_name),
    meetingPoint: clean(value.meeting_point),
    city: clean(value.activity_city),
    district: clean(value.activity_district),
    cancelledAt: value.cancelled_at,
    completedAt: value.completed_at,
    expiredAt: value.expired_at,
    cancellationPhase: value.cancellation_phase,
    viewerCanOpenRoom: value.viewer_can_open_room,
    eventResolution: "plan_resolved",
  };
}

function resolveTimezone(value: string | null): string {
  const candidate = clean(value) ?? DEFAULT_TIMEZONE;
  const cached = validTimezoneCache.get(candidate);
  if (cached) return cached;
  try {
    new Intl.DateTimeFormat("tr-TR", { timeZone: candidate }).format(0);
    validTimezoneCache.set(candidate, candidate);
    return candidate;
  } catch {
    validTimezoneCache.set(candidate, DEFAULT_TIMEZONE);
    return DEFAULT_TIMEZONE;
  }
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getEventStatusPresentation({
  status,
  scheduledStart = null,
  scheduledEnd = null,
  outcomeUnknown = false,
  now = Date.now(),
}: {
  status: string | null | undefined;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  outcomeUnknown?: boolean;
  now?: number | string | Date;
}): EventStatusPresentation {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (normalized === "cancelled" || normalized === "canceled") return EVENT_STATUS_PRESENTATIONS.cancelled;
  if (normalized === "completed") return EVENT_STATUS_PRESENTATIONS.completed;
  if (normalized === "expired") return EVENT_STATUS_PRESENTATIONS.expired;
  if (normalized === "unresolved" || normalized === "unverified") return EVENT_STATUS_PRESENTATIONS.unverified;
  if (normalized === "active" || normalized === "current") return EVENT_STATUS_PRESENTATIONS.active;
  if (normalized === "awaiting_result") return EVENT_STATUS_PRESENTATIONS.awaiting_result;
  if (normalized === "forming" || normalized === "open" || normalized === "preparing") {
    return EVENT_STATUS_PRESENTATIONS.planning;
  }
  if (outcomeUnknown) return EVENT_STATUS_PRESENTATIONS.awaiting_result;

  const current = nowTimestamp(now);
  const start = timestamp(scheduledStart);
  const end = timestamp(scheduledEnd);
  if (end !== null && current > end) return EVENT_STATUS_PRESENTATIONS.awaiting_result;
  if (start !== null && end !== null && current >= start && current <= end) {
    return EVENT_STATUS_PRESENTATIONS.active;
  }
  if (normalized === "planned" || normalized === "closed" || normalized === "future") {
    return EVENT_STATUS_PRESENTATIONS.planned;
  }
  return EVENT_STATUS_PRESENTATIONS.planning;
}

function nowTimestamp(value: number | string | Date): number {
  const parsed = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : value;
  if (!Number.isFinite(parsed)) throw new TypeError("Geçerli bir zaman damgası gerekli.");
  return parsed;
}

function dateParts(value: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: read("day"), month: read("month").replace(/\.$/, ""), year: read("year") };
}

function dateLabel(value: number, timezone: string): string {
  const parts = dateParts(value, timezone);
  return `${parts.day} ${parts.month} ${parts.year}`;
}

function timeLabel(value: number, timezone: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

function dayKey(value: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function exactDateLabel(startValue: string, endValue: string | null, timezone: string): string | null {
  const start = timestamp(startValue);
  if (start === null) return null;
  const end = timestamp(endValue);
  if (end === null || end === start) return `${dateLabel(start, timezone)} · ${timeLabel(start, timezone)}`;
  if (dayKey(start, timezone) === dayKey(end, timezone)) {
    return `${dateLabel(start, timezone)} · ${timeLabel(start, timezone)}–${timeLabel(end, timezone)}`;
  }
  return `${dateLabel(start, timezone)} ${timeLabel(start, timezone)} – ${dateLabel(end, timezone)} ${timeLabel(end, timezone)}`;
}

function dateOnlyTimestamp(value: string | null): number | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 12);
}

function windowDateLabel(startValue: string | null, endValue: string | null): string | null {
  const start = dateOnlyTimestamp(startValue);
  const end = dateOnlyTimestamp(endValue);
  if (start === null && end === null) return null;
  if (start === null && end !== null) return `Hedef: ${dateLabel(end, "UTC")}`;
  if (start !== null && (end === null || end === start)) return `Hedef: ${dateLabel(start, "UTC")}`;
  return `Hedef: ${dateLabel(start as number, "UTC")} – ${dateLabel(end as number, "UTC")}`;
}

function resolveLocation(activity: CollaborationActivitySummary): string | null {
  const location = clean(activity.locationName);
  const meetingPoint = clean(activity.meetingPoint);
  const city = clean(activity.city);
  const district = clean(activity.district);
  if (location && meetingPoint && location.toLocaleLowerCase("tr-TR") !== meetingPoint.toLocaleLowerCase("tr-TR")) {
    return `${location} · ${meetingPoint}`;
  }
  if (meetingPoint || location) return meetingPoint ?? location;
  if (district && city && district.toLocaleLowerCase("tr-TR") !== city.toLocaleLowerCase("tr-TR")) {
    return `${district}, ${city}`;
  }
  return district ?? city;
}

function resolveStage(activity: CollaborationActivitySummary, now: number): CollaborationActivityStage {
  if (activity.status === "unresolved" || activity.eventResolution === "intent_only") return "unresolved";
  if (activity.status === "preparing") return "preparing";
  if (activity.eventResolution !== "plan_resolved" || !activity.planId) return "unresolved";
  if (activity.status === "cancelled") return "cancelled";
  if (activity.status === "completed") return "completed";
  if (timestamp(activity.expiredAt) !== null) return "expired";
  if (activity.status === "forming") return "forming";

  const start = timestamp(activity.scheduledStart);
  const end = timestamp(activity.scheduledEnd);
  const timezone = resolveTimezone(activity.timezone);
  if (start !== null && now < start) return "future";
  if (end !== null && now > end) return "awaiting_result";
  if (start !== null && end !== null && now >= start && now <= end) return "current";
  if (activity.windowEnd && dayKey(now, timezone) > activity.windowEnd) return "awaiting_result";
  return "future";
}

function resolveRoute(activity: CollaborationActivitySummary): Pick<CollaborationActivityPresentation, "href" | "actionLabel"> {
  if (activity.planId && activity.viewerCanOpenRoom) {
    if (activity.status === "forming") {
      return { href: `/plans/${encodeURIComponent(activity.planId)}/planning`, actionLabel: "Planlama odasını aç" };
    }
    return {
      href: `/plans/${encodeURIComponent(activity.planId)}/activity`,
      actionLabel: activity.status === "cancelled" || activity.status === "completed" ? "Etkinlik kaydını aç" : "Aktivite odasını aç",
    };
  }
  return { href: `/activities/${encodeURIComponent(activity.intentId)}`, actionLabel: "Etkinliği aç" };
}

export function getCollaborationActivityPresentation(
  activity: CollaborationActivitySummary,
  now: number | string | Date = Date.now(),
): CollaborationActivityPresentation {
  const stage = resolveStage(activity, nowTimestamp(now));
  const statusKind: EventStatusKind = stage === "unresolved" ? "unverified"
    : stage === "preparing" || stage === "forming" ? "planning"
      : stage === "future" ? "planned"
        : stage === "current" ? "active"
          : stage;
  const { label, tone } = EVENT_STATUS_PRESENTATIONS[statusKind];
  const timezone = resolveTimezone(activity.timezone);
  const exactDate = activity.scheduledStart
    ? exactDateLabel(activity.scheduledStart, activity.scheduledEnd, timezone)
    : null;
  const rawDateLabel = exactDate ?? windowDateLabel(activity.windowStart, activity.windowEnd) ?? "Tarih henüz kesinleşmedi";
  return {
    stage,
    label,
    tone,
    dateLabel: stage === "cancelled" && rawDateLabel !== "Tarih henüz kesinleşmedi"
      ? `Planlanan: ${rawDateLabel.replace(/^Hedef:\s*/, "")}`
      : rawDateLabel,
    locationLabel: resolveLocation(activity),
    ...resolveRoute(activity),
  };
}
