"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function contextualTarget(pathname: string) {
  if (pathname.startsWith("/seeds/subjects/")) return { href: "/admin/seed-catalogue?status=active", label: "Konu ve görseli düzenle" };
  if (pathname.startsWith("/seeds/")) return { href: "/admin/seed-catalogue?status=active", label: "Kayıt/katalog görselini düzenle" };
  if (pathname.startsWith("/u/")) return { href: "/admin/users", label: "Profili düzenle" };
  if (pathname.startsWith("/activities/") || pathname.startsWith("/intents/")) return { href: "/admin/intents", label: "Niyete müdahale et" };
  if (pathname.startsWith("/plans/") || pathname.startsWith("/plan-room/")) return { href: "/admin/plans", label: "Planı düzenle" };
  if (pathname.startsWith("/communities/")) return { href: "/admin/communities", label: "Topluluğu düzenle" };
  return { href: "/admin", label: "Bu alanı yönet" };
}

export default function GlobalAdminEditBar({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  if (pathname.startsWith("/admin")) return null;
  const target = contextualTarget(pathname);

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-[100] rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow-xl">🛠 Admin</button>;

  return <aside className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-slate-950/95 p-2.5 text-white shadow-2xl backdrop-blur" aria-label="Admin düzenleme çubuğu">
    <span className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950">🛠 ADMIN · {role.toUpperCase()}</span>
    <Link href={target.href} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">✎ {target.label}</Link>
    <Link href="/admin/seed-catalogue?status=active" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">🖼 Görsel/katalog</Link>
    <Link href="/admin/users" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">Kullanıcılar</Link>
    <Link href="/admin/intents" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">Niyetler</Link>
    <Link href="/admin/plans" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">Planlar</Link>
    <Link href="/admin" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">Tüm yönetim</Link>
    <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10" aria-label="Admin çubuğunu küçült">—</button>
  </aside>;
}
