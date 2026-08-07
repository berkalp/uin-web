"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import SeedLinkedItemsEditor from "@/components/seeds/SeedLinkedItemsEditor";
import { saveSeedJournalEntry } from "@/services/seedService";
import {
  SEED_VISIBILITY_OPTIONS,
  type SeedJournalAttachment,
  type SeedVisibility,
} from "@/utils/seeds";

type SeedJournalComposerProps = {
  seedId: string;
  defaultVisibility: SeedVisibility;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SeedJournalComposer({
  seedId,
  defaultVisibility,
}: SeedJournalComposerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [occurredOn, setOccurredOn] = useState(today());
  const [visibility, setVisibility] =
    useState<SeedVisibility>(defaultVisibility);
  const [attachments, setAttachments] = useState<
    SeedJournalAttachment[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasContent =
    body.trim().length > 0 ||
    attachments.some((item) => item.url.trim().length > 0);

  async function submit() {
    if (!hasContent) {
      setMessage("Add a note or linked item first.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await saveSeedJournalEntry({
        seedId,
        body,
        visibility,
        occurredOn,
        attachments,
      });
      setBody("");
      setAttachments([]);
      setExpanded(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Seed update could not be saved."
      );
      setIsSaving(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-2xl border border-dashed border-green-300 bg-green-50/60 px-5 py-5 text-left transition hover:bg-green-50"
      >
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
          Seed Journal
        </span>
        <span className="mt-2 block text-lg font-black text-gray-950">
          + Add an update
        </span>
        <span className="mt-1 block text-sm text-gray-500">
          Add a note, image URL, video URL or useful link.
        </span>
      </button>
    );
  }

  return (
    <section className="rounded-3xl border border-green-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
            New journal update
          </p>
          <h3 className="mt-2 text-xl font-black text-gray-950">
            What changed around this Seed?
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          Close
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <label>
          <span className="text-xs font-semibold text-gray-600">Date</span>
          <input
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-green-500"
          />
        </label>

        <label>
          <span className="text-xs font-semibold text-gray-600">Note</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={6000}
            rows={5}
            placeholder="Progress, a thought, something you discovered or a change of direction."
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-green-500"
          />
        </label>
      </div>

      <div className="mt-5">
        <SeedLinkedItemsEditor
          items={attachments}
          onChange={setAttachments}
          compact
        />
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-gray-900">Visibility</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SEED_VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${
                visibility === option.value
                  ? "border-green-400 bg-green-50 text-green-800"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <input
                type="radio"
                name={`seed-update-visibility-${seedId}`}
                checked={visibility === option.value}
                onChange={() => setVisibility(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {message}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={isSaving || !hasContent}
          className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Add update"}
        </button>
      </div>
    </section>
  );
}
