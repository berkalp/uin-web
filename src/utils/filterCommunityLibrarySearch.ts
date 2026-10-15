import type { SupabaseClient } from '@supabase/supabase-js';
import { matchesLibraryCategory, readLibraryCategoryIndex } from '@/utils/libraryCategoryFilter';

// Community endpoints paginate independently. Resolve membership before slicing,
// so a category outside the first page is still discoverable and counts are exact.
export async function filterCommunityLibrarySearch<T extends {intent_id:string;plan_id:string|null;total_count:number|string}>(
  client: SupabaseClient, category: string,
  read: (limit:number,offset:number,signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>,
) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const rows:T[]=[];
    for(let offset=0;;offset+=60){
      const result=await read(60,offset,controller.signal);
      if(result.error||!Array.isArray(result.data))throw new Error('Etkinlikler yüklenemedi.');
      const batch=result.data as T[];
      rows.push(...batch);
      if(batch.length<60||rows.length>=Number(batch[0]?.total_count??Infinity))break;
    }
    const index=await readLibraryCategoryIndex(client,[],rows.map(row=>row.plan_id??row.intent_id),controller.signal);
    const filtered=rows.filter(row=>matchesLibraryCategory(category,[row.plan_id,row.intent_id],index.events));
    return filtered.map(row=>({...row,total_count:filtered.length}));
  } finally {clearTimeout(timeout);controller.abort();}
}
