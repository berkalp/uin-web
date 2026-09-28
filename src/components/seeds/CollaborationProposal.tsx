"use client";
import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { cardSecondary, cardPrimary } from "@/components/cards/UinCard";

export default function CollaborationProposal({ seedId, name }: { seedId: string; name: string }) {
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  async function prepare() {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc("get_personal_intent_collaboration_v2918", { p_seed_id: seedId });
      if (error) setMessage("Öneri seçenekleri açılamadı. Giriş yaptığından emin ol.");
      else if (data?.is_owner) setMessage("Bu senin niyetin.");
      else if (data?.viewer_status) setMessage(data.viewer_status === "pending" ? "Önerin yanıt bekliyor." : "Bu niyet için daha önce öneri gönderdin.");
      else if (!data?.can_suggest) setMessage("Kişi önerileri kapatmış olabilir. Mevcut ayarda öneriler yalnızca izin veren arkadaşlara gönderilebilir.");
      else setReview(true);
    } catch { setMessage("Bağlantı kurulamadı."); } finally { setBusy(false); }
  }
  async function send() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_personal_intent_collaboration_suggestion_v2918", { p_seed_id: seedId });
      if (error) setMessage(error.message);
      else { setSent(true); setReview(false); setMessage("Önerin gönderildi."); }
    } catch { setMessage("Öneri gönderilemedi."); } finally { setBusy(false); }
  }
  return <div className="mt-3">
    {!review ? <button type="button" disabled={busy || sent} onClick={() => void prepare()} className={`${cardSecondary} !border-emerald-200 !text-emerald-700`}>{sent ? "✓ Öneri gönderildi" : busy ? "Yükleniyor…" : "Birlikte yapmayı öner"}</button>
      : <div className="space-y-2 rounded-xl bg-emerald-50 p-3">
        <p className="text-xs text-gray-700">{name} kişisine bu niyeti birlikte gerçekleştirmeyi önereceksin.</p>
        <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void send()} className={cardPrimary}>{busy ? "Gönderiliyor…" : "Öneriyi gönder"}</button><button type="button" disabled={busy} onClick={() => setReview(false)} className={cardSecondary}>Vazgeç</button></div>
      </div>}
    {message && <p role="status" className="mt-2 text-xs text-gray-600">{message}</p>}
  </div>;
}
