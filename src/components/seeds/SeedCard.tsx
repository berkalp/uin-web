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
};

function formatDate(value: string | null) {
  if (!value) return null;
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

export default function SeedCard({
  seed,
  isAuthenticated,
  reminderTargetTime,
  reminderTimezone,
}: SeedCardProps) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const grownIntentCount = toSeedCount(seed.grown_intent_count);
  const journalCount = toSeedCount(seed.journal_count);
  const completionLabel = getSeedCompletionLabel(seed);
  const isPrivateSeed = seed.seed_scope === "private";

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
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
        className="relative block aspect-square overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700"
      >
        {seed.cover_url && <img src={seed.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="max-w-[68%] truncate rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur">
            {seed.seed_type_icon} {seed.seed_type_name}
          </span>
          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusTone(seed.status)}`}>
            {seed.status === "active" ? "Growing" : seed.status === "completed" ? "Done" : "Archived"}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h2 className="line-clamp-2 text-lg font-black leading-tight">{seed.title}</h2>
          {seed.subtitle && <p className="mt-1 truncate text-[11px] font-semibold text-white/75">{seed.subtitle}</p>}
        </div>
      </Link>

      <div className="flex min-h-[190px] flex-1 flex-col p-3">
        <div className="flex min-h-8 flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-1 text-[9px] font-black ${isPrivateSeed ? "bg-gray-950 text-white" : "bg-emerald-50 text-emerald-800"}`}>
            {isPrivateSeed ? "🔒 Özel" : "Kütüphane Tohumu"}
          </span>
          {seed.target_date && seed.status === "active" && (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-800">
              Hedef · {formatDate(seed.target_date)}
            </span>
          )}
          {seed.target_date && seed.status === "active" && (
            <SeedLiveCountdown targetDate={seed.target_date} targetTime={reminderTargetTime} timezone={reminderTimezone} compact />
          )}
        </div>

        {!detailsOpen ? (
          <>
            {seed.key_takeaway ? (
              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-purple-800">“{seed.key_takeaway}”</p>
            ) : seed.notes ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">{seed.notes}</p>
            ) : (
              <div className="mt-2 h-10" />
            )}
            {!isPrivateSeed && (
              <div className="mt-auto pt-2">
                <SeedReactionBar seedId={seed.seed_id} initialContext={seed.reaction_context} isAuthenticated={isAuthenticated} isOwner variant="compact" />
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 flex-1 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[9px] font-black uppercase text-gray-400">Görünürlük</p><p className="mt-1 font-bold text-gray-900">{isPrivateSeed ? "Yalnızca sen" : getSeedVisibilityLabel(seed.visibility)}</p></div>
              <div><p className="text-[9px] font-black uppercase text-gray-400">Durum</p><p className="mt-1 font-bold text-gray-900">{seed.status === "active" ? "Growing" : seed.status === "completed" ? "Completed" : "Archived"}</p></div>
              <div><p className="text-[9px] font-black uppercase text-gray-400">Günlük</p><p className="mt-1 font-bold text-gray-900">{journalCount}</p></div>
              <div><p className="text-[9px] font-black uppercase text-gray-400">Büyüyen Niyet</p><p className="mt-1 font-bold text-gray-900">{grownIntentCount}</p></div>
            </div>
            {seed.status === "completed" && completionLabel && <p className="mt-2 rounded-xl bg-purple-50 px-2 py-1.5 font-bold text-purple-800">Tamamlandı · {completionLabel}</p>}
            {seed.notes && <p className="mt-2 line-clamp-3 leading-5">{seed.notes}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {seed.status === "active" && (
                <SeedCompletionDialog seedId={seed.seed_id} seedTitle={seed.title} defaultVisibility={seed.visibility} buttonClassName="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-[10px] font-black text-purple-800" />
              )}
              {seed.status === "active" && <button type="button" disabled={isWorking} onClick={() => changeStatus("archived")} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-gray-700">Arşivle</button>}
              {seed.status === "completed" && seed.origin !== "retrospective" && <button type="button" disabled={isWorking} onClick={() => changeStatus("active")} className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-[10px] font-black text-green-800">Yeniden Aç</button>}
              <button type="button" disabled={isWorking} onClick={remove} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-black text-red-700">Sil</button>
            </div>
            {message && <p className="mt-2 text-[10px] font-bold text-red-700">{message}</p>}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-2">
          <Link href={`/seeds/${encodeURIComponent(seed.seed_id)}`} aria-label="Tohumu görüntüle" title="Görüntüle" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700">
            <EyeIcon />
          </Link>
          <Link href={`/seeds/${encodeURIComponent(seed.seed_id)}/edit`} className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-[10px] font-black text-gray-700 hover:border-green-300 hover:text-green-700">Düzenle</Link>
          {seed.status !== "archived" && (
            <Link href={`/onboarding?seed=${encodeURIComponent(seed.seed_id)}`} className="inline-flex h-8 items-center rounded-lg bg-green-600 px-2.5 text-[10px] font-black text-white hover:bg-green-700">Niyete dönüştür</Link>
          )}
          <button type="button" onClick={() => setDetailsOpen((value) => !value)} className="ml-auto inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-[10px] font-black text-gray-700 hover:border-green-300">
            Detaylar {detailsOpen ? "▴" : "▾"}
          </button>
        </div>
      </div>
    </article>
  );
}
