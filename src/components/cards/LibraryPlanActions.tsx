"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createPortal} from 'react-dom';
import {supabase} from '@/utils/supabase/client';
import type {PersonalEventPreview} from '@/components/cards/LibraryTopicCard';

export default function LibraryPlanActions({event}:{event:PersonalEventPreview}){
 const router=useRouter();const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[reason,setReason]=useState('personal_reason'),[error,setError]=useState('');
 const owner=event.viewer_role==='owner';
 const resource=event.plan_id??event.resource_id??event.intent_id;
 const href=`/activities/${encodeURIComponent(resource??'')}`;
 const ended=['completed','cancelled','expired','closed'].includes(event.lifecycle_status??'');
 const editable=owner&&!ended;
 const canLeave=['participant','member'].includes(event.viewer_role??'')&&!ended&&Boolean(event.plan_id);
 async function submit(){if(busy)return;setBusy(true);setError('');try{
  const result=event.plan_id?await supabase.rpc(owner?'cancel_shared_plan_v3':'leave_shared_plan_v2',{p_plan_id:event.plan_id,p_reason_code:reason,p_reason_text:null}):await supabase.rpc('manage_intent_lifecycle',{p_intent_id:event.intent_id??event.resource_id,p_action:'cancel'});
  if(result.error)throw result.error;
  if(result.data&&typeof result.data==='object'&&result.data.ok===false)throw new Error(result.data.message??'İşlem tamamlanamadı.');
  setOpen(false);router.refresh();
 }catch(cause){setError(cause instanceof Error?cause.message:'İşlem tamamlanamadı.')}finally{setBusy(false)}}
 if(!editable&&!canLeave)return <Link href={href} className="flex min-h-[60px] items-center justify-center rounded-xl bg-emerald-600 px-1.5 text-center text-[11px] font-black text-white">Etkinliği aç</Link>;
 return <><div className="flex min-h-[60px] overflow-hidden rounded-xl"><Link aria-label={editable?'Etkinliği düzenle':'Planı aç'} href={editable?event.plan_id?`/plans/${encodeURIComponent(event.plan_id)}?manage=1`:`/intents/${encodeURIComponent(event.intent_id??event.resource_id??'')}/edit`:href} className="flex flex-1 items-center justify-center bg-emerald-600 px-1 text-center text-[11px] font-black text-white">{editable?<span aria-hidden="true" className="text-xl">✎</span>:'Planı aç'}</Link><button type="button" aria-label={owner?'Etkinliği iptal et':'Katılımdan ayrıl'} onClick={()=>setOpen(true)} className="flex-1 bg-red-700 px-1 text-[11px] font-black text-white">{owner?<span aria-hidden="true" className="text-xl">×</span>:'Ayrıl'}</button></div>{open?createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-label={owner?'Etkinliği iptal et':'Katılımdan ayrıl'} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 text-slate-900"><h2 className="text-lg font-black">{owner?'Etkinliği iptal et':'Katılımdan ayrıl'}</h2><p className="text-sm">{owner?'Etkinlik tüm katılımcılar için iptal edilir.':'Yalnızca senin katılımın sonlandırılır; etkinlik devam eder.'}</p>{event.plan_id?<label className="block text-sm font-bold">Neden<select value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border p-3">{(owner?[['personal_reason','Kişisel neden'],['schedule_conflict','Tarih uyuşmazlığı'],['insufficient_participation','Yeterli katılım yok'],['weather_or_safety','Hava / güvenlik']]:[['personal_reason','Kişisel neden'],['schedule_changed','Programım değişti'],['transport_problem','Ulaşım problemi'],['no_longer_interested','Artık katılmak istemiyorum']]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>:null}{error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}<div className="flex gap-2"><button disabled={busy} onClick={()=>setOpen(false)} className="flex-1 rounded-xl border p-3 font-bold">Vazgeç</button><button disabled={busy} onClick={()=>void submit()} className="flex-1 rounded-xl bg-red-700 p-3 font-bold text-white">{busy?'Kaydediliyor…':owner?'İptal et':'Ayrıl'}</button></div></div></div>,document.body):null}</>;
}
