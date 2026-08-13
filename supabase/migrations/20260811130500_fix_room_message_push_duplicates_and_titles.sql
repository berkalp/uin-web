begin;

-- ============================================================
-- UIN Room Message Push Hotfix
--
-- 1) Remove the duplicate room-message notification trigger added by
--    20260811123000_plan_message_push_notifications.sql.
--    The product already had an activity_room_message notification path.
--
-- 2) Rewrite existing room-message notification titles at INSERT time:
--    - use the recipient-visible custom Shared Activity title when allowed
--    - otherwise fall back to the canonical Activity / Plan title
--    - never leak an only_me / hidden / under-review custom title
--
-- 3) Remove notification rows created specifically by the duplicate trigger.
-- ============================================================

drop trigger if exists
  plan_messages_create_notifications_after_insert
on public.plan_messages;

drop function if exists
  public.create_plan_message_notifications();

-- Clean only the rows created by the duplicate trigger introduced today.
-- Existing activity_room_message notifications remain untouched.
delete from public.notifications
where notification_type = 'room_message'
  and entity_type = 'plan_message'
  and source_key like 'plan-message:%';

create or replace function public.normalize_room_message_notification_title()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan_id uuid;
  v_custom_title text;
  v_custom_visibility text;
  v_moderation_status text;
  v_canonical_title text;
begin
  -- Existing product notification path uses entity_type = plan and
  -- notification types such as activity_room_message / planning_room_message.
  if new.entity_type <> 'plan'
     or new.entity_id is null
     or lower(coalesce(new.notification_type, '')) not like '%room_message%'
  then
    return new;
  end if;

  v_plan_id := new.entity_id;

  select
    nullif(btrim(private_title.title), ''),
    coalesce(nullif(btrim(private_title.visibility), ''), 'participants'),
    coalesce(nullif(btrim(private_title.moderation_status), ''), 'active'),
    coalesce(
      nullif(btrim(activity.name), ''),
      nullif(btrim(plan.title), ''),
      'UIN Activity'
    )
  into
    v_custom_title,
    v_custom_visibility,
    v_moderation_status,
    v_canonical_title
  from public.plans plan
  left join public.activities activity
    on activity.id = plan.activity_id
  left join public.plan_private_titles private_title
    on private_title.plan_id = plan.id
  where plan.id = v_plan_id;

  if v_canonical_title is null then
    return new;
  end if;

  -- A reported custom title is deliberately projected as canonical until
  -- moderation completes.
  if v_custom_title is not null
     and v_moderation_status = 'active'
     and public.can_user_view_plan_presentation(
       v_plan_id,
       v_custom_visibility,
       new.user_id
     )
  then
    new.title := left(v_custom_title, 200);
  else
    new.title := left(v_canonical_title, 200);
  end if;

  return new;
end;
$function$;

revoke all
on function public.normalize_room_message_notification_title()
from public, anon, authenticated;

drop trigger if exists
  normalize_room_message_notification_title_before_insert
on public.notifications;

create trigger
  normalize_room_message_notification_title_before_insert
before insert
on public.notifications
for each row
execute function public.normalize_room_message_notification_title();

comment on function public.normalize_room_message_notification_title()
is
  'Uses recipient-visible custom Plan/Activity titles for room-message notifications without leaking hidden or moderated titles.';

commit;
