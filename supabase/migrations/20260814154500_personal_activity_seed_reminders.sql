begin;

-- ============================================================
-- UIN PERSONAL REMINDERS
-- Activity + Seed dates become user-configurable reminder targets.
--
-- Activity defaults:
--   15 minutes before + started + scheduled end.
-- Seed defaults:
--   1 day before + target time reached (09:00 personal time by default).
--
-- Reminder dispatch runs every minute through Supabase Cron / pg_cron.
-- Existing notifications INSERT webhook continues to deliver native push.
-- ============================================================

create extension if not exists pg_cron;

create table if not exists public.user_reminder_defaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activity_offsets integer[] not null default array[15]::integer[],
  seed_offsets integer[] not null default array[1440]::integer[],
  activity_notify_start boolean not null default true,
  activity_notify_end boolean not null default true,
  seed_notify_due boolean not null default true,
  seed_target_time time without time zone not null default time '09:00',
  timezone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_resource_reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('plan', 'seed')),
  resource_id uuid not null,
  offsets integer[] not null default '{}'::integer[],
  notify_at_start boolean not null default true,
  notify_at_end boolean not null default false,
  seed_target_time time without time zone,
  timezone text not null default 'Europe/Istanbul',
  enabled boolean not null default true,
  uses_defaults boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_resource_reminder_settings_unique
    unique (user_id, resource_type, resource_id)
);

create index if not exists user_resource_reminders_user_resource_idx
  on public.user_resource_reminder_settings (user_id, resource_type, resource_id);

alter table public.user_reminder_defaults enable row level security;
alter table public.user_resource_reminder_settings enable row level security;

drop policy if exists user_reminder_defaults_owner_select on public.user_reminder_defaults;
create policy user_reminder_defaults_owner_select
on public.user_reminder_defaults for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_resource_reminder_settings_owner_select on public.user_resource_reminder_settings;
create policy user_resource_reminder_settings_owner_select
on public.user_resource_reminder_settings for select
to authenticated
using (user_id = auth.uid());

create or replace function public.normalize_reminder_offsets(p_offsets integer[])
returns integer[]
language sql
immutable
set search_path = public
as $function$
  select coalesce(
    array_agg(distinct value order by value desc),
    '{}'::integer[]
  )
  from unnest(coalesce(p_offsets, '{}'::integer[])) value
  where value between 1 and 43200;
$function$;

