"use client";

import { useState, useTransition } from "react";

import IntentReactionPeopleModal from "@/components/reactions/IntentReactionPeopleModal";
import { setMyIntentReaction } from "@/services/intentReactionService";
import {
  emptyIntentReactionContext,
  type IntentReactionContext,
  type IntentReactionType,
} from "@/utils/intentReactions";

type IntentReactionBarProps = {
  intentId: string;
  initialContext?: IntentReactionContext | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  variant?: "card" | "detail" | "compact";
};

function friendName(context: IntentReactionContext) {
  const first = context.friend_paw_preview[0];
  if (!first) return null;
  return first.full_name || first.username || "Bir arkadaş";
}

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
          : "Kaydetmek veya Pati bırakmak için giriş yap.",
      })
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<IntentReactionType | null>(null);
  const [peopleType, setPeopleType] = useState<IntentReactionType | null>(null);
  const [isPending, startTransition] = useTransition();

  const canToggleSave =
    isAuthenticated &&
    !isOwner &&
    (context.viewer_saved || context.viewer_can_react);
  const canTogglePaw =
    isAuthenticated &&
    !isOwner &&
    (context.viewer_pawed || context.viewer_can_react);

  function toggle(reactionType: IntentReactionType) {
    const canToggle = reactionType === "save" ? canToggleSave : canTogglePaw;

    if (!canToggle || isPending) {
      setMessage(
        context.reaction_disabled_reason ||
          (isAuthenticated
            ? "Bu Niyet şu anda yeni etkileşim kabul etmiyor."
            : "Kaydetmek veya Pati bırakmak için giriş yap.")
      );
      return;
    }

    const nextActive =
      reactionType === "save" ? !context.viewer_saved : !context.viewer_pawed;

    setMessage(null);
    setPendingType(reactionType);
    startTransition(async () => {
      try {
        const updated = await setMyIntentReaction({
          intentId,
          reactionType,
          active: nextActive,
        });
        setContext(updated);
        setMessage(
          reactionType === "save"
            ? nextActive
              ? "Özel olarak kaydedildi."
              : "Kaydedilenlerden çıkarıldı."
            : nextActive
              ? "Pati bırakıldı. Profil görünürlük ayarın geçerli."
              : "Pati kaldırıldı."
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Niyet etkileşimi kaydedilemedi."
        );
      } finally {
        setPendingType(null);
      }
    });
  }

  const firstFriendName = friendName(context);
  const additionalFriends = Math.max(context.friend_paw_count - 1, 0);
  const isDetail = variant === "detail";
  const isCompact = variant === "compact";

  return (
    <>
      <div className={isDetail ? "rounded-2xl border border-amber-100 bg-amber-50/60 p-4" : ""}>
        <div
          className={`flex flex-wrap items-center gap-2 ${
            isCompact ? "text-xs" : "text-sm"
          }`}
        >
          {!isOwner ? (
            <>
              <button
                type="button"
                onClick={() => toggle("save")}
                disabled={isPending || !canToggleSave}
                title={context.viewer_saved ? "Kaydı kaldır" : "Daha sonra bakmak için özel kaydet"}
                aria-pressed={context.viewer_saved}
                className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  context.viewer_saved
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:text-rose-700"
                }`}
              >
                <span aria-hidden="true" className="text-base">
                  {pendingType === "save" && isPending
                    ? "…"
                    : context.viewer_saved
                      ? "♥"
                      : "♡"}
                </span>
                <span>{context.viewer_saved ? "Kaydedildi" : "Kaydet"}</span>
              </button>

              <button
                type="button"
                onClick={() => toggle("paw")}
                disabled={isPending || !canTogglePaw}
                title={context.viewer_pawed ? "Patiyi kaldır" : "Bu Niyeti Pati ile öner"}
                aria-pressed={context.viewer_pawed}
                className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  context.viewer_pawed
                    ? "border-amber-300 bg-amber-100 text-amber-900 shadow-sm"
                    : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                }`}
              >
                <span aria-hidden="true" className="text-base">
                  {pendingType === "paw" && isPending ? "…" : "🐾"}
                </span>
                <span>{context.viewer_pawed ? "Patilendi" : "Patile"}</span>
                {context.paw_count > 0 && (
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold">
                    {context.paw_count}
                  </span>
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPeopleType("save")}
                className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 font-semibold text-rose-700 transition hover:border-rose-200 hover:bg-rose-100"
                title="Kaydedenleri gör"
              >
                ♥ {context.save_count} Kaydedenler
              </button>
              <button
                type="button"
                onClick={() => setPeopleType("paw")}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900 transition hover:border-amber-300 hover:bg-amber-100"
                title="Patileyenleri gör"
              >
                🐾 {context.paw_count} Patileyenler
              </button>
            </div>
          )}

          {!isOwner && context.paw_count > 0 && variant === "compact" && (
            <span className="font-semibold text-amber-800">
              {context.paw_count} pati
            </span>
          )}
        </div>

        {context.friend_paw_count > 0 && (
          <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-amber-900">
            <div className="flex -space-x-2">
              {context.friend_paw_preview.map((friend) => {
                const label = friend.full_name || friend.username || "Arkadaş";
                return friend.avatar_url ? (
                  <img
                    key={friend.user_id}
                    src={friend.avatar_url}
                    alt={label}
                    className="h-6 w-6 rounded-full border-2 border-white object-cover"
                  />
                ) : (
                  <span
                    key={friend.user_id}
                    title={label}
                    className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-amber-100 text-[9px] font-black text-amber-800"
                  >
                    {label.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                );
              })}
            </div>
            <span className="min-w-0 truncate">
              {firstFriendName}
              {additionalFriends > 0 ? ` ve ${additionalFriends} arkadaş` : ""} bu Niyeti patiledi
            </span>
          </div>
        )}

        {message && (
          <p
            className={`mt-2 text-xs leading-5 ${
              message.includes("kaydedilemedi") || message.includes("kabul etmiyor")
                ? "text-red-700"
                : "text-gray-500"
            }`}
            role="status"
          >
            {message}
          </p>
        )}

        {isDetail && !message && !isOwner && (
          <p className="mt-2 text-xs leading-5 text-gray-500">
            Kaydetme özeldir. Pati, profil görünürlük ayarını kullanan sosyal bir öneridir.
          </p>
        )}
      </div>

      <IntentReactionPeopleModal
        open={peopleType !== null}
        intentId={intentId}
        reactionType={peopleType ?? "save"}
        count={peopleType === "paw" ? context.paw_count : context.save_count}
        onClose={() => setPeopleType(null)}
      />
    </>
  );
}
