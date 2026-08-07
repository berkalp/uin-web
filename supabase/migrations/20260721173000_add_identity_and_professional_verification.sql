begin;

-- ============================================================
-- UIN IDENTITY + CONTEXTUAL PROFESSIONAL VERIFICATION
-- ============================================================

create table if not exists public.profile_identity_verifications (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,
  status text not null default 'unverified',
  verification_method text,
  verified_by uuid
    references public.profiles(id)
    on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_identity_verifications_status_check
    check (
      status in (
        'unverified',
        'pending',
        'approved',
        'rejected',
        'revoked',
        'expired'
      )
    ),

  constraint profile_identity_verifications_note_check
    check (
      internal_note is null
      or char_length(internal_note) <= 2000
    ),

  constraint profile_identity_verifications_expiry_check
    check (
      expires_at is null
      or verified_at is null
      or expires_at > verified_at
    )
);

create table if not exists public.professional_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  scope_type text not null,
  category_id uuid
    references public.activity_categories(id)
    on delete restrict,
  activity_id uuid
    references public.activities(id)
    on delete restrict,
  requires_identity_verification boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid
    references public.profiles(id)
    on delete set null,
  updated_by uuid
    references public.profiles(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_roles_name_check
    check (
      char_length(btrim(name)) between 2 and 120
    ),

  constraint professional_roles_slug_check
    check (
      slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),

  constraint professional_roles_description_check
    check (
      description is null
      or char_length(description) <= 1000
    ),

  constraint professional_roles_scope_check
    check (
      (
        scope_type = 'category'
        and category_id is not null
        and activity_id is null
      )
      or
      (
        scope_type = 'activity'
        and category_id is not null
        and activity_id is not null
      )
    )
);

create unique index if not exists
  professional_roles_category_name_unique
on public.professional_roles (
  category_id,
  lower(name)
)
where scope_type = 'category';

create unique index if not exists
  professional_roles_activity_name_unique
on public.professional_roles (
  activity_id,
  lower(name)
)
where scope_type = 'activity';

create table if not exists public.professional_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  professional_role_id uuid not null
    references public.professional_roles(id)
    on delete restrict,
  professional_title text,
  credential_type text not null,
  issuer text not null,
  credential_number text,
  issued_at date,
  expires_at date,
  evidence_path text,
  application_note text,
  status text not null default 'pending',
  review_note text,
  reviewed_by uuid
    references public.profiles(id)
    on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_credentials_title_check
    check (
      professional_title is null
      or char_length(btrim(professional_title)) between 2 and 160
    ),

  constraint professional_credentials_type_check
    check (
      char_length(btrim(credential_type)) between 2 and 160
    ),

  constraint professional_credentials_issuer_check
    check (
      char_length(btrim(issuer)) between 2 and 200
    ),

  constraint professional_credentials_number_check
    check (
      credential_number is null
      or char_length(credential_number) <= 200
    ),

  constraint professional_credentials_evidence_check
    check (
      evidence_path is null
      or char_length(evidence_path) <= 1000
    ),

  constraint professional_credentials_notes_check
    check (
      (
        application_note is null
        or char_length(application_note) <= 2000
      )
      and (
        review_note is null
        or char_length(review_note) <= 2000
      )
    ),

  constraint professional_credentials_status_check
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'revoked',
        'expired',
        'withdrawn'
      )
    ),

  constraint professional_credentials_expiry_check
    check (
      expires_at is null
      or issued_at is null
      or expires_at > issued_at
    )
);

create unique index if not exists
  professional_credentials_open_application_unique
on public.professional_credentials (
  user_id,
  professional_role_id
)
where status in ('pending', 'approved');

alter table public.intents
  add column if not exists professional_requirement text not null default 'none',
  add column if not exists professional_role_id uuid
    references public.professional_roles(id)
    on delete set null,
  add column if not exists professional_preference_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intents_professional_requirement_check'
      and conrelid = 'public.intents'::regclass
  ) then
    alter table public.intents
      add constraint intents_professional_requirement_check
      check (
        professional_requirement in (
          'none',
          'preferred',
          'required'
        )
      );
  end if;
end;
$$;

create index if not exists
  intents_professional_requirement_idx
on public.intents (
  professional_requirement,
  professional_role_id
);

create index if not exists
  professional_credentials_lookup_idx
on public.professional_credentials (
  user_id,
  professional_role_id,
  status,
  expires_at
);

-- Legacy "professionals" values were previously descriptive only and had no
-- verified role contract. Normalize them before enforcing the new invariant.
update public.intents
set
  people = 'anyone',
  professional_requirement = 'none',
  professional_role_id = null,
  professional_preference_updated_at = now(),
  updated_at = now()
where people = 'professionals'
  and professional_requirement = 'none';

