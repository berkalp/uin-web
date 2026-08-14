begin;

set local lock_timeout = '10s';
set local statement_timeout = '240s';

-- ============================================================
-- COMMUNITY FOLLOWING != VERIFIED MEMBERSHIP
--
-- Following remains a private interest signal.
-- Membership is an administrator-verified affiliation that can
-- optionally gate whether a Community may be attached to an Intent.
-- Existing Communities default to `open`, so this migration does not
-- silently lock any existing Intent workflow.
-- ============================================================

alter table public.communities
  add column if not exists intent_access_mode text not null default 'open';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'communities_intent_access_mode_check'
      and conrelid = 'public.communities'::regclass
  ) then
    alter table public.communities
      add constraint communities_intent_access_mode_check
      check (intent_access_mode in ('open', 'verified_members'));
  end if;
end;
$$;

create table if not exists public.community_memberships (
  community_id uuid not null
    references public.communities(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status text not null default 'active',
  member_label text not null default 'Member',
  verification_note text,
  show_on_profile boolean not null default true,

  verified_by_admin_id uuid
    references auth.users(id)
    on delete set null,
  verified_at timestamptz not null default now(),

  revoked_by_admin_id uuid
    references auth.users(id)
    on delete set null,
  revoked_at timestamptz,
  revoke_reason text,

  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (community_id, user_id),

  constraint community_memberships_status_check
    check (status in ('active', 'revoked')),

  constraint community_memberships_member_label_check
    check (char_length(btrim(member_label)) between 1 and 80),

  constraint community_memberships_verification_note_check
    check (verification_note is null or char_length(verification_note) <= 1000),

  constraint community_memberships_revoke_reason_check
    check (revoke_reason is null or char_length(revoke_reason) <= 1000),

  constraint community_memberships_state_check
    check (
      (status = 'active' and revoked_at is null)
      or
      (status = 'revoked' and revoked_at is not null)
    )
);

create index if not exists community_memberships_user_idx
  on public.community_memberships (user_id, status, expires_at);

create index if not exists community_memberships_community_idx
  on public.community_memberships (community_id, status, expires_at);

alter table public.community_memberships enable row level security;

drop policy if exists users_view_own_community_memberships
  on public.community_memberships;

create policy users_view_own_community_memberships
  on public.community_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete
  on public.community_memberships
  from anon, authenticated;

grant select
  on public.community_memberships
  to authenticated;

-- ============================================================
-- CURRENT-USER ACCESS HELPERS
-- ============================================================

create or replace function public.is_verified_community_member(
  p_community_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.community_memberships membership
      where membership.community_id = p_community_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and (
          membership.expires_at is null
          or membership.expires_at > now()
        )
    );
$$;

create or replace function public.get_my_community_intent_access()
returns table (
  community_id uuid,
  intent_access_mode text,
  is_verified_member boolean,
  can_use_for_intent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    community.id as community_id,
    community.intent_access_mode,
    exists (
      select 1
      from public.community_memberships membership
      where membership.community_id = community.id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and (
          membership.expires_at is null
          or membership.expires_at > now()
        )
    ) as is_verified_member,
    (
      community.intent_access_mode = 'open'
      or exists (
        select 1
        from public.community_memberships membership
        where membership.community_id = community.id
          and membership.user_id = auth.uid()
          and membership.status = 'active'
          and (
            membership.expires_at is null
            or membership.expires_at > now()
          )
      )
    ) as can_use_for_intent
  from public.communities community
  where community.status = 'active'
  order by community.name, community.id;
$$;

create or replace function public.get_community_intent_access_context(
  p_community_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_community public.communities%rowtype;
  v_membership public.community_memberships%rowtype;
  v_is_member boolean := false;
  v_active_member_count bigint := 0;
begin
  select *
  into v_community
  from public.communities community
  where community.id = p_community_id
    and community.status = 'active';

  if not found then
    raise exception 'Community not found or inactive.' using errcode = 'P0002';
  end if;

  if auth.uid() is not null then
    select membership.*
    into v_membership
    from public.community_memberships membership
    where membership.community_id = p_community_id
      and membership.user_id = auth.uid()
    limit 1;

    v_is_member :=
      found
      and v_membership.status = 'active'
      and (
        v_membership.expires_at is null
        or v_membership.expires_at > now()
      );
  end if;

  select count(*)
  into v_active_member_count
  from public.community_memberships membership
  where membership.community_id = p_community_id
    and membership.status = 'active'
    and (
      membership.expires_at is null
      or membership.expires_at > now()
    );

  return jsonb_build_object(
    'community_id', v_community.id,
    'intent_access_mode', v_community.intent_access_mode,
    'is_verified_member', v_is_member,
    'can_use_for_intent',
      v_community.intent_access_mode = 'open' or v_is_member,
    'member_label',
      case when v_is_member then v_membership.member_label else null end,
    'show_on_profile',
      case when v_is_member then v_membership.show_on_profile else false end,
    'verified_at',
      case when v_is_member then v_membership.verified_at else null end,
    'expires_at',
      case when v_is_member then v_membership.expires_at else null end,
    'active_member_count', v_active_member_count
  );
end;
$$;

create or replace function public.set_my_community_membership_visibility(
  p_community_id uuid,
  p_show_on_profile boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.community_memberships membership
  set
    show_on_profile = coalesce(p_show_on_profile, false),
    updated_at = now()
  where membership.community_id = p_community_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
    and (
      membership.expires_at is null
      or membership.expires_at > now()
    );

  if not found then
    raise exception 'Active Community membership not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.get_public_profile_community_memberships(
  p_user_id uuid
)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  community_accent_color text,
  community_secondary_color text,
  member_label text,
  verified_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    community.id,
    community.name,
    community.slug,
    community.description,
    community.icon_key,
    community.icon_url,
    community.accent_color,
    community.secondary_color,
    membership.member_label,
    membership.verified_at,
    membership.expires_at
  from public.community_memberships membership
  join public.communities community
    on community.id = membership.community_id
  where membership.user_id = p_user_id
    and membership.status = 'active'
    and membership.show_on_profile = true
    and (
      membership.expires_at is null
      or membership.expires_at > now()
    )
    and community.status = 'active'
  order by membership.verified_at desc, community.name, community.id;
$$;

-- ============================================================
-- ADMINISTRATION
-- ============================================================

create or replace function public.get_admin_community_access_catalogue()
returns table (
  community_id uuid,
  intent_access_mode text,
  active_member_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return query
  select
    community.id,
    community.intent_access_mode,
    (
      select count(*)
      from public.community_memberships membership
      where membership.community_id = community.id
        and membership.status = 'active'
        and (
          membership.expires_at is null
          or membership.expires_at > now()
        )
    )::bigint
  from public.communities community
  order by community.name, community.id;
end;
$$;

create or replace function public.admin_set_community_intent_access(
  p_community_id uuid,
  p_intent_access_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(btrim(coalesce(p_intent_access_mode, '')));
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if v_mode not in ('open', 'verified_members') then
    raise exception 'Community Intent access must be open or verified_members.' using errcode = '22023';
  end if;

  update public.communities community
  set
    intent_access_mode = v_mode,
    updated_by_admin_id = auth.uid(),
    updated_at = now()
  where community.id = p_community_id;

  if not found then
    raise exception 'Community not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_search_community_memberships(
  p_community_id uuid,
  p_query text default null,
  p_limit integer default 30
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  email text,
  avatar_url text,
  membership_status text,
  member_label text,
  show_on_profile boolean,
  verified_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.communities community where community.id = p_community_id
  ) then
    raise exception 'Community not found.' using errcode = 'P0002';
  end if;

  return query
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.email,
    profile.avatar_url,
    case
      when membership.status = 'active'
        and (membership.expires_at is null or membership.expires_at > now())
        then 'active'
      when membership.status = 'active'
        and membership.expires_at is not null
        and membership.expires_at <= now()
        then 'expired'
      else membership.status
    end,
    membership.member_label,
    coalesce(membership.show_on_profile, false),
    membership.verified_at,
    membership.expires_at
  from public.profiles profile
  left join public.community_memberships membership
    on membership.user_id = profile.id
   and membership.community_id = p_community_id
  where
    v_query = ''
    or lower(coalesce(profile.full_name, '')) like '%' || v_query || '%'
    or lower(coalesce(profile.username, '')) like '%' || v_query || '%'
    or lower(coalesce(profile.email, '')) like '%' || v_query || '%'
  order by
    case
      when membership.status = 'active'
        and (membership.expires_at is null or membership.expires_at > now())
        then 0
      else 1
    end,
    coalesce(profile.full_name, profile.username, profile.email, profile.id::text),
    profile.id
  limit v_limit;
end;
$$;

create or replace function public.admin_set_community_membership(
  p_community_id uuid,
  p_user_id uuid,
  p_active boolean,
  p_member_label text default 'Member',
  p_expires_at timestamptz default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := nullif(btrim(coalesce(p_member_label, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.communities community where community.id = p_community_id
  ) then
    raise exception 'Community not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.profiles profile where profile.id = p_user_id
  ) then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  if coalesce(p_active, false) then
    if v_label is null then
      v_label := 'Member';
    end if;

    if char_length(v_label) > 80 then
      raise exception 'Membership label cannot exceed 80 characters.' using errcode = '22001';
    end if;

    if p_expires_at is not null and p_expires_at <= now() then
      raise exception 'Membership expiry must be in the future.' using errcode = '22023';
    end if;

    insert into public.community_memberships (
      community_id,
      user_id,
      status,
      member_label,
      verification_note,
      verified_by_admin_id,
      verified_at,
      revoked_by_admin_id,
      revoked_at,
      revoke_reason,
      expires_at,
      created_at,
      updated_at
    )
    values (
      p_community_id,
      p_user_id,
      'active',
      v_label,
      v_note,
      auth.uid(),
      now(),
      null,
      null,
      null,
      p_expires_at,
      now(),
      now()
    )
    on conflict (community_id, user_id)
    do update set
      status = 'active',
      member_label = excluded.member_label,
      verification_note = excluded.verification_note,
      verified_by_admin_id = auth.uid(),
      verified_at = now(),
      revoked_by_admin_id = null,
      revoked_at = null,
      revoke_reason = null,
      expires_at = excluded.expires_at,
      updated_at = now();
  else
    update public.community_memberships membership
    set
      status = 'revoked',
      revoked_by_admin_id = auth.uid(),
      revoked_at = now(),
      revoke_reason = v_note,
      updated_at = now()
    where membership.community_id = p_community_id
      and membership.user_id = p_user_id
      and membership.status = 'active';

    if not found then
      raise exception 'Active Community membership not found.' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

-- ============================================================
-- INTENT COMMUNITY VALIDATION
--
-- Existing exact-Activity validation remains intact. The only new rule:
-- Communities marked `verified_members` require an active membership.
-- This is enforced in the database, not merely hidden in the UI.
-- ============================================================

create or replace function public.validate_intent_community_ids(
  p_activity_id uuid,
  p_community_ids uuid[]
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_community_name text;
  v_access_mode text;
begin
  select coalesce(array_agg(value order by ordinal), array[]::uuid[])
  into v_ids
  from (
    select value, min(ordinal) as ordinal
    from unnest(coalesce(p_community_ids, array[]::uuid[])) with ordinality as item(value, ordinal)
    where value is not null
    group by value
  ) normalized;

  if coalesce(array_length(v_ids, 1), 0) > 3 then
    raise exception 'An Intent may use at most 3 Communities.' using errcode = '22023';
  end if;

  foreach v_id in array v_ids loop
    select community.name, community.intent_access_mode
    into v_community_name, v_access_mode
    from public.communities community
    join public.community_activity_scopes activity_scope
      on activity_scope.community_id = community.id
    where community.id = v_id
      and community.status = 'active'
      and activity_scope.activity_id = p_activity_id
    limit 1;

    if not found then
      raise exception 'Every selected Community must be active and attached to the exact Activity.' using errcode = '22023';
    end if;

    if v_access_mode = 'verified_members'
       and not exists (
         select 1
         from public.community_memberships membership
         where membership.community_id = v_id
           and membership.user_id = auth.uid()
           and membership.status = 'active'
           and (
             membership.expires_at is null
             or membership.expires_at > now()
           )
       )
    then
      raise exception 'Only verified members may attach an Intent to Community "%".', v_community_name using errcode = '42501';
    end if;
  end loop;

  return v_ids;
end;
$$;

-- The Edit Intent UI already collected Communities and related links, but its
-- client service historically updated only the base Intent row. This atomic
-- RPC closes that gap while preserving current eligibility/join settings.
create or replace function public.update_my_intent_with_communities_eligibility_and_join_settings(
  p_intent_id uuid,
  p_activity_id uuid,
  p_sport_id uuid,
  p_location_id uuid,
  p_start_date date,
  p_end_date date,
  p_people text,
  p_recurrence text,
  p_visibility text,
  p_budget numeric,
  p_max_participants integer,
  p_participant_eligibility text,
  p_join_message_mode text,
  p_join_message_prompt text,
  p_notes text,
  p_community_ids uuid[],
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result uuid;
  v_mode text := coalesce(nullif(lower(btrim(p_join_message_mode)), ''), 'optional');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_participant_eligibility not in ('everyone', 'women_only', 'men_only') then
    raise exception 'Unsupported participant eligibility.' using errcode = '22023';
  end if;

  if v_mode not in ('required', 'optional', 'none') then
    raise exception 'Unsupported join message mode.' using errcode = '22023';
  end if;

  if v_mode <> 'none'
     and nullif(btrim(coalesce(p_join_message_prompt, '')), '') is null
  then
    raise exception 'Enter the question participants should answer.' using errcode = '22023';
  end if;

  v_result := public.update_my_intent_with_context_links_and_communities(
    p_intent_id => p_intent_id,
    p_activity_id => p_activity_id,
    p_location_id => p_location_id,
    p_start_date => p_start_date,
    p_end_date => p_end_date,
    p_people => p_people,
    p_recurrence => p_recurrence,
    p_visibility => p_visibility,
    p_budget => p_budget,
    p_max_participants => p_max_participants,
    p_notes => p_notes,
    p_community_ids => coalesce(p_community_ids, array[]::uuid[]),
    p_links => coalesce(p_links, '[]'::jsonb)
  );

  update public.intents intent
  set
    sport_id = p_sport_id,
    participant_eligibility = p_participant_eligibility,
    join_message_mode = v_mode,
    join_message_prompt = case
      when v_mode = 'none' then null
      else nullif(btrim(p_join_message_prompt), '')
    end,
    updated_at = now()
  where intent.id = p_intent_id
    and intent.user_id = auth.uid();

  if not found then
    raise exception 'Intent not found or access denied.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all on function public.is_verified_community_member(uuid) from public;
revoke all on function public.get_my_community_intent_access() from public;
revoke all on function public.get_community_intent_access_context(uuid) from public;
revoke all on function public.set_my_community_membership_visibility(uuid, boolean) from public;
revoke all on function public.get_public_profile_community_memberships(uuid) from public;
revoke all on function public.get_admin_community_access_catalogue() from public;
revoke all on function public.admin_set_community_intent_access(uuid, text) from public;
revoke all on function public.admin_search_community_memberships(uuid, text, integer) from public;
revoke all on function public.admin_set_community_membership(uuid, uuid, boolean, text, timestamptz, text) from public;
revoke all on function public.update_my_intent_with_communities_eligibility_and_join_settings(uuid, uuid, uuid, uuid, date, date, text, text, text, numeric, integer, text, text, text, text, uuid[], jsonb) from public;

grant execute on function public.is_verified_community_member(uuid) to authenticated;
grant execute on function public.get_my_community_intent_access() to authenticated;
grant execute on function public.get_community_intent_access_context(uuid) to authenticated;
grant execute on function public.set_my_community_membership_visibility(uuid, boolean) to authenticated;
grant execute on function public.get_public_profile_community_memberships(uuid) to anon, authenticated;
grant execute on function public.get_admin_community_access_catalogue() to authenticated;
grant execute on function public.admin_set_community_intent_access(uuid, text) to authenticated;
grant execute on function public.admin_search_community_memberships(uuid, text, integer) to authenticated;
grant execute on function public.admin_set_community_membership(uuid, uuid, boolean, text, timestamptz, text) to authenticated;
grant execute on function public.update_my_intent_with_communities_eligibility_and_join_settings(uuid, uuid, uuid, uuid, date, date, text, text, text, numeric, integer, text, text, text, text, uuid[], jsonb) to authenticated;

commit;
