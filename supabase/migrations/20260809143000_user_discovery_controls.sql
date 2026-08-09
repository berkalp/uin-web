-- UIN user-level discovery controls
-- Date: 2026-08-09
--
-- Product semantics:
--   ignore = one-way personal discovery filter.
--            Actor stops seeing target's profile / Intent / Seed discovery.
--            Target can still discover actor.
--
--   block  = bilateral discovery boundary.
--            Either direction of block makes both users undiscoverable to each other.
--
-- Existing shared Plan / Activity membership is deliberately preserved.
-- Blocking is not a destructive Plan-membership operation.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ---------------------------------------------------------------------------
-- 1. Durable relationship-control state
-- ---------------------------------------------------------------------------

create table if not exists public.user_discovery_controls (
  actor_user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  target_user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  control_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (actor_user_id, target_user_id),

  constraint user_discovery_controls_different_users_check
    check (actor_user_id <> target_user_id),

  constraint user_discovery_controls_type_check
    check (control_type in ('ignore', 'block'))
);

create index if not exists user_discovery_controls_target_type_idx
  on public.user_discovery_controls(target_user_id, control_type, actor_user_id);

create index if not exists user_discovery_controls_actor_type_idx
  on public.user_discovery_controls(actor_user_id, control_type, updated_at desc);

create or replace function public.touch_user_discovery_control_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists touch_user_discovery_control_updated_at_trigger
  on public.user_discovery_controls;

create trigger touch_user_discovery_control_updated_at_trigger
before update on public.user_discovery_controls
for each row
execute function public.touch_user_discovery_control_updated_at();

alter table public.user_discovery_controls enable row level security;

-- Browser code does not access the relationship table directly.
-- All reads/writes go through narrow SECURITY DEFINER functions.
revoke all on table public.user_discovery_controls from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Canonical discovery / block helpers
-- ---------------------------------------------------------------------------

