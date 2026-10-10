"use client";

import type {PlaceConnectionContext} from "@/utils/placeConnectionContext";
import type {Place} from "@/utils/placeGeography";

type Props={
  targetId:string;
  places?:Place[];
  context?:PlaceConnectionContext|null;
  onOpen?:(place:Place)=>void;
};

export default function PlaceConnections({targetId,places:providedPlaces,context,onOpen}:Props){
  const places=providedPlaces||[];
  const place=places.find(item=>item.id===targetId)||context?.place;

  if(!place)return <section role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Yer bağlantıları eksik geldi. Kartı kapatıp yeniden açarak tekrar dene.</section>;

  const children=["İl","Şehir"].includes(place.kind)
    ?places.filter(item=>item.id!==place.id&&(item.parentTargetId===place.id||item.cityId===place.id||item.cityId===place.wikiId)&&!["İl","Şehir"].includes(item.kind))
    :[];
  const location=[place.kind,place.district,place.city,place.country].filter((value,index,all)=>value&&all.indexOf(value)===index).join(" · ");
  const browseHref=`/ideas?kind=place&city=${encodeURIComponent(place.wikiId||place.id)}`;
  const knownChildCount=context?.childCount;
  const childrenKnown=knownChildCount!==null&&knownChildCount!==undefined;

  return <section className="mt-5 space-y-4" aria-label="Yer bağlantıları">
    {location?<p className="text-sm font-semibold text-gray-600">{location}</p>:null}
    <div className="flex flex-wrap gap-4">
      {place.mapUrl?<a href={place.mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-700">Haritada aç ↗</a>:null}
      {place.sourceUrl?<a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500">Konum kaynağı ↗</a>:null}
    </div>
    {["İl","Şehir"].includes(place.kind)?<div>
      <h4 className="font-black">{place.title}’da keşfet</h4>
      {children.length?<>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{children.map(child=>onOpen?<button type="button" key={child.id} onClick={()=>onOpen(child)} className="rounded-xl border p-2 text-left">{child.coverUrl?<img src={child.coverUrl} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover"/>:null}<span className="mt-2 block text-sm font-bold">{child.title}</span></button>:<a key={child.id} href={`/ideas?kind=place&targetId=${encodeURIComponent(child.id)}`} className="rounded-xl border p-2 text-sm font-bold">{child.title} ↗</a>)}</div>
        <a href={browseHref} className="mt-3 inline-block text-sm font-bold text-emerald-700">Tümünü gör →</a>
      </>:knownChildCount&&knownChildCount>0?<p className="mt-2 text-sm text-gray-600">{knownChildCount} bağlı yer bulunuyor. <a href={browseHref} className="font-bold text-emerald-700">Yer kategorisinde gör →</a></p>:childrenKnown?<p className="mt-2 text-sm text-gray-500">Bu şehre bağlı başka bir yer kartı henüz bulunmuyor.</p>:<p role="status" className="mt-2 text-sm text-amber-800">Bağlı yer listesi bu görünümde doğrulanamadı. <a href={browseHref} className="font-bold text-emerald-700">Yer kategorisinde yeniden yükle →</a></p>}
    </div>:null}
  </section>;
}
