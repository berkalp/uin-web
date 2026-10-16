"use client";

import {supabase} from '@/utils/supabase/client';
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import ExperiencePhotoPicker from './ExperiencePhotoPicker';
import {useExperiencePhotos} from '@/utils/useExperiencePhotos';
import SeedLinkedItemsEditor from "@/components/seeds/SeedLinkedItemsEditor";
import { completeSeed } from "@/services/seedService";
import {
  SEED_VISIBILITY_OPTIONS,
  type SeedCompletionPrecision,
  type SeedJournalAttachment,
  type SeedVisibility,
} from "@/utils/seeds";

type SeedCompletionDialogProps = {
  seedId: string;
  seedTitle: string;
  defaultVisibility: SeedVisibility;
  buttonClassName?: string;
  buttonLabel?: string;
  initialCompletedOn?: string | null;
  initialCompletedDatePrecision?: SeedCompletionPrecision | null;
  initialCompletedYear?: number | null;
  initialReflection?: string | null;
  initialKeyTakeaway?: string | null;
  initialAttachments?: SeedJournalAttachment[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SeedCompletionDialog({
  seedId,
  seedTitle,
  defaultVisibility,
  buttonClassName = "rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-100",
  buttonLabel = "Mark done",
  initialCompletedOn = null,
  initialCompletedDatePrecision = "exact",
  initialCompletedYear = null,
  initialReflection = null,
  initialKeyTakeaway = null,
  initialAttachments = [],
}: SeedCompletionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [completedDatePrecision, setCompletedDatePrecision] =
    useState<SeedCompletionPrecision>(
      initialCompletedDatePrecision ?? "exact"
    );
  const [completedOn, setCompletedOn] = useState(
    initialCompletedOn?.slice(0, 10) || today()
  );
  const [completedYear, setCompletedYear] = useState(
    initialCompletedYear ? String(initialCompletedYear) : String(new Date().getFullYear())
  );
  const [reflection, setReflection] = useState(initialReflection ?? "");
  const [keyTakeaway, setKeyTakeaway] = useState(
    initialKeyTakeaway ?? ""
  );
  const [visibility, setVisibility] =
    useState<SeedVisibility>("everyone");
  const [attachments, setAttachments] = useState<
    SeedJournalAttachment[]
  >(initialAttachments);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const experiencePhotos=useExperiencePhotos(supabase,seedId,open);
  const saveLock=useRef(false);
  async function submit() {
    if(saveLock.current||!experiencePhotos.ready)return;
    saveLock.current=true;
    setIsSaving(true);
    setMessage(null);

    try {
      await completeSeed({
        seedId,
        completedOn,
        completedDatePrecision,
        completedYear,
        reflection,
        keyTakeaway,
        visibility,
        attachments,
      });
      await experiencePhotos.save(seedId,visibility);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Deneyim kaydedilemedi."
      );
      setIsSaving(false);
    } finally {saveLock.current=false;setIsSaving(false);}
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
                Deneyim ekle
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-950">
                “{seedTitle}” deneyimin
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Deneyimin profilinde görünür. Notunu ve fotoğraflarını şimdi ekleyebilir veya daha sonra düzenleyebilirsin.
              </p>
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Ne zaman tamamladın?
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ["exact", "Tam tarih", "Tarihi hatırlıyorum."],
                    ["year", "Sadece yıl", "Yalnızca yılı hatırlıyorum."],
                    ["unknown", "Hatırlamıyorum", "Tarih belirtmek istemiyorum."],
                  ].map(([value, label, description]) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-2xl border p-4 ${
                        completedDatePrecision === value
                          ? "border-purple-400 bg-purple-50"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`seed-completed-precision-${seedId}`}
                        checked={completedDatePrecision === value}
                        onChange={() =>
                          setCompletedDatePrecision(
                            value as SeedCompletionPrecision
                          )
                        }
                        className="sr-only"
                      />
                      <span className="block text-sm font-bold text-gray-950">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">
                        {description}
                      </span>
                    </label>
                  ))}
                </div>

                {completedDatePrecision === "exact" && (
                  <input
                    type="date"
                    value={completedOn}
                    max={today()}
                    onChange={(event) => setCompletedOn(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
                  />
                )}

                {completedDatePrecision === "year" && (
                  <input
                    type="number"
                    min={1}
                    max={new Date().getFullYear()}
                    value={completedYear}
                    onChange={(event) => setCompletedYear(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
                  />
                )}
              </div>

              <label className="block">
                <span className="text-sm font-bold text-gray-900">
                  Deneyim notun (isteğe bağlı)
                </span>
                <textarea
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  maxLength={6000}
                  rows={6}
                  placeholder="Düşüncen, deneyimin, aklında kalanlar…"
                  className="mt-2 w-full resize-y rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
                />
                <span className="mt-1 block text-xs text-gray-400">
                  {reflection.length}/6000
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-900">
                  Sende ne kaldı? (isteğe bağlı)
                </span>
                <textarea
                  value={keyTakeaway}
                  onChange={(event) => setKeyTakeaway(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Bu deneyimden aklında kalan kısa bir not."
                  className="mt-2 w-full resize-y rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-purple-500"
                />
              </label>

              <ExperiencePhotoPicker photos={experiencePhotos.photos} onChange={experiencePhotos.setPhotos} disabled={isSaving||!experiencePhotos.ready}/>{experiencePhotos.error?<button type="button" onClick={experiencePhotos.reload} className="min-h-11 text-red-700">{experiencePhotos.error} Yeniden dene</button>:!experiencePhotos.ready?<p>Fotoğraflar yükleniyor…</p>:null}
              <SeedLinkedItemsEditor
                items={attachments}
                onChange={setAttachments}
              />

              <div>
                <p className="text-sm font-bold text-gray-900">
                  Bu deneyimi kim görebilir?
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {SEED_VISIBILITY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-2xl border p-4 ${
                        visibility === option.value
                          ? "border-purple-400 bg-purple-50"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`seed-reflection-visibility-${seedId}`}
                        checked={visibility === option.value}
                        onChange={() => setVisibility(option.value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-bold text-gray-950">
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

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 bg-gray-50 p-5 md:px-8">
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
                disabled={
                  isSaving || !experiencePhotos.ready ||
                  (completedDatePrecision === "exact" && !completedOn) ||
                  (completedDatePrecision === "year" && !completedYear)
                }
                className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving ? "Kaydediliyor…" : "Deneyimi ekle"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
