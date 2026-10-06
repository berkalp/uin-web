begin;
create or replace function public.get_uin_content_type_counts_v120()
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with visible_targets as (
    select distinct item.canonical_target_id as target_id,
      public.uin_target_content_type_id_v115(item.canonical_target_id) as content_type_id
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active'
      and item.canonical_target_id is not null
      and coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
  ), counts as (
    select content_type_id,count(*)::integer as card_count
    from visible_targets
    where content_type_id is not null
    group by content_type_id
  )
  select jsonb_build_object('content_type_id',type.id,'count',coalesce(counts.card_count,0))
  from public.uin_content_types type
  left join counts on counts.content_type_id=type.id
  where type.active
  order by type.position,type.label;
$$;
revoke all on function public.get_uin_content_type_counts_v120() from public;
grant execute on function public.get_uin_content_type_counts_v120() to anon,authenticated;
notify pgrst,'reload schema';
commit;
