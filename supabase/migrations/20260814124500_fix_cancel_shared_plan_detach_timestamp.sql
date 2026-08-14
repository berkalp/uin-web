begin;

-- UIN hotfix
-- plan_intents_detached_state_check requires:
--   active   -> detached_at IS NULL
--   detached -> detached_at IS NOT NULL
--
-- The cancellation lifecycle previously changed status to detached
-- without setting detached_at, so the whole cancellation transaction
-- correctly rolled back. This hotfix only replaces the RPC body.

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
  set
    status = 'detached',
    detached_at = coalesce(detached_at, now()),
    updated_at = now()
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

comment on function public.cancel_shared_plan_v3(uuid, text, text) is
  'Cancels a forming Plan or planned Activity as a permanent historical record. Host or active Co-host may cancel. Linked Intents are detached with detached_at recorded and are never reopened automatically.';

commit;
