begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- Constraint checks and parent validation address nodes by canonical target.
-- v145's index is deliberately partial to TR cities, so keep a small generic
-- index for all country/city/district nodes.
create index if not exists uin_place_nodes_target_v146_idx
on public.uin_place_nodes_v123(canonical_target_id);

-- A place identity is allowed to own structural place nodes only when its
-- active Library placements are exclusively place placements. Explicit
-- editorial typing, when present, must agree with that catalogue identity.
create or replace function public.is_uin_place_target_v146(p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select exists(
    select 1
    from public.canonical_targets target
    where target.id=p_target_id
      and (
        nullif(target.editorial_metadata->>'content_type_id','') is null
        or target.editorial_metadata->>'content_type_id'='place'
      )
      and (
        nullif(target.editorial_metadata->>'item_kind','') is null
        or target.editorial_metadata->>'item_kind'='place'
      )
      and exists(
        select 1
        from public.seed_catalog_items item
        where item.canonical_target_id=target.id
          and item.status='active'
          and item.item_kind='place'
      )
      and not exists(
        select 1
        from public.seed_catalog_items item
        where item.canonical_target_id=target.id
          and item.status='active'
          and item.item_kind<>'place'
      )
  );
$function$;

comment on function public.is_uin_place_target_v146(uuid) is
  'True only for an isolated active place catalogue identity; internal integrity helper.';

-- v145 resolved every target by a normalized Turkish city title. A book named
-- Batman therefore resolved to the already separate Batman city target. Keep
-- title fallback only for genuine legacy place aliases.
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

  -- A structural city is already the desired identity.
  if exists(
    select 1
    from public.uin_place_nodes_v123 node
    where node.canonical_target_id=p_target_id
      and node.scope='city'
      and node.country_code='TR'
  ) then
    return p_target_id;
  end if;

  -- Non-place cards can share a title with a city and must remain themselves.
  if not public.is_uin_place_target_v146(p_target_id) then
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

comment on function public.resolve_uin_card_target_v129(uuid) is
  'Resolves isolated legacy place aliases to structural TR cities; never aliases non-place cards by title.';

create or replace function public.assert_uin_place_target_v146(p_target_id uuid)
returns void
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
begin
  if p_target_id is null then
    return;
  end if;

  -- Both structural nodes and explicit place hierarchy metadata reserve a
  -- target for the place graph. Generic card/source/club hierarchy does not.
  if not exists(
       select 1 from public.uin_place_nodes_v123 node
       where node.canonical_target_id=p_target_id
     ) and not exists(
       select 1 from public.canonical_targets target
       where target.id=p_target_id
         and target.editorial_metadata ? 'place_hierarchy'
     ) then
    return;
  end if;

  if not public.is_uin_place_target_v146(p_target_id) then
    raise exception 'A structural place node must use an isolated active place target: %',p_target_id
      using errcode='23514';
  end if;
end;
$function$;

create or replace function public.guard_uin_place_node_identity_v146()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  perform public.assert_uin_place_target_v146(new.canonical_target_id);

  if new.parent_target_id is not null and not exists(
    select 1
    from public.uin_place_nodes_v123 parent
    where parent.canonical_target_id=new.parent_target_id
  ) then
    raise exception 'A structural place node parent must be another structural place target: %',new.parent_target_id
      using errcode='23514';
  end if;

  return null;
end;
$function$;

create or replace function public.guard_uin_place_catalogue_identity_v146()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if tg_op='INSERT' then
    perform public.assert_uin_place_target_v146(new.canonical_target_id);
  elsif tg_op='UPDATE' then
    perform public.assert_uin_place_target_v146(new.canonical_target_id);
    if old.canonical_target_id is distinct from new.canonical_target_id then
      perform public.assert_uin_place_target_v146(old.canonical_target_id);
    end if;
  elsif tg_op='DELETE' then
    perform public.assert_uin_place_target_v146(old.canonical_target_id);
  end if;

  return null;
end;
$function$;

create or replace function public.guard_uin_place_target_metadata_v146()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  perform public.assert_uin_place_target_v146(new.id);
  return null;
end;
$function$;

drop trigger if exists guard_uin_place_node_identity_v146 on public.uin_place_nodes_v123;
create constraint trigger guard_uin_place_node_identity_v146
after insert or update of canonical_target_id,parent_target_id on public.uin_place_nodes_v123
deferrable initially deferred
for each row execute function public.guard_uin_place_node_identity_v146();

drop trigger if exists guard_uin_place_catalogue_identity_v146 on public.seed_catalog_items;
create constraint trigger guard_uin_place_catalogue_identity_v146
after insert or delete or update of canonical_target_id,item_kind,status on public.seed_catalog_items
deferrable initially deferred
for each row execute function public.guard_uin_place_catalogue_identity_v146();

drop trigger if exists guard_uin_place_target_metadata_v146 on public.canonical_targets;
create constraint trigger guard_uin_place_target_metadata_v146
after update of editorial_metadata on public.canonical_targets
deferrable initially deferred
for each row execute function public.guard_uin_place_target_metadata_v146();

-- Fail the migration if pre-existing data violates the invariant. This is a
-- validation only; no user, seed, event, hierarchy or relation row is moved.
do $block$
begin
  if exists(
    select 1
    from public.uin_place_nodes_v123 node
    where not public.is_uin_place_target_v146(node.canonical_target_id)
  ) then
    raise exception 'Existing structural place nodes contain a mixed or non-place target.'
      using errcode='23514';
  end if;

  if exists(
    select 1
    from public.uin_place_nodes_v123 node
    where node.parent_target_id is not null
      and not exists(
        select 1
        from public.uin_place_nodes_v123 parent
        where parent.canonical_target_id=node.parent_target_id
      )
  ) then
    raise exception 'Existing structural place nodes contain a non-structural parent target.'
      using errcode='23514';
  end if;

  if exists(
    select 1
    from public.canonical_targets target
    where target.editorial_metadata ? 'place_hierarchy'
      and (
        (nullif(target.editorial_metadata->>'content_type_id','') is not null
          and target.editorial_metadata->>'content_type_id'<>'place')
        or (nullif(target.editorial_metadata->>'item_kind','') is not null
          and target.editorial_metadata->>'item_kind'<>'place')
        or not exists(
          select 1 from public.seed_catalog_items item
          where item.canonical_target_id=target.id
            and item.status='active' and item.item_kind='place'
        )
        or exists(
          select 1 from public.seed_catalog_items item
          where item.canonical_target_id=target.id
            and item.status='active' and item.item_kind<>'place'
        )
      )
  ) then
    raise exception 'Existing place hierarchy metadata contains a mixed or non-place target.'
      using errcode='23514';
  end if;

  if exists(
    select 1
    from public.seed_catalog_items item
    where item.status='active'
      and item.item_kind<>'place'
      and item.canonical_target_id is not null
      and public.resolve_uin_card_target_v129(item.canonical_target_id)<>item.canonical_target_id
  ) then
    raise exception 'A non-place Library card still resolves to another target.'
      using errcode='23514';
  end if;
end;
$block$;

revoke all on function public.is_uin_place_target_v146(uuid),
  public.assert_uin_place_target_v146(uuid),
  public.guard_uin_place_node_identity_v146(),
  public.guard_uin_place_catalogue_identity_v146(),
  public.guard_uin_place_target_metadata_v146() from public,anon,authenticated;
revoke all on function public.resolve_uin_card_target_v129(uuid) from public;
grant execute on function public.resolve_uin_card_target_v129(uuid) to anon,authenticated;

notify pgrst,'reload schema';
commit;
