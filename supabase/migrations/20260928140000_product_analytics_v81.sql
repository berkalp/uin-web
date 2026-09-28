begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

create table if not exists public.product_analytics_events_v81 (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'common_card_viewed',
    'intent_created',
    'collaboration_requested',
    'social_plan_created',
    'social_plan_completed',
    'experience_created'
  )),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid references public.canonical_targets(id) on delete set null,
  intent_id uuid references public.intents(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  resource_id uuid,
  surface text not null default 'web' check (surface in ('web')),
  properties jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  occurred_at timestamptz not null default now(),
  check (jsonb_typeof(properties) = 'object'),
  check (pg_column_size(properties) <= 4096)
);

create unique index if not exists product_analytics_events_v81_dedupe_idx
  on public.product_analytics_events_v81(actor_user_id, event_name, dedupe_key);
create index if not exists product_analytics_events_v81_time_idx
  on public.product_analytics_events_v81(occurred_at desc);
create index if not exists product_analytics_events_v81_funnel_idx
  on public.product_analytics_events_v81(event_name, occurred_at desc);
create index if not exists product_analytics_events_v81_target_idx
  on public.product_analytics_events_v81(target_id, occurred_at desc)
  where target_id is not null;

alter table public.product_analytics_events_v81 enable row level security;
revoke all on public.product_analytics_events_v81 from public, anon, authenticated;

