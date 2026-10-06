"use client";

import {useMemo,useState} from "react";

export type AdminCardLinkOption={
  id:string;
  title:string;
  subtitle?:string|null;
  typeLabel:string;
  typeIcon:string;
};

function normalize(value:string){return value.toLocaleLowerCase("tr-TR").trim()}

function CardPicker({label,help,query,setQuery,selectedIds,setSelectedIds,blockedIds,options}:{label:string;help:string;query:string;setQuery:(value:string)=>void;selectedIds:string[];setSelectedIds:(ids:string[])=>void;blockedIds:string[];options:AdminCardLinkOption[]}){
  const selected=selectedIds.map(id=>options.find(option=>option.id===id)).filter((option):option is AdminCardLinkOption=>Boolean(option));
  const matches=useMemo(()=>{
    const needle=normalize(query);
    if(needle.length<2)return [];
    return options.filter(option=>!selectedIds.includes(option.id)&&!blockedIds.includes(option.id)&&normalize(`${option.title} ${option.subtitle||""} ${option.typeLabel}`).includes(needle)).slice(0,30);
  },[blockedIds,options,query,selectedIds]);
  return <div className="rounded-xl border border-emerald-200 bg-white/80 p-3">
    <p className="text-sm font-black text-emerald-950">{label}</p>
    <p className="mt-1 text-xs text-emerald-800">{help}</p>
    <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Film, kitap, albüm, sanatçı veya başka bir kart ara…" className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"/>
    {query.trim().length>0&&query.trim().length<2?<p className="mt-2 text-xs text-slate-500">Aramak için en az 2 karakter yaz.</p>:null}
    {matches.length>0?<div className="mt-2 max-h-48 overflow-y-auto rounded-xl border bg-white p-1">{matches.map(option=><button type="button" key={option.id} onClick={()=>{setSelectedIds([...selectedIds,option.id]);setQuery("")}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50"><span>{option.typeIcon}</span><span className="min-w-0 flex-1"><b className="block truncate">{option.title}</b><span className="block truncate text-xs text-slate-500">{option.typeLabel}{option.subtitle?` · ${option.subtitle}`:""}</span></span><span className="font-black text-emerald-700">＋</span></button>)}</div>:query.trim().length>=2?<p className="mt-2 text-xs text-slate-500">Eşleşen kart bulunamadı.</p>:null}
    {selected.length>0?<div className="mt-3 grid gap-2">{selected.map(option=><div key={option.id} className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2"><span>{option.typeIcon}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{option.title}</b><span className="text-xs text-slate-500">{option.typeLabel}</span></span><button type="button" onClick={()=>setSelectedIds(selectedIds.filter(id=>id!==option.id))} className="rounded-lg bg-white px-2 py-1 text-xs font-black text-red-700">Kaldır</button></div>)}</div>:<p className="mt-3 text-xs text-slate-500">Henüz kart seçilmedi.</p>}
  </div>
}

export default function AdminCardLineageEditor({options,upperIds,onUpperIdsChange,lowerIds,onLowerIdsChange}:{options:AdminCardLinkOption[];upperIds:string[];onUpperIdsChange:(ids:string[])=>void;lowerIds:string[];onLowerIdsChange:(ids:string[])=>void}){
  const [upperQuery,setUpperQuery]=useState("");
  const [lowerQuery,setLowerQuery]=useState("");
  return <fieldset className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <legend className="px-2 text-sm font-black text-emerald-950">Üst kart – alt kart bağlantıları</legend>
    <p className="text-xs font-semibold text-emerald-900">Bağlantıyı yalnızca bir kartta kurman yeterli. Karşı kartta otomatik olarak ters rolde görünür; aynı bağlantıyı yeniden ekleme.</p>
    <CardPicker label="Üst / kaynak kartlar" help="Bu kartın dayandığı kartları seç. Örneğin film için kaynak kitabı buraya ekle; kitabın ekranında film otomatik olarak alt kart görünür." query={upperQuery} setQuery={setUpperQuery} selectedIds={upperIds} setSelectedIds={onUpperIdsChange} blockedIds={lowerIds} options={options}/>
    <CardPicker label="Alt / türetilen kartlar" help="Bu karttan çıkan kartları seç. Örneğin kitap için filmleri buraya ekle; filmlerin ekranında kitap otomatik olarak üst kart görünür." query={lowerQuery} setQuery={setLowerQuery} selectedIds={lowerIds} setSelectedIds={onLowerIdsChange} blockedIds={upperIds} options={options}/>
  </fieldset>
}
