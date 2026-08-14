"use client";

import { useState, useTransition } from "react";

import { setMySeedReaction } from "@/services/seedService";
import {
  emptySeedReactionContext,
  type SeedReactionContext,
} from "@/utils/seeds";

type SeedReactionBarProps = {
  seedId: string;
  initialContext?: SeedReactionContext | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  variant?: "card" | "detail" | "compact" | "toolbar";
};

function firstFriendName(context: SeedReactionContext) {
  const first = context.friend_water_preview[0];
  return first?.full_name || first?.username || null;
}

export default function SeedReactionBar({
  seedId,
  initialContext,
  isAuthenticated,
  isOwner,
  variant = "card",
}: SeedReactionBarProps) {
  const [context, setContext] = useState<SeedReactionContext>(
    initialContext ??
      emptySeedReactionContext(seedId, {
        reaction_disabled_reason: isAuthenticated
          ? null
          : "Sign in to Save or Water this Seed.",
      })
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<"save" | "water" | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const canReact =
    isAuthenticated &&
    !isOwner &&
    (context.viewer_can_react ||
      context.viewer_saved ||
      context.viewer_watered);

  function toggle(reactionType: "save" | "water") {
    if (!canReact || isPending) {
      setMessage(
        context.reaction_disabled_reason ||
          (isAuthenticated
            ? "This Seed is not accepting reactions."
            : "Sign in to Save or Water this Seed.")
      );
      return;
    }

    const nextActive =
      reactionType === "save"
        ? !context.viewer_saved
        : !context.viewer_watered;

    setMessage(null);
    setPendingType(reactionType);

    startTransition(async () => {
      try {
        const updated = await setMySeedReaction({
          seedId,
          reactionType,
          active: nextActive,
        });

        setContext(updated);
        setMessage(
          reactionType === "save"
            ? nextActive
              ? "Saved privately."
              : "Removed from Saved Seeds."
            : nextActive
              ? "You watered this Seed."
              : "Water removed."
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The Seed reaction could not be saved."
        );
      } finally {
        setPendingType(null);
      }
    });
  }

  const friendName = firstFriendName(context);
  const extraFriendCount = Math.max(context.friend_water_count - 1, 0);
  const isDetail = variant === "detail";
  const isCompact = variant === "compact";
  const isToolbar = variant === "toolbar";

  if (isToolbar) {
    const heart = (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={context.viewer_saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    );
    const droplet = (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={context.viewer_watered ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 2.8S5.5 9.6 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.6 12 2.8 12 2.8Z" />
      </svg>
    );

    if (isOwner) {
      return (
        <div className="flex items-center gap-1">
          <span title="Kaydedilme sayısı" className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg border border-rose-100 bg-white px-1.5 text-[9px] font-black text-rose-600">
            {heart}<span>{context.save_count}</span>
          </span>
          <span title="Sulama sayısı" className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg border border-cyan-100 bg-white px-1.5 text-[9px] font-black text-cyan-700">
            {droplet}<span>{context.water_count}</span>
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => toggle("save")} disabled={isPending || !canReact} aria-pressed={context.viewer_saved} title="Kaydet" className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg border px-1.5 text-[9px] font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${context.viewer_saved ? "border-rose-200 bg-rose-50 text-rose-700" : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:text-rose-700"}`}>
          {pendingType === "save" && isPending ? <span>…</span> : heart}<span>{context.save_count}</span>
        </button>
        <button type="button" onClick={() => toggle("water")} disabled={isPending || !canReact} aria-pressed={context.viewer_watered} title="Sula" className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-lg border px-1.5 text-[9px] font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${context.viewer_watered ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-gray-200 bg-white text-gray-600 hover:border-cyan-200 hover:text-cyan-700"}`}>
          {pendingType === "water" && isPending ? <span>…</span> : droplet}<span>{context.water_count}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        isDetail
          ? "rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4"
          : ""
      }
    >
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
              disabled={isPending || !canReact}
              aria-pressed={context.viewer_saved}
              title="Save this Seed privately for later"
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                context.viewer_saved
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-rose-200 hover:text-rose-700"
              }`}
            >
              <span aria-hidden="true" className="text-base">
                {pendingType === "save" && isPending
                  ? "…"
                  : context.viewer_saved
                    ? "♥"
                    : "♡"}
              </span>
              <span>{context.viewer_saved ? "Saved" : "Save"}</span>
              {context.save_count > 0 && (
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold">
                  {context.save_count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => toggle("water")}
              disabled={isPending || !canReact}
              aria-pressed={context.viewer_watered}
              title="Water this Seed to support its growth"
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                context.viewer_watered
                  ? "border-cyan-300 bg-cyan-100 text-cyan-900 shadow-sm"
                  : "border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
              }`}
            >
              <span aria-hidden="true" className="text-base">
                {pendingType === "water" && isPending ? "…" : "💧"}
              </span>
              <span>{context.viewer_watered ? "Watered" : "Water"}</span>
              {context.water_count > 0 && (
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold">
                  {context.water_count}
                </span>
              )}
            </button>
          </>
        ) : (
          <>
            <span className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 font-semibold text-rose-700">
              ♥ {context.save_count} save{context.save_count === 1 ? "" : "s"}
            </span>
            <span className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 font-semibold text-cyan-800">
              💧 {context.water_count}
            </span>
          </>
        )}
      </div>

      {friendName && context.friend_water_count > 0 && (
        <p className="mt-2 text-xs font-semibold text-cyan-800">
          {friendName}
          {extraFriendCount > 0
            ? ` and ${extraFriendCount} friend${extraFriendCount === 1 ? "" : "s"}`
            : ""}{" "}
          watered this Seed.
        </p>
      )}

      {message && (
        <p
          className={`mt-2 text-xs font-semibold ${
            message.toLowerCase().includes("sign in") ||
            message.toLowerCase().includes("could not") ||
            message.toLowerCase().includes("not accepting")
              ? "text-red-600"
              : "text-gray-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
