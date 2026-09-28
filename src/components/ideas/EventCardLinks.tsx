"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {supabase} from "@/utils/supabase/client";
type Card={target_id:string;title:string;is_main:boolean};
export default function EventCardLinks({resourceId}:{resourceId:string}){const [cards,setCards]=useState<Card[]>([]);useEffect(()=>{let alive=true;void supabase.rpc("get_uin_event_cards_v72",{p_resource_id:resourceId}).then(({data})=>{if(alive)setCards(data||[])});return()=>{alive=false}},[resourceId]);if(!cards.length)return null;return <section aria-label="Etkinliğin UIN kartları" className="flex flex-wrap gap-2 border-b bg-emerald-50/40 p-4">{cards.map(c=><Link key={c.target_id} href={"/intentions/"+c.target_id} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800">{c.is_main?"Ana UIN kartı: ":"İlgili kart: "}{c.title} ↗</Link>)}</section>}
