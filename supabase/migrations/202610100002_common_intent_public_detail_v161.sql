begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- This reader is used by the public UIN card detail page. The old admin-role reader
-- raises for every non-admin, so using it to compute a boolean made the whole
-- otherwise public payload fail. is_admin() performs the same membership check
-- and returns false for anonymous and non-admin viewers.
create or replace function public.get_common_target_page_context_v41(
  p_target_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'is_admin', public.is_admin(),
    'catalog_item_id', catalog.id,
    'title', target.title,
    'creator_name', coalesce(target.creator_name, catalog.creator_name),
    'cover_url', coalesce(
      target.editorial_cover_url,
      catalog.cover_url,
      activity.default_cover_url,
      category.default_cover_url
    ),
    'metadata',
      coalesce(catalog.metadata, '{}'::jsonb)
      || coalesce(target.editorial_metadata, '{}'::jsonb)
  )
  from public.canonical_targets target
  left join public.activities activity
    on activity.id = target.activity_id
  left join public.activity_categories category
    on category.id = activity.category_id
  left join lateral (
    select item.*
    from public.seed_catalog_items item
    where item.canonical_target_id = target.id
    order by (item.status = 'active') desc, item.updated_at desc
    limit 1
  ) catalog on true
  where target.id = p_target_id;
$$;

revoke all on function public.get_common_target_page_context_v41(uuid)
  from public, anon, authenticated;
grant execute on function public.get_common_target_page_context_v41(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
