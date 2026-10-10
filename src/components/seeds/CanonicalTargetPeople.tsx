"use client";

import { useEffect, useState } from "react";

import { wishWords, type WishPresentation } from "@/components/cards/PersonalWishSummary";
import TopicCardModal, { type Detail } from "@/components/ideas/TopicCardModal";
import { parseCommunityCounts } from "@/utils/communityCounts";
import { supabase } from "@/utils/supabase/client";
import { targetLanguage } from "@/utils/targetLanguage";

type CommunityDetail = Detail & {
  communityCounts?: number[];
  contentType?: {
    id: string;
    label: string;
    icon: string;
    base_kind: string;
    ui_labels?: WishPresentation["ui_labels"];
  };
};

type Resolution =
  | string
  | { sourceKey: string; targetId: string };

type MetricView = "want" | "done" | "events";

type CanonicalTargetPeopleProps = {
  seedId?: string | null;
  targetId?: string | null;
  seedType?: string | null;
  initialCounts?: [number, number];
  compact?: boolean;
  appearance?: "default" | "overlay";
  socialCount?: number;
  socialHref?: string;
  presentation?: WishPresentation;
};

export function targetLabels(type?: string | null) {
  const words = targetLanguage(type);
  return [words.want, words.done];
}

function resolvedTargetId(resolution: Resolution) {
  return typeof resolution === "string" ? resolution : resolution.targetId;
}

