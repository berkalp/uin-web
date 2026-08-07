begin;

create table if not exists public.plan_weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  location_kind text not null,
  label text null,
  forecast_time timestamptz not null,
  weather_code integer not null,
  temperature_c numeric not null,
  apparent_temperature_c numeric null,
  precipitation_probability integer null,
  wind_speed_kmh numeric null,
  condition text null,
  fetched_at timestamptz not null default now(),
  constraint plan_weather_snapshots_location_kind_check
    check (location_kind in ('meeting', 'activity')),
  constraint plan_weather_snapshots_unique_location
    unique (plan_id, location_kind)
);

create index if not exists plan_weather_snapshots_plan_idx
  on public.plan_weather_snapshots(plan_id, location_kind);

create table if not exists public.plan_weather_alerts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  location_kind text not null,
  alert_type text not null,
  severity text not null default 'notice',
  title text not null,
  message text not null,
  suggested_need text null,
  previous_value jsonb not null default '{}'::jsonb,
  current_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint plan_weather_alerts_location_kind_check
    check (location_kind in ('meeting', 'activity')),
  constraint plan_weather_alerts_type_check
    check (alert_type in ('severe_weather', 'snow', 'rain', 'wind', 'colder', 'hotter')),
  constraint plan_weather_alerts_severity_check
    check (severity in ('notice', 'warning', 'critical'))
);

create index if not exists plan_weather_alerts_active_idx
  on public.plan_weather_alerts(plan_id, created_at desc)
  where resolved_at is null;

