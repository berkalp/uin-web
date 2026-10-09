"use client";

import {useRouter,useSearchParams} from "next/navigation";
import {useTransition} from "react";

type FilterOption={value:string;label:string};
type DiscoverQuickFiltersProps={
  lifecycle:string;
  scope:string;
  communityScope:string;
  communityId:string;
  followedCommunities:Array<{id:string;name:string}>;
  lifecycleOptions:readonly FilterOption[];
  scopeOptions:readonly FilterOption[];
  communityScopeOptions:readonly FilterOption[];
  counts:Record<string,number|null>;
};

export default function DiscoverQuickFilters({scope,scopeOptions,counts}:DiscoverQuickFiltersProps){
  const router=useRouter();
  const searchParams=useSearchParams();
  const [isPending,startTransition]=useTransition();
  function select(nextScope:string){
    const params=new URLSearchParams(searchParams.toString());
    params.delete("page");
    if(nextScope==="all")params.delete("scope");else params.set("scope",nextScope);
    const query=params.toString();
    startTransition(()=>router.replace(query?`/discover?${query}`:"/discover",{scroll:false}));
  }
  return <nav aria-label="Etkinlik sahipliği" className="mb-4 flex gap-2 overflow-x-auto rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
    {scopeOptions.map(option=>{const active=scope===option.value;const count=counts[option.value];return <button key={option.value} type="button" disabled={isPending} onClick={()=>select(option.value)} aria-current={active?"page":undefined} className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-4 text-sm font-black transition disabled:cursor-wait disabled:opacity-60 ${active?"border-emerald-500 bg-emerald-50 text-emerald-800":"border-gray-200 bg-white text-slate-700 hover:border-emerald-300"}`}><span>{option.label}</span><span aria-label={count===null?"Sayı henüz yüklenmedi":undefined} className={`rounded-full px-2.5 py-1 text-xs ${active?"bg-white text-emerald-700":"bg-slate-100 text-slate-600"}`}>{count===null?"—":count}</span></button>})}
  </nav>;
}
