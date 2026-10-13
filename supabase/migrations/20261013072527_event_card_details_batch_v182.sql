-- Batch the existing visibility-aware reader; no new table access or privileges.
create or replace function public.get_visible_event_card_details_batch_v182(p_resource_ids uuid[])
returns table(resource_id uuid, detail jsonb)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with requested as materialized (
    select input.resource_id from unnest(coalesce(p_resource_ids,array[]::uuid[])) input(resource_id)
    where input.resource_id is not null group by input.resource_id order by input.resource_id limit 100
  ), projected as materialized (
    select requested.resource_id, public.get_activity_detail_page(requested.resource_id) detail from requested
  )
  select projected.resource_id, projected.detail from projected where projected.detail is not null;
$$;
revoke all on function public.get_visible_event_card_details_batch_v182(uuid[]) from public;
grant execute on function public.get_visible_event_card_details_batch_v182(uuid[]) to anon, authenticated;
