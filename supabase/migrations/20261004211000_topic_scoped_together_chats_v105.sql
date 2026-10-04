begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

alter table public.personal_intent_collaboration_chats
  drop constraint if exists personal_intent_collaboration_chats_suggestion_id_fkey;
alter table public.personal_intent_collaboration_chats
  alter column seed_id drop not null,
  add column if not exists canonical_target_id uuid references public.canonical_targets(id) on delete cascade,
  add column if not exists together_proposal_id uuid unique references public.uin_together_proposals_v71(id) on delete cascade;

update public.personal_intent_collaboration_chats chat
set canonical_target_id = seed.canonical_target_id
from public.seeds seed
where seed.id = chat.seed_id and chat.canonical_target_id is null;

create or replace function public.sync_uin_together_chat_v92()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    insert into public.personal_intent_collaboration_chats(
      suggestion_id, seed_id, canonical_target_id, together_proposal_id,
      owner_user_id, requester_user_id, status
    ) values (
      new.id, null, new.target_id, new.id,
      new.recipient_id, new.sender_id, 'chat'
    ) on conflict (suggestion_id) do update
      set canonical_target_id = excluded.canonical_target_id,
          together_proposal_id = excluded.together_proposal_id,
          updated_at = now();

    insert into public.personal_intent_collaboration_reads(suggestion_id, user_id)
    values (new.id, new.recipient_id), (new.id, new.sender_id)
    on conflict (suggestion_id, user_id) do update set last_read_at = now();

    update public.notifications
    set action_url = '/collaboration-chat/' || new.id::text
    where entity_id = new.id and notification_type = 'personal_intent_collaboration';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_uin_together_chat_v92 on public.uin_together_proposals_v71;
create trigger sync_uin_together_chat_v92
after update of status on public.uin_together_proposals_v71
for each row execute function public.sync_uin_together_chat_v92();

insert into public.personal_intent_collaboration_chats(
  suggestion_id, seed_id, canonical_target_id, together_proposal_id,
  owner_user_id, requester_user_id, status, created_at, updated_at
)
select proposal.id, null, proposal.target_id, proposal.id,
       proposal.recipient_id, proposal.sender_id, 'chat',
       proposal.created_at, coalesce(proposal.answered_at, proposal.created_at)
from public.uin_together_proposals_v71 proposal
where proposal.status = 'accepted'
on conflict (suggestion_id) do update
  set canonical_target_id = excluded.canonical_target_id,
      together_proposal_id = excluded.together_proposal_id;

insert into public.personal_intent_collaboration_reads(suggestion_id, user_id)
select chat.suggestion_id, member.user_id
from public.personal_intent_collaboration_chats chat
cross join lateral (values (chat.owner_user_id), (chat.requester_user_id)) member(user_id)
where chat.together_proposal_id is not null
on conflict (suggestion_id, user_id) do nothing;

