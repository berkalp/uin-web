begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

-- Resolve a legacy Turkish city card to the one structural city card with the
-- same normalized title. This is read-only: no user record or target is moved.
create or replace function public.resolve_uin_card_target_v129(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with requested as (
    select target.id,target.title
    from public.canonical_targets target where target.id=p_target_id
  ), structural as (
    select node.canonical_target_id
    from requested
    join public.uin_place_nodes_v123 node
      on node.scope='city' and node.country_code='TR'
     and public.canonical_normalize_v31(node.city)=public.canonical_normalize_v31(requested.title)
  )
  select coalesce((select canonical_target_id from structural limit 1),p_target_id);
$function$;

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
  ), hierarchy as materialized (
    select descendant.target_id
    from root
    cross join lateral public.get_uin_card_descendants_v81(root.id,true) descendant
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
  select hierarchy.target_id from hierarchy
  union
  select legacy_city.target_id from legacy_city;
$function$;

-- Use the same visible people lists as the opened detail card, then deduplicate
-- by person across legacy and structural identities.
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
), base as materialized (
  select summary as row
  from public.get_uin_card_summary_v107((select array_agg(target_id) from requested)) summary
), identity as materialized (
  select requested.target_id requested_id,identity.target_id
  from requested
  cross join lateral public.get_uin_card_identity_targets_v129(requested.target_id) identity
), wanting_people as materialized (
  select identity.requested_id,person->>'user_id' user_id
  from identity
  cross join lateral public.get_uin_card_people_v81(identity.target_id,'intent',100,0) person
), done_people as materialized (
  select identity.requested_id,person->>'user_id' user_id
  from identity
  cross join lateral public.get_uin_card_people_v81(identity.target_id,'experience',100,0) person
), exact as materialized (
  select requested.target_id,
    (select count(distinct user_id) from wanting_people where requested_id=requested.target_id)::integer wanting,
    (select count(distinct user_id) from done_people where requested_id=requested.target_id)::integer done
  from requested
)
select jsonb_set(
  jsonb_set(base.row,'{wanting}',to_jsonb(exact.wanting),true),
  '{done}',to_jsonb(exact.done),true
)
from base join exact on exact.target_id=(base.row->>'target_id')::uuid;
$function$;

-- Catalogue totals are public product data. A security-definer aggregate keeps
-- their result independent from the viewer's row-level permissions.
create or replace function public.get_uin_category_counts_v129()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
declare
  result jsonb:='{}'::jsonb;
  content_type record;
  item_count bigint;
begin
  for content_type in
    select id,base_kind from public.uin_content_types where active order by position,label
  loop
    if content_type.base_kind='place' then
      select coalesce((public.get_global_place_counts_v122()->>'cities')::bigint,0) into item_count;
    elsif content_type.id=content_type.base_kind then
      select count(*) into item_count
      from public.seed_catalog_items item
      where item.status='active' and item.canonical_target_id is not null
        and case when content_type.base_kind='series'
          then item.item_kind in('series','video')
          else item.item_kind=content_type.base_kind end;
    else
      select count(*) into item_count
      from public.seed_catalog_items item
      where item.status='active' and item.canonical_target_id is not null
        and item.metadata@>jsonb_build_object('content_type_id',content_type.id);
    end if;
    result:=result||jsonb_build_object(content_type.id,coalesce(item_count,0));
  end loop;
  return result;
end;
$function$;

revoke all on function public.resolve_uin_card_target_v129(uuid),
  public.get_uin_card_identity_targets_v129(uuid),
  public.get_uin_card_summary_v129(uuid[]),
  public.get_uin_category_counts_v129() from public;
grant execute on function public.resolve_uin_card_target_v129(uuid),
  public.get_uin_card_identity_targets_v129(uuid),
  public.get_uin_card_summary_v129(uuid[]),
  public.get_uin_category_counts_v129() to anon,authenticated;

notify pgrst,'reload schema';
commit;
