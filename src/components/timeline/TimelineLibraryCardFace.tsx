import type {ReactNode} from "react";
import CardRatingBadge from "@/components/cards/CardRatingBadge";
import PersonalLibraryCard from "@/components/cards/PersonalLibraryCard";

export default function TimelineLibraryCardFace({title,category,status,coverUrl,href,location,dateLabel,metrics,targetId,action}:{title:string;category:string;status:string;coverUrl?:string|null;href?:string;location?:string|null;dateLabel?:string|null;metrics?:ReactNode;targetId?:string|null;action?:ReactNode}){
  return <div className="h-full peer-checked:hidden [&>article]:h-full">
    <PersonalLibraryCard
      title={title}
      coverUrl={coverUrl}
      badge={category}
      icon="✦"
      href={href}
      cornerMeta={<span className="flex flex-col items-end gap-1"><CardRatingBadge targetId={targetId} compact/><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-violet-800 shadow-sm">{status}</span></span>}
      summary={(dateLabel||location)?<div className="space-y-1 font-semibold">{dateLabel&&<p>📅 {dateLabel}</p>}{location&&<p className="line-clamp-1">📍 {location}</p>}</div>:null}
      metrics={metrics}
      action={action}
      className="h-full"
    />
  </div>;
}
