"use client";
import {useLibraryAudience} from '@/utils/libraryAudience';
import {useEffect, useRef, useState, type ComponentProps, type ReactNode} from 'react';
import {useCardDeckAccount} from '@/utils/cardDeckAccount';
import type {Detail} from '@/components/ideas/TopicCardModal';
import DiscoverIntentCard from '@/components/discover/DiscoverIntentCard';
import TogetherProposal from '@/components/seeds/TogetherProposal';
import {deckPosition, deckSwipe, nearestEvents, reviewPreview, cardDate, newestReviews} from '@/utils/cardDeck';

type Props = ComponentProps<'article'> & {initialPlans?: boolean; personalPlanCount?: number; targetId: string; coverUrl: string | null; coverPositionY?: number; wanting: string; doers: string; wantAction: ReactNode; doneAction: ReactNode; children: ReactNode};
export default function LibraryCardDeck({targetId, coverUrl, coverPositionY=50, wanting, doers, wantAction, doneAction, children, initialPlans=false, personalPlanCount=0, ...props}: Props) {
  const account=useCardDeckAccount();const audience=useLibraryAudience();
  return <Deck key={`${targetId}:${account??'guest'}:${initialPlans}:${audience?.audience}:${audience?.section}`} initialPlans={initialPlans} personalPlanCount={personalPlanCount} {...props} targetId={targetId} coverUrl={coverUrl} coverPositionY={coverPositionY} wanting={wanting} doers={doers} wantAction={wantAction} doneAction={doneAction} account={account}>{children}</Deck>;
}
function Deck({targetId, coverUrl, coverPositionY=50, wanting, doers, wantAction, doneAction, children, account, initialPlans=false, personalPlanCount=0, ...props}: Props & {account: string|null|undefined}) {
  const audience=useLibraryAudience();const initialPosition=audience?.section==='experiences'?-2:initialPlans?1:0;
  const [position,setPosition]=useState(initialPosition), [data,setData]=useState<Detail|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const [height,setHeight]=useState(0), article=useRef<HTMLElement>(null);
  const requestedPlan=useRef(false), generation=useRef(0), start=useRef<{x:number;y:number;id:number}|null>(null), suppressClick=useRef(0);
  useEffect(() => {
    if(position!==0||!article.current)return;
    const measure=()=>setHeight(article.current?.getBoundingClientRect().height??0);
    measure();const observer=new ResizeObserver(measure);observer.observe(article.current);
    return ()=>observer.disconnect();
  }, [position,targetId]);
  useEffect(() => {generation.current++; setPosition(initialPosition); setData(null); setError(''); return () => {generation.current++;};}, [targetId,account,initialPosition]);
  useEffect(() => {
    if(position===0||data||error||account===undefined)return;
    const version=++generation.current, controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    void fetch(`/api/ideas/${encodeURIComponent(targetId)}`,{cache:'no-store',signal:controller.signal}).then(async response => {
      const body=await response.json() as Detail & {error?:string};
      if(!response.ok)throw Error(body.error||'Liste yüklenemedi.');
      if(!Array.isArray(body.people)||!Array.isArray(body.reviews)||!Array.isArray(body.events))throw Error('Liste yanıtı eksik.');
      if((body.viewerId??null)!==account)throw Error('Oturum değişti. Listeyi yeniden yükle.');
      if(version===generation.current){setData(body);if(requestedPlan.current){requestedPlan.current=false;const sorted=nearestEvents(body.events.filter(activeEvent),event=>event.start_date,event=>event.intent_id);const index=sorted.findIndex(event=>event.viewer_is_owner||event.viewer_is_member||event.owner_user_id===account||event.card_payload?.owner_user_id===account||event.card_payload?.viewer_is_member);setPosition(index<0?0:index+1);}}
    }).catch(problem => {if(version===generation.current)setError(problem instanceof Error && problem.name!=='AbortError'?problem.message:'Liste yüklenemedi. Yeniden deneyebilirsin.');})
      .finally(()=>clearTimeout(timer));
    return () => {clearTimeout(timer); if(version===generation.current)generation.current++; controller.abort();};
  }, [position===0,data,error,targetId,account,retry]);
  const allEvents=nearestEvents((data?.events??[]).filter(activeEvent),event=>event.start_date,event=>event.intent_id);
  const ownEvents=allEvents.filter(event=>Boolean(account)&&(event.viewer_is_owner||event.viewer_is_member||event.owner_user_id===account||event.card_payload?.owner_user_id===account||event.card_payload?.viewer_is_member));
  const membership=(scope:string)=>audience?.rows.find(row=>row.target_id===targetId&&row.scope===scope);
  const permits=(scope:string,id:string)=>!audience||audience.audience==='everyone'||(audience.audience==='me'?id===account:membership(scope)?.user_ids.includes(id)===true);
  const events=audience?.audience==='friends'?allEvents.filter(event=>membership('plans')?.event_ids.includes(event.plan_id||event.intent_id)):audience?.audience==='everyone'?allEvents:audience?.audience==='me'?ownEvents:initialPlans?ownEvents:allEvents;
  const reviews=(data?.reviews??[]).filter(review=>permits('experiences',review.user_id));
  const planCount=audience?.audience==='friends'?0:data?ownEvents.length:personalPlanCount;
  const openPlan=()=>{if(initialPlans||audience?.audience==='me'){setPosition(1);return;}if(data){const index=allEvents.findIndex(event=>ownEvents.includes(event));setPosition(index<0?0:index+1);}else{requestedPlan.current=true;setPosition(1);}};
  const current=events[Math.min(position-1,events.length-1)];
  const move=(direction:-1|1)=>setPosition(value=>deckPosition(value,direction,data?events.length:null));
  const eventCard=position>0&&current?.card_payload;
  return <article {...props} ref={article} style={{...props.style,touchAction:'pan-y'}} onPointerDown={event=>{
    if(event.pointerType==='mouse'||(event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]'))return;
    start.current={x:event.clientX,y:event.clientY,id:event.pointerId};
  }} onPointerUp={event=>{
    const origin=start.current;start.current=null;
    if(!origin||origin.id!==event.pointerId)return;
    const direction=deckSwipe(event.clientX-origin.x,event.clientY-origin.y);
    if(direction){suppressClick.current=Date.now()+400;move(direction);}
  }} onPointerCancel={()=>{start.current=null;}} onClickCapture={event=>{if(Date.now()<suppressClick.current){event.preventDefault();event.stopPropagation();}}}>
    {position===0?<>{children}{planCount>0?<button type="button" onClick={event=>{event.stopPropagation();openPlan();}} className="absolute left-3 top-14 z-20 rounded-full bg-slate-950/70 px-2 py-1 text-xs font-semibold text-emerald-100">{planCount} planın var</button>:null}</>:eventCard&&!error?<div style={{height:height||430}} className="uin-deck-event relative w-full [&>article]:h-full [&>article]:border-0 [&>article]:shadow-none"><DiscoverIntentCard key={current.intent_id} intent={eventCard} currentUserId={data?.viewerId??''} isAuthenticated={Boolean(data?.viewerId)}/></div>:<>
      {position<0&&coverUrl?<img src={coverUrl} alt="" style={{objectPosition:`50% ${coverPositionY}%`}} className="pointer-events-none absolute inset-0 h-full w-full object-cover"/>:null}
      <div style={{height:height||430}} className="uin-deck-face relative flex min-h-0 flex-col gap-3 bg-slate-950/80 px-9 py-5 text-white">
        {position<0?<h3 className="text-base font-black">{position===-1?wanting:doers}</h3>:null}
        {position===-2&&data?<p className="text-sm font-bold text-amber-200">UIN ★ {data.social?.average_rating==null||!data.social.rating_count?'Henüz puan yok':`${data.social.average_rating.toFixed(1)}/10 · ${data.social.rating_count}`}</p>:null}
        {error?<div role="alert" className="text-sm">{error}<button type="button" onClick={()=>{setData(null);setError('');setRetry(value=>value+1);}} className="mt-3 block rounded-xl bg-emerald-600 px-4 py-3 font-bold">Yeniden dene</button></div>:!data?<p role="status" className="py-10 text-center text-sm">Yükleniyor…</p>:position>0?<p className="py-10 text-center text-sm">{events.length?'Etkinlik kartı yüklenemedi.':initialPlans?'Aktif planın yok.':'Aktif etkinlik yok.'}</p>:<div className="min-h-0 max-h-[360px] flex-1 space-y-2 overflow-y-auto overscroll-contain">
          {position===-1?data.people.filter(person=>person.is_current!==false&&permits('wishes',person.user_id)).length?data.people.filter(person=>person.is_current!==false&&permits('wishes',person.user_id)).map(person=><div key={person.id} className="uin-deck-people-row space-y-1 rounded-xl bg-white/10 p-2">
            <div className="flex items-center justify-between gap-2"><Person name={person.full_name} avatar={person.avatar_url} username={person.username} userId={person.user_id} date={cardDate(person.start_date,person.end_date,person.timing_precision,person.date_options)}/>
            {data.viewerId&&person.user_id!==data.viewerId&&person.source_kind!=='social'&&person.together_allowed&&!person.shared_event?<div className="uin-deck-proposal shrink-0 text-slate-900"><TogetherProposal targetId={person.source_target_id||targetId} recipientId={person.user_id} name={person.full_name} title={data.card.title} activityOptions={data.activityOptions??[]} initialPlace={person.location}/></div>:person.shared_event?<a href={`/activities/${encodeURIComponent(person.shared_event.resource_id||person.shared_event.plan_id||person.shared_event.intent_id)}`} className="text-xs text-emerald-200">✓ Aynı etkinliktesiniz</a>:null}</div>{person.notes?<p className="text-xs">{person.notes}</p>:null}
          </div>):<p className="text-sm">Henüz isteyen yok.</p>:reviews.length?newestReviews(reviews,review=>review.experience_date||(review.experience_year?String(review.experience_year):null)).map(review=><div key={review.seed_id} className="space-y-2 rounded-xl bg-white/10 p-3">
            <Person name={review.full_name} avatar={review.avatar_url} username={review.username} userId={review.user_id} date={cardDate(review.experience_date||(review.experience_year?String(review.experience_year):null))}/>
            {review.rating!=null?<p className="text-xs font-bold text-amber-200">★ {review.rating}/10</p>:null}
            {review.body?<Review body={review.body}/>:null}
          </div>):<p className="text-sm">Henüz deneyim ekleyen yok.</p>}
        </div>}
        {position===-1?<div className="mt-auto">{wantAction}</div>:position===-2?<div className="mt-auto">{doneAction}</div>:null}
      </div>
    </>}
    {([-1,1] as const).map(direction=><button key={direction} type="button" aria-label={direction===-1?'Sola geç':'Sağa geç'} disabled={direction===-1?position<=-2:Boolean(data)&&position>=Math.max(1,events.length)} onClick={event=>{event.stopPropagation();move(direction);}} className={`absolute top-[42%] z-30 grid h-11 w-6 place-items-center rounded-full bg-slate-950/15 text-2xl font-semibold text-white/80 transition hover:bg-slate-950/35 disabled:opacity-30 ${direction===-1?'left-1':'right-1'}`}>{direction===-1?'‹':'›'}</button>)}
  </article>;
}
function activeEvent(event:Detail['events'][number]) {
  const state=event.card_payload?.lifecycle_status||event.plan_status||event.status;
  if(['completed','expired','cancelled','canceled'].includes(state||''))return false;
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
  return Boolean(event.card_payload)||(event.end_date||event.start_date||'').slice(0,10)>=today;
}
function Person({name,avatar,username,userId,date}:{name:string;avatar:string|null;username:string|null;userId:string;date?:string}) {
  return <a href={username?`/u/${encodeURIComponent(username)}`:`/people/${encodeURIComponent(userId)}`} className="uin-deck-person flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
    {avatar?<img src={avatar} alt="" className="h-6 w-6 rounded-full object-cover"/>:<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-900">{name.charAt(0)}</span>}<span className="min-w-0"><span>{name}</span>{date?<span className="ml-1 font-normal text-white/65">· {date}</span>:null}</span>
  </a>;
}
function Review({body}:{body:string}) {
  const [expanded,setExpanded]=useState(false),preview=reviewPreview(body);
  return <div><p className={`whitespace-pre-wrap text-xs leading-5 ${expanded?'':'line-clamp-3'}`}>{expanded?body:preview}</p>{preview!==body.trim()||body.length>120?<button type="button" aria-label={expanded?'Yorumu kısalt':'Yorumun tamamını oku'} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className="grid min-h-11 w-11 place-items-center text-lg text-emerald-200">{expanded?'⌃':'⌄'}</button>:null}</div>;
}
