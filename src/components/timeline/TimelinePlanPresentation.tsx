import Link from "next/link";

import LifecycleCurrentDate from "../activities/LifecycleCurrentDate";
import ActivityPeopleStrip from "../activities/ActivityPeopleStrip";
import PlanWeatherBadges from "../weather/PlanWeatherBadges";
import type { IntentCommunityContext } from "../../utils/communities";
import type { IntentLinkView } from "../../utils/intentLinks";
import type { ActivityPersonView } from "../../utils/activityPeople";

type TimelinePlanPresentationProps = {
  planId: string; title: string; canonicalActivityName: string; categoryName: string; coverUrl: string | null;
  countryName: string | null; locationScope: string | null; city: string | null; district: string | null;
  activityLocationName: string | null; activityAddressText: string | null; latitude: number | string | null; longitude: number | string | null; mapUrl: string | null;
  hostName: string; hostAvatarUrl: string | null; isCurrentUserHost: boolean; people: ActivityPersonView[]; currentUserId: string; activityHref: string;
  participantCount: number; participantLimit: string; committedBudget: number; targetBudget: number | null; relationshipLabel: string; relationshipClasses: string;
  statusLabel: string; statusClasses: string; planStatus: "forming" | "planned" | "completed" | "cancelled"; recruitmentStatus: "open" | "full" | "closed"; requestCount: number;
  scheduledStart: string | null; scheduledEnd: string | null; timezone: string; windowStart: string; windowEnd: string; completedAt: string | null; cancelledAt: string | null; expiredAt: string | null;
  visibilityLabel: string; relatedLinks: IntentLinkView[]; communities: IntentCommunityContext[]; [key: string]: unknown;
};

function money(v:number){return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(v)}

export default function TimelinePlanPresentation(props: TimelinePlanPresentationProps){
  const {planId,title,categoryName,coverUrl,countryName,city,district,activityLocationName,activityAddressText,latitude,longitude,mapUrl,people,currentUserId,activityHref,participantCount,participantLimit,committedBudget,targetBudget,relationshipLabel,relationshipClasses,statusLabel,statusClasses,planStatus,recruitmentStatus,requestCount,scheduledStart,scheduledEnd,timezone,windowStart,windowEnd,completedAt,cancelledAt,expiredAt,visibilityLabel,communities}=props;
  const exact=Boolean(activityLocationName||activityAddressText||(latitude!==null&&longitude!==null));
  const locationLabel=exact?[activityLocationName,activityAddressText].filter(Boolean).join(", "):[district,city,countryName].filter(Boolean).join(", ");
  const query=exact&&latitude!==null&&longitude!==null?`${latitude},${longitude}`:locationLabel;
  const mapEmbedUrl=query?`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${exact?15:11}&output=embed`:null;
  const primaryCommunity=communities.find(c=>c.isPrimary)??communities[0]??null;
  return <div className="min-w-0">
    <div className="relative h-32 overflow-hidden rounded-t-3xl bg-gray-950">
      {coverUrl?<img src={coverUrl} alt={`${title} cover`} className="h-full w-full object-cover"/>:<div className="h-full bg-gradient-to-br from-gray-800 to-gray-950"/>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40"/>
      <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
        <div className="flex gap-1"><span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${statusClasses}`}>{statusLabel}</span><span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase ${relationshipClasses}`}>{relationshipLabel}</span></div>
        {recruitmentStatus!=="open"&&<span className="rounded-full bg-black/65 px-2 py-0.5 text-[8px] font-semibold uppercase text-white">{recruitmentStatus}</span>}
      </div>
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5">
        <p className="truncate text-[8px] font-bold uppercase tracking-[0.11em] text-blue-300">{categoryName}</p>
        <div className="mt-0.5 flex items-end justify-between gap-2"><h2 className="min-w-0 flex-1 line-clamp-2 text-[16px] font-bold leading-[1.1] text-white">{title}</h2>{planStatus==="planned"&&<PlanWeatherBadges planId={planId} compact/>}</div>
        <div className="mt-1 h-5">{primaryCommunity&&<Link href={`/communities/${encodeURIComponent(primaryCommunity.slug)}`} className="inline-flex max-w-[72%] items-center gap-1 rounded-full border bg-white/95 px-2 py-0.5 text-[8.5px] font-semibold text-gray-900" style={{borderColor:primaryCommunity.accentColor}}><span className="h-2 w-2 rounded-full" style={{backgroundColor:primaryCommunity.accentColor}}/><span className="truncate">{primaryCommunity.name}</span></Link>}</div>
      </div>
    </div>
    <div className="border-b border-black/5 p-2"><LifecycleCurrentDate targetStart={windowStart} targetEnd={windowEnd} scheduledStart={scheduledStart} scheduledEnd={scheduledEnd} completedAt={completedAt} cancelledAt={cancelledAt} expiredAt={expiredAt} status={planStatus} timezone={timezone} compact className="w-full"/></div>
    <div className="relative h-28 overflow-hidden border-b border-black/5 bg-gray-100">{mapEmbedUrl?<iframe title={`${title} location`} src={mapEmbedUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>:<div className="flex h-full items-center justify-center text-[10px] text-gray-400">No map</div>}{locationLabel&&<span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-full bg-gray-950/80 px-2 py-1 text-[8.5px] font-semibold text-white">📍 {locationLabel}</span>}{mapUrl&&<a href={mapUrl} target="_blank" rel="noopener noreferrer nofollow" className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-[8.5px] font-semibold text-blue-700 shadow-sm">Map ↗</a>}</div>
    <div className="grid grid-cols-2 gap-1.5 p-2 text-[10px]">{[["Participants",`${participantCount} / ${participantLimit}`],["Visibility",visibilityLabel],["Committed",`${money(committedBudget)} TL`],["Target",targetBudget===null?"Not set":`${money(targetBudget)} TL`]].map(([l,v])=><div key={l} className="min-w-0 rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm"><p className="truncate text-[7.5px] font-semibold uppercase text-gray-400">{l}</p><p className="mt-0.5 truncate font-semibold text-gray-900">{v}</p></div>)}</div>
    <div className="px-2 pb-2"><ActivityPeopleStrip people={people} currentUserId={currentUserId} activityHref={activityHref} variant="compact" maxVisible={4}/>{requestCount>0&&<p className="mt-1.5 rounded-lg bg-green-50 px-2 py-1.5 text-[9px] font-semibold text-green-700">{requestCount} request{requestCount===1?"":"s"} waiting</p>}</div>
  </div>
}
