"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {gameHonours,type GameCatalogue} from '@/utils/gameCatalogue';

export default function GameHonours({game,title}:{game:GameCatalogue;title:string}){
 const honours=gameHonours(game),[open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
 if(!honours.length)return null;
 return <><button ref={trigger} type="button" onClick={e=>{e.stopPropagation();setOpen(true)}} aria-label={`${title}: ödüller ve sıralamalar`} className="relative z-20 mt-2 flex w-full flex-col gap-1 rounded-lg bg-amber-100/10 px-2 py-1.5 text-left text-[10px] font-bold text-amber-100">
  {honours.slice(0,2).map(h=><span className="line-clamp-1" key={h.label}>{h.label}</span>)}<span className="text-[9px] text-amber-200/80">{honours.length>2?`+${honours.length-2} · `:''}Ödüller ve sıralamalar ↗</span>
 </button>{open?createPortal(<dialog ref={dialog} aria-label={`${title}: ödüller ve sıralamalar`} onPointerDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus()}} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setOpen(false)}} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
  <div className="sticky -top-5 flex items-start justify-between gap-3 bg-white py-3"><div><h2 className="text-lg font-black">Ödüller ve sıralamalar</h2><p className="text-sm text-slate-500">{title}</p></div><button autoFocus type="button" aria-label="Kapat" onClick={()=>setOpen(false)} className="rounded-lg p-2 text-xl">×</button></div>
  <p className="mb-4 text-xs text-slate-500">Ödüller ve kaynak listelerindeki sıralamalar ayrı gösterilir. Sıralamalar belirtilen tarihte kontrol edilmiştir; anlık değildir.</p>
  <ul className="space-y-3">{honours.map(h=><li key={h.label}><a href={h.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border p-3 text-sm font-bold text-emerald-800">{h.label} ↗<span className="mt-1 block text-xs font-normal text-slate-500">{h.note}</span></a></li>)}</ul>
 </dialog>,document.body):null}</>;
}
