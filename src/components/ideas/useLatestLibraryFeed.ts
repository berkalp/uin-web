import {useCallback,useEffect,useRef,useState} from 'react';

export type LatestPage<T>={cards:T[];nextCursor:string|null};
// Owner and request generations prevent late reads from replacing another view.
export function useLatestLibraryFeed<T>(enabled:boolean,owner:string,revision:number,loadPage:(cursor:string|null,signal:AbortSignal)=>Promise<LatestPage<T>>,idOf:(card:T)=>string){
  const [state,setState]=useState<{owner:string;cards:T[];cursor:string|null;loading:boolean;error:string;loaded:boolean}>({owner,cards:[],cursor:null,loading:false,error:'',loaded:false});
  const stateRef=useRef(state);stateRef.current=state;
  const generation=useRef(0),pending=useRef<AbortController|null>(null);
  const load=useCallback(async(append=false)=>{
    if(append&&(pending.current||!stateRef.current.cursor||stateRef.current.owner!==owner))return;
    pending.current?.abort();const controller=new AbortController();pending.current=controller;
    const ticket=++generation.current;const cursor=append?stateRef.current.cursor:null;
    setState(old=>({...old,owner,cards:old.owner===owner?old.cards:[],cursor:old.owner===owner?old.cursor:null,loaded:old.owner===owner&&old.loaded,loading:true,error:''}));
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const result=await loadPage(cursor,controller.signal);
      if(ticket!==generation.current)return;
      if(controller.signal.aborted)throw new Error('Yeni kartlar henüz yüklenemedi. Tekrar deneyebilirsin.');
      setState(old=>{const retained=append&&old.owner===owner?old.cards:[];const ids=new Set(retained.map(idOf));return {owner,cards:[...retained,...result.cards.filter(card=>!ids.has(idOf(card)))],cursor:result.nextCursor,loading:false,error:'',loaded:true}});
    }catch{
      if(ticket===generation.current)setState(old=>({...old,loading:false,error:'Yeni kartlar yüklenemedi. Tekrar deneyebilirsin.'}));
    }finally{clearTimeout(timer);if(ticket===generation.current)pending.current=null}
  },[owner,loadPage,idOf]);
  useEffect(()=>{if(enabled)void load();return()=>{++generation.current;pending.current?.abort();pending.current=null}},[enabled,revision,load]);
  const current=state.owner===owner?state:{owner,cards:[] as T[],cursor:null,loading:false,error:'',loaded:false};
  return {...current,initialLoading:enabled&&!current.cards.length&&(current.loading||!current.loaded&&!current.error),loadMore:()=>load(true),refresh:()=>load(false)};
}
