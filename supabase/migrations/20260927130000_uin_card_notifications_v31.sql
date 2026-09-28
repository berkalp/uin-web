begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
create table if not exists public.uin_card_notification_preferences_v31 (
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalog_item_id uuid not null references public.seed_catalog_items(id) on delete cascade,
  is_following boolean not null default true,
  notify_new_intent boolean not null default true,
  notify_new_experience boolean not null default true,
  notify_new_event boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, catalog_item_id)
);
create index if not exists uin_card_notification_followers_v31_idx
  on public.uin_card_notification_preferences_v31(catalog_item_id, user_id)
  where is_following;
create table if not exists public.uin_card_notification_deliveries_v31 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalog_item_id uuid not null references public.seed_catalog_items(id) on delete cascade,
  event_type text not null check (event_type in ('intent', 'experience', 'event')),
  event_key text not null,
  notification_id uuid null references public.notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, catalog_item_id, event_type, event_key)
);
alter table public.uin_card_notification_preferences_v31 enable row level security;
alter table public.uin_card_notification_deliveries_v31 enable row level security;
revoke all on table public.uin_card_notification_preferences_v31 from public, anon, authenticated;
revoke all on table public.uin_card_notification_deliveries_v31 from public, anon, authenticated;
create or replace function public.get_my_uin_card_notification_preferences_v31(p_catalog_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_row public.uin_card_notification_preferences_v31%rowtype;
begin
  if v_user is null then
    raise exception 'Oturum gerekli.';
  end if;
  if not exists(select 1 from public.seed_catalog_items where id = p_catalog_item_id and status <> 'rejected') then
    raise exception 'UIN kartı bulunamadı.';
  end if;

  select * into v_row
  from public.uin_card_notification_preferences_v31
  where user_id = v_user and catalog_item_id = p_catalog_item_id;

  return jsonb_build_object(
    'is_following', coalesce(v_row.is_following, false),
    'notify_new_intent', coalesce(v_row.notify_new_intent, true),
    'notify_new_experience', coalesce(v_row.notify_new_experience, true),
    'notify_new_event', coalesce(v_row.notify_new_event, true),
    'follower_count', (
      select count(*)
      from public.uin_card_notification_preferences_v31
      where catalog_item_id = p_catalog_item_id and is_following
    )
  );
end
$$;
create or replace function public.save_my_uin_card_notification_preferences_v31(
  p_catalog_item_id uuid,
  p_is_following boolean,
  p_notify_new_intent boolean default true,
  p_notify_new_experience boolean default true,
  p_notify_new_event boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Oturum gerekli.';
  end if;
  if not exists(select 1 from public.seed_catalog_items where id = p_catalog_item_id and status <> 'rejected') then
    raise exception 'UIN kartı bulunamadı.';
  end if;

  insert into public.uin_card_notification_preferences_v31(
    user_id, catalog_item_id, is_following,
    notify_new_intent, notify_new_experience, notify_new_event
  ) values (
    v_user, p_catalog_item_id, coalesce(p_is_following, false),
    coalesce(p_notify_new_intent, true),
    coalesce(p_notify_new_experience, true),
    coalesce(p_notify_new_event, true)
  )
  on conflict (user_id, catalog_item_id) do update set
    is_following = excluded.is_following,
    notify_new_intent = excluded.notify_new_intent,
    notify_new_experience = excluded.notify_new_experience,
    notify_new_event = excluded.notify_new_event,
    updated_at = now();

  return public.get_my_uin_card_notification_preferences_v31(p_catalog_item_id);
end
$$;
create or replace function public.notify_uin_card_followers_v31(
  p_catalog_item_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_event_key text,
  p_entity_type text,
  p_entity_id uuid,
  p_action_url text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_card_title text;
  v_kind text;
  v_slug text;
  v_actor_name text;
  v_action_phrase text;
  v_event_phrase text;
  v_title text;
  v_body text;
  v_count integer := 0;
begin
  if p_catalog_item_id is null or p_actor_user_id is null
    or p_event_type not in ('intent', 'experience', 'event')
    or nullif(trim(p_event_key), '') is null then
    return 0;
  end if;

  select ci.canonical_title, lower(coalesce(ci.item_kind, '')), lower(coalesce(st.slug, ''))
    into v_card_title, v_kind, v_slug
  from public.seed_catalog_items ci
  left join public.seed_types st on st.id = ci.seed_type_id
  where ci.id = p_catalog_item_id;
  if not found then return 0; end if;

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Bir UIN üyesi')
    into v_actor_name
  from public.profiles p
  where p.id = p_actor_user_id;
  v_actor_name := coalesce(v_actor_name, 'Bir UIN üyesi');

  if v_kind like '%book%' or v_slug in ('read', 'book') then
    v_action_phrase := case when p_event_type = 'intent' then 'okumak istiyor' else 'okudu' end;
    v_event_phrase := 'yeni bir okuma etkinliği açtı';
  elsif v_kind like '%movie%' or v_kind like '%series%' or v_kind like '%tv%' or v_slug in ('watch', 'movie', 'series') then
    v_action_phrase := case when p_event_type = 'intent' then 'izlemek istiyor' else 'izledi' end;
    v_event_phrase := 'yeni bir izleme etkinliği açtı';
  elsif v_kind like '%music%' or v_kind like '%album%' or v_kind like '%podcast%' or v_slug in ('listen', 'music', 'podcast') then
    v_action_phrase := case when p_event_type = 'intent' then 'dinlemek istiyor' else 'dinledi' end;
    v_event_phrase := 'yeni bir dinleme etkinliği açtı';
  elsif v_kind like '%game%' or v_slug in ('play', 'game') then
    v_action_phrase := case when p_event_type = 'intent' then 'oynamak istiyor' else 'oynadı' end;
    v_event_phrase := 'yeni bir oyun etkinliği açtı';
  elsif v_kind like '%place%' or v_kind like '%travel%' or v_slug in ('visit', 'travel', 'place') then
    v_action_phrase := case when p_event_type = 'intent' then 'gitmek istiyor' else 'gitti' end;
    v_event_phrase := 'yeni bir gezi etkinliği açtı';
  elsif v_slug in ('learn', 'learning') then
    v_action_phrase := case when p_event_type = 'intent' then 'öğrenmek istiyor' else 'öğrendi' end;
    v_event_phrase := 'yeni bir öğrenme etkinliği açtı';
  else
    v_action_phrase := case when p_event_type = 'intent' then 'yapmak istiyor' else 'deneyimini ekledi' end;
    v_event_phrase := 'yeni bir sosyal etkinlik açtı';
  end if;

  if p_event_type = 'event' then
    v_title := v_actor_name || ' ' || v_event_phrase;
    v_body := '“' || v_card_title || '” kartındaki yeni etkinliği görüntüle.';
  else
    v_title := v_actor_name || ' ' || v_action_phrase;
    v_body := '“' || v_card_title || '” UIN kartındaki güncellemeyi görüntüle.';
  end if;

  with recipients as (
    select pref.user_id
    from public.uin_card_notification_preferences_v31 pref
    where pref.catalog_item_id = p_catalog_item_id
      and pref.is_following
      and pref.user_id <> p_actor_user_id
      and case p_event_type
        when 'intent' then pref.notify_new_intent
        when 'experience' then pref.notify_new_experience
        when 'event' then pref.notify_new_event
        else false
      end
  ), delivered as (
    insert into public.uin_card_notification_deliveries_v31(
      user_id, catalog_item_id, event_type, event_key
    )
    select r.user_id, p_catalog_item_id, p_event_type, p_event_key
    from recipients r
    on conflict (user_id, catalog_item_id, event_type, event_key) do nothing
    returning id, user_id
  ), created as (
    insert into public.notifications(
      user_id, actor_user_id, notification_type, entity_type, entity_id,
      title, body, action_url, source_key
    )
    select
      d.user_id,
      p_actor_user_id,
      'uin_card_new_' || p_event_type,
      p_entity_type,
      p_entity_id,
      v_title,
      v_body,
      p_action_url,
      'uin-card:' || p_catalog_item_id::text || ':' || p_event_type || ':' || p_event_key || ':' || d.user_id::text
    from delivered d
    returning id, user_id
  )
  update public.uin_card_notification_deliveries_v31 d
  set notification_id = c.id
  from created c
  where d.user_id = c.user_id
    and d.catalog_item_id = p_catalog_item_id
    and d.event_type = p_event_type
    and d.event_key = p_event_key;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;
create or replace function public.notify_uin_card_seed_state_v31()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_catalog_item_id uuid;
  v_target_id uuid;
  v_event_type text;
  v_view text;
begin
  if new.relationship_status = 'completed'
    and (tg_op = 'INSERT' or old.relationship_status is distinct from 'completed') then
    v_event_type := 'experience';
    v_view := 'done';
  elsif new.relationship_status in ('want', 'in_progress')
    and (tg_op = 'INSERT' or old.relationship_status is distinct from new.relationship_status) then
    v_event_type := 'intent';
    v_view := 'wanting';
  else
    return new;
  end if;

  select s.catalog_item_id, ci.canonical_target_id into v_catalog_item_id, v_target_id
  from public.seeds s
  left join public.seed_catalog_items ci on ci.id = s.catalog_item_id
  where s.id = new.seed_id;
  if v_catalog_item_id is null then return new; end if;

  perform public.notify_uin_card_followers_v31(
    v_catalog_item_id,
    new.user_id,
    v_event_type,
    'seed:' || new.seed_id::text || ':' || v_event_type,
    'seed_catalog_item',
    v_catalog_item_id,
    '/uin-card/' || v_catalog_item_id::text
      || case when v_target_id is not null then '?targetId=' || v_target_id::text || '&view=' || v_view else '?view=' || v_view end
  );
  return new;
end
$$;
drop trigger if exists notify_uin_card_seed_state_v31 on public.seed_personal_state_v15;
create trigger notify_uin_card_seed_state_v31
after insert or update of relationship_status on public.seed_personal_state_v15
for each row execute function public.notify_uin_card_seed_state_v31();
create or replace function public.notify_uin_card_event_v31()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_catalog_item_id uuid;
  v_actor_user_id uuid;
  v_status text;
  v_visibility text;
begin
  select s.catalog_item_id into v_catalog_item_id
  from public.seeds s
  where s.id = new.seed_id;
  if v_catalog_item_id is null then return new; end if;

  select i.user_id, coalesce(i.status, 'open'), coalesce(i.visibility, 'public')
    into v_actor_user_id, v_status, v_visibility
  from public.intents i
  where i.id = new.intent_id;

  if v_actor_user_id is null
    or v_status in ('completed', 'cancelled', 'canceled', 'expired', 'closed')
    or v_visibility not in ('public', 'everyone') then
    return new;
  end if;

  perform public.notify_uin_card_followers_v31(
    v_catalog_item_id,
    v_actor_user_id,
    'event',
    'intent:' || new.intent_id::text,
    'intent',
    new.intent_id,
    '/intent/' || new.intent_id::text
  );
  return new;
end
$$;
drop trigger if exists notify_uin_card_event_v31 on public.seed_intent_links;
create trigger notify_uin_card_event_v31
after insert on public.seed_intent_links
for each row execute function public.notify_uin_card_event_v31();
revoke all on function public.get_my_uin_card_notification_preferences_v31(uuid) from public, anon;
revoke all on function public.save_my_uin_card_notification_preferences_v31(uuid, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.notify_uin_card_followers_v31(uuid, uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.notify_uin_card_seed_state_v31() from public, anon, authenticated;
revoke all on function public.notify_uin_card_event_v31() from public, anon, authenticated;
grant execute on function public.get_my_uin_card_notification_preferences_v31(uuid) to authenticated;
grant execute on function public.save_my_uin_card_notification_preferences_v31(uuid, boolean, boolean, boolean, boolean) to authenticated;
commit;
