"use client";

import { useEffect, useRef, useState } from "react";
import SeedExperienceEditor from "@/components/seeds/SeedExperienceEditor";
import type { SeedJournalEntry, SeedVisibility } from "@/utils/seeds";
import { supabase } from "@/utils/supabase/client";

export default function CommonTargetExperienceAction({targetId,targetTitle,seedId:initialSeedId,existingExperience=null,defaultVisibility="everyone",occurredOn=null,completedDatePrecision=null,completedYear=null,personalCoverUrl=null,initialRating=null,catalogItemId=null,buttonLabel,buttonClassName,onSaved,autoStart=false}:{targetId:string;targetTitle:string;seedId?:string|null;existingExperience?:SeedJournalEntry|null;defaultVisibility?:SeedVisibility;occurredOn?:string|null;completedDatePrecision?:"exact"|"year"|"unknown"|null;completedYear?:number|null;personalCoverUrl?:string|null;initialRating?:number|null;catalogItemId?:string|null;buttonLabel?:string;buttonClassName?:string;onSaved?:(result:{favorite:boolean})=>void;autoStart?:boolean}){
  const [seedId,setSeedId]=useState(initialSeedId||"");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const started=useRef(false);
  useEffect(()=>{if(autoStart&&!initialSeedId&&!started.current){started.current=true;void prepare()}},[autoStart,initialSeedId]);
  if(seedId)return <SeedExperienceEditor seedId={seedId} seedTitle={targetTitle} existingExperience={existingExperience} defaultVisibility={defaultVisibility} occurredOn={occurredOn} completedDatePrecision={completedDatePrecision} completedYear={completedYear} personalCoverUrl={personalCoverUrl} initialRating={initialRating} catalogItemId={catalogItemId} onSaved={onSaved} autoOpen={autoStart||!initialSeedId} buttonLabel={buttonLabel||(existingExperience||initialRating!=null?"Düzenle":"Deneyim ekle")} buttonClassName={buttonClassName||"rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white hover:bg-purple-700"}/>;
  async function prepare(){setLoading(true);setError("");const {data,error:problem}=await supabase.rpc("ensure_my_uin_experience_seed_v82",{p_target_id:targetId});if(problem){setError(problem.message||"Deneyim başlatılamadı.");setLoading(false);return;}if(typeof data!=="string"){setError("Bu kart için deneyim kaydı hazırlanamadı.");setLoading(false);return;}setSeedId(data);}
  return <div className="flex flex-col items-end gap-1"><button type="button" disabled={loading} onClick={()=>void prepare()} className={buttonClassName||"rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white disabled:bg-gray-300"}>{loading?"Hazırlanıyor…":buttonLabel||"Deneyim ekle"}</button>{error&&<span className="max-w-xs text-right text-xs font-semibold text-red-700">{error}</span>}</div>;
}
