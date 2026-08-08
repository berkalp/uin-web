-- UIN: complete both sides of Match -> Shared Plan provenance.
--
-- A Shared Plan created from an accepted Match has two source Intents:
--   * target_intent_id -> host_source (when it belongs to the Plan host)
--   * own_intent_id    -> participant_source (when it belongs to the requester)
--
-- Earlier reconciliation only guaranteed the participant side. That was enough
-- to close the requester's standalone Intent, but not enough for Timeline to
-- explain visually that two Intents became one Activity.

create or replace function public.attach_host_source_intent_to_plan(
  p_intent_id uuid,
  p_plan_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_user_id uuid;
begin
  if p_intent_id is null or p_plan_id is null then
    return false;
  end if;

  select plan.host_user_id
  into v_host_user_id
  from public.plans plan
  where plan.id = p_plan_id
    and plan.status in ('forming', 'planned')
    and plan.expired_at is null;

  if v_host_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.intents intent
    where intent.id = p_intent_id
      and intent.user_id = v_host_user_id
  ) then
    return false;
  end if;

  -- One Intent should not silently become source DNA for two active Plans.
  if exists (
    select 1
    from public.plan_intents link
    join public.plans other_plan on other_plan.id = link.plan_id
    where link.intent_id = p_intent_id
      and link.status = 'active'
      and link.plan_id <> p_plan_id
      and other_plan.status in ('forming', 'planned')
      and other_plan.expired_at is null
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.plan_intents link
    where link.plan_id = p_plan_id
      and link.intent_id = p_intent_id
  ) then
    update public.plan_intents
    set
      relationship = 'host_source',
      status = 'active',
      detached_at = null,
      updated_at = now()
    where plan_id = p_plan_id
      and intent_id = p_intent_id;
  else
    insert into public.plan_intents (
      plan_id,
      intent_id,
      relationship,
      status
    ) values (
      p_plan_id,
      p_intent_id,
      'host_source',
      'active'
    );
  end if;

  update public.intents
  set
    matching_status = 'matched',
    recruitment_status = 'closed',
    updated_at = now()
  where id = p_intent_id
    and user_id = v_host_user_id
    and status = 'active';

  return true;
end;
$$;

revoke all on function public.attach_host_source_intent_to_plan(uuid, uuid) from public;
revoke all on function public.attach_host_source_intent_to_plan(uuid, uuid) from anon;
revoke all on function public.attach_host_source_intent_to_plan(uuid, uuid) from authenticated;

-- Future accepted Matches repair both source links immediately.
create or replace function public.reconcile_accepted_match_request_lineage_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and new.plan_id is not null then
    perform public.attach_host_source_intent_to_plan(
      new.target_intent_id,
      new.plan_id
    );

    perform public.attach_participant_source_intent_to_plan(
      new.requester_id,
      new.own_intent_id,
      new.plan_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.reconcile_accepted_match_request_lineage_trigger() from public;

-- Backfill active legacy Match -> Plan rows. Never mutate expired history.
do $$
declare
  v_request record;
begin
  for v_request in
    select
      request.requester_id,
      request.own_intent_id,
      request.target_intent_id,
      request.plan_id
    from public.intent_requests request
    join public.plans plan
      on plan.id = request.plan_id
    where request.status = 'accepted'
      and request.plan_id is not null
      and plan.status in ('forming', 'planned')
      and plan.expired_at is null
      and (
        plan.status <> 'forming'
        or plan.window_end >= current_date
      )
  loop
    begin
      perform public.attach_host_source_intent_to_plan(
        v_request.target_intent_id,
        v_request.plan_id
      );

      perform public.attach_participant_source_intent_to_plan(
        v_request.requester_id,
        v_request.own_intent_id,
        v_request.plan_id
      );
    exception
      when sqlstate '22023' then
        -- Some older databases have stricter immutable-expired-plan guards.
        -- Historical rows are intentionally left alone rather than aborting
        -- the migration.
        null;
    end;
  end loop;
end;
$$;

comment on function public.attach_host_source_intent_to_plan(uuid, uuid) is
  'Attaches the Plan host Intent as host_source provenance for an active Shared Plan created from a Match.';
