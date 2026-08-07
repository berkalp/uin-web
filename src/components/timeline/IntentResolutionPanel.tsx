"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type IntentResolutionItem = {
  resolutionId: string;
  sourceIntentId: string;
  activityName: string;
  planId: string;
  planTitle: string;
  planHref: string;
  status: "pending" | "auto_resolved";
  decisionReason: string | null;
  pendingJoinRequestCount: number;
  pendingInvitationCount: number;
};

type WorkingAction = "resolve" | "keep_open" | "undo" | null;

function ResolutionCard({ item }: { item: IntentResolutionItem }) {
  const router = useRouter();
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function act(action: Exclude<WorkingAction, null>) {
    setWorkingAction(action);
    setErrorMessage("");

    try {
      const { error } = await supabase.rpc("resolve_my_joined_intent", {
        p_resolution_id: item.resolutionId,
        p_action: action,
      });

      if (error) throw error;
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The Intent could not be updated."
      );
      setWorkingAction(null);
    }
  }

  const hasWaitingPeople =
    item.pendingJoinRequestCount > 0 || item.pendingInvitationCount > 0;

  if (item.status === "auto_resolved") {
    return (
      <article className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
          Found your people
        </p>
        <h3 className="mt-2 font-black text-gray-950">{item.activityName}</h3>
        <p className="mt-2 text-xs leading-5 text-gray-500">
          Your open Intent was resolved by joining <strong>{item.planTitle}</strong>. It was not
          deleted: it now stays linked to this Shared Plan as part of its history and DNA.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={item.planHref}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-green-700"
          >
            Open Plan
          </Link>
          <button
            type="button"
            disabled={workingAction !== null}
            onClick={() => act("undo")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {workingAction === "undo" ? "Reopening..." : "Keep my Intent open instead"}
          </button>
        </div>
        {errorMessage && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {errorMessage}
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
        Intent resolution
      </p>
      <h3 className="mt-2 font-black text-gray-950">Does this Plan fulfil your {item.activityName} Intent?</h3>
      <p className="mt-2 text-xs leading-5 text-gray-500">
        You joined <strong>{item.planTitle}</strong>, while your own matching Intent is still open.
        UIN will keep both records, but your Intent can stop matching and become a source of this
        Shared Plan.
      </p>

      {item.decisionReason === "multiple_matching_intents" && (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
          You have more than one matching open Intent, so UIN will not guess which one this Plan
          fulfils.
        </p>
      )}

      {hasWaitingPeople && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Your Intent already has
          {item.pendingJoinRequestCount > 0
            ? ` ${item.pendingJoinRequestCount} pending join request${item.pendingJoinRequestCount === 1 ? "" : "s"}`
            : ""}
          {item.pendingJoinRequestCount > 0 && item.pendingInvitationCount > 0 ? " and" : ""}
          {item.pendingInvitationCount > 0
            ? ` ${item.pendingInvitationCount} pending invitation${item.pendingInvitationCount === 1 ? "" : "s"}`
            : ""}.
          Resolving it will close those pending paths cleanly. Nobody is moved to another Plan
          without their consent.
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={workingAction !== null}
          onClick={() => act("resolve")}
          className="rounded-xl bg-green-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {workingAction === "resolve" ? "Resolving..." : "Yes, this fulfils mine"}
        </button>
        <button
          type="button"
          disabled={workingAction !== null}
          onClick={() => act("keep_open")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {workingAction === "keep_open" ? "Keeping..." : "Keep mine open"}
        </button>
        <Link
          href={item.planHref}
          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-center text-xs font-black text-violet-700 transition hover:bg-violet-100"
        >
          Open Plan
        </Link>
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </article>
  );
}

export default function IntentResolutionPanel({
  items,
}: {
  items: IntentResolutionItem[];
}) {
  if (items.length === 0) return null;

  const pendingCount = items.filter((item) => item.status === "pending").length;
  const autoCount = items.filter((item) => item.status === "auto_resolved").length;

  return (
    <section className="mt-8 rounded-[28px] border border-violet-100 bg-violet-50/40 p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
            Intent → Plan
          </p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">
            {pendingCount > 0 ? "You found a Plan" : "Your Intent found its Plan"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Joining another member does not erase your Intent. UIN preserves it as the reason this
            Shared Plan became part of your timeline.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-700 shadow-sm">
          {pendingCount > 0 ? `${pendingCount} decision${pendingCount === 1 ? "" : "s"}` : `${autoCount} resolved`}
        </span>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <ResolutionCard key={item.resolutionId} item={item} />
        ))}
      </div>
    </section>
  );
}
