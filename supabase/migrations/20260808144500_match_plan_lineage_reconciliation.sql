-- UIN migration: resolve an Intent once it has become source DNA for a Shared Plan.
--
-- The important invariant is simple:
--   an Intent that has already produced/joined an active Shared Plan must not keep
--   behaving like an independent open matching opportunity.
--
-- We preserve the Intent as provenance through plan_intents. Nothing is deleted.

create or replace function public.attach_participant_source_intent_to_plan(
  p_user_id uuid,
  p_intent_id uuid,
  p_plan_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_intent_id is null or p_plan_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.intents intent
    where intent.id = p_intent_id
      and intent.user_id = p_user_id
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.plans plan
    join public.plan_members member
      on member.plan_id = plan.id
     and member.user_id = p_user_id
     and member.status = 'active'
    where plan.id = p_plan_id
      and plan.expired_at is null
      and (
        (
          plan.status = 'forming'
          and plan.window_end >= current_date
        )
        or
        (
          plan.status = 'planned'
          and (
            (
              plan.scheduled_end is not null
              and plan.scheduled_end > now() - interval '24 hours'
            )
            or
            (
              plan.scheduled_end is null
              and plan.window_end >= current_date
            )
          )
        )
      )
  ) then
    -- Historical/expired Planning Rooms are immutable by design. They are
    -- provenance, not repair targets. Never fight the expiry guard trigger.
    return false;
  end if;

  -- Never silently move an Intent away from another active Plan.
  if exists (
    select 1
    from public.plan_intents link
    where link.intent_id = p_intent_id
      and link.status = 'active'
      and link.plan_id <> p_plan_id
  ) then
    return false;
  end if;

  -- A host-source Intent is already the Plan's primary source. Do not mutate
  -- that relationship into participant_source.
  if exists (
    select 1
    from public.plan_intents link
    where link.plan_id = p_plan_id
      and link.intent_id = p_intent_id
      and link.relationship = 'host_source'
      and link.status = 'active'
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
      relationship = 'participant_source',
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
      'participant_source',
      'active'
    );
  end if;

  update public.intents
  set
    matching_status = 'matched',
    recruitment_status = 'closed',
    updated_at = now()
  where id = p_intent_id
    and user_id = p_user_id
    and status = 'active';

  return true;
end;
$$;

revoke all on function public.attach_participant_source_intent_to_plan(uuid, uuid, uuid) from public;
revoke all on function public.attach_participant_source_intent_to_plan(uuid, uuid, uuid) from anon;
revoke all on function public.attach_participant_source_intent_to_plan(uuid, uuid, uuid) from authenticated;

-- Exact Match flow: once an accepted Match request has a Plan, the requester's
-- own Intent is known unambiguously. Resolve it immediately instead of waiting
-- for a later page load.
create or replace function public.reconcile_accepted_match_request_lineage_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and new.plan_id is not null then
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

-- There may already be an older trigger with this name on a previous local
-- iteration. Dropping first keeps the migration repeatable in development.
drop trigger if exists reconcile_accepted_match_request_lineage
  on public.intent_requests;

create trigger reconcile_accepted_match_request_lineage
after insert or update of status, plan_id
on public.intent_requests
for each row
when (new.status = 'accepted' and new.plan_id is not null)
execute function public.reconcile_accepted_match_request_lineage_trigger();

