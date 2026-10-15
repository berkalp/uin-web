"use client";
import {useEffect,useId,useRef,useState} from 'react';
type Option={id:string;label:string;icon:string;count:number|string};
export function BrowseCategoryPicker({value,options,onChange}:{value:string;options:Option[];onChange:(id:string)=>void}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null);const id=useId();
  const selected=options.find(option=>option.id===value)??options[0];
  const close=()=>{setOpen(false);setQuery('');trigger.current?.focus()};
  useEffect(()=>{if(!open)return;input.current?.focus();const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)){setOpen(false);setQuery('')}};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
  return <div ref={root} className="relative mt-3" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close()}}}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={()=>open?close():setOpen(true)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-left text-emerald-950 hover:bg-emerald-100 focus-visible:outline-emerald-600">
      <span className="text-2xl" aria-hidden="true">▦</span><span className="flex-1"><span className="block text-xs font-bold text-emerald-700">Kategori seç</span><span className="block text-lg font-black">{selected?.label||'Tümü'}</span></span><span className="rounded-full bg-white px-3 py-1 text-sm font-black">{selected?.count??'…'}</span><span aria-hidden="true">⌄</span>
    </button>
    {open?<div id={id} role="region" aria-label="Kategoriler" className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-emerald-200 bg-white p-3 shadow-xl md:right-auto md:w-[420px]">
      <div className="flex gap-2"><input ref={input} aria-label="Kategori ara" placeholder="Kategori ara" value={query} onChange={event=>setQuery(event.target.value)} className="min-w-0 flex-1 rounded-xl border p-3 text-sm outline-emerald-500"/><button type="button" aria-label="Kategorileri kapat" onClick={close} className="w-11 rounded-xl border">×</button></div>
      <div className="mt-2 max-h-[50vh] overflow-y-auto">{options.filter(option=>option.label.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr'))).map(option=><button key={option.id} type="button" aria-pressed={value===option.id} onClick={()=>{onChange(option.id);close()}} className={`my-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${value===option.id?'bg-emerald-50 text-emerald-900':'hover:bg-slate-50 text-slate-800'}`}><span aria-hidden="true">{option.icon}</span><span className="flex-1 font-bold">{option.label}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{option.count}</span>{value===option.id?<span aria-hidden="true">✓</span>:null}</button>)}{!options.some(option=>option.label.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')))?<p className="p-4 text-sm text-slate-500">Bu isimde kategori bulunamadı.</p>:null}</div>
    </div>:null}
  </div>;
}
