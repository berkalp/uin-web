import Link from "next/link";
import AppNavigation from "@/components/navigation/AppNavigation";
import SportsBreadcrumbs from "@/components/sports/SportsBreadcrumbs";
import { createClient } from "@/utils/supabase/server";
import { metric, type SportBranchCard } from "@/utils/sportsCatalogue";

export const dynamic = "force-dynamic";

function isMetric(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isSportBranchCard(value: unknown): value is SportBranchCard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" &&
    typeof row.slug === "string" &&
    typeof row.name === "string" &&
    typeof row.icon === "string" &&
    isMetric(row.league_count) &&
    isMetric(row.team_count) &&
    isMetric(row.event_count);
}

export default async function SportsPage() {
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("get_sport_branches_v47");
  const payloadValid=Array.isArray(data)&&data.every(isSportBranchCard);
  const readFailed=Boolean(error||!payloadValid);
  if(readFailed)console.error("Sport branch query failed:",error??"Unexpected payload");
  const items=payloadValid?data:[];
  return <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6"><div className="relative z-50 mx-auto mb-8 max-w-[1320px]"><AppNavigation/></div><div className="mx-auto max-w-[1320px]">
    <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"><SportsBreadcrumbs items={[{label:"Sporu Yerinde İzle"}]}/><p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-emerald-700">SPOR BRANŞLARI</p><h1 className="mt-2 text-3xl font-black">Hangi sporu yerinde izlemek istiyorsun?</h1><p className="mt-2 text-sm leading-6 text-gray-500">Önce spor branşını seç; ardından Türkiye’deki aktif ligleri ve takımları gör.</p></header>
    {readFailed?<p className="mt-6 rounded-2xl border border-red-200 bg-white p-6 text-red-700">Spor branşları şu anda yüklenemedi.</p>:items.length===0?<section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-gray-900">Henüz gösterilecek spor branşı yok</h2><p className="mt-2 text-sm leading-6 text-gray-600">Aktif spor branşları kataloğa eklendiğinde ligleri ve takımları burada görebileceksin.</p></section>:<section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map(item=><Link key={item.id} href={`/sports/${encodeURIComponent(item.slug)}`} className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><div className="text-5xl">{item.icon}</div><h2 className="mt-5 text-2xl font-black group-hover:text-emerald-700">{item.name}</h2><p className="mt-2 min-h-10 text-sm font-semibold text-gray-500">{item.federation_name}{item.federation_short_name?` (${item.federation_short_name})`:""}</p><div className="mt-6 grid grid-cols-3 gap-2">{[["Ligler",item.league_count],["Takımlar",item.team_count],["Etkinlikler",item.event_count]].map(([label,value])=><div key={String(label)} className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-black uppercase text-gray-400">{label}</p><p className="mt-1 text-xl font-black">{metric(value as number|string)}</p></div>)}</div></Link>)}</section>}
  </div></main>;
}
