-- UIN staff messaging, time-limited member reply access, staff capabilities,
-- and audited profile editing.
--
-- Design goals:
--   * Member-to-member DMs remain unavailable.
--   * Owner decides which staff accounts may message staff, message members,
--     and edit member profiles.
--   * Staff-to-staff conversations can be long-lived/unlimited once both
--     accounts are explicitly recognized as staff messaging identities.
--   * A staff member with member_messaging may open a conversation with a
--     member and grant that member send/reply access until an exact expiry.
--   * Conversation history remains readable after access expires.
--   * Profile edits are audited with before/after values and an optional reason.

create extension if not exists pgcrypto;

create table if not exists public.staff_capabilities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (
    capability in (
      'staff_identity',
      'staff_messaging',
      'member_messaging',
      'edit_profiles'
    )
  ),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, capability)
);

create index if not exists staff_capabilities_active_idx
  on public.staff_capabilities (capability, user_id)
  where revoked_at is null;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (user_a_id <> user_b_id)
);

create unique index if not exists direct_conversations_pair_uidx
  on public.direct_conversations (
    least(user_a_id, user_b_id),
    greatest(user_a_id, user_b_id)
  );

create index if not exists direct_conversations_user_a_idx
  on public.direct_conversations (user_a_id, coalesce(last_message_at, created_at) desc);

create index if not exists direct_conversations_user_b_idx
  on public.direct_conversations (user_b_id, coalesce(last_message_at, created_at) desc);

create table if not exists public.direct_conversation_access (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_kind text not null check (access_kind in ('staff', 'granted')),
  granted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists direct_conversation_access_user_idx
  on public.direct_conversation_access (user_id, conversation_id);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check (char_length(btrim(body)) between 1 and 5000)
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at, id);

