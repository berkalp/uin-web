begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
create table if not exists public.personal_intent_collaboration_chats (
  suggestion_id uuid primary key references public.personal_intent_collaboration_suggestions(id) on delete cascade,
  seed_id uuid not null references public.seeds(id) on delete cascade,
  owner_user_id uuid not null,
  requester_user_id uuid not null,
  status text not null default 'chat' check (status in ('chat', 'planning_proposed', 'planning_ready', 'closed')),
  planning_proposed_by uuid null,
  planning_ready_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null,
  check (owner_user_id <> requester_user_id)
);
create table if not exists public.personal_intent_collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.personal_intent_collaboration_chats(suggestion_id) on delete cascade,
  sender_user_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists personal_intent_chat_messages_idx
  on public.personal_intent_collaboration_messages(suggestion_id, created_at, id);
create table if not exists public.personal_intent_collaboration_reads (
  suggestion_id uuid not null references public.personal_intent_collaboration_chats(suggestion_id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
alter table public.personal_intent_collaboration_chats enable row level security;
alter table public.personal_intent_collaboration_messages enable row level security;
alter table public.personal_intent_collaboration_reads enable row level security;
drop policy if exists personal_intent_chat_member_read_v34 on public.personal_intent_collaboration_chats;
create policy personal_intent_chat_member_read_v34 on public.personal_intent_collaboration_chats
  for select to authenticated
  using (auth.uid() in (owner_user_id, requester_user_id));
drop policy if exists personal_intent_chat_message_member_read_v34 on public.personal_intent_collaboration_messages;
create policy personal_intent_chat_message_member_read_v34 on public.personal_intent_collaboration_messages
  for select to authenticated
  using (exists (
    select 1 from public.personal_intent_collaboration_chats c
    where c.suggestion_id = personal_intent_collaboration_messages.suggestion_id
      and auth.uid() in (c.owner_user_id, c.requester_user_id)
  ));
revoke all on public.personal_intent_collaboration_chats, public.personal_intent_collaboration_messages, public.personal_intent_collaboration_reads from public, anon, authenticated;
grant select on public.personal_intent_collaboration_chats, public.personal_intent_collaboration_messages to authenticated;
insert into public.personal_intent_collaboration_chats(suggestion_id, seed_id, owner_user_id, requester_user_id)
select x.id, x.seed_id, x.owner_user_id, x.requester_user_id
from public.personal_intent_collaboration_suggestions x
where x.status = 'accepted'
on conflict (suggestion_id) do nothing;
insert into public.personal_intent_collaboration_reads(suggestion_id, user_id)
select c.suggestion_id, member.user_id
from public.personal_intent_collaboration_chats c
cross join lateral (values (c.owner_user_id), (c.requester_user_id)) member(user_id)
on conflict (suggestion_id, user_id) do nothing;
create or replace function public.respond_personal_intent_collaboration_suggestion_v34(p_suggestion_id uuid, p_response text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_seed uuid;
  v_requester uuid;
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Oturum gerekli.'; end if;
  if p_response not in ('accepted', 'rejected') then raise exception 'Geçersiz yanıt.'; end if;

  update public.personal_intent_collaboration_suggestions
  set status = p_response, responded_at = now()
  where id = p_suggestion_id and owner_user_id = v_owner and status = 'pending'
  returning seed_id, requester_user_id into v_seed, v_requester;
  if not found then raise exception 'Öneri bulunamadı.'; end if;

  if p_response = 'accepted' then
    insert into public.personal_intent_collaboration_chats(suggestion_id, seed_id, owner_user_id, requester_user_id)
    values (p_suggestion_id, v_seed, v_owner, v_requester)
    on conflict (suggestion_id) do nothing;

    insert into public.personal_intent_collaboration_reads(suggestion_id, user_id)
    values (p_suggestion_id, v_owner), (p_suggestion_id, v_requester)
    on conflict (suggestion_id, user_id) do update set last_read_at = now();
  end if;

  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values (
    v_requester,
    'personal_intent_collaboration_response',
    'personal_intent_collaboration',
    p_suggestion_id,
    case when p_response = 'accepted' then 'Önerin kabul edildi' else 'Önerin sonuçlandı' end,
    case when p_response = 'accepted' then 'Tanışma sohbetiniz açıldı. Önce konuşun, hazır olduğunuzda birlikte planlamaya geçin.' else 'Birlikte yapma önerin kabul edilmedi.' end,
    case when p_response = 'accepted' then '/collaboration-chat/' || p_suggestion_id::text else '/collaboration-suggestions' end
  );

  return jsonb_build_object('seed_id', v_seed, 'chat_id', case when p_response = 'accepted' then p_suggestion_id else null end, 'status', p_response);
end
$$;
create or replace function public.get_my_personal_intent_collaboration_chats_v34()
returns table(
  chat_id uuid, seed_id uuid, seed_title text, other_user_id uuid, other_full_name text,
  other_username text, other_avatar_url text, status text, planning_proposed_by uuid,
  viewer_message_count bigint, other_message_count bigint, unread_count bigint,
  last_message_body text, last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.suggestion_id,
    c.seed_id,
    coalesce(nullif(trim(s.title), ''), 'Kişisel Niyet')::text,
    case when c.owner_user_id = auth.uid() then c.requester_user_id else c.owner_user_id end,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'UIN üyesi')::text,
    p.username::text,
    p.avatar_url::text,
    c.status,
    c.planning_proposed_by,
    (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id = c.suggestion_id and m.sender_user_id = auth.uid()),
    (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id = c.suggestion_id and m.sender_user_id <> auth.uid()),
    (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id = c.suggestion_id and m.sender_user_id <> auth.uid() and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
    latest.body,
    latest.created_at
  from public.personal_intent_collaboration_chats c
  join public.seeds s on s.id = c.seed_id
  left join public.profiles p on p.id = case when c.owner_user_id = auth.uid() then c.requester_user_id else c.owner_user_id end
  left join public.personal_intent_collaboration_reads r on r.suggestion_id = c.suggestion_id and r.user_id = auth.uid()
  left join lateral (
    select m.body, m.created_at from public.personal_intent_collaboration_messages m
    where m.suggestion_id = c.suggestion_id order by m.created_at desc, m.id desc limit 1
  ) latest on true
  where auth.uid() in (c.owner_user_id, c.requester_user_id)
  order by coalesce(latest.created_at, c.updated_at) desc;
$$;
create or replace function public.get_personal_intent_collaboration_chat_v34(p_suggestion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_chat public.personal_intent_collaboration_chats%rowtype;
  v_result jsonb;
begin
  select * into v_chat from public.personal_intent_collaboration_chats c
  where c.suggestion_id = p_suggestion_id and v_user in (c.owner_user_id, c.requester_user_id);
  if not found then raise exception 'Tanışma sohbeti bulunamadı.'; end if;

  select jsonb_build_object(
    'chat_id', v_chat.suggestion_id,
    'seed_id', v_chat.seed_id,
    'seed_title', coalesce(nullif(trim(s.title), ''), 'Kişisel Niyet'),
    'status', v_chat.status,
    'planning_proposed_by', v_chat.planning_proposed_by,
    'viewer_id', v_user,
    'viewer_message_count', (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id = v_chat.suggestion_id and m.sender_user_id = v_user),
    'other_message_count', (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id = v_chat.suggestion_id and m.sender_user_id <> v_user),
    'other_user_id', p.id,
    'other_full_name', coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'UIN üyesi'),
    'other_username', p.username,
    'other_avatar_url', p.avatar_url,
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'sender_user_id', m.sender_user_id, 'body', m.body, 'created_at', m.created_at,
      'sender_full_name', coalesce(nullif(trim(mp.full_name), ''), nullif(trim(mp.username), ''), 'UIN üyesi'),
      'sender_username', mp.username, 'sender_avatar_url', mp.avatar_url
    ) order by m.created_at, m.id) from public.personal_intent_collaboration_messages m left join public.profiles mp on mp.id = m.sender_user_id where m.suggestion_id = v_chat.suggestion_id), '[]'::jsonb)
  ) into v_result
  from public.seeds s
  left join public.profiles p on p.id = case when v_chat.owner_user_id = v_user then v_chat.requester_user_id else v_chat.owner_user_id end
  where s.id = v_chat.seed_id;
  return v_result;
