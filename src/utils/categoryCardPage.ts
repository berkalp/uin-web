import {commonIntentTitle} from "@/utils/commonIntentTitle";

export const CATEGORY_PAGE_SIZE=20;
export const CATEGORY_PAGE_SORTS=["wanting","done","active","alphabetical"] as const;
export type CategoryPageSort=typeof CATEGORY_PAGE_SORTS[number];
export type CategoryPage={page:number;pages:number;total:number};
type Card={canonical_target_id:string;title?:unknown;item_kind?:unknown;content_type_id?:unknown;parent_target_id?:unknown;intent_people_count?:unknown;experience_people_count?:unknown;active_event_count?:unknown;social_intent_count?:unknown};

export function categoryCardPage<T extends Card>(catalogue:T[],requestedPage:number,sort:CategoryPageSort,compare?:(a:T,b:T)=>number):{catalogue:T[];pagination:CategoryPage}|null{
  // Mixed place/club categories need geography/team-specific client filters.
  // Preserve the complete response for those rather than guessing their totals.
  if(catalogue.some(card=>card.item_kind==="place"||card.item_kind==="club"))return null;
  const byId=new Map(catalogue.map(card=>[card.canonical_target_id,card]));
  const rows=catalogue.filter(card=>{
    const parent=typeof card.parent_target_id==="string"?byId.get(card.parent_target_id):undefined;
    return !parent||(parent.content_type_id||parent.item_kind)!==(card.content_type_id||card.item_kind);
  }).sort((a,b)=>{
    if(compare)return compare(a,b);
    const alphabetical=commonIntentTitle(typeof a.title==="string"?a.title:null).localeCompare(commonIntentTitle(typeof b.title==="string"?b.title:null),"tr");
    const metric=(card:T)=>Number((sort==="wanting"?card.intent_people_count:sort==="done"?card.experience_people_count:card.active_event_count??card.social_intent_count??0)||0);
    return sort==="alphabetical"?alphabetical:metric(b)-metric(a)||alphabetical;
  });
  const pages=Math.max(1,Math.ceil(rows.length/CATEGORY_PAGE_SIZE));
  const page=Math.min(Math.max(1,requestedPage),pages);
  return {catalogue:rows.slice((page-1)*CATEGORY_PAGE_SIZE,page*CATEGORY_PAGE_SIZE),pagination:{page,pages,total:rows.length}};
}
