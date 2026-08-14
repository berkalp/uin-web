begin;

-- ============================================================
-- UIN: Plan / Activity cancellation, participant departure,
--      explicit Intent recovery, and durable lifecycle history.
--
-- Product rules:
-- - A cancelled Plan / Activity remains a historical record.
-- - Host or active Co-host may cancel a forming Plan or planned Activity.
-- - A non-primary-host active member may leave with a private reason.
-- - Cancelling never reopens everybody's Intent automatically.
-- - Each Intent owner decides whether to reopen their own linked Intent.
-- - Old plan_intents rows are detached, never deleted, preserving lineage.
-- ============================================================

alter table public.plans
  add column if not exists cancellation_reason_code text,
  add column if not exists cancellation_phase text;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plans_cancellation_phase_check'
      and conrelid = 'public.plans'::regclass
  ) then
    alter table public.plans
      add constraint plans_cancellation_phase_check
      check (
        cancellation_phase is null
        or cancellation_phase in ('planning', 'activity')
      );
  end if;
end;
$constraints$;

create table if not exists public.plan_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  room_phase text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plan_lifecycle_events_room_phase_check
    check (room_phase is null or room_phase in ('planning', 'activity'))
);

create index if not exists plan_lifecycle_events_plan_created_idx
  on public.plan_lifecycle_events (plan_id, created_at desc);

create table if not exists public.plan_member_departures (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  room_phase text not null,
  reason_code text not null,
  reason_text text,
  departed_at timestamptz not null default now(),
  constraint plan_member_departures_room_phase_check
    check (room_phase in ('planning', 'activity'))
);

create index if not exists plan_member_departures_plan_departed_idx
  on public.plan_member_departures (plan_id, departed_at desc);

create index if not exists plan_member_departures_member_idx
  on public.plan_member_departures (member_user_id, departed_at desc);

create table if not exists public.intent_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intents(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intent_lifecycle_events_intent_created_idx
  on public.intent_lifecycle_events (intent_id, created_at desc);

create unique index if not exists intent_lifecycle_events_one_reopen_per_plan_idx
  on public.intent_lifecycle_events (intent_id, plan_id, event_type)
  where event_type = 'reopened_after_plan_cancelled';

alter table public.plan_lifecycle_events enable row level security;
alter table public.plan_member_departures enable row level security;
alter table public.intent_lifecycle_events enable row level security;

grant select on public.plan_lifecycle_events to authenticated;
grant select on public.plan_member_departures to authenticated;
grant select on public.intent_lifecycle_events to authenticated;

-- Lifecycle history is visible to anyone who belongs/belonged to the Plan,
-- the Primary Host, or an owner of one of the linked source Intents.
drop policy if exists "Plan people can view lifecycle history" on public.plan_lifecycle_events;
create policy "Plan people can view lifecycle history"
  on public.plan_lifecycle_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.plans plan
      where plan.id = plan_lifecycle_events.plan_id
        and plan.host_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.plan_members member
      where member.plan_id = plan_lifecycle_events.plan_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.plan_intents link
      join public.intents intent on intent.id = link.intent_id
      where link.plan_id = plan_lifecycle_events.plan_id
        and intent.user_id = auth.uid()
    )
  );

-- Departure reasons are private to the departing member and organizers.
drop policy if exists "Departure reasons are private to member and organizers" on public.plan_member_departures;
create policy "Departure reasons are private to member and organizers"
  on public.plan_member_departures
  for select
  to authenticated
  using (
    member_user_id = auth.uid()
    or exists (
      select 1
      from public.plans plan
      where plan.id = plan_member_departures.plan_id
        and plan.host_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.plan_members member
      where member.plan_id = plan_member_departures.plan_id
        and member.user_id = auth.uid()
        and member.status::text = 'active'
        and member.role::text = 'co_host'
    )
  );

-- An Intent's lifecycle history belongs to that Intent owner.
drop policy if exists "Intent owners can view lifecycle history" on public.intent_lifecycle_events;
create policy "Intent owners can view lifecycle history"
  on public.intent_lifecycle_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.intents intent
      where intent.id = intent_lifecycle_events.intent_id
        and intent.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Cancel a forming Plan or planned Activity.