end
$$;
create or replace function public.send_personal_intent_collaboration_message_v34(p_suggestion_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_chat public.personal_intent_collaboration_chats%rowtype;
  v_id uuid;
  v_other uuid;
  v_name text;
begin
  select * into v_chat from public.personal_intent_collaboration_chats c
  where c.suggestion_id = p_suggestion_id and v_user in (c.owner_user_id, c.requester_user_id) for update;
  if not found then raise exception 'Tanışma sohbeti bulunamadı.'; end if;
  if v_chat.status not in ('chat', 'planning_proposed') then raise exception 'Bu sohbet mesaj göndermeye kapalı.'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'Mesaj boş olamaz.'; end if;
  if (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id = p_suggestion_id and m.sender_user_id = v_user) >= 20 then
    raise exception '20 mesaj hakkını kullandın. Planlamaya geçebilir veya sohbeti kapatabilirsin.';
  end if;

  insert into public.personal_intent_collaboration_messages(suggestion_id, sender_user_id, body)
  values (p_suggestion_id, v_user, left(trim(p_body), 1000)) returning id into v_id;
  update public.personal_intent_collaboration_chats set updated_at = now() where suggestion_id = p_suggestion_id;
  v_other := case when v_chat.owner_user_id = v_user then v_chat.requester_user_id else v_chat.owner_user_id end;
  select coalesce(nullif(trim(full_name), ''), nullif(trim(username), ''), 'UIN üyesi') into v_name from public.profiles where id = v_user;
  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values (v_other, 'personal_intent_collaboration_message', 'personal_intent_collaboration', p_suggestion_id, coalesce(v_name, 'UIN üyesi') || ' sana mesaj gönderdi', left(trim(p_body), 180), '/collaboration-chat/' || p_suggestion_id::text);
  return v_id;
end
$$;
create or replace function public.mark_personal_intent_collaboration_chat_read_v34(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.personal_intent_collaboration_chats c where c.suggestion_id = p_suggestion_id and auth.uid() in (c.owner_user_id, c.requester_user_id)) then raise exception 'Sohbet bulunamadı.'; end if;
  insert into public.personal_intent_collaboration_reads(suggestion_id, user_id, last_read_at) values (p_suggestion_id, auth.uid(), now())
  on conflict (suggestion_id, user_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = coalesce(read_at, now()) where user_id = auth.uid() and entity_type = 'personal_intent_collaboration' and entity_id = p_suggestion_id;
end $$;
create or replace function public.propose_personal_intent_planning_v34(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_chat public.personal_intent_collaboration_chats%rowtype; v_other uuid; v_name text;
begin
  select * into v_chat from public.personal_intent_collaboration_chats c where c.suggestion_id = p_suggestion_id and auth.uid() in (c.owner_user_id, c.requester_user_id) for update;
  if not found or v_chat.status <> 'chat' then raise exception 'Bu sohbetten şu anda planlama önerilemez.'; end if;
  update public.personal_intent_collaboration_chats set status = 'planning_proposed', planning_proposed_by = auth.uid(), updated_at = now() where suggestion_id = p_suggestion_id;
  v_other := case when v_chat.owner_user_id = auth.uid() then v_chat.requester_user_id else v_chat.owner_user_id end;
  select coalesce(nullif(trim(full_name), ''), nullif(trim(username), ''), 'UIN üyesi') into v_name from public.profiles where id = auth.uid();
  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values (v_other, 'personal_intent_collaboration_planning', 'personal_intent_collaboration', p_suggestion_id, coalesce(v_name, 'UIN üyesi') || ' planlamaya geçmeyi önerdi', 'Kabul ederseniz birlikte etkinlik bilgilerini oluşturmaya başlayabilirsiniz.', '/collaboration-chat/' || p_suggestion_id::text);
end $$;
create or replace function public.respond_personal_intent_planning_v34(p_suggestion_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_chat public.personal_intent_collaboration_chats%rowtype; v_other uuid;
begin
  select * into v_chat from public.personal_intent_collaboration_chats c where c.suggestion_id = p_suggestion_id and auth.uid() in (c.owner_user_id, c.requester_user_id) for update;
  if not found or v_chat.status <> 'planning_proposed' or v_chat.planning_proposed_by = auth.uid() then raise exception 'Yanıtlanacak planlama önerisi bulunamadı.'; end if;
  if p_accept then
    update public.personal_intent_collaboration_chats set status = 'planning_ready', planning_ready_at = now(), updated_at = now() where suggestion_id = p_suggestion_id;
  else
    update public.personal_intent_collaboration_chats set status = 'chat', planning_proposed_by = null, updated_at = now() where suggestion_id = p_suggestion_id;
  end if;
  v_other := v_chat.planning_proposed_by;
  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values (v_other, 'personal_intent_collaboration_planning_response', 'personal_intent_collaboration', p_suggestion_id, case when p_accept then 'Planlama önerin kabul edildi' else 'Henüz konuşmaya devam etmek istiyor' end, case when p_accept then 'İkiniz de hazırsınız. Planlama bilgilerini oluşturmaya başlayabilirsiniz.' else 'Tanışma sohbetinden konuşmaya devam edebilirsiniz.' end, '/collaboration-chat/' || p_suggestion_id::text);
  return v_chat.seed_id;
end $$;
create or replace function public.close_personal_intent_collaboration_chat_v34(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.personal_intent_collaboration_chats set status = 'closed', closed_at = now(), updated_at = now()
  where suggestion_id = p_suggestion_id and auth.uid() in (owner_user_id, requester_user_id) and status <> 'closed';
  if not found then raise exception 'Sohbet bulunamadı veya zaten kapalı.'; end if;
end $$;
revoke all on function public.respond_personal_intent_collaboration_suggestion_v34(uuid,text), public.get_my_personal_intent_collaboration_chats_v34(), public.get_personal_intent_collaboration_chat_v34(uuid), public.send_personal_intent_collaboration_message_v34(uuid,text), public.mark_personal_intent_collaboration_chat_read_v34(uuid), public.propose_personal_intent_planning_v34(uuid), public.respond_personal_intent_planning_v34(uuid,boolean), public.close_personal_intent_collaboration_chat_v34(uuid) from public, anon;
grant execute on function public.respond_personal_intent_collaboration_suggestion_v34(uuid,text), public.get_my_personal_intent_collaboration_chats_v34(), public.get_personal_intent_collaboration_chat_v34(uuid), public.send_personal_intent_collaboration_message_v34(uuid,text), public.mark_personal_intent_collaboration_chat_read_v34(uuid), public.propose_personal_intent_planning_v34(uuid), public.respond_personal_intent_planning_v34(uuid,boolean), public.close_personal_intent_collaboration_chat_v34(uuid) to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.personal_intent_collaboration_messages;
exception when duplicate_object then null; end $$;
commit;
