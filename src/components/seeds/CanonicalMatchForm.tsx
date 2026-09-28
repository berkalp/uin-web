"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function CanonicalMatchForm({ seedId }: { seedId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("save_my_canonical_match_v31", {
        p_seed_id: seedId, p_match_name: String(values.get("match")),
        p_match_date: String(values.get("date")), p_venue: String(values.get("venue") || ""),
      });
      if (error) setMessage("Maç eklenemedi. Kaydın tamamlanmış bir deneyim olmalı.");
      else { setMessage("Maç deneyimine eklendi."); form.reset(); router.refresh(); }
    } catch { setMessage("Bağlantı kurulamadı. Tekrar deneyebilirsin."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="mx-auto my-6 max-w-3xl space-y-3 rounded-3xl border border-gray-200 bg-white p-5">
    <h2 className="font-black">İzlediğin maçı deneyimine ekle</h2>
    <p className="text-sm text-gray-500">Tamamladığın deneyime maçın tarihini ve stadyumunu ekleyebilirsin.</p>
    <label className="block text-sm">Maç<input name="match" required minLength={2} maxLength={240} placeholder="Beşiktaş JK – Fenerbahçe" className="mt-1 block w-full rounded-xl border p-2" /></label>
    <label className="block text-sm">Maç tarihi<input name="date" type="date" required className="mt-1 block w-full rounded-xl border p-2" /></label>
    <label className="block text-sm">Stadyum / Salon<input name="venue" maxLength={240} className="mt-1 block w-full rounded-xl border p-2" /></label>
    <button disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">{busy ? "Kaydediliyor…" : "Maçı ekle"}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
