begin;
set local lock_timeout='10s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- Some older intents still point at a legacy target identity. Card summaries
-- correctly resolve that identity to the canonical card, but the catalogue
-- used to join the resolved summary back to the unresolved input id. That
-- missing join silently rendered every metric as zero.
create or replace function public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
with requested as materialized (
  select id,public.resolve_uin_card_target_v129(id) resolved_id,position
  from unnest(coalesce(p_target_ids,array[]::uuid[])) with ordinality input(id,position)
), summaries as materialized (
  select value row
  from public.get_uin_card_summary_v129(coalesce(p_target_ids,array[]::uuid[])) value
)
select jsonb_build_object(
  'canonical_target_id',target.id,
  'canonical_kind',target.kind,
  'source_seed_id',null,
  'title',target.title,
  'subtitle',coalesce(summary.row->>'creator_name',target.creator_name,community.name),
  'seed_type_name',coalesce(seed_type.name,category.name),
  'seed_type_slug',coalesce(nullif(target.editorial_metadata->>'action_key',''),case when target.kind='live_match' then 'sport-live' else seed_type.slug end),
  'seed_type_icon',coalesce(nullif(target.editorial_metadata->>'display_icon',''),case when target.kind='live_match' then '🏟️' else coalesce(seed_type.icon,'🌱') end),
  'subject_type',nullif(target.editorial_metadata->>'subject_type',''),
  'item_kind',coalesce(catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'place'),
  'content_type_id',coalesce(summary.row->>'type_id',catalogue.metadata->>'content_type_id',catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'place'),
  'primary_category_id',coalesce(catalogue.primary_category_id,target.primary_category_id),
  'cover_url',coalesce(target.editorial_cover_url,catalogue.cover_url,activity.default_cover_url,category.default_cover_url),
  'catalog_cover_url',catalogue.cover_url,
  'own_seed_id',own_seed.id,
  'own_common_intent_id',null,
  'intent_people_count',coalesce((summary.row->>'wanting')::integer,0),
  'experience_people_count',coalesce((summary.row->>'done')::integer,0),
  'active_event_count',coalesce((summary.row->>'active')::integer,0),
  'social_intent_count',coalesce((summary.row->>'active')::integer,0),
  'completed_event_count',coalesce((summary.row->>'completed')::integer,0),
  'expired_event_count',coalesce((summary.row->>'expired')::integer,0),
  'cancelled_event_count',coalesce((summary.row->>'cancelled')::integer,0),
  'child_count',coalesce((summary.row->>'child_count')::integer,0),
  'activity_id',target.activity_id,
  'sport_name',sport.name,
  'community_name',community.name,
  'updated_at',coalesce(catalogue.updated_at,target.updated_at)
)
from requested
join public.canonical_targets target on target.id=requested.id
left join summaries summary on (summary.row->>'target_id')::uuid=requested.resolved_id
left join public.activities activity on activity.id=target.activity_id
left join public.activity_categories category on category.id=activity.category_id
left join public.sports sport on sport.id=target.sport_id
left join public.communities community on community.id=target.primary_community_id
left join lateral (
  select item.*
  from public.seed_catalog_items item
  where item.canonical_target_id=target.id and item.status='active'
  order by item.updated_at desc,item.id
  limit 1
) catalogue on true
left join public.seed_types seed_type on seed_type.id=catalogue.seed_type_id
left join lateral (
  select seed.id
  from public.seeds seed
  where seed.canonical_target_id=target.id and seed.user_id=auth.uid()
    and seed.status in ('active','completed')
  order by seed.updated_at desc
  limit 1
) own_seed on true
where public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
order by requested.position;
$function$;

revoke all on function public.get_uin_catalogue_for_targets_v123(uuid[]) from public;
grant execute on function public.get_uin_catalogue_for_targets_v123(uuid[]) to anon,authenticated;
notify pgrst,'reload schema';
commit;
