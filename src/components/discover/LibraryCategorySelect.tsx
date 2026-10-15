"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export default function LibraryCategorySelect({ types }: { types: {id:string;label:string;icon:string}[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return <label className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-bold">
    Kategori
    <select aria-label="Etkinliklerin Kütüphane kategorisi" disabled={pending} value={params.get('kind') ?? ''} onChange={event => {
      const next = new URLSearchParams(params.toString());
      if (event.target.value) next.set('kind', event.target.value); else next.delete('kind');
      next.delete('page');
      startTransition(() => router.replace(`/discover?${next}`, {scroll:false}));
    }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-slate-900 disabled:opacity-60">
      <option value="">Tümü</option>
      {types.map(type => <option key={type.id} value={type.id}>{type.icon} {type.label}</option>)}
    </select>
    {pending ? <span role="status" className="text-xs text-emerald-700">Yükleniyor…</span> : null}
  </label>;
}
