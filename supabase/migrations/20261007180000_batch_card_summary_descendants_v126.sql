-- Calculate descendant summaries in batches. The former implementation called
-- the visibility helpers once for every requested card/descendant pair, which
-- made a city level request exceed the API statement timeout.

create index if not exists canonical_targets_hierarchy_parent_v126_idx
on public.canonical_targets ((coalesce(
  nullif(editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
  nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
  nullif(editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
)));

create or replace function public.get_uin_card_descendants_v81(
  p_target_id uuid,
  p_include_self boolean default true
)
returns table(target_id uuid,depth integer)
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
with recursive walk as (
  select p_target_id as id,0 as level,array[p_target_id] as visited
  union all
  select child.id,walk.level+1,walk.visited||child.id
  from walk
  join public.canonical_targets child on coalesce(
    nullif(child.editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
    nullif(child.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
    nullif(child.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
  )=walk.id
  where walk.level<12
    and not child.id=any(walk.visited)
    and (public.is_admin() or coalesce((child.editorial_metadata->>'admin_hidden')::boolean,false)=false)
)
select id,level from walk where p_include_self or level>0;
$function$;

create or replace function public.get_uin_card_summary_v107(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
with requested as materialized (
  select distinct value as requested_id
  from unnest(coalesce(p_target_ids, array[]::uuid[])) value
), closure as materialized (
  select requested.requested_id, descendants.target_id
  from requested
  cross join lateral public.get_uin_card_descendants_v81(requested.requested_id, true) descendants
), unique_targets as materialized (
  select distinct target_id from closure
), canonical_people as materialized (
  select closure.requested_id, seed.canonical_target_id as target_id, seed.user_id,
    case when seed.status='completed' then 'completed' else coalesce(state.relationship_status,'want') end as relationship_status,
    case when seed.status<>'completed' then seed.target_date end as target_date
  from closure
  join public.seeds seed on seed.canonical_target_id=closure.target_id
  left join public.seed_personal_state_v15 state on state.seed_id=seed.id and state.user_id=seed.user_id
  where seed.status in ('active','completed')
    and public.seed_is_visible_to_viewer(seed.user_id,seed.visibility,auth.uid())
    and (coalesce(to_jsonb(seed)->>'seed_scope','library')<>'private' or seed.user_id=auth.uid())
    and not exists(select 1 from public.seed_catalog_items rejected where rejected.id=seed.catalog_item_id and rejected.status='rejected')
  union all
  select closure.requested_id, personal.target_id, personal.user_id,
    case when personal.status='completed' then 'completed' else 'want' end,
    case when personal.status='active' then personal.end_date end
  from closure
  join public.canonical_personal_intents_v38 personal on personal.target_id=closure.target_id
  where personal.status in ('active','completed')
    and public.personal_common_intent_visible_v38(personal.user_id,personal.visibility,auth.uid())
), linked_events as materialized (
  select target.target_id, intent.id as intent_id
  from unique_targets target
  join public.intents intent on intent.canonical_target_id=target.target_id
  union
  select target.target_id, link.intent_id
  from unique_targets target
  join public.seed_catalog_items item on item.canonical_target_id=target.target_id
  join public.seeds seed on seed.catalog_item_id=item.id
  join public.seed_intent_links link on link.seed_id=seed.id
  union
  select target.target_id, link.intent_id
  from unique_targets target
  join public.seeds seed on seed.canonical_target_id=target.target_id
  join public.seed_intent_links link on link.seed_id=seed.id
  union
  select target.target_id, intent.id
  from unique_targets target
  join public.canonical_targets card on card.id=target.target_id
  join public.locations location on lower(btrim(card.title)) in (
    lower(btrim(coalesce(location.district,''))),
    lower(btrim(coalesce(location.city,''))),
    lower(btrim(coalesce(location.country_name,'')))
  )
  join public.intents intent on intent.location_id=location.id
  where card.editorial_metadata->>'content_type_id'='place'
     or exists (
       select 1 from public.seed_catalog_items place_item
       where place_item.canonical_target_id=card.id and place_item.item_kind='place'
     )
), event_rows as materialized (
  select linked.target_id, intent.id as intent_id, coalesce(plan.id,intent.id) as resource_id,
    case
      when coalesce(intent.status,'') in ('cancelled','canceled') or coalesce(plan.status,'') in ('cancelled','canceled') then 'cancelled'
      when coalesce(intent.status,'')='completed' or coalesce(plan.status,'')='completed' then 'completed'
      when coalesce(plan.scheduled_end::date,intent.end_date,plan.scheduled_start::date,intent.start_date)<(now() at time zone 'Europe/Istanbul')::date then 'expired'
      else 'active'
    end as event_state
  from linked_events linked
  join public.intents intent on intent.id=linked.intent_id
  left join lateral (
    select candidate.id,candidate.status,candidate.scheduled_start,candidate.scheduled_end
    from public.plan_intents plan_link
    join public.plans candidate on candidate.id=plan_link.plan_id
    where plan_link.intent_id=intent.id and plan_link.status='active'
    order by plan_link.linked_at desc
    limit 1
  ) plan on true
  where intent.status in ('active','planned','completed','cancelled','canceled')
    and public.intent_is_visible_to_viewer_v38(intent.id,auth.uid())
), raw_events as materialized (
  select closure.requested_id,
    jsonb_build_object('event_state',target_events.event_state) as event,
    target_events.resource_id::text as resource_id
  from closure
  join event_rows target_events on target_events.target_id=closure.target_id
), events as materialized (
  select distinct on (requested_id, resource_id) requested_id, event
  from raw_events
  order by requested_id, resource_id
), people_stats as (
  select requested_id,
    count(distinct user_id) filter (
      where relationship_status='want'
        and (target_date is null or target_date >= (now() at time zone 'Europe/Istanbul')::date)
    ) as wanting,
    count(distinct user_id) filter (where relationship_status='completed') as done
  from canonical_people
  group by requested_id
), event_stats as (
  select requested_id,
    count(*) filter (where event->>'event_state'='active') as active,
    count(*) filter (where event->>'event_state'='completed') as completed,
    count(*) filter (where event->>'event_state'='expired') as expired,
    count(*) filter (where event->>'event_state'='cancelled') as cancelled
  from events
  group by requested_id
)
select jsonb_build_object(
  'target_id', target.id,
  'wanting', coalesce(people.wanting,0),
  'done', coalesce(people.done,0),
  'active', coalesce(event_stats.active,0),
  'completed', coalesce(event_stats.completed,0),
  'expired', coalesce(event_stats.expired,0),
  'cancelled', coalesce(event_stats.cancelled,0),
  'type_id', target.editorial_metadata->>'content_type_id',
  'creator_name', target.creator_name,
  'editorial_cover_url', target.editorial_cover_url,
  'child_count', (select count(*) from closure child where child.requested_id=target.id and child.target_id<>target.id)
)
from requested
join public.canonical_targets target on target.id=requested.requested_id
left join people_stats people on people.requested_id=target.id
left join event_stats on event_stats.requested_id=target.id;
$function$;

create or replace function public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
with requested as materialized (
  select id, position
  from unnest(coalesce(p_target_ids,array[]::uuid[])) with ordinality input(id,position)
), closure as materialized (
  select requested.id as requested_id, descendants.target_id
  from requested
  cross join lateral public.get_uin_card_descendants_v81(requested.id,true) descendants
), people as materialized (
  select closure.requested_id, seed.user_id,
    case when seed.status='completed' then 'completed' else coalesce(state.relationship_status,'want') end as relationship_status,
    case when seed.status<>'completed' then seed.target_date end as target_date
  from closure
  join public.seeds seed on seed.canonical_target_id=closure.target_id
  left join public.seed_personal_state_v15 state on state.seed_id=seed.id and state.user_id=seed.user_id
  where seed.status in ('active','completed')
    and public.seed_is_visible_to_viewer(seed.user_id,seed.visibility,auth.uid())
    and (coalesce(to_jsonb(seed)->>'seed_scope','library')<>'private' or seed.user_id=auth.uid())
    and not exists(select 1 from public.seed_catalog_items rejected where rejected.id=seed.catalog_item_id and rejected.status='rejected')
  union all
  select closure.requested_id, personal.user_id,
    case when personal.status='completed' then 'completed' else 'want' end,
    case when personal.status='active' then personal.end_date end
  from closure
  join public.canonical_personal_intents_v38 personal on personal.target_id=closure.target_id
  where personal.status in ('active','completed')
    and public.personal_common_intent_visible_v38(personal.user_id,personal.visibility,auth.uid())
), people_stats as (
  select requested_id,
    count(distinct user_id) filter (
      where relationship_status='want'
        and (target_date is null or target_date >= (now() at time zone 'Europe/Istanbul')::date)
    ) as wanting,
    count(distinct user_id) filter (where relationship_status='completed') as done
  from people
  group by requested_id
), linked_events as materialized (
  select closure.requested_id, intent.id as intent_id
  from closure
  join public.intents intent on intent.canonical_target_id=closure.target_id
), event_rows as materialized (
  select linked.requested_id, coalesce(plan.id,intent.id) as resource_id,
    case
      when coalesce(intent.status,'') in ('cancelled','canceled') or coalesce(plan.status,'') in ('cancelled','canceled') then 'cancelled'
      when coalesce(intent.status,'')='completed' or coalesce(plan.status,'')='completed' then 'completed'
      when coalesce(plan.scheduled_end::date,intent.end_date,plan.scheduled_start::date,intent.start_date)<(now() at time zone 'Europe/Istanbul')::date then 'expired'
      else 'active'
    end as event_state
  from linked_events linked
  join public.intents intent on intent.id=linked.intent_id
  left join lateral (
    select candidate.id,candidate.status,candidate.scheduled_start,candidate.scheduled_end
    from public.plan_intents plan_link
    join public.plans candidate on candidate.id=plan_link.plan_id
    where plan_link.intent_id=intent.id and plan_link.status='active'
    order by plan_link.linked_at desc
    limit 1
  ) plan on true
  where intent.status in ('active','planned','completed','cancelled','canceled')
    and (intent.user_id=auth.uid() or intent.visibility in ('public','everyone'))
), event_stats as (
  select requested_id,
    count(distinct resource_id) filter (where event_state='active') as active,
    count(distinct resource_id) filter (where event_state='completed') as completed,
    count(distinct resource_id) filter (where event_state='expired') as expired,
    count(distinct resource_id) filter (where event_state='cancelled') as cancelled
  from event_rows
  group by requested_id
)
select jsonb_build_object(
  'canonical_target_id',target.id,
  'canonical_kind',target.kind,
  'source_seed_id',null,
  'title',target.title,
  'subtitle',coalesce(target.creator_name,community.name),
  'seed_type_name',coalesce(seed_type.name,category.name),
  'seed_type_slug',coalesce(nullif(target.editorial_metadata->>'action_key',''),case when target.kind='live_match' then 'sport-live' else seed_type.slug end),
  'seed_type_icon',coalesce(nullif(target.editorial_metadata->>'display_icon',''),case when target.kind='live_match' then '🏟️' else coalesce(seed_type.icon,'🌱') end),
  'subject_type',nullif(target.editorial_metadata->>'subject_type',''),
  'item_kind',coalesce(catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'place'),
  'content_type_id',coalesce(target.editorial_metadata->>'content_type_id',catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'place'),
  'primary_category_id',coalesce(catalogue.primary_category_id,target.primary_category_id),
  'cover_url',coalesce(target.editorial_cover_url,catalogue.cover_url,activity.default_cover_url,category.default_cover_url),
  'catalog_cover_url',catalogue.cover_url,
  'own_seed_id',own_seed.id,
  'own_common_intent_id',null,
  'intent_people_count',coalesce(people_stats.wanting,0),
  'experience_people_count',coalesce(people_stats.done,0),
  'active_event_count',coalesce(event_stats.active,0),
  'social_intent_count',coalesce(event_stats.active,0),
  'completed_event_count',coalesce(event_stats.completed,0),
  'expired_event_count',coalesce(event_stats.expired,0),
  'cancelled_event_count',coalesce(event_stats.cancelled,0),
  'child_count',(select count(*) from closure child where child.requested_id=target.id and child.target_id<>target.id),
  'activity_id',target.activity_id,
  'sport_name',sport.name,
  'community_name',community.name,
  'updated_at',coalesce(catalogue.updated_at,target.updated_at)
)
from requested
join public.canonical_targets target on target.id=requested.id
left join people_stats on people_stats.requested_id=target.id
left join event_stats on event_stats.requested_id=target.id
left join public.activities activity on activity.id=target.activity_id
left join public.activity_categories category on category.id=activity.category_id
left join public.sports sport on sport.id=target.sport_id
left join public.communities community on community.id=target.primary_community_id
left join lateral (
  select item.* from public.seed_catalog_items item
  where item.canonical_target_id=target.id and item.status='active'
  order by item.updated_at desc,item.id limit 1
) catalogue on true
left join public.seed_types seed_type on seed_type.id=catalogue.seed_type_id
left join lateral (
  select seed.id from public.seeds seed
  where seed.canonical_target_id=target.id and seed.user_id=auth.uid() and seed.status in ('active','completed')
  order by seed.updated_at desc limit 1
) own_seed on true
where public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
order by requested.position;
$function$;

notify pgrst, 'reload schema';
