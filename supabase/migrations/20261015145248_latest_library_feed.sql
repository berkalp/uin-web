-- A stable, bounded catalogue feed; existing personal records are untouched.
create index if not exists canonical_targets_latest_v186_idx
  on public.canonical_targets (created_at desc, id desc);

create or replace function public.get_uin_latest_placements_v186(
  p_before_time timestamptz default null, p_before_id uuid default null
) returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(placement) order by placement.created_at desc, placement.canonical_target_id desc), '[]'::jsonb)
  from (
    select ci.id, c.id canonical_target_id, c.created_at,
      ci.item_kind, ci.canonical_title, ci.creator_name, ci.cover_url,
      coalesce((select ct.id from public.uin_card_content_types_v177 m
        join public.uin_content_types ct on ct.id=m.content_type_id and ct.active
        where m.target_id=c.id
        order by (ct.id=coalesce(c.editorial_metadata->>'content_type_id',ci.metadata->>'content_type_id',ci.item_kind)) desc, ct.id limit 1), ci.item_kind) content_type_id,
      (select jsonb_agg(m.content_type_id order by m.content_type_id)
        from public.uin_card_content_types_v177 m join public.uin_content_types ct on ct.id=m.content_type_id and ct.active
        where m.target_id=c.id) content_type_ids,
      ci.metadata->>'imdb_top_250_rank' imdb_top_250_rank,
      ci.metadata->>'imdb_top_100_rank' imdb_top_100_rank,
      ci.metadata->>'imdb_rating' imdb_rating,
      ci.metadata->'book_lists' book_lists, ci.metadata->'book_list_ranks' book_list_ranks,
      ci.metadata->'book_awards' book_awards,
      ci.metadata->'series_lists' series_lists, ci.metadata->'series_list_ranks' series_list_ranks,
      ci.metadata->'series_awards' series_awards,
      ci.metadata->'spotify_monthly_listeners' spotify_monthly_listeners,
      ci.metadata->'spotify_listener_rank' spotify_listener_rank,
      ci.metadata->>'spotify_chart_as_of' spotify_chart_as_of,
      ci.metadata->>'spotify_chart_source' spotify_chart_source,
      ci.metadata->'artist_list_ranks' artist_list_ranks,
      ci.metadata->>'artist_list_source_url' artist_list_source_url,
      ci.metadata->'artist_regional_charts' artist_regional_charts
    from public.canonical_targets c
    join lateral (
      select item.* from public.seed_catalog_items item
      where item.canonical_target_id=c.id and item.status='active'
      order by item.updated_at desc, item.id desc limit 1
    ) ci on true
    where ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
      and exists (select 1 from public.uin_card_content_types_v177 m
        join public.uin_content_types ct on ct.id=m.content_type_id and ct.active where m.target_id=c.id)
      and (p_before_time is null or (c.created_at,c.id)<(p_before_time,p_before_id))
    order by c.created_at desc, c.id desc limit 21
  ) placement;
$$;
revoke all on function public.get_uin_latest_placements_v186(timestamptz,uuid) from public;
grant execute on function public.get_uin_latest_placements_v186(timestamptz,uuid) to anon, authenticated;
