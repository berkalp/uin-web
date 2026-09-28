import Link from "next/link";
import UinCard, { cardPrimary, cardSecondary } from "@/components/cards/UinCard";
import { topicPresentation } from "@/utils/topicPresentation";

import { addFavoriteFromCatalogue, connectPrivateSeedToCatalogue, plantSeedFromCatalogue } from "@/app/seeds/explore/actions";

export type SeedSubjectSearchRow = {
  catalog_item_id: string;
  seed_type_id: string;
  seed_type_name: string;
  seed_type_slug: string;
  seed_type_icon: string;
  item_kind: string;
  canonical_title: string;
  original_title: string | null;
  creator_name: string | null;
  release_year: number | null;
  cover_url: string | null;
  metadata: Record<string, unknown> | null;
  planted_count: number | string;
  active_count: number | string;
  completed_count: number | string;
  experience_count: number | string;
  viewer_has_active_seed: boolean;
  viewer_seed_id: string | null;
  catalogue_status: "active" | "pending" | string;
  search_score: number | string;
};

type SeedSubjectCardProps = {
  subject: SeedSubjectSearchRow;
  returnTo: string;
  sourceSeedId?: string | null;
  mode?: "intent" | "experience" | "favorite";
};

export default function SeedSubjectCard({ subject, returnTo, sourceSeedId = null, mode = "intent" }: SeedSubjectCardProps) {
  const href = `/seeds/subjects/${encodeURIComponent(subject.catalog_item_id)}`;
  const words = topicPresentation(subject);
  const fields = <><input type="hidden" name="catalog_item_id" value={subject.catalog_item_id} /><input type="hidden" name="return_to" value={returnTo} /></>;
  return <UinCard title={subject.canonical_title}
    subtitle={[subject.creator_name, subject.release_year].filter(Boolean).join(" · ")}
    category={words.action} icon={subject.seed_type_icon || words.icon} coverUrl={subject.cover_url} href={href}
    badge={subject.catalogue_status === "pending" ? "İNCELEME BEKLİYOR" : words.badge}
    primary={mode === "favorite" ? <form action={addFavoriteFromCatalogue}>{fields}<button type="submit" className={cardPrimary}>Deneyim + Sevdiklerim</button></form>
      : mode === "experience" ? <Link href={`${href}/past`} className={cardPrimary}>Deneyimimi ekle</Link>
      : sourceSeedId ? <form action={connectPrivateSeedToCatalogue}>{fields}<input type="hidden" name="source_seed_id" value={sourceSeedId} /><button type="submit" className={cardPrimary}>Niyetimi bu hedefe bağla</button></form>
      : subject.viewer_has_active_seed && subject.viewer_seed_id ? <Link href={`/seeds/${encodeURIComponent(subject.viewer_seed_id)}`} className={cardPrimary}>✓ Ekli</Link>
      : <form action={plantSeedFromCatalogue}>{fields}<button type="submit" className={cardPrimary}>+ Ekle</button></form>}
    secondary={mode === "favorite" ? null
      : mode === "intent" ? <Link href={`${href}/past`} className={cardSecondary}>Deneyimimi ekle</Link> : null}>
    <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">Bu hedefi niyetlerine veya deneyimlerine ekleyebilirsin.</p>
    {subject.catalogue_status === "pending" && <p className="mt-3 text-xs text-amber-700">Konu inceleniyor.</p>}
  </UinCard>;
}
