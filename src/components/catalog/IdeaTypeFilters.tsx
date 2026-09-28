import Link from "next/link";

export type IdeaTypeFilter = {
  key: string;
  label: string;
  icon: string;
  count: number;
  href: string;
};

function TypeLink({ item, active }: { item: IdeaTypeFilter; active: boolean }) {
  return <Link href={item.href} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-black transition ${active ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"}`}>
    <span aria-hidden="true">{item.icon}</span><span>{item.label}</span><span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{item.count}</span>
  </Link>;
}

export default function IdeaTypeFilters({ items, selectedKey }: { items: IdeaTypeFilter[]; selectedKey: string; allHref?: string; totalCount?: number }) {
  return <section className="mt-5 grid gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
    {items.map(item=><TypeLink key={item.key} item={item} active={selectedKey===item.key}/>)}
  </section>;
}
