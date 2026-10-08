begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- Only a small number of targets are hidden. Category counts previously
-- scanned every canonical target twice and evaluated is_admin() per row.
-- This partial index lets the public path reject hidden targets by id without
-- reading large editorial JSON documents from the full target table.
create index if not exists canonical_targets_admin_hidden_v147_idx
on public.canonical_targets(id)
where coalesce((editorial_metadata->>'admin_hidden')::boolean,false);

analyze public.canonical_targets;

create or replace function public.get_uin_category_counts_v129()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with viewer as materialized (
    select public.is_admin() is_admin
  ), eligible as materialized (
    select item.canonical_target_id,item.item_kind,
      item.metadata ? 'content_type_id' has_metadata_type,
      item.metadata->>'content_type_id' metadata_type_id
    from public.seed_catalog_items item
    cross join viewer
    where item.status='active'
      and item.canonical_target_id is not null
      and coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
      and (
        viewer.is_admin
        or not exists(
          select 1
          from public.canonical_targets hidden
          where hidden.id=item.canonical_target_id
            and coalesce((hidden.editorial_metadata->>'admin_hidden')::boolean,false)
          offset 0
        )
      )
  ), base_counts as materialized (
    select case when eligible.item_kind='video' then 'series' else eligible.item_kind end type_id,
      count(distinct eligible.canonical_target_id) item_count
    from eligible
    group by 1
  ), metadata_counts as materialized (
    select eligible.metadata_type_id type_id,
      count(distinct eligible.canonical_target_id) item_count
    from eligible
    where eligible.has_metadata_type
    group by 1
  ), place_count as materialized (
    select coalesce((public.get_global_place_counts_v122()->>'cities')::bigint,0) item_count
  )
  select coalesce(jsonb_object_agg(type.id,
    case
      when type.base_kind='place' then place_count.item_count
      when type.id=type.base_kind then coalesce(base.item_count,0)
      else coalesce(metadata.item_count,0)
    end
  ),'{}'::jsonb)
  from public.uin_content_types type
  cross join place_count
  left join base_counts base on base.type_id=type.base_kind
  left join metadata_counts metadata on metadata.type_id=type.id
  where type.active;
$function$;

comment on function public.get_uin_category_counts_v129() is
  'Distinct visible Library card counts; evaluates viewer role once and avoids full canonical-target scans.';

revoke all on function public.get_uin_category_counts_v129() from public;
grant execute on function public.get_uin_category_counts_v129() to anon,authenticated;

notify pgrst,'reload schema';
commit;
