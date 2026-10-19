"use client";
import {readWatchAvailability,watchProviderTypes} from '@/utils/watchAvailability';
export default function WatchPlatforms({value,detail=false}:{value:unknown;detail?:boolean}){
 const data=readWatchAvailability(value);if(!data)return null;
 return <div className={`relative z-20 mt-2 space-y-1 ${detail?'text-slate-700':'text-white'}`} onClick={e=>e.stopPropagation()}>
  <p className="text-[10px] font-bold">Türkiye’de nerede izlenir?</p>
  <div className="flex flex-wrap gap-1">{data.providers.map(p=><a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-9 flex-col justify-center rounded-lg px-2 py-1 ${detail?'bg-emerald-50 text-emerald-900':'bg-white/15'}`}><span className="text-[11px] font-bold">{p.name} ↗</span><span className="text-[9px] opacity-80">{watchProviderTypes(p)}</span></a>)}</div>
  <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] underline opacity-80">{data.providers.length?'JustWatch · Tüm izleme seçenekleri':'Türkiye için doğrulanmış seçenek bulunamadı · JustWatch'}</a>
 </div>;
}
