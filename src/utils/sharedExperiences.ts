import type { SupabaseClient } from '@supabase/supabase-js';
export type SharedFriend={id:string;name:string;avatar:string|null};
export type SharedOptions={friends:SharedFriend[];activities:{id:string;name:string}[]};
export type SharedListItem={id:string;title:string;activity:string;status:string;seedId:string|null;ownerName:string;date:string|null;year:number|null};
export type SharedMember={id:string;name:string;username:string|null;status:string;isMe:boolean;myScore:number|null;canRate:boolean};
export type SharedDetail={id:string;title:string;activityId:string;activity:string;date:string|null;year:number|null;status:string;seedId:string|null;isOwner:boolean;members:SharedMember[]};
export type SharedReputation={activityId:string;activity:string;score:number;people:number;experiences:number;badge:string|null};
export const sharedStatus=(status:string)=>({pending:'Onay bekliyor',accepted:'Onaylandı',declined:'Reddedildi',withdrawn:'Onay geri çekildi'}[status]??status);
export async function sharedAction<T>(client:SupabaseClient|null,action:string,payload:Record<string,unknown>={}):Promise<T>{
 if(!client)throw new Error('Bağlantı kurulamadı.');
 const {data,error}=await client.rpc('shared_experience_action',{p_action:action,p_payload:payload});
 if(error)throw new Error(error.message);
 if(data===null)throw new Error('Bu işlem bu hesap için kullanılamıyor.');
 return data as T;
}
export function companionPayload(activityId:string,scores:Record<string,string>){
 const friends=Object.entries(scores).map(([id,raw])=>({id,score:raw.trim()?Number(raw):null}));
 if(friends.length&&!activityId)throw new Error('Ortak deneyimin aktivitesini seç.');
 if(friends.some(x=>x.score!==null&&(!Number.isInteger(x.score)||x.score<1||x.score>10)))throw new Error('Arkadaş puanı 1 ile 10 arasında olmalı.');
 return {activityId,friends};
}
