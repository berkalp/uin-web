"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import SeedCompletionDialog from "@/components/seeds/SeedCompletionDialog";
import SeedLiveCountdown from "@/components/seeds/SeedLiveCountdown";
import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import { deleteSeed, setSeedStatus } from "@/services/seedService";
import {
  getSeedCompletionLabel,
  getSeedVisibilityLabel,
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

function statusTone(status: SeedStatus) {
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
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const grownIntentCount = toSeedCount(seed.grown_intent_count);
  const journalCount = toSeedCount(seed.journal_count);
  const completionLabel = getSeedCompletionLabel(seed);
  const isPrivateSeed = seed.seed_scope === "private";
  const isTimeline = variant === "timeline";

  async function changeStatus(status: SeedStatus) {
    setIsWorking(true);
    setMessage(null);
    try {
      await setSeedStatus(seed.seed_id, status);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tohum güncellenemedi.");
      setIsWorking(false);
    }
  }

  async function remove() {
    if (!window.confirm(`“${seed.title}” Tohumunu silmek istiyor musun?`)) return;
    setIsWorking(true);
    setMessage(null);
    try {
      await deleteSeed(seed.seed_id);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tohum silinemedi.");
      setIsWorking(false);
    }
  }

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
        className="relative block aspect-square overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700"
      >
        {seed.cover_url && <img src={seed.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/8 to-black/25" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="max-w-[68%] truncate rounded-full border border-white/15 bg-black/45 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-white backdrop-blur">
            {seed.seed_type_icon} {seed.seed_type_name}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${statusTone(seed.status)}`}>
            {seed.status === "active" ? "Growing" : seed.status === "completed" ? "Done" : "Archived"}
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
            <h2 className="min-w-0 line-clamp-2 text-[13px] font-black leading-tight">{seed.title}</h2>
          </div>
          {seed.subtitle && <p className="mt-1 truncate pl-7 text-[9px] font-semibold text-white/75">{seed.subtitle}</p>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-2">
        {!detailsOpen ? (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
            <div className="flex h-8 items-center gap-1.5 bg-white px-2 text-[8px] font-bold text-gray-700" title="Ekildi">
              <span className="text-green-700"><SeedPlantedIcon /></span>
              <span className="truncate">{formatDate(seed.created_at)}</span>
            </div>
            <div className="flex h-8 items-center gap-1.5 bg-white px-2 text-[8px] font-bold text-gray-700" title="Son güncelleme">
              <span className="text-blue-700"><UpdatedIcon /></span>
              <span className="truncate">{formatDate(seed.updated_at)}</span>
            </div>
            <div className="flex h-8 items-center gap-1.5 bg-white px-2 text-[8px] font-bold text-gray-700" title="Hedef tarihi">
              <span className="text-rose-600"><TargetIcon /></span>
              <span className="truncate">{seed.target_date ? formatDate(seed.target_date) : "—"}</span>
            </div>
            <div className="flex h-8 items-center bg-white px-2" title="Kalan süre">
              {seed.target_date && seed.status === "active" ? (
                <SeedLiveCountdown
                  targetDate={seed.target_date}
                  targetTime={reminderTargetTime}
                  timezone={reminderTimezone}
                  variant="meta"
                />
              ) : (
                <span className="text-[8px] font-bold text-gray-400">—</span>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-[65px] rounded-xl border border-gray-100 bg-gray-50 p-2 text-[9px] text-gray-600">
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[7px] font-black uppercase text-gray-400">Görünürlük</p><p className="mt-0.5 font-bold text-gray-900">{isPrivateSeed ? "Yalnızca sen" : getSeedVisibilityLabel(seed.visibility)}</p></div>
              <div><p className="text-[7px] font-black uppercase text-gray-400">Durum</p><p className="mt-0.5 font-bold text-gray-900">{seed.status === "active" ? "Growing" : seed.status === "completed" ? "Completed" : "Archived"}</p></div>
              <div><p className="text-[7px] font-black uppercase text-gray-400">Günlük</p><p className="mt-0.5 font-bold text-gray-900">{journalCount}</p></div>
              <div><p className="text-[7px] font-black uppercase text-gray-400">Büyüyen Niyet</p><p className="mt-0.5 font-bold text-gray-900">{grownIntentCount}</p></div>
            </div>
            {seed.notes && <p className="mt-1.5 line-clamp-2 leading-3.5">{seed.notes}</p>}
            {seed.status === "completed" && completionLabel && <p className="mt-2 rounded-lg bg-purple-50 px-2 py-1 font-bold text-purple-800">Tamamlandı · {completionLabel}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {seed.status === "active" && (
                <SeedCompletionDialog seedId={seed.seed_id} seedTitle={seed.title} defaultVisibility={seed.visibility} buttonClassName="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-[9px] font-black text-purple-800" />
              )}
              {seed.status === "active" && <button type="button" disabled={isWorking} onClick={() => changeStatus("archived")} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[9px] font-black text-gray-700">Arşivle</button>}
              {seed.status === "completed" && seed.origin !== "retrospective" && <button type="button" disabled={isWorking} onClick={() => changeStatus("active")} className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[9px] font-black text-green-800">Yeniden Aç</button>}
              <button type="button" disabled={isWorking} onClick={remove} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-black text-red-700">Sil</button>
            </div>
            {message && <p className="mt-2 text-[9px] font-bold text-red-700">{message}</p>}
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
            className="ml-auto inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2 text-[8px] font-black text-gray-700 hover:border-green-300"
          >
            Detaylar {detailsOpen ? "▴" : "▾"}
          </button>
        </div>
      </div>
    </article>
  );
}
