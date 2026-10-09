import Link from "next/link";
import { notFound } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import CommonPersonalIntentForm from "@/components/intentions/CommonPersonalIntentForm";
import CommonIntentUnavailable from "@/components/intentions/CommonIntentUnavailable";
import { commonIntentTitle } from "@/utils/commonIntentTitle";
import { createClient } from "@/utils/supabase/server";
export const dynamic="force-dynamic";
export default async function PersonalIntentPage({params}:{params:Promise<{targetId:string}>}){
  const {targetId}=await params;const supabase=await createClient();const [targetResult,sportResult]=await Promise.all([supabase.rpc("get_common_target_create_context_v38",{p_target_id:targetId}),supabase.rpc("get_sport_target_context_v47",{p_target_id:targetId})]);
  if(targetResult.error||sportResult.error){console.error("Personal intent context query failed:",targetResult.error||sportResult.error);return <CommonIntentUnavailable retryHref={`/intentions/${encodeURIComponent(targetId)}/personal`} backHref={`/intentions/${encodeURIComponent(targetId)}`}/>;}
  const target=targetResult.data as {title?:string}|null;const sportData=sportResult.data;if(!target?.title)notFound();
  return <main className="min-h-screen bg-gray-50 px-4 py-6"><div className="mx-auto mb-8 max-w-3xl"><AppNavigation/></div><section className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-9">
    <Link href={`/intentions/${targetId}`} className="text-sm font-bold text-gray-600">← Konuya dön</Link><p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">{sportData?"İZLEME İSTEĞİ":"KİŞİSEL NİYET"}</p><h1 className="mt-2 text-3xl font-black">{commonIntentTitle(target.title)}</h1><p className="mt-2 text-sm text-gray-500">Müsait olduğun tarihleri, konumunu ve maç tercihini seç. Herkese açık kaydettiğinde yerinde izlemek isteyenler listesinde görünürsün.</p><div className="mt-7"><CommonPersonalIntentForm targetId={targetId} isSport={Boolean(sportData)}/></div>
  </section></main>;
}
