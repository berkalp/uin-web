-- UIN Mobile push notification foundation.
-- 1) stores one or more Expo push tokens per user/device
-- 2) turns Planning/Activity Room text messages into normal UIN notifications
-- 3) lets a Supabase Database Webhook forward notifications to the push Edge Function

create table if not exists public.user_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  project_id text,
  device_name text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_push_devices_user_enabled_idx
  on public.user_push_devices (user_id, enabled);

alter table public.user_push_devices enable row level security;

drop policy if exists "Users can view their push devices" on public.user_push_devices;
create policy "Users can view their push devices"
  on public.user_push_devices
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.register_my_push_device(
  p_expo_push_token text,
  p_platform text,
  p_project_id text default null,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_expo_push_token, '')), '') is null then
    raise exception 'Expo push token is required.' using errcode = '22023';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform.' using errcode = '22023';
  end if;

  insert into public.user_push_devices (
    user_id,
    expo_push_token,
    platform,
    project_id,
    device_name,
    enabled,
    last_seen_at,
    updated_at
  )
  values (
    v_user_id,
    btrim(p_expo_push_token),
    p_platform,
    nullif(btrim(coalesce(p_project_id, '')), ''),
    nullif(btrim(coalesce(p_device_name, '')), ''),
    true,
    now(),
    now()
  )
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        project_id = excluded.project_id,
        device_name = excluded.device_name,
        enabled = true,
        last_seen_at = now(),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_my_push_device(text, text, text, text) from public;
grant execute on function public.register_my_push_device(text, text, text, text) to authenticated;

create or replace function public.disable_my_push_device(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.user_push_devices
     set enabled = false,
         updated_at = now()
   where user_id = auth.uid()
     and expo_push_token = p_expo_push_token;
end;
$$;

revoke all on function public.disable_my_push_device(text) from public;
grant execute on function public.disable_my_push_device(text) to authenticated;

create or replace function public.create_room_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_title text;
  v_sender_name text;
  v_notification_type text;
  v_notification_title text;
  v_action_url text;
  v_body text;
begin
  if coalesce(new.message_type, 'text') <> 'text' then
    return new;
  end if;

  if new.sender_id is null or nullif(btrim(coalesce(new.body, '')), '') is null then
    return new;
  end if;

  select coalesce(nullif(btrim(p.title), ''), 'UIN Aktivitesi')
    into v_plan_title
    from public.plans p
   where p.id = new.plan_id;

  select coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(pr.username), ''), 'UIN üyesi')
    into v_sender_name
    from public.profiles pr
   where pr.id = new.sender_id;

  v_plan_title := coalesce(v_plan_title, 'UIN Aktivitesi');
  v_sender_name := coalesce(v_sender_name, 'UIN üyesi');
  v_body := left(v_sender_name || ': ' || regexp_replace(btrim(new.body), E'\\s+', ' ', 'g'), 240);

  if new.room_phase = 'planning' then
    v_notification_type := 'planning_room_message';
    v_notification_title := left(v_plan_title || ' · Planlama Odası', 160);
    v_action_url := '/plan-room/' || new.plan_id::text;
  else
    v_notification_type := 'activity_room_message';
    v_notification_title := left(v_plan_title || ' · Aktivite Odası', 160);
    v_action_url := '/activity-room/' || new.plan_id::text;
  end if;

  insert into public.notifications (
    user_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body,
    action_url
  )
  select distinct
    recipients.user_id,
    v_notification_type,
    'plan',
    new.plan_id,
    v_notification_title,
    v_body,
    v_action_url
  from (
    select p.host_user_id as user_id
      from public.plans p
     where p.id = new.plan_id
    union
    select pm.user_id
      from public.plan_members pm
     where pm.plan_id = new.plan_id
       and pm.status = 'active'
  ) recipients
  where recipients.user_id is not null
    and recipients.user_id <> new.sender_id;

  return new;
end;
$$;

drop trigger if exists uin_room_message_notifications on public.plan_messages;
create trigger uin_room_message_notifications
  after insert on public.plan_messages
  for each row
  execute function public.create_room_message_notifications();

comment on table public.user_push_devices is
  'Expo push tokens registered by UIN native clients. Multiple devices per user are supported.';
comment on function public.create_room_message_notifications() is
  'Creates one UIN notification per active room member when a text message is posted to a Planning or Activity Room.';
