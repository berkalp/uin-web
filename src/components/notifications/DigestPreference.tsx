"use client";
import {useEffect,useState} from 'react';
import {supabase} from '@/utils/supabase/client';
export default function DigestPreference(){
 const [enabled,setEnabled]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');void supabase.rpc('get_my_uin_digest_preference').then(({data,error})=>{if(!active)return;if(error||typeof data!=='boolean')setError('Özet bildirimi ayarı yüklenemedi.');else setEnabled(data);});return()=>{active=false;};},[retry]);
 async function toggle(){if(enabled===null||busy)return;setBusy(true);setError('');try{const result=await supabase.rpc('save_my_uin_digest_preference',{p_enabled:!enabled});if(result.error||typeof result.data!=='boolean')throw Error();setEnabled(result.data);}catch{setError('Tercihin kaydedilemedi. Tekrar deneyebilirsin.');}finally{setBusy(false);}}
 return <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">UIN özetleri 🌿</h2><p className="mt-2 text-sm text-emerald-900">Üç günde bir, yeni gelişmeler varsa niyetlerin, ortak niyetlerin ve yaklaşan planların için UIN içi ve telefon bildirimi al.</p><button type="button" role="switch" aria-checked={enabled===true} disabled={enabled===null||busy} onClick={()=>void toggle()} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Kaydediliyor…':enabled===null?'Yükleniyor…':enabled?'Açık · Kapat':'Kapalı · Aç'}</button>{error?<p role="alert" className="mt-2 text-sm text-red-700">{error} <button onClick={()=>setRetry(value=>value+1)} className="underline">Yeniden dene</button></p>:null}</section>;
}
