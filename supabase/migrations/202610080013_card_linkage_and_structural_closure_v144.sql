begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- These covering indexes match the three direct-child branches used by the
-- structural closure. Earlier migrations already created non-covering variants;
-- keep those in place and add the projected target ids for index-only reads.
create index if not exists canonical_targets_hierarchy_parent_cover_v144_idx
on public.canonical_targets ((coalesce(
  nullif(editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
  nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
  nullif(editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
))) include(id);

create index if not exists uin_place_nodes_parent_target_v144_idx
on public.uin_place_nodes_v123(parent_target_id,canonical_target_id)
where parent_target_id is not null;

create index if not exists uin_card_relations_source_material_v143_idx
on public.uin_card_relations_v87(related_target_id,source_target_id)
where relation_type='source_material';

-- v143 kept one visited path per traversal. A target reachable through several
-- paths therefore multiplied again at every level and was deduplicated only at
-- the end. Nevsehir returned nine rows but produced hundreds of thousands of
-- buffer hits. Recursive UNION makes (requested,target) the visited set, so a
-- cycle or a second path is discarded before its children are expanded.
-- Consumers only distinguish the root from descendants, so depth is deliberately
-- the stable 0/1 relationship rather than a path-dependent traversal depth.
create or replace function public.get_uin_card_structural_closure_v143(p_target_ids uuid[])
returns table(requested_id uuid,target_id uuid,depth integer)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with recursive requested as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) requested_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
    join public.canonical_targets target on target.id=input.id
  ), walk(requested_id,target_id) as (
    select requested.requested_id,requested.requested_id
    from requested

    union

    select walk.requested_id,child.target_id
    from walk
    cross join lateral public.get_uin_card_visible_children_v137(walk.target_id) child
    join public.canonical_targets target on target.id=child.target_id
    where public.is_admin()
       or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
  )
  select walk.requested_id,walk.target_id,
    case when walk.target_id=walk.requested_id then 0 else 1 end::integer depth
  from walk
  order by walk.requested_id,depth,walk.target_id;
$function$;

-- Library placement checks must resolve legacy identities. An old city target
-- may be a valid alias of today's canonical Library card; creating a duplicate
-- public placement for that alias would inflate categories and leak identity.
create or replace function public.uin_target_has_active_library_card_v144(p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select p_target_id is not null and exists(
    select 1
    from public.get_uin_card_identity_aliases_v143(p_target_id) identity
    join public.seed_catalog_items item
      on item.canonical_target_id=identity.target_id
     and item.status='active'
  );
$function$;

create or replace function public.assert_intent_has_library_card_v139()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare v_target uuid;
begin
  select intent.canonical_target_id into v_target
  from public.intents intent
  where intent.id=new.id;

  if v_target is not null
     and not public.uin_target_has_active_library_card_v144(v_target) then
    raise exception 'Niyet veya etkinlik Kütüphane kartına bağlı olmalıdır.'
      using errcode='23514';
  end if;
  return null;
end;
$function$;

create or replace function public.assert_personal_intent_has_library_card_v139()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare v_target uuid;
begin
  select personal.target_id into v_target
  from public.canonical_personal_intents_v38 personal
  where personal.id=new.id;

  if v_target is not null
     and not public.uin_target_has_active_library_card_v144(v_target) then
    raise exception 'Niyet Kütüphane kartına bağlı olmalıdır.'
      using errcode='23514';
  end if;
  return null;
end;
$function$;

-- Six historical Seeds predate the shared Library. They have no catalogue item
-- and their canonical target kind is personal. Publishing those private goals as
-- Library cards would expose titles such as personal finance/business goals.
-- Preserve them without loss, but require every catalogue-backed Seed to keep an
-- active canonical/alias placement and reject new non-personal orphan targets.
create or replace function public.assert_seed_has_library_card_v144()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_status text;
  v_catalog_item_id uuid;
  v_target uuid;
  v_target_kind text;
begin
  select seed.status,seed.catalog_item_id,seed.canonical_target_id,target.kind
  into v_status,v_catalog_item_id,v_target,v_target_kind
  from public.seeds seed
  left join public.canonical_targets target on target.id=seed.canonical_target_id
  where seed.id=new.id;

  if not found then
    return null;
  end if;

  if v_status not in ('active','completed') then
    return null;
  end if;

  if v_catalog_item_id is null then
    if v_target is null or v_target_kind is distinct from 'personal' then
      raise exception 'Katalog dışı Seed yalnız eski kişisel hedef olarak saklanabilir.'
        using errcode='23514';
    end if;
    return null;
  end if;

  if not public.uin_target_has_active_library_card_v144(v_target) then
    raise exception 'Seed aktif bir Kütüphane kartına bağlı olmalıdır.'
      using errcode='23514';
  end if;
  return null;
end;
$function$;

drop trigger if exists require_seed_library_card_v144 on public.seeds;
create constraint trigger require_seed_library_card_v144
after insert or update of catalog_item_id,canonical_target_id,status on public.seeds
deferrable initially deferred
for each row execute function public.assert_seed_has_library_card_v144();

-- Idempotent verification. Legacy catalogue-free personal Seeds are retained;
-- all shared/persisted relationships must resolve to an active Library identity.
do $verify$
begin
  if exists(
    select 1
    from public.seeds seed
    left join public.canonical_targets target on target.id=seed.canonical_target_id
    where seed.status in ('active','completed')
      and (
        (seed.catalog_item_id is not null
          and not public.uin_target_has_active_library_card_v144(seed.canonical_target_id))
        or
        (seed.catalog_item_id is null
          and (seed.canonical_target_id is null or target.kind is distinct from 'personal'))
      )
  ) then
    raise exception 'Aktif/tamamlanmış Seed bağlantısı Kütüphane sözleşmesini ihlal ediyor.';
  end if;

  if exists(
    select 1
    from public.canonical_personal_intents_v38 personal
    where personal.target_id is not null
      and not public.uin_target_has_active_library_card_v144(personal.target_id)
  ) then
    raise exception 'Kütüphane kartı olmayan kişisel niyet kaldı.';
  end if;

  if exists(
    select 1
    from public.intents intent
    where intent.canonical_target_id is not null
      and not public.uin_target_has_active_library_card_v144(intent.canonical_target_id)
  ) then
    raise exception 'Kütüphane kartı olmayan sosyal niyet/etkinlik kaldı.';
  end if;
end;
$verify$;

revoke all on function
  public.uin_target_has_active_library_card_v144(uuid),
  public.assert_seed_has_library_card_v144()
from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
