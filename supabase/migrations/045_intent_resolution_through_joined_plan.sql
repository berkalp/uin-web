-- UIN migration 045
-- Resolve a member's own matching open Intent when they join somebody else's Plan.
-- The Intent is preserved as provenance; it is never deleted or merged destructively.

create table if not exists public.intent_join_resolutions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.intent_join_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_intent_id uuid not null references public.intents(id) on delete cascade,
  target_intent_id uuid not null references public.intents(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  status text not null default 'pending',
  resolution_mode text null,
  decision_reason text null,
  pending_join_request_count integer not null default 0,
  pending_invitation_count integer not null default 0,
  previous_matching_status text null,
  previous_recruitment_status text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint intent_join_resolutions_status_check
    check (status in ('pending', 'auto_resolved', 'resolved', 'kept_open', 'undone')),
  constraint intent_join_resolutions_mode_check
    check (resolution_mode is null or resolution_mode in ('auto', 'manual')),
  constraint intent_join_resolutions_unique_candidate
    unique (request_id, source_intent_id)
);

create index if not exists intent_join_resolutions_user_status_idx
  on public.intent_join_resolutions(user_id, status, created_at desc);

create index if not exists intent_join_resolutions_plan_idx
  on public.intent_join_resolutions(plan_id);

alter table public.intent_join_resolutions enable row level security;

drop policy if exists intent_join_resolutions_select_own
  on public.intent_join_resolutions;
create policy intent_join_resolutions_select_own
  on public.intent_join_resolutions
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.intent_join_resolutions from public;
revoke all on table public.intent_join_resolutions from anon;
grant select on table public.intent_join_resolutions to authenticated;

