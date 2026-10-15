-- Rank visible user actions, never catalogue imports or editorial updates.
-- Resolve identities once, group once, then enrich only a 21-row lookahead.
create or replace function uin_private.latest_library_activity_v187(p_audience text)
returns table(target_id uuid, last_activity_at timestamptz)
language sql stable security definer set search_path=public,pg_temp set jit=off as $$
with people as materialized (
 select distinct p.target_id,p.user_id,p.source_kind,p.source_id
 from public.visible_common_target_people_v38() p
 where p_audience='everyone' or (
   p.source_kind in ('seed','personal') and p.relationship_status='want'
   and (p.target_date is null or p.target_date >= (now() at time zone 'Europe/Istanbul')::date)
   and ((p_audience='me' and p.user_id=(select auth.uid()))
     or (p_audience='friends' and p.user_id in (
       select other_user_id from public.get_my_friendships() where friendship_status='accepted'))))
), visible_events as materialized (
 select distinct i.id,i.canonical_target_id,i.created_at,i.updated_at
 from public.intents i where p_audience='everyone'
 and i.status in ('active','planned','completed')
 and public.intent_is_visible_to_viewer_v38(i.id,(select auth.uid()))
), event_activity as materialized (
 select e.id, greatest(e.created_at,e.updated_at,
   (select max(greatest(p.created_at,p.updated_at)) from public.plan_intents pi
     join public.plans p on p.id=pi.plan_id where pi.intent_id=e.id and pi.status='active'),
   (select max(ip.joined_at) from public.intent_participants ip where ip.intent_id=e.id and ip.status='active')) last_activity_at
 from visible_events e
), event_targets as (
 select e.id,e.canonical_target_id target_id from visible_events e
 union
 select e.id,coalesce(s.canonical_target_id,ci.canonical_target_id)
 from visible_events e join public.seed_intent_links l on l.intent_id=e.id
 join public.seeds s on s.id=l.seed_id left join public.seed_catalog_items ci on ci.id=s.catalog_item_id
 where public.seed_is_visible_to_viewer(s.user_id,s.visibility,(select auth.uid()))
 and (coalesce(s.seed_scope,'library')<>'private' or s.user_id=(select auth.uid()))
), actions as (
 select p.target_id,greatest(s.created_at,s.updated_at,ps.updated_at,c.created_at,c.updated_at) happened_at
 from people p
 left join public.seeds s on p.source_kind='seed' and s.id=p.source_id
 left join public.seed_personal_state_v15 ps on ps.seed_id=s.id and ps.user_id=s.user_id
 left join public.canonical_personal_intents_v38 c on p.source_kind='personal' and c.id=p.source_id
 where p.source_kind in ('seed','personal')
 union all
 select t.target_id,e.last_activity_at from event_targets t join event_activity e on e.id=t.id
), resolved as materialized (
 select public.resolve_uin_card_target_v129(a.target_id) target_id,max(a.happened_at) last_activity_at
 from actions a where a.target_id is not null and a.happened_at is not null group by a.target_id
)
select r.target_id,max(r.last_activity_at) from resolved r where r.target_id is not null group by r.target_id;
$$;
revoke all on function uin_private.latest_library_activity_v187(text) from public,anon,authenticated;

create or replace function uin_private.latest_library_placements_v187(
 p_before_time timestamptz default null,p_before_id uuid default null,p_audience text default 'everyone'
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
    from activity a
    join public.canonical_targets c on c.id=a.target_id
    join lateral (
      select item.* from public.seed_catalog_items item
      where item.canonical_target_id=c.id and item.status='active'
      order by item.updated_at desc, item.id desc limit 1
    ) ci on true
    where ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
      and exists (select 1 from public.uin_card_content_types_v177 m
        join public.uin_content_types ct on ct.id=m.content_type_id and ct.active where m.target_id=c.id)
      and (p_before_time is null or (a.last_activity_at,c.id)<(p_before_time,p_before_id))
    order by a.last_activity_at desc, c.id desc limit 21
  ) placement;
$$;
revoke all on function uin_private.latest_library_placements_v187(timestamptz,uuid,text) from public;
revoke all on function uin_private.latest_library_placements_v187(timestamptz,uuid,text) from anon,authenticated;
create or replace function public.get_uin_latest_placements_v187(
 p_before_time timestamptz default null,p_before_id uuid default null,p_audience text default 'everyone'
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select uin_private.latest_library_placements_v187(p_before_time,p_before_id,p_audience);
$$;
revoke all on function public.get_uin_latest_placements_v187(timestamptz,uuid,text) from public;
grant execute on function public.get_uin_latest_placements_v187(timestamptz,uuid,text) to anon,authenticated;
