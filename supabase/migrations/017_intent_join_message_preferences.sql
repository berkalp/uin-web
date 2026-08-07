begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- HOST-CONTROLLED JOIN REQUEST MESSAGE
--
-- The host chooses whether a direct join request carries no answer,
-- an optional answer, or a required answer to a custom prompt.
-- The prompt used at submission time is preserved on the request.
-- ============================================================

alter table public.intents
  add column if not exists join_message_mode text;

alter table public.intents
  add column if not exists join_message_prompt text;

alter table public.intent_join_requests
  add column if not exists prompt_snapshot text;

update public.intents
set
  join_message_mode = coalesce(
    nullif(lower(btrim(join_message_mode)), ''),
    'optional'
  ),
  join_message_prompt = case
    when coalesce(
      nullif(lower(btrim(join_message_mode)), ''),
      'optional'
    ) = 'none'
      then null
    else coalesce(
      nullif(btrim(join_message_prompt), ''),
      'Why would you like to join this Intent?'
    )
  end;

alter table public.intents
  alter column join_message_mode set default 'optional';

alter table public.intents
  alter column join_message_prompt set default 'Why would you like to join this Intent?';

alter table public.intents
  alter column join_message_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intents_join_message_mode_check'
      and conrelid = 'public.intents'::regclass
  ) then
    alter table public.intents
      add constraint intents_join_message_mode_check
      check (
        join_message_mode in (
          'none',
          'optional',
          'required'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'intents_join_message_prompt_length_check'
      and conrelid = 'public.intents'::regclass
  ) then
    alter table public.intents
      add constraint intents_join_message_prompt_length_check
      check (
        join_message_prompt is null
        or char_length(join_message_prompt) <= 300
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'intents_join_message_settings_check'
      and conrelid = 'public.intents'::regclass
  ) then
    alter table public.intents
      add constraint intents_join_message_settings_check
      check (
        (
          join_message_mode = 'none'
          and join_message_prompt is null
        )
        or
        (
          join_message_mode in ('optional', 'required')
          and nullif(btrim(join_message_prompt), '') is not null
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'intent_join_requests_prompt_snapshot_length_check'
      and conrelid = 'public.intent_join_requests'::regclass
  ) then
    alter table public.intent_join_requests
      add constraint intent_join_requests_prompt_snapshot_length_check
      check (
        prompt_snapshot is null
        or char_length(prompt_snapshot) <= 300
      );
  end if;
end;
$$;

create or replace function public.normalize_intent_join_message_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.join_message_mode := lower(
    btrim(
      coalesce(
        new.join_message_mode,
        'optional'
      )
    )
  );

  if new.join_message_mode not in (
    'none',
    'optional',
    'required'
  ) then
    raise exception
      'Unsupported join request message mode.'
      using errcode = '22023';
  end if;

  if new.join_message_mode = 'none' then
    new.join_message_prompt := null;
  else
    new.join_message_prompt := nullif(
      btrim(new.join_message_prompt),
      ''
    );

    if new.join_message_prompt is null then
      raise exception
        'Enter the question participants should answer.'
        using errcode = '22023';
    end if;

    if char_length(new.join_message_prompt) > 300 then
      raise exception
        'The join request question cannot exceed 300 characters.'
        using errcode = '22001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_intent_join_message_settings_trigger
  on public.intents;

create trigger normalize_intent_join_message_settings_trigger
before insert or update of join_message_mode, join_message_prompt
on public.intents
for each row
execute function public.normalize_intent_join_message_settings();

create or replace function public.create_my_intent_with_communities_eligibility_and_join_settings(
  p_start_date date,
  p_end_date date,
  p_people text,
  p_location_id uuid,
  p_activity_id uuid,
  p_sport_id uuid,
  p_budget numeric,
  p_recurrence text,
  p_visibility text,
  p_notes text,
  p_intent_type text,
  p_max_participants integer,
  p_community_ids uuid[],
  p_participant_eligibility text,
  p_join_message_mode text default 'optional',
  p_join_message_prompt text default 'Why would you like to join this Intent?',
  p_professional_requirement text default 'none',
  p_professional_role_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent_id uuid;
begin
  v_intent_id := public.create_my_intent_with_communities_and_eligibility(
    p_start_date => p_start_date,
    p_end_date => p_end_date,
    p_people => p_people,
    p_location_id => p_location_id,
    p_activity_id => p_activity_id,
    p_sport_id => p_sport_id,
    p_budget => p_budget,
    p_recurrence => p_recurrence,
    p_visibility => p_visibility,
    p_notes => p_notes,
    p_intent_type => p_intent_type,
    p_max_participants => p_max_participants,
    p_community_ids => p_community_ids,
    p_participant_eligibility => p_participant_eligibility,
    p_professional_requirement => p_professional_requirement,
    p_professional_role_id => p_professional_role_id
  );

  update public.intents
  set
    join_message_mode = coalesce(
      nullif(lower(btrim(p_join_message_mode)), ''),
      'optional'
    ),
    join_message_prompt = case
      when coalesce(
        nullif(lower(btrim(p_join_message_mode)), ''),
        'optional'
      ) = 'none'
        then null
      else nullif(
        btrim(p_join_message_prompt),
        ''
      )
    end,
    updated_at = now()
  where id = v_intent_id
    and user_id = auth.uid();

  if not found then
    raise exception
      'The created Intent could not be updated.'
      using errcode = 'P0002';
  end if;

  return v_intent_id;
end;
$$;

revoke all
on function public.create_my_intent_with_communities_eligibility_and_join_settings(
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
)
from public;

grant execute
on function public.create_my_intent_with_communities_eligibility_and_join_settings(
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
)
to authenticated;

create or replace function public.get_intent_join_message_settings(
  p_intent_id uuid
)
returns table (
  join_message_mode text,
  join_message_prompt text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select
    intent.join_message_mode,
    intent.join_message_prompt
  from public.intents intent
  where intent.id = p_intent_id
    and (
      intent.user_id = v_user_id
      or public.can_user_view_intent_activity(
        intent.id,
        v_user_id
      )
    )
  limit 1;
end;
$$;

revoke all
on function public.get_intent_join_message_settings(uuid)
from public;

grant execute
on function public.get_intent_join_message_settings(uuid)
to authenticated;

create or replace function public.get_my_intent_join_request_prompt_snapshots()
returns table (
  request_id uuid,
  prompt_snapshot text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select
    request.id,
    request.prompt_snapshot
  from public.intent_join_requests request
  where request.requester_user_id = v_user_id
     or request.receiver_user_id = v_user_id;
end;
$$;

revoke all
on function public.get_my_intent_join_request_prompt_snapshots()
from public;

grant execute
on function public.get_my_intent_join_request_prompt_snapshots()
to authenticated;

create or replace function public.validate_intent_join_request_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_prompt text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select
    intent.join_message_mode,
    intent.join_message_prompt
  into
    v_mode,
    v_prompt
  from public.intents intent
  where intent.id = new.intent_id;

  if not found then
    raise exception
      'Intent not found.'
      using errcode = 'P0002';
  end if;

  if v_mode = 'none' then
    new.message := null;
    new.prompt_snapshot := null;
    return new;
  end if;

  new.message := nullif(
    btrim(new.message),
    ''
  );

  if char_length(coalesce(new.message, '')) > 500 then
    raise exception
      'The join request answer cannot exceed 500 characters.'
      using errcode = '22001';
  end if;

  if v_mode = 'required'
     and new.message is null then
    raise exception
      'Answer the host''s question before sending the request.'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT'
     or new.prompt_snapshot is null then
    new.prompt_snapshot := v_prompt;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_intent_join_request_message_trigger
  on public.intent_join_requests;

create trigger validate_intent_join_request_message_trigger
before insert or update
on public.intent_join_requests
for each row
execute function public.validate_intent_join_request_message();

-- Register source copy for the dynamic language system when installed.
do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null
     and to_regclass('public.app_locales') is not null then

    insert into public.translation_keys (
      key,
      namespace,
      default_text,
      description,
      source_revision,
      is_active
    )
    select
      source_row.key,
      'join-request-message',
      source_row.default_text,
      'Host-controlled join request message settings',
      1,
      true
    from (
      values
        ('source.join-message.section', 'Join request'),
        ('source.join-message.title', 'Decide what participants should answer'),
        ('source.join-message.help', 'This setting applies when someone sends an I''m in request. Direct invitations are not affected.'),
        ('source.join-message.field', 'Participant message'),
        ('source.join-message.none', 'Do not ask for a message'),
        ('source.join-message.optional', 'Ask for an optional answer'),
        ('source.join-message.required', 'Require an answer'),
        ('source.join-message.none-help', 'Participants send the request without writing anything.'),
        ('source.join-message.optional-help', 'Participants see your question but may send the request without answering.'),
        ('source.join-message.required-help', 'Participants must answer your question before sending the request.'),
        ('source.join-message.question', 'What do you want to ask?'),
        ('source.join-message.placeholder', 'For example: What interests you about this Activity?'),
        ('source.join-message.change-help', 'Changing this later affects only new requests. Answers already sent remain unchanged.'),
        ('source.join-message.host-asks', 'Host asks'),
        ('source.join-message.no-message', 'No message is requested'),
        ('source.join-message.no-message-help', 'The host only needs your participation request. You can send it without writing a message.'),
        ('source.join-message.loading', 'Loading request settings...'),
        ('source.join-message.optional-answer', 'Optional answer'),
        ('source.join-message.your-answer', 'Your answer'),
        ('source.join-message.answer-required', 'Answer the host''s question before sending the request.'),
        ('source.join-message.question-asked', 'Question asked'),
        ('source.join-message.answer', 'Answer'),
        ('source.join-message.default-prompt', 'Why would you like to join this Intent?')
    ) as source_row(key, default_text)
    on conflict (key)
    do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    insert into public.translation_values (
      translation_key_id,
      locale_code,
      value,
      source_revision,
      updated_by
    )
    select
      translation_key.id,
      'tr',
      translation_row.translated_text,
      translation_key.source_revision,
      null
    from (
      values
        ('source.join-message.section', 'Katılım isteği'),
        ('source.join-message.title', 'Katılımcıların ne yanıtlayacağına karar ver'),
        ('source.join-message.help', 'Bu ayar biri I''m in isteği gönderdiğinde uygulanır. Doğrudan davetleri etkilemez.'),
        ('source.join-message.field', 'Katılımcı mesajı'),
        ('source.join-message.none', 'Mesaj isteme'),
        ('source.join-message.optional', 'İsteğe bağlı yanıt iste'),
        ('source.join-message.required', 'Yanıtı zorunlu tut'),
        ('source.join-message.none-help', 'Katılımcılar hiçbir şey yazmadan istek gönderir.'),
        ('source.join-message.optional-help', 'Katılımcılar sorunu görür ancak yanıtlamadan da istek gönderebilir.'),
        ('source.join-message.required-help', 'Katılımcılar istek göndermeden önce sorunu yanıtlamak zorundadır.'),
        ('source.join-message.question', 'Katılımcıya ne sormak istiyorsun?'),
        ('source.join-message.placeholder', 'Örneğin: Bu Aktiviteye neden katılmak istiyorsun?'),
        ('source.join-message.change-help', 'Bunu daha sonra değiştirmek yalnız yeni istekleri etkiler. Gönderilmiş yanıtlar değişmez.'),
        ('source.join-message.host-asks', 'Host şunu soruyor'),
        ('source.join-message.no-message', 'Mesaj istenmiyor'),
        ('source.join-message.no-message-help', 'Host yalnız katılım isteğini bekliyor. Mesaj yazmadan gönderebilirsin.'),
        ('source.join-message.loading', 'İstek ayarları yükleniyor...'),
        ('source.join-message.optional-answer', 'İsteğe bağlı yanıt'),
        ('source.join-message.your-answer', 'Yanıtın'),
        ('source.join-message.answer-required', 'İsteği göndermeden önce hostun sorusunu yanıtla.'),
        ('source.join-message.question-asked', 'Sorulan soru'),
        ('source.join-message.answer', 'Yanıt'),
        ('source.join-message.default-prompt', 'Bu Intent’e neden katılmak istiyorsun?')
    ) as translation_row(key, translated_text)
    join public.translation_keys translation_key
      on translation_key.key = translation_row.key
    where exists (
      select 1
      from public.app_locales locale
      where locale.code = 'tr'
    )
    on conflict (translation_key_id, locale_code)
    do update
    set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
    where nullif(btrim(public.translation_values.value), '') is null
       or public.translation_values.source_revision < excluded.source_revision;
  end if;
end;
$$;

commit;