create or replace function public.users_are_blocked(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when p_first_user_id is null
      or p_second_user_id is null
      or p_first_user_id = p_second_user_id
      then false
    else exists (
      select 1
      from public.user_discovery_controls control
      where control.control_type = 'block'
        and (
          (
            control.actor_user_id = p_first_user_id
            and control.target_user_id = p_second_user_id
          )
          or (
            control.actor_user_id = p_second_user_id
            and control.target_user_id = p_first_user_id
          )
        )
    )
  end;
$function$;

create or replace function public.viewer_ignores_user(
  p_viewer_user_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when p_viewer_user_id is null
      or p_target_user_id is null
      or p_viewer_user_id = p_target_user_id
      then false
    else exists (
      select 1
      from public.user_discovery_controls control
      where control.actor_user_id = p_viewer_user_id
        and control.target_user_id = p_target_user_id
        and control.control_type = 'ignore'
    )
  end;
$function$;

create or replace function public.can_users_discover_each_other(
  p_viewer_user_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when p_target_user_id is null then false
    when p_viewer_user_id is null then true
    when p_viewer_user_id = p_target_user_id then true
    when public.users_are_blocked(
      p_viewer_user_id,
      p_target_user_id
    ) then false
    when public.viewer_ignores_user(
      p_viewer_user_id,
      p_target_user_id
    ) then false
    else true
  end;
$function$;

-- A block/ignore is a discovery boundary, not a retroactive eraser of a
-- Shared Activity. This helper is used only to preserve already-established
-- shared context where UIN already has a membership relationship.
create or replace function public.can_user_access_existing_shared_intent_context(
  p_intent_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when p_intent_id is null or p_user_id is null then false
    else
      exists (
        select 1
        from public.intent_participants participant
        where participant.intent_id = p_intent_id
          and participant.user_id = p_user_id
          and participant.status = 'active'
      )
      or exists (
        select 1
        from public.plan_intents plan_link
        join public.plans plan
          on plan.id = plan_link.plan_id
        where plan_link.intent_id = p_intent_id
          and plan_link.status = 'active'
          and (
            plan.host_user_id = p_user_id
            or exists (
              select 1
              from public.plan_members member
              where member.plan_id = plan.id
                and member.user_id = p_user_id
                and member.status = 'active'
            )
          )
      )
  end;
$function$;

revoke all on function public.users_are_blocked(uuid, uuid) from public;
revoke all on function public.viewer_ignores_user(uuid, uuid) from public;
revoke all on function public.can_users_discover_each_other(uuid, uuid) from public;
revoke all on function public.can_user_access_existing_shared_intent_context(uuid, uuid) from public;

-- These two are used by RLS/presentation functions and therefore must be callable.
grant execute on function public.can_users_discover_each_other(uuid, uuid)
  to anon, authenticated;
grant execute on function public.can_user_access_existing_shared_intent_context(uuid, uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. App-facing RPCs
-- ---------------------------------------------------------------------------

create or replace function public.can_current_user_discover_profile(
  p_target_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_target_user_id is null then
    return false;
  end if;

  if v_user_id = p_target_user_id then
    return true;
  end if;

  return public.can_users_discover_each_other(
    v_user_id,
    p_target_user_id
  );
end;
$function$;

create or replace function public.get_my_user_discovery_controls()
returns table (
  target_user_id uuid,
  target_full_name text,
  target_username text,
  target_avatar_url text,
  control_type text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    control.control_type,
    control.created_at,
    control.updated_at
  from public.user_discovery_controls control
  join public.profiles profile
    on profile.id = control.target_user_id
  where control.actor_user_id = v_user_id
  order by
    case control.control_type when 'block' then 0 else 1 end,
    control.updated_at desc,
    profile.username;
end;
$function$;

-- Useful for server-side fallback filtering without exposing who blocked whom.
-- Inbound rows are returned only as anonymous user ids, never with control metadata.
create or replace function public.get_my_hidden_discovery_user_ids()
returns table (
  user_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select distinct hidden.user_id
  from (
    select control.target_user_id as user_id
    from public.user_discovery_controls control
    where control.actor_user_id = v_user_id

    union all

    select control.actor_user_id
    from public.user_discovery_controls control
    where control.target_user_id = v_user_id
      and control.control_type = 'block'
  ) hidden
  where hidden.user_id <> v_user_id;
end;
$function$;

create or replace function public.set_my_user_discovery_control(
  p_target_user_id uuid,
  p_control_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_control_type text :=
    lower(btrim(coalesce(p_control_type, '')));
  v_pair_key text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  if p_target_user_id is null
     or not exists (
       select 1
       from public.profiles profile
       where profile.id = p_target_user_id
     )
  then
    raise exception 'User not found.'
      using errcode = 'P0002';
  end if;

  if p_target_user_id = v_user_id then
    raise exception 'You cannot hide or block yourself.'
      using errcode = '22023';
  end if;

  if v_control_type not in ('ignore', 'block', 'none') then
    raise exception 'Unsupported discovery control.'
      using errcode = '22023';
  end if;

  -- Serialize both A->B and B->A changes for the same pair.
  v_pair_key :=
    least(v_user_id::text, p_target_user_id::text)
    || ':'
    || greatest(v_user_id::text, p_target_user_id::text);

  perform pg_advisory_xact_lock(
    hashtextextended('uin:user-discovery:' || v_pair_key, 0)
  );

  if v_control_type = 'none' then
    delete from public.user_discovery_controls control
    where control.actor_user_id = v_user_id
      and control.target_user_id = p_target_user_id;

    return 'none';
  end if;

  insert into public.user_discovery_controls (
    actor_user_id,
    target_user_id,
    control_type
  )
  values (
    v_user_id,
    p_target_user_id,
    v_control_type
  )
  on conflict (actor_user_id, target_user_id)
  do update
  set
    control_type = excluded.control_type,
    updated_at = now();

  if v_control_type = 'block' then
    -- A block intentionally cuts future social/discovery ties.
    -- Existing Shared Plan / Activity membership is NOT changed.

    delete from public.profile_follows follow_record
    where (
      follow_record.follower_user_id = v_user_id
      and follow_record.followed_user_id = p_target_user_id
    )
    or (
      follow_record.follower_user_id = p_target_user_id
      and follow_record.followed_user_id = v_user_id
    );

    update public.friendships friendship
    set
      status = 'removed',
      removed_at = now(),
      updated_at = now()
    where friendship.status in ('pending', 'accepted')
      and (
        (
          friendship.requester_user_id = v_user_id
          and friendship.addressee_user_id = p_target_user_id
        )
        or (
          friendship.requester_user_id = p_target_user_id
          and friendship.addressee_user_id = v_user_id
        )
      );

    update public.intent_join_requests request
    set
      status = case
        when request.requester_user_id = v_user_id
          then 'withdrawn'
        else 'declined'
      end,
      response_reason =
        'Closed because a user-level block was applied.',
      responded_at = now(),
      updated_at = now()
    where request.status = 'pending'
      and (
        (
          request.requester_user_id = v_user_id
          and request.receiver_user_id = p_target_user_id
        )
        or (
          request.requester_user_id = p_target_user_id
          and request.receiver_user_id = v_user_id
        )
      );

    if to_regclass('public.intent_requests') is not null then
      execute $cleanup$
        update public.intent_requests request
        set
          status = 'rejected',
          updated_at = now()
        where request.status = 'pending'
          and (
            (
              request.requester_id = $1
              and request.receiver_id = $2
            )
            or (
              request.requester_id = $2
              and request.receiver_id = $1
            )
          )
      $cleanup$
      using v_user_id, p_target_user_id;
    end if;

    update public.intent_invitations invitation
    set
      status = 'revoked',
      revoked_at = now(),
      revoked_by = v_user_id,
      updated_at = now()
    where invitation.status = 'pending'
      and (
        (
          invitation.invited_by = v_user_id
          and invitation.invited_user_id = p_target_user_id
        )
        or (
          invitation.invited_by = p_target_user_id
          and invitation.invited_user_id = v_user_id
        )
      );
  end if;

  return v_control_type;
end;
$function$;

revoke all on function public.can_current_user_discover_profile(uuid) from public;
revoke all on function public.get_my_user_discovery_controls() from public;
revoke all on function public.get_my_hidden_discovery_user_ids() from public;
revoke all on function public.set_my_user_discovery_control(uuid, text) from public;

grant execute on function public.can_current_user_discover_profile(uuid)
  to authenticated;
grant execute on function public.get_my_user_discovery_controls()
  to authenticated;
grant execute on function public.get_my_hidden_discovery_user_ids()
  to authenticated;
grant execute on function public.set_my_user_discovery_control(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Intent visibility and request eligibility
-- ---------------------------------------------------------------------------

create or replace function public.can_user_view_intent_activity(
  p_intent_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_owner_user_id uuid;
  v_visibility text;
  v_archived_at timestamptz;
begin
  select
    intent.user_id,
    intent.visibility,
    intent.archived_at
  into
    v_owner_user_id,
    v_visibility,
    v_archived_at
  from public.intents intent
  where intent.id = p_intent_id
  limit 1;

  if v_owner_user_id is null or v_archived_at is not null then
    return false;
  end if;

  if p_viewer_user_id = v_owner_user_id then
    return true;
  end if;

  -- Do not retroactively destroy an already-established Shared Activity.
  -- This exception is intentionally NOT used by Discover ranking/listing.
  if p_viewer_user_id is not null
     and not public.can_users_discover_each_other(
       p_viewer_user_id,
       v_owner_user_id
     )
  then
    return public.can_user_access_existing_shared_intent_context(
      p_intent_id,
      p_viewer_user_id
    );
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'friends' then
    return p_viewer_user_id is not null
      and public.are_users_friends(
        v_owner_user_id,
        p_viewer_user_id
      );
  end if;

  if v_visibility = 'except_friends' then
    return p_viewer_user_id is null
      or not public.are_users_friends(
        v_owner_user_id,
        p_viewer_user_id
      );
  end if;

  if v_visibility = 'invite_only' then
    return p_viewer_user_id is not null
      and public.is_user_invited_to_intent(
        p_intent_id,
        p_viewer_user_id
      );
  end if;

  return false;
end;
$function$;

-- Keep the current gender + verified-professional eligibility contract,
-- adding only the canonical person-level discovery gate.
create or replace function public.can_user_request_join_intent(
  p_intent_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_owner_user_id uuid;
  v_visibility text;
  v_status text;
  v_recruitment_status text;
  v_end_date date;
  v_expired_at timestamptz;
  v_archived_at timestamptz;
begin
  if p_viewer_user_id is null then
    return false;
  end if;

  select
    intent.user_id,
    intent.visibility,
    intent.status,
    intent.recruitment_status,
    intent.end_date,
    intent.expired_at,
    intent.archived_at
  into
    v_owner_user_id,
    v_visibility,
    v_status,
    v_recruitment_status,
    v_end_date,
    v_expired_at,
    v_archived_at
  from public.intents intent
  where intent.id = p_intent_id
  limit 1;

  if
    v_owner_user_id is null
    or p_viewer_user_id = v_owner_user_id
    or v_status <> 'active'
    or v_recruitment_status <> 'open'
    or v_end_date < current_date
    or v_expired_at is not null
    or v_archived_at is not null
  then
    return false;
  end if;

  if not public.can_users_discover_each_other(
    p_viewer_user_id,
    v_owner_user_id
  ) then
    return false;
  end if;

  if not public.user_is_eligible_for_intent(
    p_intent_id,
    p_viewer_user_id
  ) then
    return false;
  end if;

  if not public.user_satisfies_intent_professional_requirement(
    p_intent_id,
    p_viewer_user_id
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.intent_participants participant
    where participant.intent_id = p_intent_id
      and participant.user_id = p_viewer_user_id
      and participant.status = 'active'
  ) then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'friends' then
    return public.are_users_friends(
      v_owner_user_id,
      p_viewer_user_id
    );
  end if;

  if v_visibility = 'except_friends' then
    return not public.are_users_friends(
      v_owner_user_id,
      p_viewer_user_id
    );
  end if;

  return false;
end;
$function$;

-- Harden the generic public-active Intent policy as well.
drop policy if exists "Users can view public active intents"
  on public.intents;

create policy "Users can view public active intents"
on public.intents
for select
to public
using (
  visibility = 'public'
  and status = 'active'
  and archived_at is null
  and (
    auth.uid() is null
    or user_id = auth.uid()
    or public.can_users_discover_each_other(
      auth.uid(),
      user_id
    )
    or public.can_user_access_existing_shared_intent_context(
      id,
      auth.uid()
    )
  )
);


-- ---------------------------------------------------------------------------
-- 5. Public-profile entry point
--
-- The web route also checks this, but the canonical profile RPC should not
-- return a profile payload to an authenticated viewer who has an Ignore/Block
-- discovery boundary with that person.
-- ---------------------------------------------------------------------------

do $profile_rpc_patch$
declare
  v_proc record;
  v_definition text;
  v_patched_definition text;
begin
  for v_proc in
    select procedure_record.oid
    from pg_proc procedure_record
    join pg_namespace namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    where namespace_record.nspname = 'public'
      and procedure_record.proname = 'get_public_profile_page_visibility'
  loop
    v_definition := pg_get_functiondef(v_proc.oid);

    if position(
      'can_users_discover_each_other(v_viewer_user_id, v_profile_user_id)'
      in v_definition
    ) > 0 then
      continue;
    end if;

    v_patched_definition := regexp_replace(
      v_definition,
      'if[[:space:]]+v_profile_user_id[[:space:]]+is[[:space:]]+null[[:space:]]+then[[:space:]]+return[[:space:]]+null;[[:space:]]+end[[:space:]]+if;',
      $replacement$if v_profile_user_id is null then
    return null;
  end if;

  if v_viewer_user_id is not null
     and v_viewer_user_id <> v_profile_user_id
     and not public.can_users_discover_each_other(
       v_viewer_user_id,
       v_profile_user_id
     )
  then
    return null;
  end if;$replacement$
    );

    if v_patched_definition = v_definition then
      raise warning
        'UIN discovery control patch could not locate the profile visibility gate.';
    else
      execute v_patched_definition;
    end if;
  end loop;
end;
$profile_rpc_patch$;

-- ---------------------------------------------------------------------------
-- 6. Seed visibility
-- ---------------------------------------------------------------------------

create or replace function public.seed_is_visible_to_viewer(
  p_owner_user_id uuid,
  p_visibility text,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when p_owner_user_id is null then false
    when p_viewer_user_id = p_owner_user_id then true
    when p_viewer_user_id is not null
      and not public.can_users_discover_each_other(
        p_viewer_user_id,
        p_owner_user_id
      )
      then false
    when p_visibility = 'everyone' then true
    when p_visibility = 'friends'
      and p_viewer_user_id is not null
      then public.users_are_accepted_friends(
        p_owner_user_id,
        p_viewer_user_id
      )
    else false
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Discover functions: hard-filter BEFORE lifecycle/count/pagination
--
-- Current UIN discovery intentionally lets existing Plan members see their
-- shared Plans. That is correct for Activity access but wrong for Discover
-- after Ignore/Block. Patch only the Discover CTE boundary.
-- ---------------------------------------------------------------------------

do $discover_patch$
declare
  v_proc record;
  v_definition text;
  v_patched_definition text;
  v_patched_count integer := 0;
  v_already_count integer := 0;
begin
  for v_proc in
    select
      procedure_record.oid,
      procedure_record.proname,
      pg_get_function_identity_arguments(procedure_record.oid) as arguments
    from pg_proc procedure_record
    join pg_namespace namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    where namespace_record.nspname = 'public'
      and procedure_record.proname in (
        'search_visible_intents',
        'search_visible_intents_by_community',
        'search_visible_intents_followed_communities'
      )
  loop
    v_definition := pg_get_functiondef(v_proc.oid);

    if position(
      'can_users_discover_each_other(v_user_id, owner_user_id)'
      in v_definition
    ) > 0 then
      v_already_count := v_already_count + 1;
      continue;
    end if;

    v_patched_definition := regexp_replace(
      v_definition,
      'base_resources[[:space:]]+as[[:space:]]*\([[:space:]]*select[[:space:]]+\*[[:space:]]+from[[:space:]]+plan_resources[[:space:]]+union[[:space:]]+all[[:space:]]+select[[:space:]]+\*[[:space:]]+from[[:space:]]+unlinked_intent_resources[[:space:]]*\),',
      $replacement$base_resources as (
    select *
    from plan_resources
    where owner_user_id = v_user_id
       or public.can_users_discover_each_other(v_user_id, owner_user_id)

    union all

    select *
    from unlinked_intent_resources
    where owner_user_id = v_user_id
       or public.can_users_discover_each_other(v_user_id, owner_user_id)
  ),$replacement$
    );

    if v_patched_definition = v_definition then
      raise warning
        'UIN discovery control patch could not locate base_resources in %.%(%)',
        'public',
        v_proc.proname,
        v_proc.arguments;
      continue;
    end if;

    execute v_patched_definition;
    v_patched_count := v_patched_count + 1;
  end loop;

  raise notice
    'UIN discovery controls: % discovery function(s) patched, % already compatible.',
    v_patched_count,
    v_already_count;
end;
$discover_patch$;

-- ---------------------------------------------------------------------------
-- 8. Prevent future blocked-pair interaction bypasses
-- ---------------------------------------------------------------------------

create or replace function public.prevent_blocked_friendship_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status in ('pending', 'accepted')
     and public.users_are_blocked(
       new.requester_user_id,
       new.addressee_user_id
     )
  then
    raise exception 'This interaction is not available.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_blocked_friendship_pair_trigger
  on public.friendships;

create trigger prevent_blocked_friendship_pair_trigger
before insert or update of requester_user_id, addressee_user_id, status
on public.friendships
for each row
execute function public.prevent_blocked_friendship_pair();

create or replace function public.prevent_blocked_profile_follow_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.users_are_blocked(
    new.follower_user_id,
    new.followed_user_id
  ) then
    raise exception 'This interaction is not available.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_blocked_profile_follow_pair_trigger
  on public.profile_follows;

create trigger prevent_blocked_profile_follow_pair_trigger
before insert or update of follower_user_id, followed_user_id
on public.profile_follows
for each row
execute function public.prevent_blocked_profile_follow_pair();

create or replace function public.prevent_blocked_join_request_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'pending'
     and public.users_are_blocked(
       new.requester_user_id,
       new.receiver_user_id
     )
  then
    raise exception 'This interaction is not available.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_blocked_join_request_pair_trigger
  on public.intent_join_requests;

create trigger prevent_blocked_join_request_pair_trigger
before insert or update of requester_user_id, receiver_user_id, status
on public.intent_join_requests
for each row
execute function public.prevent_blocked_join_request_pair();

do $legacy_request_trigger$
begin
  if to_regclass('public.intent_requests') is not null then
    execute $sql$
      create or replace function public.prevent_blocked_legacy_match_request_pair()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $function$
      begin
        if new.status = 'pending'
           and public.users_are_blocked(
             new.requester_id,
             new.receiver_id
           )
        then
          raise exception 'This interaction is not available.'
            using errcode = '42501';
        end if;

        return new;
      end;
      $function$;
    $sql$;

    execute 'drop trigger if exists prevent_blocked_legacy_match_request_pair_trigger on public.intent_requests';

    execute $sql$
      create trigger prevent_blocked_legacy_match_request_pair_trigger
      before insert or update of requester_id, receiver_id, status
      on public.intent_requests
      for each row
      execute function public.prevent_blocked_legacy_match_request_pair()
    $sql$;
  end if;
end;
$legacy_request_trigger$;

create or replace function public.prevent_blocked_intent_invitation_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'pending'
     and public.users_are_blocked(
       new.invited_by,
       new.invited_user_id
     )
  then
    raise exception 'This interaction is not available.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_blocked_intent_invitation_pair_trigger
  on public.intent_invitations;

create trigger prevent_blocked_intent_invitation_pair_trigger
before insert or update of invited_by, invited_user_id, status
on public.intent_invitations
for each row
execute function public.prevent_blocked_intent_invitation_pair();

-- ---------------------------------------------------------------------------
-- 9. Translation catalogue
-- ---------------------------------------------------------------------------

do $privacy_i18n$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null
     and to_regclass('public.app_locales') is not null
  then
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
      'privacy',
      source_row.default_text,
      'User-level discovery controls',
      1,
      true
    from (
      values
        ('source.privacy.person-options', 'Person options'),
        ('source.privacy.ignore-this-person', 'Ignore this person'),
        ('source.privacy.ignore-help', 'Hide their Intents and Seeds from your Discover and Matches. They can still see you.'),
        ('source.privacy.block-this-person', 'Block this person'),
        ('source.privacy.block-help', 'Hide each other across Discover, Matches, Intents and Seeds.'),
        ('source.privacy.block-title', 'Block this person?'),
        ('source.privacy.block-description', 'You will stop seeing each other in discovery. Friendship, follows and pending requests between you will be removed. Existing shared Activities stay in your history.'),
        ('source.privacy.cancel', 'Cancel'),
        ('source.privacy.block', 'Block'),
        ('source.privacy.blocking', 'Blocking…'),
        ('source.privacy.ignoring', 'Ignoring…'),
        ('source.privacy.privacy-settings', 'Privacy settings'),
        ('source.privacy.privacy-discovery', 'Privacy & discovery'),
        ('source.privacy.privacy-description', 'Control people you no longer want to see in UIN discovery.'),
        ('source.privacy.ignored-people', 'Ignored people'),
        ('source.privacy.blocked-people', 'Blocked people'),
        ('source.privacy.ignored', 'Ignored'),
        ('source.privacy.blocked', 'Blocked'),
        ('source.privacy.stop-ignoring', 'Stop ignoring'),
        ('source.privacy.unblock', 'Unblock'),
        ('source.privacy.updating', 'Updating…'),
        ('source.privacy.no-controls', 'No ignored or blocked people.'),
        ('source.privacy.ignore-explanation', 'Ignored people disappear from your Discover, Matches, Intents and Seed discovery. They can still discover you.'),
        ('source.privacy.block-explanation', 'Blocked people cannot discover you, and you cannot discover them. Existing shared Activities are not deleted.'),
        ('source.privacy.unblock-note', 'Unblocking does not restore a previous friendship, follow or request automatically.'),
        ('source.privacy.back-timeline', '← Back to Timeline'),
        ('source.privacy.update-failed', 'Privacy preference could not be updated.')
    ) as source_row(key, default_text)
    on conflict (key)
    do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text
          is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    if exists (
      select 1
      from public.app_locales locale
      where locale.code = 'tr'
    ) then
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
          ('source.privacy.person-options', 'Kişi seçenekleri'),
          ('source.privacy.ignore-this-person', 'Bu kişiyi yoksay'),
          ('source.privacy.ignore-help', 'Bu kişinin Niyetlerini ve Tohumlarını Keşfet ve Eşleşmelerinde gösterme. O seni görmeye devam edebilir.'),
          ('source.privacy.block-this-person', 'Bu kişiyi engelle'),
          ('source.privacy.block-help', 'Keşfet, Eşleşmeler, Niyetler ve Tohumlarda birbirinizi gizleyin.'),
          ('source.privacy.block-title', 'Bu kişiyi engelle?'),
          ('source.privacy.block-description', 'Artık keşifte birbirinizi görmeyeceksiniz. Aranızdaki arkadaşlık, takipler ve bekleyen istekler kaldırılacak. Mevcut ortak Aktiviteler geçmişinizde kalacak.'),
          ('source.privacy.cancel', 'Vazgeç'),
          ('source.privacy.block', 'Engelle'),
          ('source.privacy.blocking', 'Engelleniyor…'),
          ('source.privacy.ignoring', 'Yoksayılıyor…'),
          ('source.privacy.privacy-settings', 'Gizlilik ayarları'),
          ('source.privacy.privacy-discovery', 'Gizlilik ve keşfet'),
          ('source.privacy.privacy-description', 'UIN keşfinde artık görmek istemediğin kişileri yönet.'),
          ('source.privacy.ignored-people', 'Yoksayılan kişiler'),
          ('source.privacy.blocked-people', 'Engellenen kişiler'),
          ('source.privacy.ignored', 'Yoksayıldı'),
          ('source.privacy.blocked', 'Engellendi'),
          ('source.privacy.stop-ignoring', 'Yoksaymayı kaldır'),
          ('source.privacy.unblock', 'Engeli kaldır'),
          ('source.privacy.updating', 'Güncelleniyor…'),
          ('source.privacy.no-controls', 'Yoksayılan veya engellenen kişi yok.'),
          ('source.privacy.ignore-explanation', 'Yoksayılan kişiler senin Keşfet, Eşleşmeler, Niyet ve Tohum keşfinden çıkar. Onlar seni görmeye devam edebilir.'),
          ('source.privacy.block-explanation', 'Engellenen kişiler seni keşfedemez; sen de onları keşfedemezsin. Mevcut ortak Aktiviteler silinmez.'),
          ('source.privacy.unblock-note', 'Engeli kaldırmak eski arkadaşlığı, takibi veya isteği otomatik olarak geri getirmez.'),
          ('source.privacy.back-timeline', '← Niyet Yolculuğuna Dön'),
          ('source.privacy.update-failed', 'Gizlilik tercihi güncellenemedi.')
      ) as translation_row(key, translated_text)
      join public.translation_keys translation_key
        on translation_key.key = translation_row.key
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
  end if;
end;
$privacy_i18n$;

comment on table public.user_discovery_controls is
  'One-way Ignore and actor-authored Block controls. Block is interpreted bilaterally by canonical discovery helpers.';

comment on function public.can_users_discover_each_other(uuid, uuid) is
  'Canonical person-level discovery boundary. Ignore is one-way; a Block in either direction is bilateral.';

comment on function public.set_my_user_discovery_control(uuid, text) is
  'Sets Ignore/Block/none for the signed-in user. Block removes future social ties and pending requests but preserves existing Shared Plan/Activity membership and history.';

notify pgrst, 'reload schema';

commit;
