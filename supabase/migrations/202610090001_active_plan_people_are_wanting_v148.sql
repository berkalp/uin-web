begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

-- A person who owns or joins an active event is still currently interested in
-- its Library card. v143 intentionally stopped completed social events from
-- becoming experiences, but also excluded active social participants from the
-- wanting total. Build those current participants from the canonical active
-- event projection so plan state, visibility, dates, aliases and hierarchy use
-- the same rules as the active-event counter.
create or replace function public.get_uin_card_people_projection_v143(p_target_ids uuid[])
returns table(
  requested_id uuid,
  source_target_id uuid,
  user_id uuid,
  source_kind text,
  source_id uuid,
  relationship_status text,
  target_date date
)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with resolved as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) target_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  ), closure as materialized (
    select tree.resolved_id requested_id,tree.target_id source_target_id
    from public.get_uin_card_closure_v143(
      coalesce((select array_agg(target_id) from resolved),array[]::uuid[]),true
    ) tree
    group by tree.resolved_id,tree.target_id
  ), seed_candidates as materialized (
    select closure.requested_id,closure.source_target_id,
      visible.user_id,'seed'::text source_kind,visible.seed_id source_id,
      case when visible.relationship_status='completed' then 'completed' else 'want' end relationship_status,
      case when visible.relationship_status<>'completed' then seed.target_date end target_date
    from public.visible_canonical_seeds_v31() visible
    join public.seeds seed on seed.id=visible.seed_id
    join closure on closure.source_target_id=visible.target_id
    where visible.relationship_status='completed'
      or (
        visible.relationship_status<>'completed'
        and (seed.target_date is null or seed.target_date>=(now() at time zone 'Europe/Istanbul')::date)
      )
  ), personal_candidates as materialized (
    select closure.requested_id,closure.source_target_id,
      personal.user_id,'personal'::text source_kind,personal.id source_id,
      case when personal.status='completed' then 'completed' else 'want' end relationship_status,
      case when personal.status='active' then personal.end_date end target_date
    from public.canonical_personal_intents_v38 personal
    join closure on closure.source_target_id=personal.target_id
    where personal.status in('active','completed')
      and public.personal_common_intent_visible_v38(
        personal.user_id,personal.visibility,auth.uid()
      )
      and (
        personal.status='completed'
        or personal.end_date is null
        or personal.end_date>=(now() at time zone 'Europe/Istanbul')::date
      )
  ), active_events as materialized (
    select event.*
    from public.get_uin_card_event_projection_v143(
      coalesce((select array_agg(target_id) from resolved),array[]::uuid[])
    ) event
    where event.event_state='active'
  ), social_candidates as materialized (
    select event.requested_id,event.source_target_id,
      intent.user_id,'social'::text source_kind,event.intent_id source_id,
      'want'::text relationship_status,intent.end_date target_date
    from active_events event
    join public.intents intent on intent.id=event.intent_id
    where event.plan_id is null

    union all

    select event.requested_id,event.source_target_id,
      participant.user_id,'social'::text,event.intent_id,
      'want'::text,intent.end_date
    from active_events event
    join public.intents intent on intent.id=event.intent_id
    join public.intent_participants participant
      on participant.intent_id=event.intent_id and participant.status='active'
    where event.plan_id is null

    union all

    select event.requested_id,event.source_target_id,
      plan.host_user_id,'social'::text,event.intent_id,
      'want'::text,intent.end_date
    from active_events event
    join public.intents intent on intent.id=event.intent_id
    join public.plans plan on plan.id=event.plan_id
    where event.plan_id is not null and plan.host_user_id is not null

    union all

    select event.requested_id,event.source_target_id,
      member.user_id,'social'::text,event.intent_id,
      'want'::text,intent.end_date
    from active_events event
    join public.intents intent on intent.id=event.intent_id
    join public.plan_members member
      on member.plan_id=event.plan_id and member.status='active'
    where event.plan_id is not null
  ), candidates as materialized (
    select * from seed_candidates
    union all
    select * from personal_candidates
    union all
    select * from social_candidates
  ), ranked as (
    select candidates.*,
      row_number() over(
        partition by candidates.requested_id,candidates.source_target_id,
          candidates.user_id,candidates.relationship_status
        order by
          case candidates.source_kind when 'seed' then 0 when 'personal' then 1 else 2 end,
          candidates.target_date desc nulls last,
          candidates.source_id
      ) rn
    from candidates
  )
  select ranked.requested_id,ranked.source_target_id,ranked.user_id,
    ranked.source_kind,ranked.source_id,ranked.relationship_status,ranked.target_date
  from ranked
  where ranked.rn=1;
$function$;

revoke all on function public.get_uin_card_people_projection_v143(uuid[]) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
