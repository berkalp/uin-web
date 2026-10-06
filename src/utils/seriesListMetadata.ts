export const SERIES_LISTS = [
  {id:"emmy_drama_30",label:"Emmy Drama · Son 30 yıl",rangeLabel:"yeniden eskiye"},
  {id:"emmy_comedy_30",label:"Emmy Komedi · Son 30 yıl",rangeLabel:"yeniden eskiye"},
  {id:"emmy_limited_30",label:"Emmy Mini/Limited Dizi · Son 30 yıl",rangeLabel:"yeniden eskiye"},
] as const;

export type SeriesListId=(typeof SERIES_LISTS)[number]["id"];
export type SeriesAward={id:SeriesListId;label:string;year:number;years:number[];winCount:number;sourceUrl?:string};
export type SeriesListMetadata={seriesLists:SeriesListId[];seriesListRanks:Partial<Record<SeriesListId,number>>;seriesAwards:SeriesAward[]};

export function readSeriesListMetadata(value:unknown):SeriesListMetadata{
  const metadata=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const valid=new Set<string>(SERIES_LISTS.map(list=>list.id));
  const seriesLists=Array.isArray(metadata.series_lists)?metadata.series_lists.filter((id):id is SeriesListId=>typeof id==="string"&&valid.has(id)):[];
  const rawRanks=metadata.series_list_ranks&&typeof metadata.series_list_ranks==="object"?metadata.series_list_ranks as Record<string,unknown>:{};
  const seriesListRanks:Partial<Record<SeriesListId,number>>={};
  for(const id of seriesLists){const rank=Number(rawRanks[id]);if(Number.isInteger(rank)&&rank>0&&rank<=250)seriesListRanks[id]=rank}
  const seriesAwards=Array.isArray(metadata.series_awards)?metadata.series_awards.flatMap((value):SeriesAward[]=>{
    if(!value||typeof value!=="object")return [];
    const award=value as Record<string,unknown>;const year=Number(award.year);const id=award.id;
    if(typeof id!=="string"||!valid.has(id)||typeof award.label!=="string"||!Number.isInteger(year))return [];
    const years=Array.isArray(award.years)?award.years.map(Number).filter(item=>Number.isInteger(item)).sort((a,b)=>b-a):[year];
    const winCount=Math.max(1,Number(award.win_count)||years.length);
    return [{id:id as SeriesListId,label:award.label,year,years,winCount,sourceUrl:typeof award.source_url==="string"?award.source_url:undefined}];
  }):[];
  return {seriesLists,seriesListRanks,seriesAwards};
}
