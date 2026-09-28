"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const sections: Record<string, string[]> = {
  "/ideas": ["/ideas", "/clubs", "/catalog"],
  "/timeline": ["/timeline", "/seeds", "/together"],
  "/discover": ["/discover", "/activities", "/plans", "/intents", "/intent-drafts", "/onboarding"],
  "/friends": ["/friends", "/connections"],
};

export default function PrimaryNavLink({ href, children, mobile = false }: { href: string; children: ReactNode; mobile?: boolean }) {
  const pathname = usePathname();
  const active = (sections[href] || [href]).some(path => pathname === path || pathname?.startsWith(`${path}/`));

  if (mobile) {
    return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-black transition ${active ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>{children}</Link>;
  }

  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex h-14 items-center gap-2 rounded-[18px] border px-4 font-bold shadow-sm transition ${active ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" : "border-gray-200 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-800"}`}>{children}</Link>;
}