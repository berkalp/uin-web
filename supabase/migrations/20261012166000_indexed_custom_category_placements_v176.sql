begin;
-- Match the existing placement policy's public status='active' branch. The
-- canonical visibility projection remains responsible for hidden card access.
-- Definer execution allows the JSON type index to be used across the RLS barrier.
create or replace function public.get_uin_custom_type_placements_v176(p_content_type_id text,p_limit integer default 500,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 select coalesce(jsonb_agg(to_jsonb(placement)),'[]'::jsonb) from (
  select ci.id,ci.canonical_target_id,ci.item_kind,ci.canonical_title,ci.creator_name,ci.cover_url,
   ci.metadata->>'content_type_id' content_type_id,
   ci.metadata->>'imdb_top_250_rank' imdb_top_250_rank,ci.metadata->>'imdb_top_100_rank' imdb_top_100_rank,ci.metadata->>'imdb_rating' imdb_rating,
   ci.metadata->'book_lists' book_lists,ci.metadata->'book_list_ranks' book_list_ranks,ci.metadata->'book_awards' book_awards,
   ci.metadata->'series_lists' series_lists,ci.metadata->'series_list_ranks' series_list_ranks,ci.metadata->'series_awards' series_awards
  from public.seed_catalog_items ci
  where ci.status='active' and ci.canonical_target_id is not null and ci.metadata->>'content_type_id'=p_content_type_id
   and exists(select 1 from public.uin_content_types t where t.id=p_content_type_id and t.active and t.id<>t.base_kind)
  order by ci.updated_at desc,ci.id desc limit least(greatest(coalesce(p_limit,500),1),500) offset greatest(coalesce(p_offset,0),0)
 ) placement;
$fn$;
revoke all on function public.get_uin_custom_type_placements_v176(text,integer,integer) from public;
grant execute on function public.get_uin_custom_type_placements_v176(text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
