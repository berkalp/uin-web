"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EventCardPicker, { type EventTopic } from "@/components/ideas/EventCardPicker";
import { supabase } from "@/utils/supabase/client";
import { buildEventTitle, type EventPresentation } from "@/utils/eventPresentation";

type Activity = { id: string; name: string; intent_label: string | null; event_label: string | null };

export default function EventActivityDnaEditor({ resourceId, presentation }: { resourceId: string; presentation: EventPresentation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityId, setActivityId] = useState(presentation.activityId);
  const [main, setMain] = useState<EventTopic | null>(() => {
    const card = presentation.mainTarget ?? presentation.primaryDna;
    return card ? { id: card.targetId, title: card.title, coverUrl: card.coverUrl } : null;
  });
  const initialRelated = useMemo(() => presentation.dnaCards.filter(card => !card.isPrimary).map(card => ({ id: card.targetId, title: card.title, coverUrl: card.coverUrl })), [presentation.dnaCards]);
  const [related, setRelated] = useState(initialRelated.map(card => card.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || activities.length) return;
    void supabase.from("activities").select("id,name,intent_label,event_label").order("event_label").then(({ data, error }) => {
      if (error) setMessage("Aktivite kataloğu yüklenemedi.");
      else setActivities((data ?? []) as Activity[]);
    });
  }, [open, activities.length]);

  const selected = activities.find(item => item.id === activityId);
  const previewDnaTitle = main && (presentation.primaryDna || main.id !== presentation.mainTarget?.targetId) ? main.title : null;
  const preview = buildEventTitle({ activityName: selected?.name ?? presentation.eventLabel, eventLabel: selected?.event_label ?? presentation.eventLabel, primaryDnaTitle: previewDnaTitle });

  async function save() {
    if (!activityId || !main) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.rpc("update_my_event_activity_dna_v86", {
      p_resource_id: resourceId,
      p_activity_id: activityId,
      p_primary_target_id: main.id,
      p_related_target_ids: related.filter(id => id !== main.id),
    });
    setSaving(false);
    if (error) { setMessage(error.message || "Değişiklikler kaydedilemedi."); return; }
    setOpen(false); router.refresh();
  }

  return <>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <h1 className="min-w-0 text-3xl font-bold leading-tight text-white drop-shadow md:text-4xl">{presentation.displayTitle}</h1>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-xl border border-white/30 bg-white/90 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur hover:bg-white">Aktivite ve DNA’yı düzenle</button>
    </div>
    {presentation.dnaCards.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Etkinlik DNA kartları">
      {presentation.dnaCards.slice(0, 3).map(card => <span key={card.targetId} className="rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-bold text-white backdrop-blur">⌁ {card.title}</span>)}
      {presentation.dnaCards.length > 3 && <details className="relative"><summary className="cursor-pointer rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-bold text-white">+{presentation.dnaCards.length - 3}</summary><div className="absolute left-0 z-40 mt-2 min-w-56 rounded-2xl bg-white p-3 text-slate-900 shadow-xl">{presentation.dnaCards.slice(3).map(card => <p key={card.targetId} className="py-1 text-sm font-semibold">{card.title}</p>)}</div></details>}
    </div>}
    {open && <div className="fixed inset-0 z-[180] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Aktivite ve DNA’yı düzenle">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">ETKİNLİK BAĞLAMI</p><h2 className="mt-1 text-2xl font-black">Aktivite ve DNA’yı düzenle</h2><p className="mt-2 text-sm text-slate-600">Başlık seçtiğin aktivite ve ana DNA kartından otomatik oluşur.</p></div><button type="button" onClick={() => setOpen(false)} className="h-10 w-10 rounded-full bg-slate-100 text-xl font-black">×</button></div>
        <label className="mt-6 block text-sm font-black">Aktivite<select value={activityId} onChange={event => setActivityId(event.target.value)} className="mt-2 w-full rounded-xl border bg-white p-3">{activities.length === 0 && <option value={activityId}>{presentation.intentLabel}</option>}{activities.map(item => <option key={item.id} value={item.id}>{item.intent_label || item.name}</option>)}</select></label>
        <div className="mt-5"><EventCardPicker value={main} onChange={card => { setMain(card); setRelated(ids => ids.filter(id => id !== card?.id)); }} /></div>
        <div className="mt-5"><EventCardPicker related value={null} onChange={() => undefined} mainTargetId={main?.id} selectedIds={related} initialSelectedCards={initialRelated} onRelatedChange={setRelated} /></div>
        <div className="mt-5 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Başlık önizlemesi</p><p className="mt-1 text-lg font-black">{preview}</p></div>
        {message && <p role="status" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-5 py-3 font-black">Vazgeç</button><button type="button" disabled={saving || !main || !activityId} onClick={() => void save()} className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-40">{saving ? "Kaydediliyor…" : "Kaydet"}</button></div>
      </section>
    </div>}
  </>;
}