create or replace function public.record_product_analytics_event_v81(
  p_event_name text,
  p_target_id uuid default null,
  p_intent_id uuid default null,
  p_plan_id uuid default null,
  p_resource_id uuid default null,
  p_surface text default 'web',
  p_properties jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_event text := lower(btrim(coalesce(p_event_name, '')));
  v_surface text := lower(btrim(coalesce(p_surface, 'web')));
  v_properties jsonb := '{}'::jsonb;
  v_dedupe text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Oturum gerekli.' using errcode = '42501';
  end if;

  if v_event not in (
    'common_card_viewed',
    'intent_created',
    'collaboration_requested',
    'social_plan_created',
    'social_plan_completed',
    'experience_created'
  ) then
    raise exception 'Geçersiz analytics olayı.' using errcode = '22023';
  end if;

  if v_surface <> 'web' then
    raise exception 'Geçersiz analytics yüzeyi.' using errcode = '22023';
  end if;

  if p_properties is not null and jsonb_typeof(p_properties) <> 'object' then
    raise exception 'Analytics özellikleri nesne olmalı.' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    into v_properties
  from jsonb_each(coalesce(p_properties, '{}'::jsonb)) entry
  where entry.key in ('source', 'flow', 'content_type', 'action_type');

  if pg_column_size(v_properties) > 4096 then
    raise exception 'Analytics özellikleri çok büyük.' using errcode = '22023';
  end if;

  if v_event = 'common_card_viewed' then
    if p_target_id is null or not exists (
      select 1 from public.canonical_targets target where target.id = p_target_id
    ) then
      raise exception 'Ortak kart bulunamadı.' using errcode = '23503';
    end if;
    v_dedupe := p_target_id::text || ':' || ((now() at time zone 'Europe/Istanbul')::date)::text;

  elsif v_event = 'intent_created' then
    if p_target_id is null or not (
      exists (
        select 1 from public.canonical_personal_intents_v38 personal
        where personal.target_id = p_target_id
          and personal.user_id = v_user
          and personal.status in ('active', 'completed')
      )
      or exists (
        select 1 from public.seeds seed
        where seed.canonical_target_id = p_target_id
          and seed.user_id = v_user
          and seed.status in ('active', 'completed')
      )
    ) then
      raise exception 'Kullanıcı niyeti bulunamadı.' using errcode = '42501';
    end if;
    v_dedupe := p_target_id::text;

  elsif v_event = 'collaboration_requested' then
    if p_resource_id is null or not exists (
      select 1 from public.personal_intent_collaboration_suggestions suggestion
      where suggestion.id = p_resource_id
        and suggestion.requester_user_id = v_user
    ) then
      raise exception 'Birlikte yapma önerisi bulunamadı.' using errcode = '42501';
    end if;
    v_dedupe := p_resource_id::text;

  elsif v_event = 'social_plan_created' then
    if p_intent_id is null or not exists (
      select 1 from public.intents intent
      where intent.id = p_intent_id
        and intent.user_id = v_user
        and intent.canonical_target_id is not null
    ) then
      raise exception 'Sosyal plan bulunamadı.' using errcode = '42501';
    end if;
    v_dedupe := p_intent_id::text;

  elsif v_event = 'social_plan_completed' then
    if p_plan_id is null or not (
      exists (
        select 1 from public.plan_members member
        where member.plan_id = p_plan_id and member.user_id = v_user
      )
      or exists (
        select 1
        from public.plan_intents link
        join public.intents intent on intent.id = link.intent_id
        where link.plan_id = p_plan_id and intent.user_id = v_user
      )
    ) then
      raise exception 'Tamamlanan plan bulunamadı.' using errcode = '42501';
    end if;
    v_dedupe := p_plan_id::text;

  else
    if p_resource_id is null or not exists (
      select 1 from public.seeds seed
      where seed.id = p_resource_id
        and seed.user_id = v_user
        and seed.status = 'completed'
    ) then
      raise exception 'Deneyim kaydı bulunamadı.' using errcode = '42501';
    end if;
    v_dedupe := p_resource_id::text;
  end if;

  insert into public.product_analytics_events_v81(
    event_name, actor_user_id, target_id, intent_id, plan_id,
    resource_id, surface, properties, dedupe_key
  ) values (
    v_event, v_user, p_target_id, p_intent_id, p_plan_id,
    p_resource_id, v_surface, v_properties, v_dedupe
  )
  on conflict(actor_user_id, event_name, dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    select event.id into v_id
    from public.product_analytics_events_v81 event
    where event.actor_user_id = v_user
      and event.event_name = v_event
      and event.dedupe_key = v_dedupe;
  end if;

  return v_id;
end;
$$;

create or replace function public.get_product_analytics_summary_v81(p_days integer default 30)
returns table(event_name text, event_count bigint, unique_users bigint, latest_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin yetkisi gerekir.' using errcode = '42501';
  end if;

  return query
  with allowed(name, position) as (values
    ('common_card_viewed'::text, 1),
    ('intent_created'::text, 2),
    ('collaboration_requested'::text, 3),
    ('social_plan_created'::text, 4),
    ('social_plan_completed'::text, 5),
    ('experience_created'::text, 6)
  ), totals as (
    select event.event_name as name,
      count(*)::bigint as total_count,
      count(distinct event.actor_user_id)::bigint as total_users,
      max(event.occurred_at) as last_seen_at
    from public.product_analytics_events_v81 event
    where event.occurred_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    group by event.event_name
  )
  select allowed.name,
    coalesce(totals.total_count, 0)::bigint,
    coalesce(totals.total_users, 0)::bigint,
    totals.last_seen_at
  from allowed
  left join totals on totals.name = allowed.name
  order by allowed.position;
end;
$$;

create or replace function public.get_product_analytics_daily_v81(p_days integer default 30)
returns table(event_day date, event_name text, event_count bigint, unique_users bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin yetkisi gerekir.' using errcode = '42501';
  end if;

  return query
  select (event.occurred_at at time zone 'Europe/Istanbul')::date,
    event.event_name,
    count(*)::bigint,
    count(distinct event.actor_user_id)::bigint
  from public.product_analytics_events_v81 event
  where event.occurred_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  group by 1, 2
  order by 1, 2;
end;
$$;

revoke all on function public.record_product_analytics_event_v81(text, uuid, uuid, uuid, uuid, text, jsonb),
  public.get_product_analytics_summary_v81(integer),
  public.get_product_analytics_daily_v81(integer)
from public, anon, authenticated;
grant execute on function public.record_product_analytics_event_v81(text, uuid, uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.get_product_analytics_summary_v81(integer),
  public.get_product_analytics_daily_v81(integer) to authenticated;

comment on table public.product_analytics_events_v81 is
  'Privacy-minimal product funnel events. No message, note, search, IP or device content is stored.';

notify pgrst, 'reload schema';
commit;
