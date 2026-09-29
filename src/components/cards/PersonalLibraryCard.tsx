"use client";
import Link from "next/link";
import type {ReactNode} from "react";

export default function PersonalLibraryCard({title,subtitle,coverUrl,coverPositionY=50,badge,icon,href,onOpen,cornerMeta,summary,metrics,action}:{title:string;subtitle?:string|null;coverUrl?:string|null;coverPositionY?:number;badge:string;icon?:string|null;href?:string;onOpen?:()=>void;cornerMeta?:ReactNode;summary?:ReactNode;metrics?:ReactNode;action:ReactNode}){
  const heading=<h2 className="line-clamp-2 text-xl font-black leading-tight text-white">{title}</h2>;
  return <article className="uin-perfect-card group relative flex min-h-[510px] min-w-0 flex-col overflow-hidden rounded-[26px] border border-slate-700 bg-slate-950 shadow-[0_14px_34px_-20px_rgba(15,23,42,.65)] transition-shadow hover:shadow-[0_22px_46px_-20px_rgba(15,23,42,.7)]">
    {coverUrl?<img src={coverUrl} alt="" loading="lazy" style={{objectPosition:`50% ${coverPositionY}%`}} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"/>:<div className="absolute inset-0 grid place-items-center bg-black text-7xl">{icon||"🌱"}</div>}
    <div className="pointer-events-none absolute inset-0 bg-slate-950/25"/>
    <div className="relative z-10 flex items-start justify-between gap-2 p-3"><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-emerald-800 shadow-sm">{icon} {badge}</span>{cornerMeta?<span>{cornerMeta}</span>:onOpen?<button type="button" onClick={onOpen} aria-label={`${title} kartını aç`} className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-sm shadow">👁</button>:href?<Link href={href} aria-label={`${title} kartını aç`} className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-sm shadow">👁</Link>:null}</div>
    <div className="min-h-[190px] flex-1"/>
    <div className="relative z-10 m-3 rounded-[20px] border border-white/15 bg-slate-950/85 p-3 text-white shadow-xl backdrop-blur-md">
      {onOpen?<button type="button" onClick={onOpen} className="block w-full text-left">{heading}</button>:href?<Link href={href} className="block">{heading}</Link>:heading}
      {summary&&<div className="mt-3 text-xs text-white/80">{summary}</div>}
      {metrics&&<div className="mt-3">{metrics}</div>}
      <div className="mt-2">{action}</div>
    </div>
  </article>;
}
