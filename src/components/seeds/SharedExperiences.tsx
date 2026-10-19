"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {supabase} from '@/utils/supabase/client';
import {activityEventLabel} from '@/utils/eventPresentation';
import {sharedAction,sharedStatus,type SharedDetail,type SharedListItem,type SharedReputation} from '@/utils/sharedExperiences';
import type {SharedDraft} from '@/utils/useSharedExperienceDraft';
const box='rounded-2xl border border-emerald-100 bg-white p-4 space-y-3';
const button='inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-600';
function useResult<T>(action:string,key:string,payload:Record<string,unknown>){
 const [result,setResult]=useState<{key:string;data:T|null;error:string}|null>(null),[revision,setRevision]=useState(0);
 const serialized=JSON.stringify(payload);const resultKey=action+key+serialized+revision;
 useEffect(()=>{let live=true;sharedAction<T>(supabase,action,JSON.parse(serialized)).then(data=>{if(live)setResult({key:resultKey,data,error:''})}).catch(error=>{if(live)setResult({key:resultKey,data:null,error:error.message})});return()=>{live=false}},[action,serialized,resultKey]);

 return {data:result?.key===resultKey?result.data:null,error:result?.key===resultKey?result.error:'',reload:useCallback(()=>setRevision(x=>x+1),[])};
}
export function CompanionFields({draft,disabled=false}:{draft:SharedDraft;disabled?:boolean}){
 const [query,setQuery]=useState('');const context=draft.options.context;
 return <section className={box}><h3 className="font-bold">{context?.question??"Kiminle birlikteydin?"}</h3><p className="text-sm text-gray-600">İsteğe bağlı. Arkadaşına bu kart için onay gider. Kendi deneyimini puanladıktan sonra birbirinizi bu bağlamda değerlendirebilirsiniz.</p>
 {draft.error?<button type="button" className={button} onClick={draft.reload}>{draft.error} · Yeniden dene</button>:null}
 {draft.links.length?draft.links.map(x=><Link className={button} key={x.id} href={'/shared-experiences/'+x.id}>Ortak deneyimi gör · {sharedStatus(x.status)}</Link>):<>
 {context?<p className="text-sm font-bold">{context.title} · {context.peerRole}</p>:<p role="status">Kartın deneyim bağlamı yükleniyor…</p>}
 <input aria-label="Arkadaş ara" placeholder="Arkadaş ara" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl border p-3"/>
 <div className="max-h-72 overflow-y-auto space-y-2">{draft.options.friends.filter(f=>f.name.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))).map(f=><div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-3"><label className="flex min-h-11 flex-1 items-center gap-2"><input type="checkbox" disabled={disabled} checked={f.id in draft.scores} onChange={()=>draft.toggle(f.id)}/>{f.name}</label>{f.id in draft.scores?<label className="text-xs">{context?.peerRole??"Arkadaş"} puanın<select aria-label={f.name+' için arkadaş puanı'} disabled={disabled} value={draft.scores[f.id]} onChange={e=>draft.setScores(s=>({...s,[f.id]:e.target.value}))} className="ml-2 min-h-11 rounded-lg border p-2"><option value="">Sonra</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select></label>:null}</div>)}</div>
 {!draft.options.friends.length&&!draft.error?<p className="text-sm text-gray-500">Seçebileceğin arkadaşlar burada görünür. Tek başına da kaydedebilirsin.</p>:null}
 <p className="text-xs text-gray-600">Arkadaş puanı gönderildikten sonra değiştirilemez; karşılıklı değerlendirme tamamlanınca veya onaydan 7 gün sonra ortalamaya katılır.</p></>}
 </section>;
}
export function SharedExperienceInbox({seedId}:{seedId?:string}){
 const result=useResult<SharedListItem[]>('list',seedId??'',seedId?{seedId}:{});
 if(result.error)return <button type="button" className={button} onClick={result.reload}>Ortak deneyimler yüklenemedi · Yeniden dene</button>;
 if(!result.data?.length)return null;
 return <section className={box}><h2 className="font-bold">Birlikte yaşadığınız deneyimler</h2>{result.data.map(x=><Link className="block rounded-xl bg-emerald-50 p-3" key={x.id} href={'/shared-experiences/'+x.id}><strong>{x.title}</strong><span className="block text-sm">{activityEventLabel(x.activity)} · {x.ownerName} · {sharedStatus(x.status)}</span></Link>)}</section>;
}
export function SharedReputationPanel({userId}:{userId:string}){
 const result=useResult<SharedReputation[]>('reputation',userId,{userId});
 if(result.error)return <button className={button} onClick={result.reload}>Birlikte deneyim puanları yüklenemedi · Yeniden dene</button>;
 if(!result.data?.length)return null;
 return <section className={box}><h3 className="font-bold">Birlikte deneyim puanları</h3><p className="text-sm text-gray-600">Onaylanmış ortak deneyimlerden. Her kişinin aynı aktivitede verdiği puanların ortalaması eşit ağırlıktadır.</p>{result.data.map(x=><div key={x.activityId} className="rounded-xl bg-emerald-50 p-3"><strong>{activityEventLabel(x.activity)} · {x.score}/10</strong><p className="text-sm">{x.people} kişi · {x.experiences} ortak deneyim</p>{x.badge?<span className="text-sm font-bold text-emerald-700">{x.badge}</span>:null}</div>)}</section>;
}
export function SharedExperienceView({id}:{id:string}){
 const router=useRouter();const {data,error,reload}=useResult<SharedDetail>('detail',id,{id});
 const [ownRating,setOwnRating]=useState(''),[ownNote,setOwnNote]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[scores,setScores]=useState<Record<string,string>>({});const lock=useRef(false),repeatKey=useRef<string|null>(null);
 async function act(action:string,payload:Record<string,unknown>={}){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{const r=await sharedAction<{seedId?:string}>(supabase,action,{id,...payload});if(action==='repeat'&&r.seedId){repeatKey.current=null;router.push('/seeds/'+r.seedId+'?editExperience=1');}else reload();}catch(e){setMessage(e instanceof Error?e.message:'İşlem tamamlanamadı.')}finally{lock.current=false;setBusy(false)}}
 if(error)return <section className={box}><p role="alert">{error}</p><button className={button} onClick={reload}>Yeniden dene</button></section>;
 if(!data)return <p role="status">Ortak deneyim yükleniyor…</p>;
 return <section className={box}><Link href="/notifications" className={button}>‹ Gelen kutusu</Link><h1 className="text-2xl font-black">{data.title}</h1><p>{activityEventLabel(data.activity)}{data.date?' · '+new Intl.DateTimeFormat('tr-TR').format(new Date(data.date+'T12:00:00')):data.year?' · '+data.year:''}</p>
 <p className="text-sm text-gray-600">{sharedStatus(data.status)} · Herkes kendi deneyim puanını, yorumunu ve fotoğraflarını ekler.</p>
 {data.status==='pending'?<div className="space-y-3"><p>{data.ownerName} {data.context?.reported??('“'+data.title+'” deneyimini yaşadığını')} kaydetti{data.ownerRating?' ve '+data.ownerRating+'/10 deneyim puanı verdi':''}. Seninle birlikte olduğunu belirtti.</p><label className="block font-bold">Senin deneyim puanın<select aria-label="Kendi deneyim puanın" value={ownRating} onChange={e=>setOwnRating(e.target.value)} className="ml-3 min-h-11 rounded-xl border p-2"><option value="">Puan seç</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select></label><textarea aria-label="Kendi deneyim notun" value={ownNote} onChange={e=>setOwnNote(e.target.value)} placeholder="Deneyim notun (isteğe bağlı)" className="w-full rounded-xl border p-3"/><button disabled={busy||!ownRating} className={button+' bg-emerald-100'} onClick={()=>void act('respond',{accept:true,rating:Number(ownRating),note:ownNote})}>Onayla · Kendi deneyimimi kaydet</button><button disabled={busy} className={button} onClick={()=>void act('respond',{accept:false})}>Birlikte değildik</button></div>:null}
 {data.status==='accepted'&&data.seedId?<Link className={button} href={'/seeds/'+data.seedId+'?editExperience=1'}>Kendi puanını, yorumunu ve fotoğraflarını ekle</Link>:null}
 <h2 className="font-bold">Bu deneyimdeki arkadaşların</h2><p className="text-sm text-gray-600">{data.context?.peerRole??'Deneyim arkadaşı'} olarak değerlendir. Arkadaş puanı, bu kart için verdiğin deneyim puanından ayrıdır. Gönderildikten sonra değiştirilemez. İki taraf puanlayınca veya onaydan 7 gün sonra ortalamaya katılır.</p>
 {data.members.map(person=><div key={person.id} className="rounded-xl bg-gray-50 p-3 space-y-2"><strong>{person.name}{person.isMe?' · Sen':''}</strong><p className="text-sm">{sharedStatus(person.status)}{person.myScore!==null?' · Verdiğin puan: '+person.myScore+'/10':''}</p>{person.canRate?<div className="flex gap-2"><select aria-label={person.name+' · '+(data.context?.peerRole??'Deneyim arkadaşı')+' için puanın'} value={scores[person.id]??''} onChange={e=>setScores(s=>({...s,[person.id]:e.target.value}))} className="min-h-11 rounded-xl border p-2"><option value="">Puan seç</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}/10</option>)}</select><button disabled={busy||!scores[person.id]} className={button} onClick={()=>void act('rate',{targetId:person.id,score:Number(scores[person.id])})}>Puanı gönder</button></div>:null}</div>)}
 {data.status==='accepted'?<button disabled={busy} className={button} onClick={()=>{repeatKey.current??=crypto.randomUUID();void act('repeat',{requestId:repeatKey.current})}}>Aynı konuda başka bir deneyim ekle</button>:null}
 {data.status==='accepted'&&!data.isOwner?<button disabled={busy} className={button} onClick={()=>{if(window.confirm('Birlikte katılım onayını geri çekmek istiyor musun? Kendi deneyim kaydın korunur.'))void act('respond',{accept:false})}}>Birlikte katılım onayımı geri çek</button>:null}
 {message?<p role="alert" className="text-red-700">{message}</p>:null}</section>;
}
