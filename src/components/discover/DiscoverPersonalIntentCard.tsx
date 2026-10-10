"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UinCard, { cardPrimary } from "@/components/cards/UinCard";
import TargetHighlight from "@/components/cards/TargetHighlight";
import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import CommonIntentQuickDetails from "@/components/intentions/CommonIntentQuickDetails";
import { initialCommunityCountProps } from "@/utils/communityCounts";
import { topicPresentation } from "@/utils/topicPresentation";
import { supabase } from "@/utils/supabase/client";

export type DiscoverPersonalIntent = {
  canonical_target_id: string; source_seed_id: string | null;
  seed_type_icon: string | null; seed_type_name: string | null; seed_type_slug: string | null;
  title: string; subtitle: string | null; cover_url: string | null; catalog_cover_url: string | null;
  own_seed_id: string | null; own_common_intent_id?: string | null;
  intent_people_count: number | string | null; experience_people_count: number | string | null;
  social_intent_count?: number | string | null;
  item_kind?: string | null; primary_category_id?: string | null; sport_name?: string | null; subject_type?: string | null;
};

export default function DiscoverPersonalIntentCard({ item }: { item: DiscoverPersonalIntent }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ownId, setOwnId] = useState(item.own_seed_id || item.own_common_intent_id || null);
  const words = topicPresentation(item);
  const communityCountProps = initialCommunityCountProps(
    item.intent_people_count,
    item.experience_people_count,
    item.social_intent_count
  );
  async function add() {
    if (ownId) return;
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.rpc("add_common_target_to_my_intents_v38", { p_target_id: item.canonical_target_id });
      const row = data as { id?: string } | null;
      if (error || !row?.id) setError(error?.code === "42501" ? "Eklemek için giriş yapmalısın." : "Eklenemedi. Tekrar deneyebilirsin.");
      else { setOwnId(row.id); router.refresh(); }
    } catch { setError("Bağlantı kurulamadı."); } finally { setBusy(false); }
  }
  return <UinCard title={item.title} subtitle={item.subtitle} category={words.action} icon={words.icon} badge={words.badge}
    coverUrl={item.catalog_cover_url || item.cover_url} href={`/intentions/${item.canonical_target_id}`}
    primary={<button type="button" disabled={busy || Boolean(ownId)} onClick={() => void add()} className={ownId ? "flex min-h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-500" : cardPrimary}>{busy ? "Ekleniyor…" : ownId ? "✓ Ekli" : "+ Ekle"}</button>}
    secondary={item.source_seed_id ? <TargetHighlight seedId={item.source_seed_id} /> : null}
    detailContent={<CommonIntentQuickDetails targetId={item.canonical_target_id} title={item.title} />}>
    <CanonicalTargetPeople targetId={item.canonical_target_id} seedId={item.source_seed_id} seedType={item.seed_type_slug} {...communityCountProps} socialHref={`/intentions/${item.canonical_target_id}#social-intents`} />
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </UinCard>;
}
