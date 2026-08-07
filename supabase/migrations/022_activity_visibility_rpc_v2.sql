begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Use a new RPC name so PostgREST cannot select an older overload left by a
-- previous local migration. The function changes the source Intent and every
-- active linked Shared Plan in the same transaction.
drop function if exists public.set_activity_visibility_v2(uuid, text);

create function public.set_activity_visibility_v2(
  p_target_intent_id uuid,
  p_target_visibility text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_visibility text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_target_intent_id is null then
    raise exception 'Intent id is required.'
      using errcode = '22023';
  end if;

  v_visibility := lower(
    coalesce(
      nullif(btrim(p_target_visibility), ''),
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
    raise exception 'Unsupported Activity visibility: %', p_target_visibility
      using errcode = '22023';
  end if;

  select intent.user_id
  into v_owner_user_id
  from public.intents intent
  where intent.id = p_target_intent_id
  for update;

  if not found then
    raise exception 'Intent not found.'
      using errcode = 'P0002';
  end if;

  if v_owner_user_id <> v_user_id
     and not exists (
       select 1
       from public.plan_intents plan_intent
       join public.plan_members member
         on member.plan_id = plan_intent.plan_id
       where plan_intent.intent_id = p_target_intent_id
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
  where id = p_target_intent_id;

  -- The normal Intent trigger also synchronizes the host Plan. This explicit
  -- update covers databases where the trigger is missing or predates Plans.
  update public.plans plan
  set
    visibility = v_visibility,
    updated_at = now()
  from public.plan_intents plan_intent
  where plan_intent.intent_id = p_target_intent_id
    and plan_intent.plan_id = plan.id
    and plan_intent.status = 'active';

  return jsonb_build_object(
    'intent_id', p_target_intent_id,
    'visibility', v_visibility
  );
end;
$function$;

revoke all
on function public.set_activity_visibility_v2(uuid, text)
from public;

revoke all
on function public.set_activity_visibility_v2(uuid, text)
from anon;

grant execute
on function public.set_activity_visibility_v2(uuid, text)
to authenticated;

-- Force the API layer to see the new RPC immediately instead of waiting for a
-- schema-cache refresh.
notify pgrst, 'reload schema';

commit;
