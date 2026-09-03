"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

type Collaboration = { can_suggest?: boolean; viewer_status?: string | null };

export default function SeedPublicActions({ seedId, title, catalogItemId, ownSeedId }: { seedId: string; title: string; catalogItemId: string | null; ownSeedId?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(ownSeedId ?? null);
  const [collaboration, setCollaboration] = useState<Collaboration | null>(null);

  useEffect(() => {
    void supabase.rpc("get_personal_intent_collaboration_v2918", { p_seed_id: seedId }).then(({ data }) => {
      if (data && typeof data === "object") setCollaboration(data as Collaboration);
    });
  }, [seedId]);

  async function addIntent(open = false) {
    if (mine) { if (open) router.push(`/seeds/${encodeURIComponent(mine)}`); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("add_discovered_seed_to_my_life_v25", { p_source_seed_id: seedId });
    const row = (Array.isArray(data) ? data[0] : data) as { seed_id?: string } | null;
    if (!error && row?.seed_id) { setMine(row.seed_id); if (open) router.push(`/seeds/${encodeURIComponent(row.seed_id)}`); }
    setBusy(false);
  }

  async function suggestTogether() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_personal_intent_collaboration_suggestion_v2918", { p_seed_id: seedId });
    if (!error) setCollaboration({ can_suggest: false, viewer_status: "pending" });
    setBusy(false);
  }

  const explore = (mode: "experience" | "favorite") => `/seeds/explore?mode=${mode}&q=${encodeURIComponent(title)}`;

  return <div className="mt-4 space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={busy} onClick={() => void addIntent(true)} className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-60">{mine ? "✓ Niyetlerinde · Aç" : "🌿 Niyetlerime ekle"}</button>
      {collaboration?.viewer_status === "pending" ? <span className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800">⏳ Davetin bekliyor</span> : collaboration?.can_suggest ? <button type="button" disabled={busy} onClick={() => void suggestTogether()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">✉ Birlikte yapmayı öner · Davet gönder</button> : <span className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs font-bold text-gray-500">Birlikte yapma önerilerine kapalı</span>}
    </div>
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-black text-gray-950">Bu konu sende nasıl yer alsın?</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Link href={explore("experience")} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-green-400">✓ Deneyime ekle</Link>
        {catalogItemId ? <Link href={explore("favorite")} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-rose-300">♡ Sevdiklerime ekle</Link> : <span className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-3 text-center text-xs font-bold text-gray-400">Katalog dışı kayıt</span>}
        <button type="button" disabled={busy} onClick={() => void addIntent(true)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-xs font-black text-gray-800 hover:border-green-400">🌿 Kişisel niyet</button>
        <Link href={`/onboarding?seed=${encodeURIComponent(seedId)}`} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center text-xs font-black text-gray-800 hover:border-violet-400">♧ Sosyal niyet</Link>
      </div>
    </section>
  </div>;
}
