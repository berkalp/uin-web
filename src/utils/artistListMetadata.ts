export const ARTIST_LISTS = [
  {id:"spotify_global_100",label:"Spotify Dünya Top 100 · Aylık dinleyici",limit:100,metric:"monthly"},
  {id:"spotify_global_500",label:"Spotify Dünya Top 500 · Aylık dinleyici",limit:500,metric:"monthly"},
  {id:"tr_wrapped_2025",label:"Spotify Türkiye Top 20 · 2025",limit:20,metric:"annual"},
  {id:"tr_groups_wrapped_2025",label:"Spotify Türkiye Gruplar Top 10 · 2025",limit:10,metric:"annual"},
  {id:"youtube_tr_100",label:"YouTube Türkiye Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_gb_100",label:"YouTube Birleşik Krallık Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_de_100",label:"YouTube Almanya Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_us_100",label:"YouTube ABD Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_jp_100",label:"YouTube Japonya Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_kr_100",label:"YouTube Güney Kore Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_sa_100",label:"YouTube Suudi Arabistan Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_in_100",label:"YouTube Hindistan Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_br_100",label:"YouTube Brezilya Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
  {id:"youtube_fr_100",label:"YouTube Fransa Top 100 · Haftalık dinlenme",limit:100,metric:"weekly"},
] as const;
export type ArtistListId=(typeof ARTIST_LISTS)[number]["id"];
export type RegionalArtistChart={rank:number;asOf:string;sourceUrl:string;weeklyViews:number;region:string};
export type ArtistStats={monthlyListeners:number|null;globalRank:number|null;asOf:string|null;sourceUrl:string|null;listRanks:Partial<Record<ArtistListId,number>>;listSourceUrl:string|null;regionalCharts?:Partial<Record<ArtistListId,RegionalArtistChart>>};
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
  const regionalCharts:NonNullable<ArtistStats["regionalCharts"]>={};
  const regional=m.artist_regional_charts??m.regionalCharts;
  if(regional&&typeof regional==="object")for(const list of ARTIST_LISTS.filter(l=>l.metric==="weekly")){
    const raw=(regional as Record<string,unknown>)[list.id];if(!raw||typeof raw!=="object")continue;
    const row=raw as Record<string,unknown>,rank=positive(row.rank),weeklyViews=positive(row.weekly_views??row.weeklyViews),sourceUrl=url(row.source_url??row.sourceUrl),date=row.as_of??row.asOf;
    const expectedRegion=list.id.split('_')[1].toUpperCase();
    if(rank&&rank<=list.limit&&weeklyViews&&sourceUrl&&typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&row.region===expectedRegion&&sourceUrl===`https://charts.youtube.com/charts/TopArtists/${expectedRegion.toLowerCase()}/weekly/${date}`)
      regionalCharts[list.id]={rank,weeklyViews,sourceUrl,asOf:date,region:expectedRegion};
  }
  return {monthlyListeners,globalRank,asOf,sourceUrl,listRanks,listSourceUrl,regionalCharts};
}
export function artistListRank(stats:ArtistStats|null|undefined,id:ArtistListId):number|null{
  const list=ARTIST_LISTS.find(l=>l.id===id);if(!list||!stats)return null;
  const rank=list.metric==="monthly"?stats.globalRank:list.metric==="weekly"?stats.regionalCharts?.[id]?.rank:stats.listRanks[id];
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
  for(const [id,label] of [["youtube_tr_100","Türkiye"],["youtube_gb_100","Birleşik Krallık"],["youtube_de_100","Almanya"],["youtube_us_100","ABD"],["youtube_jp_100","Japonya"],["youtube_kr_100","Güney Kore"],["youtube_sa_100","Suudi Arabistan"],["youtube_in_100","Hindistan"],["youtube_br_100","Brezilya"],["youtube_fr_100","Fransa"]] as const){const chart=stats.regionalCharts?.[id];if(chart)rows.push({text:`YouTube ${label} · #${chart.rank}`,description:`${label} bölgesindeki haftalık dinlenmeler · ${new Intl.NumberFormat('tr-TR').format(chart.weeklyViews)} · ${chart.asOf.split('-').reverse().join('.')} haftası`,url:chart.sourceUrl})}
  return rows;
}
