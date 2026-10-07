"use client";

import {useEffect,useMemo,useRef,useState} from "react";

export type PlaceMapItem={
  id:string;title:string;subtitle?:string|null;coverUrl?:string|null;
  latitude?:number|null;longitude?:number|null;parentTargetId?:string|null;
  wanting:number;done:number;active:number;
};

type LeafletMap={setView:(center:[number,number],zoom:number)=>LeafletMap;fitBounds:(bounds:Array<[number,number]>,options?:Record<string,unknown>)=>LeafletMap;remove:()=>void;invalidateSize:()=>void};
type LeafletMarker={addTo:(map:LeafletMap)=>LeafletMarker;on:(event:string,callback:()=>void)=>LeafletMarker};
type LeafletApi={map:(element:HTMLElement,options?:Record<string,unknown>)=>LeafletMap;tileLayer:(url:string,options?:Record<string,unknown>)=>{addTo:(map:LeafletMap)=>void};marker:(coordinates:[number,number],options?:Record<string,unknown>)=>LeafletMarker;divIcon:(options:Record<string,unknown>)=>unknown};

const ISTANBUL_DISTRICTS:Record<string,[number,number]>={
  adalar:[40.876,29.091],arnavutkoy:[41.185,28.741],atasehir:[40.992,29.124],avcilar:[40.979,28.721],bagcilar:[41.034,28.857],bahcelievler:[40.999,28.863],bakirkoy:[40.981,28.872],basaksehir:[41.093,28.802],bayrampasa:[41.049,28.901],besiktas:[41.043,29.009],beykoz:[41.127,29.098],beylikduzu:[41.003,28.641],beyoglu:[41.037,28.977],buyukcekmece:[41.021,28.585],catalca:[41.143,28.461],cekmekoy:[41.033,29.178],esenler:[41.043,28.876],esenyurt:[41.034,28.68],eyupsultan:[41.159,28.882],fatih:[41.019,28.949],gaziosmanpasa:[41.075,28.912],gungoren:[41.023,28.874],kadikoy:[40.991,29.027],kagithane:[41.082,28.971],kartal:[40.89,29.186],kucukcekmece:[41.0,28.794],maltepe:[40.935,29.13],pendik:[40.877,29.235],sancaktepe:[41.002,29.231],sariyer:[41.166,29.05],silivri:[41.073,28.247],sultanbeyli:[40.968,29.267],sultangazi:[41.106,28.868],sile:[41.176,29.613],sisli:[41.061,28.987],tuzla:[40.817,29.3],umraniye:[41.025,29.097],uskudar:[41.026,29.016],zeytinburnu:[41.005,28.9],istanbul:[41.0082,28.9784]
};

function key(value:string){return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/\s*\(istanbul\)\s*/g,"").trim()}
function numeric(value:number|null|undefined){return typeof value==="number"&&Number.isFinite(value)?value:null}

function resolvePoints(items:PlaceMapItem[]){
  const direct=new Map<string,[number,number]>();
  for(const item of items){const lat=numeric(item.latitude),lng=numeric(item.longitude);if(lat!==null&&lng!==null)direct.set(item.id,[lat,lng]);else if(ISTANBUL_DISTRICTS[key(item.title)])direct.set(item.id,ISTANBUL_DISTRICTS[key(item.title)]);}
  const groups=new Map<string,number>();
  return items.flatMap(item=>{const base=direct.get(item.id)||(item.parentTargetId?direct.get(item.parentTargetId):undefined);if(!base)return[];const groupKey=base.join(":");const index=groups.get(groupKey)||0;groups.set(groupKey,index+1);if(index===0)return[{...item,latitude:base[0],longitude:base[1]}];const angle=index*2.3999632297,radius=.003+.001*Math.floor(index/7);return[{...item,latitude:base[0]+Math.cos(angle)*radius,longitude:base[1]+Math.sin(angle)*radius}]});
}

async function leaflet(){
  const scope=window as unknown as {L?:LeafletApi;__uinPlaceLeafletPromise?:Promise<LeafletApi>};
  if(scope.L)return scope.L;if(scope.__uinPlaceLeafletPromise)return scope.__uinPlaceLeafletPromise;
  scope.__uinPlaceLeafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-uin-leaflet="true"]')){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.dataset.uinLeaflet="true";document.head.appendChild(link)}
    const finish=()=>scope.L?resolve(scope.L):reject(new Error("Harita yüklenemedi."));
    const existing=document.querySelector<HTMLScriptElement>('script[data-uin-leaflet="true"]');if(existing){if(scope.L)finish();else{existing.addEventListener("load",finish,{once:true});existing.addEventListener("error",()=>reject(new Error("Harita yüklenemedi.")),{once:true})}return}
    const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.async=true;script.dataset.uinLeaflet="true";script.addEventListener("load",finish,{once:true});script.addEventListener("error",()=>reject(new Error("Harita yüklenemedi.")),{once:true});document.body.appendChild(script);
  });return scope.__uinPlaceLeafletPromise;
}

export default function PlaceMapView({items,selectedId,onSelect,className=""}:{items:PlaceMapItem[];selectedId:string|null;onSelect:(id:string)=>void;className?:string}){
  const element=useRef<HTMLDivElement|null>(null),mapRef=useRef<LeafletMap|null>(null);
  const points=useMemo(()=>resolvePoints(items),[items]);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{let live=true;void leaflet().then(L=>{if(!live||!element.current)return;mapRef.current?.remove();const map=L.map(element.current,{zoomControl:true});mapRef.current=map;L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; OpenStreetMap katkıda bulunanlar',maxZoom:19}).addTo(map);for(const point of points){const active=point.id===selectedId;const icon=L.divIcon({className:"",html:`<span style="display:grid;place-items:center;width:${active?40:34}px;height:${active?40:34}px;border:${active?4:3}px solid white;border-radius:999px;background:${active?'#7c3aed':'#059669'};color:white;box-shadow:0 3px 12px #0f172a55;font-size:${active?20:17}px">📍</span>`,iconSize:[active?40:34,active?40:34],iconAnchor:[active?20:17,active?40:34]});L.marker([point.latitude,point.longitude],{icon,title:point.title}).addTo(map).on("click",()=>onSelect(point.id))}if(points.length===1)map.setView([points[0].latitude,points[0].longitude],13);else if(points.length>1)map.fitBounds(points.map(point=>[point.latitude,point.longitude]),{padding:[36,36],maxZoom:13});else map.setView([41.0082,28.9784],10);window.setTimeout(()=>map.invalidateSize(),80)}).catch(value=>setError(value instanceof Error?value.message:"Harita yüklenemedi."));return()=>{live=false;mapRef.current?.remove();mapRef.current=null}},[points,selectedId,onSelect]);
  return <div className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}><div ref={element} className="h-[560px] w-full bg-emerald-50"/>{error?<p className="absolute inset-x-3 bottom-3 rounded-xl bg-white p-3 text-sm font-bold text-red-700 shadow">{error}</p>:null}<p className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-emerald-800 shadow">{points.length} / {items.length} yer</p></div>;
}
