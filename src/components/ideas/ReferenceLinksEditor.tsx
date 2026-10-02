"use client";

import type {ReferenceLink} from "@/utils/referenceLinks";

const EMPTY:ReferenceLink={label:"",url:""};

export default function ReferenceLinksEditor({value,onChange}:{value:ReferenceLink[];onChange:(value:ReferenceLink[])=>void}){
  const rows=value.length?value:[EMPTY];
  function update(index:number,field:keyof ReferenceLink,next:string){
    const copy=rows.map(row=>({...row}));
    copy[index][field]=next;
    onChange(copy);
  }
  function remove(index:number){
    onChange(rows.filter((_,rowIndex)=>rowIndex!==index));
  }
  return <fieldset className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4">
    <legend className="px-2 text-sm font-black">Kaynak bağlantıları</legend>
    <p className="mb-3 text-xs leading-5 text-slate-500">Bağlantının ne olduğunu yaz; kart açıldığında bu adla gösterilir.</p>
    <div className="space-y-3">{rows.map((row,index)=><div key={index} className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
      <label className="text-xs font-bold text-slate-600">Bağlantı adı<input value={row.label} maxLength={80} onChange={event=>update(index,"label",event.target.value)} placeholder="Örn. Bilet satış sayfası" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm text-slate-900"/></label>
      <label className="text-xs font-bold text-slate-600">Adres<input type="url" value={row.url} onChange={event=>update(index,"url",event.target.value)} placeholder="https://…" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm text-slate-900"/></label>
      <button type="button" onClick={()=>remove(index)} disabled={rows.length===1&&!row.label&&!row.url} className="self-end rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-700 disabled:opacity-30">Kaldır</button>
    </div>)}</div>
    <button type="button" disabled={rows.length>=20} onClick={()=>onChange([...rows.map(row=>({...row})),{...EMPTY}])} className="mt-3 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 disabled:opacity-40">＋ Bağlantı ekle</button>
  </fieldset>
}
