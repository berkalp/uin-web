"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";
import {
  PLAN_PRESENTATION_VISIBILITY_OPTIONS,
  normalizePlanPresentationVisibility,
  type PlanPresentationVisibility,
} from "@/utils/planPresentationVisibility";

type SharedActivityTitleFormProps = {
  planId: string;
  initialTitle: string | null;
  canonicalActivityName: string;
  canManage: boolean;
  initialVisibility?: PlanPresentationVisibility;
  variant?: "card" | "hero";
};

export default function SharedActivityTitleForm({
  planId,
  initialTitle,
  canonicalActivityName,
  canManage,
  initialVisibility = "participants",
  variant = "card",
}: SharedActivityTitleFormProps) {
  const router = useRouter();
  const [savedTitle, setSavedTitle] = useState(initialTitle ?? "");
  const [draftTitle, setDraftTitle] = useState(initialTitle ?? "");
  const [savedVisibility, setSavedVisibility] = useState(
    normalizePlanPresentationVisibility(initialVisibility)
  );
  const [draftVisibility, setDraftVisibility] = useState(
    normalizePlanPresentationVisibility(initialVisibility)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [moderationStatus, setModerationStatus] = useState<
    "active" | "under_review"
  >("active");

  useEffect(() => {
    let cancelled = false;

    void supabase
      .rpc("get_plan_title_moderation_state", {
        p_plan_ids: [planId],
      })
      .then(({ data, error }) => {
        if (cancelled || error) return;

        const row = (data ?? [])[0] as
          | { moderation_status?: string }
          | undefined;

        setModerationStatus(
          row?.moderation_status === "under_review"
            ? "under_review"
            : "active"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  const displayTitle = savedTitle || canonicalActivityName;
  const isHero = variant === "hero";
  const isUnderReview = moderationStatus === "under_review";
  const isCustomTitle =
    Boolean(savedTitle.trim()) &&
    savedTitle.trim() !== canonicalActivityName.trim();

  async function saveTitle() {
    const nextTitle = draftTitle.trim();

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.rpc("update_shared_activity_title", {
      p_plan_id: planId,
      p_shared_title: nextTitle || null,
      p_visibility: draftVisibility,
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message || "The shared title could not be saved.");
      return;
    }

    setSavedTitle(nextTitle);
    setDraftTitle(nextTitle);
    setSavedVisibility(draftVisibility);
    setIsEditing(false);
    setMessage(nextTitle ? "Title saved." : "Custom title removed.");
    router.refresh();
  }

  function startEditing() {
    setMessage(null);
    setDraftTitle(savedTitle);
    setDraftVisibility(savedVisibility);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(savedTitle);
    setDraftVisibility(savedVisibility);
    setMessage(null);
    setIsEditing(false);
  }

  if (isHero) {
    return (
      <div className="mt-3 max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-3xl font-bold leading-tight text-white drop-shadow md:text-4xl">
            {displayTitle}
          </h1>

          {canManage && !isEditing && !isUnderReview && (
            <button
              type="button"
              onClick={startEditing}
              className="shrink-0 rounded-xl border border-white/30 bg-white/90 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              Edit Title
            </button>
          )}
        </div>

        {isCustomTitle && (
          <p className="mt-2 text-xs font-semibold text-white/70">
            Original Activity · {canonicalActivityName}
          </p>
        )}

        {isUnderReview && (
          <div className="mt-3 max-w-3xl rounded-2xl border border-amber-300/40 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <span className="font-bold">Custom title under review.</span>{" "}
            The original Activity name is shown publicly until moderation is complete.
          </div>
        )}

        {canManage && isEditing && !isUnderReview && (
          <div className="mt-3 max-w-3xl rounded-2xl border border-white/20 bg-black/55 p-3 shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                maxLength={120}
                value={draftTitle}
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void saveTitle();
                  }
                  if (event.key === "Escape") {
                    cancelEditing();
                  }
                }}
                placeholder={`Example: ${canonicalActivityName}`}
                className="min-w-0 flex-1 rounded-xl border border-white/25 bg-white px-4 py-2.5 text-sm text-gray-950 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={cancelEditing}
                  className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveTitle()}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                Who can see this custom title?
              </span>
              <select
                value={draftVisibility}
                disabled={isSaving}
                onChange={(event) =>
                  setDraftVisibility(
                    normalizePlanPresentationVisibility(event.target.value)
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/25 bg-white px-3 py-2.5 text-sm font-semibold text-gray-950 outline-none focus:border-indigo-400"
              >
                {PLAN_PRESENTATION_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-white/60">
                {PLAN_PRESENTATION_VISIBILITY_OPTIONS.find(
                  (option) => option.value === draftVisibility
                )?.helper}
              </span>
            </label>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-white/60">{draftTitle.length} / 120</span>
              <button
                type="button"
                disabled={isSaving || !draftTitle.trim()}
                onClick={() => setDraftTitle("")}
                className="font-semibold text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Use canonical title
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-2 text-xs font-semibold text-white/85">{message}</p>
        )}
      </div>
    );
  }

  if (!canManage) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border border-indigo-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Shared Activity title
          </p>
          <h2 className="mt-1 truncate text-lg font-bold text-gray-950 sm:text-xl">
            {displayTitle}
          </h2>
          {isCustomTitle && (
            <p className="mt-1 text-xs font-semibold text-gray-400">
              Original Activity · {canonicalActivityName}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            This title belongs to the Shared Plan and completed Experience. Its audience is controlled separately.
          </p>
        </div>

        {!isEditing && !isUnderReview && (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
          >
            Edit Title
          </button>
        )}
      </div>

      {isUnderReview && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-bold">Custom title under review.</span>{" "}
          Editing is locked until moderation is complete; the original Activity name is shown in the meantime.
        </div>
      )}

      {isEditing && !isUnderReview && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              maxLength={120}
              value={draftTitle}
              autoFocus
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={`Example: ${canonicalActivityName}`}
              className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm text-gray-950 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={cancelEditing}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveTitle()}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Who can see this custom title?
            </span>
            <select
              value={draftVisibility}
              disabled={isSaving}
              onChange={(event) =>
                setDraftVisibility(
                  normalizePlanPresentationVisibility(event.target.value)
                )
              }
              className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500"
            >
              {PLAN_PRESENTATION_VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              {PLAN_PRESENTATION_VISIBILITY_OPTIONS.find(
                (option) => option.value === draftVisibility
              )?.helper}
            </span>
          </label>

          <div className="mt-2 flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-400">{draftTitle.length} / 120</span>
            <button
              type="button"
              disabled={isSaving || !draftTitle.trim()}
              onClick={() => setDraftTitle("")}
              className="font-semibold text-gray-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use canonical title
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-3 text-xs font-semibold text-indigo-700">{message}</p>
      )}
    </section>
  );
}
