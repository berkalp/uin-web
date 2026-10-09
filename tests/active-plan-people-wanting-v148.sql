-- Run after 202610090001_active_plan_people_are_wanting_v148.sql.
-- Read-only live semantic audit for active plan/event participant counts.
do $audit$
declare
  v_targets uuid[];
  v_missing integer;
  v_extra integer;
  v_summary_mismatch integer;
begin
  select coalesce(array_agg(sample.target_id),array[]::uuid[])
  into v_targets
  from (
    select distinct public.resolve_uin_card_target_v129(intent.canonical_target_id) target_id
    from public.intents intent
    where intent.canonical_target_id is not null
      and intent.status in('active','planned')
    order by 1
    limit 200
  ) sample;

  if cardinality(v_targets)=0 then
    raise notice 'No active canonical intent fixture was available; v148 live audit skipped.';
    return;
  end if;

  with active_events as materialized (
    select event.*
    from public.get_uin_card_event_projection_v143(v_targets) event
    where event.event_state='active'
  ), expected as materialized (
    select event.requested_id,event.source_target_id,intent.user_id
    from active_events event
    join public.intents intent on intent.id=event.intent_id
    where event.plan_id is null
    union
    select event.requested_id,event.source_target_id,participant.user_id
    from active_events event
    join public.intent_participants participant
      on participant.intent_id=event.intent_id and participant.status='active'
    where event.plan_id is null
    union
    select event.requested_id,event.source_target_id,plan.host_user_id
    from active_events event
    join public.plans plan on plan.id=event.plan_id
    where event.plan_id is not null and plan.host_user_id is not null
    union
    select event.requested_id,event.source_target_id,member.user_id
    from active_events event
    join public.plan_members member
      on member.plan_id=event.plan_id and member.status='active'
    where event.plan_id is not null
  ), actual_want as materialized (
    select projection.requested_id,projection.source_target_id,projection.user_id
    from public.get_uin_card_people_projection_v143(v_targets) projection
    where projection.relationship_status='want'
  ), actual_social as materialized (
    select projection.requested_id,projection.source_target_id,projection.user_id
    from public.get_uin_card_people_projection_v143(v_targets) projection
    where projection.source_kind='social'
      and projection.relationship_status='want'
  )
  select
    (select count(*) from (select * from expected except select * from actual_want) missing),
    (select count(*) from (select * from actual_social except select * from expected) extra)
  into v_missing,v_extra;

  if v_missing<>0 or v_extra<>0 then
    raise exception 'v148 active social wanting projection mismatch: missing %, extra %.',
      v_missing,v_extra;
  end if;

  with projected as materialized (
    select people.requested_id,
      count(distinct people.user_id)
        filter(where people.relationship_status='want')::integer wanting
    from public.get_uin_card_people_projection_v143(v_targets) people
    group by people.requested_id
  ), summaries as materialized (
    select value summary
    from public.get_uin_card_summary_v143(v_targets) value
  )
  select count(*)
  into v_summary_mismatch
  from summaries
  left join projected
    on projected.requested_id=(summaries.summary->>'target_id')::uuid
  where (summaries.summary->>'wanting')::integer
    is distinct from coalesce(projected.wanting,0);

  if v_summary_mismatch<>0 then
    raise exception 'v148 summary wanting totals differ from the canonical people projection for % cards.',
      v_summary_mismatch;
  end if;

  raise notice 'v148 active plan people audit passed for % requested cards.',cardinality(v_targets);
end;
$audit$;
