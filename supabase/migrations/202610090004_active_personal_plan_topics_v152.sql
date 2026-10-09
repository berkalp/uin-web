begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

-- Return the exact cards that currently have a live plan for the signed-in
-- user. Personal-scope clients used to infer this from stale plan statuses,
-- which left expired cards in "Planladıklarım" while the canonical card
-- summary correctly reported zero wanting people and zero active events.
create or replace function public.get_my_uin_active_plan_topics_v152()
returns table(target_id uuid,type_id text,resource_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with sources as materialized (
    select distinct
      (source.value->>'target_id')::uuid target_id,
      coalesce(nullif(source.value->>'type_id',''),'activity') type_id,
      (source.value->>'resource_id')::uuid resource_id
    from public.get_my_uin_topic_sources_v71() source(value)
    where source.value ? 'target_id'
      and source.value ? 'resource_id'
      and (
        exists(
          select 1
          from public.plans plan
          where plan.id=(source.value->>'resource_id')::uuid
            and plan.status in('forming','planned')
        )
        or exists(
          select 1
          from public.intents intent
          where intent.id=(source.value->>'resource_id')::uuid
            and intent.status='planned'
        )
      )
  ), resolved_sources as materialized (
    select sources.*,
      public.resolve_uin_card_target_v129(sources.target_id) resolved_target_id
    from sources
  ), requested as materialized (
    select coalesce(array_agg(distinct resolved_target_id),array[]::uuid[]) target_ids
    from resolved_sources
  ), active_events as materialized (
    select event.*
    from requested
    cross join lateral public.get_uin_card_event_projection_v143(requested.target_ids) event
    where event.event_state='active'
  )
  select distinct sources.resolved_target_id target_id,sources.type_id,
    events.resource_id
  from resolved_sources sources
  join active_events events
    on events.requested_id=sources.resolved_target_id
   and sources.resource_id in(events.intent_id,events.plan_id)
  order by sources.resolved_target_id;
$function$;

revoke all on function public.get_my_uin_active_plan_topics_v152() from public,anon;
grant execute on function public.get_my_uin_active_plan_topics_v152() to authenticated;

notify pgrst,'reload schema';
commit;
