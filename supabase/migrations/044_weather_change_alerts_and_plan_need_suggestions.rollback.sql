begin;
drop function if exists public.add_weather_suggested_plan_need(uuid);
drop function if exists public.dismiss_plan_weather_alert(uuid);
drop function if exists public.get_plan_weather_alerts(uuid);
drop function if exists public.record_plan_weather_observation(uuid, text, text, timestamptz, integer, numeric, numeric, integer, numeric, text);
drop table if exists public.plan_weather_alert_dismissals;
drop table if exists public.plan_weather_alerts;
drop table if exists public.plan_weather_snapshots;
commit;