create or replace function public.validate_intent_professional_preference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.professional_requirement = 'none' then
    new.professional_role_id := null;

    if new.people = 'professionals' then
      new.people := 'anyone';
    end if;

    return new;
  end if;

  if new.professional_role_id is null then
    raise exception
      'A professional role is required when professional participation is preferred or required.'
      using errcode = '22023';
  end if;

  if not public.professional_role_applies_to_activity(
    new.professional_role_id,
    new.activity_id
  ) then
    raise exception
      'The selected professional role does not apply to this Activity.'
      using errcode = '22023';
  end if;

  new.people := 'professionals';
  new.professional_preference_updated_at := coalesce(
    new.professional_preference_updated_at,
    now()
  );

  return new;
end;
$$;

drop trigger if exists
  validate_intent_professional_preference_trigger
on public.intents;

create trigger
  validate_intent_professional_preference_trigger
before insert or update of
  activity_id,
  people,
  professional_requirement,
  professional_role_id
on public.intents
for each row
execute function public.validate_intent_professional_preference();

-- ============================================================
-- PRIVATE STORAGE FOR CREDENTIAL EVIDENCE
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'professional-credentials',
  'professional-credentials',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id)
do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists
  "Credential owners can upload evidence"
on storage.objects;

create policy
  "Credential owners can upload evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'professional-credentials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists
  "Credential owners and admins can read evidence"
on storage.objects;

create policy
  "Credential owners and admins can read evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'professional-credentials'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists
  "Credential owners can update evidence"
on storage.objects;

create policy
  "Credential owners can update evidence"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'professional-credentials'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'professional-credentials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists
  "Credential owners and admins can delete evidence"
on storage.objects;

create policy
  "Credential owners and admins can delete evidence"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'professional-credentials'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.profile_identity_verifications
  enable row level security;

alter table public.professional_roles
  enable row level security;

alter table public.professional_credentials
  enable row level security;

drop policy if exists
  "Active professional roles are visible"
on public.professional_roles;

create policy
  "Active professional roles are visible"
on public.professional_roles
for select
to authenticated
using (
  is_active = true
  or public.is_admin()
);

-- Identity and credential rows intentionally have no direct browser policies.
-- Users and admins access them through constrained RPC functions.

-- ============================================================
-- HELPERS
-- ============================================================

create or replace function public.is_identity_verified(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_identity_verifications verification
    where verification.user_id = p_user_id
      and verification.status = 'approved'
      and verification.verified_at is not null
      and verification.revoked_at is null
      and (
        verification.expires_at is null
        or verification.expires_at > now()
      )
  );
$$;

create or replace function public.professional_role_applies_to_activity(
  p_professional_role_id uuid,
  p_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professional_roles role_record
    join public.activities activity
      on activity.id = p_activity_id
    where role_record.id = p_professional_role_id
      and role_record.is_active = true
      and (
        (
          role_record.scope_type = 'activity'
          and role_record.activity_id = activity.id
        )
        or
        (
          role_record.scope_type = 'category'
          and role_record.category_id = activity.category_id
        )
      )
  );
$$;

create or replace function public.has_verified_professional_role(
  p_user_id uuid,
  p_professional_role_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professional_credentials credential
    join public.professional_roles role_record
      on role_record.id = credential.professional_role_id
    where credential.user_id = p_user_id
      and credential.professional_role_id = p_professional_role_id
      and credential.status = 'approved'
      and credential.approved_at is not null
      and credential.revoked_at is null
      and (
        credential.expires_at is null
        or credential.expires_at >= current_date
      )
      and role_record.is_active = true
      and (
        role_record.requires_identity_verification = false
        or public.is_identity_verified(p_user_id)
      )
  );
$$;

