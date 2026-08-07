begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

drop trigger if exists validate_intent_join_request_message_trigger
  on public.intent_join_requests;

drop function if exists public.validate_intent_join_request_message();

drop function if exists public.get_intent_join_message_settings(uuid);

drop function if exists public.get_my_intent_join_request_prompt_snapshots();

drop function if exists public.create_my_intent_with_communities_eligibility_and_join_settings(
  date,
  date,
  text,
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  text,
  integer,
  uuid[],
  text,
  text,
  text,
  text,
  uuid
);

drop trigger if exists normalize_intent_join_message_settings_trigger
  on public.intents;

drop function if exists public.normalize_intent_join_message_settings();

alter table public.intent_join_requests
  drop constraint if exists intent_join_requests_prompt_snapshot_length_check;

alter table public.intents
  drop constraint if exists intents_join_message_settings_check;

alter table public.intents
  drop constraint if exists intents_join_message_prompt_length_check;

alter table public.intents
  drop constraint if exists intents_join_message_mode_check;

alter table public.intent_join_requests
  drop column if exists prompt_snapshot;

alter table public.intents
  drop column if exists join_message_prompt;

alter table public.intents
  drop column if exists join_message_mode;

do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null then
    delete from public.translation_values
    where translation_key_id in (
      select id
      from public.translation_keys
      where namespace = 'join-request-message'
    );

    delete from public.translation_keys
    where namespace = 'join-request-message';
  end if;
end;
$$;

commit;
