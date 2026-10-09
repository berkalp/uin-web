begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

-- Enrich the existing personal-plan scope read with the preview needed by the
-- library card.  This replaces no catalogue read and adds no per-card query:
-- the event projection was already materialized by v152.
create or replace function public.get_my_uin_active_plan_topics_v153()
returns table(
  target_id uuid,
  type_id text,
  resource_id uuid,
  intent_id uuid,
  plan_id uuid,
  event_title text,
  start_date date,
  end_date date,
  location text,
  organizer_name text,
  organizer_avatar_url text,
  viewer_role text,
  personal_event_count bigint
)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with active_sources as materialized (
    select source.*
    from public.get_my_uin_active_plan_topics_v152() source
  ), event_rows as materialized (
    select distinct on(source.target_id,source.resource_id)
      source.target_id,
      source.type_id,
      source.resource_id,
      intent.id intent_id,
      plan.id plan_id,
      coalesce(nullif(plan.title,''),target.title||' etkinliği') event_title,
      coalesce(plan.scheduled_start::date,plan.window_start,intent.start_date) start_date,
      coalesce(plan.scheduled_end::date,plan.window_end,intent.end_date) end_date,
      coalesce(
        nullif(plan.activity_location_name,''),
        nullif(concat_ws(', ',nullif(location.district,''),nullif(location.city,''),nullif(location.country_name,'')),'')
      ) location,
      coalesce(nullif(organizer.full_name,''),nullif(organizer.username,''),'UIN üyesi') organizer_name,
      organizer.avatar_url organizer_avatar_url,
      case when coalesce(plan.host_user_id,intent.user_id)=auth.uid() then 'owner' else 'member' end viewer_role
    from active_sources source
    join public.canonical_targets target on target.id=source.target_id
    left join public.plans plan on plan.id=source.resource_id
    left join public.plan_intents plan_link
      on plan_link.plan_id=plan.id and plan_link.status='active'
    join public.intents intent
      on intent.id=coalesce(plan_link.intent_id,source.resource_id)
    left join public.locations location on location.id=intent.location_id
    left join public.profiles organizer on organizer.id=coalesce(plan.host_user_id,intent.user_id)
    order by source.target_id,source.resource_id,plan_link.linked_at desc nulls last
  ), preview_rows as materialized (
    select event_rows.*,
      count(*) over(partition by event_rows.target_id) personal_event_count,
      row_number() over(
        partition by event_rows.target_id
        order by coalesce(event_rows.start_date,'infinity'::date),event_rows.resource_id
      ) preview_order
    from event_rows
  )
  select preview.target_id,preview.type_id,preview.resource_id,
    preview.intent_id,preview.plan_id,preview.event_title,preview.start_date,
    preview.end_date,preview.location,preview.organizer_name,
    preview.organizer_avatar_url,preview.viewer_role,preview.personal_event_count
  from preview_rows preview
  where preview.preview_order=1
  order by preview.target_id;
$function$;

revoke all on function public.get_my_uin_active_plan_topics_v153() from public,anon;
grant execute on function public.get_my_uin_active_plan_topics_v153() to authenticated;

notify pgrst,'reload schema';
commit;
