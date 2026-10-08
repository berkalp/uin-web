import AppNavigation from "@/components/navigation/AppNavigation";
import InlineTopicSearch from "@/components/ideas/InlineTopicSearch";
import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
type SeedType = { id:string; name:string; slug:string; icon:string };

async function IdeasCatalogue(){
  const supabase=await createClient();
  const [seedTypeResult,adminResult,typeResult]=await Promise.all([
    supabase.rpc("get_active_seed_types"),
    supabase.rpc("get_admin_role"),
    supabase.from("uin_content_types").select("*").order("position").order("label"),
  ]);
  const seedTypes=(seedTypeResult.data??[]) as SeedType[];
  return typeResult.error||seedTypeResult.error?<p className="mt-6 rounded-2xl border border-red-200 bg-white p-6 font-semibold text-red-700">Kütüphane şu anda yüklenemedi.</p>:<InlineTopicSearch contentTypes={typeResult.data||[]} seedTypes={seedTypes} catalogue={[]} categoryCounts={{}} isAdmin={Boolean(adminResult.data)}/>;
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
