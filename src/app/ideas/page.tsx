import AppNavigation from "@/components/navigation/AppNavigation";
import InlineTopicSearch from "@/components/ideas/InlineTopicSearch";
import type { DiscoverPersonalIntent } from "@/components/discover/DiscoverPersonalIntentCard";
import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
type SeedType = { id:string; name:string; slug:string; icon:string };
type CataloguePlacement = { id:string; canonical_target_id:string|null; item_kind:string };

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
  const [placementPages,ownSeedPages,summaryResult,coverResult]=await Promise.all([
    Promise.all(Array.from({length:Math.ceil(targetIds.length/200)},(_,page)=>supabase.from("seed_catalog_items").select("id,canonical_target_id,item_kind").in("canonical_target_id",targetIds.slice(page*200,(page+1)*200)))),
    Promise.all(Array.from({length:Math.ceil(ownSeedIds.length/200)},(_,page)=>supabase.from("seeds").select("id,status").in("id",ownSeedIds.slice(page*200,(page+1)*200)))),
    supabase.rpc("get_uin_card_summary_v80",{p_target_ids:targetIds}),
    supabase.rpc("get_uin_cover_positions_v62",{p_target_ids:targetIds}),
  ]);
  const placementError=placementPages.find(page=>page.error)?.error;
  const placements=new Map(placementPages.flatMap(page=>(page.data??[]) as CataloguePlacement[]).map(item=>[item.canonical_target_id,item]));
  const ownSeedStatus=new Map(ownSeedPages.flatMap(page=>page.data??[]).map(seed=>[seed.id,seed.status]));
  const summaries=new Map(((summaryResult.data||[]) as Array<Record<string,unknown>>).map(row=>[row.target_id,row]));
  const covers=new Map(((coverResult.data||[]) as Array<{target_id:string;cover_position_y:number}>).map(row=>[row.target_id,row.cover_position_y]));
  const catalogue=topics.map(item=>({...item,cover_position_y:Number(covers.get(item.canonical_target_id)??50),content_type_id:summaries.get(item.canonical_target_id)?.type_id as string|null,active_event_count:Number(summaries.get(item.canonical_target_id)?.active||0),completed_event_count:Number(summaries.get(item.canonical_target_id)?.completed||0),expired_event_count:Number(summaries.get(item.canonical_target_id)?.expired||0),cancelled_event_count:Number(summaries.get(item.canonical_target_id)?.cancelled||0),intent_people_count:Number(summaries.get(item.canonical_target_id)?.wanting||0),experience_people_count:Number(summaries.get(item.canonical_target_id)?.done||0),subtitle:(summaries.get(item.canonical_target_id)?.creator_name as string)||item.subtitle,catalog_cover_url:(summaries.get(item.canonical_target_id)?.editorial_cover_url as string)||item.catalog_cover_url,catalog_item_id:placements.get(item.canonical_target_id)?.id||null,item_kind:placements.get(item.canonical_target_id)?.item_kind||item.item_kind||null,own_seed_status:item.own_seed_id?ownSeedStatus.get(item.own_seed_id)||null:null}));
  return topicError||summaryResult.error||typeResult.error||seedTypeResult.error||placementError||ownSeedPages.some(page=>page.error)?<p className="mt-6 rounded-2xl border border-red-200 bg-white p-6 font-semibold text-red-700">UIN Kütüphanesi şu anda yüklenemedi.</p>:<InlineTopicSearch contentTypes={typeResult.data||[]} seedTypes={seedTypes} catalogue={catalogue} isAdmin={Boolean(adminResult.data)}/>;
}

function CatalogueFallback(){return <div className="mt-6 space-y-4" aria-label="Kütüphane yükleniyor"><div className="h-44 animate-pulse rounded-[30px] bg-white"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({length:6},(_,index)=><div key={index} className="h-96 animate-pulse rounded-[26px] bg-white"/>)}</div></div>}

export default function IdeasPage(){
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
    <div className="relative z-50 mx-auto mb-8 min-h-16 max-w-[1320px]"><Suspense fallback={<div className="h-16 animate-pulse rounded-2xl bg-white"/>}><AppNavigation/></Suspense></div>
    <div className="mx-auto max-w-[1320px]">
      <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">UIN KÜTÜPHANESİ</p>
        <h1 className="mt-2 text-3xl font-black">Ne arıyorsun?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Film, dizi, kitap, sanatçı, yer, spor ve diğer ortak kayıtları bul. Bir kaydı açınca isteyenleri, deneyimleyenleri ve ilgili etkinlikleri birlikte gör.</p>
      </header>
      <Suspense fallback={<CatalogueFallback/>}><IdeasCatalogue/></Suspense>
    </div>
  </main>;
}
