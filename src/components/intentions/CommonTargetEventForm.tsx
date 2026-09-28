"use client";

import EventCardPicker from "@/components/ideas/EventCardPicker";
import MediaViewingFields from "@/components/media/MediaViewingFields";
import ClubViewingFields from "@/components/clubs/ClubViewingFields";
import {defaultClubViewing,type ClubProfile,type ViewingContext} from "@/utils/clubProfile";
import { useEffect, useMemo, useState } from "react";
import LocationHierarchySelect from "@/components/locations/LocationHierarchySelect";
import { getActivityCatalogue, type ActivityCatalogueItem } from "@/services/activityService";
import { createIntent } from "@/services/intentService";
import { getLocations } from "@/services/locationService";
import type { HierarchicalLocation } from "@/utils/location";
import { supabase } from "@/utils/supabase/client";

type ExistingEvent={intent_id:string;subtitle:string|null;start_date:string;end_date:string;visibility:string;viewing_context?:ViewingContext|null};

function normalized(value:string){return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function activityTerms(action:string){
  if(action.includes("MAÇ"))return["maç","izle","buluşma","etkinlik"];
  if(action.includes("İZLE"))return["film","dizi","izle"];
  if(action.includes("OKU"))return["kitap","oku"];
  if(action.includes("DİNLE"))return["müzik","dinle"];
  if(action.includes("OYNA"))return["oyun","oyna"];
  if(action.includes("GİT")||action.includes("ZİYARET"))return["gezi","ziyaret","git"];
  if(action.includes("SPOR"))return["spor"];
  return["etkinlik","aktivite"];
}
function bestActivity(items:ActivityCatalogueItem[],action:string){
  const terms=activityTerms(action).map(normalized);
  return [...items].filter(item=>!item.requires_sport||action.includes("SPOR")).sort((a,b)=>{
    const score=(item:ActivityCatalogueItem)=>{const text=normalized(item.name+" "+item.aliases.join(" "));const genericMatch=action.includes("MAÇ")?( /futbol|basketbol|voleybol|hentbol/.test(text)?-20:text.includes("mac")?10:0):0;return genericMatch+terms.reduce((sum,term)=>sum+(text.includes(term)?1:0),0)};
    return score(b)-score(a);
  })[0]?.id||"";
}

export default function CommonTargetEventForm({targetId,mediaKind,clubProfile,initialViewing,initialStartDate,targetTitle,targetAction,initialActivityId="",existing,onSaved}:{targetId:string;mediaKind?:"movie"|"series";clubProfile?:ClubProfile;initialViewing?:ViewingContext;initialStartDate?:string;targetTitle:string;targetAction:string;initialActivityId?:string;existing?:ExistingEvent|null;onSaved:(intentId:string)=>void}){
  const [viewing,setViewing]=useState<ViewingContext>(initialViewing||(existing?.viewing_context?.mode?existing.viewing_context:mediaKind?{media_kind:mediaKind,mode:"undecided"}:defaultClubViewing(clubProfile)));
  const [privateInfo,setPrivateInfo]=useState("");
  useEffect(()=>{if(mediaKind&&existing)void supabase.rpc("get_uin_media_event_v66",{p_intent_id:existing.intent_id}).then(({data})=>{if(data?.private_info)setPrivateInfo(data.private_info)});},[mediaKind,existing]);
  const [title,setTitle]=useState(existing?.subtitle||(initialViewing?.match?initialViewing.match+" · Birlikte izleyelim":`${targetTitle} etkinliği`));
  const [startDate,setStartDate]=useState(existing?.start_date?.slice(0,10)||initialStartDate||"");
  const [endDate,setEndDate]=useState(existing?.end_date?.slice(0,10)||initialStartDate||"");
  const [visibility,setVisibility]=useState(existing?.visibility||"public");
  const [people,setPeople]=useState("anyone");
  const [locationId,setLocationId]=useState("");
  const [locations,setLocations]=useState<HierarchicalLocation[]>([]);
  const [activityId,setActivityId]=useState(initialActivityId);
  const [relatedTargetIds,setRelatedTargetIds]=useState<string[]>([]);
  const [notes,setNotes]=useState("");
  const [capacity,setCapacity]=useState("5");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{void Promise.all([getLocations(),getActivityCatalogue()]).then(([nextLocations,catalogue])=>{setLocations(nextLocations);if(!initialActivityId)setActivityId(bestActivity(catalogue.activities,targetAction));}).catch(()=>setError("Etkinlik seçenekleri yüklenemedi."));},[initialActivityId,targetAction]);
  useEffect(()=>{if(!existing)return;void supabase.from("intents").select("location_id,notes,people,max_participants").eq("id",existing.intent_id).maybeSingle().then(({data})=>{if(!data)return;setLocationId(data.location_id||"");setNotes(data.notes||"");setPeople(data.people||"anyone");setCapacity(data.max_participants==null?"unlimited":String(data.max_participants));});},[existing]);
  const valid=useMemo(()=>Boolean(title.trim()&&startDate&&endDate&&endDate>=startDate&&locationId&&(existing||activityId)),[title,startDate,endDate,locationId,existing,activityId]);
  async function save(){
    if(!valid)return;if(mediaKind&&viewing.mode==="online"&&privateInfo.trim()){try{if(!["https:","http:"].includes(new URL(privateInfo.trim()).protocol))throw new Error();}catch{setError("Geçerli bir katılım bağlantısı gir.");return}}setBusy(true);setError("");
    try{
      const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Etkinlik oluşturmak için giriş yapmalısın.");
      let savedIntentId=existing?.intent_id;
      if(existing){
        const {error:updateError}=await supabase.from("intents").update({start_date:startDate,end_date:endDate,location_id:locationId,visibility,people,notes:notes.trim()||null,max_participants:capacity==="unlimited"?null:Number(capacity),common_intent_subtitle:title.trim(),updated_at:new Date().toISOString()}).eq("id",existing.intent_id).eq("user_id",user.id);
        if(updateError)throw updateError;
      }else{
        if(!activityId)throw new Error("Bu kart için uygun etkinlik türü bulunamadı.");
        const intentId=await createIntent({targetId,eventTitle:title,relatedTargetIds,userId:user.id,startDate,endDate,people,locationId,activityId,budget:"",recurrence:"one-time",visibility,notes,intentType:"Short-term Intent",maxParticipants:capacity,participantEligibility:"everyone",joinMessageMode:"none",joinMessagePrompt:""});
        savedIntentId=intentId;

      }
      if((clubProfile||mediaKind)&&savedIntentId){const {error:contextError}=await supabase.rpc(mediaKind?"save_my_media_viewing_v66":"save_my_club_viewing_v60",{p_target_id:targetId,p_intent_id:savedIntentId,p_context:viewing,...(mediaKind?{p_private_info:privateInfo.trim()||null}:{})});if(contextError)throw contextError;}
      if(!savedIntentId)throw new Error("Etkinlik kaydı oluşturulamadı.");
      onSaved(savedIntentId);
    }catch(problem){setError(problem instanceof Error?problem.message:"Etkinlik kaydedilemedi.");setBusy(false);}
  }
  return <div className="grid gap-5">
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-[11px] font-black uppercase tracking-[.16em] text-violet-700">Ana UIN kartı</p><p className="mt-1 font-black">{targetTitle}</p><p className="mt-1 text-sm text-violet-800/70">Bu etkinlik doğrudan bu UIN Kartına bağlı kaydedilecek.</p></div>
    {!existing&&<EventCardPicker related mainTargetId={targetId} value={null} selectedIds={relatedTargetIds} onRelatedChange={setRelatedTargetIds} onChange={()=>{}}/>}
    {mediaKind&&<MediaViewingFields kind={mediaKind} value={viewing} onChange={setViewing} event privateInfo={privateInfo} onPrivateChange={setPrivateInfo}/>}
    {clubProfile&&<ClubViewingFields profile={clubProfile} value={viewing} onChange={setViewing}/>}
    <label className="text-sm font-black">Etkinliğin adı<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder={`Örn. ${targetTitle} izleme gecesi`} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-black">Başlangıç<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"/></label><label className="text-sm font-black">Bitiş<input type="date" min={startDate||undefined} value={endDate} onChange={e=>setEndDate(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"/></label></div>
    <label className="text-sm font-black">Nerede?<div className="mt-2"><LocationHierarchySelect locations={locations} value={locationId} onChange={setLocationId}/></div></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-black">Kim katılabilir?<select value={people} onChange={e=>setPeople(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3"><option value="anyone">Herkes</option><option value="friends">Arkadaşlarım</option><option value="new people">Yeni kişiler</option><option value="solo">Hiç kimse</option></select></label><label className="text-sm font-black">Kapasite<select value={capacity} onChange={e=>setCapacity(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3"><option value="1">+1 kişi</option><option value="2">+2 kişi</option><option value="3">+3 kişi</option><option value="5">+5 kişi</option><option value="10">+10 kişi</option><option value="unlimited">Sınırsız</option></select></label></div>
    <label className="text-sm font-black">Kimler görebilir?<select value={visibility} onChange={e=>setVisibility(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3"><option value="public">Herkes</option><option value="friends">Arkadaşlarım</option><option value="invite_only">Yalnızca davetliler</option><option value="private">Yalnızca ben</option></select></label>
    <label className="text-sm font-black">Açıklama <span className="font-normal text-gray-400">(isteğe bağlı)</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} maxLength={2000} placeholder="Quiz night, izleme gecesi, cosplay buluşması veya başka bir etkinlik fikri…" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"/></label>
    {error&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    <button type="button" disabled={!valid||busy} onClick={()=>void save()} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white disabled:bg-gray-300">{busy?"Kaydediliyor…":existing?"Etkinliği güncelle":"Etkinliği oluştur"}</button>
  </div>;
}
