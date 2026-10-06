begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create or replace function public.get_uin_card_summary_v107(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with requested as (
  select distinct value requested_id from unnest(coalesce(p_target_ids,array[]::uuid[])) value
 ), closure as materialized (
  select requested.requested_id,descendants.target_id from requested
  cross join lateral public.get_uin_card_descendants_v81(requested.requested_id,true) descendants
 ), canonical_people as materialized (
  select closure.requested_id,raw.target_id,raw.user_id,raw.relationship_status
  from closure join public.visible_common_target_people_v38() raw on raw.target_id=closure.target_id
  where raw.source_kind in('seed','personal') and raw.relationship_status in('want','completed')
 ), current_wanting as materialized (
  select closure.requested_id,status.user_id
  from closure
  cross join lateral public.get_uin_wanting_status_v56(array[closure.target_id]) status
  where status.target_id=closure.target_id and status.is_current
 ), raw_events as materialized (
  select closure.requested_id,event,coalesce(event->>'resource_id',event->>'plan_id',event->>'intent_id') resource_id
  from closure cross join lateral public.get_uin_card_events_v80(closure.target_id) event
 ), events as materialized (
  select distinct on(requested_id,resource_id) requested_id,event from raw_events order by requested_id,resource_id
 ), people_stats as (
  select requested_id,count(distinct user_id) wanting from current_wanting group by requested_id
 ), done_stats as (
  select requested_id,count(distinct user_id) done from canonical_people where relationship_status='completed' group by requested_id
 ), event_stats as (
  select requested_id,
   count(*) filter(where event->>'event_state'='active') active,
   count(*) filter(where event->>'event_state'='completed') completed,
   count(*) filter(where event->>'event_state'='expired') expired,
   count(*) filter(where event->>'event_state'='cancelled') cancelled
  from events group by requested_id
 )
 select jsonb_build_object(
  'target_id',target.id,'wanting',coalesce(people.wanting,0),'done',coalesce(done.done,0),
  'active',coalesce(event_stats.active,0),'completed',coalesce(event_stats.completed,0),'expired',coalesce(event_stats.expired,0),'cancelled',coalesce(event_stats.cancelled,0),
  'type_id',target.editorial_metadata->>'content_type_id','creator_name',target.creator_name,'editorial_cover_url',target.editorial_cover_url,
  'child_count',(select count(*) from closure c where c.requested_id=target.id and c.target_id<>target.id)
 )
 from requested join public.canonical_targets target on target.id=requested.requested_id
 left join people_stats people on people.requested_id=target.id
 left join done_stats done on done.requested_id=target.id
 left join event_stats on event_stats.requested_id=target.id;
$$;

revoke all on function public.get_uin_card_summary_v107(uuid[]) from public;
grant execute on function public.get_uin_card_summary_v107(uuid[]) to anon,authenticated;

notify pgrst,'reload schema';
commit;
