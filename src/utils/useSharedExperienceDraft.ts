import {useCallback,useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {sharedAction,companionPayload,type SharedOptions,type SharedListItem} from './sharedExperiences';
export function useSharedExperienceDraft(client:SupabaseClient|null,seedId:string|undefined,enabled:boolean,source:{catalogItemId?:string;seedTypeId?:string;title?:string}={}){
 const [options,setOptions]=useState<SharedOptions>({friends:[],activities:[]});
 const [links,setLinks]=useState<SharedListItem[]>([]);
 const activityId=options.context?.activityId??''; const [scores,setScores]=useState<Record<string,string>>({});
 const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 const reload=useCallback(()=>setRevision(x=>x+1),[]);
 useEffect(()=>{if(!enabled)return;let live=true;setOptions({friends:[],activities:[]});setScores({});setLinks([]);
 Promise.all([sharedAction<SharedOptions>(client,'options',{...source,seedId}),seedId?sharedAction<SharedListItem[]>(client,'list',{seedId}):Promise.resolve([])])
 .then(([o,l])=>{if(live){setError('');setOptions(o);setLinks(l);}}).catch(e=>{if(live)setError(e.message)});
 return()=>{live=false};},[client,seedId,enabled,revision,source.catalogItemId,source.seedTypeId,source.title]);
 function toggle(id:string){setScores(current=>{const next={...current};if(id in next)delete next[id];else next[id]='';return next;});}
 function validate(){return companionPayload(activityId,scores);}
 async function save(id:string){const payload=validate();if(!payload.friends.length)return null;const result=await sharedAction<{id:string}>(client,'save',{...payload,seedId:id});return result.id;}
 return {options,links,activityId,scores,setScores,toggle,save,validate,error,reload};
}
export type SharedDraft=ReturnType<typeof useSharedExperienceDraft>;
