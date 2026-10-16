import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadExperienceComments,loadExperienceExtras,orderExperienceReviews,type ExperienceReview,type ExperienceExtra,type ExperienceSort,type ExperienceComment} from './personalExperiences';
export function useExperienceReviews(client:SupabaseClient|null,reviews:ExperienceReview[]){
 const [extras,setExtras]=useState<Record<string,ExperienceExtra>>({}),[sort,setSort]=useState<ExperienceSort>('recent');
 const [selected,setSelected]=useState<string|null>(null),[photoIndex,setPhotoIndex]=useState(0),[comments,setComments]=useState<ExperienceComment[]>([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[more,setMore]=useState(false),[draft,setDraft]=useState('');
 const lock=useRef(false),offset=useRef(0),selection=useRef(selected);
 const ids=JSON.stringify(reviews.map(review=>review.id));
 useEffect(()=>{
  let active=true;
  void (async()=>{await Promise.resolve();if(!active)return;setLoading(true);setError('');
  if(!client){setLoading(false);setError('Bağlantı hazır değil.');return;}
  await loadExperienceExtras(client,JSON.parse(ids)).then(result=>{if(active)setExtras(result);}).catch(()=>{if(active)setError('Deneyim fotoğrafları ve beğeniler yüklenemedi.');}).finally(()=>{if(active)setLoading(false);});})();
  return()=>{active=false;};
 },[client,ids,retry]);
 useEffect(()=>{
  let active=true;
  if(!selected||!client)return;
  void loadExperienceComments(client,selected).then(result=>{if(active){setComments(result);offset.current=result.length;setMore(result.length===30);}}).catch(()=>{if(active)setError('Yanıtlar yüklenemedi. Yeniden dene.');});
  return()=>{active=false;};
 },[client,selected,retry]);
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch{setError('İşlem tamamlanamadı. Lütfen yeniden dene.');}finally{lock.current=false;setBusy(false);}}
 function like(id:string){return run(async()=>{
  if(!client||!extras[id])throw Error();
  const result=await client.rpc('set_my_experience_like',{p_seed_id:id,p_liked:!extras[id].viewerLiked});
  if(result.error)throw result.error;
  const fresh=await loadExperienceExtras(client,[id]);setExtras(previous=>({...previous,...fresh}));
 });}
 function reply(){const id=selected,body=draft.trim();if(!id||body.length<2)return;return run(async()=>{
  if(!client)throw Error();
  const result=await client.rpc('add_seed_experience_comment',{p_seed_id:id,p_body:body,p_comment_kind:'comment',p_parent_comment_id:null});
  if(result.error)throw result.error;
  // Clear once the write succeeds, even if the subsequent read fails.
  if(selection.current===id)setDraft('');
  const rows=await loadExperienceComments(client,id);const fresh=await loadExperienceExtras(client,[id]);
  setExtras(previous=>({...previous,...fresh}));if(selection.current===id){setComments(rows);offset.current=rows.length;setMore(rows.length===30);}
 });}
 function removeComment(id:string){return run(async()=>{
  if(!client)throw Error();const result=await client.rpc('delete_my_seed_experience_comment',{p_comment_id:id});if(result.error)throw result.error;
  setComments(previous=>previous.filter(row=>row.comment_id!==id));
  if(selected){const fresh=await loadExperienceExtras(client,[selected]);setExtras(previous=>({...previous,...fresh}));}
 });}
 function loadMore(){const id=selected;if(!id)return;return run(async()=>{
  if(!client)throw Error();const rows=await loadExperienceComments(client,id,offset.current);
  if(selection.current===id){setComments(previous=>[...previous,...rows]);offset.current+=rows.length;setMore(rows.length===30);}
 });}
 return {rows:orderExperienceReviews(reviews,extras,sort),extras,sort,setSort,selected:reviews.find(row=>row.id===selected)??null,photoIndex,setPhotoIndex,
  open:(id:string,index=0)=>{selection.current=id;setComments([]);setDraft('');offset.current=0;setMore(false);setPhotoIndex(index);setSelected(id);setRetry(value=>value+1);},close:()=>{selection.current=null;setSelected(null);},comments,more,loadMore,like,reply,removeComment,draft,setDraft,error,loading,busy,reload:()=>setRetry(value=>value+1)};
}
