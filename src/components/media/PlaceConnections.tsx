"use client";
import LinkedLibraryCards from '@/components/cards/LinkedLibraryCards';
import {useEffect,useRef,useState} from 'react';
import type {PlaceConnectionContext} from '@/utils/placeConnectionContext';
import type {Place} from '@/utils/placeGeography';
type Node={target_id:string;title:string;scope:string|null;cover_url:string|null;catalog_item_id:string|null};
type Props={targetId:string;places?:Place[];context?:PlaceConnectionContext|null;onOpen?:(place:Place)=>void};
export default function PlaceConnections(props:Props){return <PlaceConnectionList key={props.targetId} {...props}/>;}
function PlaceConnectionList({targetId,places=[],context}:Props){
 const[rows,setRows]=useState<Node[]>([]),[total,setTotal]=useState<number|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);const generation=useRef(0);
 const place=places.find(x=>x.id===targetId)??context?.place;
 async function load(offset=0,version=generation.current){setBusy(true);setError('');try{const r=await fetch(`/api/places/children?target=${encodeURIComponent(targetId)}&offset=${offset}`);const body=await r.json();if(!r.ok||!Array.isArray(body.nodes)||!Number.isSafeInteger(body.total))throw Error(body.error??'Bağlı yerler doğrulanamadı.');if(version!==generation.current)return;setRows(old=>offset?[...old,...body.nodes]:body.nodes);setTotal(body.total)}catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Bağlı yerler yüklenemedi.')}finally{if(version===generation.current)setBusy(false)}}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{const version=++generation.current;void Promise.resolve().then(()=>{if(version===generation.current)return load(0,version)});return()=>{generation.current++}},[targetId]);
 return <section className="mt-5 space-y-3" aria-label="Yer bağlantıları"><h4 className="font-black">İlçeler ve bağlı yerler{total!=null?` · ${total}`:''}</h4>{place?.mapUrl?<a className="text-sm font-bold text-emerald-700" href={place.mapUrl} target="_blank" rel="noopener noreferrer">Haritada aç ↗</a>:null}<LinkedLibraryCards ids={rows.map(n=>n.target_id)}/>{busy?<p role="status" className="text-sm">Bağlı yerler yükleniyor…</p>:null}{error?<button role="alert" onClick={()=>void load(rows.length)} className="text-sm text-red-700">{error} · Yeniden dene</button>:null}{!busy&&!error&&total===0?<p className="text-sm text-slate-500">Bu karta bağlı başka bir yer henüz yok.</p>:null}{!busy&&!error&&total!=null&&rows.length<total?<button onClick={()=>void load(rows.length)} className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">Daha fazla göster · {total-rows.length} kaldı</button>:null}</section>;
}
