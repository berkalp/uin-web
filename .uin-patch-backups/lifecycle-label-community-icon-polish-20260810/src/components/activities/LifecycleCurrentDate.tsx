type LifecycleCurrentDateProps = {
  targetStart?: string | null;
  targetEnd?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  status: string;
  timezone?: string | null;
  compact?: boolean;
  className?: string;
};

function getSafeTimezone(value?: string | null) {
  const candidate = value?.trim() || "Europe/Istanbul";

  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: candidate,
    }).format(new Date());

    return candidate;
  } catch {
    return "UTC";
  }
}

function parseDate(value?: string | null) {
  if (!value?.trim()) return null;

  const trimmed = value.trim();
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T00:00:00Z`
      : trimmed
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined,
  timezone: string
) {
  const date = parseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatTime(
  value: string | null | undefined,
  timezone: string
) {
  const date = parseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function localDateKey(
  value: string | null | undefined,
  timezone: string
) {
  const date = parseDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTargetWindow(
  start?: string | null,
  end?: string | null
) {
  const startText = formatDateOnly(start);
  const endText = formatDateOnly(end);

  if (startText && endText) {
    return startText === endText
      ? startText
      : `${startText} → ${endText}`;
  }

  return startText ?? endText ?? "Date not set";
}

function formatSchedule(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone: string
) {
  const startText = formatDateTime(start, timezone);

  if (!startText) {
    return null;
  }

  const endText = formatDateTime(end, timezone);

  if (!endText) {
    return startText;
  }

  if (localDateKey(start, timezone) === localDateKey(end, timezone)) {
    return `${startText} → ${formatTime(end, timezone) ?? endText}`;
  }

  return `${startText} → ${endText}`;
}

function normalizeStatus(
  status: string,
  expiredAt?: string | null
) {
  if (expiredAt) return "expired";

  return status.trim().toLocaleLowerCase("en-US");
}

type Presentation = {
  icon: string;
  eyebrow: string;
  value: string;
  classes: string;
};

function getPresentation({
  targetStart,
  targetEnd,
  scheduledStart,
  scheduledEnd,
  completedAt,
  cancelledAt,
  expiredAt,
  status,
  timezone,
}: Omit<LifecycleCurrentDateProps, "compact" | "className">): Presentation {
  const safeTimezone = getSafeTimezone(timezone);
  const normalized = normalizeStatus(status, expiredAt);
  const schedule = formatSchedule(
    scheduledStart,
    scheduledEnd,
    safeTimezone
  );

  if (normalized === "completed") {
    return {
      icon: "🚩",
      eyebrow: "Happened",
      value:
        schedule ??
        formatDateTime(completedAt, safeTimezone) ??
        formatTargetWindow(targetStart, targetEnd),
      classes:
        "border-emerald-200 bg-emerald-50/85 text-emerald-950",
    };
  }

  if (normalized === "cancelled") {
    return {
      icon: "✕",
      eyebrow: "Cancelled",
      value:
        formatDateTime(cancelledAt, safeTimezone) ??
        schedule ??
        formatTargetWindow(targetStart, targetEnd),
      classes:
        "border-rose-200 bg-rose-50/85 text-rose-950",
    };
  }

  if (normalized === "expired") {
    return {
      icon: "⌛",
      eyebrow: "Expired",
      value:
        formatDateTime(expiredAt, safeTimezone) ??
        formatDateOnly(targetEnd) ??
        formatTargetWindow(targetStart, targetEnd),
      classes:
        "border-amber-200 bg-amber-50/85 text-amber-950",
    };
  }

  if (schedule) {
    return {
      icon: "🗓",
      eyebrow: "Confirmed Activity",
      value: schedule,
      classes:
        "border-blue-200 bg-blue-50/85 text-blue-950",
    };
  }

  return {
    icon: "🎯",
    eyebrow: "Target window",
    value: formatTargetWindow(targetStart, targetEnd),
    classes:
      "border-orange-200 bg-orange-50/85 text-orange-950",
  };
}

export default function LifecycleCurrentDate({
  targetStart = null,
  targetEnd = null,
  scheduledStart = null,
  scheduledEnd = null,
  completedAt = null,
  cancelledAt = null,
  expiredAt = null,
  status,
  timezone = "Europe/Istanbul",
  compact = false,
  className = "",
}: LifecycleCurrentDateProps) {
  const presentation = getPresentation({
    targetStart,
    targetEnd,
    scheduledStart,
    scheduledEnd,
    completedAt,
    cancelledAt,
    expiredAt,
    status,
    timezone,
  });

  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border ${
        compact ? "px-2.5 py-1.5" : "px-4 py-3"
      } ${presentation.classes} ${className}`}
    >
      <span
        aria-hidden="true"
        className={compact ? "text-sm" : "text-lg"}
      >
        {presentation.icon}
      </span>

      <div className="min-w-0">
        <p
          className={`font-black uppercase tracking-[0.08em] opacity-60 ${
            compact ? "text-[7.5px]" : "text-[9px]"
          }`}
        >
          {presentation.eyebrow}
        </p>
        <p
          className={`mt-0.5 truncate font-bold leading-tight ${
            compact ? "text-[10px]" : "text-sm"
          }`}
          title={presentation.value}
        >
          {presentation.value}
        </p>
      </div>
    </div>
  );
}
