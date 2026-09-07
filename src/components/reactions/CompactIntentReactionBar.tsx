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

  const toggleDisabled =
    !isAuthenticated ||
    busy ||
    isOwner ||
    (!highlighted &&
      context?.viewer_can_react === false);

  async function toggleHighlight() {
    if (toggleDisabled) return;

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc(
        "set_my_intent_reaction",
        {
          p_intent_id: intentId,
          p_reaction_type: "paw",
          p_active: !highlighted,
        }
      );

      if (error) {
        console.error(
          "Intent highlight update failed:",
          error
        );
        return;
      }

      const row =
        ((data ?? [])[0] ?? null) as ReactionRow | null;

      if (row) {
        setContext(row);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="inline-flex h-6 items-center gap-1">
        <button
          type="button"
          onClick={() => setPeopleOpen(true)}
          disabled={!isAuthenticated}
          title="Öne çıkaranları gör"
          aria-label={`Öne çıkaranlar · ${highlightCount}`}
          className="inline-flex h-6 min-w-[38px] items-center justify-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 text-[10px] font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span aria-hidden="true">✨</span>
          <span>{highlightCount}</span>
        </button>

        {!isOwner && (
          <button
            type="button"
            onClick={() => void toggleHighlight()}
            disabled={toggleDisabled}
            title={
              highlighted
                ? "Öne çıkarmayı iptal et"
                : context?.reaction_disabled_reason ||
                  "Öne çıkar"
            }
            aria-pressed={highlighted}
            className={`inline-flex h-6 items-center justify-center rounded-full border px-2 text-[9px] font-black transition ${
              highlighted
                ? "border-violet-200 bg-violet-100 text-violet-800 hover:bg-violet-200"
                : "border-gray-200 bg-white text-gray-600 hover:border-violet-200 hover:text-violet-700"
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            {busy
              ? "…"
              : highlighted
                ? "İptal et"
                : "Öne çıkar"}
          </button>
        )}
      </div>

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