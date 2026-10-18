// Opt-in transport projection: the complete visibility/counter projection still
// runs first. Older clients retain the original response and all its fields.
const CATEGORY_FIELDS = [
  'canonical_target_id','created_at','last_activity_at','title','catalog_item_id','subtitle','catalog_cover_url','cover_url','cover_position_y',
  'latitude','longitude','content_type_id','content_type_ids','content_types','item_kind',
  'intent_people_count','experience_people_count','active_event_count','completed_event_count','expired_event_count','cancelled_event_count',
  'own_seed_id','own_common_intent_id','own_seed_status','parent_target_id','hierarchy_sort_order','hierarchy_section_title','hierarchy_depth','child_count',
  'average_rating','rating_count','follower_count','related_count','artist_stats','imdb_rank','imdb_rating','imdb_id',
  'card_honours','book_awards','game_catalog','book_lists','book_list_ranks','series_lists','series_list_ranks','series_awards',
] as const;
function select(row:Record<string,unknown>,keys:readonly string[]){
  return Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(row,key)).map(key=>[key,row[key]]));
}
export function mobileCategoryPayload(row:Record<string,unknown>){
  const result=select(row,CATEGORY_FIELDS);
  // The native parser already prefers catalog_cover_url, so send a URL once.
  if(result.catalog_cover_url)delete result.cover_url;
  return result;
}
export function mobileClubPayload(row:Record<string,unknown>){
  const result=select(row,['target_id','parent_target_id','title','catalogItemId','sport','league','leagues','division','season','coverUrl','cardStyle','ownStyle']);
  result.displayName=row.displayName??row.display_name;
  result.logoUrl=row.logoUrl??row.logo_url;
  return result;
}
