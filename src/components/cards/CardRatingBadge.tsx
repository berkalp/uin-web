"use client";
import {useEffect,useState} from "react";

function score(value:number){return Number.isInteger(value)?String(value):value.toFixed(1).replace(".",",")}

export default function CardRatingBadge({targetId,averageRating,personalRating,ratingCount,imdbRank,imdbRating,compact=false}:{targetId?:string|null;averageRating?:number|null;personalRating?:number|null;ratingCount?:number;imdbRank?:number|null;imdbRating?:number|null;compact?:boolean}){
  const [average,setAverage]=useState<number|null>(typeof averageRating==="number"?averageRating:null);
  useEffect(()=>{if(!targetId||typeof averageRating==="number")return;const controller=new AbortController();void fetch(`/api/ideas/${encodeURIComponent(targetId)}?summary=1`,{cache:"no-store",signal:controller.signal}).then(async response=>response.ok?response.json():null).then(body=>{const value=Number(body?.averageRating);if(Number.isFinite(value)&&value>0)setAverage(value)}).catch(()=>{});return()=>controller.abort()},[targetId,averageRating]);
  const noRating=typeof personalRating!=="number"&&average===null&&typeof imdbRating!=="number";
  const topRated=[personalRating,average,imdbRating].some(value=>typeof value==="number"&&value>=9&&value<=10);
  return <span className={`flex flex-col items-end gap-1 ${topRated?"uin-perfect-score":""}`}>
    {noRating&&<span className={`rounded-full bg-white/95 font-black text-slate-600 shadow-sm ${compact?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>Henüz puan yok</span>}
    {typeof imdbRating==="number"&&<span className={`rounded-full border border-amber-400 bg-amber-300/95 font-black text-amber-950 shadow-sm ${compact?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>IMDb{typeof imdbRank==="number"?` #${imdbRank}`:""} · ★ {imdbRating.toFixed(1)}/10</span>}
    {typeof personalRating==="number"&&<span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm">Puanım {score(personalRating)}/10</span>}
    {average!==null&&<span className={`rounded-full border ${topRated?"border-amber-300":"border-transparent"} bg-white/95 font-black text-amber-700 shadow-sm ${compact||typeof personalRating==="number"?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>{typeof personalRating==="number"?"Ortalama ":"★ "}{score(average)}/10{ratingCount?` · ${ratingCount}`:""}</span>}
  </span>;
}
