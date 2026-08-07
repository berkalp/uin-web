"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import SeedLinkedItemsEditor from "@/components/seeds/SeedLinkedItemsEditor";
import { saveSeedJournalEntry } from "@/services/seedService";
import {
  SEED_VISIBILITY_OPTIONS,
  type SeedJournalAttachment,
  type SeedJournalEntry,
  type SeedVisibility,
} from "@/utils/seeds";

type SeedExperienceEditorProps = {
  seedId: string;
  seedTitle: string;
  existingExperience?: SeedJournalEntry | null;
  defaultVisibility: SeedVisibility;
  occurredOn?: string | null;
  buttonClassName?: string;
  buttonLabel?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SeedExperienceEditor({
  seedId,
  seedTitle,
  existingExperience = null,
  defaultVisibility,
  occurredOn = null,
  buttonClassName = "rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-purple-700",
  buttonLabel,
}: SeedExperienceEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(existingExperience?.body ?? "");
  const [keyTakeaway, setKeyTakeaway] = useState(
    existingExperience?.key_takeaway ?? ""
  );
  const [visibility, setVisibility] = useState<SeedVisibility>(
    existingExperience?.visibility ?? defaultVisibility
  );
  const [attachments, setAttachments] = useState<SeedJournalAttachment[]>(
    existingExperience?.attachments ?? []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resolvedButtonLabel =
    buttonLabel ??
    (existingExperience ? "Edit my experience" : "+ Add my experience");

  async function submit() {
    setIsSaving(true);
    setMessage(null);

    try {
      await saveSeedJournalEntry({
        seedId,
        entryId: existingExperience?.id ?? null,
        entryKind: "reflection",
        body,
        keyTakeaway,
        visibility,
        occurredOn:
          existingExperience?.occurred_on || occurredOn?.slice(0, 10) || today(),
        attachments,
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your experience could not be saved."
      );
      setIsSaving(false);
    }
  }

  const hasContent =
    body.trim().length > 0 ||
    keyTakeaway.trim().length > 0 ||
    attachments.some((item) => item.url.trim().length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {resolvedButtonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-6 md:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">
                My Experience
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-950">
                What did “{seedTitle}” leave with you?
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                This is different from your Seed Journal. Journal entries record the process; this is the completed experience you want to keep and, if you choose, share on the Seed Library subject page.
              </p>
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <label className="block">
                <span className="text-sm font-black text-gray-950">
                  My experience
                </span>
                <span className="mt-1 block text-sm leading-6 text-gray-500">
                  Write what happened, what changed, what surprised you, or what you would tell someone considering the same Seed.
                </span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={6000}
                  rows={8}
                  placeholder="Write your completed experience here…"
                  className="mt-3 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                />
                <span className="mt-1 block text-xs text-gray-400">
                  {body.length}/6000
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-black text-gray-950">
                  What stayed with me?
                </span>
                <span className="mt-1 block text-sm leading-6 text-gray-500">
                  Optional. A short takeaway that can be highlighted on the Experience card.
                </span>
                <textarea
                  value={keyTakeaway}
                  onChange={(event) => setKeyTakeaway(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="One thought that remained after the experience."
                  className="mt-3 w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                />
              </label>

              <SeedLinkedItemsEditor
                items={attachments}
                onChange={setAttachments}
              />

              <div>
                <p className="text-sm font-black text-gray-950">
                  Who can see this Experience?
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Everyone makes it eligible to appear in the shared Subject’s Experiences section. Friends shows it only to friends. Only me keeps it in your private archive.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {SEED_VISIBILITY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        visibility === option.value
                          ? "border-purple-500 bg-purple-50 ring-4 ring-purple-100"
                          : "border-gray-200 bg-white hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`seed-experience-visibility-${seedId}`}
                        checked={visibility === option.value}
                        onChange={() => setVisibility(option.value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-black text-gray-950">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {message && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 p-5 md:px-8">
              <p className="max-w-lg text-xs leading-5 text-gray-500">
                Saving an Experience does not create a new Seed. It stays attached to this completed Seed and can surface in the shared Library according to visibility.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isSaving || !hasContent}
                  className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : existingExperience ? "Save changes" : "Save experience"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
