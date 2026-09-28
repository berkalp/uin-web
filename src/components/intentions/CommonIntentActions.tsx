"use client";

import Link from "next/link";

export default function CommonIntentActions({ targetId, initiallyAdded, isSport = false }: { targetId: string; initiallyAdded: boolean; isSport?: boolean }) {
  return <div className="flex flex-col gap-3 sm:flex-row">
    <Link href={`/intentions/${encodeURIComponent(targetId)}/personal`}
      className={initiallyAdded ? "rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-center text-sm font-bold text-gray-600" : "rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white hover:bg-emerald-700"}>
      {isSport ? (initiallyAdded ? "✓ İzlemek istiyorum" : "+ İzlemek istiyorum") : (initiallyAdded ? "✓ Niyetimi düzenle" : "+ İstiyorum")}
    </Link>
    <Link href={`/onboarding?target=${encodeURIComponent(targetId)}`}
      className="rounded-2xl bg-violet-600 px-5 py-3 text-center text-sm font-black text-white hover:bg-violet-700">
      Etkinlik oluştur
    </Link>
  </div>;
}
