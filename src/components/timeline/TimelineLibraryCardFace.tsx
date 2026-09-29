import Link from "next/link";
import type {ReactNode} from "react";

export default function TimelineLibraryCardFace({title,category,status,coverUrl,href,location,dateLabel,metrics}:{title:string;category:string;status:string;coverUrl?:string|null;href?:string;location?:string|null;dateLabel?:string|null;metrics?:ReactNode}){
  return <>
    {coverUrl?<img src={coverUrl} alt="" className="absolute inset-0 z-0 h-full w-full object-cover peer-checked:hidden"/>:<div className="absolute inset-0 z-0 bg-slate-950 peer-checked:hidden"/>}
    <div className="pointer-events-none absolute inset-0 z-0 bg-slate-950/30 peer-checked:hidden"/>
    <div className="relative z-10 flex min-h-0 flex-1 flex-col p-3 peer-checked:hidden">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-emerald-800 shadow-sm">{category}</span>
        <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-violet-800 shadow-sm">{status}</span>
      </div>
      <div className="min-h-[145px] flex-1"/>
      <div className="rounded-[20px] border border-white/15 bg-slate-950/85 p-3 text-white shadow-xl backdrop-blur-md">
        {href?<Link href={href} className="block"><h2 className="line-clamp-2 text-xl font-black leading-tight">{title}</h2></Link>:<h2 className="line-clamp-2 text-xl font-black leading-tight">{title}</h2>}
        {(dateLabel||location)&&<div className="mt-2 space-y-1 text-xs font-semibold text-white/75">{dateLabel&&<p>📅 {dateLabel}</p>}{location&&<p className="line-clamp-1">📍 {location}</p>}</div>}
        {metrics&&<div className="mt-3">{metrics}</div>}
      </div>
    </div>
  </>;
}
