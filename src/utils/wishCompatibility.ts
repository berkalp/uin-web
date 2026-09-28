export type MatchWish={user_id?:string;start_date?:string|null;end_date?:string|null;timing_precision?:string;date_options?:string[];location?:string|null;viewing_context?:{mode?:string;sport?:string;match?:string}|null};
const norm=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('tr-TR').trim();
export function wishCompatibility(own:MatchWish|undefined,other:MatchWish){
 const reasons:string[]=[];let score=0;if(!own||own.user_id===other.user_id)return {score,reasons};
 const a=own.viewing_context,b=other.viewing_context;
 const conflict=Boolean(a?.mode&&b?.mode&&a.mode!=='undecided'&&b.mode!=='undecided'&&a.mode!==b.mode)||Boolean(a?.sport&&b?.sport&&norm(a.sport)!==norm(b.sport))||Boolean(a?.match&&b?.match&&norm(a.match)!==norm(b.match));
 if(conflict)return {score:-1,reasons:['Tercihleriniz farklı']};
 const start=(w:MatchWish)=>w.start_date?.slice(0,10);const end=(w:MatchWish)=>(w.end_date||w.start_date)?.slice(0,10);
 const inRange=(d:string,w:MatchWish)=>Boolean(start(w)&&end(w)&&d>=start(w)!&&d<=end(w)!);
 const dates=(w:MatchWish)=>w.timing_precision==='multiple'?(w.date_options||[]).map(d=>d.slice(0,10)):null;
 const ad=dates(own),bd=dates(other);
 const overlaps=ad&&bd?ad.some(d=>bd.includes(d)):ad?ad.some(d=>inRange(d,other)):bd?bd.some(d=>inRange(d,own)):Boolean(start(own)&&start(other)&&start(own)!<=end(other)!&&start(other)!<=end(own)!);
 if(overlaps){score+=4;reasons.push('Tarihleriniz örtüşüyor')}else if(!start(own)||!start(other)){score+=1;reasons.push('Zaman tercihi esnek')}else{score-=4;reasons.push('Tarihleriniz örtüşmüyor')}
 const parts=(s?:string|null)=>(s||'').split(',').map(norm).filter(Boolean);const ap=parts(own.location),bp=parts(other.location);const cityA=ap.length>1?ap[ap.length-2]:null,cityB=bp.length>1?bp[bp.length-2]:null;
 if(cityA&&cityA===cityB){score+=3;reasons.push('Aynı şehirde')}else if(ap.length>1&&bp.length>1&&own.location&&other.location&&norm(own.location)===norm(other.location)){score+=3;reasons.push('Aynı konumda')}
 if(a?.mode&&a.mode!=='undecided'&&a.mode===b?.mode){score+=2;reasons.push('İzleme tercihiniz aynı')}
 if(a?.sport&&b?.sport&&norm(a.sport)===norm(b.sport)){score+=1;reasons.push('Branş tercihiniz aynı')}
 return {score,reasons};
}