create table if not exists public.direct_conversation_reads (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.staff_operations_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  conversation_id uuid references public.direct_conversations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_operations_audit_target_idx
  on public.staff_operations_audit (target_user_id, created_at desc);

create index if not exists staff_operations_audit_actor_idx
  on public.staff_operations_audit (actor_user_id, created_at desc);

alter table public.staff_capabilities enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_access enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_conversation_reads enable row level security;
alter table public.staff_operations_audit enable row level security;

revoke all on public.staff_capabilities from anon, authenticated;
revoke all on public.direct_conversations from anon, authenticated;
revoke all on public.direct_conversation_access from anon, authenticated;
revoke all on public.direct_messages from anon, authenticated;
revoke all on public.direct_conversation_reads from anon, authenticated;
revoke all on public.staff_operations_audit from anon, authenticated;

create or replace function public.current_user_is_uin_owner()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return false;
  end if;

  begin
    select public.get_admin_role()::text into v_role;
  exception when others then
    return false;
  end;

  return coalesce(v_role = 'owner', false);
end;
$$;

create or replace function public.ensure_current_owner_staff_identity()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_user_is_uin_owner() then
    insert into public.staff_capabilities (
      user_id,
      capability,
      granted_by,
      granted_at,
      revoked_at,
      updated_at
    ) values (
      auth.uid(),
      'staff_identity',
      auth.uid(),
      now(),
      null,
      now()
    )
    on conflict (user_id, capability)
    do update set
      revoked_at = null,
      updated_at = now();
  end if;
end;
$$;

create or replace function public.user_has_staff_capability(
  p_user_id uuid,
  p_capability text
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_capabilities sc
    where sc.user_id = p_user_id
      and sc.capability = p_capability
      and sc.revoked_at is null
  );
$$;

create or replace function public.current_staff_has_capability(
  p_capability text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.current_user_is_uin_owner() then
    perform public.ensure_current_owner_staff_identity();
    return p_capability in (
      'staff_identity',
      'staff_messaging',
      'member_messaging',
      'edit_profiles'
    );
  end if;

  begin
    select public.get_admin_role()::text into v_role;
  exception when others then
    return false;
  end;

  if v_role is null then
    return false;
  end if;

  return public.user_has_staff_capability(auth.uid(), p_capability);
end;
$$;

create or replace function public.get_my_staff_capabilities()
returns table (
  capability text,
  enabled boolean,
  implicit_owner boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if public.current_user_is_uin_owner() then
    perform public.ensure_current_owner_staff_identity();

    return query
    select x.capability, true, true
    from (values
      ('staff_identity'::text),
      ('staff_messaging'::text),
      ('member_messaging'::text),
      ('edit_profiles'::text)
    ) as x(capability);

    return;
  end if;

  return query
  select sc.capability, true, false
  from public.staff_capabilities sc
  where sc.user_id = auth.uid()
    and sc.revoked_at is null;
end;
$$;

create or replace function public.get_staff_capabilities_for_user(
  p_target_user_id uuid
)
returns table (
  capability text,
  enabled boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_uin_owner() then
    raise exception 'Only the owner can review staff permissions.' using errcode = '42501';
  end if;

  perform public.ensure_current_owner_staff_identity();

  return query
  select x.capability,
         exists (
           select 1
           from public.staff_capabilities sc
           where sc.user_id = p_target_user_id
             and sc.capability = x.capability
             and sc.revoked_at is null
         ) as enabled
  from (values
    ('staff_messaging'::text),
    ('member_messaging'::text),
    ('edit_profiles'::text)
  ) as x(capability);
end;
$$;

create or replace function public.set_staff_capability(
  p_target_user_id uuid,
  p_capability text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_uin_owner() then
    raise exception 'Only the owner can change staff permissions.' using errcode = '42501';
  end if;

  if p_target_user_id is null then
    raise exception 'Target user is required.' using errcode = '22023';
  end if;

  if p_capability not in ('staff_messaging', 'member_messaging', 'edit_profiles') then
    raise exception 'Unsupported staff capability.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  perform public.ensure_current_owner_staff_identity();

  -- Any account receiving a staff capability becomes an explicit staff
  -- messaging identity. This avoids depending on the private implementation
  -- details of the existing role table.
  if p_enabled then
    insert into public.staff_capabilities (
      user_id, capability, granted_by, granted_at, revoked_at, updated_at
    ) values (
      p_target_user_id, 'staff_identity', auth.uid(), now(), null, now()
    )
    on conflict (user_id, capability)
    do update set
      granted_by = auth.uid(),
      granted_at = now(),
      revoked_at = null,
      updated_at = now();
  end if;

  insert into public.staff_capabilities (
    user_id, capability, granted_by, granted_at, revoked_at, updated_at
  ) values (
    p_target_user_id,
    p_capability,
    auth.uid(),
    now(),
    case when p_enabled then null else now() end,
    now()
  )
  on conflict (user_id, capability)
  do update set
    granted_by = auth.uid(),
    granted_at = case when p_enabled then now() else public.staff_capabilities.granted_at end,
    revoked_at = case when p_enabled then null else now() end,
    updated_at = now();

  insert into public.staff_operations_audit (
    actor_user_id,
    target_user_id,
    action,
    metadata
  ) values (
    auth.uid(),
    p_target_user_id,
    'staff_capability_changed',
    jsonb_build_object(
      'capability', p_capability,
      'enabled', p_enabled
    )
  );
end;
$$;

create or replace function public.get_staff_message_target_context(
  p_target_user_id uuid
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  is_staff_target boolean,
  can_start boolean,
  start_mode text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_is_staff boolean;
  v_can_staff boolean;
  v_can_member boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_target_user_id is null or p_target_user_id = auth.uid() then
    raise exception 'Choose another user.' using errcode = '22023';
  end if;

  perform public.ensure_current_owner_staff_identity();

  v_target_is_staff := public.user_has_staff_capability(p_target_user_id, 'staff_identity');
  v_can_staff := public.current_staff_has_capability('staff_messaging');
  v_can_member := public.current_staff_has_capability('member_messaging');

  return query
  select
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    v_target_is_staff,
    case
      when v_target_is_staff then (v_can_staff or v_can_member)
      else v_can_member
    end,
    case
      when v_target_is_staff then 'staff'
      else 'member'
    end
  from public.profiles p
  where p.id = p_target_user_id;
end;
$$;

create or replace function public.open_staff_conversation(
  p_target_user_id uuid,
  p_body text,
  p_member_access_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_target_is_staff boolean;
  v_can_staff boolean;
  v_can_member boolean;
  v_conversation_id uuid;
  v_clean_body text := btrim(coalesce(p_body, ''));
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_target_user_id is null or p_target_user_id = v_actor then
    raise exception 'Choose another user.' using errcode = '22023';
  end if;

  if char_length(v_clean_body) < 1 or char_length(v_clean_body) > 5000 then
    raise exception 'Message must contain between 1 and 5000 characters.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  perform public.ensure_current_owner_staff_identity();

  v_target_is_staff := public.user_has_staff_capability(p_target_user_id, 'staff_identity');
  v_can_staff := public.current_staff_has_capability('staff_messaging');
  v_can_member := public.current_staff_has_capability('member_messaging');

  if v_target_is_staff then
    if not (v_can_staff or v_can_member) then
      raise exception 'You do not have permission to start staff conversations.' using errcode = '42501';
    end if;
  else
    if not v_can_member then
      raise exception 'You do not have permission to message members.' using errcode = '42501';
    end if;

    if p_member_access_expires_at is null
       or p_member_access_expires_at <= now() then
      raise exception 'A future reply-access expiry is required for member conversations.' using errcode = '22023';
    end if;

    if p_member_access_expires_at > now() + interval '100 years' then
      raise exception 'Reply access cannot exceed 100 years.' using errcode = '22023';
    end if;
  end if;

  select dc.id into v_conversation_id
  from public.direct_conversations dc
  where (dc.user_a_id = v_actor and dc.user_b_id = p_target_user_id)
     or (dc.user_a_id = p_target_user_id and dc.user_b_id = v_actor)
  limit 1;

  if v_conversation_id is null then
    insert into public.direct_conversations (
      user_a_id,
      user_b_id,
      opened_by,
      created_at,
      updated_at
    ) values (
      v_actor,
      p_target_user_id,
      v_actor,
      now(),
      now()
    )
    returning id into v_conversation_id;
  end if;

  insert into public.direct_conversation_access (
    conversation_id,
    user_id,
    access_kind,
    granted_by,
    expires_at,
    revoked_at,
    created_at,
    updated_at
  ) values (
    v_conversation_id,
    v_actor,
    'staff',
    v_actor,
    null,
    null,
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    access_kind = 'staff',
    granted_by = v_actor,
    expires_at = null,
    revoked_at = null,
    updated_at = now();

  insert into public.direct_conversation_access (
    conversation_id,
    user_id,
    access_kind,
    granted_by,
    expires_at,
    revoked_at,
    created_at,
    updated_at
  ) values (
    v_conversation_id,
    p_target_user_id,
    case when v_target_is_staff then 'staff' else 'granted' end,
    v_actor,
    case when v_target_is_staff then null else p_member_access_expires_at end,
    null,
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    access_kind = excluded.access_kind,
    granted_by = v_actor,
    expires_at = case
      when public.direct_conversation_access.revoked_at is null
       and public.direct_conversation_access.access_kind = 'granted'
       and excluded.access_kind = 'granted'
      then greatest(public.direct_conversation_access.expires_at, excluded.expires_at)
      else excluded.expires_at
    end,
    revoked_at = null,
    updated_at = now();

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    body
  ) values (
    v_conversation_id,
    v_actor,
    v_clean_body
  );

  update public.direct_conversations
  set last_message_at = now(),
      updated_at = now()
  where id = v_conversation_id;

  insert into public.direct_conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    updated_at
  ) values (
    v_conversation_id,
    v_actor,
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_at = now(),
    updated_at = now();

  insert into public.staff_operations_audit (
    actor_user_id,
    target_user_id,
    action,
    conversation_id,
    metadata
  ) values (
    v_actor,
    p_target_user_id,
    'direct_conversation_opened',
    v_conversation_id,
    jsonb_build_object(
      'target_is_staff', v_target_is_staff,
      'member_access_expires_at', p_member_access_expires_at
    )
  );

  return v_conversation_id;
end;
$$;

create or replace function public.direct_conversation_user_can_send(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access public.direct_conversation_access%rowtype;
begin
  select * into v_access
  from public.direct_conversation_access dca
  where dca.conversation_id = p_conversation_id
    and dca.user_id = p_user_id;

  if not found or v_access.revoked_at is not null then
    return false;
  end if;

  if v_access.access_kind = 'staff' then
    if p_user_id <> auth.uid() then
      return false;
    end if;

    return public.current_staff_has_capability('staff_messaging')
        or public.current_staff_has_capability('member_messaging');
  end if;

  return v_access.expires_at is not null and v_access.expires_at > now();
end;
$$;

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_message_id uuid;
  v_clean_body text := btrim(coalesce(p_body, ''));
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if char_length(v_clean_body) < 1 or char_length(v_clean_body) > 5000 then
    raise exception 'Message must contain between 1 and 5000 characters.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.direct_conversations dc
    where dc.id = p_conversation_id
      and (dc.user_a_id = v_actor or dc.user_b_id = v_actor)
  ) then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;

  if not public.direct_conversation_user_can_send(p_conversation_id, v_actor) then
    raise exception 'Messaging access has expired or is not available.' using errcode = '42501';
  end if;

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    body
  ) values (
    p_conversation_id,
    v_actor,
    v_clean_body
  )
  returning id into v_message_id;

  update public.direct_conversations
  set last_message_at = now(),
      updated_at = now()
  where id = p_conversation_id;

  insert into public.direct_conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    updated_at
  ) values (
    p_conversation_id,
    v_actor,
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_at = now(),
    updated_at = now();

  return v_message_id;
end;
$$;

create or replace function public.extend_direct_conversation_access(
  p_conversation_id uuid,
  p_target_user_id uuid,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_target_is_participant boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.current_staff_has_capability('member_messaging') then
    raise exception 'You do not have permission to manage member messaging access.' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.direct_conversations dc
    where dc.id = p_conversation_id
      and (dc.user_a_id = v_actor or dc.user_b_id = v_actor)
      and (dc.user_a_id = p_target_user_id or dc.user_b_id = p_target_user_id)
  ) into v_target_is_participant;

  if not v_target_is_participant or p_target_user_id = v_actor then
    raise exception 'Conversation participant not found.' using errcode = 'P0002';
  end if;

  if public.user_has_staff_capability(p_target_user_id, 'staff_identity') then
    raise exception 'Staff-to-staff access does not require an expiry.' using errcode = '22023';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Choose a future expiry.' using errcode = '22023';
  end if;

  if p_expires_at > now() + interval '100 years' then
    raise exception 'Reply access cannot exceed 100 years.' using errcode = '22023';
  end if;

  insert into public.direct_conversation_access (
    conversation_id,
    user_id,
    access_kind,
    granted_by,
    expires_at,
    revoked_at,
    created_at,
    updated_at
  ) values (
    p_conversation_id,
    p_target_user_id,
    'granted',
    v_actor,
    p_expires_at,
    null,
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    access_kind = 'granted',
    granted_by = v_actor,
    expires_at = p_expires_at,
    revoked_at = null,
    updated_at = now();

  insert into public.staff_operations_audit (
    actor_user_id,
    target_user_id,
    action,
    conversation_id,
    metadata
  ) values (
    v_actor,
    p_target_user_id,
    'direct_message_access_extended',
    p_conversation_id,
    jsonb_build_object('expires_at', p_expires_at)
  );
end;
$$;

create or replace function public.revoke_direct_conversation_access(
  p_conversation_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.current_staff_has_capability('member_messaging') then
    raise exception 'You do not have permission to manage member messaging access.' using errcode = '42501';
  end if;

  if public.user_has_staff_capability(p_target_user_id, 'staff_identity') then
    raise exception 'Staff access is controlled by staff permissions.' using errcode = '22023';
  end if;

  update public.direct_conversation_access dca
  set revoked_at = now(),
      updated_at = now()
  where dca.conversation_id = p_conversation_id
    and dca.user_id = p_target_user_id
    and exists (
      select 1
      from public.direct_conversations dc
      where dc.id = dca.conversation_id
        and (dc.user_a_id = v_actor or dc.user_b_id = v_actor)
    );

  insert into public.staff_operations_audit (
    actor_user_id,
    target_user_id,
    action,
    conversation_id
  ) values (
    v_actor,
    p_target_user_id,
    'direct_message_access_revoked',
    p_conversation_id
  );
end;
$$;

create or replace function public.get_my_direct_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_full_name text,
  other_username text,
  other_avatar_url text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  viewer_can_send boolean,
  viewer_access_kind text,
  viewer_access_expires_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    dc.id,
    other_profile.id,
    other_profile.full_name,
    other_profile.username,
    other_profile.avatar_url,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (
      select count(*)
      from public.direct_messages um
      where um.conversation_id = dc.id
        and um.sender_id <> auth.uid()
        and um.created_at > coalesce(dcr.last_read_at, '-infinity'::timestamptz)
    )::bigint,
    public.direct_conversation_user_can_send(dc.id, auth.uid()),
    my_access.access_kind,
    my_access.expires_at
  from public.direct_conversations dc
  join public.profiles other_profile
    on other_profile.id = case
      when dc.user_a_id = auth.uid() then dc.user_b_id
      else dc.user_a_id
    end
  left join public.direct_conversation_access my_access
    on my_access.conversation_id = dc.id
   and my_access.user_id = auth.uid()
  left join public.direct_conversation_reads dcr
    on dcr.conversation_id = dc.id
   and dcr.user_id = auth.uid()
  left join lateral (
    select dm.body, dm.created_at, dm.sender_id
    from public.direct_messages dm
    where dm.conversation_id = dc.id
    order by dm.created_at desc, dm.id desc
    limit 1
  ) lm on true
  where dc.user_a_id = auth.uid()
     or dc.user_b_id = auth.uid()
  order by coalesce(lm.created_at, dc.created_at) desc;
$$;

create or replace function public.get_direct_conversation_detail(
  p_conversation_id uuid
)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_full_name text,
  other_username text,
  other_avatar_url text,
  viewer_can_send boolean,
  viewer_access_kind text,
  viewer_access_expires_at timestamptz,
  other_access_kind text,
  other_access_expires_at timestamptz,
  other_access_revoked_at timestamptz,
  viewer_can_manage_access boolean,
  other_is_staff boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.direct_conversations dc
    where dc.id = p_conversation_id
      and (dc.user_a_id = v_actor or dc.user_b_id = v_actor)
  ) then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;

  return query
  select
    dc.id,
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    public.direct_conversation_user_can_send(dc.id, v_actor),
    my_access.access_kind,
    my_access.expires_at,
    other_access.access_kind,
    other_access.expires_at,
    other_access.revoked_at,
    (
      public.current_staff_has_capability('member_messaging')
      and not public.user_has_staff_capability(p.id, 'staff_identity')
    ),
    public.user_has_staff_capability(p.id, 'staff_identity')
  from public.direct_conversations dc
  join public.profiles p
    on p.id = case when dc.user_a_id = v_actor then dc.user_b_id else dc.user_a_id end
  left join public.direct_conversation_access my_access
    on my_access.conversation_id = dc.id
   and my_access.user_id = v_actor
  left join public.direct_conversation_access other_access
    on other_access.conversation_id = dc.id
   and other_access.user_id = p.id
  where dc.id = p_conversation_id;
end;
$$;

create or replace function public.get_direct_conversation_messages(
  p_conversation_id uuid,
  p_limit integer default 200
)
returns table (
  message_id uuid,
  sender_id uuid,
  sender_full_name text,
  sender_username text,
  sender_avatar_url text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.direct_conversations dc
    where dc.id = p_conversation_id
      and (dc.user_a_id = auth.uid() or dc.user_b_id = auth.uid())
  ) then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;

  return query
  select
    dm.id,
    dm.sender_id,
    p.full_name,
    p.username,
    p.avatar_url,
    dm.body,
    dm.created_at
  from (
    select dm_inner.*
    from public.direct_messages dm_inner
    where dm_inner.conversation_id = p_conversation_id
    order by dm_inner.created_at desc, dm_inner.id desc
    limit v_limit
  ) dm
  join public.profiles p on p.id = dm.sender_id
  order by dm.created_at asc, dm.id asc;
end;
$$;

create or replace function public.mark_direct_conversation_read(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.direct_conversations dc
    where dc.id = p_conversation_id
      and (dc.user_a_id = auth.uid() or dc.user_b_id = auth.uid())
  ) then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;

  insert into public.direct_conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    updated_at
  ) values (
    p_conversation_id,
    auth.uid(),
    now(),
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.get_my_unread_direct_message_count()
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(x.unread_count), 0)::bigint
  from (
    select (
      select count(*)
      from public.direct_messages dm
      where dm.conversation_id = dc.id
        and dm.sender_id <> auth.uid()
        and dm.created_at > coalesce(dcr.last_read_at, '-infinity'::timestamptz)
    )::bigint as unread_count
    from public.direct_conversations dc
    left join public.direct_conversation_reads dcr
      on dcr.conversation_id = dc.id
     and dcr.user_id = auth.uid()
    where dc.user_a_id = auth.uid()
       or dc.user_b_id = auth.uid()
  ) x;
$$;

create or replace function public.admin_update_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_username text,
  p_bio text default null,
  p_city text default null,
  p_country text default null,
  p_avatar_url text default null,
  p_cover_url text default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.profiles%rowtype;
  v_clean_name text := btrim(coalesce(p_full_name, ''));
  v_clean_username text := lower(btrim(coalesce(p_username, '')));
  v_clean_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_clean_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_clean_country text := nullif(btrim(coalesce(p_country, '')), '');
  v_clean_avatar text := nullif(btrim(coalesce(p_avatar_url, '')), '');
  v_clean_cover text := nullif(btrim(coalesce(p_cover_url, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.current_staff_has_capability('edit_profiles') then
    raise exception 'You do not have permission to edit user profiles.' using errcode = '42501';
  end if;

  select * into v_old
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if char_length(v_clean_name) < 1 or char_length(v_clean_name) > 80 then
    raise exception 'Display name must contain between 1 and 80 characters.' using errcode = '22023';
  end if;

  if char_length(v_clean_username) < 3 or char_length(v_clean_username) > 30
     or v_clean_username !~ '^[a-z0-9_]+$' then
    raise exception 'Username must contain 3-30 lowercase letters, numbers, or underscores.' using errcode = '22023';
  end if;

  if v_clean_bio is not null and char_length(v_clean_bio) > 300 then
    raise exception 'Bio cannot exceed 300 characters.' using errcode = '22023';
  end if;

  if v_clean_city is not null and char_length(v_clean_city) > 80 then
    raise exception 'City cannot exceed 80 characters.' using errcode = '22023';
  end if;

  if v_clean_country is not null and char_length(v_clean_country) > 80 then
    raise exception 'Country cannot exceed 80 characters.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.username) = v_clean_username
      and p.id <> p_user_id
  ) then
    raise exception 'That username is already in use.' using errcode = '23505';
  end if;

  update public.profiles
  set full_name = v_clean_name,
      username = v_clean_username,
      bio = v_clean_bio,
      city = v_clean_city,
      country = v_clean_country,
      avatar_url = v_clean_avatar,
      cover_url = v_clean_cover,
      updated_at = now()
  where id = p_user_id;

  insert into public.staff_operations_audit (
    actor_user_id,
    target_user_id,
    action,
    metadata
  ) values (
    v_actor,
    p_user_id,
    'profile_updated_by_staff',
    jsonb_build_object(
      'reason', v_reason,
      'before', jsonb_build_object(
        'full_name', v_old.full_name,
        'username', v_old.username,
        'bio', v_old.bio,
        'city', v_old.city,
        'country', v_old.country,
        'avatar_url', v_old.avatar_url,
        'cover_url', v_old.cover_url
      ),
      'after', jsonb_build_object(
        'full_name', v_clean_name,
        'username', v_clean_username,
        'bio', v_clean_bio,
        'city', v_clean_city,
        'country', v_clean_country,
        'avatar_url', v_clean_avatar,
        'cover_url', v_clean_cover
      )
    )
  );

  return p_user_id;
end;
$$;

create or replace function public.get_staff_operations_for_user(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  audit_id uuid,
  actor_user_id uuid,
  actor_full_name text,
  action text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- Existing admin role remains the gate for reviewing operational audit.
  if public.get_admin_role() is null then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return query
  select
    soa.id,
    soa.actor_user_id,
    p.full_name,
    soa.action,
    soa.metadata,
    soa.created_at
  from public.staff_operations_audit soa
  left join public.profiles p on p.id = soa.actor_user_id
  where soa.target_user_id = p_user_id
  order by soa.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

revoke all on function public.current_user_is_uin_owner() from public;
revoke all on function public.ensure_current_owner_staff_identity() from public;
revoke all on function public.user_has_staff_capability(uuid, text) from public;
revoke all on function public.current_staff_has_capability(text) from public;
revoke all on function public.get_my_staff_capabilities() from public;
revoke all on function public.get_staff_capabilities_for_user(uuid) from public;
revoke all on function public.set_staff_capability(uuid, text, boolean) from public;
revoke all on function public.get_staff_message_target_context(uuid) from public;
revoke all on function public.open_staff_conversation(uuid, text, timestamptz) from public;
revoke all on function public.direct_conversation_user_can_send(uuid, uuid) from public;
revoke all on function public.send_direct_message(uuid, text) from public;
revoke all on function public.extend_direct_conversation_access(uuid, uuid, timestamptz) from public;
revoke all on function public.revoke_direct_conversation_access(uuid, uuid) from public;
revoke all on function public.get_my_direct_conversations() from public;
revoke all on function public.get_direct_conversation_detail(uuid) from public;
revoke all on function public.get_direct_conversation_messages(uuid, integer) from public;
revoke all on function public.mark_direct_conversation_read(uuid) from public;
revoke all on function public.get_my_unread_direct_message_count() from public;
revoke all on function public.admin_update_user_profile(uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.get_staff_operations_for_user(uuid, integer) from public;

grant execute on function public.current_user_is_uin_owner() to authenticated;
grant execute on function public.get_my_staff_capabilities() to authenticated;
grant execute on function public.get_staff_capabilities_for_user(uuid) to authenticated;
grant execute on function public.set_staff_capability(uuid, text, boolean) to authenticated;
grant execute on function public.get_staff_message_target_context(uuid) to authenticated;
grant execute on function public.open_staff_conversation(uuid, text, timestamptz) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.extend_direct_conversation_access(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.revoke_direct_conversation_access(uuid, uuid) to authenticated;
grant execute on function public.get_my_direct_conversations() to authenticated;
grant execute on function public.get_direct_conversation_detail(uuid) to authenticated;
grant execute on function public.get_direct_conversation_messages(uuid, integer) to authenticated;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;
grant execute on function public.get_my_unread_direct_message_count() to authenticated;
grant execute on function public.admin_update_user_profile(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_staff_operations_for_user(uuid, integer) to authenticated;
