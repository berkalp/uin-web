"use client";
import TogetherProposal from '@/components/seeds/TogetherProposal';
import {sharedWishWords} from '@/utils/sharedWish';
export default function SharedWishHighlight({targetId,recipientId,name,title,kind}:{targetId:string;recipientId:string;name:string;title:string;kind:string}) {
 const copy=sharedWishWords(kind,name);
 return <>
  <div aria-hidden="true" className="uin-shared-wish-frame pointer-events-none absolute inset-0 z-20 rounded-[inherit]"/>
  <div className="uin-shared-wish-center absolute left-1/2 top-1/2 z-30 w-[82%] -translate-x-1/2 -translate-y-1/2 text-center" onClick={event=>event.stopPropagation()}>
   <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2"><span className="inline-block rounded-full bg-emerald-950/95 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-lg">✨ Ortak isteğiniz</span><p className="mt-1 rounded-xl bg-slate-950/90 px-2 py-1.5 text-[11px] font-semibold text-white">{copy.message}</p></div>
   <TogetherProposal targetId={targetId} recipientId={recipientId} name={name} title={title} buttonLabel={`${copy.recipient} · ${copy.button}`} loadOptionsOnOpen />
  </div>
 </>;
}