-- Repair/read-path RPC. Timeline and Matches call this before loading their
-- counters/cards. It covers legacy rows and the public-join route where a user
-- later becomes a co-host but their original matching Intent was never linked.
create or replace function public.reconcile_my_intent_plan_lineage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row record;
  v_plan_id uuid;
  v_candidate_id uuid;
  v_candidate_count integer;
  v_changed integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- 1) Exact Match requests. own_intent_id is the definitive source Intent.
  for v_row in
    select
      request.own_intent_id,
      request.target_intent_id,
      coalesce(
        request.plan_id,
        (
          select host_link.plan_id
          from public.plan_intents host_link
          join public.plans plan on plan.id = host_link.plan_id
          where host_link.intent_id = request.target_intent_id
            and host_link.relationship = 'host_source'
            and host_link.status = 'active'
            and plan.status in ('forming', 'planned')
          order by plan.created_at desc
          limit 1
        )
      ) as resolved_plan_id
    from public.intent_requests request
    where request.requester_id = v_user_id
      and request.status = 'accepted'
  loop
    if v_row.resolved_plan_id is not null and public.attach_participant_source_intent_to_plan(
      v_user_id,
      v_row.own_intent_id,
      v_row.resolved_plan_id
    ) then
      v_changed := v_changed + 1;
    end if;
  end loop;

  -- 2) Existing participant-source links are authoritative provenance. Make
  -- sure their Intent lifecycle agrees with that relationship.
  update public.intents intent
  set
    matching_status = 'matched',
    recruitment_status = 'closed',
    updated_at = now()
  where intent.user_id = v_user_id
    and intent.status = 'active'
    and (
      coalesce(intent.matching_status, 'open') <> 'matched'
      or coalesce(intent.recruitment_status, 'open') <> 'closed'
    )
    and exists (
      select 1
      from public.plan_intents source_link
      join public.plans plan on plan.id = source_link.plan_id
      where source_link.intent_id = intent.id
        and source_link.relationship = 'participant_source'
        and source_link.status = 'active'
        and plan.status in ('forming', 'planned')
    );

  get diagnostics v_candidate_count = row_count;
  v_changed := v_changed + v_candidate_count;

  -- 3) Legacy/public join repair. If the member is already inside somebody
  -- else's active Plan and exactly one of their still-open Intents clearly
  -- matches that Plan, that Intent is the missing participant source.
  for v_row in
    select
      plan.id as plan_id,
      plan.activity_id,
      plan.location_id,
      plan.window_start,
      plan.window_end
    from public.plans plan
    join public.plan_members member
      on member.plan_id = plan.id
     and member.user_id = v_user_id
     and member.status = 'active'
     and member.role in ('participant', 'co_host')
    where plan.status in ('forming', 'planned')
      and plan.host_user_id <> v_user_id
      and not exists (
        select 1
        from public.plan_intents own_source
        join public.intents own_source_intent
          on own_source_intent.id = own_source.intent_id
         and own_source_intent.user_id = v_user_id
        where own_source.plan_id = plan.id
          and own_source.relationship = 'participant_source'
          and own_source.status = 'active'
      )
  loop
    select
      count(*)::integer,
      (array_agg(candidate.id order by candidate.created_at desc))[1]
    into
      v_candidate_count,
      v_candidate_id
    from public.intents candidate
    where candidate.user_id = v_user_id
      and candidate.status = 'active'
      and coalesce(candidate.matching_status, 'open') = 'open'
      and candidate.recruitment_status = 'open'
      and candidate.expired_at is null
      and candidate.archived_at is null
      and candidate.activity_id = v_row.activity_id
      and candidate.end_date >= current_date
      and candidate.start_date <= v_row.window_end
      and candidate.end_date >= v_row.window_start
      and public.locations_overlap(candidate.location_id, v_row.location_id)
      and not exists (
        select 1
        from public.plan_intents active_link
        where active_link.intent_id = candidate.id
          and active_link.status = 'active'
      )
      -- Do not make a guess when people are already waiting on this Intent.
      and not exists (
        select 1
        from public.intent_join_requests waiting_request
        where waiting_request.intent_id = candidate.id
          and waiting_request.status = 'pending'
      )
      and not exists (
        select 1
        from public.intent_invitations waiting_invitation
        where waiting_invitation.intent_id = candidate.id
          and waiting_invitation.status = 'pending'
      );

    if v_candidate_count = 1 and v_candidate_id is not null then
      if public.attach_participant_source_intent_to_plan(
        v_user_id,
        v_candidate_id,
        v_row.plan_id
      ) then
        v_changed := v_changed + 1;
      end if;
    end if;
  end loop;

  return v_changed;
end;
$$;

revoke all on function public.reconcile_my_intent_plan_lineage() from public;
revoke all on function public.reconcile_my_intent_plan_lineage() from anon;
grant execute on function public.reconcile_my_intent_plan_lineage() to authenticated;

-- Backfill exact accepted Match requests that already have a Plan. This is
-- deterministic, so it is safe to repair for every user during migration.
do $$
declare
  v_request record;
begin
  for v_request in
    select
      request.requester_id,
      request.own_intent_id,
      request.plan_id
    from public.intent_requests request
    join public.plans plan
      on plan.id = request.plan_id
    where request.status = 'accepted'
      and request.plan_id is not null
      and plan.expired_at is null
      and (
        (
          plan.status = 'forming'
          and plan.window_end >= current_date
        )
        or
        (
          plan.status = 'planned'
          and (
            (
              plan.scheduled_end is not null
              and plan.scheduled_end > now() - interval '24 hours'
            )
            or
            (
              plan.scheduled_end is null
              and plan.window_end >= current_date
            )
          )
        )
      )
  loop
    begin
      perform public.attach_participant_source_intent_to_plan(
        v_request.requester_id,
        v_request.own_intent_id,
        v_request.plan_id
      );
    exception
      when sqlstate '22023' then
        -- A legacy database may have an additional immutable-expired-plan
        -- guard stricter than the lifecycle test above. Skip such history
        -- rather than aborting the entire migration.
        null;
    end;
  end loop;
end;
$$;

comment on function public.reconcile_my_intent_plan_lineage() is
  'Repairs Intent → Shared Plan provenance so an Intent that already became an active Plan source no longer remains an independent Match/Open Intent.';