export default function CanonicalTargetPeople({
  seedId,
  targetId,
  seedType,
  initialCounts,
  compact = false,
  appearance = "default",
  socialCount,
  presentation,
}: CanonicalTargetPeopleProps) {
  const sourceKey = targetId ? `target:${targetId}` : `seed:${seedId || ""}`;
  const initial = parseCommunityCounts(
    initialCounts?.[0],
    initialCounts?.[1],
    socialCount
  );
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [resolved, setResolved] = useState<Resolution>(targetId || "");
  const [error, setError] = useState<string | false>(false);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<MetricView | null>(null);
  const resolutionMatches =
    typeof resolved === "string"
      ? targetId
        ? resolved === targetId
        : Boolean(resolved)
      : resolved.sourceKey === sourceKey;
  const currentDetail = resolutionMatches ? detail : null;
  const hasInitial = initial !== null;
  const hasError = error === sourceKey;

  useEffect(() => {
    const needsDetail =
      retry > 0 ||
      (!hasError && !currentDetail && (!hasInitial || view !== null));
    if (!needsDetail) return;

    let alive = true;
    void (async () => {
      try {
        let id = targetId;
        if (!id && seedId) {
          const result = await supabase.rpc("get_canonical_seed_detail_v31", {
            p_source_seed_id: seedId,
          });
          if (result.error) throw result.error;
          const row = Array.isArray(result.data) ? result.data[0] : result.data;
          id = row?.canonical_target_id;
        }
        if (!id) throw new Error("Kart bulunamadı");

        const response = await fetch(
          `/api/ideas/${encodeURIComponent(id)}?summary=1`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Kart yüklenemedi");
        const data = (await response.json()) as CommunityDetail;
        if (alive) {
          setResolved({ sourceKey, targetId: id });
          setDetail(data);
          setError(false);
          setRetry(0);
        }
      } catch {
        if (alive) {
          setError(sourceKey);
          setRetry(0);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    currentDetail,
    hasError,
    hasInitial,
    retry,
    seedId,
    sourceKey,
    targetId,
    view,
  ]);

  const type = currentDetail?.contentType;
  const p =
    presentation ||
    (type
      ? {
          type_id: type.id,
          type_label: type.label,
          type_icon: type.icon,
          base_kind: type.base_kind,
          ui_labels: type.ui_labels,
          start_date: null,
          end_date: null,
          timing_precision: "flexible" as const,
          date_options: [],
          location: null,
        }
      : null);
  const fallback = targetLanguage(seedType);
  const w = p ? wishWords(p) : null;
  const contextual =
    w && (w.action !== "YAP" || Boolean(p?.ui_labels?.wanting) || !seedType);
  const wanting = contextual ? w.wanting : fallback.want;
  const doers = contextual ? w.doers : fallback.done;
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Europe/Istanbul",
  });
  const detailCounts = currentDetail
    ? parseCommunityCounts(
        currentDetail.communityCounts?.[0] ??
          currentDetail.people.filter((person) => person.is_current !== false).length,
        currentDetail.communityCounts?.[1] ?? currentDetail.reviews.length,
        currentDetail.communityCounts?.[2] ??
          currentDetail.events.filter(
            (event) =>
              !["cancelled", "canceled", "completed"].includes(event.status || "") &&
              !["cancelled", "completed"].includes(event.plan_status || "") &&
              (!event.end_date || event.end_date.slice(0, 10) >= today)
          ).length
      )
    : null;
  const counts = detailCounts || initial;
  const loadingDetail = Boolean(
    view && !currentDetail && (!hasError || retry > 0)
  );
  const canOpen = Boolean(targetId || seedId);

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {(["want", "done", "events"] as const).map((metricView, index) => (
          <button
            key={metricView}
            type="button"
            disabled={!canOpen || loadingDetail}
            aria-busy={loadingDetail && view === metricView}
            onClick={() => setView(metricView)}
            className={
              appearance === "overlay"
                ? "flex min-h-[64px] flex-col items-center justify-center rounded-xl border border-white/15 bg-white/10 px-1.5 text-center text-white transition hover:bg-white/15 disabled:opacity-70"
                : `rounded-xl border px-2 py-3 text-left text-xs ${
                    index === 0
                      ? "border-emerald-100 bg-emerald-50 text-emerald-900"
                      : "border-violet-100 bg-violet-50 text-violet-900"
                  }`
            }
          >
            <span
              className={`block text-[10px] font-bold leading-tight ${
                appearance === "overlay" ? "min-h-0 text-white/75" : "min-h-8"
              }`}
            >
              {[wanting, doers, "Aktif etkinlikler"][index]}
            </span>
            <span
              className={compact ? "font-bold" : "mt-1 block text-xl font-black leading-none"}
            >
              {counts ? counts[index] : hasError ? "—" : "…"}
            </span>
          </button>
        ))}
      </div>
      {hasError && (
        <button
          type="button"
          disabled={retry > 0}
          onClick={() => setRetry((current) => current + 1)}
          className={
            appearance === "overlay"
              ? "mt-2 text-xs text-red-200 underline"
              : "text-xs text-red-700 underline"
          }
        >
          {retry > 0
            ? "Yükleniyor…"
            : counts
              ? "Ayrıntıları tekrar yükle"
              : "Sayaçları tekrar yükle"}
        </button>
      )}
      {view && currentDetail && (
        <TopicCardModal
          selected={{
            catalogItemId: currentDetail.card.catalog_item_id || "",
            canonicalTargetId: resolvedTargetId(resolved),
            title: currentDetail.card.title,
            subtitle: currentDetail.card.subtitle,
            coverUrl: currentDetail.card.cover_url,
            initialView: view,
          }}
          contentType={{
            id: p?.type_id || seedType || "activity",
            label: p?.type_label || "Aktivite",
            icon: p?.type_icon || fallback.icon,
          }}
          isClub={p?.base_kind === "club"}
          mediaKind={
            p?.base_kind === "movie"
              ? "movie"
              : p?.base_kind === "series" || p?.base_kind === "video"
                ? "series"
                : undefined
          }
          wantingLabel={wanting}
          doersLabel={doers}
          wantLabel={
            contextual ? w.want : fallback.want.replace(" isteyenler", " istiyorum")
          }
          doneLabel={w?.done || "Deneyim ekle"}
          targetAction={contextual ? w.action : fallback.action}
          eventButtonLabel={w?.event || "Etkinlik düzenle"}
          onSelectType={(id) => {
            window.location.href = `/ideas?kind=${encodeURIComponent(id)}`;
          }}
          onClose={() => {
            setView(null);
            setRetry((current) => current + 1);
          }}
        />
      )}
    </>
  );
}
