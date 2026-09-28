"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { cardPrimary, cardSecondary } from "@/components/cards/UinCard";

type Context = { is_owner: boolean; mode: string; pending: { id: string; full_name?: string; username?: string; created_at: string }[] };
export default function SeedCollaborationSettings({ seedId }: { seedId: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const { data, error } = await supabase.rpc("get_personal_intent_collaboration_v2918", { p_seed_id: seedId });
    if (error) setError("Birlikte yapma ayarları yüklenemedi.");
    else setContext(data as Context);
  }
  useEffect(() => { void refresh(); }, [seedId]);
  async function change(mode: string) {
    setBusy(true); setError("");
    try {
      const result = await supabase.rpc("set_my_personal_intent_collaboration_v2918", { p_seed_id: seedId, p_mode: mode });
      if (result.error) setError(result.error.message); else await refresh();
    } catch { setError("Ayar kaydedilemedi."); } finally { setBusy(false); }
  }
  async function respond(id: string, response: "accepted" | "rejected") {
    setBusy(true); setError("");
    try {
      const result = await supabase.rpc("respond_personal_intent_collaboration_suggestion_v34", { p_suggestion_id: id, p_response: response });
      if (result.error) setError(result.error.message);
      else { await refresh(); if (response === "accepted" && result.data?.chat_id) window.location.href = `/collaboration-chat/${result.data.chat_id}`; }
    } catch { setError("Yanıt gönderilemedi."); } finally { setBusy(false); }
  }
  if (!context?.is_owner && !error) return null;
  return <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
    <h2 className="text-lg font-bold">Birlikte yapalım</h2>
    {context?.is_owner && <>
      <fieldset disabled={busy} className="mt-4"><legend className="text-sm font-bold">Kimler davet gönderebilir?</legend><div className="mt-2 flex flex-wrap gap-2">{([['off','Kapalı'],['friends','Arkadaşlarım'],['everyone','Herkes']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>void change(value)} className={`rounded-full border px-4 py-2 text-sm font-bold ${context.mode===value?'border-emerald-600 bg-emerald-50 text-emerald-800':'border-gray-200 bg-white text-gray-600'}`}>{label}</button>)}</div></fieldset>
      <p className="mt-2 text-xs text-gray-500">Kabul edildiğinde önce 20 mesajlık özel tanışma sohbeti açılır. İkiniz de onaylamadan planlama başlamaz.</p>
      {(context.pending ?? []).map(person => <div key={person.id} className="mt-4 rounded-xl bg-gray-50 p-3">
        <p className="text-sm font-semibold">{person.full_name || person.username || "UIN üyesi"}</p>
        <p className="mt-1 text-xs text-gray-500">{new Date(person.created_at).toLocaleDateString("tr-TR")} · Birlikte yapmak istiyor</p>
        <div className="mt-3 flex gap-2"><button className={cardPrimary} disabled={busy} onClick={() => void respond(person.id, "accepted")}>Kabul et</button><button className={cardSecondary} disabled={busy} onClick={() => void respond(person.id, "rejected")}>Reddet</button></div>
      </div>)}
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
