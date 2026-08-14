begin;

-- ============================================================
-- UIN: Activity completion -> feedback notifications
--
-- Feedback is part of the real-world lifecycle, not a page users must
-- remember to revisit manually. When a completed Activity has eligible
-- feedback targets, notify the Host and every attended active participant.
--
-- Two triggers cover both possible write orders inside complete_shared_plan:
-- 1) attendance rows may be updated before the Plan becomes completed;
-- 2) the Plan may become completed before an attendance row is finalized.
-- source_key makes both paths safely idempotent.
-- ============================================================

create or replace function public.create_activity_feedback_notification_for_user(
  p_plan_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan_title text;
  v_has_feedback_target boolean := false;
  v_source_key text;
begin
  if p_plan_id is null or p_user_id is null then
    return;
  end if;

  -- This helper already enforces: completed Activity, open feedback window,
  -- non-managed-minor actor, and Host-or-attended-participant eligibility.
  if not public.reputation_feedback_actor_is_eligible(
    p_plan_id,
    p_user_id
  ) then
    return;
  end if;

  -- Do not create an empty task when there is nobody this actor may evaluate.
  select exists (
    select 1
    from public.plans plan
    where plan.id = p_plan_id
      and plan.host_user_id <> p_user_id
      and not public.reputation_is_managed_minor(plan.host_user_id)

    union all

    select 1
    from public.plan_members member
    where member.plan_id = p_plan_id
      and member.status = 'active'
      and member.attendance_status = 'attended'
      and member.user_id <> p_user_id
      and not public.reputation_is_managed_minor(member.user_id)
    limit 1
  )
  into v_has_feedback_target;

  if not v_has_feedback_target then
    return;
  end if;

  select coalesce(
    nullif(btrim(plan.title), ''),
    nullif(btrim(activity.name), ''),
    'UIN Activity'
  )
  into v_plan_title
  from public.plans plan
  left join public.activities activity
    on activity.id = plan.activity_id
  where plan.id = p_plan_id;

  v_source_key :=
    'activity-feedback:' || p_plan_id::text || ':user:' || p_user_id::text;

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
  select
    p_user_id,
    null,
    'activity_feedback',
    'plan',
    p_plan_id,
    left('Değerlendirme zamanı · ' || coalesce(v_plan_title, 'UIN Activity'), 200),
    'Aktivite tamamlandı. Birlikte katıldığın uygun kişileri değerlendir. Geri bildirim Reputation’a, yaşananlar Memory’ye gider.',
    '/activity-room/' || p_plan_id::text || '#activity-feedback',
    v_source_key,
    now()
  where not exists (
    select 1
    from public.notifications notification
    where notification.source_key = v_source_key
  );
end;
$function$;

revoke all
on function public.create_activity_feedback_notification_for_user(uuid, uuid)
from public, anon, authenticated;

create or replace function public.notify_activity_feedback_after_plan_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_recipient record;
begin
  if new.status::text <> 'completed'
    or old.status::text = 'completed'
  then
    return new;
  end if;

  for v_recipient in
    select new.host_user_id as user_id

    union

    select member.user_id
    from public.plan_members member
    where member.plan_id = new.id
      and member.status = 'active'
  loop
    perform public.create_activity_feedback_notification_for_user(
      new.id,
      v_recipient.user_id
    );
  end loop;

  return new;
end;
$function$;

revoke all
on function public.notify_activity_feedback_after_plan_completion()
from public, anon, authenticated;

drop trigger if exists
  plans_notify_activity_feedback_after_completion
on public.plans;

create trigger
  plans_notify_activity_feedback_after_completion
after update of status
on public.plans
for each row
execute function public.notify_activity_feedback_after_plan_completion();

create or replace function public.notify_activity_feedback_after_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan_status text;
begin
  if new.status::text <> 'active'
    or new.attendance_status::text <> 'attended'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status::text = new.status::text
      and old.attendance_status::text = new.attendance_status::text
    then
      return new;
    end if;
  end if;

  select plan.status::text
  into v_plan_status
  from public.plans plan
  where plan.id = new.plan_id;

  if v_plan_status = 'completed' then
    perform public.create_activity_feedback_notification_for_user(
      new.plan_id,
      new.user_id
    );
  end if;

  return new;
end;
$function$;

revoke all
on function public.notify_activity_feedback_after_attendance_change()
from public, anon, authenticated;

drop trigger if exists
  plan_members_notify_activity_feedback_after_attendance
on public.plan_members;

create trigger
  plan_members_notify_activity_feedback_after_attendance
after insert or update
on public.plan_members
for each row
execute function public.notify_activity_feedback_after_attendance_change();

comment on function public.create_activity_feedback_notification_for_user(uuid, uuid)
is
  'Creates one deduplicated Activity-feedback notification for an eligible Host or attended participant when at least one eligible feedback target exists.';

commit;
