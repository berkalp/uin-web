begin;

-- UIN lifecycle hotfix
-- Problem:
-- Cancelling a Plan/Activity detached every linked Intent immediately.
-- Those Intents still had status='planned', so Timeline treated them as
-- standalone Planned Intents while the cancelled Activity also remained
-- in Cancelled history.
--
-- Correct model:
-- 1. Cancelled Plan/Activity keeps its Intent lineage attached.
-- 2. Each Intent owner explicitly chooses "Niyetimi Yeniden Aç".
-- 3. Only then is that specific plan_intents link detached and the Intent
--    reopened as active/open.

-- Repair records produced by the previous implementation:
-- If an Intent is still planned, it has NOT been explicitly reopened.
-- Reattach it to its cancelled historical attempt so it no longer appears
-- as a standalone Planned Timeline item.
update public.plan_intents link
set
  status = 'active',
  detached_at = null,
  updated_at = now()
from public.plans plan,
     public.intents intent
where plan.id = link.plan_id
  and intent.id = link.intent_id
  and plan.status::text = 'cancelled'
  and link.status::text = 'detached'
  and intent.status::text = 'planned';

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

  -- Keep linked Intents attached to the cancelled historical Plan.
  -- They are detached only when each Intent owner explicitly reopens their
  -- own Intent. This prevents a planned Intent from becoming a standalone
  -- "Planned" Timeline card after cancellation.

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

  -- Reopening is the moment this Intent leaves the cancelled attempt.
  -- Preserve lineage by detaching the link instead of deleting it.
  update public.plan_intents
  set
    status = 'detached',
    detached_at = coalesce(detached_at, now()),
    updated_at = now()
  where plan_id = p_plan_id
    and intent_id = p_intent_id
    and status::text = 'active';

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

revoke all on function public.cancel_shared_plan_v3(uuid, text, text) from public, anon;
grant execute on function public.cancel_shared_plan_v3(uuid, text, text) to authenticated;

revoke all on function public.reopen_my_intent_after_cancelled_plan(uuid, uuid) from public, anon;
grant execute on function public.reopen_my_intent_after_cancelled_plan(uuid, uuid) to authenticated;

comment on function public.cancel_shared_plan_v3(uuid, text, text) is
  'Cancels a forming Plan or planned Activity as permanent history. Linked Intents remain attached until each owner explicitly reopens their own Intent.';

comment on function public.reopen_my_intent_after_cancelled_plan(uuid, uuid) is
  'Explicitly reopens the caller-owned Intent after a cancelled Plan/Activity, detaching only that Intent link while preserving cancelled-attempt lineage.';

commit;
