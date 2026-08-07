begin;

-- Fix the "Activity did not happen" lifecycle transition.
--
-- The previous flow could reopen a linked Intent while the Plan/Intent link
-- was still active. sync_plan_from_host_intent() would then interpret the
-- Intent change as an attempt to move a confirmed Activity back to forming,
-- which correctly raised "A confirmed Activity cannot return to planning.".
--
-- v2 preserves the Activity as a cancelled historical record, detaches its
-- Intent links first, and only then reopens/expirs the linked Intents.

create or replace function public.mark_shared_plan_not_happened_v2(
  p_plan_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_plan public.plans%rowtype;
  v_reason text;
  v_intent_ids uuid[] := array[]::uuid[];
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_reason is null then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;

  if char_length(v_reason) > 1000 then
    raise exception 'Reason cannot exceed 1000 characters.' using errcode = '22023';
  end if;

  select plan.*
  into v_plan
  from public.plans plan
  where plan.id = p_plan_id
  for update;

  if not found then
    raise exception 'Activity not found.' using errcode = 'P0002';
  end if;

  if v_plan.host_user_id <> v_user_id then
    raise exception 'Only the Primary Host can mark this Activity as not happened.' using errcode = '42501';
  end if;

  if v_plan.status <> 'planned' then
    raise exception 'Only a Planned Activity can be marked as not happened.' using errcode = '22023';
  end if;

  if v_plan.scheduled_end is null or v_plan.scheduled_end > now() then
    raise exception 'The confirmed schedule has not ended yet.' using errcode = '22023';
  end if;

  select coalesce(array_agg(link.intent_id), array[]::uuid[])
  into v_intent_ids
  from public.plan_intents link
  where link.plan_id = p_plan_id
    and link.status = 'active';

  -- Detach first. This is the important part: subsequent Intent updates must
  -- not be mirrored back into the already-confirmed Plan.
  update public.plan_intents
  set status = 'detached'
  where plan_id = p_plan_id
    and status = 'active';

  update public.plans
  set
    status = 'cancelled',
    recruitment_status = 'closed',
    cancelled_at = now(),
    cancelled_by = v_user_id,
    cancellation_reason = v_reason,
    updated_at = now()
  where id = p_plan_id;

  -- A not-happened Activity does not manufacture attendance observations.
  update public.plan_members
  set attendance_status = 'pending'
  where plan_id = p_plan_id
    and status = 'active';

  if cardinality(v_intent_ids) > 0 then
    update public.intents intent
    set
      status = 'active',
      planned_at = null,
      matching_status = case
        when intent.end_date < current_date then 'closed'
        else 'open'
      end,
      recruitment_status = case
        when intent.end_date < current_date then 'closed'
        else 'open'
      end,
      expired_at = case
        when intent.end_date < current_date then coalesce(intent.expired_at, now())
        else null
      end,
      updated_at = now()
    where intent.id = any(v_intent_ids);
  end if;

  return jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'status', 'cancelled',
    'reason', v_reason,
    'linked_intent_count', cardinality(v_intent_ids)
  );
end;
$function$;

revoke all on function public.mark_shared_plan_not_happened_v2(uuid, text) from public;
grant execute on function public.mark_shared_plan_not_happened_v2(uuid, text) to authenticated;

comment on function public.mark_shared_plan_not_happened_v2(uuid, text) is
  'Records that a confirmed Planned Activity did not happen without attempting to return that confirmed Plan to forming. Active Plan/Intent links are detached before linked Intents are reopened or expired.';

commit;
