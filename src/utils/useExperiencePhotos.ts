import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadExperienceExtras,saveExperiencePhotos,type DraftPhoto} from './personalExperiences';
export function useExperiencePhotos(client:SupabaseClient|null,seedId:string|undefined,enabled:boolean){
 const [photos,setPhotos]=useState<DraftPhoto[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const expected=useRef<string[]>([]);
 useEffect(()=>{
   if(!enabled)return;
   let active=true;
   void (async()=>{await Promise.resolve();if(!active)return;setReady(false);setError('');
   if(!seedId){expected.current=[];setPhotos([]);setReady(true);return;}
   if(!client){setError('Bağlantı hazır değil.');return;}
   await loadExperienceExtras(client,[seedId]).then(rows=>{
     if(!active)return;const existing=rows[seedId]?.photos??[];expected.current=existing.map(photo=>photo.path);setPhotos(existing);setReady(true);
   }).catch(()=>{if(active)setError('Fotoğraflar yüklenemedi. Kaydetmeden önce yeniden dene.');});})();
   return()=>{active=false;};
 },[client,seedId,enabled,retry]);
 async function save(id:string,visibility='everyone'){
   if(!client||!ready)throw Error('Fotoğrafların yüklenmesini bekle.');
   expected.current=await saveExperiencePhotos(client,id,photos,expected.current,visibility);
 }
 return {photos,setPhotos,ready,error,reload:()=>setRetry(value=>value+1),save};
}
