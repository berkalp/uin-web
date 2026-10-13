import {useSyncExternalStore} from 'react';
import {supabase} from '@/utils/supabase/client';

// Share one auth listener across every card in a library grid.
let account: string | null | undefined;
const listeners=new Set<()=>void>();
let unsubscribe:(()=>void)|undefined;
function subscribe(listener:()=>void) {
  listeners.add(listener);
  if(!unsubscribe) {
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      const next=session?.user.id??null;
      if(next!==account){account=next;listeners.forEach(notify=>notify());}
    });
    unsubscribe=()=>subscription.unsubscribe();
  }
  return ()=>{listeners.delete(listener);if(!listeners.size){unsubscribe?.();unsubscribe=undefined;account=undefined;}};
}
export function useCardDeckAccount(){return useSyncExternalStore(subscribe,()=>account,()=>undefined);}
