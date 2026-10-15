import {useEffect,useRef} from 'react';

// A late settings read must not undo a sort the user has already chosen.
export function useLibrarySortDefault<T extends string>(key:string,saved:T|null,ready:boolean,allowed:string,fallback:T,onChange:(value:T)=>void){
  const context=useRef(''),manual=useRef(false);
  useEffect(()=>{
    if(context.current!==key){context.current=key;manual.current=false}
    if(!ready||manual.current)return;
    onChange(saved&&allowed.split(',').includes(saved)?saved:fallback);
  },[key,saved,ready,allowed,fallback,onChange]);
  return {
    select(value:T){context.current=key;manual.current=true;onChange(value)},
    reset(){context.current=key;manual.current=false},
  };
}