-- Internal worker. It creates one resolution candidate per matching open Intent.
-- A single unambiguous Intent with no people waiting is resolved automatically.
create or replace function public.prepare_intent_join_resolution(
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_target record;
  v_plan_id uuid;
  v_candidate record;
  v_candidate_count integer := 0;
  v_pending_requests integer := 0;
  v_pending_invitations integer := 0;
  v_created integer := 0;
  v_resolution_status text;
  v_decision_reason text;
  v_resolution_id uuid;
begin
  select
    request.id,
    request.intent_id,
    request.requester_user_id,
    request.status
  into v_request
  from public.intent_join_requests request
  where request.id = p_request_id;

  if not found or v_request.status <> 'accepted' then
    return 0;
  end if;

  select
    intent.id,
    intent.activity_id,
    intent.location_id,
    intent.start_date,
    intent.end_date
  into v_target
  from public.intents intent
  where intent.id = v_request.intent_id;

  if not found or v_target.activity_id is null then
    return 0;
  end if;

  -- The accepted request should already have produced a Shared Plan. The
  -- deferred trigger and the timeline refresh function both call this worker,
  -- so a Plan created later in the same transaction is still discovered.
  select link.plan_id
  into v_plan_id
  from public.plan_intents link
  join public.plans plan on plan.id = link.plan_id
  where link.intent_id = v_request.intent_id
    and link.relationship = 'host_source'
    and link.status = 'active'
    and plan.status in ('forming', 'planned')
  order by plan.created_at desc
  limit 1;

  if v_plan_id is null then
    return 0;
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.intents own_intent
  where own_intent.user_id = v_request.requester_user_id
    and own_intent.id <> v_request.intent_id
    and own_intent.status = 'active'
    and coalesce(own_intent.matching_status, 'open') = 'open'
    and own_intent.expired_at is null
    and own_intent.activity_id = v_target.activity_id
    and own_intent.end_date >= current_date
    and own_intent.start_date <= v_target.end_date
    and own_intent.end_date >= v_target.start_date
    and not exists (
      select 1
      from public.plan_intents existing_link
      where existing_link.intent_id = own_intent.id
        and existing_link.status = 'active'
    );

  if v_candidate_count = 0 then
    return 0;
  end if;

  for v_candidate in
    select
      own_intent.id,
      own_intent.matching_status,
      own_intent.recruitment_status
    from public.intents own_intent
    where own_intent.user_id = v_request.requester_user_id
      and own_intent.id <> v_request.intent_id
      and own_intent.status = 'active'
      and coalesce(own_intent.matching_status, 'open') = 'open'
      and own_intent.expired_at is null
      and own_intent.activity_id = v_target.activity_id
      and own_intent.end_date >= current_date
      and own_intent.start_date <= v_target.end_date
      and own_intent.end_date >= v_target.start_date
      and not exists (
        select 1
        from public.plan_intents existing_link
        where existing_link.intent_id = own_intent.id
          and existing_link.status = 'active'
      )
    order by
      case when own_intent.location_id is not distinct from v_target.location_id then 0 else 1 end,
      own_intent.created_at desc
  loop
    select count(*)::integer
    into v_pending_requests
    from public.intent_join_requests pending_request
    where pending_request.intent_id = v_candidate.id
      and pending_request.status = 'pending';

    select count(*)::integer
    into v_pending_invitations
    from public.intent_invitations invitation
    where invitation.intent_id = v_candidate.id
      and invitation.status = 'pending';

    if v_candidate_count = 1
       and v_pending_requests = 0
       and v_pending_invitations = 0 then
      v_resolution_status := 'auto_resolved';
      v_decision_reason := 'single_clear_match';
    elsif v_candidate_count > 1 then
      v_resolution_status := 'pending';
      v_decision_reason := 'multiple_matching_intents';
    else
      v_resolution_status := 'pending';
      v_decision_reason := 'existing_interest';
    end if;

    insert into public.intent_join_resolutions (
      request_id,
      user_id,
      source_intent_id,
      target_intent_id,
      plan_id,
      status,
      resolution_mode,
      decision_reason,
      pending_join_request_count,
      pending_invitation_count,
      previous_matching_status,
      previous_recruitment_status,
      resolved_at,
      updated_at
    )
    values (
      v_request.id,
      v_request.requester_user_id,
      v_candidate.id,
      v_request.intent_id,
      v_plan_id,
      v_resolution_status,
      case when v_resolution_status = 'auto_resolved' then 'auto' else null end,
      v_decision_reason,
      v_pending_requests,
      v_pending_invitations,
      v_candidate.matching_status,
      v_candidate.recruitment_status,
      case when v_resolution_status = 'auto_resolved' then now() else null end,
      now()
    )
    on conflict (request_id, source_intent_id) do nothing
    returning id into v_resolution_id;

    if v_resolution_id is null then
      continue;
    end if;

    v_created := v_created + 1;

    if v_resolution_status = 'auto_resolved' then
      -- Keep both Intent records. The member's Intent becomes participant
      -- provenance for the Shared Plan rather than remaining discoverable.
      if exists (
        select 1
        from public.plan_intents existing_link
        where existing_link.plan_id = v_plan_id
          and existing_link.intent_id = v_candidate.id
      ) then
        update public.plan_intents
        set
          relationship = 'participant_source',
          status = 'active',
          detached_at = null,
          updated_at = now()
        where plan_id = v_plan_id
          and intent_id = v_candidate.id;
      else
        insert into public.plan_intents (
          plan_id,
          intent_id,
          relationship,
          status
        ) values (
          v_plan_id,
          v_candidate.id,
          'participant_source',
          'active'
        );
      end if;

      update public.intents
      set
        matching_status = 'matched',
        recruitment_status = 'closed',
        updated_at = now()
      where id = v_candidate.id
        and user_id = v_request.requester_user_id;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.prepare_intent_join_resolution(uuid) from public;
revoke all on function public.prepare_intent_join_resolution(uuid) from anon;
revoke all on function public.prepare_intent_join_resolution(uuid) from authenticated;

-- Deferred trigger so the Shared Plan can be created after the request status is
-- changed to accepted inside the existing response RPC.
create or replace function public.prepare_intent_join_resolution_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' then
    perform public.prepare_intent_join_resolution(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.prepare_intent_join_resolution_trigger() from public;

drop trigger if exists prepare_intent_resolution_after_join_accept
  on public.intent_join_requests;
create constraint trigger prepare_intent_resolution_after_join_accept
after insert or update
on public.intent_join_requests
deferrable initially deferred
for each row
when (new.status = 'accepted')
execute function public.prepare_intent_join_resolution_trigger();

-- Backfill/repair path used by Timeline. This also handles accepted requests
-- that existed before migration 045.
create or replace function public.refresh_my_intent_join_resolutions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request record;
  v_created integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  for v_request in
    select request.id
    from public.intent_join_requests request
    where request.requester_user_id = v_user_id
      and request.status = 'accepted'
    order by request.created_at desc
  loop
    v_created := v_created + public.prepare_intent_join_resolution(v_request.id);
  end loop;

  return v_created;
end;
$$;

revoke all on function public.refresh_my_intent_join_resolutions() from public;
revoke all on function public.refresh_my_intent_join_resolutions() from anon;
grant execute on function public.refresh_my_intent_join_resolutions() to authenticated;

create or replace function public.resolve_my_joined_intent(
  p_resolution_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_resolution public.intent_join_resolutions%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
  into v_resolution
  from public.intent_join_resolutions resolution
  where resolution.id = p_resolution_id
    and resolution.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Intent resolution could not be found.' using errcode = 'P0002';
  end if;

  if v_action = 'keep_open' then
    if v_resolution.status <> 'pending' then
      raise exception 'This resolution no longer needs a decision.' using errcode = '22023';
    end if;

    update public.intent_join_resolutions
    set
      status = 'kept_open',
      resolution_mode = 'manual',
      resolved_at = now(),
      updated_at = now()
    where id = v_resolution.id;

    return v_resolution.plan_id;
  end if;

  if v_action = 'resolve' then
    if v_resolution.status not in ('pending', 'kept_open') then
      raise exception 'This Intent cannot be resolved from its current state.' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.plan_intents active_link
      where active_link.intent_id = v_resolution.source_intent_id
        and active_link.status = 'active'
        and active_link.plan_id <> v_resolution.plan_id
    ) then
      raise exception 'Your Intent is already connected to another active Plan.' using errcode = '23505';
    end if;

    -- The user explicitly chose this Plan, so pending people on their own Intent
    -- are closed cleanly rather than silently stranded.
    update public.intent_join_requests
    set
      status = 'declined',
      response_reason = 'This Intent was resolved through another Shared Plan.',
      responded_at = coalesce(responded_at, now()),
      updated_at = now()
    where intent_id = v_resolution.source_intent_id
      and status = 'pending';

    update public.intent_invitations
    set
      status = 'revoked',
      revoked_at = coalesce(revoked_at, now()),
      revoked_by = coalesce(revoked_by, v_user_id),
      updated_at = now()
    where intent_id = v_resolution.source_intent_id
      and status = 'pending';

    if exists (
      select 1
      from public.plan_intents existing_link
      where existing_link.plan_id = v_resolution.plan_id
        and existing_link.intent_id = v_resolution.source_intent_id
    ) then
      update public.plan_intents
      set
        relationship = 'participant_source',
        status = 'active',
        detached_at = null,
        updated_at = now()
      where plan_id = v_resolution.plan_id
        and intent_id = v_resolution.source_intent_id;
    else
      insert into public.plan_intents (
        plan_id,
        intent_id,
        relationship,
        status
      ) values (
        v_resolution.plan_id,
        v_resolution.source_intent_id,
        'participant_source',
        'active'
      );
    end if;

    update public.intents
    set
      matching_status = 'matched',
      recruitment_status = 'closed',
      updated_at = now()
    where id = v_resolution.source_intent_id
      and user_id = v_user_id;

    update public.intent_join_resolutions
    set
      status = 'resolved',
      resolution_mode = 'manual',
      resolved_at = now(),
      updated_at = now()
    where id = v_resolution.id;

    -- If one accepted request matched multiple own Intents, resolving one is an
    -- explicit choice. Leave the others open and clear their pending prompts.
    update public.intent_join_resolutions
    set
      status = 'kept_open',
      resolution_mode = 'manual',
      resolved_at = now(),
      updated_at = now()
    where request_id = v_resolution.request_id
      and id <> v_resolution.id
      and status = 'pending';

    return v_resolution.plan_id;
  end if;

  if v_action = 'undo' then
    if v_resolution.status <> 'auto_resolved' then
      raise exception 'Only an automatic resolution can be undone.' using errcode = '22023';
    end if;

    update public.plan_intents
    set
      status = 'detached',
      detached_at = coalesce(detached_at, now()),
      updated_at = now()
    where plan_id = v_resolution.plan_id
      and intent_id = v_resolution.source_intent_id
      and relationship = 'participant_source'
      and status = 'active';

    update public.intents
    set
      matching_status = coalesce(v_resolution.previous_matching_status, 'open'),
      recruitment_status = coalesce(v_resolution.previous_recruitment_status, 'open'),
      updated_at = now()
    where id = v_resolution.source_intent_id
      and user_id = v_user_id;

    update public.intent_join_resolutions
    set
      status = 'undone',
      resolution_mode = 'manual',
      resolved_at = now(),
      updated_at = now()
    where id = v_resolution.id;

    return v_resolution.plan_id;
  end if;

  raise exception 'Unsupported resolution action.' using errcode = '22023';
end;
$$;

revoke all on function public.resolve_my_joined_intent(uuid, text) from public;
revoke all on function public.resolve_my_joined_intent(uuid, text) from anon;
grant execute on function public.resolve_my_joined_intent(uuid, text) to authenticated;

comment on table public.intent_join_resolutions is
  'Preserves the provenance between a member''s own Intent and a Shared Plan they joined for the same Activity.';
