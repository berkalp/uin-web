"use client";

import { useState, useTransition } from "react";

import IntentReactionPeopleModal from "@/components/reactions/IntentReactionPeopleModal";
import { setMyIntentReaction } from "@/services/intentReactionService";
import {
  emptyIntentReactionContext,
  type IntentReactionContext,
} from "@/utils/intentReactions";

type IntentReactionBarProps = {
  intentId: string;
  initialContext?: IntentReactionContext | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  variant?: "card" | "detail" | "compact";
};

export default function IntentReactionBar({
  intentId,
  initialContext,
  isAuthenticated,
  isOwner,
  variant = "card",
}: IntentReactionBarProps) {
  const [context, setContext] = useState<IntentReactionContext>(
    initialContext ??
      emptyIntentReactionContext(intentId, {
        reaction_disabled_reason: isAuthenticated
          ? null
          : "Öne çıkarmak için giriş yap.",
      })
  );

  const [message, setMessage] = useState<string | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canHighlight =
    isAuthenticated &&
    !isOwner &&
    (context.viewer_pawed || context.viewer_can_react);

  function toggleHighlight() {
    if (!canHighlight || isPending) {
      setMessage(
        context.reaction_disabled_reason ||
          (isAuthenticated
            ? "Bu Sosyal Niyet şu anda yeni etkileşim kabul etmiyor."
            : "Öne çıkarmak için giriş yap.")
      );
      return;
    }

    const nextActive = !context.viewer_pawed;

    setMessage(null);

    startTransition(async () => {
      try {
        const updated = await setMyIntentReaction({
          intentId,
          reactionType: "paw",
          active: nextActive,
        });

        setContext(updated);
        setMessage(
          nextActive
            ? "Öne çıkarıldı."
            : "Öne çıkarmadan kaldırıldı."
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Sosyal Niyet etkileşimi kaydedilemedi."
        );
      }
    });
  }

  const isDetail = variant === "detail";
  const isCompact = variant === "compact";

  if (isOwner) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPeopleOpen(true)}
          title="Öne çıkaranları gör"
          aria-label={`Öne çıkaranlar · ${context.paw_count}`}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50 font-black text-violet-700 transition hover:border-violet-200 hover:bg-violet-100 ${
            isDetail ? "min-h-10 px-3 py-2 text-sm" : "min-h-8 px-2.5 text-xs"
          }`}
        >
          <span aria-hidden="true">✨</span>
          <span>{context.paw_count}</span>
          {isDetail ? <span aria-hidden="true">›</span> : null}
        </button>

        <IntentReactionPeopleModal
          open={peopleOpen}
          intentId={intentId}
          reactionType="paw"
          count={context.paw_count}
          onClose={() => setPeopleOpen(false)}
        />
      </>
    );
  }

  return (
    <div
      className={
        isDetail
          ? "rounded-2xl border border-violet-100 bg-violet-50/50 p-4"
          : ""
      }
    >
      <button
        type="button"
        onClick={toggleHighlight}
        disabled={isPending || !canHighlight}
        title={context.viewer_pawed ? "Öne çıkarmayı kaldır" : "Öne çıkar"}
        aria-pressed={context.viewer_pawed}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
          isCompact ? "min-h-8 px-2.5 text-xs" : "min-h-9 px-3 text-sm"
        } ${
          context.viewer_pawed
            ? "border-violet-200 bg-violet-100 text-violet-800"
            : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
        }`}
      >
        <span aria-hidden="true">
          {isPending ? "…" : "✨"}
        </span>
        <span>
          {context.viewer_pawed ? "Öne çıkarıldı" : "Öne çıkar"}
        </span>
        {context.paw_count > 0 ? (
          <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-black">
            {context.paw_count}
          </span>
        ) : null}
      </button>

      {message ? (
        <p
          className={`mt-2 text-xs leading-5 ${
            message.includes("kaydedilemedi") ||
            message.includes("kabul etmiyor")
              ? "text-red-700"
              : "text-gray-500"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}