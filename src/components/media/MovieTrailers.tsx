"use client";
import { useState } from 'react';
import type { MovieTrailer } from '@/utils/movieTrailers';
export default function MovieTrailers({ trailers }: { trailers: MovieTrailer[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const valid = trailers.filter(t => /^[A-Za-z0-9_-]{11}$/.test(t.videoId));
  if (!valid.length) return null;
  const active = valid.find(t => t.videoId === selected);
  return <div className="space-y-3"><h4 className="font-black">Resmî fragman</h4><div className="flex flex-wrap gap-2">{valid.map(t => <button type="button" key={t.videoId} aria-pressed={selected === t.videoId} onClick={() => setSelected(t.videoId)} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">▶ Fragmanı izle{t.language ? ' · ' + t.language : ''}</button>)}</div>{active && <iframe key={active.videoId} src={'https://www.youtube-nocookie.com/embed/' + active.videoId + '?hl=tr&cc_lang_pref=tr&cc_load_policy=1&rel=0'} title={active.title} className="aspect-video min-h-[200px] w-full rounded-xl border-0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}{valid.map(t => <p key={t.videoId} className="text-xs text-gray-500">{t.title} · {t.channel} · <a href={'https://www.youtube.com/watch?v=' + t.videoId} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700">YouTube’da aç ↗</a></p>)}</div>;
}
