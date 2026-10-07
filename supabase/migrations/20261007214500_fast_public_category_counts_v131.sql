begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

-- Aggregate catalogue totals in two grouped scans. The previous loop scanned
-- the full catalogue once per category and made mobile counters appear as 0
-- for several seconds after opening the Library.
create or replace function public.get_uin_category_counts_v129()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with base_counts as materialized (
    select case when item_kind='video' then 'series' else item_kind end type_id,count(*) item_count
    from public.seed_catalog_items
    where status='active' and canonical_target_id is not null
    group by 1
  ), metadata_counts as materialized (
    select metadata->>'content_type_id' type_id,count(*) item_count
    from public.seed_catalog_items
    where status='active' and canonical_target_id is not null
      and metadata ? 'content_type_id'
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

grant execute on function public.get_uin_category_counts_v129() to anon,authenticated;
notify pgrst,'reload schema';
commit;