create or replace function public.answer_uin_together_v71(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_proposal public.uin_together_proposals_v71;
begin
  select * into v_proposal
  from public.uin_together_proposals_v71
  where id = p_id and recipient_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Yanıtlanabilecek öneri bulunamadı.'; end if;
  if public.is_user_discovery_blocked_v2918(v_proposal.sender_id, auth.uid())
     or public.is_user_discovery_blocked_v2918(auth.uid(), v_proposal.sender_id)
  then raise exception 'Bu öneri yanıtlanamıyor.'; end if;

  update public.uin_together_proposals_v71
  set status = case when p_accept then 'accepted' else 'declined' end,
      answered_at = now()
  where id = p_id;

  insert into public.notifications(
    user_id, actor_user_id, notification_type, entity_type, entity_id,
    title, body, action_url, source_key
  ) values (
    v_proposal.sender_id, auth.uid(), 'personal_intent_collaboration', 'seed', p_id,
    case when p_accept then 'Birlikte yapma önerin kabul edildi' else 'Birlikte yapma önerin yanıtlandı' end,
    case when p_accept then 'Konuya özel tanışma sohbetiniz açıldı.' else 'Önerin kabul edilmedi.' end,
    case when p_accept then '/collaboration-chat/' || p_id::text else '/collaboration-suggestions' end,
    'uin-together-answer:' || p_id::text
  );
end;
$$;

create or replace function public.answer_uin_together_v92(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_status text;
begin
  perform public.answer_uin_together_v71(p_id, p_accept);
  select proposal.status into v_status
  from public.uin_together_proposals_v71 proposal
  where proposal.id = p_id and auth.uid() in (proposal.sender_id, proposal.recipient_id);
  return jsonb_build_object(
    'chat_id', case when v_status = 'accepted' then p_id else null end,
    'status', v_status
  );
end;
$$;

drop function if exists public.get_my_personal_intent_collaboration_chats_v34();
create function public.get_my_personal_intent_collaboration_chats_v34()
returns table(
  chat_id uuid, seed_id uuid, canonical_target_id uuid, seed_title text,
  other_user_id uuid, other_full_name text, other_username text, other_avatar_url text,
  status text, planning_proposed_by uuid, viewer_message_count bigint,
  other_message_count bigint, unread_count bigint, last_message_body text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    chat.suggestion_id,
    chat.seed_id,
    coalesce(chat.canonical_target_id, seed.canonical_target_id),
    coalesce(nullif(trim(target.title), ''), public.uin_seed_display_title_v90(seed.id), 'Kütüphane konusu')::text,
    case when chat.owner_user_id = auth.uid() then chat.requester_user_id else chat.owner_user_id end,
    coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.username), ''), 'UIN üyesi')::text,
    profile.username::text,
    profile.avatar_url::text,
    chat.status,
    chat.planning_proposed_by,
    (select count(*) from public.personal_intent_collaboration_messages message where message.suggestion_id = chat.suggestion_id and message.sender_user_id = auth.uid()),
    (select count(*) from public.personal_intent_collaboration_messages message where message.suggestion_id = chat.suggestion_id and message.sender_user_id <> auth.uid()),
    (select count(*) from public.personal_intent_collaboration_messages message where message.suggestion_id = chat.suggestion_id and message.sender_user_id <> auth.uid() and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)),
    latest.body,
    latest.created_at
  from public.personal_intent_collaboration_chats chat
  left join public.seeds seed on seed.id = chat.seed_id
  left join public.canonical_targets target on target.id = coalesce(chat.canonical_target_id, seed.canonical_target_id)
  left join public.profiles profile on profile.id = case when chat.owner_user_id = auth.uid() then chat.requester_user_id else chat.owner_user_id end
  left join public.personal_intent_collaboration_reads read_state on read_state.suggestion_id = chat.suggestion_id and read_state.user_id = auth.uid()
  left join lateral (
    select message.body, message.created_at
    from public.personal_intent_collaboration_messages message
    where message.suggestion_id = chat.suggestion_id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where auth.uid() in (chat.owner_user_id, chat.requester_user_id)
  order by coalesce(latest.created_at, chat.updated_at) desc;
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
  v_target uuid;
  v_title text;
  v_other uuid;
  v_result jsonb;
begin
  select * into v_chat
  from public.personal_intent_collaboration_chats chat
  where chat.suggestion_id = p_suggestion_id
    and v_user in (chat.owner_user_id, chat.requester_user_id);
  if not found then raise exception 'Tanışma sohbeti bulunamadı.'; end if;

  select coalesce(v_chat.canonical_target_id, seed.canonical_target_id),
         coalesce(nullif(trim(target.title), ''), public.uin_seed_display_title_v90(seed.id), 'Kütüphane konusu')
  into v_target, v_title
  from (select 1) singleton
  left join public.seeds seed on seed.id = v_chat.seed_id
  left join public.canonical_targets target on target.id = coalesce(v_chat.canonical_target_id, seed.canonical_target_id);

  v_other := case when v_chat.owner_user_id = v_user then v_chat.requester_user_id else v_chat.owner_user_id end;
  select jsonb_build_object(
    'chat_id', v_chat.suggestion_id,
    'seed_id', v_chat.seed_id,
    'canonical_target_id', v_target,
    'seed_title', v_title,
    'status', v_chat.status,
    'planning_proposed_by', v_chat.planning_proposed_by,
    'viewer_id', v_user,
    'viewer_message_count', (select count(*) from public.personal_intent_collaboration_messages message where message.suggestion_id = v_chat.suggestion_id and message.sender_user_id = v_user),
    'other_message_count', (select count(*) from public.personal_intent_collaboration_messages message where message.suggestion_id = v_chat.suggestion_id and message.sender_user_id <> v_user),
    'other_user_id', profile.id,
    'other_full_name', coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.username), ''), 'UIN üyesi'),
    'other_username', profile.username,
    'other_avatar_url', profile.avatar_url,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', message.id,
        'sender_user_id', message.sender_user_id,
        'body', message.body,
        'created_at', message.created_at,
        'sender_full_name', coalesce(nullif(trim(sender.full_name), ''), nullif(trim(sender.username), ''), 'UIN üyesi'),
        'sender_username', sender.username,
        'sender_avatar_url', sender.avatar_url
      ) order by message.created_at, message.id)
      from public.personal_intent_collaboration_messages message
      left join public.profiles sender on sender.id = message.sender_user_id
      where message.suggestion_id = v_chat.suggestion_id
    ), '[]'::jsonb)
  ) into v_result
  from public.profiles profile
  where profile.id = v_other;
  return v_result;
end;
$$;

revoke all on function public.answer_uin_together_v92(uuid, boolean) from public, anon;
grant execute on function public.answer_uin_together_v71(uuid, boolean),
  public.answer_uin_together_v92(uuid, boolean),
  public.get_my_personal_intent_collaboration_chats_v34(),
  public.get_personal_intent_collaboration_chat_v34(uuid)
to authenticated;

notify pgrst, 'reload schema';
commit;
