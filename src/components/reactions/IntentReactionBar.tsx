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
            ? "Öne çıkardın."
            : "Öne çıkarmayı iptal ettin."
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

  const countButton = (
    <button
      type="button"
      onClick={() => setPeopleOpen(true)}
      disabled={!isAuthenticated}
      title="Öne çıkaranları gör"
      aria-label={`Öne çıkaranlar · ${context.paw_count}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 font-black text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-55 ${
        isDetail
          ? "min-h-11 px-4 text-sm"
          : isCompact
            ? "min-h-8 px-2.5 text-xs"
            : "min-h-9 px-3 text-sm"
      }`}
    >
      <span aria-hidden="true">✨</span>
      <span>{context.paw_count}</span>
      {isDetail ? (
        <span className="font-semibold">Öne çıkaran</span>
      ) : null}
      <span aria-hidden="true">›</span>
    </button>
  );

  const actionButton = !isOwner ? (
    <button
      type="button"
      onClick={toggleHighlight}
      disabled={isPending || !canHighlight}
      title={
        context.viewer_pawed
          ? "Öne çıkarmayı iptal et"
          : "Öne çıkar"
      }
      aria-pressed={context.viewer_pawed}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
        isDetail
          ? "min-h-11 px-4 text-sm"
          : isCompact
            ? "min-h-8 px-2.5 text-xs"
            : "min-h-9 px-3 text-sm"
      } ${
        context.viewer_pawed
          ? "border-violet-300 bg-violet-600 text-white hover:bg-violet-700"
          : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
      }`}
    >
      <span aria-hidden="true">
        {isPending ? "…" : "✨"}
      </span>

      <span>
        {context.viewer_pawed
          ? isCompact
            ? "İptal et"
            : "Öne çıkarmayı iptal et"
          : "Öne çıkar"}
      </span>
    </button>
  ) : null;

  if (isDetail) {
    return (
      <>
        <section className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">
                ÖNE ÇIKAR
              </p>

              <h3 className="mt-1 text-lg font-black text-gray-950">
                Bu niyeti öne çıkar
              </h3>

              <p className="mt-1 max-w-md text-sm leading-6 text-gray-600">
                Beğendiğin ve başkalarının da görmesini istediğin sosyal niyetleri öne çıkar.
              </p>
            </div>

            {countButton}
          </div>

          {!isOwner && (
            <div className="mt-4">
              {actionButton}
            </div>
          )}

          {context.viewer_pawed && !isOwner ? (
            <p className="mt-3 text-xs font-bold text-violet-700">
              Bu niyeti öne çıkardın.
            </p>
          ) : null}

          {message ? (
            <p
              className={`mt-3 text-xs leading-5 ${
                message.includes("kaydedilemedi") ||
                message.includes("kabul etmiyor")
                  ? "text-red-700"
                  : "text-gray-600"
              }`}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </section>

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
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {countButton}
        {actionButton}
      </div>

      {message && !isCompact ? (
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