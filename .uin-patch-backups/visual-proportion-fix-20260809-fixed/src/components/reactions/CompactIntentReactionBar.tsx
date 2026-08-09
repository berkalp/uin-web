"use client";

import { useState } from "react";

import { supabase } from "@/utils/supabase/client";

type Props = {
  intentId: string;
  initialContext: unknown;
  isAuthenticated: boolean;
  isOwner: boolean;
};

type ReactionRow = {
  intent_id: string;
  save_count: number | string | null;
  paw_count: number | string | null;
  viewer_saved: boolean | null;
  viewer_pawed: boolean | null;
  viewer_paw_visibility: string | null;
  friend_paw_count: number | string | null;
  friend_paw_preview: unknown;
  viewer_can_react: boolean | null;
  reaction_disabled_reason: string | null;
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CompactIntentReactionBar({
  intentId,
  initialContext,
  isAuthenticated,
  isOwner,
}: Props) {
  const [context, setContext] = useState<ReactionRow | null>(
    () => (initialContext && typeof initialContext === "object"
      ? (initialContext as ReactionRow)
      : null)
  );
  const [busy, setBusy] = useState<"save" | "paw" | null>(null);

  const saveCount = asNumber(context?.save_count);
  const pawCount = asNumber(context?.paw_count);
  const viewerSaved = context?.viewer_saved === true;
  const viewerPawed = context?.viewer_pawed === true;

  const disabled =
    !isAuthenticated ||
    isOwner ||
    context?.viewer_can_react === false ||
    busy !== null;

  async function toggle(type: "save" | "paw") {
    if (disabled) return;

    const active = type === "save" ? viewerSaved : viewerPawed;

    try {
      setBusy(type);

      const { data, error } = await supabase.rpc("set_my_intent_reaction", {
        p_intent_id: intentId,
        p_reaction_type: type,
        p_active: !active,
      });

      if (error) {
        console.error("Intent reaction update failed:", error);
        return;
      }

      const row = ((data ?? [])[0] ?? null) as ReactionRow | null;
      if (row) {
        setContext(row);
      }
    } finally {
      setBusy(null);
    }
  }

  const disabledReason =
    context?.reaction_disabled_reason ||
    (isOwner
      ? "You cannot react to your own Intent."
      : !isAuthenticated
        ? "Sign in to Save or Paw this Intent."
        : undefined);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void toggle("save")}
        disabled={disabled}
        title={disabledReason || (viewerSaved ? "Remove from saved" : "Save")}
        aria-label={`${viewerSaved ? "Remove save" : "Save"} · ${saveCount}`}
        className={`inline-flex h-7 min-w-[48px] items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition ${
          viewerSaved
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:text-rose-700"
        } disabled:cursor-not-allowed disabled:opacity-55`}
      >
        <span aria-hidden="true">{viewerSaved ? "♥" : "♡"}</span>
        <span>{saveCount}</span>
      </button>

      <button
        type="button"
        onClick={() => void toggle("paw")}
        disabled={disabled}
        title={disabledReason || (viewerPawed ? "Remove Paw" : "Paw")}
        aria-label={`${viewerPawed ? "Remove Paw" : "Paw"} · ${pawCount}`}
        className={`inline-flex h-7 min-w-[48px] items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition ${
          viewerPawed
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:text-amber-800"
        } disabled:cursor-not-allowed disabled:opacity-55`}
      >
        <span aria-hidden="true">🐾</span>
        <span>{pawCount}</span>
      </button>
    </div>
  );
}
