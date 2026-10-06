import AppNavigation from "@/components/navigation/AppNavigation";
import InlineTopicSearch from "@/components/ideas/InlineTopicSearch";
import type { DiscoverPersonalIntent } from "@/components/discover/DiscoverPersonalIntentCard";
import { createClient } from "@/utils/supabase/server";
import {readImdbMetadata} from "@/utils/imdbMetadata";
import {readBookListMetadata} from "@/utils/bookListMetadata";
import {readSeriesListMetadata} from "@/utils/seriesListMetadata";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
type SeedType = { id:string; name:string; slug:string; icon:string };
type CataloguePlacement = { id:string; canonical_target_id:string|null; item_kind:string; metadata:Record<string,unknown>|null };

async function IdeasCatalogue(){
  const supabase=await createClient();
  const [topicResult,seedTypeResult,adminResult,typeResult]=await Promise.all([
    supabase.rpc("get_uin_catalogue_v64",{p_query:null,p_limit:200,p_offset:0,p_target_id:null}),
    supabase.rpc("get_active_seed_types"),
    supabase.rpc("get_admin_role"),
    supabase.from("uin_content_types").select("*").order("position").order("label"),
  ]);
  const topics=[...((topicResult.data??[]) as DiscoverPersonalIntent[])];
  let topicError=topicResult.error;
  for(let offset=topics.length;!topicError&&offset>0&&offset%200===0;offset+=200){
    const page=await supabase.rpc("get_uin_catalogue_v64",{p_query:null,p_limit:200,p_offset:offset,p_target_id:null});
    topicError=page.error;
    if(topicError)break;
    const rows=(page.data??[]) as DiscoverPersonalIntent[];
    topics.push(...rows);
    if(rows.length<200)break;
  }
  const seedTypes=(seedTypeResult.data??[]) as SeedType[];
  const targetIds=topics.map(item=>item.canonical_target_id);
  const ownSeedIds=[...new Set(topics.map(item=>item.own_seed_id).filter((id):id is string=>Boolean(id)))];
  const summaryPromise=(async()=>{
    const data:Array<Record<string,unknown>>=[];
    const batches=Array.from({length:Math.ceil(targetIds.length/100)},(_,index)=>targetIds.slice(index*100,(index+1)*100));
    for(let offset=0;offset<batches.length;offset+=3){
      const pages=await Promise.all(batches.slice(offset,offset+3).map(ids=>supabase.rpc("get_uin_card_summary_v107",{p_target_ids:ids})));
      const failed=pages.find(page=>page.error);
      if(failed?.error)return {data,error:failed.error};
      data.push(...pages.flatMap(page=>(page.data||[]) as Array<Record<string,unknown>>));
    }
    return {data,error:null};
  })();
  const [placementPages,ownSeedPages,summaryResult,ratingResult,socialResult,coverResult,hierarchyResult]=await Promise.all([
    Promise.all(Array.from({length:Math.ceil(targetIds.length/200)},(_,page)=>supabase.from("seed_catalog_items").select("id,canonical_target_id,item_kind,metadata").in("canonical_target_id",targetIds.slice(page*200,(page+1)*200)))),
    Promise.all(Array.from({length:Math.ceil(ownSeedIds.length/200)},(_,page)=>supabase.from("seeds").select("id,status").in("id",ownSeedIds.slice(page*200,(page+1)*200)))),
    summaryPromise,
    supabase.rpc("get_uin_card_ratings_v85",{p_target_ids:targetIds}),
    supabase.rpc("get_uin_card_social_v87",{p_target_ids:targetIds}),
    supabase.rpc("get_uin_cover_positions_v62",{p_target_ids:targetIds}),
    supabase.rpc("get_uin_card_hierarchy_v81",{p_target_ids:targetIds}),
  ]);
  const placements=new Map(placementPages.flatMap(page=>(page.data??[]) as CataloguePlacement[]).map(item=>[item.canonical_target_id,item]));
  const ownSeedStatus=new Map(ownSeedPages.flatMap(page=>page.data??[]).map(seed=>[seed.id,seed.status]));
  const summaries=new Map(((summaryResult.data||[]) as Array<Record<string,unknown>>).map(row=>[row.target_id,row]));
  const ratings=new Map(((ratingResult.data||[]) as Array<Record<string,unknown>>).map(row=>[row.target_id,row]));
  const social=new Map(((socialResult.data||[]) as Array<Record<string,unknown>>).map(row=>[row.target_id,row]));
  const covers=new Map(((coverResult.data||[]) as Array<{target_id:string;cover_position_y:number}>).map(row=>[row.target_id,row.cover_position_y]));
  const hierarchy=new Map(((hierarchyResult.data||[]) as Array<{target_id:string;parent_target_id:string|null;sort_order:number;section_title:string|null;depth:number}>).map(row=>[row.target_id,row]));
  const catalogue=topics.map(item=>{const imdb=readImdbMetadata(placements.get(item.canonical_target_id)?.metadata);const summary=summaries.get(item.canonical_target_id);return {...item,imdb_rank:imdb.imdbRank,imdb_rating:imdb.imdbRating,average_rating:ratings.get(item.canonical_target_id)?.average_rating==null?null:Number(ratings.get(item.canonical_target_id)?.average_rating),rating_count:Number(ratings.get(item.canonical_target_id)?.rating_count||0),follower_count:Number(social.get(item.canonical_target_id)?.follower_count||0),related_count:Number(social.get(item.canonical_target_id)?.related_count||0),cover_position_y:Number(covers.get(item.canonical_target_id)??50),content_type_id:(summary?.type_id as string|null)||placements.get(item.canonical_target_id)?.item_kind||item.item_kind||null,active_event_count:Number(summary?.active??item.social_intent_count??0),completed_event_count:Number(summary?.completed||0),expired_event_count:Number(summary?.expired||0),cancelled_event_count:Number(summary?.cancelled||0),intent_people_count:Number(summary?.wanting??item.intent_people_count??0),experience_people_count:Number(summary?.done??item.experience_people_count??0),subtitle:(summary?.creator_name as string)||item.subtitle,catalog_cover_url:(summary?.editorial_cover_url as string)||item.catalog_cover_url,catalog_item_id:placements.get(item.canonical_target_id)?.id||null,item_kind:placements.get(item.canonical_target_id)?.item_kind||item.item_kind||null,own_seed_status:item.own_seed_id?ownSeedStatus.get(item.own_seed_id)||null:null,parent_target_id:hierarchy.get(item.canonical_target_id)?.parent_target_id||null,hierarchy_sort_order:Number(hierarchy.get(item.canonical_target_id)?.sort_order||0),hierarchy_section_title:hierarchy.get(item.canonical_target_id)?.section_title||null,hierarchy_depth:Number(hierarchy.get(item.canonical_target_id)?.depth||0),child_count:Number(summary?.child_count||0)}});
  const enrichedCatalogue=catalogue.map(item=>{const metadata=placements.get(item.canonical_target_id)?.metadata;const book=readBookListMetadata(metadata);const series=readSeriesListMetadata(metadata);return {...item,book_lists:book.bookLists,book_list_ranks:book.bookListRanks,book_awards:book.bookAwards,series_lists:series.seriesLists,series_list_ranks:series.seriesListRanks,series_awards:series.seriesAwards}});
  // Ratings, social totals, hierarchy and placement metadata enrich cards but
  // must not take the entire Library offline when one auxiliary query fails.
  return topicError||typeResult.error||seedTypeResult.error?<p className="mt-6 rounded-2xl border border-red-200 bg-white p-6 font-semibold text-red-700">Kütüphane şu anda yüklenemedi.</p>:<InlineTopicSearch contentTypes={typeResult.data||[]} seedTypes={seedTypes} catalogue={enrichedCatalogue} isAdmin={Boolean(adminResult.data)}/>;
}

function CatalogueFallback(){return <div className="mt-6 space-y-4" aria-label="Kütüphane yükleniyor"><div className="h-44 animate-pulse rounded-[30px] bg-white"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({length:6},(_,index)=><div key={index} className="h-96 animate-pulse rounded-[26px] bg-white"/>)}</div></div>}

export default function IdeasPage(){
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
    <div className="relative z-50 mx-auto mb-8 min-h-16 max-w-[1320px]"><Suspense fallback={<div className="h-16 animate-pulse rounded-2xl bg-white"/>}><AppNavigation/></Suspense></div>
    <div className="mx-auto max-w-[1320px]">
      <Suspense fallback={<CatalogueFallback/>}><IdeasCatalogue/></Suspense>
    </div>
  </main>;
}