-- ------------------------------------------------------------
create or replace function public.cancel_shared_plan_v3(
  p_plan_id uuid,
  p_reason_code text,
  p_reason_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_actor_role text;
  v_phase text;
  v_reason_code text;
  v_reason_text text;
  v_reason_label text;
  v_plan_title text;
  v_active_member_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select plan.*
  into v_plan
  from public.plans plan
  where plan.id = p_plan_id
  for update;

  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan.status::text not in ('forming', 'planned') then
    raise exception 'Only an active Planning Room or Activity Room can be cancelled.' using errcode = '22023';
  end if;

  if v_plan.host_user_id = v_user_id then
    v_actor_role := 'host';
  else
    select member.role::text
    into v_actor_role
    from public.plan_members member
    where member.plan_id = p_plan_id
      and member.user_id = v_user_id
      and member.status::text = 'active'
      and member.role::text = 'co_host'
    limit 1;
  end if;

  if coalesce(v_actor_role, '') not in ('host', 'co_host') then
    raise exception 'Only the Primary Host or an active Co-host can cancel this Plan or Activity.' using errcode = '42501';
  end if;

  v_reason_code := nullif(btrim(coalesce(p_reason_code, '')), '');
  v_reason_text := nullif(btrim(coalesce(p_reason_text, '')), '');

  if v_reason_code is null or v_reason_code not in (
    'schedule_conflict',
    'insufficient_participation',
    'venue_or_event_cancelled',
    'weather_or_safety',
    'personal_reason',
    'other'
  ) then
    raise exception 'Please select a valid cancellation reason.' using errcode = '22023';
  end if;

  if v_reason_text is not null and char_length(v_reason_text) > 1000 then
    raise exception 'Cancellation note cannot exceed 1000 characters.' using errcode = '22023';
  end if;

  if v_reason_code = 'other' and v_reason_text is null then
    raise exception 'Please add a short explanation for Other.' using errcode = '22023';
  end if;

  v_reason_label := case v_reason_code
    when 'schedule_conflict' then 'Schedule conflict'
    when 'insufficient_participation' then 'Not enough participants'
    when 'venue_or_event_cancelled' then 'Venue or event cancelled'
    when 'weather_or_safety' then 'Weather or safety'
    when 'personal_reason' then 'Personal reason'
    else 'Other'
  end;

  v_phase := case when v_plan.status::text = 'forming' then 'planning' else 'activity' end;
  v_plan_title := coalesce(nullif(btrim(v_plan.title), ''), 'UIN Activity');

  -- Detach first so Intent updates made later by their owners never sync back
  -- into this cancelled historical Plan.
  update public.plan_intents
  set status = 'detached'
  where plan_id = p_plan_id
    and status::text = 'active';

  update public.plans
  set
    status = 'cancelled',
    recruitment_status = 'closed',
    cancelled_at = now(),
    cancelled_by = v_user_id,
    cancellation_reason_code = v_reason_code,
    cancellation_reason = coalesce(v_reason_text, v_reason_label),
    cancellation_phase = v_phase,
    updated_at = now()
  where id = p_plan_id;

  -- A cancelled Activity has no attendance outcome. The membership history is
  -- kept active for archive visibility; only attendance becomes cancelled.
  update public.plan_members
  set attendance_status = 'cancelled'
  where plan_id = p_plan_id
    and status::text = 'active';

  insert into public.plan_lifecycle_events (
    plan_id,
    event_type,
    actor_user_id,
    room_phase,
    metadata
  )
  values (
    p_plan_id,
    'plan_cancelled',
    v_user_id,
    v_phase,
    jsonb_build_object(
      'actor_role', v_actor_role,
      'reason_code', v_reason_code,
      'reason_label', v_reason_label,
      'reason_text', v_reason_text
    )
  );

  insert into public.plan_messages (
    plan_id,
    sender_id,
    room_phase,
    message_type,
    system_event,
    body,
    metadata,
    created_at
  )
  values (
    p_plan_id,
    null,
    v_phase,
    'system',
    'plan_cancelled',
    case when v_phase = 'planning' then 'The Plan was cancelled.' else 'The Activity was cancelled.' end,
    jsonb_build_object(
      'actor_user_id', v_user_id,
      'reason_label', v_reason_label
    ),
    now()
  );

  -- Participants receive one real lifecycle notification. The reason text is
  -- appropriate to share for organizer cancellation.
  insert into public.notifications (
    user_id,
    actor_user_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body,
    action_url,
    source_key,
    created_at
  )
  select distinct
    recipient.user_id,
    v_user_id,
    case when v_phase = 'planning' then 'plan_cancelled' else 'activity_cancelled' end,
    'plan',
    p_plan_id,
    left(
      case when v_phase = 'planning'
        then 'Plan iptal edildi · ' || v_plan_title
        else 'Aktivite iptal edildi · ' || v_plan_title
      end,
      200
    ),
    left(
      v_reason_label || coalesce(' · ' || v_reason_text, ''),
      1000
    ),
    case when v_phase = 'planning'
      then '/plan-room/' || p_plan_id::text
      else '/activity-room/' || p_plan_id::text
    end,
    'plan-cancelled:' || p_plan_id::text || ':user:' || recipient.user_id::text,
    now()
  from (
    select v_plan.host_user_id as user_id
    union
    select member.user_id
    from public.plan_members member
    where member.plan_id = p_plan_id
      and member.status::text = 'active'
  ) recipient
  where recipient.user_id is not null
    and recipient.user_id <> v_user_id
    and not exists (
      select 1
      from public.notifications existing
      where existing.source_key =
        'plan-cancelled:' || p_plan_id::text || ':user:' || recipient.user_id::text
    );

  select count(*)::integer
  into v_active_member_count
  from public.plan_members member
  where member.plan_id = p_plan_id
    and member.status::text = 'active';

  return jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'status', 'cancelled',
    'phase', v_phase,
    'actor_role', v_actor_role,
    'reason_code', v_reason_code,
    'active_member_count', v_active_member_count,
    'intents_reopened', 0,
    'recovery', 'Each linked Intent owner chooses whether to reopen their own Intent.'
  );
