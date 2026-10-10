function score(value:number){return Number.isInteger(value)?String(value):value.toFixed(1).replace(".",",")}

function rating(value:number|null|undefined){
  return typeof value==="number"&&Number.isFinite(value)&&value>0&&value<=10?value:null;
}

function count(value:number|null|undefined){
  return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value:null;
}

export default function CardRatingBadge({targetId,averageRating,personalRating,ratingCount,imdbRank,imdbRating,compact=false}:{targetId?:string|null;averageRating?:number|null;personalRating?:number|null;ratingCount?:number|null;imdbRank?:number|null;imdbRating?:number|null;compact?:boolean}){
  const average=rating(averageRating);
  const personal=rating(personalRating);
  const imdb=rating(imdbRating);
  const ratings=count(ratingCount);
  const authoritativeUnrated=averageRating===null&&ratings===0;
  const ratingUnknown=average===null&&!authoritativeUnrated;
  const topRated=[personal,average,imdb].some(value=>value!==null&&value>=9);
  const hasRatingContext=Boolean(targetId)||averageRating!==undefined||personalRating!==undefined||ratingCount!==undefined||imdbRating!==undefined;
  if(!hasRatingContext)return null;
  return <span className={`flex flex-col items-end gap-1 ${topRated?"uin-perfect-score":""}`}>
    {authoritativeUnrated&&personal===null&&<span className={`rounded-full bg-white/95 font-black text-slate-600 shadow-sm ${compact?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>Henüz puan yok</span>}
    {ratingUnknown&&<span title="Puan özeti bu listede yüklenmedi; kartı açınca görebilirsin." className={`rounded-full bg-white/95 font-black text-slate-500 shadow-sm ${compact?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>{personal!==null?"Ortalama · —":"Puan · —"}</span>}
    {imdb!==null&&<span className={`rounded-full border border-amber-400 bg-amber-300/95 font-black text-amber-950 shadow-sm ${compact?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>IMDb{typeof imdbRank==="number"?` #${imdbRank}`:""} · ★ {imdb.toFixed(1)}/10</span>}
    {personal!==null&&<span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm">Puanım {score(personal)}/10</span>}
    {average!==null&&<span className={`rounded-full border ${topRated?"border-amber-300":"border-transparent"} bg-white/95 font-black text-amber-700 shadow-sm ${compact||personal!==null?"px-2.5 py-1 text-[10px]":"px-3 py-1.5 text-xs"}`}>{personal!==null?"Ortalama ":"★ "}{score(average)}/10{ratings!==null&&ratings>0?` · ${ratings}`:""}</span>}
  </span>;
}
