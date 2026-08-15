"use client";

import Link from "next/link";
import { useState } from "react";

import SeedLiveCountdown from "@/components/seeds/SeedLiveCountdown";
import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import {
  getSeedStatusLabel,
  getSeedVisibilityLabel,
  isSeedPastDue,
  toSeedCount,
  type SeedRecord,
  type SeedStatus,
} from "@/utils/seeds";

type SeedCardProps = {
  seed: SeedRecord;
  isAuthenticated: boolean;
  reminderTargetTime?: string | null;
  reminderTimezone?: string | null;
  variant?: "seeds" | "timeline";
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: value.length === 10 ? "UTC" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusTone(status: SeedStatus, pastDue: boolean) {
  if (pastDue) return "bg-amber-100 text-amber-800";
  if (status === "completed") return "bg-purple-100 text-purple-800";
  if (status === "archived") return "bg-gray-200 text-gray-700";
  return "bg-green-100 text-green-800";
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20h4l10.6-10.6a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function LibraryIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3.5 7.5h6l1.6 2h9.4v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />
      <path d="M3.5 7.5V6a2 2 0 0 1 2-2h4l1.5 2h7.5a2 2 0 0 1 2 2v1.5" />
    </svg>
  );
}

function SeedPlantedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20v-8" />
      <path d="M12 13c-4 0-6-2.3-6-6 4 0 6 2.3 6 6Z" />
      <path d="M12 10c0-3.3 2-5.3 6-5.3 0 3.3-2 5.3-6 5.3Z" />
    </svg>
  );
}

function UpdatedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 11a8 8 0 1 1-2.35-5.65" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M15 9 21 3M17 3h4v4" />
    </svg>
  );
}

export default function SeedCard({
  seed,
  isAuthenticated,
  reminderTargetTime,
  reminderTimezone,
  variant = "seeds",
}: SeedCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const grownIntentCount = toSeedCount(seed.grown_intent_count);
  const journalCount = toSeedCount(seed.journal_count);
  const isPrivateSeed = seed.seed_scope === "private";
  const isTimeline = variant === "timeline";
  const pastDue = isSeedPastDue(seed);
  const statusLabel = getSeedStatusLabel(seed.status, pastDue);

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
        className="relative block aspect-[1/1] w-full shrink-0 overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700"
      >
        {seed.cover_url && <img src={seed.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/8 to-black/25" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="max-w-[68%] truncate rounded-full border border-white/15 bg-black/45 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-white backdrop-blur">
            {seed.seed_type_icon} {seed.seed_type_name}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide ${statusTone(seed.status, pastDue)}`}>
            {pastDue ? "Süresi geçti" : seed.status === "active" ? "Growing" : seed.status === "completed" ? "Done" : "Kapanmış"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-black/45 text-white backdrop-blur"
              title={isPrivateSeed ? "Özel Tohum" : "Kütüphane Tohumu"}
              aria-label={isPrivateSeed ? "Özel Tohum" : "Kütüphane Tohumu"}
            >
              {isPrivateSeed ? <LockIcon className="h-3 w-3" /> : <LibraryIcon className="h-3 w-3" />}
            </span>
            <h2 className="min-w-0 line-clamp-2 text-[17px] font-bold leading-[1.12]">{seed.title}</h2>
          </div>
          {seed.subtitle && <p className="mt-1 truncate pl-7 text-[9.5px] font-semibold text-white/75">{seed.subtitle}</p>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-2">
        {!detailsOpen ? (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
            <div className="flex h-8 items-center gap-1.5 bg-white px-2 text-[9px] font-semibold text-gray-700" title="Ekildi">
              <span className="text-green-700"><SeedPlantedIcon /></span>
              <span className="truncate">{formatDate(seed.created_at)}</span>
            </div>
            <div className="flex h-8 items-center gap-1.5 bg-white px-2 text-[9px] font-semibold text-gray-700" title="Son güncelleme">
              <span className="text-blue-700"><UpdatedIcon /></span>
              <span className="truncate">{formatDate(seed.updated_at)}</span>
            </div>
            <div className="flex h-8 items-center gap-1.5 bg-white px-2 text-[9px] font-semibold text-gray-700" title="Hedef tarihi">
              <span className="text-rose-600"><TargetIcon /></span>
              <span className="truncate">{seed.target_date ? formatDate(seed.target_date) : "—"}</span>
            </div>
            <div className="flex h-8 items-center bg-white px-2" title="Kalan süre">
              {pastDue ? (
                <span className="text-[9px] font-bold text-amber-700">Süresi geçti</span>
              ) : seed.target_date && seed.status === "active" ? (
                <SeedLiveCountdown
                  targetDate={seed.target_date}
                  targetTime={reminderTargetTime}
                  timezone={reminderTimezone}
                  variant="meta"
                />
              ) : (
                <span className="text-[9px] font-semibold text-gray-400">—</span>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-[65px] rounded-xl border border-gray-100 bg-gray-50 p-2 text-[9px] text-gray-600">
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[8.5px] font-bold uppercase text-gray-400">Görünürlük</p><p className="mt-0.5 font-semibold text-gray-900">{isPrivateSeed ? "Yalnızca sen" : getSeedVisibilityLabel(seed.visibility)}</p></div>
              <div><p className="text-[8.5px] font-bold uppercase text-gray-400">Durum</p><p className="mt-0.5 font-semibold text-gray-900">{statusLabel}</p></div>
              <div><p className="text-[8.5px] font-bold uppercase text-gray-400">Günlük</p><p className="mt-0.5 font-semibold text-gray-900">{journalCount}</p></div>
              <div><p className="text-[8.5px] font-bold uppercase text-gray-400">Büyüyen Niyet</p><p className="mt-0.5 font-semibold text-gray-900">{grownIntentCount}</p></div>
            </div>
          </div>
        )}

        <div className="mt-auto flex h-9 items-center gap-1 border-t border-gray-100 pt-1.5">
          <Link
            href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
            aria-label="Tohumu görüntüle"
            title="Görüntüle"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
          >
            <EyeIcon />
          </Link>
          <Link
            href={`/seeds/${encodeURIComponent(seed.seed_id)}/edit`}
            aria-label="Tohumu düzenle"
            title="Düzenle"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
          >
            <PencilIcon />
          </Link>
          {!isPrivateSeed && (
            <SeedReactionBar
              seedId={seed.seed_id}
              initialContext={seed.reaction_context}
              isAuthenticated={isAuthenticated}
              isOwner
              variant="toolbar"
            />
          )}
          <button
            type="button"
            onClick={() => setDetailsOpen((value) => !value)}
            className="ml-auto inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2 text-[9.5px] font-semibold text-gray-700 hover:border-green-300"
          >
            Detaylar {detailsOpen ? "▴" : "▾"}
          </button>
        </div>
      </div>
    </article>
  );
}
