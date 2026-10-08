begin;
set local lock_timeout='30s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- Legacy identities contribute people/events but are not real child cards. Use
-- a structural-only walk for the badge shown on the parent card.
create or replace function public.get_uin_card_visible_children_v137(p_parent_target_id uuid)
returns table(target_id uuid)
language sql stable security definer set search_path=public,pg_temp as $function$
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
  where relation.related_target_id=p_parent_target_id and relation.relation_type='source_material';
$function$;

create or replace function public.get_uin_card_visible_descendant_count_v137(p_target_id uuid)
returns integer
language sql stable security definer set search_path=public,pg_temp as $function$
  with recursive walk as (
    select p_target_id id,0 level,array[p_target_id] visited
    union all
    select child.id,walk.level+1,walk.visited||child.id
    from walk
    cross join lateral public.get_uin_card_visible_children_v137(walk.id) edge
    join public.canonical_targets child on child.id=edge.target_id
    where walk.level<12 and not child.id=any(walk.visited)
      and (public.is_admin() or coalesce((child.editorial_metadata->>'admin_hidden')::boolean,false)=false)
  )
  select count(distinct id)::integer from walk where level>0;
$function$;

create or replace function public.get_uin_card_summary_v129(p_target_ids uuid[])
returns setof jsonb
language sql stable security definer set search_path=public,pg_temp as $function$
  with requested as materialized (
    select distinct public.resolve_uin_card_target_v129(value) target_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) value
  ), base as materialized (
    select summary
    from public.get_uin_card_summary_v107((select array_agg(target_id) from requested)) summary
  )
  select jsonb_set(
    base.summary,'{child_count}',
    to_jsonb(public.get_uin_card_visible_descendant_count_v137((base.summary->>'target_id')::uuid)),true
  )
  from base;
$function$;

revoke all on function public.get_uin_card_visible_children_v137(uuid),public.get_uin_card_visible_descendant_count_v137(uuid),public.get_uin_card_summary_v129(uuid[]) from public;
grant execute on function public.get_uin_card_summary_v129(uuid[]) to anon,authenticated;
notify pgrst,'reload schema';
commit;
