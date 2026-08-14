"use client";

import { useEffect, useMemo, useState } from "react";

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


function TimerOutlineIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 2.75h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 5.5V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m17.75 6.25 1.5-1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 13V9.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m12 13 2.25 1.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function formatDuration(ms: number, showSeconds = false) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}g ${hours}sa`;
  if (hours > 0) return `${hours}sa ${minutes}dk`;
  if (showSeconds || minutes < 10) return `${minutes}dk ${seconds}sn`;
  return `${minutes}dk`;
}

type CountdownPresentation = {
  label: string;
  title: string;
};

function getCountdownPresentation({
  now,
  scheduledStart,
  scheduledEnd,
}: {
  now: number;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}): CountdownPresentation | null {
  const start = parseDate(scheduledStart);
  if (!start) return null;

  const startMs = start.getTime();
  const end = parseDate(scheduledEnd);
  const endMs = end?.getTime() ?? null;

  if (now < startMs) {
    const remaining = startMs - now;
    return {
      label: `${formatDuration(remaining, remaining < 60 * 60 * 1000)} kaldı`,
      title: "Aktivite başlangıcına kalan süre",
    };
  }

  if (endMs !== null && now < endMs) {
    const elapsed = now - startMs;
    return {
      label: `Başladı · ${formatDuration(elapsed, elapsed < 60 * 60 * 1000)}`,
      title: "Aktivite başlayalı geçen süre",
    };
  }

  if (endMs !== null) {
    return {
      label: "Süre doldu",
      title: "Planlanan aktivite süresi sona erdi",
    };
  }

  return {
    label: `Başladı · ${formatDuration(now - startMs, now - startMs < 60 * 60 * 1000)}`,
    title: "Aktivite başlayalı geçen süre",
  };
}

type Presentation = {
  icon: string;
  ariaLabel: string;
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
      ariaLabel: "Happened",
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
      ariaLabel: "Cancelled",
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
      ariaLabel: "Expired",
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
      ariaLabel: "Confirmed Activity",
      value: schedule,
      classes:
        "border-blue-200 bg-blue-50/85 text-blue-950",
    };
  }

  return {
    icon: "🎯",
    ariaLabel: "Target window",
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

  const normalizedStatus = normalizeStatus(status, expiredAt);
  const canShowLiveTime =
    Boolean(scheduledStart) &&
    !["completed", "cancelled", "expired"].includes(normalizedStatus);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!canShowLiveTime) return;

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [canShowLiveTime, scheduledStart, scheduledEnd]);

  const countdown = useMemo(
    () =>
      canShowLiveTime && now !== null
        ? getCountdownPresentation({ now, scheduledStart, scheduledEnd })
        : null,
    [canShowLiveTime, now, scheduledStart, scheduledEnd]
  );

  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border ${
        compact ? "px-3 py-2" : "px-4 py-3"
      } ${presentation.classes} ${className}`}
      aria-label={`${presentation.ariaLabel}: ${presentation.value}`}
    >
      <span
        aria-hidden="true"
        className={compact ? "text-[15px]" : "text-lg"}
      >
        {presentation.icon}
      </span>

      <p
        className={`min-w-0 flex-1 truncate font-bold leading-tight ${
          compact ? "text-[11px]" : "text-sm"
        }`}
        title={presentation.value}
      >
        {presentation.value}
      </p>

      {countdown && (
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-current/10 bg-white/65 font-bold leading-none ${
            compact ? "h-6 px-2 text-[8.5px]" : "h-7 px-2.5 text-[10px]"
          }`}
          title={countdown.title}
          aria-label={`${countdown.title}: ${countdown.label}`}
        >
          <TimerOutlineIcon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span className="whitespace-nowrap">{countdown.label}</span>
        </span>
      )}
    </div>
  );
}
