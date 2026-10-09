begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

-- Mobile startup used to open one PostgREST request per visible intent (up to
-- sixty simultaneous HTTP calls) just to read event titles and DNA labels.
-- Keep the established v86 semantics in one database request.  The materialized
-- CTE guarantees one v86 evaluation per distinct requested resource.
create or replace function public.get_uin_event_presentations_v150(p_resource_ids uuid[])
returns table(resource_id uuid,presentation jsonb)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with requested as materialized (
    select input.resource_id,min(input.position) position
    from unnest(coalesce(p_resource_ids,array[]::uuid[]))
      with ordinality input(resource_id,position)
    where input.resource_id is not null
    group by input.resource_id
    order by min(input.position)
    limit 100
  ), projected as materialized (
    select requested.resource_id,requested.position,
      public.get_uin_event_presentation_v86(requested.resource_id) presentation
    from requested
  )
  select projected.resource_id,projected.presentation
  from projected
  where projected.presentation is not null
  order by projected.position;
$function$;

comment on function public.get_uin_event_presentations_v150(uuid[]) is
  'Batch wrapper for the canonical v86 event presentation; bounded to 100 distinct resources to remove mobile startup N+1 RPCs.';

revoke all on function public.get_uin_event_presentations_v150(uuid[]) from public;
grant execute on function public.get_uin_event_presentations_v150(uuid[]) to anon,authenticated;

notify pgrst,'reload schema';
commit;
