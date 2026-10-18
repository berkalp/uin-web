"use client";
import ActivityCoverImage from '@/components/media/ActivityCoverImage';
import {compactPersonName,experienceDate} from '@/utils/personalExperiences';
import ExperienceReviews from '@/components/seeds/ExperienceReviews';
import {useLibraryAudience} from '@/utils/libraryAudience';
import {useEffect, useRef, useState, type ComponentProps, type ReactNode} from 'react';
import {useCardDeckAccount} from '@/utils/cardDeckAccount';
import type {Detail} from '@/components/ideas/TopicCardModal';
import DiscoverIntentCard from '@/components/discover/DiscoverIntentCard';
import TogetherProposal from '@/components/seeds/TogetherProposal';
import {deckPosition, deckSwipe, cardDeckEvents, currentCardEvent, cardDate, cardEventPhase, adjacentCardEvent, preferPlannedCardEvents, partitionCardEvents} from '@/utils/cardDeck';

type Props = Omit<ComponentProps<'article'>,'children'> & {cardType?: string; initialPlans?: boolean; personalPlanCount?: number; title?: string; targetId: string; coverUrl: string | null; coverPositionY?: number; wanting: string; doers: string; children: ReactNode | ((navigate:(face:number)=>void,eventCount?:number,navigation?:ReactNode)=>ReactNode); actions?: {editWish:()=>void;cancelWish:()=>void;editExperience:()=>void;createEvent:()=>void;wantLabel:string;doneLabel:string}};
export default function LibraryCardDeck({targetId, coverUrl, coverPositionY=50, wanting, doers, actions, children, initialPlans=false, personalPlanCount=0, ...props}: Props) {
  const account=useCardDeckAccount();const audience=useLibraryAudience();
  return <Deck key={`${targetId}:${account??'guest'}:${initialPlans}:${audience?.audience}:${audience?.section}`} initialPlans={initialPlans} personalPlanCount={personalPlanCount} {...props} targetId={targetId} coverUrl={coverUrl} coverPositionY={coverPositionY} wanting={wanting} doers={doers} actions={actions} account={account}>{children}</Deck>;
}
function Deck({cardType, title, targetId, coverUrl, coverPositionY=50, wanting, doers, actions, children, account, initialPlans=false, personalPlanCount=0, ...props}: Props & {account: string|null|undefined}) {
  const audience=useLibraryAudience();const initialPosition=audience?.section==='experiences'?-2:initialPlans?1:0;
  const [position,setPosition]=useState(initialPosition), [data,setData]=useState<Detail|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showHistory,setShowHistory]=useState(false);
  const [requiredHeight,setRequiredHeight]=useState(0);
  const article=useRef<HTMLElement>(null), back=useRef<HTMLButtonElement>(null), mounted=useRef(false);
  const generation=useRef(0), start=useRef<{x:number;y:number;id:number}|null>(null), suppressClick=useRef(0);
  const navigate=(face:number)=>{setShowHistory(false);setSelectedId(null);setPosition(face);};
  const toggleHistory=()=>{setSelectedId(null);setShowHistory(value=>!value);};
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
  const allEvents=cardDeckEvents(data?.events??[],eventId,eventPhase,event=>event.card_payload?.scheduled_start||event.start_date);
  const ownEvents=allEvents.filter(event=>Boolean(account)&&(event.viewer_is_owner||event.viewer_is_member||event.owner_user_id===account||event.card_payload?.owner_user_id===account||event.card_payload?.viewer_is_member));
  const membership=(scope:string)=>audience?.rows.find(row=>row.target_id===targetId&&row.scope===scope);
  const permits=(scope:string,id:string)=>id===account||!audience||audience.audience==='everyone'||(audience.audience==='me'?id===account:membership(scope)?.user_ids.includes(id)===true);
  const scopedEvents=audience?.audience==='friends'?allEvents.filter(event=>membership('plans')?.event_ids.includes(event.plan_id||event.intent_id)):audience?.audience==='everyone'?allEvents:audience?.audience==='me'?ownEvents:initialPlans?ownEvents:allEvents;
  const {active:activeEvents,history:historyEvents}=partitionCardEvents(preferPlannedCardEvents(scopedEvents,eventDisplay),eventPhase);
  const events=showHistory?historyEvents:activeEvents;
  const reviews=(data?.reviews??[]).filter(review=>permits('experiences',review.user_id));
  const people=(data?.people??[]).filter(person=>person.is_current!==false&&permits('wishes',person.user_id)).sort((a,b)=>Number(b.user_id===account)-Number(a.user_id===account));
  const scopedCount=audience&&audience.audience!=='everyone'?(membership('plans')?.event_ids.length??0):initialPlans&&!audience?personalPlanCount:undefined;
  const planCount=audience?.audience==='friends'?0:data?preferPlannedCardEvents(ownEvents.filter(event=>eventPhase(event)==='active'),eventDisplay).length:personalPlanCount;
  const openPlan=()=>navigate(1);
  const {event:current,index:currentIndex}=currentCardEvent(events,selectedId,eventId);
  const eventScroll=useRef<HTMLDivElement>(null);
  if(position===1&&data&&selectedId!==(current?eventId(current):null))setSelectedId(current?eventId(current):null);
  useEffect(()=>{if(eventScroll.current)eventScroll.current.scrollTop=0;},[position,current?.intent_id]);
  // Reserve enough space for the full event and the single navigation row.
  // Keep the largest measured height when changing faces, avoiding shrink/jump cycles.
  useEffect(()=>{
    const scroll=eventScroll.current,root=article.current;
    if(position!==1||!scroll||!root)return;
    const resize=new ResizeObserver(()=>{
      const needed=Math.ceil(scroll.scrollHeight+(root.querySelector('.uin-deck-dock')?.getBoundingClientRect().height??52)+2);
      if(needed>root.getBoundingClientRect().height+1)setRequiredHeight(value=>Math.max(value,needed));
    });
    resize.observe(scroll);if(scroll.firstElementChild)resize.observe(scroll.firstElementChild);
    return ()=>resize.disconnect();
  },[position,current?.intent_id,data]);
  const move=(direction:-1|1)=>{if(position===1){if(direction===-1&&currentIndex<=0){navigate(0);return;}if(current)select(adjacentCardEvent(events,eventId(current),direction,eventId));return;}setPosition(value=>deckPosition(value,direction,1));};
  const eventCard=position===1&&current?.card_payload;
  const cardTitle=title||data?.card.title||'Kart';
  const navigation=([-1,1] as const).map(direction=><button key={direction} type="button" aria-label={direction===-1?'Sola geç':'Sağa geç'} disabled={direction===-1?position<=-2:position>=1} onClick={event=>{event.stopPropagation();move(direction);}} className={`relative z-30 grid h-11 w-8 place-items-center rounded-full bg-slate-950/15 text-2xl font-semibold text-white/80 transition hover:bg-slate-950/35 disabled:opacity-30 `}>{direction===-1?'‹':'›'}</button>);
  return <article {...props} ref={article} style={{...props.style,...(requiredHeight?{minHeight:requiredHeight}:{}),touchAction:'pan-y'}} onPointerDown={event=>{
    if(event.pointerType==='mouse'||(event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]'))return;
    start.current={x:event.clientX,y:event.clientY,id:event.pointerId};
  }} onPointerUp={event=>{
    const origin=start.current;start.current=null;
    if(!origin||origin.id!==event.pointerId)return;
    const direction=deckSwipe(event.clientX-origin.x,event.clientY-origin.y);
    if(direction){suppressClick.current=event.timeStamp+400;move(direction);}
  }} onPointerCancel={()=>{start.current=null;}} onClickCapture={event=>{if(event.timeStamp<suppressClick.current){event.preventDefault();event.stopPropagation();}}}>
    <div className="uin-deck-main" aria-hidden={position!==0} inert={position!==0} style={{visibility:position===0?'visible':'hidden',display:'flex',flexDirection:'column',flex:1}}>
      {typeof children==='function'?children(navigate,data?activeEvents.length:scopedCount,navigation):children}
      {planCount>0?<button type="button" onClick={event=>{event.stopPropagation();openPlan();}} className="absolute left-3 top-14 z-20 rounded-full bg-slate-950/70 px-2 py-1 text-xs font-semibold text-emerald-100">{planCount} planın var</button>:null}
    </div>
    {position!==0?<div className="uin-deck-overlay" onClick={event=>event.stopPropagation()}>
      {coverUrl?<ActivityCoverImage cardType={cardType} activityName={title} src={coverUrl} alt="" style={{objectPosition:`50% ${coverPositionY}%`}} className="pointer-events-none absolute inset-0 h-full w-full object-cover"/>:null}
      <div className={`uin-deck-face absolute inset-0 flex min-h-0 flex-col gap-3 bg-slate-950/80 px-4 py-3 text-white ${position===1?'uin-deck-event-face':''}`}>
        {position<0?<h3 className="text-base font-black">{position===-1?wanting:doers}</h3>:null}
        {position===-2&&data?<p className="text-sm font-bold text-amber-200">UIN ★ {data.social?.average_rating==null||!data.social.rating_count?'Henüz puan yok':`${data.social.average_rating.toFixed(1)}/10 · ${data.social.rating_count}`}</p>:null}
        {error?<div role="alert" className="text-sm">{error}<button type="button" onClick={()=>{setData(null);setError('');setRetry(value=>value+1);}} className="mt-3 block rounded-xl bg-emerald-600 px-4 py-3 font-bold">Yeniden dene</button></div>:!data?<p role="status" className="py-10 text-center text-sm">Yükleniyor…</p>:position===1?<>
          <div ref={eventScroll} className="uin-deck-event-scroll" style={{touchAction:'pan-y'}}>
            {current?eventCard?<DiscoverIntentCard key={eventId(current)} intent={eventCard} embedded historyLabel={eventPhase(current)==='past'?'Tarihi geçti · Sonuçlandırılmadı':eventPhase(current)==='cancelled'?'İptal edildi':undefined} currentUserId={data.viewerId??''} isAuthenticated={Boolean(data.viewerId)}/>:<p role="alert" className="p-4">Etkinlik ayrıntıları yüklenemedi.</p>:<div className="uin-deck-event-empty"><div><h3>{showHistory?'Geçmiş etkinlik yok':'Yaklaşan etkinlik yok'}</h3><p>{showHistory?'Geçmiş veya iptal edilmiş etkinlik bulunmuyor.':`${cardTitle} için yeni bir etkinlik oluşturabilirsin.`}</p>{!showHistory&&actions?<button type="button" aria-label={`${cardTitle} için etkinlik oluştur`} onClick={actions.createEvent}>＋ Etkinlik oluştur</button>:null}</div></div>}
          </div>
        </>:<div style={{touchAction:'pan-y'}} className="min-h-0 max-h-[360px] flex-1 space-y-2 overflow-y-auto overscroll-contain">
          {position===-1?people.length?people.map(person=><div key={person.id} className="uin-deck-people-row space-y-1 rounded-xl bg-white/10 p-2">
            <div className="flex items-center justify-between gap-2"><Person name={person.full_name} avatar={person.avatar_url} username={person.username} userId={person.user_id} date={cardDate(person.start_date,person.end_date,person.timing_precision,person.date_options)}/>
            {person.user_id===account&&actions?<div className="uin-deck-own-actions flex w-[90px] shrink-0 gap-0.5"><SmallAction label="Düzenle" onClick={actions.editWish}/><SmallAction label="İptal" onClick={actions.cancelWish} cancel/></div>:null}
            {data.viewerId&&person.user_id!==data.viewerId&&person.source_kind!=='social'&&person.together_allowed&&!person.shared_event?<div className="uin-deck-proposal shrink-0 text-slate-900"><TogetherProposal targetId={person.source_target_id||targetId} recipientId={person.user_id} name={person.full_name} title={data.card.title} activityOptions={data.activityOptions??[]} initialPlace={person.location}/></div>:person.shared_event?<a href={`/activities/${encodeURIComponent(person.shared_event.resource_id||person.shared_event.plan_id||person.shared_event.intent_id)}`} className="text-xs text-emerald-200">✓ Aynı etkinliktesiniz</a>:null}</div>{person.intent_contexts?.length?<div className="mt-1 flex flex-wrap gap-1">{person.intent_contexts.map(purpose=><span key={purpose.id||"unknown"} className="rounded-full bg-emerald-950/75 px-2 py-1 text-[11px] text-emerald-100">{purpose.label} · {purpose.want_label}</span>)}</div>:<p className="mt-1 text-[11px] text-slate-300">{person.source_kind==="social"?"Etkinliğe katılmak":"Amaç belirtilmemiş"}</p>}{person.notes?<p className="text-xs">{person.notes}</p>:null}
          </div>):<p className="text-sm">Henüz isteyen yok.</p>:reviews.length?<ExperienceReviews cardTitle={cardTitle} viewerId={account??null} editOwn={actions?.editExperience} reviews={reviews.map(review=>({id:review.seed_id,userId:review.user_id,name:review.full_name,username:review.username,avatarUrl:review.avatar_url,date:experienceDate(review),rating:review.rating,body:review.body,isViewer:review.user_id===account}))}/>:<div className="text-sm"><p>Henüz deneyim ekleyen yok.</p>{actions?<p>Sen deneyimlediysen <button type="button" className="text-emerald-300 underline focus-visible:outline" onClick={actions.editExperience}>+ {actions.doneLabel}</button> diyerek deneyimini ekleyip puanlayabilirsin.</p>:null}</div>}
        </div>}
        <div className="uin-deck-dock">
          <button ref={back} type="button" className="uin-deck-home" aria-label={`${cardTitle} kartına dön`} onClick={()=>navigate(0)}>Karta dön</button>
          {position===1&&data&&(historyEvents.length>0||showHistory)?<button type="button" aria-label={showHistory?`Aktif etkinliklere dön, ${activeEvents.length}`:`Geçmiş ve iptal edilenler, ${historyEvents.length}`} onClick={toggleHistory} className="uin-deck-home">{showHistory?`Aktif · ${activeEvents.length}`:`Geçmiş · ${historyEvents.length}`}</button>:null}
          {position===1?<div className="uin-deck-choices uin-deck-navigation">{events.length>1?<><button type="button" className="uin-deck-previous" aria-label="Önceki etkinlik" disabled={currentIndex===0} onClick={()=>move(-1)}>‹</button><button type="button" aria-label={`Sonraki etkinlik, ${currentIndex+1} / ${events.length}`} disabled={currentIndex===events.length-1} onClick={()=>move(1)}>Diğer {currentIndex+1}/{events.length} ›</button></>:null}</div>:<div className="uin-deck-choices uin-deck-navigation">
            <button type="button" onClick={()=>navigate(position===-1?-2:-1)}>{position===-1?'‹ '+doers:wanting+' ›'} · {position===-1?reviews.length:people.length}</button>
            <button type="button" onClick={()=>navigate(1)}>Etkinlikler {data?activeEvents.length:'…'} ›</button>
          </div>}
        </div>
      </div>
    </div>:null}

  </article>;
}
function eventId(event:Detail['events'][number]) {return event.resource_id||event.plan_id||event.intent_id;}
function eventPhase(event:Detail['events'][number]) {return cardEventPhase([event.event_state,event.status,event.plan_status,event.card_payload?.lifecycle_status],event.card_payload?.scheduled_start||event.start_date,event.card_payload?.scheduled_end||event.end_date);}
function SmallAction({label,onClick,cancel=false}:{label:string;onClick:()=>void;cancel?:boolean}){const icon=label==='Düzenle'?'✎':label==='İptal'?'×':null;return <button type="button" aria-label={label} onClick={onClick} className={`uin-deck-small-action min-h-11 max-w-[108px] shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold ${icon?(cancel?'bg-transparent text-red-400':'bg-transparent text-emerald-300'):(cancel?'bg-red-700 text-white':'bg-emerald-700 text-white')}`}>{icon?<span aria-hidden="true" className="text-lg">{icon}</span>:label}</button>;}
function Person({name,avatar,username,userId,date}:{name:string;avatar:string|null;username:string|null;userId:string;date?:string}) {
  return <a aria-label={`${name} profili`} href={username?`/u/${encodeURIComponent(username)}`:`/people/${encodeURIComponent(userId)}`} className="uin-deck-person flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
    {avatar?<img src={avatar} alt="" className="h-6 w-6 rounded-full object-cover"/>:<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-900">{name.charAt(0)}</span>}<span className="min-w-0"><span>{compactPersonName(name)}</span>{date?<span className="ml-1 font-normal text-white/65">· {date}</span>:null}</span>
  </a>;
}
function eventDisplay(event:Detail['events'][number]) {
  const c=event.card_payload;
  return {planId:c?.plan_id||event.plan_id,ownerId:c?.owner_user_id,activityId:c?.activity_id,title:c?.event_display_title,location:event.location||c?.city,start:c?.scheduled_start||event.start_date,end:c?.scheduled_end||event.end_date,visibility:c?.visibility,dna:c?.event_dna_titles,phase:eventPhase(event),participants:c?.active_participant_count==null?undefined:Number(c.active_participant_count),viewerIsMember:c?.viewer_is_member,viewerRequest:c?.viewer_request_status==='pending'?c.viewer_request_status:null,viewerInvitation:c?.viewer_invitation_status==='pending'?c.viewer_invitation_status:null};
}
