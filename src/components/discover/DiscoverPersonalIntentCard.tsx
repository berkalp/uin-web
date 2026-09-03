"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type DiscoverPersonalIntent = {
  source_seed_id: string;
  owner_username: string | null;
  owner_full_name: string | null;
  owner_avatar_url: string | null;
  seed_type_icon: string | null;
  seed_type_name: string | null;
  seed_type_slug: string | null;
  title: string;
  subtitle: string | null;
  personal_cover_url: string | null;
  cover_url: string | null;
  catalog_cover_url: string | null;
  target_date: string | null;
  own_seed_id: string | null;
  intent_people_count: number | string | null;
  experience_people_count: number | string | null;
  like_count: number | string | null;
  viewer_liked: boolean | null;
  viewer_can_like: boolean | null;
};

function count(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function DiscoverPersonalIntentCard({ item }: { item: DiscoverPersonalIntent }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(item.viewer_liked === true);
  const [likeCount, setLikeCount] = useState(count(item.like_count));
  const [ownSeedId, setOwnSeedId] = useState(item.own_seed_id);
  const cover = item.personal_cover_url || item.cover_url || item.catalog_cover_url;
  const ownerName = item.owner_full_name || (item.owner_username ? `@${item.owner_username}` : "UIN üyesi");

  async function toggleLike() {
    if (busy || item.viewer_can_like === false) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("set_my_personal_intent_like_v28", { p_seed_id: item.source_seed_id, p_active: !liked });
    if (!error) {
      const row = (Array.isArray(data) ? data[0] : data) as { like_count?: number; viewer_liked?: boolean } | null;
      if (row) { setLikeCount(count(row.like_count ?? 0)); setLiked(row.viewer_liked === true); }
    }
    setBusy(false);
  }

  async function addToIntents() {
    if (ownSeedId) { router.push(`/seeds/${encodeURIComponent(ownSeedId)}`); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("add_discovered_seed_to_my_life_v25", { p_source_seed_id: item.source_seed_id });
    const row = (Array.isArray(data) ? data[0] : data) as { seed_id?: string } | null;
    if (!error && row?.seed_id) setOwnSeedId(row.seed_id);
    setBusy(false);
  }

  return <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
    <Link href={`/seeds/${encodeURIComponent(item.source_seed_id)}`} className="block">
      <div className="relative h-[190px] overflow-hidden bg-slate-950">
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl">{item.seed_type_icon || "🌱"}</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />
        <div className="absolute left-3 top-3 flex gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-800">♙ KİŞİSEL NİYET</span><span className="rounded-full bg-emerald-50/95 px-2.5 py-1 text-[9px] font-bold text-emerald-800">◉ Herkese Açık</span></div>
        <div className="absolute inset-x-4 bottom-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-green-300">{item.seed_type_icon || "🌱"} {item.seed_type_name || "Kişisel Niyet"}</p><h2 className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white">{item.title}</h2></div>
      </div>
      <div className="space-y-2 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-black text-gray-950">🌿 Yapmak istiyor</p>
        {item.target_date && <p className="text-xs font-semibold text-gray-500">⚑ {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${item.target_date}T00:00:00`))}</p>}
        <div className="flex gap-4 text-[11px] font-bold text-gray-500"><span>⚑ İsteyenler {count(item.intent_people_count)}</span><span>✓ Deneyimleyenler {count(item.experience_people_count)}</span></div>
      </div>
    </Link>
    <div className="flex min-h-16 items-center gap-2 px-4 py-2.5">
      <Link href={item.owner_username ? `/u/${encodeURIComponent(item.owner_username)}` : "#"} className="flex min-w-0 flex-1 items-center gap-2">
        {item.owner_avatar_url ? <img src={item.owner_avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100">👤</span>}
        <span className="min-w-0"><b className="block truncate text-xs text-gray-950">{ownerName}</b>{item.owner_username && <small className="block truncate text-[9px] text-gray-400">@{item.owner_username}</small>}</span>
      </Link>
      <button type="button" disabled={busy || item.viewer_can_like === false} onClick={() => void toggleLike()} className={`h-9 rounded-xl px-3 text-xs font-black ${liked ? "bg-violet-50 text-violet-700" : "bg-gray-50 text-gray-500"}`}>✨ {likeCount}</button>
      <button type="button" disabled={busy} onClick={() => void addToIntents()} className={`h-9 rounded-xl px-3 text-[10px] font-black ${ownSeedId ? "border border-green-200 bg-green-50 text-green-700" : "bg-green-600 text-white"}`}>{ownSeedId ? "✓ Niyetlerinde" : "+ Niyetlerime ekle"}</button>
    </div>
  </article>;
}
