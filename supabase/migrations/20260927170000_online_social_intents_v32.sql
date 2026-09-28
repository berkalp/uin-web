-- Online and hybrid meeting support for Social Intents.

insert into public.locations (
  id,
  country_code,
  country_name,
  scope,
  source_key
)
values (
  '00000000-0000-4000-8000-000000000032'::uuid,
  'ON',
  'Online',
  'country',
  'system:online'
)
on conflict (id) do update
set
  country_code = excluded.country_code,
  country_name = excluded.country_name,
  scope = excluded.scope,
  source_key = excluded.source_key;
alter table public.intents
  add column if not exists meeting_mode text not null default 'in_person',
  add column if not exists online_provider text,
  add column if not exists online_url text;
alter table public.plans
  add column if not exists meeting_mode text not null default 'in_person',
  add column if not exists online_provider text,
  add column if not exists online_url text;
alter table public.intents drop constraint if exists intents_meeting_mode_check;
alter table public.intents add constraint intents_meeting_mode_check
  check (meeting_mode in ('in_person', 'online', 'hybrid'));
alter table public.intents drop constraint if exists intents_online_provider_check;
alter table public.intents add constraint intents_online_provider_check
  check (online_provider is null or online_provider in ('google_meet', 'zoom', 'teams', 'other'));
alter table public.plans drop constraint if exists plans_meeting_mode_check;
alter table public.plans add constraint plans_meeting_mode_check
  check (meeting_mode in ('in_person', 'online', 'hybrid'));
alter table public.plans drop constraint if exists plans_online_provider_check;
alter table public.plans add constraint plans_online_provider_check
  check (online_provider is null or online_provider in ('google_meet', 'zoom', 'teams', 'other'));
create or replace function public.save_my_intent_meeting_details_v32(
  p_intent_id uuid,
  p_meeting_mode text,
  p_online_provider text default null,
  p_online_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_mode text := coalesce(nullif(lower(btrim(p_meeting_mode)), ''), 'in_person');
  v_provider text := nullif(lower(btrim(coalesce(p_online_provider, ''))), '');
  v_url text := nullif(btrim(coalesce(p_online_url, '')), '');
  v_online_location_id constant uuid := '00000000-0000-4000-8000-000000000032'::uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_mode not in ('in_person', 'online', 'hybrid') then
    raise exception 'Unsupported meeting mode.' using errcode = '22023';
  end if;

  if v_mode in ('online', 'hybrid') then
    if v_provider not in ('google_meet', 'zoom', 'teams', 'other') then
      raise exception 'Select an online meeting provider.' using errcode = '22023';
    end if;
    if v_url is null or v_url !~* '^https://[^[:space:]]+$' then
      raise exception 'Enter a valid HTTPS meeting link.' using errcode = '22023';
    end if;
  else
    v_provider := null;
    v_url := null;
  end if;

  update public.intents
  set
    meeting_mode = v_mode,
    online_provider = v_provider,
    online_url = v_url,
    location_id = case when v_mode = 'online' then v_online_location_id else location_id end,
    updated_at = now()
  where id = p_intent_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Intent not found or access denied.' using errcode = '42501';
  end if;

  update public.plans plan
  set
    meeting_mode = v_mode,
    online_provider = v_provider,
    online_url = v_url,
    location_id = case when v_mode = 'online' then v_online_location_id else plan.location_id end,
    updated_at = now()
  from public.plan_intents link
  where link.intent_id = p_intent_id
    and link.plan_id = plan.id
    and link.relationship = 'host_source'
    and link.status = 'active'
    and plan.host_user_id = auth.uid();

  return p_intent_id;
end;
$function$;
grant execute on function public.save_my_intent_meeting_details_v32(uuid, text, text, text) to authenticated;
create or replace function public.sync_plan_meeting_details_from_intent_v32()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'active' and new.relationship = 'host_source' then
    update public.plans plan
    set
      meeting_mode = intent.meeting_mode,
      online_provider = intent.online_provider,
      online_url = intent.online_url,
      updated_at = now()
    from public.intents intent
    where intent.id = new.intent_id
      and plan.id = new.plan_id;
  end if;
  return new;
end;
$function$;
drop trigger if exists sync_plan_meeting_details_from_intent_v32 on public.plan_intents;
create trigger sync_plan_meeting_details_from_intent_v32
after insert or update of status, relationship on public.plan_intents
for each row execute function public.sync_plan_meeting_details_from_intent_v32();
