import Link from "next/link";

type Crumb = { label: string; href?: string };

export default function SportsBreadcrumbs({ items }: { items: Crumb[] }) {
  return <nav aria-label="Spor kataloğu yolu" className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500">
    {items.map((item,index)=><span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
      {index>0&&<span aria-hidden="true" className="text-gray-300">→</span>}
      {item.href?<Link href={item.href} className="rounded-lg px-2 py-1 hover:bg-emerald-50 hover:text-emerald-700">{item.label}</Link>:<span className="rounded-lg bg-gray-100 px-2 py-1 text-gray-900">{item.label}</span>}
    </span>)}
  </nav>;
}
