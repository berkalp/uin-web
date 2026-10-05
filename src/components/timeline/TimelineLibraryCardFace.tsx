import type {ReactNode} from "react";
import CardRatingBadge from "@/components/cards/CardRatingBadge";
import PersonalLibraryCard from "@/components/cards/PersonalLibraryCard";

export default function TimelineLibraryCardFace({title,category,status,coverUrl,href,location,dateLabel,dnaTitles=[],metrics,targetId,action}:{title:string;category:string;status:string;coverUrl?:string|null;href?:string;location?:string|null;dateLabel?:string|null;dnaTitles?:string[];metrics?:ReactNode;targetId?:string|null;action?:ReactNode}){
  return <div className="uin-timeline-card-frame overflow-hidden rounded-[26px] peer-checked:hidden">
    <PersonalLibraryCard
      title={title}
      coverUrl={coverUrl}
      badge={category}
      icon="✦"
      href={href}
      cornerMeta={<span className="flex flex-col items-end gap-1"><CardRatingBadge targetId={targetId} compact/><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-violet-800 shadow-sm">{status}</span></span>}
      summary={(dnaTitles.length||dateLabel||location)?<div className="space-y-1 font-semibold">{dnaTitles.length>0&&<div className="flex flex-wrap gap-1.5" aria-label="Etkinlik DNA kartları">{dnaTitles.slice(0,2).map(title=><span key={title} className="rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[9px] font-black text-white">⌁ {title}</span>)}{dnaTitles.length>2&&<span className="rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[9px] font-black text-white">+{dnaTitles.length-2}</span>}</div>}{dateLabel&&<p>📅 {dateLabel}</p>}{location&&<p className="line-clamp-1">📍 {location}</p>}</div>:null}
      metrics={metrics}
      action={action}
    />
  </div>;
}