create or replace function public.user_matches_intent_professional_preference(
  p_intent_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_activity_id uuid;
begin
  if p_user_id is null then
    return false;
  end if;

  select
    intent.professional_role_id,
    intent.activity_id
  into
    v_role_id,
    v_activity_id
  from public.intents intent
  where intent.id = p_intent_id;

  if not found then
    return false;
  end if;

  if v_role_id is not null then
    return public.has_verified_professional_role(
      p_user_id,
      v_role_id
    );
  end if;

  return exists (
    select 1
    from public.professional_credentials credential
    join public.professional_roles role_record
      on role_record.id = credential.professional_role_id
    where credential.user_id = p_user_id
      and credential.status = 'approved'
      and credential.revoked_at is null
      and (
        credential.expires_at is null
        or credential.expires_at >= current_date
      )
      and public.professional_role_applies_to_activity(
        role_record.id,
        v_activity_id
      )
      and (
        role_record.requires_identity_verification = false
        or public.is_identity_verified(p_user_id)
      )
  );
end;
$$;

create or replace function public.user_satisfies_intent_professional_requirement(
  p_intent_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_requirement text;
  v_role_id uuid;
  v_activity_id uuid;
begin
  if p_user_id is null then
    return false;
  end if;

  select
    intent.professional_requirement,
    intent.professional_role_id,
    intent.activity_id
  into
    v_requirement,
    v_role_id,
    v_activity_id
  from public.intents intent
  where intent.id = p_intent_id;

  if not found then
    return false;
  end if;

  if v_requirement in ('none', 'preferred') then
    return true;
  end if;

  if v_role_id is not null then
    return public.has_verified_professional_role(
      p_user_id,
      v_role_id
    );
  end if;

  return exists (
    select 1
    from public.professional_credentials credential
    join public.professional_roles role_record
      on role_record.id = credential.professional_role_id
    where credential.user_id = p_user_id
      and credential.status = 'approved'
      and credential.revoked_at is null
      and (
        credential.expires_at is null
        or credential.expires_at >= current_date
      )
      and public.professional_role_applies_to_activity(
        role_record.id,
        v_activity_id
      )
      and (
        role_record.requires_identity_verification = false
        or public.is_identity_verified(p_user_id)
      )
  );
end;
$$;

create or replace function public.get_professional_roles_for_activity(
  p_activity_id uuid
)
returns table (
  role_id uuid,
  role_name text,
  role_description text,
  scope_type text,
  category_id uuid,
  activity_id uuid,
  requires_identity_verification boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    role_record.id,
    role_record.name,
    role_record.description,
    role_record.scope_type,
    role_record.category_id,
    role_record.activity_id,
    role_record.requires_identity_verification
  from public.professional_roles role_record
  join public.activities activity
    on activity.id = p_activity_id
  where role_record.is_active = true
    and (
      (
        role_record.scope_type = 'activity'
        and role_record.activity_id = activity.id
      )
      or
      (
        role_record.scope_type = 'category'
        and role_record.category_id = activity.category_id
      )
    )
  order by
    case when role_record.scope_type = 'activity' then 0 else 1 end,
    role_record.sort_order,
    role_record.name;
$$;

create or replace function public.set_my_intent_professional_preference(
  p_intent_id uuid,
  p_requirement text,
  p_professional_role_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_requirement text;
  v_activity_id uuid;
  v_status text;
  v_plan_linked boolean;
begin
  v_user_id := auth.uid();
  v_requirement := lower(btrim(coalesce(p_requirement, 'none')));

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_requirement not in ('none', 'preferred', 'required') then
    raise exception 'Unsupported professional requirement.' using errcode = '22023';
  end if;

  select
    intent.activity_id,
    intent.status,
    exists (
      select 1
      from public.plan_intents plan_intent
      where plan_intent.intent_id = intent.id
        and plan_intent.status = 'active'
    )
  into
    v_activity_id,
    v_status,
    v_plan_linked
  from public.intents intent
  where intent.id = p_intent_id
    and intent.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Intent not found.' using errcode = 'P0002';
  end if;

  if v_status <> 'active' or v_plan_linked then
    raise exception 'Professional preference can only be changed before a shared Plan is formed.' using errcode = '22023';
  end if;

  if v_requirement = 'none' then
    p_professional_role_id := null;
  else
    if p_professional_role_id is null then
      raise exception 'Select a professional role.' using errcode = '22023';
    end if;

    if not public.professional_role_applies_to_activity(
      p_professional_role_id,
      v_activity_id
    ) then
      raise exception 'The selected professional role does not apply to this Activity.' using errcode = '22023';
    end if;
  end if;

  update public.intents
  set
    people = case
      when v_requirement = 'none' and people = 'professionals'
        then 'anyone'
      when v_requirement <> 'none'
        then 'professionals'
      else people
    end,
    professional_requirement = v_requirement,
    professional_role_id = p_professional_role_id,
    professional_preference_updated_at = now(),
    updated_at = now()
  where id = p_intent_id;
end;
$$;

create or replace function public.validate_intent_participant_professional_requirement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner_user_id uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select intent.user_id
  into v_owner_user_id
  from public.intents intent
  where intent.id = new.intent_id;

  if v_owner_user_id is null then
    raise exception 'Intent not found.' using errcode = 'P0002';
  end if;

  if new.user_id = v_owner_user_id then
    return new;
  end if;

  if not public.user_satisfies_intent_professional_requirement(
    new.intent_id,
    new.user_id
  ) then
    raise exception
      'This Intent requires the selected verified professional credential.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists
  validate_intent_participant_professional_requirement_trigger
on public.intent_participants;

create trigger
  validate_intent_participant_professional_requirement_trigger
before insert or update of
  user_id,
  status
on public.intent_participants
for each row
execute function public.validate_intent_participant_professional_requirement();

-- ============================================================
-- JOIN ELIGIBILITY + MATCH ENGINE
-- ============================================================

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
    return public.are_users_friends(v_owner_user_id, p_viewer_user_id);
  end if;

  if v_visibility = 'except_friends' then
    return not public.are_users_friends(v_owner_user_id, p_viewer_user_id);
  end if;

  return false;
end;
$function$;

create or replace function public.get_my_active_matches()
returns table(
  own_intent_id uuid,
  own_start_date date,
  own_end_date date,
  target_intent_id uuid,
  target_user_id uuid,
  target_full_name text,
  target_username text,
  target_avatar_url text,
  activity_name text,
  category_name text,
  city text,
  district text,
  target_start_date date,
  target_end_date date,
  target_people text,
  target_budget numeric,
  target_recurrence text,
  target_visibility text,
  target_notes text,
  target_max_participants integer,
  target_created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    own_intent.id,
    own_intent.start_date,
    own_intent.end_date,
    target_intent.id,
    target_intent.user_id,
    target_profile.full_name,
    target_profile.username,
    target_profile.avatar_url,
    activity.name,
    category.name,
    coalesce(location.city, location.country_name),
    location.district,
    target_intent.start_date,
    target_intent.end_date,
    target_intent.people,
    target_intent.budget,
    target_intent.recurrence,
    target_intent.visibility,
    target_intent.notes,
    target_intent.max_participants,
    target_intent.created_at
  from public.intents own_intent
  join public.intents target_intent
    on target_intent.user_id <> own_intent.user_id
    and target_intent.activity_id = own_intent.activity_id
    and public.locations_overlap(
      target_intent.location_id,
      own_intent.location_id
    )
    and target_intent.start_date <= own_intent.end_date
    and own_intent.start_date <= target_intent.end_date
  join public.activities activity
    on activity.id = target_intent.activity_id
  join public.activity_categories category
    on category.id = activity.category_id
  join public.locations location
    on location.id = target_intent.location_id
  join public.profiles target_profile
    on target_profile.id = target_intent.user_id
  where own_intent.user_id = auth.uid()
    and own_intent.status = 'active'
    and own_intent.recruitment_status = 'open'
    and own_intent.matching_status = 'open'
    and own_intent.end_date >= current_date
    and own_intent.expired_at is null
    and own_intent.archived_at is null
    and target_intent.status = 'active'
    and target_intent.recruitment_status = 'open'
    and target_intent.matching_status = 'open'
    and target_intent.end_date >= current_date
    and target_intent.expired_at is null
    and target_intent.archived_at is null
    and public.can_user_view_intent_activity(
      target_intent.id,
      auth.uid()
    )
    and public.user_satisfies_intent_professional_requirement(
      own_intent.id,
      target_intent.user_id
    )
    and public.user_satisfies_intent_professional_requirement(
      target_intent.id,
      auth.uid()
    )
    and not exists (
      select 1
      from public.intent_match_ignores ignored_match
      where ignored_match.user_id = auth.uid()
        and ignored_match.own_intent_id = own_intent.id
        and ignored_match.target_intent_id = target_intent.id
    )
    and not exists (
      select 1
      from public.intent_requests request
      where (
        request.own_intent_id = own_intent.id
        and request.target_intent_id = target_intent.id
      )
      or (
        request.own_intent_id = target_intent.id
        and request.target_intent_id = own_intent.id
      )
    )
    and not exists (
      select 1
      from public.plan_intents own_link
      join public.plan_intents target_link
        on target_link.plan_id = own_link.plan_id
      where own_link.intent_id = own_intent.id
        and target_link.intent_id = target_intent.id
        and own_link.status = 'active'
        and target_link.status = 'active'
    )
  order by
    case
      when own_intent.professional_requirement = 'preferred'
        and public.user_matches_intent_professional_preference(
          own_intent.id,
          target_intent.user_id
        )
        then 0
      when target_intent.professional_requirement = 'preferred'
        and public.user_matches_intent_professional_preference(
          target_intent.id,
          auth.uid()
        )
        then 1
      else 2
    end,
    greatest(
      own_intent.start_date,
      target_intent.start_date
    ),
    target_intent.created_at desc,
    target_intent.id;
$function$;

create or replace function public.get_visible_intent_professional_requirement(
  p_resource_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_intent_id uuid;
begin
  select candidate.intent_id
  into v_intent_id
  from (
    select
      intent.id as intent_id,
      0 as priority
    from public.intents intent
    where intent.id = p_resource_id

    union all

    select
      plan_intent.intent_id,
      case
        when plan_intent.relationship = 'host_source' then 1
        else 2
      end
    from public.plan_intents plan_intent
    where plan_intent.plan_id = p_resource_id
      and plan_intent.status = 'active'
  ) candidate
  order by candidate.priority
  limit 1;

  if v_intent_id is null then
    return null;
  end if;

  if not public.can_user_view_intent_activity(
    v_intent_id,
    auth.uid()
  ) then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'intent_id', intent.id,
      'requirement', intent.professional_requirement,
      'role_id', role_record.id,
      'role_name', role_record.name,
      'scope_type', role_record.scope_type,
      'category_name', category.name,
      'activity_name', role_activity.name
    )
    from public.intents intent
    left join public.professional_roles role_record
      on role_record.id = intent.professional_role_id
    left join public.activity_categories category
      on category.id = role_record.category_id
    left join public.activities role_activity
      on role_activity.id = role_record.activity_id
    where intent.id = v_intent_id
      and intent.professional_requirement in (
        'preferred',
        'required'
      )
  );
end;
$$;

-- ============================================================
-- USER PROFESSIONAL PROFILE
-- ============================================================

create or replace function public.get_my_professional_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'identity',
    coalesce(
      (
        select jsonb_build_object(
          'status', verification.status,
          'verified_at', verification.verified_at,
          'expires_at', verification.expires_at
        )
        from public.profile_identity_verifications verification
        where verification.user_id = v_user_id
      ),
      jsonb_build_object(
        'status', 'unverified',
        'verified_at', null,
        'expires_at', null
      )
    ),
    'roles',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', role_record.id,
            'name', role_record.name,
            'description', role_record.description,
            'scope_type', role_record.scope_type,
            'category_id', role_record.category_id,
            'category_name', category.name,
            'activity_id', role_record.activity_id,
            'activity_name', activity.name,
            'requires_identity_verification', role_record.requires_identity_verification
          )
          order by
            category.name,
            activity.name nulls first,
            role_record.sort_order,
            role_record.name
        )
        from public.professional_roles role_record
        join public.activity_categories category
          on category.id = role_record.category_id
        left join public.activities activity
          on activity.id = role_record.activity_id
        where role_record.is_active = true
      ),
      '[]'::jsonb
    ),
    'credentials',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', credential.id,
            'professional_role_id', credential.professional_role_id,
            'role_name', role_record.name,
            'category_name', category.name,
            'activity_name', activity.name,
            'professional_title', credential.professional_title,
            'credential_type', credential.credential_type,
            'issuer', credential.issuer,
            'credential_number', credential.credential_number,
            'issued_at', credential.issued_at,
            'expires_at', credential.expires_at,
            'evidence_path', credential.evidence_path,
            'status', credential.status,
            'review_note', credential.review_note,
            'approved_at', credential.approved_at,
            'created_at', credential.created_at
          )
          order by credential.created_at desc
        )
        from public.professional_credentials credential
        join public.professional_roles role_record
          on role_record.id = credential.professional_role_id
        join public.activity_categories category
          on category.id = role_record.category_id
        left join public.activities activity
          on activity.id = role_record.activity_id
        where credential.user_id = v_user_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.submit_professional_credential_application(
  p_professional_role_id uuid,
  p_professional_title text,
  p_credential_type text,
  p_issuer text,
  p_credential_number text,
  p_issued_at date,
  p_expires_at date,
  p_evidence_path text,
  p_application_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_id uuid;
  v_title text;
  v_type text;
  v_issuer text;
  v_number text;
  v_note text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.profile_age_records age_record
    where age_record.user_id = v_user_id
      and age_record.account_type = 'managed_minor'
      and age_record.adult_transition_completed_at is null
  ) then
    raise exception
      'Managed minor profiles cannot submit professional credentials.'
      using errcode = '42501';
  end if;

  if p_evidence_path is not null
    and btrim(p_evidence_path) <> ''
    and split_part(btrim(p_evidence_path), '/', 1) <> v_user_id::text
  then
    raise exception
      'Credential evidence must belong to the signed-in profile.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.professional_roles role_record
    where role_record.id = p_professional_role_id
      and role_record.is_active = true
  ) then
    raise exception 'Professional role is unavailable.' using errcode = 'P0002';
  end if;

  v_title := nullif(btrim(coalesce(p_professional_title, '')), '');
  v_type := btrim(coalesce(p_credential_type, ''));
  v_issuer := btrim(coalesce(p_issuer, ''));
  v_number := nullif(btrim(coalesce(p_credential_number, '')), '');
  v_note := nullif(btrim(coalesce(p_application_note, '')), '');

  if char_length(v_type) < 2 then
    raise exception 'Credential type is required.' using errcode = '22023';
  end if;

  if char_length(v_issuer) < 2 then
    raise exception 'Credential issuer is required.' using errcode = '22023';
  end if;

  if p_expires_at is not null
    and p_issued_at is not null
    and p_expires_at <= p_issued_at
  then
    raise exception 'Expiry date must be after issue date.' using errcode = '22023';
  end if;

  insert into public.professional_credentials (
    user_id,
    professional_role_id,
    professional_title,
    credential_type,
    issuer,
    credential_number,
    issued_at,
    expires_at,
    evidence_path,
    application_note,
    status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_professional_role_id,
    v_title,
    v_type,
    v_issuer,
    v_number,
    p_issued_at,
    p_expires_at,
    nullif(btrim(coalesce(p_evidence_path, '')), ''),
    v_note,
    'pending',
    now(),
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.withdraw_my_professional_credential(
  p_credential_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.professional_credentials
  set
    status = 'withdrawn',
    updated_at = now()
  where id = p_credential_id
    and user_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Pending credential application not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.get_public_profile_professional_status(
  p_username text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_minor boolean;
begin
  select profile.id
  into v_user_id
  from public.profiles profile
  where lower(profile.username) = lower(btrim(p_username))
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  v_is_minor := exists (
    select 1
    from public.profile_age_records age_record
    where age_record.user_id = v_user_id
      and age_record.account_type = 'managed_minor'
      and age_record.adult_transition_completed_at is null
  );

  if v_is_minor then
    return jsonb_build_object(
      'identity_verified', false,
      'credentials', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'identity_verified', public.is_identity_verified(v_user_id),
    'credentials',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', credential.id,
            'role_name', role_record.name,
            'professional_title', credential.professional_title,
            'category_name', category.name,
            'activity_name', activity.name,
            'issuer', credential.issuer,
            'approved_at', credential.approved_at,
            'expires_at', credential.expires_at,
            'scope_type', role_record.scope_type
          )
          order by
            case when role_record.scope_type = 'activity' then 0 else 1 end,
            category.name,
            activity.name nulls first,
            role_record.name
        )
        from public.professional_credentials credential
        join public.professional_roles role_record
          on role_record.id = credential.professional_role_id
        join public.activity_categories category
          on category.id = role_record.category_id
        left join public.activities activity
          on activity.id = role_record.activity_id
        where credential.user_id = v_user_id
          and credential.status = 'approved'
          and credential.revoked_at is null
          and (
            credential.expires_at is null
            or credential.expires_at >= current_date
          )
          and role_record.is_active = true
          and (
            role_record.requires_identity_verification = false
            or public.is_identity_verified(v_user_id)
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ============================================================
-- ADMIN FUNCTIONS
-- ============================================================

create or replace function public.get_admin_professional_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', category.id,
            'name', category.name
          )
          order by category.name
        )
        from public.activity_categories category
        where category.is_active = true
      ),
      '[]'::jsonb
    ),
    'activities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', activity.id,
            'name', activity.name,
            'category_id', activity.category_id
          )
          order by activity.name
        )
        from public.activities activity
        where activity.is_active = true
      ),
      '[]'::jsonb
    ),
    'roles',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', role_record.id,
            'name', role_record.name,
            'slug', role_record.slug,
            'description', role_record.description,
            'scope_type', role_record.scope_type,
            'category_id', role_record.category_id,
            'category_name', category.name,
            'activity_id', role_record.activity_id,
            'activity_name', activity.name,
            'requires_identity_verification', role_record.requires_identity_verification,
            'is_active', role_record.is_active,
            'sort_order', role_record.sort_order
          )
          order by
            role_record.is_active desc,
            category.name,
            activity.name nulls first,
            role_record.sort_order,
            role_record.name
        )
        from public.professional_roles role_record
        join public.activity_categories category
          on category.id = role_record.category_id
        left join public.activities activity
          on activity.id = role_record.activity_id
      ),
      '[]'::jsonb
    ),
    'credentials',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', credential.id,
            'user_id', credential.user_id,
            'full_name', profile.full_name,
            'username', profile.username,
            'email', profile.email,
            'professional_role_id', credential.professional_role_id,
            'role_name', role_record.name,
            'category_name', category.name,
            'activity_name', activity.name,
            'professional_title', credential.professional_title,
            'credential_type', credential.credential_type,
            'issuer', credential.issuer,
            'credential_number', credential.credential_number,
            'issued_at', credential.issued_at,
            'expires_at', credential.expires_at,
            'evidence_path', credential.evidence_path,
            'application_note', credential.application_note,
            'status', credential.status,
            'review_note', credential.review_note,
            'created_at', credential.created_at,
            'reviewed_at', credential.reviewed_at
          )
          order by
            case credential.status
              when 'pending' then 0
              when 'approved' then 1
              else 2
            end,
            credential.created_at desc
        )
        from public.professional_credentials credential
        join public.profiles profile
          on profile.id = credential.user_id
        join public.professional_roles role_record
          on role_record.id = credential.professional_role_id
        join public.activity_categories category
          on category.id = role_record.category_id
        left join public.activities activity
          on activity.id = role_record.activity_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.admin_create_professional_role(
  p_name text,
  p_slug text,
  p_description text,
  p_scope_type text,
  p_category_id uuid,
  p_activity_id uuid,
  p_requires_identity_verification boolean,
  p_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_scope text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  v_scope := lower(btrim(coalesce(p_scope_type, '')));

  if v_scope not in ('category', 'activity') then
    raise exception 'Professional role scope must be category or activity.' using errcode = '22023';
  end if;

  if v_scope = 'category' then
    p_activity_id := null;
  else
    if not exists (
      select 1
      from public.activities activity
      where activity.id = p_activity_id
        and activity.category_id = p_category_id
    ) then
      raise exception 'Activity does not belong to the selected category.' using errcode = '22023';
    end if;
  end if;

  insert into public.professional_roles (
    name,
    slug,
    description,
    scope_type,
    category_id,
    activity_id,
    requires_identity_verification,
    is_active,
    sort_order,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    btrim(p_name),
    lower(btrim(p_slug)),
    nullif(btrim(coalesce(p_description, '')), ''),
    v_scope,
    p_category_id,
    p_activity_id,
    coalesce(p_requires_identity_verification, true),
    true,
    coalesce(p_sort_order, 100),
    auth.uid(),
    auth.uid(),
    now(),
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_update_professional_role(
  p_role_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_scope_type text,
  p_category_id uuid,
  p_activity_id uuid,
  p_requires_identity_verification boolean,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  v_scope := lower(btrim(coalesce(p_scope_type, '')));

  if v_scope not in ('category', 'activity') then
    raise exception 'Professional role scope must be category or activity.' using errcode = '22023';
  end if;

  if v_scope = 'category' then
    p_activity_id := null;
  else
    if not exists (
      select 1
      from public.activities activity
      where activity.id = p_activity_id
        and activity.category_id = p_category_id
    ) then
      raise exception 'Activity does not belong to the selected category.' using errcode = '22023';
    end if;
  end if;

  update public.professional_roles
  set
    name = btrim(p_name),
    slug = lower(btrim(p_slug)),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    scope_type = v_scope,
    category_id = p_category_id,
    activity_id = p_activity_id,
    requires_identity_verification = coalesce(p_requires_identity_verification, true),
    sort_order = coalesce(p_sort_order, 100),
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_role_id;

  if not found then
    raise exception 'Professional role not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_professional_role_active(
  p_role_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  update public.professional_roles
  set
    is_active = p_is_active,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_role_id;

  if not found then
    raise exception 'Professional role not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_search_professional_people(
  p_query text
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  email text,
  avatar_url text,
  identity_status text,
  identity_verified_at timestamptz,
  identity_expires_at timestamptz,
  approved_credential_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  v_query := lower(btrim(coalesce(p_query, '')));

  if char_length(v_query) < 2 then
    raise exception 'Enter at least two characters.' using errcode = '22023';
  end if;

  return query
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.email,
    profile.avatar_url,
    coalesce(verification.status, 'unverified'),
    verification.verified_at,
    verification.expires_at,
    (
      select count(*)::integer
      from public.professional_credentials credential
      where credential.user_id = profile.id
        and credential.status = 'approved'
        and credential.revoked_at is null
        and (
          credential.expires_at is null
          or credential.expires_at >= current_date
        )
    )
  from public.profiles profile
  left join public.profile_identity_verifications verification
    on verification.user_id = profile.id
  where lower(coalesce(profile.full_name, '')) like '%' || v_query || '%'
    or lower(profile.username) like '%' || v_query || '%'
    or lower(coalesce(profile.email, '')) like '%' || v_query || '%'
  order by profile.full_name nulls last, profile.username
  limit 30;
end;
$$;

create or replace function public.admin_set_identity_verification(
  p_user_id uuid,
  p_status text,
  p_verification_method text,
  p_expires_at timestamptz,
  p_internal_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  v_status := lower(btrim(coalesce(p_status, '')));

  if v_status not in ('pending', 'approved', 'rejected', 'revoked', 'unverified') then
    raise exception 'Unsupported identity verification status.' using errcode = '22023';
  end if;

  insert into public.profile_identity_verifications (
    user_id,
    status,
    verification_method,
    verified_by,
    verified_at,
    expires_at,
    revoked_at,
    internal_note,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_status,
    nullif(btrim(coalesce(p_verification_method, '')), ''),
    case when v_status = 'approved' then auth.uid() else null end,
    case when v_status = 'approved' then now() else null end,
    case when v_status = 'approved' then p_expires_at else null end,
    case when v_status = 'revoked' then now() else null end,
    nullif(btrim(coalesce(p_internal_note, '')), ''),
    now(),
    now()
  )
  on conflict (user_id)
  do update
  set
    status = excluded.status,
    verification_method = excluded.verification_method,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    expires_at = excluded.expires_at,
    revoked_at = excluded.revoked_at,
    internal_note = excluded.internal_note,
    updated_at = now();
end;
$$;

create or replace function public.admin_review_professional_credential(
  p_credential_id uuid,
  p_decision text,
  p_review_note text,
  p_expires_at date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision text;
  v_user_id uuid;
  v_requires_identity boolean;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  v_decision := lower(btrim(coalesce(p_decision, '')));

  if v_decision not in ('approved', 'rejected', 'revoked') then
    raise exception 'Unsupported credential review decision.' using errcode = '22023';
  end if;

  select
    credential.user_id,
    role_record.requires_identity_verification
  into
    v_user_id,
    v_requires_identity
  from public.professional_credentials credential
  join public.professional_roles role_record
    on role_record.id = credential.professional_role_id
  where credential.id = p_credential_id
  for update;

  if not found then
    raise exception 'Credential application not found.' using errcode = 'P0002';
  end if;

  if v_decision = 'approved'
    and v_requires_identity
    and not public.is_identity_verified(v_user_id)
  then
    raise exception 'Verify the person identity before approving this professional credential.' using errcode = '22023';
  end if;

  update public.professional_credentials
  set
    status = v_decision,
    review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    approved_at = case
      when v_decision = 'approved' then now()
      else approved_at
    end,
    revoked_at = case
      when v_decision = 'revoked' then now()
      else null
    end,
    expires_at = case
      when v_decision = 'approved' then coalesce(p_expires_at, expires_at)
      else expires_at
    end,
    updated_at = now()
  where id = p_credential_id;
end;
$$;

-- ============================================================
-- DEFAULT PROFESSIONAL ROLES
-- ============================================================

insert into public.professional_roles (
  name,
  slug,
  description,
  scope_type,
  category_id,
  activity_id,
  requires_identity_verification,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  'Basketball Coach',
  'basketball-coach',
  'A verified coach for Basketball training, instruction or guided play.',
  'activity',
  category.id,
  activity.id,
  true,
  true,
  10,
  now(),
  now()
from public.activities activity
join public.activity_categories category
  on category.id = activity.category_id
where lower(activity.name) = 'basketball'
on conflict (slug) do nothing;

insert into public.professional_roles (
  name,
  slug,
  description,
  scope_type,
  category_id,
  activity_id,
  requires_identity_verification,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  'Basketball Referee',
  'basketball-referee',
  'A verified referee for organised Basketball play.',
  'activity',
  category.id,
  activity.id,
  true,
  true,
  20,
  now(),
  now()
from public.activities activity
join public.activity_categories category
  on category.id = activity.category_id
where lower(activity.name) = 'basketball'
on conflict (slug) do nothing;

insert into public.professional_roles (
  name,
  slug,
  description,
  scope_type,
  category_id,
  activity_id,
  requires_identity_verification,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  'Drama Instructor',
  'drama-instructor',
  'A verified professional who teaches or facilitates Drama Activities.',
  'category',
  category.id,
  null,
  true,
  true,
  10,
  now(),
  now()
from public.activity_categories category
where lower(category.name) like '%culture%'
   or lower(category.name) like '%art%'
limit 1
on conflict (slug) do nothing;

-- ============================================================
-- PERMISSIONS
-- ============================================================

grant execute on function public.is_identity_verified(uuid) to authenticated;
grant execute on function public.professional_role_applies_to_activity(uuid, uuid) to authenticated;
grant execute on function public.has_verified_professional_role(uuid, uuid) to authenticated;
grant execute on function public.user_matches_intent_professional_preference(uuid, uuid) to authenticated;
grant execute on function public.user_satisfies_intent_professional_requirement(uuid, uuid) to authenticated;
grant execute on function public.get_professional_roles_for_activity(uuid) to authenticated;
grant execute on function public.set_my_intent_professional_preference(uuid, text, uuid) to authenticated;
grant execute on function public.get_visible_intent_professional_requirement(uuid) to anon, authenticated;
grant execute on function public.get_my_professional_profile() to authenticated;
grant execute on function public.submit_professional_credential_application(uuid, text, text, text, text, date, date, text, text) to authenticated;
grant execute on function public.withdraw_my_professional_credential(uuid) to authenticated;
grant execute on function public.get_public_profile_professional_status(text) to anon, authenticated;
grant execute on function public.get_admin_professional_catalogue() to authenticated;
grant execute on function public.admin_create_professional_role(text, text, text, text, uuid, uuid, boolean, integer) to authenticated;
grant execute on function public.admin_update_professional_role(uuid, text, text, text, text, uuid, uuid, boolean, integer) to authenticated;
grant execute on function public.admin_set_professional_role_active(uuid, boolean) to authenticated;
grant execute on function public.admin_search_professional_people(text) to authenticated;
grant execute on function public.admin_set_identity_verification(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.admin_review_professional_credential(uuid, text, text, date) to authenticated;

commit;
