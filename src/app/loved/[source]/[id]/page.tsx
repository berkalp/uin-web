import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type LovedDetail = { id:string; source_type:"catalog"|"subject"; title:string; subtitle:string|null; cover_url:string|null; item_kind:string|null; source_url:string|null; public_count:number|string; catalog_item_id:string|null; people?:Array<{user_id:string;full_name:string|null;username:string|null;avatar_url:string|null}> };

export default async function LovedDetailPage({params}:{params:Promise<{source:string;id:string}>}) {
  const {source,id}=await params;
  if(source!=="catalog"&&source!=="subject")notFound();
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("get_loved_subject_detail_v29222",{p_source_type:source,p_id:id});
  if(error||!data)notFound();
  const detail=data as LovedDetail;
  const people=Array.isArray(detail.people)?detail.people:[];
  return <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl">
    <Link href="/timeline" className="text-sm font-bold text-gray-600 hover:text-green-700">← Geri</Link>
    <section className="mt-5 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm"><div className="grid md:grid-cols-[320px_1fr]">
      <div className="aspect-square bg-gray-100 md:aspect-auto">{detail.cover_url?<img src={detail.cover_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full min-h-72 items-center justify-center text-7xl">♡</div>}</div>
      <div className="p-7 md:p-10"><p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">Sevdiğim · {detail.item_kind||"konu"}</p><h1 className="mt-3 text-4xl font-black text-gray-950">{detail.title}</h1>{detail.subtitle&&<p className="mt-2 text-lg text-gray-500">{detail.subtitle}</p>}
        <div className="mt-7 flex flex-wrap gap-3">{detail.catalog_item_id&&<Link href={`/seeds/subjects/${encodeURIComponent(detail.catalog_item_id)}`} className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-black text-white">Konu detayını aç</Link>}{detail.catalog_item_id&&<Link href={`/seeds/subjects/${encodeURIComponent(detail.catalog_item_id)}/past`} className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white">Deneyim ekle</Link>}{detail.source_url&&<a href={detail.source_url} target="_blank" rel="noreferrer" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-700">Kaynağı aç ↗</a>}</div>
      </div></div></section>
    <section className="mt-6 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8"><h2 className="text-2xl font-black text-gray-950">Kimler seviyor?</h2><p className="mt-1 text-sm text-gray-500">{Number(detail.public_count)||people.length} kişi</p>
      {people.length>0?<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{people.map(person=><Link key={person.user_id} href={person.username?`/u/${encodeURIComponent(person.username)}`:"#"} className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 hover:border-green-300">{person.avatar_url?<img src={person.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/>:<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 font-black">{(person.full_name||"?").slice(0,1)}</div>}<div className="min-w-0"><p className="truncate font-black text-gray-950">{person.full_name||"UIN kullanıcısı"}</p>{person.username&&<p className="truncate text-sm text-gray-500">@{person.username}</p>}</div></Link>)}</div>:<p className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">Henüz görünür kullanıcı yok.</p>}
    </section>
  </div></main>;
}
