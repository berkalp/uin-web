"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Activity = {
  kind: "personal" | "social";
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  notes: string | null;
  is_past: boolean;
  plan_id?: string | null;
};

type Social = {
  intent_id: string;
  plan_id: string | null;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  location: string | null;
  owner_name: string | null;
  owner_avatar_url: string | null;
  participant_count: number | string;
};

function date(value: string | null) {
  if (!value) return "Tarih esnek";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`)
  );
}

function participantLabel(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? `${parsed} kişi`
    : "Katılımcı sayısı bilinmiyor";
}

export default function CommonIntentQuickDetails({ targetId, title }: { targetId: string; title: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [socials, setSocials] = useState<Social[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      setBusy(true);
      setError(false);
      try {
        const [activityResult, socialResult] = await Promise.all([
          supabase.rpc("get_common_target_activity_v39", { p_target_id: targetId }),
          supabase.rpc("get_common_target_social_intents_v38", { p_target_id: targetId }),
        ]);
        if (activityResult.error) throw activityResult.error;
        if (socialResult.error) throw socialResult.error;

        const now = new Date().toISOString().slice(0, 10);
        const socialRows = ((socialResult.data ?? []) as Social[]).filter((item) => item.end_date >= now);
        const planIds = Array.from(new Set(socialRows.map((item) => item.plan_id).filter((id): id is string => Boolean(id))));
        const presentationResult = planIds.length
          ? await supabase.rpc("get_visible_plan_presentations", { p_plan_ids: planIds })
          : { data: [], error: null };
        if (presentationResult.error) throw presentationResult.error;

        const titles = new Map(((presentationResult.data ?? []) as Array<{ plan_id: string; custom_title?: string | null }>).map((row) => [row.plan_id, row.custom_title?.trim() || null]));
        if (!active) return;
        setActivities(((activityResult.data ?? []) as Activity[]).filter((item) => !item.is_past));
        setSocials(socialRows.map((item) => ({ ...item, subtitle: (item.plan_id ? titles.get(item.plan_id) : null) || item.subtitle })));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [attempt, targetId]);

  if (busy) return <p className="py-5 text-sm text-gray-500">Kayıtlar yükleniyor…</p>;
  if (error) return <div role="alert" className="py-5 text-sm text-red-700">Ayrıntılar yüklenemedi. <button type="button" className="ml-2 font-black underline" onClick={() => setAttempt((value) => value + 1)}>Tekrar dene</button></div>;

  return <div className="space-y-6">
    <section>
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-[11px] font-black uppercase tracking-[.16em] text-emerald-700">Niyetler ve etkinlikler</p><h3 className="mt-1 text-lg font-black">Yaklaşanlar</h3></div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{activities.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {activities.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-2xl border border-gray-200 p-3">
          <div className="flex items-center gap-2">{item.avatar_url && <img src={item.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover"/>}<div><p className="text-sm font-black">{item.full_name || item.username || "UIN üyesi"}</p><p className="text-[11px] text-gray-500">{item.kind === "social" ? "Etkinlik" : "Kişisel niyet"}</p></div></div>
          <p className="mt-2 text-xs font-semibold">🎯 {date(item.start_date)}{item.end_date && item.end_date !== item.start_date ? ` → ${date(item.end_date)}` : ""}</p>
          {item.location && <p className="mt-1 text-xs text-gray-500">📍 {item.location}</p>}
          {item.kind === "social" && <Link href={`/activities/${encodeURIComponent(item.plan_id || item.id)}`} className="mt-2 inline-block text-xs font-black text-violet-700">Etkinliği aç →</Link>}
        </article>)}
        {!activities.length && <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">Yaklaşan görünür niyet yok.</p>}
      </div>
    </section>
    <section>
      <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-violet-700">Etkinlikler</p><h3 className="mt-1 text-lg font-black">Birlikte katılabileceğin etkinlikler</h3></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">{socials.length}</span></div>
      <div className="mt-3 space-y-2">{socials.map((item) => <Link key={item.intent_id} href={`/activities/${encodeURIComponent(item.plan_id || item.intent_id)}`} className="block rounded-2xl border border-violet-100 p-3 hover:bg-violet-50"><p className="font-black">{item.subtitle || title}</p><p className="mt-1 text-xs">🎯 {date(item.start_date)} → {date(item.end_date)}</p>{item.location && <p className="mt-1 text-xs text-gray-500">📍 {item.location}</p>}<p className="mt-2 text-xs font-bold text-violet-700">{item.owner_name || "UIN üyesi"} · {participantLabel(item.participant_count)}</p></Link>)}{!socials.length && <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">Yaklaşan görünür etkinlik yok.</p>}</div>
    </section>
    <Link href={`/intentions/${encodeURIComponent(targetId)}`} className="block rounded-xl bg-gray-950 px-4 py-3 text-center text-sm font-black text-white">Fikrin tüm detaylarını aç</Link>
  </div>;
}
