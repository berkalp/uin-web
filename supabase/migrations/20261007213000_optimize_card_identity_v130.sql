begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create index if not exists seed_catalog_items_place_normalized_title_v130_idx
on public.seed_catalog_items (public.canonical_normalize_v31(canonical_title))
where status='active' and item_kind='place' and canonical_target_id is not null;

-- Card counters only need the selected structural target and any legacy card
-- with the same Turkish city name. Walking every descendant made anonymous
-- mobile requests exceed the API statement timeout.
create or replace function public.get_uin_card_identity_targets_v129(p_target_id uuid)
returns table(target_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with root as materialized (
    select public.resolve_uin_card_target_v129(p_target_id) id
  ), root_card as materialized (
    select target.id,target.title
    from root join public.canonical_targets target on target.id=root.id
  ), legacy_city as materialized (
    select distinct item.canonical_target_id target_id
    from root_card
    join public.seed_catalog_items item
      on item.status='active' and item.item_kind='place'
     and item.canonical_target_id is not null
     and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(root_card.title)
    where exists (
      select 1 from public.uin_place_nodes_v123 node
      where node.canonical_target_id=root_card.id and node.scope='city' and node.country_code='TR'
    )
  )
  select id from root
  union
  select target_id from legacy_city;
$function$;

-- Build the summary from the same focused people/event readers as the opened
-- card. Do not call the descendant-wide legacy summary for a city card.
create or replace function public.get_uin_card_summary_v129(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
with requested as materialized (
  select distinct public.resolve_uin_card_target_v129(value) target_id
  from unnest(coalesce(p_target_ids,array[]::uuid[])) value
), identity as materialized (
  select requested.target_id requested_id,linked.target_id
  from requested
  cross join lateral public.get_uin_card_identity_targets_v129(requested.target_id) linked
), wanting_people as materialized (
  select identity.requested_id,person->>'user_id' user_id
  from identity
  cross join lateral public.get_uin_card_people_v80(identity.target_id,'intent',100,0) person
), done_people as materialized (
  select identity.requested_id,person->>'user_id' user_id
  from identity
  cross join lateral public.get_uin_card_people_v80(identity.target_id,'experience',100,0) person
), raw_events as materialized (
  select identity.requested_id,event->>'event_state' event_state,
    coalesce(event->>'resource_id',event->>'plan_id',event->>'intent_id') resource_id
  from identity
  cross join lateral public.get_uin_card_events_v80(identity.target_id) event
), events as materialized (
  select distinct on(requested_id,resource_id) requested_id,event_state
  from raw_events
  order by requested_id,resource_id
)
select jsonb_build_object(
  'target_id',target.id,
  'wanting',(select count(distinct user_id) from wanting_people where requested_id=target.id),
  'done',(select count(distinct user_id) from done_people where requested_id=target.id),
  'active',(select count(*) from events where requested_id=target.id and event_state='active'),
  'completed',(select count(*) from events where requested_id=target.id and event_state='completed'),
  'expired',(select count(*) from events where requested_id=target.id and event_state='expired'),
  'cancelled',(select count(*) from events where requested_id=target.id and event_state='cancelled'),
  'type_id',target.editorial_metadata->>'content_type_id',
  'creator_name',target.creator_name,
  'editorial_cover_url',target.editorial_cover_url,
  'child_count',(select count(*) from public.uin_place_nodes_v123 child where child.parent_target_id=target.id)
)
from requested
join public.canonical_targets target on target.id=requested.target_id;
$function$;

grant execute on function public.get_uin_card_identity_targets_v129(uuid) to anon,authenticated;
grant execute on function public.get_uin_card_summary_v129(uuid[]) to anon,authenticated;
notify pgrst,'reload schema';
commit;
