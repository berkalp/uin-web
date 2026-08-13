begin;

-- ============================================================
-- UIN: Planning Room / Activity Room message notifications
--
-- A real user text message creates one in-product notification
-- for every other authorized active member of the Plan.
--
-- notifications INSERT is already connected to the push Edge
-- Function through the uin-push-notifications database webhook.
-- ============================================================

create or replace function public.create_plan_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_sender_name text;
  v_plan_title text;
  v_room_label text;
  v_action_url text;
  v_notification_title text;
  v_notification_body text;
begin
  -- System/lifecycle messages must never produce chat push noise.
  if new.message_type::text <> 'text' then
    return new;
  end if;

  if new.sender_id is null then
    return new;
  end if;

  if nullif(btrim(coalesce(new.body, '')), '') is null then
    return new;
  end if;

  select
    coalesce(
      nullif(btrim(profile.full_name), ''),
      nullif(btrim(profile.username), ''),
      'Bir katılımcı'
    )
  into
    v_sender_name
  from public.profiles profile
  where profile.id = new.sender_id;

  v_sender_name := coalesce(v_sender_name, 'Bir katılımcı');

  select
    nullif(btrim(plan.title), '')
  into
    v_plan_title
  from public.plans plan
  where plan.id = new.plan_id;

  if new.room_phase::text = 'planning' then
    v_room_label := 'Planlama Odası';
    v_action_url := '/plan-room/' || new.plan_id::text;
  else
    v_room_label := 'Aktivite Odası';
    v_action_url := '/activity-room/' || new.plan_id::text;
  end if;

  v_notification_title :=
    left(
      case
        when v_plan_title is null then v_room_label
        else v_room_label || ' · ' || v_plan_title
      end,
      200
    );

  v_notification_body :=
    left(
      v_sender_name || ': ' || btrim(new.body),
      1000
    );

  with recipient_ids as (
    -- Primary Host remains a recipient even if an older schema does not
    -- materialize the host as a plan_members row.
    select plan.host_user_id as user_id
    from public.plans plan
    where plan.id = new.plan_id

    union

    select member.user_id
    from public.plan_members member
    where member.plan_id = new.plan_id
      and member.status::text = 'active'
  )
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
    recipient.user_id,
    new.sender_id,
    'room_message',
    'plan_message',
    new.id,
    v_notification_title,
    v_notification_body,
    v_action_url,
    'plan-message:' || new.id::text || ':user:' || recipient.user_id::text,
    coalesce(new.created_at, now())
  from recipient_ids recipient
  where recipient.user_id is not null
    and recipient.user_id <> new.sender_id
    and not exists (
      select 1
      from public.notifications existing
      where existing.source_key =
        'plan-message:' || new.id::text || ':user:' || recipient.user_id::text
    );

  return new;
end;
$function$;

revoke all
on function public.create_plan_message_notifications()
from public, anon, authenticated;

drop trigger if exists
  plan_messages_create_notifications_after_insert
on public.plan_messages;

create trigger
  plan_messages_create_notifications_after_insert
after insert
on public.plan_messages
for each row
execute function public.create_plan_message_notifications();

comment on function public.create_plan_message_notifications()
is
  'Creates recipient notifications for real Planning Room and Activity Room text messages. Excludes the sender and ignores system messages.';

commit;
