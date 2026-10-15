"use client";
import {useLibraryAudience} from '@/utils/libraryAudience';
import {useEffect, useRef, useState, type ComponentProps, type ReactNode} from 'react';
import {useCardDeckAccount} from '@/utils/cardDeckAccount';
import type {Detail} from '@/components/ideas/TopicCardModal';
import DiscoverIntentCard from '@/components/discover/DiscoverIntentCard';
import TogetherProposal from '@/components/seeds/TogetherProposal';
import {deckPosition, deckSwipe, nearestEvents, reviewPreview, cardDate, newestReviews, cardEventPhase, unresolvedCardEvents, selectedCardEvent, adjacentCardEvent} from '@/utils/cardDeck';

type Props = Omit<ComponentProps<'article'>,'children'> & {initialPlans?: boolean; personalPlanCount?: number; title?: string; targetId: string; coverUrl: string | null; coverPositionY?: number; wanting: string; doers: string; children: ReactNode | ((navigate:(face:number)=>void,eventCount?:number)=>ReactNode); actions?: {editWish:()=>void;cancelWish:()=>void;editExperience:()=>void;createEvent:()=>void;wantLabel:string;doneLabel:string}};
export default function LibraryCardDeck({targetId, coverUrl, coverPositionY=50, wanting, doers, actions, children, initialPlans=false, personalPlanCount=0, ...props}: Props) {
  const account=useCardDeckAccount();const audience=useLibraryAudience();
  return <Deck key={`${targetId}:${account??'guest'}:${initialPlans}:${audience?.audience}:${audience?.section}`} initialPlans={initialPlans} personalPlanCount={personalPlanCount} {...props} targetId={targetId} coverUrl={coverUrl} coverPositionY={coverPositionY} wanting={wanting} doers={doers} actions={actions} account={account}>{children}</Deck>;
}
function Deck({title, targetId, coverUrl, coverPositionY=50, wanting, doers, actions, children, account, initialPlans=false, personalPlanCount=0, ...props}: Props & {account: string|null|undefined}) {
  const audience=useLibraryAudience();const initialPosition=audience?.section==='experiences'?-2:initialPlans?1:0;
  const [position,setPosition]=useState(initialPosition), [data,setData]=useState<Detail|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const article=useRef<HTMLElement>(null), back=useRef<HTMLButtonElement>(null), mounted=useRef(false);
  const generation=useRef(0), start=useRef<{x:number;y:number;id:number}|null>(null), suppressClick=useRef(0);
  const navigate=(face:number)=>{setSelectedId(null);setPosition(face);};
  const select=(id:string|null)=>{setSelectedId(id);};
  useEffect(()=>{if(!mounted.current){mounted.current=true;return;}(position===0?article.current?.querySelector<HTMLButtonElement>('[aria-label$="Listeyi gör"]'):back.current)?.focus({preventScroll:true});},[position,selectedId]);
  const needsCommunity=position!==0;
  useEffect(() => {
    if(!needsCommunity||data||error||account===undefined)return;
    const version=++generation.current, controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    void fetch(`/api/ideas/${encodeURIComponent(targetId)}`,{cache:'no-store',signal:controller.signal}).then(async response => {
      const body=await response.json() as Detail & {error?:string};
      if(!response.ok)throw Error(body.error||'Liste yüklenemedi.');
      if(!Array.isArray(body.people)||!Array.isArray(body.reviews)||!Array.isArray(body.events))throw Error('Liste yanıtı eksik.');
      if((body.viewerId??null)!==account)throw Error('Oturum değişti. Listeyi yeniden yükle.');
      if(version===generation.current)setData(body);
    }).catch(problem => {if(version===generation.current)setError(problem instanceof Error && problem.name!=='AbortError'?problem.message:'Liste yüklenemedi. Yeniden deneyebilirsin.');})
      .finally(()=>clearTimeout(timer));
    return () => {clearTimeout(timer); if(version===generation.current)generation.current++; controller.abort();};
  }, [needsCommunity,data,error,targetId,account,retry]);
  const allEvents=nearestEvents(unresolvedCardEvents(data?.events??[],eventId,eventPhase),event=>event.start_date,event=>event.intent_id).sort((a,b)=>Number(eventPhase(a)==='past')-Number(eventPhase(b)==='past'));
  const ownEvents=allEvents.filter(event=>Boolean(account)&&(event.viewer_is_owner||event.viewer_is_member||event.owner_user_id===account||event.card_payload?.owner_user_id===account||event.card_payload?.viewer_is_member));
  const membership=(scope:string)=>audience?.rows.find(row=>row.target_id===targetId&&row.scope===scope);
  const permits=(scope:string,id:string)=>id===account||!audience||audience.audience==='everyone'||(audience.audience==='me'?id===account:membership(scope)?.user_ids.includes(id)===true);
  const events=audience?.audience==='friends'?allEvents.filter(event=>membership('plans')?.event_ids.includes(event.plan_id||event.intent_id)):audience?.audience==='everyone'?allEvents:audience?.audience==='me'?ownEvents:initialPlans?ownEvents:allEvents;
  const reviews=(data?.reviews??[]).filter(review=>permits('experiences',review.user_id));
  const people=(data?.people??[]).filter(person=>person.is_current!==false&&permits('wishes',person.user_id)).sort((a,b)=>Number(b.user_id===account)-Number(a.user_id===account));
  const scopedCount=audience&&audience.audience!=='everyone'?(membership('plans')?.event_ids.length??0):initialPlans&&!audience?personalPlanCount:undefined;
  const planCount=audience?.audience==='friends'?0:data?ownEvents.length:personalPlanCount;
  const openPlan=()=>navigate(1);
  const {event:current,index:currentIndex}=selectedCardEvent(events,selectedId,eventId);
  if(data&&selectedId&&!current)setSelectedId(null);
  const move=(direction:-1|1)=>{if(position===1&&current){select(adjacentCardEvent(events,selectedId,direction,eventId));return;}if(position===1)return;setPosition(value=>deckPosition(value,direction,1));};
  const eventCard=position===1&&current?.card_payload;
  const cardTitle=title||data?.card.title||'Kart';
  return <article {...props} ref={article} style={{...props.style,touchAction:'pan-y'}} onPointerDown={event=>{
    if(event.pointerType==='mouse'||(event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]'))return;
    start.current={x:event.clientX,y:event.clientY,id:event.pointerId};
  }} onPointerUp={event=>{
    const origin=start.current;start.current=null;
    if(!origin||origin.id!==event.pointerId)return;
    const direction=deckSwipe(event.clientX-origin.x,event.clientY-origin.y);
    if(direction){suppressClick.current=event.timeStamp+400;move(direction);}
  }} onPointerCancel={()=>{start.current=null;}} onClickCapture={event=>{if(event.timeStamp<suppressClick.current){event.preventDefault();event.stopPropagation();}}}>
    <div className="uin-deck-main" aria-hidden={position!==0} inert={position!==0} style={{visibility:position===0?'visible':'hidden',display:'flex',flexDirection:'column',flex:1}}>
      {typeof children==='function'?children(navigate,data?events.length:scopedCount):children}
      {planCount>0?<button type="button" onClick={event=>{event.stopPropagation();openPlan();}} className="absolute left-3 top-14 z-20 rounded-full bg-slate-950/70 px-2 py-1 text-xs font-semibold text-emerald-100">{planCount} planın var</button>:null}
    </div>
    {position!==0?<div className="uin-deck-overlay" onClick={event=>event.stopPropagation()}>
      {coverUrl?<img src={coverUrl} alt="" style={{objectPosition:`50% ${coverPositionY}%`}} className="pointer-events-none absolute inset-0 h-full w-full object-cover"/>:null}
      <div className="uin-deck-face absolute inset-0 flex min-h-0 flex-col gap-3 bg-slate-950/80 px-4 py-3 text-white">
        <div className="uin-deck-navigation"><button ref={back} type="button" onClick={()=>current?select(null):navigate(0)}>{current?'‹ Listeye dön':`‹ ${cardTitle} kartına dön`}</button>{current?<span aria-live="polite">{currentIndex+1} / {events.length}</span>:null}</div>
        {position===1?<div className="flex items-center gap-2"><h3 className="flex-1 text-sm font-bold">{cardTitle} · Etkinlikler ({data?events.length:'…'})</h3>{data&&!current?<button type="button" aria-label="Etkinlik listesini yenile" className="min-h-11 min-w-11 rounded-lg focus-visible:outline focus-visible:outline-emerald-300" onClick={()=>{setData(null);setError('');setRetry(value=>value+1);}}>↻</button>:null}</div>:null}
        {position<0?<h3 className="text-base font-black">{position===-1?wanting:doers}</h3>:null}
        {position===-2&&data?<p className="text-sm font-bold text-amber-200">UIN ★ {data.social?.average_rating==null||!data.social.rating_count?'Henüz puan yok':`${data.social.average_rating.toFixed(1)}/10 · ${data.social.rating_count}`}</p>:null}
        {error?<div role="alert" className="text-sm">{error}<button type="button" onClick={()=>{setData(null);setError('');setRetry(value=>value+1);}} className="mt-3 block rounded-xl bg-emerald-600 px-4 py-3 font-bold">Yeniden dene</button></div>:!data?<p role="status" className="py-10 text-center text-sm">Yükleniyor…</p>:position===1?<>
          <div className="uin-deck-event-scroll">
            {current?eventCard?<DiscoverIntentCard intent={eventCard} embedded currentUserId={data.viewerId??''} isAuthenticated={Boolean(data.viewerId)}/>:<p role="alert">Etkinlik ayrıntıları yüklenemedi. Listeye dönüp yeniden deneyebilirsin.</p>:events.length?(['active','past'] as const).map(phase=>{
              const group=events.filter(event=>eventPhase(event)===phase);
              return group.length?<section key={phase}><h4 className="my-2 text-xs font-bold text-emerald-100">{phase==='past'?'Tarihi geçti · Sonuçlandırılmadı':'Yaklaşan / devam eden'}</h4><div className="space-y-2">{group.map(event=><button type="button" key={eventId(event)} className="uin-deck-event-row" onClick={()=>select(eventId(event))}>
                <strong>{eventTitle(event)}</strong><span>{cardDate(event.card_payload?.scheduled_start||event.start_date,event.card_payload?.scheduled_end||event.end_date)}</span><span>{eventLabel(event)}</span><span className="text-emerald-200">Görüntüle ›</span>
              </button>)}</div></section>:null;
            }):<p className="py-5 text-sm">Henüz etkinlik yok. İlk buluşmayı sen başlatabilirsin 🌿</p>}
          </div>
          {current?<><p className="text-xs text-emerald-100">{eventLabel(current)}</p>{events.length>1?<div className="uin-deck-navigation"><button type="button" disabled={currentIndex===0} onClick={()=>move(-1)}>‹ Önceki etkinlik</button><button type="button" disabled={currentIndex===events.length-1} onClick={()=>move(1)}>Sonraki etkinlik ›</button></div>:null}</>:null}
        </>:<div className="min-h-0 max-h-[360px] flex-1 space-y-2 overflow-y-auto overscroll-contain">
          {position===-1?people.length?people.map(person=><div key={person.id} className="uin-deck-people-row space-y-1 rounded-xl bg-white/10 p-2">
            <div className="flex items-center justify-between gap-2"><Person name={person.full_name} avatar={person.avatar_url} username={person.username} userId={person.user_id} date={cardDate(person.start_date,person.end_date,person.timing_precision,person.date_options)}/>
            {person.user_id===account&&actions?<div className="uin-deck-own-actions flex w-[108px] shrink-0 gap-0.5"><SmallAction label="Düzenle" onClick={actions.editWish}/><SmallAction label="İptal" onClick={actions.cancelWish} cancel/></div>:null}
            {data.viewerId&&person.user_id!==data.viewerId&&person.source_kind!=='social'&&person.together_allowed&&!person.shared_event?<div className="uin-deck-proposal shrink-0 text-slate-900"><TogetherProposal targetId={person.source_target_id||targetId} recipientId={person.user_id} name={person.full_name} title={data.card.title} activityOptions={data.activityOptions??[]} initialPlace={person.location}/></div>:person.shared_event?<a href={`/activities/${encodeURIComponent(person.shared_event.resource_id||person.shared_event.plan_id||person.shared_event.intent_id)}`} className="text-xs text-emerald-200">✓ Aynı etkinliktesiniz</a>:null}</div>{person.notes?<p className="text-xs">{person.notes}</p>:null}
          </div>):<p className="text-sm">Henüz isteyen yok.</p>:reviews.length?newestReviews(reviews,review=>review.experience_date||(review.experience_year?String(review.experience_year):null)).sort((a,b)=>Number(b.user_id===account)-Number(a.user_id===account)).map(review=><div key={review.seed_id} className="space-y-2 rounded-xl bg-white/10 p-3">
            <div className="flex items-center justify-between gap-2"><Person name={review.full_name} avatar={review.avatar_url} username={review.username} userId={review.user_id} date={cardDate(review.experience_date||(review.experience_year?String(review.experience_year):null))}/>{review.user_id===account&&actions?<SmallAction label="Deneyimimi düzenle" onClick={actions.editExperience}/>:null}</div>
            {review.rating!=null?<p className="text-xs font-bold text-amber-200">★ {review.rating}/10</p>:null}
            {review.body?<Review body={review.body}/>:null}
          </div>):<p className="text-sm">Henüz deneyim ekleyen yok.</p>}
        </div>}
        {data&&!error&&actions?<div className="mt-auto">{position===-1&&!people.some(person=>person.user_id===account)?<SmallAction label={"＋ "+actions.wantLabel} onClick={actions.editWish}/>:position===-2&&!reviews.some(review=>review.user_id===account)?<SmallAction label={"＋ "+actions.doneLabel} onClick={actions.editExperience}/>:position>0&&!events.length?<SmallAction label="＋ Etkinlik düzenle" onClick={actions.createEvent}/>:null}</div>:null}
      </div>
    </div>:null}
    {position<=0&&([-1,1] as const).map(direction=><button key={direction} type="button" aria-label={direction===-1?'Sola geç':'Sağa geç'} disabled={direction===-1?position<=-2:position>=1} onClick={event=>{event.stopPropagation();move(direction);}} className={`absolute top-[42%] z-30 grid h-11 w-6 place-items-center rounded-full bg-slate-950/15 text-2xl font-semibold text-white/80 transition hover:bg-slate-950/35 disabled:opacity-30 ${direction===-1?'left-1':'right-1'}`}>{direction===-1?'‹':'›'}</button>)}
  </article>;
}
function eventId(event:Detail['events'][number]) {return event.resource_id||event.plan_id||event.intent_id;}
function eventPhase(event:Detail['events'][number]) {return cardEventPhase([event.event_state,event.status,event.plan_status,event.card_payload?.lifecycle_status],event.card_payload?.scheduled_start||event.start_date,event.card_payload?.scheduled_end||event.end_date);}
function eventTitle(event:Detail['events'][number]) {const title=event.card_payload?.event_display_title||event.event_title||event.card_payload?.activity_name||'Etkinlik';const dna=event.card_payload?.event_dna_titles?.filter(value=>!title.includes(value));return dna?.length?`${title} · 🧬 ${dna.join(' / ')}`:title;}
function eventLabel(event:Detail['events'][number]) {if(eventPhase(event)==='past')return 'Tarihi geçti · Sonuçlandırılmadı';const status=event.card_payload?.lifecycle_status||event.plan_status||event.status;return status==='forming'?'Şekilleniyor':status==='open'?'Açık':'Planlanıyor';}
function SmallAction({label,onClick,cancel=false}:{label:string;onClick:()=>void;cancel?:boolean}){return <button type="button" onClick={onClick} className={`uin-deck-small-action min-h-8 max-w-[108px] shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white ${cancel?'bg-red-700':'bg-emerald-700'}`}>{label}</button>;}
function Person({name,avatar,username,userId,date}:{name:string;avatar:string|null;username:string|null;userId:string;date?:string}) {
  return <a href={username?`/u/${encodeURIComponent(username)}`:`/people/${encodeURIComponent(userId)}`} className="uin-deck-person flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
    {avatar?<img src={avatar} alt="" className="h-6 w-6 rounded-full object-cover"/>:<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-900">{name.charAt(0)}</span>}<span className="min-w-0"><span>{name}</span>{date?<span className="ml-1 font-normal text-white/65">· {date}</span>:null}</span>
  </a>;
}
function Review({body}:{body:string}) {
  const [expanded,setExpanded]=useState(false),preview=reviewPreview(body);
  return <div><p className={`whitespace-pre-wrap text-xs leading-5 ${expanded?'':'line-clamp-3'}`}>{expanded?body:preview}</p>{preview!==body.trim()||body.length>120?<button type="button" aria-label={expanded?'Yorumu kısalt':'Yorumun tamamını oku'} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className="grid min-h-11 w-11 place-items-center text-lg text-emerald-200">{expanded?'⌃':'⌄'}</button>:null}</div>;
}
