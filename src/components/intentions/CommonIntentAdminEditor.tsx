"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Props = {
  targetId: string;
  initialTitle: string;
  initialCreator: string;
  initialCover: string;
  initialDescription: string;
  initialReferenceUrl: string;
  initialActionKey: string;
  initialSubjectType: string;
  initialDisplayIcon: string;
  compact?: boolean;
};

const ACTIONS = [
  ["sport-do","Spor Yap"],["sport-live","Sporu Yerinde İzle"],["live-performance","Canlı Sahne İzle"],
  ["concert","Konsere Git"],["read","Oku"],["watch","İzle"],["listen","Dinle"],["visit","Git"],
  ["place-visit","Ziyaret Et"],["try","Dene"],["learn","Öğren"],["play","Oyna"],["practice","Pratik Yap"],["create","Üret"],["do","Yap"],
] as const;

export default function CommonIntentAdminEditor(props: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initialTitle);
  const [creator, setCreator] = useState(props.initialCreator);
  const [cover, setCover] = useState(props.initialCover);
  const [description, setDescription] = useState(props.initialDescription);
  const [referenceUrl, setReferenceUrl] = useState(props.initialReferenceUrl);
  const [actionKey, setActionKey] = useState(ACTIONS.some(([value])=>value===props.initialActionKey) ? props.initialActionKey : "do");
  const [subjectType, setSubjectType] = useState(props.initialSubjectType);
  const [displayIcon, setDisplayIcon] = useState(props.initialDisplayIcon);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!title.trim()) return setMessage("Başlık boş bırakılamaz.");
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("admin_update_common_target_v41", {
      p_target_id: props.targetId,
      p_title: title.trim(),
      p_creator_name: creator.trim() || null,
      p_cover_url: cover.trim() || null,
      p_description: description.trim() || null,
      p_reference_url: referenceUrl.trim() || null,
    });
    if (error) setMessage(error.message || "Değişiklikler kaydedilemedi.");
    else {
      const { error: classificationError } = await supabase.rpc("admin_update_common_target_classification_v46", {
        p_target_id: props.targetId, p_action_key: actionKey, p_subject_type: subjectType.trim() || null, p_display_icon: displayIcon.trim() || null,
      });
      if (classificationError) setMessage(classificationError.message || "Sınıflandırma kaydedilemedi.");
      else { setMessage("Kaydedildi."); router.refresh(); }
    }
    setBusy(false);
  }

  return <details className={props.compact?"group relative ml-auto w-fit":"rounded-2xl border border-amber-300 bg-amber-50 shadow-sm"}>
    <summary className={props.compact?"cursor-pointer list-none rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-black text-amber-950 shadow-sm":"cursor-pointer list-none px-4 py-3 text-sm font-black text-amber-950"}>{props.compact?"✎ Düzenle":"✎ Bu konuyu ve sınıflandırmasını burada düzenle"}</summary>
    <div className={props.compact?"absolute right-0 z-40 mt-2 grid w-[min(680px,calc(100vw-2rem))] gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-2xl md:grid-cols-2":"grid gap-4 border-t border-amber-200 p-4 md:grid-cols-2"}>
      <label className="text-xs font-bold text-gray-700">Başlık<input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-bold text-gray-700">Yazar / sanatçı / üretici<input value={creator} onChange={event => setCreator(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-bold text-gray-700">Eylem<select value={actionKey} onChange={event=>setActionKey(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">{ACTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs font-bold text-gray-700">Tür<input value={subjectType} onChange={event=>setSubjectType(event.target.value)} placeholder="Futbol, Kitap, Festival, Gezi…" maxLength={80} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-bold text-gray-700">İkon<input value={displayIcon} onChange={event=>setDisplayIcon(event.target.value)} placeholder="🏃" maxLength={12} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-bold text-gray-700 md:col-span-2">Kapak görseli adresi<input type="url" value={cover} onChange={event => setCover(event.target.value)} placeholder="https://…" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-bold text-gray-700 md:col-span-2">Genel açıklama<textarea value={description} onChange={event => setDescription(event.target.value)} rows={5} maxLength={4000} className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <label className="text-xs font-bold text-gray-700 md:col-span-2">Kaynak / resmi sayfa<input type="url" value={referenceUrl} onChange={event => setReferenceUrl(event.target.value)} placeholder="https://…" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
      <div className="flex items-center gap-3 md:col-span-2"><button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button>{message && <p role="status" className="text-sm font-semibold text-gray-600">{message}</p>}</div>
    </div>
  </details>;
}