end;
$function$;

revoke all on function public.cancel_shared_plan_v3(uuid, text, text) from public, anon;
grant execute on function public.cancel_shared_plan_v3(uuid, text, text) to authenticated;

-- Backward-compatible outcome RPC. It now uses the explicit cancellation
-- lifecycle and therefore does NOT reopen everybody's Intent automatically.
create or replace function public.mark_shared_plan_not_happened_v2(
  p_plan_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  return public.cancel_shared_plan_v3(
    p_plan_id,
    'other',
    p_reason
  );
end;
$function$;

revoke all on function public.mark_shared_plan_not_happened_v2(uuid, text) from public, anon;
grant execute on function public.mark_shared_plan_not_happened_v2(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Leave a Planning Room / Activity Room without deleting history.
-- Primary Host must transfer Host first; active Co-hosts may leave.
-- ------------------------------------------------------------
create or replace function public.leave_shared_plan_v2(
  p_plan_id uuid,
  p_reason_code text,
  p_reason_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_member public.plan_members%rowtype;
  v_phase text;
  v_reason_code text;
  v_reason_text text;
  v_reason_label text;
  v_member_name text;
  v_plan_title text;
  v_active_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select plan.*
  into v_plan
  from public.plans plan
  where plan.id = p_plan_id
  for update;

  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan.status::text not in ('forming', 'planned') then
    raise exception 'You can only leave an active Planning Room or Activity Room.' using errcode = '22023';
  end if;

  if v_plan.host_user_id = v_user_id then
    raise exception 'Transfer the Primary Host role before leaving.' using errcode = '42501';
  end if;

  select member.*
  into v_member
  from public.plan_members member
  where member.plan_id = p_plan_id
    and member.user_id = v_user_id
    and member.status::text = 'active'
  for update;

  if not found then
    raise exception 'You are not an active member of this Plan.' using errcode = '42501';
  end if;

  v_reason_code := nullif(btrim(coalesce(p_reason_code, '')), '');
  v_reason_text := nullif(btrim(coalesce(p_reason_text, '')), '');

  if v_reason_code is null or v_reason_code not in (
    'schedule_changed',
    'transport_problem',
    'cost',
    'personal_reason',
    'no_longer_interested',
    'other'
  ) then
    raise exception 'Please select a valid reason for leaving.' using errcode = '22023';
  end if;

  if v_reason_text is not null and char_length(v_reason_text) > 1000 then
    raise exception 'Explanation cannot exceed 1000 characters.' using errcode = '22023';
  end if;

  if v_reason_code = 'other' and v_reason_text is null then
    raise exception 'Please add a short explanation for Other.' using errcode = '22023';
  end if;

  v_reason_label := case v_reason_code
    when 'schedule_changed' then 'My schedule changed'
    when 'transport_problem' then 'Transport problem'
    when 'cost' then 'Cost or budget'
    when 'personal_reason' then 'Personal reason'
    when 'no_longer_interested' then 'I no longer want to participate'
    else 'Other'
  end;

  v_phase := case when v_plan.status::text = 'forming' then 'planning' else 'activity' end;
  v_plan_title := coalesce(nullif(btrim(v_plan.title), ''), 'UIN Activity');

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(profile.username), ''),
    'A participant'
  )
  into v_member_name
  from public.profiles profile
  where profile.id = v_user_id;

  v_member_name := coalesce(v_member_name, 'A participant');

  update public.plan_members
  set
    status = 'withdrawn',
    departed_at = now(),
    attendance_status = 'cancelled'
  where id = v_member.id;

  insert into public.plan_member_departures (
    plan_id,
    member_user_id,
    actor_user_id,
    room_phase,
    reason_code,
    reason_text,
    departed_at
  )
  values (
    p_plan_id,
    v_user_id,
    v_user_id,
    v_phase,
    v_reason_code,
    v_reason_text,
    now()
  );

  insert into public.plan_lifecycle_events (
    plan_id,
    event_type,
    actor_user_id,
    subject_user_id,
    room_phase,
    metadata
  )
  values (
    p_plan_id,
    'member_left',
    v_user_id,
    v_user_id,
    v_phase,
    jsonb_build_object(
      'member_role', v_member.role::text
    )
  );

  insert into public.plan_messages (
    plan_id,
    sender_id,
    room_phase,
    message_type,
    system_event,
    body,
    metadata,
    created_at
  )
  values (
    p_plan_id,
    null,
    v_phase,
    'system',
    'member_left',
    v_member_name || case when v_phase = 'planning' then ' left the Plan.' else ' will not attend the Activity.' end,
    jsonb_build_object('user_id', v_user_id),
    now()
  );

  -- If capacity made recruitment FULL, a departure re-opens one place.
  select count(*)::integer
  into v_active_count
  from public.plan_members member
  where member.plan_id = p_plan_id
    and member.status::text = 'active';

  if v_plan.recruitment_status::text = 'full'
     and (v_plan.max_participants is null or v_active_count < v_plan.max_participants)
  then
    update public.plans
    set recruitment_status = 'open', updated_at = now()
    where id = p_plan_id;
  end if;

  -- Only organizers receive the private reason in a notification.
  insert into public.notifications (
    user_id,
    actor_user_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body,
    action_url,
    source_key,
    created_at
  )
  select distinct
    organizer.user_id,
    v_user_id,
    'plan_member_left',
    'plan',
    p_plan_id,
    left(v_member_name || ' ayrıldı · ' || v_plan_title, 200),
    left(v_reason_label || coalesce(' · ' || v_reason_text, ''), 1000),
    case when v_phase = 'planning'
      then '/plan-room/' || p_plan_id::text || '#team-chat'
      else '/activity-room/' || p_plan_id::text || '#team-chat'
    end,
    'plan-member-left:' || p_plan_id::text || ':member:' || v_user_id::text || ':user:' || organizer.user_id::text,
    now()
  from (
    select v_plan.host_user_id as user_id
    union
    select member.user_id
    from public.plan_members member
    where member.plan_id = p_plan_id
      and member.status::text = 'active'
      and member.role::text = 'co_host'
  ) organizer
  where organizer.user_id is not null
    and organizer.user_id <> v_user_id
    and not exists (
      select 1
      from public.notifications existing
      where existing.source_key =
        'plan-member-left:' || p_plan_id::text || ':member:' || v_user_id::text || ':user:' || organizer.user_id::text
    );

  return jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'member_user_id', v_user_id,
    'status', 'withdrawn',
    'phase', v_phase,
    'reason_code', v_reason_code
  );