create table if not exists public.plan_weather_alert_dismissals (
  alert_id uuid not null references public.plan_weather_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

alter table public.plan_weather_snapshots enable row level security;
alter table public.plan_weather_alerts enable row level security;
alter table public.plan_weather_alert_dismissals enable row level security;

-- Weather state is intentionally exposed through narrow SECURITY DEFINER RPCs.
-- Direct table access remains closed under RLS.

create or replace function public.record_plan_weather_observation(
  p_plan_id uuid,
  p_location_kind text,
  p_label text,
  p_forecast_time timestamptz,
  p_weather_code integer,
  p_temperature_c numeric,
  p_apparent_temperature_c numeric default null,
  p_precipitation_probability integer default null,
  p_wind_speed_kmh numeric default null,
  p_condition text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_previous public.plan_weather_snapshots%rowtype;
  v_alert_id uuid := null;
  v_alert_type text := null;
  v_severity text := 'notice';
  v_title text := null;
  v_message text := null;
  v_suggested_need text := null;
  v_prev_precip integer;
  v_prev_wind numeric;
  v_temp_delta numeric;
  v_is_storm boolean;
  v_was_storm boolean;
  v_is_snow boolean;
  v_was_snow boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_location_kind not in ('meeting', 'activity') then
    raise exception 'Invalid weather location kind.' using errcode = '22023';
  end if;

  if not public.can_user_view_plan_base(p_plan_id, v_user_id) then
    raise exception 'You cannot access this Plan weather.' using errcode = '42501';
  end if;

  select *
  into v_previous
  from public.plan_weather_snapshots snapshot
  where snapshot.plan_id = p_plan_id
    and snapshot.location_kind = p_location_kind
  for update;

  if found
     and abs(extract(epoch from (v_previous.forecast_time - p_forecast_time))) <= 3 * 60 * 60 then
    v_prev_precip := coalesce(v_previous.precipitation_probability, 0);
    v_prev_wind := coalesce(v_previous.wind_speed_kmh, 0);
    v_temp_delta := p_temperature_c - v_previous.temperature_c;
    v_is_storm := p_weather_code in (95, 96, 99);
    v_was_storm := v_previous.weather_code in (95, 96, 99);
    v_is_snow := p_weather_code in (71, 73, 75, 77, 85, 86);
    v_was_snow := v_previous.weather_code in (71, 73, 75, 77, 85, 86);

    if v_is_storm and not v_was_storm then
      v_alert_type := 'severe_weather';
      v_severity := 'critical';
      v_title := 'Severe weather is now expected';
      v_message := coalesce(p_condition, 'Thunderstorm conditions') || ' are now forecast for the ' ||
        case when p_location_kind = 'meeting' then 'meeting point.' else 'Activity location.' end;
      v_suggested_need := 'Weather protection / backup plan';
    elsif v_is_snow and not v_was_snow then
      v_alert_type := 'snow';
      v_severity := 'warning';
      v_title := 'Snow is now expected';
      v_message := 'The latest forecast now includes snow at the ' ||
        case when p_location_kind = 'meeting' then 'meeting point.' else 'Activity location.' end;
      v_suggested_need := 'Warm layers / suitable footwear';
    elsif coalesce(p_precipitation_probability, 0) >= 60
      and (v_prev_precip < 40 or coalesce(p_precipitation_probability, 0) - v_prev_precip >= 25) then
      v_alert_type := 'rain';
      v_severity := case when coalesce(p_precipitation_probability, 0) >= 80 then 'warning' else 'notice' end;
      v_title := 'Rain is now more likely';
      v_message := 'Rain probability changed from ' || v_prev_precip || '% to ' ||
        coalesce(p_precipitation_probability, 0) || '% at the ' ||
        case when p_location_kind = 'meeting' then 'meeting point.' else 'Activity location.' end;
      v_suggested_need := 'Umbrella / rain jacket';
    elsif coalesce(p_wind_speed_kmh, 0) >= 35
      and (v_prev_wind < 25 or coalesce(p_wind_speed_kmh, 0) - v_prev_wind >= 15) then
      v_alert_type := 'wind';
      v_severity := 'warning';
      v_title := 'Strong wind is now expected';
      v_message := 'Wind is now forecast around ' || round(coalesce(p_wind_speed_kmh, 0)) || ' km/h at the ' ||
        case when p_location_kind = 'meeting' then 'meeting point.' else 'Activity location.' end;
      v_suggested_need := 'Windproof layer / secure loose items';
    elsif v_temp_delta <= -6 then
      v_alert_type := 'colder';
      v_severity := 'notice';
      v_title := 'It is forecast to be much colder';
      v_message := 'The forecast dropped by about ' || round(abs(v_temp_delta)) || '°C at the ' ||
        case when p_location_kind = 'meeting' then 'meeting point.' else 'Activity location.' end;
      v_suggested_need := 'Extra warm layer';
    elsif v_temp_delta >= 6 then
      v_alert_type := 'hotter';
      v_severity := 'notice';
      v_title := 'It is forecast to be much warmer';
      v_message := 'The forecast rose by about ' || round(abs(v_temp_delta)) || '°C at the ' ||
        case when p_location_kind = 'meeting' then 'meeting point.' else 'Activity location.' end;
      v_suggested_need := 'Water / sun protection';
    end if;
  end if;

  insert into public.plan_weather_snapshots (
    plan_id,
    location_kind,
    label,
    forecast_time,
    weather_code,
    temperature_c,
    apparent_temperature_c,
    precipitation_probability,
    wind_speed_kmh,
    condition,
    fetched_at
  ) values (
    p_plan_id,
    p_location_kind,
    nullif(btrim(coalesce(p_label, '')), ''),
    p_forecast_time,
    p_weather_code,
    p_temperature_c,
    p_apparent_temperature_c,
    p_precipitation_probability,
    p_wind_speed_kmh,
    nullif(btrim(coalesce(p_condition, '')), ''),
    now()
  )
  on conflict (plan_id, location_kind)
  do update set
    label = excluded.label,
    forecast_time = excluded.forecast_time,
    weather_code = excluded.weather_code,
    temperature_c = excluded.temperature_c,
    apparent_temperature_c = excluded.apparent_temperature_c,
    precipitation_probability = excluded.precipitation_probability,
    wind_speed_kmh = excluded.wind_speed_kmh,
    condition = excluded.condition,
    fetched_at = now();

  if v_alert_type is not null then
    -- Avoid duplicate alerts caused by several viewers requesting the same cached forecast.
    if not exists (
      select 1
      from public.plan_weather_alerts alert
      where alert.plan_id = p_plan_id
        and alert.location_kind = p_location_kind
        and alert.alert_type = v_alert_type
        and alert.resolved_at is null
        and alert.created_at >= now() - interval '6 hours'
    ) then
      insert into public.plan_weather_alerts (
        plan_id,
        location_kind,
        alert_type,
        severity,
        title,
        message,
        suggested_need,
        previous_value,
        current_value
      ) values (
        p_plan_id,
        p_location_kind,
        v_alert_type,
        v_severity,
        v_title,
        v_message,
        v_suggested_need,
        jsonb_build_object(
          'weather_code', v_previous.weather_code,
          'temperature_c', v_previous.temperature_c,
          'precipitation_probability', v_previous.precipitation_probability,
          'wind_speed_kmh', v_previous.wind_speed_kmh,
          'condition', v_previous.condition,
          'fetched_at', v_previous.fetched_at
        ),
        jsonb_build_object(
          'weather_code', p_weather_code,
          'temperature_c', p_temperature_c,
          'precipitation_probability', p_precipitation_probability,
          'wind_speed_kmh', p_wind_speed_kmh,
          'condition', p_condition,
          'fetched_at', now()
        )
      ) returning id into v_alert_id;
    end if;
  end if;

  return v_alert_id;
end;
$function$;

create or replace function public.get_plan_weather_alerts(
  p_plan_id uuid
)
returns table (
  alert_id uuid,
  plan_id uuid,
  location_kind text,
  alert_type text,
  severity text,
  title text,
  message text,
  suggested_need text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    alert.id,
    alert.plan_id,
    alert.location_kind,
    alert.alert_type,
    alert.severity,
    alert.title,
    alert.message,
    alert.suggested_need,
    alert.created_at
  from public.plan_weather_alerts alert
  where alert.plan_id = p_plan_id
    and alert.resolved_at is null
    and public.can_user_view_plan_base(alert.plan_id, auth.uid())
    and not exists (
      select 1
      from public.plan_weather_alert_dismissals dismissal
      where dismissal.alert_id = alert.id
        and dismissal.user_id = auth.uid()
    )
  order by alert.created_at desc;
$function$;

create or replace function public.dismiss_plan_weather_alert(
  p_alert_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select alert.plan_id into v_plan_id
  from public.plan_weather_alerts alert
  where alert.id = p_alert_id;

  if v_plan_id is null or not public.can_user_view_plan_base(v_plan_id, auth.uid()) then
    raise exception 'Weather alert not found.' using errcode = 'P0002';
  end if;

  insert into public.plan_weather_alert_dismissals(alert_id, user_id)
  values (p_alert_id, auth.uid())
  on conflict (alert_id, user_id)
  do update set dismissed_at = now();
end;
$function$;

create or replace function public.add_weather_suggested_plan_need(
  p_alert_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_alert public.plan_weather_alerts%rowtype;
  v_need_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_alert
  from public.plan_weather_alerts alert
  where alert.id = p_alert_id
    and alert.resolved_at is null;

  if not found or v_alert.suggested_need is null then
    raise exception 'Weather suggestion not found.' using errcode = 'P0002';
  end if;

  if not public.can_manage_plan_needs(v_alert.plan_id) then
    raise exception 'Only the Primary Host or a Co-host can add this Plan Need.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.plans plan
    where plan.id = v_alert.plan_id
      and plan.status = 'planned'
      and coalesce(plan.scheduled_end, plan.scheduled_start, now() + interval '1 second') > now()
  ) then
    raise exception 'Weather suggestions can only be added before a Planned Activity ends.' using errcode = '55000';
  end if;

  select need.id into v_need_id
  from public.plan_needs need
  where need.plan_id = v_alert.plan_id
    and lower(btrim(need.need)) = lower(btrim(v_alert.suggested_need))
  order by need.created_at asc
  limit 1;

  if v_need_id is not null then
    return v_need_id;
  end if;

  insert into public.plan_needs (
    plan_id,
    need,
    quantity,
    importance,
    fulfillment_mode,
    created_by
  ) values (
    v_alert.plan_id,
    v_alert.suggested_need,
    1,
    'optional',
    'shared',
    v_user_id
  ) returning id into v_need_id;

  return v_need_id;
end;
$function$;

revoke all on function public.record_plan_weather_observation(uuid, text, text, timestamptz, integer, numeric, numeric, integer, numeric, text) from public, anon;
revoke all on function public.get_plan_weather_alerts(uuid) from public, anon;
revoke all on function public.dismiss_plan_weather_alert(uuid) from public, anon;
revoke all on function public.add_weather_suggested_plan_need(uuid) from public, anon;

grant execute on function public.record_plan_weather_observation(uuid, text, text, timestamptz, integer, numeric, numeric, integer, numeric, text) to authenticated;
grant execute on function public.get_plan_weather_alerts(uuid) to authenticated;
grant execute on function public.dismiss_plan_weather_alert(uuid) to authenticated;
grant execute on function public.add_weather_suggested_plan_need(uuid) to authenticated;

commit;
