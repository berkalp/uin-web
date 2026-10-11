"use client";
import dynamic from 'next/dynamic';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import LibraryTopicCard,{libraryContentType,type Catalogue} from '@/components/cards/LibraryTopicCard';
import type {DiscoverIntentRow} from '@/components/discover/DiscoverIntentCard';
import {resolveUinCardWords,type Kind} from '@/utils/uinCardLanguage';
const TopicCardModal=dynamic(()=>import('@/components/ideas/TopicCardModal'),{ssr:false});
type View='overview'|'want'|'done'|'events'|'want_form'|'done_form'|'event_form';
export default function ProfileLibraryActivityCard({intent,currentUserId}:{intent:DiscoverIntentRow;currentUserId:string}){
 const router=useRouter(),[view,setView]=useState<View|null>(null);
 const source=intent.library_card;
 const resource=intent.plan_id??intent.resource_id??intent.intent_id;
 const owner=currentUserId===intent.owner_user_id;
 const kind=(source?.item_kind??'activity') as Kind;
 const words=resolveUinCardWords(kind);
 const type=libraryContentType(source??{canonical_target_id:intent.activity_id,title:intent.activity_name,item_kind:kind,subtitle:null,catalog_cover_url:intent.activity_cover_url,cover_url:intent.activity_cover_url,seed_type_slug:'activity',intent_people_count:null,experience_people_count:null});
 const item:Catalogue={canonical_target_id:source?.canonical_target_id??intent.activity_id,title:intent.activity_name,subtitle:null,cover_url:intent.activity_cover_url,catalog_cover_url:intent.activity_cover_url,seed_type_slug:'activity',intent_people_count:null,experience_people_count:null,...source,personal_event:{resource_id:resource,intent_id:intent.intent_id,plan_id:intent.plan_id,title:intent.event_display_title??intent.activity_name,start_date:intent.scheduled_start??intent.start_date,end_date:intent.scheduled_end??intent.end_date,location:[intent.district,intent.city].filter(Boolean).join(', '),organizer_name:intent.owner_full_name,organizer_avatar_url:intent.owner_avatar_url,viewer_role:owner?'owner':intent.viewer_is_member?'participant':'visitor',lifecycle_status:intent.lifecycle_status}};
 function open(v:View|undefined){if(v==='overview'||!source){router.push(`/activities/${encodeURIComponent(resource)}`);return}setView(v??'overview')}
 return <><LibraryTopicCard item={item} contentTypes={[type]} scope="plans" countsReady={Boolean(source)} onOpen={open} onCancel={()=>open('want_form')}/>{view&&source?<TopicCardModal selected={{catalogItemId:source.catalog_item_id??'',canonicalTargetId:source.canonical_target_id,title:source.title,subtitle:source.subtitle,coverUrl:source.cover_url,contentTypeId:type.id,itemKind:kind,initialView:view}} contentType={type} onSelectType={()=>{}} onClose={()=>setView(null)} wantLabel={words.want} doneLabel={words.done} wantingLabel={words.wanting} doersLabel={words.doers} targetAction={words.action} eventButtonLabel={words.event}/>:null}</>;
}
