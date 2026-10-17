-- Weekly team messages are separate from the existing three-day activity digest.
create table public.uin_weekend_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.uin_weekend_preferences enable row level security;
revoke all on public.uin_weekend_preferences from public, anon, authenticated;

create table uin_private.team_support_conversations (
  conversation_id uuid primary key references public.direct_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sender_user_id, recipient_user_id),
  check (sender_user_id <> recipient_user_id)
);
create index team_support_recipient_idx on uin_private.team_support_conversations(recipient_user_id);
alter table uin_private.team_support_conversations enable row level security;
revoke all on uin_private.team_support_conversations from public, anon, authenticated;

create table uin_private.weekend_message_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  message_id uuid not null unique references public.direct_messages(id) on delete cascade deferrable initially deferred,
  delivered_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
create index weekend_delivery_conversation_idx on uin_private.weekend_message_deliveries(conversation_id);
alter table uin_private.weekend_message_deliveries enable row level security;
revoke all on uin_private.weekend_message_deliveries from public, anon, authenticated;

create function public.get_my_uin_weekend_preference() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return coalesce((select enabled from public.uin_weekend_preferences where user_id=auth.uid()),true);
end; $$;
create function public.save_my_uin_weekend_preference(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'Preference is required' using errcode='22004'; end if;
  insert into public.uin_weekend_preferences(user_id,enabled) values(auth.uid(),p_enabled)
  on conflict(user_id) do update set enabled=excluded.enabled,updated_at=now();
  return p_enabled;
end; $$;
revoke all on function public.get_my_uin_weekend_preference() from public, anon;
revoke all on function public.save_my_uin_weekend_preference(boolean) from public, anon;
grant execute on function public.get_my_uin_weekend_preference() to authenticated;
grant execute on function public.save_my_uin_weekend_preference(boolean) to authenticated;

-- Existing welcome history stays in the same conversation. Explicit revocations
-- remain authoritative; only the old time limit on team replies is removed.
insert into uin_private.team_support_conversations(conversation_id,sender_user_id,recipient_user_id)
select dc.id,s.sender_user_id,
  case when dc.user_a_id=s.sender_user_id then dc.user_b_id else dc.user_a_id end
from public.direct_conversations dc
join public.uin_welcome_settings s on s.settings_key='default'
  and s.sender_user_id in (dc.user_a_id,dc.user_b_id)
where public.user_has_staff_capability(s.sender_user_id,'staff_identity')
on conflict do nothing;
update public.direct_conversation_access a set expires_at=null,updated_at=now()
from uin_private.team_support_conversations c
where a.conversation_id=c.conversation_id and a.user_id=c.recipient_user_id
  and a.access_kind='granted' and a.revoked_at is null;

create or replace function public.direct_conversation_user_can_send(p_conversation_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_access public.direct_conversation_access%rowtype;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then return false; end if;
  select * into v_access from public.direct_conversation_access
    where conversation_id=p_conversation_id and user_id=p_user_id;
  if not found or v_access.revoked_at is not null then return false; end if;
  if v_access.access_kind='staff' then
    return public.current_staff_has_capability('staff_messaging')
      or public.current_staff_has_capability('member_messaging');
  end if;
  if exists(select 1 from uin_private.team_support_conversations c
    join public.direct_conversations dc on dc.id=c.conversation_id
    where c.conversation_id=p_conversation_id and c.recipient_user_id=p_user_id
      and c.sender_user_id in (dc.user_a_id,dc.user_b_id)
      and p_user_id in (dc.user_a_id,dc.user_b_id)) then return true; end if;
  return v_access.expires_at is not null and v_access.expires_at>now();
end; $$;

-- Human replies in either direction notify the other participant. Campaign
-- messages have their own approved notification, identified by a delivery row.
create function uin_private.notify_team_support_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_channel uin_private.team_support_conversations%rowtype; v_recipient uuid; v_name text;
begin
  select * into v_channel from uin_private.team_support_conversations where conversation_id=new.conversation_id;
  if not found or exists(select 1 from uin_private.weekend_message_deliveries where message_id=new.id) then return new; end if;
  if new.sender_id not in (v_channel.sender_user_id,v_channel.recipient_user_id) then return new; end if;
  v_recipient:=case when new.sender_id=v_channel.sender_user_id then v_channel.recipient_user_id else v_channel.sender_user_id end;
  select coalesce(nullif(btrim(full_name),''),username,'UIN') into v_name from public.profiles where id=new.sender_id;
  insert into public.notifications(user_id,actor_user_id,notification_type,entity_type,entity_id,title,body,action_url,source_key)
  values(v_recipient,new.sender_id,'uin_team_message','direct_conversation',new.conversation_id,
    left(v_name||' sana yazdı',200),left(new.body,180),'/direct-message/'||new.conversation_id,'uin-team-message:'||new.id);
  return new;
end; $$;
revoke all on function uin_private.notify_team_support_message() from public,anon,authenticated;
create trigger notify_team_support_message after insert on public.direct_messages
for each row execute function uin_private.notify_team_support_message();

create function uin_private.dispatch_uin_weekend_messages(p_at timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare
  v_local timestamp:=p_at at time zone 'Europe/Istanbul';
  v_week date:=date_trunc('week',v_local)::date;
  v_sender uuid; v_user record; v_conversation uuid; v_message uuid;
  v_name text; v_body text; v_question text; v_count integer:=0;
begin
  -- The private time parameter permits rollback-only deterministic tests.
  if extract(isodow from v_local)<>6 or v_local::time<time '12:00' or v_local::time>=time '13:00' then return 0; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('uin-weekend-messages',0)) then return 0; end if;
  select s.sender_user_id into v_sender from public.uin_welcome_settings s
    join auth.users u on u.id=s.sender_user_id
    where s.settings_key='default' and s.enabled and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now())
      and public.user_has_staff_capability(s.sender_user_id,'staff_identity');
  if v_sender is null then raise exception 'UIN team sender is not configured'; end if;
  v_question:=(array[
    'Bu hafta sana küçük bir şey sormak istedim: “Şu da olsa çok güzel olurdu” dediğin bir şey var mı?',
    'Bu hafta UIN’de sana ilham veren bir şey oldu mu? Daha iyi olmasını istediğin bir şeyi de duymak isterim.',
    'Bir sonraki deneyimini planlarken UIN sana nasıl daha çok yardımcı olabilir?',
    'UIN’de arayıp bulamadığın bir etkinlik veya yapmak istediğin bir şey var mı?'
  ])[1+mod(((v_week-date '2026-10-12')/7+400000),4)];
  for v_user in
    select p.id,p.full_name,p.username from public.profiles p join auth.users u on u.id=p.id
    left join public.uin_weekend_preferences pref on pref.user_id=p.id
    where p.id<>v_sender and nullif(btrim(p.username),'') is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
      and coalesce(pref.enabled,true)
      and not exists(select 1 from uin_private.weekend_message_deliveries d where d.user_id=p.id and d.week_start=v_week)
    order by p.id
  loop
    v_conversation:=null;
    select id into v_conversation from public.direct_conversations
      where least(user_a_id,user_b_id)=least(v_sender,v_user.id) and greatest(user_a_id,user_b_id)=greatest(v_sender,v_user.id);
    if v_conversation is not null and exists(select 1 from public.direct_conversation_access
      where conversation_id=v_conversation and revoked_at is not null) then continue; end if;
    if v_conversation is null then
      insert into public.direct_conversations(user_a_id,user_b_id,opened_by)
      values(v_sender,v_user.id,v_sender) on conflict do nothing returning id into v_conversation;
      if v_conversation is null then
        select id into v_conversation from public.direct_conversations
        where least(user_a_id,user_b_id)=least(v_sender,v_user.id) and greatest(user_a_id,user_b_id)=greatest(v_sender,v_user.id);
      end if;
    end if;
    insert into uin_private.team_support_conversations(conversation_id,sender_user_id,recipient_user_id)
    values(v_conversation,v_sender,v_user.id) on conflict do nothing;
    insert into public.direct_conversation_access(conversation_id,user_id,access_kind,granted_by,expires_at)
    values(v_conversation,v_sender,'staff',v_sender,null),(v_conversation,v_user.id,'granted',v_sender,null)
    on conflict(conversation_id,user_id) do update set expires_at=null,updated_at=now()
      where public.direct_conversation_access.revoked_at is null;
    v_name:=left(coalesce(nullif(split_part(btrim(v_user.full_name),' ',1),''),v_user.username,'dostum'),60);
    v_body:='Sevgili dostum '||v_name||E' 💚\n\nBen Berkalp. Umarım UIN’den memnunsundur. '||v_question||
      E'\n\nUIN’i inceleyip güzel bir hafta sonu için ilham alabilirsin 🌿'||
      E'\n\nKafanı karıştıran bir ekran, çalışmayan bir özellik veya geliştirmemizi istediğin bir şey varsa bana buradan yazabilirsin. Bir cümle bile yeter.'||
      E'\n\nUIN’i birlikte güzelleştirmek için fikrine ihtiyacımız var 🥺 İyi ki buradasın.\nBerkalp · UIN';
    v_message:=gen_random_uuid();
    insert into uin_private.weekend_message_deliveries(user_id,week_start,conversation_id,message_id)
      values(v_user.id,v_week,v_conversation,v_message);
    insert into public.direct_messages(id,conversation_id,sender_id,body) values(v_message,v_conversation,v_sender,v_body);
    update public.direct_conversations set last_message_at=now(),updated_at=now() where id=v_conversation;
    insert into public.notifications(user_id,actor_user_id,notification_type,entity_type,entity_id,title,body,action_url,source_key)
    values(v_user.id,v_sender,'uin_weekend_message','direct_conversation',v_conversation,
      'UIN ekibinin fikrine ihtiyacı var 🥺',
      'Sevgili dostum '||v_name||', hafta sonun için UIN’den ilham al 🌿 Geliştirmemizi istediğin bir şey varsa bana yaz. — Berkalp',
      '/direct-message/'||v_conversation,'uin-weekend:'||v_week::text);
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function uin_private.dispatch_uin_weekend_messages(timestamptz) from public,anon,authenticated;
