create table public.uin_library_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  preference_key text not null check (length(preference_key) between 1 and 500),
  value jsonb check (octet_length(value::text) <= 8192),
  primary key (user_id, preference_key),
  constraint library_preference_shape check (
    (preference_key = 'categories' and jsonb_typeof(value) = 'array')
    or (preference_key like 'sort:%' and jsonb_typeof(value) in ('string','null'))
  )
);
alter table public.uin_library_preferences enable row level security;
revoke all on public.uin_library_preferences from public, anon, authenticated;
grant select, insert, update on public.uin_library_preferences to authenticated;
create policy library_preferences_read on public.uin_library_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy library_preferences_insert on public.uin_library_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy library_preferences_update on public.uin_library_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function uin_private.latest_library_placements_v188(
 p_before_time timestamptz default null,p_before_id uuid default null,p_audience text default 'everyone',p_categories text[] default null
) returns jsonb language sql stable security definer
set search_path=public,pg_temp set jit=off as $$
 with activity as materialized (select * from uin_private.latest_library_activity_v187(p_audience))
  select coalesce(jsonb_agg(to_jsonb(placement) order by placement.last_activity_at desc, placement.canonical_target_id desc), '[]'::jsonb)
  from (
    select ci.id, c.id canonical_target_id, c.created_at, a.last_activity_at,
      ci.item_kind, ci.canonical_title, ci.creator_name, ci.cover_url,
      coalesce((select ct.id from public.uin_card_content_types_v177 m
        join public.uin_content_types ct on ct.id=m.content_type_id and ct.active
        where m.target_id=c.id
        order by coalesce(ct.id=any(p_categories),false) desc, (ct.id=coalesce(c.editorial_metadata->>'content_type_id',ci.metadata->>'content_type_id',ci.item_kind)) desc, ct.id limit 1), ci.item_kind) content_type_id,
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
    from activity a
    join public.canonical_targets c on c.id=a.target_id
    join lateral (
      select item.* from public.seed_catalog_items item
      where item.canonical_target_id=c.id and item.status='active'
      order by item.updated_at desc, item.id desc limit 1
    ) ci on true
    where ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
      and exists (select 1 from public.uin_card_content_types_v177 m
        join public.uin_content_types ct on ct.id=m.content_type_id and ct.active where m.target_id=c.id and (coalesce(cardinality(p_categories),0)=0 or ct.id=any(p_categories)))
      and (p_before_time is null or (a.last_activity_at,c.id)<(p_before_time,p_before_id))
    order by a.last_activity_at desc, c.id desc limit 21
  ) placement;
$$;
revoke all on function uin_private.latest_library_placements_v188(timestamptz,uuid,text,text[]) from public;
revoke all on function uin_private.latest_library_placements_v188(timestamptz,uuid,text,text[]) from anon,authenticated;
create or replace function public.get_uin_latest_placements_v188(
 p_before_time timestamptz default null,p_before_id uuid default null,p_audience text default 'everyone',p_categories text[] default null
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select case when p_audience not in ('everyone','friends','me')
   or cardinality(p_categories)>100
   or (p_audience<>'everyone' and (select auth.uid()) is null) then '[]'::jsonb
 else uin_private.latest_library_placements_v188(p_before_time,p_before_id,p_audience,p_categories) end;
$$;
revoke all on function public.get_uin_latest_placements_v188(timestamptz,uuid,text,text[]) from public;
grant execute on function public.get_uin_latest_placements_v188(timestamptz,uuid,text,text[]) to anon,authenticated;
notify pgrst, 'reload schema';
