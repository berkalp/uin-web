-- Select narrow card identities before fetching wide metadata. Execute with
-- bound values so PostgreSQL plans for each category's actual size, rather
-- than reusing a generic plan across large place and smaller media categories.
-- Visibility, canonical identities, payload fields and stable ordering match v177.
create or replace function public.get_uin_type_placements_v177(
 p_content_type_id text,p_limit integer default 500,p_offset integer default 0
) returns jsonb language plpgsql stable security definer
set search_path to 'public','pg_temp' as $function$
declare result jsonb;
begin
 execute $query$
with selected as materialized (
 select ci.id,m.target_id 
 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.active
 join public.canonical_targets c on c.id=m.target_id
 join lateral(select item.id,item.updated_at from public.seed_catalog_items item where item.canonical_target_id=m.target_id and item.status='active' order by item.updated_at desc,item.id desc limit 1) ci on true
 where m.content_type_id=$1 and ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 order by ci.updated_at desc,ci.id desc limit least(greatest(coalesce($2,500),1),500) offset greatest(coalesce($3,0),0)

)
 select coalesce(jsonb_agg(to_jsonb(placement)),'[]'::jsonb) from (
 select ci.id,ci.canonical_target_id,ci.item_kind,ci.canonical_title,ci.creator_name,ci.cover_url,
 coalesce(c.editorial_metadata->>'content_type_id',ci.metadata->>'content_type_id',ci.item_kind) content_type_id,
 (select jsonb_agg(m2.content_type_id order by m2.content_type_id) from public.uin_card_content_types_v177 m2 join public.uin_content_types ct on ct.id=m2.content_type_id and ct.active where m2.target_id=m.target_id) content_type_ids,
 ci.metadata->>'imdb_top_250_rank' imdb_top_250_rank,ci.metadata->>'imdb_top_100_rank' imdb_top_100_rank,ci.metadata->>'imdb_rating' imdb_rating,
 ci.metadata->'book_lists' book_lists,ci.metadata->'book_list_ranks' book_list_ranks,ci.metadata->'book_awards' book_awards,
 ci.metadata->'series_lists' series_lists,ci.metadata->'series_list_ranks' series_list_ranks,ci.metadata->'series_awards' series_awards,
 ci.metadata->'spotify_monthly_listeners' spotify_monthly_listeners,ci.metadata->'spotify_listener_rank' spotify_listener_rank,
 ci.metadata->>'spotify_chart_as_of' spotify_chart_as_of,ci.metadata->>'spotify_chart_source' spotify_chart_source,
 ci.metadata->'artist_list_ranks' artist_list_ranks,ci.metadata->>'artist_list_source_url' artist_list_source_url,ci.metadata->'artist_regional_charts' artist_regional_charts
 from selected m join public.seed_catalog_items ci on ci.id=m.id
 join public.canonical_targets c on c.id=m.target_id
 order by ci.updated_at desc,ci.id desc
 ) placement;
 $query$ into result using p_content_type_id,p_limit,p_offset;
 return result;
end;
$function$;
notify pgrst,'reload schema';
