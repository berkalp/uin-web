begin;
set local lock_timeout='30s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- Direct children are shared by card lists, opened-card people lists and event
-- lists. Include the legacy Turkish city identity here once so every reader
-- sees the same tree without running a per-card reconciliation query.
create or replace function public.get_uin_card_direct_children_v135(p_parent_target_id uuid)
returns table(target_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select target.id
  from public.canonical_targets target
  where coalesce(
    nullif(target.editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
    nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
    nullif(target.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
  )=p_parent_target_id
  union
  select relation.source_target_id
  from public.uin_card_relations_v87 relation
  where relation.related_target_id=p_parent_target_id and relation.relation_type='source_material'
  union
  select distinct item.canonical_target_id
  from public.uin_place_nodes_v123 node
  join public.seed_catalog_items item
    on item.status='active' and item.item_kind='place'
   and item.canonical_target_id is not null
   and item.canonical_target_id<>node.canonical_target_id
   and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(node.city)
  where node.canonical_target_id=p_parent_target_id and node.scope='city' and node.country_code='TR';
$function$;

-- v107 already aggregates all requested trees in one set-based query. The old
-- wrapper repeated people/event readers for every card and descendant. Resolve
-- legacy roots, then delegate the whole batch once.
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
  )
  select summary
  from public.get_uin_card_summary_v107((select array_agg(target_id) from requested)) summary;
$function$;

revoke all on function public.get_uin_card_direct_children_v135(uuid),public.get_uin_card_summary_v129(uuid[]) from public;
grant execute on function public.get_uin_card_summary_v129(uuid[]) to anon,authenticated;
notify pgrst,'reload schema';
commit;
