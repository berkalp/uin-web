import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '@/utils/supabase/client';
import {libraryCategories} from '@/utils/libraryPreferences';
type Values=Record<string,unknown>;
type Snapshot={owner:string|null|undefined;values:Values;ready:boolean};
// This cache is account-keyed and only contains settings, never card/profile data.
const cache=new Map<string,Values>();
export function useLibraryPreferences(viewerId:string|null|undefined){
  const [snapshot,setSnapshot]=useState<Snapshot>({owner:viewerId,values:viewerId?cache.get(viewerId)??{}:{},ready:viewerId===null||Boolean(viewerId&&cache.has(viewerId))});
  const [error,setError]=useState(''),[saving,setSaving]=useState(false),[revision,setRevision]=useState(0);
  const owner=useRef(viewerId);owner.current=viewerId;
  const generation=useRef(0),saveLock=useRef(false);
  useEffect(()=>{
    const request=++generation.current;
    setError('');setSaving(false);saveLock.current=false;
    const previous=viewerId?cache.get(viewerId):undefined;
    setSnapshot({owner:viewerId,values:previous??{},ready:viewerId===null||Boolean(previous)});
    if(!viewerId||!supabase)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'))},6000)});
    void (async()=>{
      try{
        const result=await Promise.race([supabase.from('uin_library_preferences').select('preference_key,value').eq('user_id',viewerId).abortSignal(controller.signal),timeout]);
        if(result.error||!Array.isArray(result.data))throw Error();
        if(generation.current!==request||owner.current!==viewerId)return;
        const values=Object.fromEntries(result.data.map(row=>[row.preference_key,row.value]));
        cache.set(viewerId,values);setSnapshot({owner:viewerId,values,ready:true});
      }catch{
        if(generation.current===request&&owner.current===viewerId){setError('Kütüphane tercihlerin yüklenemedi. Tekrar deneyebilirsin.');setSnapshot(current=>({...current,ready:true}));}
      }finally{clearTimeout(timer!)}
    })();
    return()=>{++generation.current;controller.abort();clearTimeout(timer!)};
  },[viewerId,revision]);
  const save=useCallback(async(key:string,value:unknown)=>{
    if(!viewerId||!supabase||saveLock.current||!snapshot.ready||snapshot.owner!==viewerId)return false;
    saveLock.current=true;setSaving(true);setError('');
    const request=++generation.current; // A pending initial read must not overwrite this save.
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'))},6000)});
    try{
      const result=await Promise.race([supabase.from('uin_library_preferences').upsert({user_id:viewerId,preference_key:key,value},{onConflict:'user_id,preference_key'}).select('preference_key,value').abortSignal(controller.signal),timeout]);
      if(result.error||!Array.isArray(result.data)||result.data.length!==1)throw Error();
      if(owner.current!==viewerId||generation.current!==request)return false;
      const values={...(cache.get(viewerId)??{}),[key]:result.data[0].value};cache.set(viewerId,values);
      setSnapshot({owner:viewerId,values,ready:true});return true;
    }catch{if(owner.current===viewerId&&generation.current===request)setError('Tercihin kaydedilemedi. Seçimin korunuyor; tekrar deneyebilirsin.');return false}
    finally{clearTimeout(timer!);if(owner.current===viewerId&&generation.current===request){saveLock.current=false;setSaving(false)}}
  },[viewerId,snapshot.ready,snapshot.owner]);
  const values=snapshot.owner===viewerId?snapshot.values:{};
  return {categories:libraryCategories(values.categories),values,ready:snapshot.owner===viewerId&&snapshot.ready,error,saving,save,retry:()=>setRevision(value=>value+1)};
}
