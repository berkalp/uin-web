import Link from "next/link";

export type PublicFavoriteItem = {
  id: string;
  source_type?: "catalog" | "subject" | string | null;
  title: string;
  creator_name?: string | null;
  cover_url?: string | null;
  item_kind?: string | null;
  is_featured?: boolean | null;
};

export default function PublicFavoritesPanel({
  items,
  sharedCount = 0,
}: {
  items: PublicFavoriteItem[];
  sharedCount?: number;
}) {
  if (!items.length) return null;

  const ordered = [...items].sort(
    (left, right) => Number(Boolean(right.is_featured)) - Number(Boolean(left.is_featured))
  );
  const categoryLabel = (kind?: string | null) => {
    const value = (kind ?? "diğer").toLocaleLowerCase("tr-TR");
    if (value.includes("movie") || value.includes("film")) return "Filmler";
    if (value.includes("book") || value.includes("kitap")) return "Kitaplar";
    if (value.includes("music") || value.includes("artist") || value.includes("müzik") || value.includes("sanatçı")) return "Müzik ve sanatçılar";
    if (value.includes("place") || value.includes("location") || value.includes("yer")) return "Yerler";
    if (value.includes("series") || value.includes("dizi")) return "Diziler";
    return "Diğer sevdiklerin";
  };
  const grouped = ordered.reduce<Record<string, PublicFavoriteItem[]>>((result, item) => {
    const label = categoryLabel(item.item_kind);
    (result[label] ??= []).push(item);
    return result;
  }, {});

  return (
    <section className="mt-10 rounded-[32px] border border-rose-100 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">KATEGORİLER</p>
          <h2 className="mt-2 text-2xl font-black text-gray-950">Sevdiklerim</h2>
          {sharedCount > 0 && <p className="mt-1 text-sm text-gray-500">{sharedCount} ortak sevdiğiniz</p>}
        </div>
        <span className="text-sm font-bold text-rose-700">Toplam · {ordered.length}</span>
      </div>

      <div className="mt-7 space-y-9">
        {Object.entries(grouped).map(([label, categoryItems]) => <section key={label}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-gray-950">{label}</h3>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">{categoryItems.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8">
        {categoryItems.map((item) => {
          const href = item.source_type === "subject"
            ? `/loved/subject/${encodeURIComponent(item.id)}`
            : `/seeds/subjects/${encodeURIComponent(item.id)}`;
          return (
            <Link key={`${item.source_type ?? "catalog"}:${item.id}`} href={href} className="group min-w-0">
              <div className="aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">♡</div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-black text-gray-950">{item.title}</p>
              {(item.creator_name || item.item_kind) && (
                <p className="truncate text-xs text-gray-500">{item.creator_name || item.item_kind}</p>
              )}
            </Link>
          );
        })}
          </div>
        </section>)}
      </div>
    </section>
  );
}
