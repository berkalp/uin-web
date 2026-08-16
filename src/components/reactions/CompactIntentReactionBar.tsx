"use client";

import { useState } from "react";

import IntentReactionPeopleModal from "@/components/reactions/IntentReactionPeopleModal";
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
  const [context, setContext] = useState<ReactionRow | null>(() =>
    initialContext && typeof initialContext === "object"
      ? (initialContext as ReactionRow)
      : null
  );
  const [busy, setBusy] = useState<"save" | "paw" | null>(null);
  const [peopleType, setPeopleType] = useState<"save" | "paw" | null>(null);

  const saveCount = asNumber(context?.save_count);
  const pawCount = asNumber(context?.paw_count);
  const viewerSaved = context?.viewer_saved === true;
  const viewerPawed = context?.viewer_pawed === true;

  const disabled =
    !isAuthenticated ||
    busy !== null ||
    (!isOwner && context?.viewer_can_react === false);

  async function toggle(type: "save" | "paw") {
    if (disabled || isOwner) return;

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
      if (row) setContext(row);
    } finally {
      setBusy(null);
    }
  }

  function handlePress(type: "save" | "paw") {
    if (isOwner) {
      if (isAuthenticated) setPeopleType(type);
      return;
    }
    void toggle(type);
  }

  const disabledReason =
    context?.reaction_disabled_reason ||
    (!isAuthenticated ? "Kaydetmek veya Pati bırakmak için giriş yap." : undefined);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handlePress("save")}
          disabled={disabled}
          title={
            isOwner
              ? "Kaydedenleri gör"
              : disabledReason || (viewerSaved ? "Kaydı kaldır" : "Kaydet")
          }
          aria-label={
            isOwner
              ? `Kaydedenler · ${saveCount}`
              : `${viewerSaved ? "Kaydı kaldır" : "Kaydet"} · ${saveCount}`
          }
          className={`inline-flex h-6 min-w-[38px] items-center justify-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold transition ${
            viewerSaved && !isOwner
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : isOwner && saveCount > 0
                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:text-rose-700"
          } disabled:cursor-not-allowed disabled:opacity-55`}
        >
          <span aria-hidden="true">{isOwner || viewerSaved ? "♥" : "♡"}</span>
          <span>{saveCount}</span>
        </button>

        <button
          type="button"
          onClick={() => handlePress("paw")}
          disabled={disabled}
          title={
            isOwner
              ? "Patileyenleri gör"
              : disabledReason || (viewerPawed ? "Patiyi kaldır" : "Patile")
          }
          aria-label={
            isOwner
              ? `Patileyenler · ${pawCount}`
              : `${viewerPawed ? "Patiyi kaldır" : "Patile"} · ${pawCount}`
          }
          className={`inline-flex h-6 min-w-[38px] items-center justify-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold transition ${
            viewerPawed && !isOwner
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : isOwner && pawCount > 0
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:text-amber-800"
          } disabled:cursor-not-allowed disabled:opacity-55`}
        >
          <span aria-hidden="true">🐾</span>
          <span>{pawCount}</span>
        </button>
      </div>

      <IntentReactionPeopleModal
        open={peopleType !== null}
        intentId={intentId}
        reactionType={peopleType ?? "save"}
        count={peopleType === "paw" ? pawCount : saveCount}
        onClose={() => setPeopleType(null)}
      />
    </>
  );
}
