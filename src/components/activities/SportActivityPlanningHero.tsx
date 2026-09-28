"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export type SportFixtureOption={id:string;match_name:string;match_date:string;venue:string|null;selected:boolean};

function fixtureLabel(fixture:SportFixtureOption){return `${new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${fixture.match_date.slice(0,10)}T00:00:00`))} · ${fixture.match_name}${fixture.venue?` · ${fixture.venue}`:""}`}

export default function SportActivityPlanningHero({intentId,teamTitle,sportName,scheduleLabel,locationLabel,hostName,participantCount,maxParticipants,visibilityLabel,recruitmentLabel,fixtures,canManage,roomHref}:{intentId:string|null;teamTitle:string;sportName:string|null;scheduleLabel:string;locationLabel:string;hostName:string;participantCount:number;maxParticipants:number|null;visibilityLabel:string;recruitmentLabel:string;fixtures:SportFixtureOption[];canManage:boolean;roomHref:string|null}){
  const router=useRouter();
  const selected=fixtures.find(item=>item.selected)||null;
  const [fixtureId,setFixtureId]=useState(selected?.id||"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [showManual,setShowManual]=useState(fixtures.length===0);
  async function choose(value:string){setFixtureId(value);if(!intentId||!value)return;setBusy(true);setMessage("");const {error}=await supabase.rpc("set_intent_match_fixture_v50",{p_intent_id:intentId,p_fixture_id:value});if(error)setMessage(error.message||"Maç seçilemedi.");else{setMessage("Maç plana bağlandı.");router.refresh()}setBusy(false)}
  async function createFixture(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!intentId)return;
    const values=new FormData(event.currentTarget);
    setBusy(true);setMessage("");
    const {error}=await supabase.rpc("create_and_select_intent_match_fixture_v51",{
      p_intent_id:intentId,
      p_opponent_name:String(values.get("opponent")||""),
      p_match_date:String(values.get("date")||""),
      p_venue:String(values.get("venue")||""),
    });
    if(error)setMessage(error.message||"Maç eklenemedi.");
    else{setMessage("Maç oluşturuldu ve plana bağlandı.");setShowManual(false);router.refresh()}
    setBusy(false);
  }
  const current=fixtures.find(item=>item.id===fixtureId)||selected;
  return <div className="flex min-h-full flex-col p-5 md:p-7">
    <div className="flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">{sportName||"Spor"}</span><span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">{visibilityLabel}</span><span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800">{recruitmentLabel}</span></div>
    <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-gray-400">TAKIM</p><h1 className="mt-1 text-3xl font-black text-gray-950 md:text-4xl">{teamTitle}</h1>
    <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-700">SEÇİLEN MAÇ</p><p className="mt-2 font-black text-gray-950">{current?current.match_name:"Henüz maç seçilmedi"}</p>{current?.venue&&<p className="mt-1 text-sm text-gray-600">{current.venue}</p>}
      {canManage&&<div className="mt-3 space-y-3"><select value={fixtureId} disabled={busy||!fixtures.length} onChange={event=>void choose(event.target.value)} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm font-bold"><option value="">{fixtures.length?"Fikstürden maç seç":"Kayıtlı yaklaşan maç yok"}</option>{fixtures.map(fixture=><option key={fixture.id} value={fixture.id}>{fixtureLabel(fixture)}</option>)}</select><button type="button" onClick={()=>setShowManual(value=>!value)} className="text-xs font-black text-violet-700 underline underline-offset-4">{showManual?"Maç bilgilerini kapat":"Fikstürde yoksa maçı ekle"}</button>{showManual&&<form onSubmit={createFixture} className="grid gap-2 rounded-xl border border-violet-200 bg-white p-3 sm:grid-cols-2"><label className="text-xs font-bold text-gray-600">Rakip takım<input name="opponent" required maxLength={120} placeholder="Örn. Kocaelispor" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-950"/></label><label className="text-xs font-bold text-gray-600">Maç tarihi<input name="date" type="date" required min={new Date().toISOString().slice(0,10)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-950"/></label><label className="text-xs font-bold text-gray-600 sm:col-span-2">Stadyum / salon<input name="venue" maxLength={240} placeholder="Henüz belli değilse boş bırakabilirsin" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-950"/></label><button disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">{busy?"Kaydediliyor…":"Maçı ekle ve seç"}</button></form>}{message&&<p className="text-xs font-bold text-violet-700">{message}</p>}</div>}
    </div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-gray-50 p-3"><dt className="text-[10px] font-black uppercase text-gray-400">Tarih</dt><dd className="mt-1 text-sm font-bold">{scheduleLabel}</dd></div><div className="rounded-xl bg-gray-50 p-3"><dt className="text-[10px] font-black uppercase text-gray-400">Yer</dt><dd className="mt-1 text-sm font-bold">{current?.venue||locationLabel||"Henüz netleşmedi"}</dd></div><div className="rounded-xl bg-gray-50 p-3"><dt className="text-[10px] font-black uppercase text-gray-400">Düzenleyen</dt><dd className="mt-1 text-sm font-bold">{hostName}</dd></div><div className="rounded-xl bg-gray-50 p-3"><dt className="text-[10px] font-black uppercase text-gray-400">Katılımcılar</dt><dd className="mt-1 text-sm font-bold">{participantCount} / {maxParticipants||"Sınırsız"}</dd></div></dl>
    {roomHref&&<Link href={roomHref} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">Planlama odasını aç</Link>}
  </div>;
}
