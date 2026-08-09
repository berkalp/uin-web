begin;

-- UIN direct-message realtime signals
-- 2026-08-09
--
-- direct_messages intentionally remains inaccessible as a normal client table.
-- The realtime layer exposes only a narrow "conversation changed" signal.
-- Clients then reload message bodies through the existing SECURITY DEFINER RPC:
-- get_direct_conversation_messages(...).

create table if not exists public.direct_message_realtime_signals (
  conversation_id uuid primary key
    references public.direct_conversations(id) on delete cascade,
  last_message_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.direct_message_realtime_signals enable row level security;

revoke all on table public.direct_message_realtime_signals from anon, authenticated;
grant select on table public.direct_message_realtime_signals to authenticated;

create or replace function public.direct_conversation_user_is_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.direct_conversations conversation
      where conversation.id = p_conversation_id
        and (
          conversation.user_a_id = p_user_id
          or conversation.user_b_id = p_user_id
        )
    );
$function$;

revoke all on function public.direct_conversation_user_is_participant(uuid, uuid)
  from public;
grant execute on function public.direct_conversation_user_is_participant(uuid, uuid)
  to authenticated;

drop policy if exists
  "Conversation participants can read realtime signals"
on public.direct_message_realtime_signals;

create policy
  "Conversation participants can read realtime signals"
on public.direct_message_realtime_signals
for select
to authenticated
using (
  public.direct_conversation_user_is_participant(
    conversation_id,
    auth.uid()
  )
);

create or replace function public.touch_direct_message_realtime_signal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.direct_message_realtime_signals (
    conversation_id,
    last_message_id,
    updated_at
  )
  values (
    new.conversation_id,
    new.id,
    new.created_at
  )
  on conflict (conversation_id)
  do update set
    last_message_id = excluded.last_message_id,
    updated_at = excluded.updated_at;

  return new;
end;
$function$;

revoke all on function public.touch_direct_message_realtime_signal()
  from public;

drop trigger if exists
  direct_messages_realtime_signal_trigger
on public.direct_messages;

create trigger
  direct_messages_realtime_signal_trigger
after insert
on public.direct_messages
for each row
execute function public.touch_direct_message_realtime_signal();

-- Backfill one signal row per existing conversation. This contains no message
-- body and does not change read/unread state.
insert into public.direct_message_realtime_signals (
  conversation_id,
  last_message_id,
  updated_at
)
select distinct on (message.conversation_id)
  message.conversation_id,
  message.id,
  message.created_at
from public.direct_messages message
order by
  message.conversation_id,
  message.created_at desc,
  message.id desc
on conflict (conversation_id)
do update set
  last_message_id = excluded.last_message_id,
  updated_at = excluded.updated_at;

-- Publish only the narrow signal table, never direct_messages itself.
do $block$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception
      'Supabase Realtime publication (supabase_realtime) was not found.';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'direct_message_realtime_signals'
  ) then
    execute
      'alter publication supabase_realtime add table public.direct_message_realtime_signals';
  end if;
end;
$block$;

comment on table public.direct_message_realtime_signals is
  'Body-free realtime signal for direct conversations. Message bodies remain behind the authorized direct-message RPCs.';

comment on function public.direct_conversation_user_is_participant(uuid, uuid) is
  'Security-definer helper used by realtime signal RLS to reveal a conversation signal only to its two participants.';

notify pgrst, 'reload schema';

commit;
