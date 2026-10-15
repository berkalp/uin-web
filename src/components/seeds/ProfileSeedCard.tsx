"use client";
import dynamic from 'next/dynamic';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import LibraryTopicCard,{libraryContentType,type Catalogue} from '@/components/cards/LibraryTopicCard';
import {resolveUinCardWords,type Kind} from '@/utils/uinCardLanguage';
import {supabase} from '@/utils/supabase/client';
import type {PublicProfileSeedRecord} from '@/utils/seeds';
import {setSeedStatus} from '@/services/seedService';
const TopicCardModal=dynamic(()=>import('@/components/ideas/TopicCardModal'),{ssr:false});
type View='overview'|'want'|'done'|'events'|'want_form'|'done_form'|'event_form';
export default function ProfileSeedCard({seed,displayName,isOwner,card}:{seed:PublicProfileSeedRecord;displayName:string;isOwner:boolean;card?:Catalogue}){
 const router=useRouter();const[view,setView]=useState<View|null>(null),[error,setError]=useState('');
 const done=seed.status==='completed';const rawKind=seed.catalog_item_kind??card?.item_kind??'activity';const kind=(rawKind==='video'?'series':rawKind) as Kind;const words=resolveUinCardWords(kind);
 const type=libraryContentType(card??{canonical_target_id:seed.canonical_target_id??seed.seed_id,title:seed.title,item_kind:kind,subtitle:seed.subtitle,catalog_cover_url:seed.cover_url,cover_url:seed.cover_url,seed_type_slug:seed.seed_type_slug,intent_people_count:null,experience_people_count:null});
 const href=`/seeds/${encodeURIComponent(seed.seed_id)}`;const editable=()=>seed.source_kind==='personal'?setView('want_form'):router.push(done?`${href}?editExperience=1`:`${href}/edit`);
 const item:Catalogue={canonical_target_id:seed.canonical_target_id??seed.seed_id,title:seed.title,subtitle:seed.subtitle,catalog_cover_url:seed.cover_url,cover_url:seed.cover_url,seed_type_slug:seed.seed_type_slug,intent_people_count:null,experience_people_count:null,...card,catalog_item_id:seed.catalog_item_id,content_type_id:type.id,item_kind:kind,...(isOwner?(seed.source_kind==='personal'?{own_common_intent_id:seed.seed_id}:{own_seed_id:seed.seed_id,own_seed_status:done?'completed':card?.own_seed_status??seed.status}):{}),personal_start_date:!done?seed.target_date:null};
 function open(v:View|undefined){if(seed.seed_scope==='private'){router.push(href);return;}setView(v??'overview')}
 async function cancel(){if(!window.confirm('Güncel isteğin kaldırılsın mı? Deneyim kaydın korunur.'))return;setError('');try{
  if(seed.seed_scope==='private'&&isOwner)await setSeedStatus(seed.seed_id,'archived');
  else{const response=await fetch(`/api/ideas/${encodeURIComponent(item.canonical_target_id)}`,{cache:'no-store'});const detail=await response.json();if(!response.ok||!detail.ownWishTargetId)throw new Error(detail.error??'Güncel isteğin doğrulanamadı.');const result=await supabase.rpc('archive_my_common_wish_v73',{p_target_id:detail.ownWishTargetId});if(result.error)throw result.error;}
  router.refresh();
 }catch(cause){setError(cause instanceof Error?cause.message:'İstek iptal edilemedi.')}}
 const lived=seed.experience_precision==='year'?seed.experience_year:seed.experience_precision==='exact'&&seed.experience_date?new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(seed.experience_date)):null;
 return <><LibraryTopicCard item={item} contentTypes={[type]} teamCount={Number(card?.child_count??0)} scope={isOwner?done?'experiences':'wishes':'library'} countsReady={Boolean(card)} onOpen={open} onCancel={()=>void cancel()} onWishEdit={isOwner&&!done?editable:undefined} onExperience={isOwner&&done?editable:undefined} personalRating={done?seed.personal_rating:undefined} personalRatingLabel={isOwner?'Puanım':`${displayName.split(' ')[0]} puanı`} profileSummary={done?<>{lived?<p>📅 {lived}</p>:null}{seed.key_takeaway?<p className="line-clamp-2">“{seed.key_takeaway}”</p>:null}</>:null}/>{error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}{view?<TopicCardModal selected={{catalogItemId:seed.catalog_item_id??'',canonicalTargetId:item.canonical_target_id,title:seed.title,subtitle:seed.subtitle,coverUrl:seed.cover_url,itemKind:kind,contentTypeId:type.id,initialView:view,aggregateWanting:Number(card?.intent_people_count??0),aggregateDone:Number(card?.experience_people_count??0),aggregateActive:Number(card?.active_event_count??0)}} contentType={type} onSelectType={()=>{}} onClose={()=>setView(null)} onChanged={()=>router.refresh()} wantLabel={words.want} doneLabel={words.done} wantingLabel={words.wanting} doersLabel={words.doers} targetAction={words.action} eventButtonLabel={words.event} mediaKind={kind==='movie'||kind==='series'?kind:undefined} isClub={kind==='club'}/>:null}</>;
}