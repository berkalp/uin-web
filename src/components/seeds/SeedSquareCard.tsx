"use client";
import UinCard from "@/components/cards/UinCard";
import TargetHighlight from "@/components/cards/TargetHighlight";
import CanonicalTargetPeople from "@/components/seeds/CanonicalTargetPeople";
import { targetLanguage, cardDate } from "@/utils/targetLanguage";
import type { PublicSeedRecord } from "@/utils/seeds";

export default function SeedSquareCard({ seed }: { seed: PublicSeedRecord; isAuthenticated: boolean; isOwner: boolean }) {
  const words = targetLanguage(seed.seed_type_slug);
  const done = seed.status === "completed";
  const href = seed.canonical_target_id ? `/ideas?targetId=${encodeURIComponent(seed.canonical_target_id)}` : `/seeds/${seed.seed_id}`;
  return <UinCard title={seed.title} subtitle={seed.subtitle} coverUrl={seed.cover_url} href={href}
    category={words.action} icon={words.icon} badge={done ? "DENEYİM" : "ORTAK HEDEF"} tone={done ? "experience" : "target"}
    secondary={<TargetHighlight seedId={seed.seed_id} />}>
    {done && <p className="mb-2 text-xs">✓ {seed.completed_date_precision === "year" ? seed.completed_year : seed.completed_date_precision === "unknown" ? "Tarih belirtilmedi" : cardDate(seed.completed_at) || "Tarih belirtilmedi"}</p>}
    {seed.key_takeaway && <p className="mb-2 line-clamp-2 text-sm">“{seed.key_takeaway}”</p>}
    <CanonicalTargetPeople seedId={seed.seed_id} seedType={seed.seed_type_slug} />
  </UinCard>;
}
