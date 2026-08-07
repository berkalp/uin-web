"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import SeedCompletionDialog from "@/components/seeds/SeedCompletionDialog";
import SeedReactionBar from "@/components/seeds/SeedReactionBar";
import {
  deleteSeed,
  setSeedStatus,
} from "@/services/seedService";
import {
  getSeedCompletionLabel,
  getSeedVisibilityLabel,
  toSeedCount,
  type SeedRecord,
  type SeedStatus,
} from "@/utils/seeds";

type SeedCardProps = {
  seed: SeedRecord;
  isAuthenticated: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: value.length === 10 ? "UTC" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusTone(status: SeedStatus) {
  if (status === "completed") {
    return "bg-purple-100 text-purple-800";
  }

  if (status === "archived") {
    return "bg-gray-200 text-gray-700";
  }

  return "bg-green-100 text-green-800";
}

export default function SeedCard({
  seed,
  isAuthenticated,
}: SeedCardProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const grownIntentCount = toSeedCount(seed.grown_intent_count);
  const journalCount = toSeedCount(seed.journal_count);
  const completionLabel = getSeedCompletionLabel(seed);

  async function changeStatus(status: SeedStatus) {
    setIsWorking(true);
    setMessage(null);

    try {
      await setSeedStatus(seed.seed_id, status);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Seed could not be updated."
      );
      setIsWorking(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm(
      `Delete “${seed.title}” from your Seeds? The shared Library subject will remain.`
    );

    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      await deleteSeed(seed.seed_id);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Seed could not be deleted."
      );
      setIsWorking(false);
    }
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
      <Link
        href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
        className="relative block h-44 overflow-hidden bg-gradient-to-br from-green-950 via-emerald-800 to-lime-700"
      >
        {seed.cover_url && (
          <img
            src={seed.cover_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
            <span aria-hidden="true">{seed.seed_type_icon}</span>
            {seed.seed_type_name}
          </span>

          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(
              seed.status
            )}`}
          >
            {seed.status === "active" ? "growing" : seed.status}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h2 className="text-2xl font-black leading-tight">{seed.title}</h2>
          {seed.subtitle && (
            <p className="mt-1.5 text-sm font-semibold text-white/75">
              {seed.subtitle}
            </p>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">
            {getSeedVisibilityLabel(seed.visibility)}
          </span>
          {seed.target_date && seed.status === "active" && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">
              Target · {formatDate(seed.target_date)}
            </span>
          )}
          {seed.status === "completed" && completionLabel && (
            <span className="rounded-full bg-purple-50 px-3 py-1.5 text-purple-800">
              Completed · {completionLabel}
            </span>
          )}
          {seed.origin === "retrospective" && (
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">
              Past experience
            </span>
          )}
          {grownIntentCount > 0 && (
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-800">
              {grownIntentCount} Intent{grownIntentCount === 1 ? "" : "s"}
            </span>
          )}
          {journalCount > 0 && (
            <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-800">
              {journalCount} journal note{journalCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {seed.key_takeaway ? (
          <blockquote className="mt-4 line-clamp-3 rounded-2xl bg-purple-50 p-4 text-sm font-semibold leading-6 text-purple-900">
            “{seed.key_takeaway}”
          </blockquote>
        ) : seed.notes ? (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-600">
            {seed.notes}
          </p>
        ) : null}

        <div className="mt-4">
          <SeedReactionBar
            seedId={seed.seed_id}
            initialContext={seed.reaction_context}
            isAuthenticated={isAuthenticated}
            isOwner
            variant="compact"
          />
        </div>

        {message && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {message}
          </p>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          <Link
            href={`/seeds/${encodeURIComponent(seed.seed_id)}`}
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-center text-sm font-bold text-green-800 transition hover:bg-green-100"
          >
            View
          </Link>

          <Link
            href={`/seeds/${encodeURIComponent(seed.seed_id)}/edit`}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
          >
            Edit
          </Link>

          {seed.status !== "archived" && (
            <Link
              href={`/onboarding?seed=${encodeURIComponent(seed.seed_id)}`}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-green-700"
            >
              Grow into Intent
            </Link>
          )}

          {seed.status === "active" && (
            <SeedCompletionDialog
              seedId={seed.seed_id}
              seedTitle={seed.title}
              defaultVisibility={seed.visibility}
              buttonClassName="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-100"
            />
          )}

          {seed.status === "active" && (
            <button
              type="button"
              disabled={isWorking}
              onClick={() => changeStatus("archived")}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Archive
            </button>
          )}

          {seed.status === "completed" && seed.origin !== "retrospective" && (
            <button
              type="button"
              disabled={isWorking}
              onClick={() => changeStatus("active")}
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50"
            >
              Reopen
            </button>
          )}

          {seed.status === "completed" && (
            <button
              type="button"
              disabled={isWorking}
              onClick={() => changeStatus("archived")}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Archive
            </button>
          )}

          {seed.status === "archived" && (
            <button
              type="button"
              disabled={isWorking}
              onClick={() => changeStatus("active")}
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50"
            >
              Restore
            </button>
          )}

          <button
            type="button"
            disabled={isWorking || grownIntentCount > 0}
            onClick={remove}
            title={
              grownIntentCount > 0
                ? "Seeds linked to Intents are preserved as lineage."
                : "Delete only your personal Seed. The Library subject remains."
            }
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
