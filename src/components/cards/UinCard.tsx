import Link from "next/link";
import type { ReactNode } from "react";
import EyeIcon from "@/components/ui/EyeIcon";
import CardQuickDetails from "./CardQuickDetails";

// One shared geometry keeps catalogue, profile, intention and experience cards visually identical.
export const cardFrame = "relative flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,.12)]";
export const cardGrid = "grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3";
export const cardPrimary = "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
export const cardSecondary = "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50";

type HeaderProps = {
  title: string;
  subtitle?: ReactNode;
  category?: string | null;
  coverPositionY?: number;
  icon?: string | null;
  coverUrl?: string | null;
  href?: string;
  badge?: string;
  tone?: "target" | "plan" | "experience" | "favorite";
  controls?: ReactNode;
  badgeExtra?: ReactNode;
};

export function UinCardHeader({ title, subtitle, category, icon, coverUrl, coverPositionY = 50, href, badge = "FİKİR", tone = "target", controls, badgeExtra }: HeaderProps) {
  const tones = { target: "bg-emerald-50 text-emerald-800", plan: "bg-violet-50 text-violet-800", experience: "bg-blue-50 text-blue-800", favorite: "bg-rose-50 text-rose-800" };
  const cover = coverUrl
    ? <img src={coverUrl} alt="" loading="lazy" style={{ objectPosition: `50% ${coverPositionY}%` }} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
    : <span className="grid h-full w-full place-items-center bg-slate-950 text-6xl" aria-hidden="true">{icon || "🌱"}</span>;

  return <>
    <div className="uin-card-cover group relative shrink-0 overflow-hidden bg-gray-100">
      {href ? <Link href={href} aria-label={`${title} — Detayı gör`} className="block h-full">{cover}</Link> : cover}
      <div className="absolute left-3 right-12 top-3 flex flex-wrap items-center gap-1.5"><span className={`pointer-events-none rounded-full px-3 py-1.5 text-[10px] font-black tracking-wide shadow-sm ${tones[tone]}`}>{badge}</span>{badgeExtra}</div>
      {controls && <div className="absolute right-3 top-3">{controls}</div>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent px-5 pb-5 pt-20 text-white">
        {category && <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-emerald-200"><span aria-hidden="true">{icon}</span>{category}</p>}
        <h2 className="mt-2 line-clamp-2 text-2xl font-black leading-[1.08] tracking-tight">{title}</h2>
      </div>
    </div>
    {subtitle && <div className="min-h-12 shrink-0 border-b border-gray-100 px-5 py-3 text-xs font-semibold text-gray-500">{subtitle}</div>}
  </>;
}

export function UinCardActions({ primary, secondary, href, details }: { primary?: ReactNode; secondary?: ReactNode; href?: string; detailLabel?: string; details?: ReactNode }) {
  return <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 pb-4 pt-3">
    {href && <Link href={href} title="Kartı görüntüle" aria-label="Kartı görüntüle" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"><EyeIcon /></Link>}
    {secondary && <div className="max-w-[36%] shrink-0 [&_button]:max-w-full [&_a]:max-w-full">{secondary}</div>}
    {details}
    {primary && <div className="min-w-0 flex-1 [&_button]:min-h-11 [&_button]:rounded-2xl [&_button]:px-3 [&_button]:text-xs [&_a]:min-h-11 [&_a]:rounded-2xl [&_a]:px-3 [&_a]:text-xs">{primary}</div>}
  </div>;
}

export default function UinCard({ children, ...header }: HeaderProps & { children?: ReactNode; primary?: ReactNode; secondary?: ReactNode; detailLabel?: string; detailContent?: ReactNode }) {
  return <article className={cardFrame}>
    <UinCardHeader {...header} />
    <div className="min-h-0 flex-1 overflow-hidden px-5 py-4 text-sm text-gray-600">{children}</div>
    <UinCardActions primary={header.primary} secondary={header.secondary} href={header.href} details={<CardQuickDetails title={header.title} subtitle={header.subtitle}>{header.detailContent ?? children}</CardQuickDetails>} />
  </article>;
}