end;
$function$;

revoke all on function public.leave_shared_plan_v2(uuid, text, text) from public, anon;
grant execute on function public.leave_shared_plan_v2(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- Private departure reason history for Host / Co-host.
-- ------------------------------------------------------------
create or replace function public.get_plan_member_departures(
  p_plan_id uuid
)
returns table (
  departure_id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  room_phase text,
  reason_code text,
  reason_text text,
  departed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with viewer as (
    select
      auth.uid() as user_id,
      exists (
        select 1
        from public.plans plan
        where plan.id = p_plan_id
          and plan.host_user_id = auth.uid()
      ) as is_host,
      exists (
        select 1
        from public.plan_members member
        where member.plan_id = p_plan_id
          and member.user_id = auth.uid()
          and member.status::text = 'active'
          and member.role::text = 'co_host'
      ) as is_co_host
  )
  select
    departure.id,
    departure.member_user_id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    departure.room_phase,
    departure.reason_code,
    departure.reason_text,
    departure.departed_at
  from public.plan_member_departures departure
  left join public.profiles profile on profile.id = departure.member_user_id
  cross join viewer
  where departure.plan_id = p_plan_id
    and viewer.user_id is not null
    and (
      viewer.is_host
      or viewer.is_co_host
      or departure.member_user_id = viewer.user_id
    )
  order by departure.departed_at desc;
$function$;

revoke all on function public.get_plan_member_departures(uuid) from public, anon;
grant execute on function public.get_plan_member_departures(uuid) to authenticated;

-- ------------------------------------------------------------
-- Recovery options belong to each linked Intent owner.
-- ------------------------------------------------------------
create or replace function public.get_my_cancelled_plan_recovery_options(
  p_plan_id uuid
)
returns table (
  intent_id uuid,
  relationship text,
  end_date date,
  intent_status text,
  matching_status text,
  recruitment_status text,
  already_reopened boolean,
  can_reopen boolean,
  recovery_reason text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    intent.id,
    link.relationship::text,
    intent.end_date,
    intent.status::text,
    intent.matching_status::text,
    intent.recruitment_status::text,
    (
      intent.status::text = 'active'
      and intent.planned_at is null
      and intent.matching_status::text = 'open'
    ) as already_reopened,
    (
      plan.status::text = 'cancelled'
      and intent.end_date >= current_date
      and not (
        intent.status::text = 'active'
        and intent.planned_at is null
        and intent.matching_status::text = 'open'
      )
      and not exists (
        select 1
        from public.plan_intents other_link
        join public.plans other_plan on other_plan.id = other_link.plan_id
        where other_link.intent_id = intent.id
          and other_link.status::text = 'active'
          and other_link.plan_id <> p_plan_id
          and other_plan.status::text in ('forming', 'planned')
      )
    ) as can_reopen,
    case
      when plan.status::text <> 'cancelled' then 'plan_not_cancelled'
      when intent.status::text = 'active'
        and intent.planned_at is null
        and intent.matching_status::text = 'open' then 'already_reopened'
      when intent.end_date < current_date then 'intent_window_ended'
      when exists (
        select 1
        from public.plan_intents other_link
        join public.plans other_plan on other_plan.id = other_link.plan_id
        where other_link.intent_id = intent.id
          and other_link.status::text = 'active'
          and other_link.plan_id <> p_plan_id
          and other_plan.status::text in ('forming', 'planned')
      ) then 'already_linked_elsewhere'
      else 'ready'
    end as recovery_reason
  from public.plan_intents link
  join public.intents intent on intent.id = link.intent_id
  join public.plans plan on plan.id = link.plan_id
  where link.plan_id = p_plan_id
    and intent.user_id = auth.uid()
  order by
    case when link.relationship::text = 'host_source' then 0 else 1 end,
    intent.created_at;
$function$;

revoke all on function public.get_my_cancelled_plan_recovery_options(uuid) from public, anon;
grant execute on function public.get_my_cancelled_plan_recovery_options(uuid) to authenticated;

create or replace function public.reopen_my_intent_after_cancelled_plan(
  p_plan_id uuid,
  p_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan_status text;
  v_intent public.intents%rowtype;
  v_has_link boolean := false;
  v_has_other_active_plan boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select plan.status::text
  into v_plan_status
  from public.plans plan
  where plan.id = p_plan_id;

  if v_plan_status is null then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan_status <> 'cancelled' then
    raise exception 'Only an Intent linked to a cancelled Plan can be reopened here.' using errcode = '22023';
  end if;

  select intent.*
  into v_intent
  from public.intents intent
  where intent.id = p_intent_id
    and intent.user_id = v_user_id
  for update;

  if not found then
    raise exception 'This Intent does not belong to you.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.plan_intents link
    where link.plan_id = p_plan_id
      and link.intent_id = p_intent_id
  )
  into v_has_link;

  if not v_has_link then
    raise exception 'This Intent was not linked to the cancelled Plan.' using errcode = '22023';
  end if;

  if v_intent.end_date < current_date then
    return jsonb_build_object(
      'ok', false,
      'reason', 'intent_window_ended',
      'message', 'The original Intent window has ended. Create a similar Intent with new dates instead.'
    );
  end if;

  select exists (
    select 1
    from public.plan_intents link
    join public.plans plan on plan.id = link.plan_id
    where link.intent_id = p_intent_id
      and link.status::text = 'active'
      and link.plan_id <> p_plan_id
      and plan.status::text in ('forming', 'planned')
  )
  into v_has_other_active_plan;

  if v_has_other_active_plan then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_linked_elsewhere',
      'message', 'This Intent is already linked to another active Plan or Activity.'
    );
  end if;

  if v_intent.status::text = 'active'
     and v_intent.planned_at is null
     and v_intent.matching_status::text = 'open'
  then
    return jsonb_build_object(
      'ok', true,
      'intent_id', p_intent_id,
      'already_reopened', true
    );
  end if;

  update public.intents
  set
    status = 'active',
    planned_at = null,
    matching_status = 'open',
    recruitment_status = 'open',
    expired_at = null,
    updated_at = now()
  where id = p_intent_id;

  insert into public.intent_lifecycle_events (
    intent_id,
    plan_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    p_intent_id,
    p_plan_id,
    'reopened_after_plan_cancelled',
    v_user_id,
    jsonb_build_object('reopened_at', now())
  )
  on conflict do nothing;

  insert into public.plan_lifecycle_events (
    plan_id,
    event_type,
    actor_user_id,
    subject_user_id,
    metadata
  )
  values (
    p_plan_id,
    'linked_intent_reopened',
    v_user_id,
    v_user_id,
    jsonb_build_object('intent_id', p_intent_id)
  );

  return jsonb_build_object(
    'ok', true,
    'intent_id', p_intent_id,
    'already_reopened', false,
    'status', 'active',
    'matching_status', 'open',
    'recruitment_status', 'open'
  );
end;
$function$;

revoke all on function public.reopen_my_intent_after_cancelled_plan(uuid, uuid) from public, anon;
grant execute on function public.reopen_my_intent_after_cancelled_plan(uuid, uuid) to authenticated;

comment on function public.cancel_shared_plan_v3(uuid, text, text) is
  'Cancels a forming Plan or planned Activity as a permanent historical record. Host or active Co-host may cancel. Linked Intents are detached but are never reopened automatically.';

comment on function public.leave_shared_plan_v2(uuid, text, text) is
  'Lets a non-primary-host active member leave a forming Plan or planned Activity while preserving membership history and a private reason for organizers.';

comment on function public.reopen_my_intent_after_cancelled_plan(uuid, uuid) is
  'Lets an Intent owner explicitly reopen only their own Intent after a linked Plan or Activity was cancelled. The cancelled Plan remains unchanged in history.';

commit;
