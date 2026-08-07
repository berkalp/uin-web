begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Repair the write-side RPC used by ActivityVisibilityManager.
-- The UI and read RPC already use the canonical values below, but older
-- database copies may have no function, an outdated signature or legacy
-- value names. This function normalizes them and updates the source Intent
-- and every active linked Plan in one transaction.

create or replace function public.update_activity_visibility(
  p_intent_id uuid,
  p_visibility text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_intent_owner_id uuid;
  v_visibility text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_intent_id is null then
    raise exception 'Intent id is required.'
      using errcode = '22023';
  end if;

  v_visibility := lower(
    coalesce(
      nullif(btrim(p_visibility), ''),
      ''
    )
  );

  v_visibility := case v_visibility
    when 'anyone' then 'public'
    when 'friends_only' then 'friends'
    when 'all_except_friends' then 'except_friends'
    when 'members' then 'invite_only'
    when 'only_me' then 'private'
    else v_visibility
  end;

  if v_visibility not in (
    'public',
    'friends',
    'except_friends',
    'invite_only',
    'private'
  ) then
    raise exception 'Unsupported Activity visibility: %', p_visibility
      using errcode = '22023';
  end if;

  select intent.user_id
  into v_intent_owner_id
  from public.intents intent
  where intent.id = p_intent_id
  for update;

  if not found then
    raise exception 'Intent not found.'
      using errcode = 'P0002';
  end if;

  if v_intent_owner_id <> v_user_id
     and not exists (
       select 1
       from public.plan_intents plan_intent
       join public.plan_members member
         on member.plan_id = plan_intent.plan_id
       where plan_intent.intent_id = p_intent_id
         and plan_intent.status = 'active'
         and member.user_id = v_user_id
         and member.role = 'co_host'
         and member.status = 'active'
     )
  then
    raise exception 'Only the Intent owner or an active Co-host may change Activity visibility.'
      using errcode = '42501';
  end if;

  update public.intents
  set
    visibility = v_visibility,
    updated_at = now()
  where id = p_intent_id;

  -- The existing sync_plan_from_host_intent trigger normally performs this
  -- update. Keeping it explicit makes the RPC safe on databases where that
  -- trigger is absent or was created before Shared Plans were introduced.
  update public.plans plan
  set
    visibility = v_visibility,
    updated_at = now()
  from public.plan_intents plan_intent
  where plan_intent.intent_id = p_intent_id
    and plan_intent.plan_id = plan.id
    and plan_intent.status = 'active';

  return v_visibility;
end;
$function$;

revoke all
on function public.update_activity_visibility(uuid, text)
from public;

revoke all
on function public.update_activity_visibility(uuid, text)
from anon;

grant execute
on function public.update_activity_visibility(uuid, text)
to authenticated;

commit;
