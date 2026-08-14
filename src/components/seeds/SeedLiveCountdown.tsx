"use client";

import { useEffect, useMemo, useState } from "react";

type SeedLiveCountdownProps = {
  targetDate: string | null;
  targetTime?: string | null;
  timezone?: string | null;
  compact?: boolean;
  variant?: "pill" | "meta";
};

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - date.getTime()
  );
}

function toTarget(
  targetDate: string,
  targetTime: string | null | undefined,
  timezone: string | null | undefined
) {
  const time = targetTime?.trim() || "09:00";
  const [year, month, day] = targetDate.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;

  const zone = timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const wallClockAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    let offset = timeZoneOffsetMs(wallClockAsUtc, zone);
    let resolved = new Date(wallClockAsUtc.getTime() - offset);
    const correctedOffset = timeZoneOffsetMs(resolved, zone);
    if (correctedOffset !== offset) {
      offset = correctedOffset;
      resolved = new Date(wallClockAsUtc.getTime() - offset);
    }
    return resolved;
  } catch {
    const local = new Date(`${targetDate}T${time}:00`);
    return Number.isNaN(local.getTime()) ? null : local;
  }
}

function formatRemaining(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}g ${hours}sa kaldı`;
  if (hours > 0) return `${hours}sa ${minutes}dk kaldı`;
  if (minutes > 0) return `${minutes}dk ${seconds}sn kaldı`;
  return `${seconds}sn kaldı`;
}

export default function SeedLiveCountdown({
  targetDate,
  targetTime,
  timezone,
  compact = false,
  variant = "pill",
}: SeedLiveCountdownProps) {
  const target = useMemo(
    () => (targetDate ? toTarget(targetDate, targetTime, timezone) : null),
    [targetDate, targetTime, timezone]
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!target) return null;

  const diff = target.getTime() - now;
  const reached = diff <= 0;

  const label = reached
    ? variant === "meta"
      ? "Süre doldu"
      : "Hedef zamanı geçti"
    : formatRemaining(diff);

  if (variant === "meta") {
    return (
      <span
        className={`inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold ${reached ? "text-rose-700" : "text-amber-700"}`}
        title={timezone ? `Hatırlatma saat dilimi: ${timezone}` : undefined}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 1.5M9 3h6M12 3v2" />
        </svg>
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
        reached
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      } ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"}`}
      title={timezone ? `Hatırlatma saat dilimi: ${timezone}` : undefined}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 1.5M9 3h6M12 3v2" />
      </svg>
      {label}
    </span>
  );
}
