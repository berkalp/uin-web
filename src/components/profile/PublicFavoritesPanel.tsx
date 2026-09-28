import UinCard, { cardGrid } from "@/components/cards/UinCard";
import { favoriteLabels } from "@/utils/favoriteLabels";

export type PublicFavoriteItem = {
  id?: string; catalog_item_id?: string; canonical_target_id?:string|null; source_type?: "catalog" | "subject" | string | null; title: string;
  creator_name?: string | null; cover_url?: string | null; item_kind?: string | null; is_featured?: boolean | null;
};

export function getPublicFavoriteId(item: PublicFavoriteItem) {
  return item.id || item.catalog_item_id || "";
}

export default function PublicFavoritesPanel({ items, sharedCount = 0 }: { items: PublicFavoriteItem[]; sharedCount?: number }) {
  if (!items.length) return null;
  const ordered = [...items].filter((item) => Boolean(getPublicFavoriteId(item))).sort((a,b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)));
  return <section className="mt-8">
    <div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-bold text-gray-950">Sevdiği deneyimler</h2>{sharedCount > 0 && <p className="mt-1 text-sm text-gray-500">{sharedCount} ortak sevdiğiniz deneyim</p>}</div><span className="text-sm text-gray-500">{items.length} sevilen</span></div>
    <div className={cardGrid}>{ordered.map(item => {
      const itemId = getPublicFavoriteId(item);
      const words = favoriteLabels[item.item_kind || "other"] || favoriteLabels.other;
      const href = item.source_type === "subject" ? `/loved/subject/${itemId}` : `/seeds/subjects/${itemId}`;
      return <UinCard key={`${item.source_type}:${itemId}`} title={item.title} subtitle={item.creator_name} category={words.label}
        icon={words.icon} coverUrl={item.cover_url} href={href} badge="SEVDİĞİ DENEYİM" tone="favorite">
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">♥ Sevdiği deneyimler arasında</p>
        {item.is_featured && <p className="mt-3 text-xs text-amber-700">★ Profil vitrininde</p>}
      </UinCard>;
    })}</div>
  </section>;
}
