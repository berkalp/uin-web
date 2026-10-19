-- Add ranking to the existing activity feed without changing its audience,
-- category selection, canonical identities, or any user's history.
create or replace function uin_private.ranked_library_placements_v216(
 p_sort text, p_audience text default 'everyone', p_categories text[] default null,
 p_before_value numeric default null, p_before_tie bigint default null,
 p_before_time timestamptz default null, p_before_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path='' set jit=off as $fn$
begin
 if p_sort is null or p_sort not in ('likes','ratingDesc','wanting','done','active')
   or p_audience is null or p_audience not in ('everyone','friends','me')
   or (p_audience<>'everyone' and (select auth.uid()) is null)
   or cardinality(p_categories)>100 then return '[]'::jsonb; end if;
 if (p_before_value is null and (p_before_tie is not null or p_before_time is not null or p_before_id is not null))
   or (p_before_value is not null and (p_before_value<0 or p_before_value::text in ('NaN','Infinity','-Infinity') or p_before_tie is null or p_before_tie<0 or p_before_time is null or p_before_id is null))
   then raise exception 'Geçersiz sayfa.' using errcode='22023'; end if;
 return (
 with activity as materialized (
   select a.* from uin_private.latest_library_activity_v187(p_audience) a
   join public.canonical_targets c on c.id=a.target_id
   where ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
   and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=c.id and ci.status='active')
   and exists(select 1 from public.uin_card_content_types_v177 m
     join public.uin_content_types ct on ct.id=m.content_type_id and ct.active
     where m.target_id=c.id and (coalesce(cardinality(p_categories),0)=0 or ct.id=any(p_categories)))
 ), ids as materialized (select coalesce(array_agg(target_id),array[]::uuid[]) ids from activity),
 summaries as materialized (
   select row from public.get_uin_card_summary_v143(case when p_sort in ('wanting','done','active') then (select ids from ids) else array[]::uuid[] end) row
 ), ratings as materialized (
   select row from public.get_uin_card_ratings_v85(case when p_sort='ratingDesc' then (select ids from ids) else array[]::uuid[] end) row
 ), liked_seeds as materialized (
   select s.id,s.canonical_target_id,count(*) n
   from public.seed_experience_likes l join public.seeds s on s.id=l.seed_id
   where p_sort='likes' and public.seed_experience_is_visible_to_viewer(s.id,(select auth.uid()))
   and (coalesce(s.seed_scope,'library')<>'private' or s.user_id=(select auth.uid()))
   and not exists(select 1 from public.seed_catalog_items ci where ci.id=s.catalog_item_id and ci.status='rejected')
   group by s.id,s.canonical_target_id
 ), likes as materialized (
   select tree.requested_id,sum(s.n) n
   from (select distinct requested_id,target_id from public.get_uin_card_closure_v143(
     case when p_sort='likes' then (select ids from ids) else array[]::uuid[] end,true)) tree
   join liked_seeds s on s.canonical_target_id=tree.target_id group by tree.requested_id
 ), scored as materialized (
   select a.*, case p_sort
     when 'likes' then coalesce(l.n,0)
     when 'ratingDesc' then coalesce((r.row->>'average_rating')::numeric,0)
     else coalesce((s.row->>p_sort)::numeric,0) end sort_value,
     case when p_sort='ratingDesc' then coalesce((r.row->>'rating_count')::bigint,0) else 0 end sort_tie
   from activity a left join summaries s on s.row->>'target_id'=a.target_id::text
   left join ratings r on r.row->>'target_id'=a.target_id::text
   left join likes l on l.requested_id=a.target_id
 ), page as materialized (
   select * from scored where p_before_value is null
     or (sort_value,sort_tie,last_activity_at,target_id)<(p_before_value,p_before_tie,p_before_time,p_before_id)
   order by sort_value desc,sort_tie desc,last_activity_at desc,target_id desc limit 21
 )
 select coalesce(jsonb_agg(to_jsonb(placement) order by placement.sort_value desc,placement.sort_tie desc,placement.last_activity_at desc,placement.canonical_target_id desc),'[]'::jsonb)
 from (
    select ci.id, c.id canonical_target_id, c.created_at, a.last_activity_at, a.sort_value, a.sort_tie,
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
    from page a join public.canonical_targets c on c.id=a.target_id
    join lateral (select item.* from public.seed_catalog_items item
      where item.canonical_target_id=c.id and item.status='active'
      order by item.updated_at desc,item.id desc limit 1) ci on true
 ) placement);
end;
$fn$;
revoke all on function uin_private.ranked_library_placements_v216(text,text,text[],numeric,bigint,timestamptz,uuid) from public,anon,authenticated;
grant usage on schema uin_private to anon,authenticated;
grant execute on function uin_private.ranked_library_placements_v216(text,text,text[],numeric,bigint,timestamptz,uuid) to anon,authenticated;

-- The exposed wrapper runs as the caller. The private helper enforces the
-- same auth.uid()-based visibility checks even when called directly in SQL.
create or replace function public.get_uin_ranked_placements_v216(
 p_sort text, p_audience text default 'everyone', p_categories text[] default null,
 p_before_value numeric default null, p_before_tie bigint default null,
 p_before_time timestamptz default null, p_before_id uuid default null
) returns jsonb language sql stable security invoker set search_path='' as $fn$
 select uin_private.ranked_library_placements_v216(p_sort,p_audience,p_categories,p_before_value,p_before_tie,p_before_time,p_before_id);
$fn$;
revoke all on function public.get_uin_ranked_placements_v216(text,text,text[],numeric,bigint,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.get_uin_ranked_placements_v216(text,text,text[],numeric,bigint,timestamptz,uuid) to anon,authenticated;
notify pgrst,'reload schema';
