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
  const [busy, setBusy] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

  const highlightCount = asNumber(context?.paw_count);
  const highlighted = context?.viewer_pawed === true;

  const disabled =
    !isAuthenticated ||
    busy ||
    (!isOwner && context?.viewer_can_react === false);

  async function toggleHighlight() {
    if (disabled || isOwner) return;

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc("set_my_intent_reaction", {
        p_intent_id: intentId,
        p_reaction_type: "paw",
        p_active: !highlighted,
      });

      if (error) {
        console.error("Intent highlight update failed:", error);
        return;
      }

      const row = ((data ?? [])[0] ?? null) as ReactionRow | null;
      if (row) setContext(row);
    } finally {
      setBusy(false);
    }
  }

  function handlePress() {
    if (isOwner) {
      if (isAuthenticated) setPeopleOpen(true);
      return;
    }

    void toggleHighlight();
  }

  const title = isOwner
    ? "Öne çıkaranları gör"
    : context?.reaction_disabled_reason ||
      (highlighted ? "Öne çıkarmayı kaldır" : "Öne çıkar");

  return (
    <>
      <button
        type="button"
        onClick={handlePress}
        disabled={disabled}
        title={title}
        aria-label={`${isOwner ? "Öne çıkaranlar" : "Öne çıkar"} · ${highlightCount}`}
        aria-pressed={!isOwner ? highlighted : undefined}
        className={`inline-flex h-6 min-w-[38px] items-center justify-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold transition ${
          highlighted && !isOwner
            ? "border-violet-200 bg-violet-50 text-violet-700"
            : isOwner && highlightCount > 0
              ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
              : "border-gray-200 bg-white text-gray-600 hover:border-violet-200 hover:text-violet-700"
        } disabled:cursor-not-allowed disabled:opacity-55`}
      >
        <span aria-hidden="true">✨</span>
        <span>{highlightCount}</span>
      </button>

      <IntentReactionPeopleModal
        open={peopleOpen}
        intentId={intentId}
        reactionType="paw"
        count={highlightCount}
        onClose={() => setPeopleOpen(false)}
      />
    </>
  );
}