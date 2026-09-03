"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import SeedLinkedItemsEditor from "@/components/seeds/SeedLinkedItemsEditor";
import { saveSeedJournalEntry } from "@/services/seedService";
import { supabase } from "@/utils/supabase/client";
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
  autoOpen?: boolean;
  completedDatePrecision?: "exact" | "year" | "unknown" | null;
  completedYear?: number | null;
  personalCoverUrl?: string | null;
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
  autoOpen = false,
  completedDatePrecision = null,
  completedYear = null,
  personalCoverUrl = null,
}: SeedExperienceEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [datePrecision, setDatePrecision] = useState<"exact" | "year" | "unknown">(completedDatePrecision ?? "unknown");
  const [experienceDate, setExperienceDate] = useState(occurredOn?.slice(0, 10) ?? "");
  const [experienceYear, setExperienceYear] = useState(completedYear ? String(completedYear) : "");
  const [coverUrl, setCoverUrl] = useState(personalCoverUrl ?? "");
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState(existingExperience?.body ?? "");
  const [keyTakeaway, setKeyTakeaway] = useState(
    existingExperience?.key_takeaway ?? ""
  );
  const [visibility, setVisibility] = useState<SeedVisibility>(
    existingExperience?.visibility ?? "everyone"
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
      const { error: stateError } = await supabase.rpc("save_my_seed_v17_state", {
        p_seed_id: seedId,
        p_relationship_status: "completed",
        p_experience_precision: datePrecision,
        p_experience_date: datePrecision === "exact" ? experienceDate || null : null,
        p_experience_year: datePrecision === "year" && experienceYear ? Number(experienceYear) : null,
        p_personal_cover_url: coverUrl.trim() || null,
        p_rating: rating,
      });
      if (stateError) throw stateError;
      const hasExperienceNote = body.trim().length > 0 || keyTakeaway.trim().length > 0 || attachments.some((item) => item.url.trim().length > 0);
      if (hasExperienceNote || existingExperience) {
        await saveSeedJournalEntry({
          seedId,
          entryId: existingExperience?.id ?? null,
          entryKind: "reflection",
          body,
          keyTakeaway,
          visibility,
          occurredOn: datePrecision === "exact" ? experienceDate || today() : today(),
          attachments,
        });
      }
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

  const hasContent = datePrecision !== "exact" || Boolean(experienceDate);

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
                DENEYİMİNİ DÜZENLE
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-950">
                “{seedTitle}” deneyimin
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Mobildeki gibi ne zaman yaptığını, puanını, görselini ve deneyim notunu güncelle.
              </p>
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <div>
                <p className="text-sm font-black text-gray-950">Ne zaman tamamladın?</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {([['exact','Tam tarih'],['year','Sadece yıl'],['unknown','Hatırlamıyorum']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setDatePrecision(value)} className={`rounded-2xl border p-4 text-sm font-black ${datePrecision === value ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-700'}`}>{label}</button>)}
                </div>
                {datePrecision === "exact" && <input type="date" value={experienceDate} onChange={(event) => setExperienceDate(event.target.value)} className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3" />}
                {datePrecision === "year" && <input type="number" min="1900" max="2100" value={experienceYear} onChange={(event) => setExperienceYear(event.target.value)} placeholder="Yıl" className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3" />}
              </div>

              <div>
                <p className="text-sm font-black text-gray-950">Puanın</p>
                <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">{Array.from({length:10},(_,index)=>index+1).map(value=><button key={value} type="button" onClick={()=>setRating(value)} className={`h-11 rounded-xl border text-sm font-black ${rating===value?'border-amber-500 bg-amber-50 text-amber-700':'border-gray-200 text-gray-600'}`}>{value}</button>)}</div>
              </div>

              <label className="block"><span className="text-sm font-black text-gray-950">Deneyim görseli</span><input type="url" value={coverUrl} onChange={(event)=>setCoverUrl(event.target.value)} placeholder="https://..." className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3" /></label>
              <label className="block">
                <span className="text-sm font-black text-gray-950">
                  Deneyim notun
                </span>
                <span className="mt-1 block text-sm leading-6 text-gray-500">
                  Ne yaşadığını ve bu konuyla ilgili düşünceni paylaş.
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
                  Sende ne kaldı?
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
                  Bu deneyimi kim görebilir?
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Herkes, arkadaşların veya yalnızca sen.
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
                  {message === "Add a note, takeaway or linked item before saving." ? "Deneyim notu eklemeden de tarih, puan ve görselini güncelleyebilirsin." : message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 p-5 md:px-8">
              <p className="max-w-lg text-xs leading-5 text-gray-500">
                Bu işlem mevcut deneyimini günceller; yeni bir kayıt oluşturmaz.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isSaving || !hasContent}
                  className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Kaydediliyor…" : "Deneyimi güncelle"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
