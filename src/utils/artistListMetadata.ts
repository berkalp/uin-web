export const ARTIST_LISTS = [
  {id:"spotify_global_100",label:"Spotify Dünya Top 100 · Aylık dinleyici",limit:100,metric:"monthly"},
  {id:"spotify_global_500",label:"Spotify Dünya Top 500 · Aylık dinleyici",limit:500,metric:"monthly"},
  {id:"tr_wrapped_2025",label:"Spotify Türkiye Top 20 · 2025",limit:20,metric:"annual"},
  {id:"tr_groups_wrapped_2025",label:"Spotify Türkiye Gruplar Top 10 · 2025",limit:10,metric:"annual"},
] as const;
export type ArtistListId=(typeof ARTIST_LISTS)[number]["id"];
export type ArtistStats={monthlyListeners:number|null;globalRank:number|null;asOf:string|null;sourceUrl:string|null;listRanks:Partial<Record<ArtistListId,number>>;listSourceUrl:string|null};
const positive=(value:unknown)=>{if(value==null||value===""||typeof value==="boolean")return null;const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null};
const url=(value:unknown)=>typeof value==="string"&&/^https:\/\//.test(value)?value:null;
export function readArtistMetadata(value:unknown):ArtistStats{
  const m=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const date=m.spotify_chart_as_of??m.asOf;
  const asOf=typeof date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null;
  const sourceUrl=url(m.spotify_chart_source??m.sourceUrl);
  const monthlyListeners=asOf&&sourceUrl?positive(m.spotify_monthly_listeners??m.monthlyListeners):null;
  const globalRank=monthlyListeners?positive(m.spotify_listener_rank??m.globalRank):null;
  const listSourceUrl=url(m.artist_list_source_url??m.listSourceUrl);
  const raw=m.artist_list_ranks??m.listRanks;
  const ranks=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
  const listRanks:ArtistStats["listRanks"]={};
  if(listSourceUrl)for(const list of ARTIST_LISTS.filter(l=>l.metric==="annual")){const rank=positive(ranks[list.id]);if(rank&&rank<=list.limit)listRanks[list.id]=rank}
  return {monthlyListeners,globalRank,asOf,sourceUrl,listRanks,listSourceUrl};
}
export function artistListRank(stats:ArtistStats|null|undefined,id:ArtistListId):number|null{
  const list=ARTIST_LISTS.find(l=>l.id===id);if(!list||!stats)return null;
  const rank=list.metric==="monthly"?stats.globalRank:stats.listRanks[id];
  return rank&&rank<=list.limit?rank:null;
}
export function artistBadges(stats:ArtistStats|null|undefined):{text:string;description:string;url:string}[]{
  if(!stats)return [];
  const rows:{text:string;description:string;url:string}[]=[];
  if(stats.monthlyListeners&&stats.asOf&&stats.sourceUrl){
    const date=stats.asOf.split('-').reverse().join('.');
    const count=new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(stats.monthlyListeners);
    rows.push({text:`Spotify · ${count} aylık dinleyici`,description:`${new Intl.NumberFormat('tr-TR').format(stats.monthlyListeners)} aylık dinleyici · ${date} · Kworb / Spotify`,url:stats.sourceUrl});
    if(stats.globalRank&&stats.globalRank<=100)rows.push({text:`Dünya Top 100 · #${stats.globalRank}`,description:`Aylık dinleyiciye göre dünya sırası · ${date} · Kworb / Spotify`,url:stats.sourceUrl});
  }
  for(const [id,label] of [['tr_wrapped_2025','Türkiye Top 20'],['tr_groups_wrapped_2025','Türkiye Gruplar Top 10']] as const){const rank=stats.listRanks[id];if(rank&&stats.listSourceUrl)rows.push({text:`${label} · #${rank} · 2025`,description:'Spotify Wrapped 2025 · Türkiye’deki dinlenmeler · Rapertuar',url:stats.listSourceUrl})}
  return rows;
}
