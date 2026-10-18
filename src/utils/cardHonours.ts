import {artistBadges,readArtistMetadata} from './artistListMetadata';
import {gameHonours,readGameCatalogue} from './gameCatalogue';

export type CardHonour={label:string;url:string;note:string;kind:'award'|'ranking'|'stat'|'title';year?:number};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
const https=(v:unknown)=>{try{const u=new URL(text(v));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
const year=(v:unknown)=>Number.isInteger(Number(v))&&Number(v)>=1800&&Number(v)<=2100?Number(v):undefined;
/** One sourced presentation for every category; no inferred awards or inherited club trophies. */
export function readCardHonours(value:unknown):CardHonour[]{
 const m=object(value),rows:CardHonour[]=[];
 const add=(label:string,url:unknown,note:string,kind:CardHonour['kind'],y?:number)=>{const link=https(url);if(label&&link&&note)rows.push({label,url:link,note,kind,...(y?{year:y}:{})})};
 for(const raw of Array.isArray(m.card_honours)?m.card_honours:[]){const h=object(raw);if(['award','ranking','stat','title'].includes(text(h.kind)))add(text(h.label),h.url,text(h.note),h.kind as CardHonour['kind'],year(h.year))}
 for(const raw of Array.isArray(m.book_awards)?m.book_awards:[]){const h=object(raw),y=year(h.year);if(!y)continue;const author=h.scope==='author';add(`${author?'✍️':'🏆'} ${y} · ${text(h.label)}${author?' · Yazar ödülü':''}`,h.sourceUrl??h.source_url,author?`${text(h.recipient)||'Kitabın yazarı'} için verilen ödül; kitabın kendi ödülü değildir.`:'Kitaba verilen ödül.', 'award',y)}
 for(const raw of Array.isArray(m.series_awards)?m.series_awards:[]){const h=object(raw),y=year(h.year);if(!y)continue;const years=Array.isArray(h.years)?[...new Set(h.years.map(year).filter(Boolean))].sort((a,b)=>Number(b)-Number(a)):[y];add(`🏆 ${text(h.label)}${years.length>1?` · ${years.length} kez`:` · ${y}`}`,h.sourceUrl??h.source_url,`Kazandığı yıllar: ${years.join(', ')}.`, 'award',y)}
 for(const h of gameHonours(readGameCatalogue(m)))add(h.label,h.url,h.note,h.label.includes('🏆')?'award':'ranking');
 for(const h of artistBadges(readArtistMetadata(m.artist_stats??m)))add(h.text,h.url,h.description,h.text.includes('#')?'ranking':'stat');
 const rank=Number(m.imdb_top_250_rank??m.imdb_top_100_rank),asOf=text(m.imdb_top_tv_250_as_of??m.imdb_top_250_as_of??m.imdb_top_100_as_of),source=https(m.source_url);
 if(Number.isInteger(rank)&&rank>0&&/^\d{4}-\d{2}-\d{2}$/.test(asOf)&&source.includes('imdb.com/chart/'))add(`IMDb · #${rank}`,source,`${asOf} tarihindeki liste sırası; anlık değildir.`,'ranking');
 const seen=new Set<string>();return rows.filter(h=>{const key=`${h.label}|${h.url}`;if(seen.has(key))return false;seen.add(key);return true});
}