create or replace function public.get_my_reminder_defaults()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_reminder_defaults%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.user_reminder_defaults (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.user_reminder_defaults
  where user_id = v_user_id;

  return jsonb_build_object(
    'activity_offsets', v_row.activity_offsets,
    'seed_offsets', v_row.seed_offsets,
    'activity_notify_start', v_row.activity_notify_start,
    'activity_notify_end', v_row.activity_notify_end,
    'seed_notify_due', v_row.seed_notify_due,
    'seed_target_time', to_char(v_row.seed_target_time, 'HH24:MI'),
    'timezone', v_row.timezone
  );
end;
$function$;

create or replace function public.save_my_reminder_defaults(
  p_activity_offsets integer[],
  p_seed_offsets integer[],
  p_activity_notify_start boolean,
  p_activity_notify_end boolean,
  p_seed_notify_due boolean,
  p_seed_target_time time without time zone,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'Europe/Istanbul');
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- Validate timezone name through PostgreSQL's timezone catalog.
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Unknown timezone: %', v_timezone using errcode = '22023';
  end if;

  insert into public.user_reminder_defaults (
    user_id,
    activity_offsets,
    seed_offsets,
    activity_notify_start,
    activity_notify_end,
    seed_notify_due,
    seed_target_time,
    timezone,
    updated_at
  ) values (
    v_user_id,
    public.normalize_reminder_offsets(p_activity_offsets),
    public.normalize_reminder_offsets(p_seed_offsets),
    coalesce(p_activity_notify_start, true),
    coalesce(p_activity_notify_end, true),
    coalesce(p_seed_notify_due, true),
    coalesce(p_seed_target_time, time '09:00'),
    v_timezone,
    now()
  )
  on conflict (user_id) do update set
    activity_offsets = excluded.activity_offsets,
    seed_offsets = excluded.seed_offsets,
    activity_notify_start = excluded.activity_notify_start,
    activity_notify_end = excluded.activity_notify_end,
    seed_notify_due = excluded.seed_notify_due,
    seed_target_time = excluded.seed_target_time,
    timezone = excluded.timezone,
    updated_at = now();

  -- Existing resources that still inherit defaults move with the new profile defaults.
  update public.user_resource_reminder_settings
  set
    offsets = public.normalize_reminder_offsets(p_activity_offsets),
    notify_at_start = coalesce(p_activity_notify_start, true),
    notify_at_end = coalesce(p_activity_notify_end, true),
    timezone = v_timezone,
    updated_at = now()
  where user_id = v_user_id
    and resource_type = 'plan'
    and uses_defaults;

  update public.user_resource_reminder_settings
  set
    offsets = public.normalize_reminder_offsets(p_seed_offsets),
    notify_at_start = coalesce(p_seed_notify_due, true),
    notify_at_end = false,
    seed_target_time = coalesce(p_seed_target_time, time '09:00'),
    timezone = v_timezone,
    updated_at = now()
  where user_id = v_user_id
    and resource_type = 'seed'
    and uses_defaults;
end;
$function$;

create or replace function public.can_manage_my_reminder_resource(
  p_user_id uuid,
  p_resource_type text,
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select case
    when p_resource_type = 'seed' then exists (
      select 1
      from public.seeds seed
      where seed.id = p_resource_id
        and seed.user_id = p_user_id
    )
    when p_resource_type = 'plan' then exists (
      select 1
      from public.plans plan
      where plan.id = p_resource_id
        and (
          plan.host_user_id = p_user_id
          or exists (
            select 1
            from public.plan_members member
            where member.plan_id = plan.id
              and member.user_id = p_user_id
              and member.status::text = 'active'
          )
        )
    )
    else false
  end;
$function$;

create or replace function public.get_my_resource_reminder_settings(
  p_resource_type text,
  p_resource_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_settings public.user_resource_reminder_settings%rowtype;
  v_defaults public.user_reminder_defaults%rowtype;
  v_exists boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_resource_type not in ('plan', 'seed') then
    raise exception 'Unsupported reminder resource.' using errcode = '22023';
  end if;

  if not public.can_manage_my_reminder_resource(v_user_id, p_resource_type, p_resource_id) then
    raise exception 'You cannot manage reminders for this item.' using errcode = '42501';
  end if;

  insert into public.user_reminder_defaults (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_defaults
  from public.user_reminder_defaults
  where user_id = v_user_id;

  select * into v_settings
  from public.user_resource_reminder_settings
  where user_id = v_user_id
    and resource_type = p_resource_type
    and resource_id = p_resource_id;

  v_exists := found;

  if not v_exists then
    return jsonb_build_object(
      'offsets', case when p_resource_type = 'plan' then v_defaults.activity_offsets else v_defaults.seed_offsets end,
      'notify_at_start', case when p_resource_type = 'plan' then v_defaults.activity_notify_start else v_defaults.seed_notify_due end,
      'notify_at_end', case when p_resource_type = 'plan' then v_defaults.activity_notify_end else false end,
      'seed_target_time', to_char(v_defaults.seed_target_time, 'HH24:MI'),
      'timezone', v_defaults.timezone,
      'inherited', true
    );
  end if;

  return jsonb_build_object(
    'offsets', v_settings.offsets,
    'notify_at_start', v_settings.notify_at_start,
    'notify_at_end', v_settings.notify_at_end,
    'seed_target_time', to_char(coalesce(v_settings.seed_target_time, v_defaults.seed_target_time), 'HH24:MI'),
    'timezone', coalesce(nullif(v_settings.timezone, ''), v_defaults.timezone),
    'inherited', v_settings.uses_defaults
  );
end;
$function$;

create or replace function public.save_my_resource_reminder_settings(
  p_resource_type text,
  p_resource_id uuid,
  p_offsets integer[],
  p_notify_at_start boolean,
  p_notify_at_end boolean,
  p_seed_target_time time without time zone,
  p_timezone text,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'Europe/Istanbul');
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_resource_type not in ('plan', 'seed') then
    raise exception 'Unsupported reminder resource.' using errcode = '22023';
  end if;

  if not public.can_manage_my_reminder_resource(v_user_id, p_resource_type, p_resource_id) then
    raise exception 'You cannot manage reminders for this item.' using errcode = '42501';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Unknown timezone: %', v_timezone using errcode = '22023';
  end if;

  insert into public.user_resource_reminder_settings (
    user_id,
    resource_type,
    resource_id,
    offsets,
    notify_at_start,
    notify_at_end,
    seed_target_time,
    timezone,
    enabled,
    uses_defaults,
    updated_at
  ) values (
    v_user_id,
    p_resource_type,
    p_resource_id,
    public.normalize_reminder_offsets(p_offsets),
    coalesce(p_notify_at_start, true),
    case when p_resource_type = 'plan' then coalesce(p_notify_at_end, true) else false end,
    case when p_resource_type = 'seed' then coalesce(p_seed_target_time, time '09:00') else null end,
    v_timezone,
    coalesce(p_enabled, true),
    false,
    now()
  )
  on conflict (user_id, resource_type, resource_id) do update set
    offsets = excluded.offsets,
    notify_at_start = excluded.notify_at_start,
    notify_at_end = excluded.notify_at_end,
    seed_target_time = excluded.seed_target_time,
    timezone = excluded.timezone,
    enabled = excluded.enabled,
    uses_defaults = false,
    updated_at = now();
end;
$function$;

-- Create a per-resource copy of defaults when a Plan receives a confirmed schedule.
create or replace function public.ensure_plan_reminder_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.scheduled_start is null or new.status::text <> 'planned' then
    return new;
  end if;

  with recipients as (
    select new.host_user_id as user_id
    union
    select member.user_id
    from public.plan_members member
    where member.plan_id = new.id
      and member.status::text = 'active'
  ), defaults as (
    select
      recipient.user_id,
      coalesce(pref.activity_offsets, array[15]::integer[]) as offsets,
      coalesce(pref.activity_notify_start, true) as notify_start,
      coalesce(pref.activity_notify_end, true) as notify_end,
      coalesce(nullif(pref.timezone, ''), new.timezone, 'Europe/Istanbul') as timezone
    from recipients recipient
    left join public.user_reminder_defaults pref
      on pref.user_id = recipient.user_id
    where recipient.user_id is not null
  )
  insert into public.user_resource_reminder_settings (
    user_id,
    resource_type,
    resource_id,
    offsets,
    notify_at_start,
    notify_at_end,
    timezone
  )
  select
    defaults.user_id,
    'plan',
    new.id,
    public.normalize_reminder_offsets(defaults.offsets),
    defaults.notify_start,
    defaults.notify_end,
    defaults.timezone
  from defaults
  on conflict (user_id, resource_type, resource_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists plan_ensure_reminder_subscriptions on public.plans;
create trigger plan_ensure_reminder_subscriptions
after insert or update of scheduled_start, status, timezone
on public.plans
for each row
execute function public.ensure_plan_reminder_subscriptions();

create or replace function public.ensure_plan_member_reminder_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan public.plans%rowtype;
  v_defaults public.user_reminder_defaults%rowtype;
begin
  if new.status::text <> 'active' then
    return new;
  end if;

  select * into v_plan from public.plans where id = new.plan_id;
  if not found or v_plan.status::text <> 'planned' or v_plan.scheduled_start is null then
    return new;
  end if;

  select * into v_defaults
  from public.user_reminder_defaults
  where user_id = new.user_id;

  insert into public.user_resource_reminder_settings (
    user_id, resource_type, resource_id, offsets,
    notify_at_start, notify_at_end, timezone
  ) values (
    new.user_id,
    'plan',
    new.plan_id,
    public.normalize_reminder_offsets(coalesce(v_defaults.activity_offsets, array[15]::integer[])),
    coalesce(v_defaults.activity_notify_start, true),
    coalesce(v_defaults.activity_notify_end, true),
    coalesce(nullif(v_defaults.timezone, ''), v_plan.timezone, 'Europe/Istanbul')
  )
  on conflict (user_id, resource_type, resource_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists plan_member_ensure_reminder_subscription on public.plan_members;
create trigger plan_member_ensure_reminder_subscription
after insert or update of status
on public.plan_members
for each row
execute function public.ensure_plan_member_reminder_subscription();

create or replace function public.ensure_seed_reminder_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_defaults public.user_reminder_defaults%rowtype;
begin
  if new.status::text <> 'active' or new.target_date is null then
    return new;
  end if;

  select * into v_defaults
  from public.user_reminder_defaults
  where user_id = new.user_id;

  insert into public.user_resource_reminder_settings (
    user_id,
    resource_type,
    resource_id,
    offsets,
    notify_at_start,
    notify_at_end,
    seed_target_time,
    timezone
  ) values (
    new.user_id,
    'seed',
    new.id,
    public.normalize_reminder_offsets(coalesce(v_defaults.seed_offsets, array[1440]::integer[])),
    coalesce(v_defaults.seed_notify_due, true),
    false,
    coalesce(v_defaults.seed_target_time, time '09:00'),
    coalesce(nullif(v_defaults.timezone, ''), 'Europe/Istanbul')
  )
  on conflict (user_id, resource_type, resource_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists seed_ensure_reminder_subscription on public.seeds;
create trigger seed_ensure_reminder_subscription
after insert or update of target_date, status
on public.seeds
for each row
execute function public.ensure_seed_reminder_subscription();

create or replace function public.format_uin_reminder_offset(p_minutes integer)
returns text
language sql
immutable
set search_path = public
as $function$
  select case
    when p_minutes % 1440 = 0 then (p_minutes / 1440)::text || ' gün'
    when p_minutes % 60 = 0 then (p_minutes / 60)::text || ' saat'
    else p_minutes::text || ' dk'
  end;
$function$;

create or replace function public.dispatch_due_personal_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_inserted integer := 0;
  v_count integer := 0;
begin
  -- ------------------------------------------------------------
  -- Offset reminders: 1 day / 3 hours / 1 hour / 30m / 15m / etc.
  -- Target is resolved live, so changing schedule/date automatically moves
  -- every future reminder without rescheduling jobs.
  -- ------------------------------------------------------------
  with resolved as (
    select
      setting.user_id,
      setting.resource_type,
      setting.resource_id,
      offset_value,
      plan.scheduled_start as target_at,
      coalesce(nullif(btrim(plan.title), ''), 'UIN Aktivitesi') as resource_title,
      '/activity-room/' || plan.id::text as action_url
    from public.user_resource_reminder_settings setting
    join public.plans plan
      on setting.resource_type = 'plan'
     and plan.id = setting.resource_id
    cross join lateral unnest(setting.offsets) as reminder_offset(offset_value)
    where setting.enabled
      and plan.status::text = 'planned'
      and plan.scheduled_start is not null

    union all

    select
      setting.user_id,
      setting.resource_type,
      setting.resource_id,
      offset_value,
      make_timestamptz(
        extract(year from seed.target_date)::integer,
        extract(month from seed.target_date)::integer,
        extract(day from seed.target_date)::integer,
        extract(hour from coalesce(setting.seed_target_time, time '09:00'))::integer,
        extract(minute from coalesce(setting.seed_target_time, time '09:00'))::integer,
        0,
        coalesce(nullif(setting.timezone, ''), 'Europe/Istanbul')
      ) as target_at,
      seed.title as resource_title,
      '/seeds/' || seed.id::text as action_url
    from public.user_resource_reminder_settings setting
    join public.seeds seed
      on setting.resource_type = 'seed'
     and seed.id = setting.resource_id
    cross join lateral unnest(setting.offsets) as reminder_offset(offset_value)
    where setting.enabled
      and seed.status::text = 'active'
      and seed.target_date is not null
  ), due as (
    select *, target_at - make_interval(mins => offset_value) as due_at
    from resolved
  )
  insert into public.notifications (
    user_id,
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
    due.user_id,
    case when due.resource_type = 'plan' then 'activity_reminder' else 'seed_reminder' end,
    due.resource_type,
    due.resource_id,
    left(
      case when due.resource_type = 'plan'
        then due.resource_title || ' · ' || public.format_uin_reminder_offset(due.offset_value) || ' kaldı'
        else 'Tohum · ' || due.resource_title || ' · ' || public.format_uin_reminder_offset(due.offset_value) || ' kaldı'
      end,
      200
    ),
    case when due.resource_type = 'plan'
      then 'Planlanan başlangıç yaklaşıyor. Aktivite Odası hazır.'
      else 'Tohumunun hedef zamanı yaklaşıyor.'
    end,
    due.action_url,
    'personal-reminder:' || due.resource_type || ':' || due.resource_id::text || ':user:' || due.user_id::text || ':offset:' || due.offset_value::text || ':target:' || extract(epoch from due.target_at)::bigint::text,
    now()
  from due
  where due.due_at <= now()
    and due.due_at > now() - interval '3 minutes'
    and not exists (
      select 1
      from public.notifications existing
      where existing.source_key =
        'personal-reminder:' || due.resource_type || ':' || due.resource_id::text || ':user:' || due.user_id::text || ':offset:' || due.offset_value::text || ':target:' || extract(epoch from due.target_at)::bigint::text
    );

  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- Activity starts now.
  insert into public.notifications (
    user_id, notification_type, entity_type, entity_id,
    title, body, action_url, source_key, created_at
  )
  select
    setting.user_id,
    'activity_started',
    'plan',
    plan.id,
    left('Aktivite başladı · ' || coalesce(nullif(btrim(plan.title), ''), 'UIN Aktivitesi'), 200),
    'Planlanan başlangıç zamanı geldi. Aktivite Odasına geçebilirsin.',
    '/activity-room/' || plan.id::text,
    'activity-started:' || plan.id::text || ':user:' || setting.user_id::text || ':target:' || extract(epoch from plan.scheduled_start)::bigint::text,
    now()
  from public.user_resource_reminder_settings setting
  join public.plans plan
    on setting.resource_type = 'plan'
   and plan.id = setting.resource_id
  where setting.enabled
    and setting.notify_at_start
    and plan.status::text = 'planned'
    and plan.scheduled_start is not null
    and plan.scheduled_start <= now()
    and plan.scheduled_start > now() - interval '3 minutes'
    and not exists (
      select 1 from public.notifications existing
      where existing.source_key =
        'activity-started:' || plan.id::text || ':user:' || setting.user_id::text || ':target:' || extract(epoch from plan.scheduled_start)::bigint::text
    );

  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- Seed target time reached.
  with seed_due as (
    select
      setting.user_id,
      seed.id,
      seed.title,
      make_timestamptz(
        extract(year from seed.target_date)::integer,
        extract(month from seed.target_date)::integer,
        extract(day from seed.target_date)::integer,
        extract(hour from coalesce(setting.seed_target_time, time '09:00'))::integer,
        extract(minute from coalesce(setting.seed_target_time, time '09:00'))::integer,
        0,
        coalesce(nullif(setting.timezone, ''), 'Europe/Istanbul')
      ) as target_at
    from public.user_resource_reminder_settings setting
    join public.seeds seed
      on setting.resource_type = 'seed'
     and seed.id = setting.resource_id
    where setting.enabled
      and setting.notify_at_start
      and seed.status::text = 'active'
      and seed.target_date is not null
  )
  insert into public.notifications (
    user_id, notification_type, entity_type, entity_id,
    title, body, action_url, source_key, created_at
  )
  select
    seed_due.user_id,
    'seed_target_due',
    'seed',
    seed_due.id,
    left('Tohum hedef zamanı · ' || seed_due.title, 200),
    'Bu Tohum için belirlediğin hedef zamanı geldi. İlerlemeni kaydet veya yeni bir adım seç.',
    '/seeds/' || seed_due.id::text,
    'seed-target-due:' || seed_due.id::text || ':user:' || seed_due.user_id::text || ':target:' || extract(epoch from seed_due.target_at)::bigint::text,
    now()
  from seed_due
  where seed_due.target_at <= now()
    and seed_due.target_at > now() - interval '3 minutes'
    and not exists (
      select 1 from public.notifications existing
      where existing.source_key =
        'seed-target-due:' || seed_due.id::text || ':user:' || seed_due.user_id::text || ':target:' || extract(epoch from seed_due.target_at)::bigint::text
    );

  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  -- Planned Activity end reached. This is NOT automatic completion.
  insert into public.notifications (
    user_id, notification_type, entity_type, entity_id,
    title, body, action_url, source_key, created_at
  )
  select
    setting.user_id,
    'activity_scheduled_end',
    'plan',
    plan.id,
    left('Planlanan süre doldu · ' || coalesce(nullif(btrim(plan.title), ''), 'UIN Aktivitesi'), 200),
    case
      when plan.host_user_id = setting.user_id
        or exists (
          select 1 from public.plan_members member
          where member.plan_id = plan.id
            and member.user_id = setting.user_id
            and member.status::text = 'active'
            and member.role::text = 'co_host'
        )
      then 'Aktivite tamamlandı mı? Aktivite Odasından sonucu ve katılımı kaydet.'
      else 'Planlanan bitiş zamanı geldi. Aktivite Odasındaki güncellemeleri kontrol edebilirsin.'
    end,
    '/activity-room/' || plan.id::text,
    'activity-scheduled-end:' || plan.id::text || ':user:' || setting.user_id::text || ':target:' || extract(epoch from plan.scheduled_end)::bigint::text,
    now()
  from public.user_resource_reminder_settings setting
  join public.plans plan
    on setting.resource_type = 'plan'
   and plan.id = setting.resource_id
  where setting.enabled
    and setting.notify_at_end
    and plan.status::text = 'planned'
    and plan.scheduled_end is not null
    and plan.scheduled_end <= now()
    and plan.scheduled_end > now() - interval '3 minutes'
    and not exists (
      select 1 from public.notifications existing
      where existing.source_key =
        'activity-scheduled-end:' || plan.id::text || ':user:' || setting.user_id::text || ':target:' || extract(epoch from plan.scheduled_end)::bigint::text
    );

  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  return v_inserted;
end;
$function$;

-- Backfill subscriptions for currently scheduled Activities.
with recipients as (
  select plan.id as plan_id, plan.host_user_id as user_id, plan.timezone
  from public.plans plan
  where plan.status::text = 'planned' and plan.scheduled_start is not null
  union
  select plan.id, member.user_id, plan.timezone
  from public.plans plan
  join public.plan_members member on member.plan_id = plan.id
  where plan.status::text = 'planned'
    and plan.scheduled_start is not null
    and member.status::text = 'active'
)
insert into public.user_resource_reminder_settings (
  user_id, resource_type, resource_id, offsets,
  notify_at_start, notify_at_end, timezone
)
select
  recipient.user_id,
  'plan',
  recipient.plan_id,
  public.normalize_reminder_offsets(coalesce(pref.activity_offsets, array[15]::integer[])),
  coalesce(pref.activity_notify_start, true),
  coalesce(pref.activity_notify_end, true),
  coalesce(nullif(pref.timezone, ''), recipient.timezone, 'Europe/Istanbul')
from recipients recipient
left join public.user_reminder_defaults pref on pref.user_id = recipient.user_id
where recipient.user_id is not null
on conflict (user_id, resource_type, resource_id) do nothing;

-- Backfill target-dated Seeds.
insert into public.user_resource_reminder_settings (
  user_id, resource_type, resource_id, offsets,
  notify_at_start, notify_at_end, seed_target_time, timezone
)
select
  seed.user_id,
  'seed',
  seed.id,
  public.normalize_reminder_offsets(coalesce(pref.seed_offsets, array[1440]::integer[])),
  coalesce(pref.seed_notify_due, true),
  false,
  coalesce(pref.seed_target_time, time '09:00'),
  coalesce(nullif(pref.timezone, ''), 'Europe/Istanbul')
from public.seeds seed
left join public.user_reminder_defaults pref on pref.user_id = seed.user_id
where seed.status::text = 'active'
  and seed.target_date is not null
on conflict (user_id, resource_type, resource_id) do nothing;

-- Replace only UIN's own reminder dispatcher job if this migration is re-run.
do $block$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'uin-personal-reminder-dispatch'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$block$;

select cron.schedule(
  'uin-personal-reminder-dispatch',
  '* * * * *',
  $$select public.dispatch_due_personal_reminders();$$
);

revoke all on function public.normalize_reminder_offsets(integer[]) from public, anon;
revoke all on function public.get_my_reminder_defaults() from public, anon;
revoke all on function public.save_my_reminder_defaults(integer[], integer[], boolean, boolean, boolean, time without time zone, text) from public, anon;
revoke all on function public.get_my_resource_reminder_settings(text, uuid) from public, anon;
revoke all on function public.save_my_resource_reminder_settings(text, uuid, integer[], boolean, boolean, time without time zone, text, boolean) from public, anon;

grant execute on function public.get_my_reminder_defaults() to authenticated;
grant execute on function public.save_my_reminder_defaults(integer[], integer[], boolean, boolean, boolean, time without time zone, text) to authenticated;
grant execute on function public.get_my_resource_reminder_settings(text, uuid) to authenticated;
grant execute on function public.save_my_resource_reminder_settings(text, uuid, integer[], boolean, boolean, time without time zone, text, boolean) to authenticated;

comment on table public.user_reminder_defaults is
  'Per-user default reminder timing for scheduled UIN Activities and target-dated Seeds.';
comment on table public.user_resource_reminder_settings is
  'Per-user overrides for one Plan/Activity or Seed. Dates are resolved live so schedule changes automatically move future reminders.';
comment on function public.dispatch_due_personal_reminders() is
  'Supabase Cron dispatcher for due personal Activity and Seed reminders. Inserts normal UIN notifications; existing notification webhooks deliver native push.';

commit;
