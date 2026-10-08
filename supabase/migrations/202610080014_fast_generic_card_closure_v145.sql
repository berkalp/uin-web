begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- The legacy resolver is called for every card in a category batch. Most ids
-- are already structural targets, so answer that case by canonical_target_id.
-- Legacy Turkish city aliases use the normalized-city index instead of
-- normalizing every TR city row for every requested card.
create index if not exists uin_place_nodes_tr_city_target_v145_idx
on public.uin_place_nodes_v123(canonical_target_id)
where scope='city' and country_code='TR';

create index if not exists uin_place_nodes_tr_city_normalized_v145_idx
on public.uin_place_nodes_v123(
  public.canonical_normalize_v31(city),source_key
) include(canonical_target_id)
where scope='city' and country_code='TR';

analyze public.uin_place_nodes_v123;

create or replace function public.resolve_uin_card_target_v129(p_target_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
declare
  v_title text;
  v_resolved uuid;
begin
  if p_target_id is null then
    return null;
  end if;

  -- The canonical structural city is already the desired identity.
  if exists(
    select 1
    from public.uin_place_nodes_v123 node
    where node.canonical_target_id=p_target_id
      and node.scope='city'
      and node.country_code='TR'
  ) then
    return p_target_id;
  end if;

  select target.title into v_title
  from public.canonical_targets target
  where target.id=p_target_id;

  if not found then
    return p_target_id;
  end if;

  select node.canonical_target_id into v_resolved
  from public.uin_place_nodes_v123 node
  where node.scope='city'
    and node.country_code='TR'
    and public.canonical_normalize_v31(node.city)=public.canonical_normalize_v31(v_title)
  order by node.source_key
  limit 1;

  return coalesce(v_resolved,p_target_id);
end;
$function$;

-- A SQL function is planned with a generic uuid[] parameter. v144 joined each
-- recursive child to canonical_targets for admin_hidden, so the generic row
-- estimate selected a full-table hash join twice. The function returned nine
-- rows but scanned all ~72K targets on every recursive iteration.
--
-- Evaluate is_admin once and keep the visibility lookup as an OFFSET 0 scalar
-- subplan. That preserves the exact hidden-card contract while forcing a PK
-- lookup for each real child. Recursive UNION remains the global cycle/path
-- dedupe introduced by v144.
create or replace function public.get_uin_card_structural_closure_v143(p_target_ids uuid[])
returns table(requested_id uuid,target_id uuid,depth integer)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with recursive viewer as materialized (
    select public.is_admin() is_admin
  ), requested as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) requested_id,
      viewer.is_admin
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
    join public.canonical_targets target on target.id=input.id
    cross join viewer
  ), walk(requested_id,target_id,viewer_is_admin) as (
    select requested.requested_id,requested.requested_id,requested.is_admin
    from requested

    union

    select walk.requested_id,child.target_id,walk.viewer_is_admin
    from walk
    cross join lateral public.get_uin_card_visible_children_v137(walk.target_id) child
    where walk.viewer_is_admin
       or coalesce((
         select not coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)
         from public.canonical_targets target
         where target.id=child.target_id
         offset 0
       ),false)
  )
  select walk.requested_id,walk.target_id,
    case when walk.target_id=walk.requested_id then 0 else 1 end::integer depth
  from walk
  order by walk.requested_id,depth,walk.target_id;
$function$;

-- Keep internal helpers internal and preserve the public compatibility RPCs.
revoke all on function
  public.get_uin_card_structural_closure_v143(uuid[])
from public;

grant execute on function
  public.resolve_uin_card_target_v129(uuid)
to anon,authenticated;

notify pgrst,'reload schema';
commit;
