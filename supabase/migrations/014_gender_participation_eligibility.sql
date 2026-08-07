-- 014_gender_participation_eligibility.sql
-- Adds optional profile gender settings and enforceable Intent participation eligibility.

begin;

alter table public.profiles
  add column if not exists gender text,
  add column if not exists show_gender boolean not null default false;

update public.profiles
set show_gender = false
where gender is null
   or gender = 'prefer_not_to_say';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (
        gender is null
        or gender in (
          'female',
          'male',
          'non_binary',
          'prefer_not_to_say'
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_show_gender_requires_visible_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_show_gender_requires_visible_gender_check
      check (
        not show_gender
        or gender in ('female', 'male', 'non_binary')
      );
  end if;
end;
$$;

alter table public.intents
  add column if not exists participant_eligibility text not null default 'everyone';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'intents_participant_eligibility_check'
      and conrelid = 'public.intents'::regclass
  ) then
    alter table public.intents
      add constraint intents_participant_eligibility_check
      check (
        participant_eligibility in (
          'everyone',
          'women_only',
          'men_only'
        )
      );
  end if;
end;
$$;

create index if not exists intents_participant_eligibility_idx
  on public.intents(participant_eligibility);

comment on column public.profiles.gender is
  'Optional participation gender: female, male, non_binary or prefer_not_to_say.';
comment on column public.profiles.show_gender is
  'Whether an eligible gender value may be shown on the public profile.';
comment on column public.intents.participant_eligibility is
  'Who may participate: everyone, women_only or men_only.';

create or replace function public.gender_matches_participant_eligibility(
  p_gender text,
  p_eligibility text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_eligibility, 'everyone') = 'everyone' then true
    when p_eligibility = 'women_only' then p_gender = 'female'
    when p_eligibility = 'men_only' then p_gender = 'male'
    else false
  end;
$$;

create or replace function public.user_is_eligible_for_intent(
  p_intent_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.gender_matches_participant_eligibility(
        profile.gender,
        intent.participant_eligibility
      )
      from public.intents intent
      left join public.profiles profile
        on profile.id = p_user_id
      where intent.id = p_intent_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.user_is_eligible_for_plan_intents(
  p_plan_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and not exists (
      select 1
      from public.plan_intents link
      where link.plan_id = p_plan_id
        and link.status = 'active'
        and not public.user_is_eligible_for_intent(
          link.intent_id,
          p_user_id
        )
    );
$$;

create or replace function public.can_current_user_invite_user_to_intent(
  p_intent_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and p_user_id is not null
    and exists (
      select 1
      from public.intents intent
      where intent.id = p_intent_id
        and (
          intent.user_id = auth.uid()
          or exists (
            select 1
            from public.plan_intents link
            join public.plans plan
              on plan.id = link.plan_id
            where link.intent_id = intent.id
              and link.status = 'active'
              and (
                plan.host_user_id = auth.uid()
                or exists (
                  select 1
                  from public.plan_members member
                  where member.plan_id = plan.id
                    and member.user_id = auth.uid()
                    and member.status = 'active'
                    and member.role in ('host', 'co_host')
                )
              )
          )
        )
    )
    and public.user_is_eligible_for_intent(
      p_intent_id,
      p_user_id
    );
$$;

create or replace function public.can_current_user_assign_plan_lead(
  p_plan_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and p_user_id is not null
    and exists (
      select 1
      from public.plans plan
      where plan.id = p_plan_id
        and (
          plan.host_user_id = auth.uid()
          or exists (
            select 1
            from public.plan_members member
            where member.plan_id = plan.id
              and member.user_id = auth.uid()
              and member.status = 'active'
              and member.role in ('host', 'co_host')
          )
        )
    )
    and public.user_is_eligible_for_plan_intents(
      p_plan_id,
      p_user_id
    );
$$;

create or replace function public.get_visible_intent_participant_eligibility(
  p_intent_ids uuid[]
)
returns table(
  intent_id uuid,
  participant_eligibility text,
  viewer_is_eligible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    intent.id,
    intent.participant_eligibility,
    case
      when auth.uid() is null then true
      else public.user_is_eligible_for_intent(
        intent.id,
        auth.uid()
      )
    end
  from public.intents intent
  where intent.id = any(
    coalesce(
      p_intent_ids,
      array[]::uuid[]
    )
  )
    and public.can_user_view_intent_activity(
      intent.id,
      auth.uid()
    )
  order by array_position(
    p_intent_ids,
    intent.id
  );
$$;

create or replace function public.update_my_gender_settings(
  p_gender text,
  p_show_gender boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_show_gender boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_gender is not null
     and p_gender not in (
       'female',
       'male',
       'non_binary',
       'prefer_not_to_say'
     ) then
    raise exception 'Unsupported gender value.' using errcode = '22023';
  end if;

  v_show_gender :=
    coalesce(p_show_gender, false)
    and p_gender is not null
    and p_gender <> 'prefer_not_to_say';

  update public.profiles
  set
    gender = p_gender,
    show_gender = v_show_gender,
    updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return v_user_id;
end;
$$;

create or replace function public.update_my_profile_with_gender(
  p_full_name text,
  p_username text,
  p_bio text,
  p_city text,
  p_country text,
  p_avatar_url text,
  p_cover_url text,
  p_gender text,
  p_show_gender boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  execute $update_profile$
    select public.update_my_profile(
      p_full_name => $1,
      p_username => $2,
      p_bio => $3,
      p_city => $4,
      p_country => $5,
      p_avatar_url => $6,
      p_cover_url => $7
    )
  $update_profile$
  using
    p_full_name,
    p_username,
    p_bio,
    p_city,
    p_country,
    p_avatar_url,
    p_cover_url;

  perform public.update_my_gender_settings(
    p_gender,
    p_show_gender
  );

  return v_user_id;
end;
$$;

create or replace function public.get_public_profile_gender(
  p_username text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when profile.show_gender
      and profile.gender in ('female', 'male', 'non_binary')
      then profile.gender
    else null
  end
  from public.profiles profile
  where lower(profile.username) = lower(btrim(p_username))
  limit 1;
$$;

create or replace function public.create_my_intent_with_communities_and_eligibility(
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
  if p_participant_eligibility not in (
    'everyone',
    'women_only',
    'men_only'
  ) then
    raise exception 'Unsupported participant eligibility.' using errcode = '22023';
  end if;

  -- Dynamic invocation keeps this migration compatible with the current
  -- sport-enabled create RPC while preserving one database transaction.
  execute $create_intent$
    select public.create_my_intent_with_communities(
      p_start_date => $1,
      p_end_date => $2,
      p_people => $3,
      p_location_id => $4,
      p_activity_id => $5,
      p_sport_id => $6,
      p_budget => $7,
      p_recurrence => $8,
      p_visibility => $9,
      p_notes => $10,
      p_intent_type => $11,
      p_max_participants => $12,
      p_community_ids => $13,
      p_professional_requirement => $14,
      p_professional_role_id => $15
    )
  $create_intent$
  into v_intent_id
  using
    p_start_date,
    p_end_date,
    p_people,
    p_location_id,
    p_activity_id,
    p_sport_id,
    p_budget,
    p_recurrence,
    p_visibility,
    p_notes,
    p_intent_type,
    p_max_participants,
    p_community_ids,
    p_professional_requirement,
    p_professional_role_id;

  update public.intents
  set
    participant_eligibility = p_participant_eligibility,
    updated_at = now()
  where id = v_intent_id
    and user_id = auth.uid();

  if not found then
    raise exception 'The created Intent could not be updated.' using errcode = 'P0002';
  end if;

  return v_intent_id;
end;
$$;

create or replace function public.set_my_intent_participant_eligibility(
  p_intent_id uuid,
  p_participant_eligibility text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_participant_eligibility not in (
    'everyone',
    'women_only',
    'men_only'
  ) then
    raise exception 'Unsupported participant eligibility.' using errcode = '22023';
  end if;

  update public.intents
  set
    participant_eligibility = p_participant_eligibility,
    updated_at = now()
  where id = p_intent_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Intent not found or not owned by the current user.' using errcode = '42501';
  end if;

  return p_intent_id;
end;
$$;

create or replace function public.validate_intent_owner_participant_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gender_matches_participant_eligibility(
    (select profile.gender from public.profiles profile where profile.id = new.user_id),
    new.participant_eligibility
  ) then
    raise exception
      'Only a woman can create a women-only Intent, and only a man can create a men-only Intent.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and new.participant_eligibility is distinct from old.participant_eligibility
     and exists (
       select 1
       from public.intent_participants participant
       where participant.intent_id = new.id
         and participant.user_id <> new.user_id
     )
     and new.participant_eligibility <> 'everyone' then
    raise exception
      'After a participant is accepted, eligibility can only be widened to Everyone.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and new.participant_eligibility is distinct from old.participant_eligibility
     and exists (
       select 1
       from public.plan_intents link
       join public.plan_members member
         on member.plan_id = link.plan_id
       where link.intent_id = new.id
         and member.user_id <> new.user_id
     )
     and new.participant_eligibility <> 'everyone' then
    raise exception
      'After a participant is accepted, eligibility can only be widened to Everyone.'
      using errcode = '42501';
  end if;

  if new.participant_eligibility <> 'everyone'
     and exists (
       select 1
       from public.intent_participants participant
       left join public.profiles profile
         on profile.id = participant.user_id
       where participant.intent_id = new.id
         and participant.status = 'active'
         and not public.gender_matches_participant_eligibility(
           profile.gender,
           new.participant_eligibility
         )
     ) then
    raise exception
      'An active participant does not satisfy the selected eligibility rule.'
      using errcode = '42501';
  end if;

  if new.participant_eligibility <> 'everyone'
     and exists (
       select 1
       from public.plan_intents link
       join public.plan_members member
         on member.plan_id = link.plan_id
        and member.status = 'active'
       left join public.profiles profile
         on profile.id = member.user_id
       where link.intent_id = new.id
         and link.status = 'active'
         and not public.gender_matches_participant_eligibility(
           profile.gender,
           new.participant_eligibility
         )
     ) then
    raise exception
      'An active Plan member does not satisfy the selected eligibility rule.'
      using errcode = '42501';
  end if;

  if new.participant_eligibility <> 'everyone'
     and exists (
       select 1
       from public.plan_intents link
       join public.plans plan
         on plan.id = link.plan_id
       left join public.profiles profile
         on profile.id = plan.host_user_id
       where link.intent_id = new.id
         and link.status = 'active'
         and not public.gender_matches_participant_eligibility(
           profile.gender,
           new.participant_eligibility
         )
     ) then
    raise exception
      'The primary Plan host does not satisfy the selected eligibility rule.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_intent_owner_participant_eligibility_trigger
  on public.intents;
create trigger validate_intent_owner_participant_eligibility_trigger
before insert or update of user_id, participant_eligibility
on public.intents
for each row
execute function public.validate_intent_owner_participant_eligibility();

create or replace function public.validate_profile_gender_change_against_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gender is not distinct from old.gender then
    if new.gender is null or new.gender = 'prefer_not_to_say' then
      new.show_gender := false;
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.intents intent
    where intent.user_id = new.id
      and intent.status = 'active'
      and not public.gender_matches_participant_eligibility(
        new.gender,
        intent.participant_eligibility
      )
  ) then
    raise exception
      'Change active restricted Intents to Everyone before changing this gender setting.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.intent_participants participant
    join public.intents intent on intent.id = participant.intent_id
    where participant.user_id = new.id
      and participant.status = 'active'
      and not public.gender_matches_participant_eligibility(
        new.gender,
        intent.participant_eligibility
      )
  ) then
    raise exception
      'Leave active restricted Intents before changing this gender setting.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.plan_members member
    join public.plan_intents link
      on link.plan_id = member.plan_id
     and link.status = 'active'
    join public.intents intent
      on intent.id = link.intent_id
    where member.user_id = new.id
      and member.status = 'active'
      and not public.gender_matches_participant_eligibility(
        new.gender,
        intent.participant_eligibility
      )
  ) then
    raise exception
      'Leave active restricted Plan participation before changing this gender setting.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.plans plan
    join public.plan_intents link
      on link.plan_id = plan.id
     and link.status = 'active'
    join public.intents intent
      on intent.id = link.intent_id
    where plan.host_user_id = new.id
      and not public.gender_matches_participant_eligibility(
        new.gender,
        intent.participant_eligibility
      )
  ) then
    raise exception
      'Transfer active restricted Plan host roles before changing this gender setting.'
      using errcode = '42501';
  end if;

  if new.gender is null or new.gender = 'prefer_not_to_say' then
    new.show_gender := false;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_gender_change_against_participation_trigger
  on public.profiles;
create trigger validate_profile_gender_change_against_participation_trigger
before update of gender, show_gender
on public.profiles
for each row
execute function public.validate_profile_gender_change_against_participation();

create or replace function public.validate_intent_participant_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'active') = 'active'
     and not public.user_is_eligible_for_intent(new.intent_id, new.user_id) then
    raise exception
      'This user is not eligible to participate in this Intent.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_intent_participant_gender_eligibility_trigger
  on public.intent_participants;
create trigger validate_intent_participant_gender_eligibility_trigger
before insert or update of intent_id, user_id, status
on public.intent_participants
for each row
execute function public.validate_intent_participant_gender_eligibility();

create or replace function public.validate_intent_join_request_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'pending') in ('pending', 'accepted')
     and not public.user_is_eligible_for_intent(new.intent_id, new.requester_user_id) then
    raise exception
      'You are not eligible to request participation in this Intent.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_intent_join_request_gender_eligibility_trigger
  on public.intent_join_requests;
create trigger validate_intent_join_request_gender_eligibility_trigger
before insert or update of intent_id, requester_user_id, status
on public.intent_join_requests
for each row
execute function public.validate_intent_join_request_gender_eligibility();

create or replace function public.validate_intent_invitation_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'pending') in ('pending', 'accepted')
     and not public.user_is_eligible_for_intent(new.intent_id, new.invited_user_id) then
    raise exception
      'This user is not eligible to be invited to this Intent.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_intent_invitation_gender_eligibility_trigger
  on public.intent_invitations;
create trigger validate_intent_invitation_gender_eligibility_trigger
before insert or update of intent_id, invited_user_id, status
on public.intent_invitations
for each row
execute function public.validate_intent_invitation_gender_eligibility();

create or replace function public.validate_intent_match_request_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'pending') in ('pending', 'accepted') then
    if not public.user_is_eligible_for_intent(new.target_intent_id, new.requester_id) then
      raise exception
        'You are not eligible for the target Intent.'
        using errcode = '42501';
    end if;

    if not public.user_is_eligible_for_intent(new.own_intent_id, new.receiver_id) then
      raise exception
        'The target user is not eligible for your Intent.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_intent_match_request_gender_eligibility_trigger
  on public.intent_requests;
create trigger validate_intent_match_request_gender_eligibility_trigger
before insert or update of own_intent_id, target_intent_id, requester_id, receiver_id, status
on public.intent_requests
for each row
execute function public.validate_intent_match_request_gender_eligibility();

create or replace function public.validate_plan_member_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'active') = 'active'
     and not public.user_is_eligible_for_plan_intents(
       new.plan_id,
       new.user_id
     ) then
    raise exception
      'An active Plan member must satisfy the participation eligibility of every linked Intent.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_plan_co_host_gender_eligibility_trigger
  on public.plan_members;
drop trigger if exists validate_plan_lead_gender_eligibility_trigger
  on public.plan_members;
drop trigger if exists validate_plan_member_gender_eligibility_trigger
  on public.plan_members;
create trigger validate_plan_member_gender_eligibility_trigger
before insert or update of plan_id, user_id, role, status
on public.plan_members
for each row
execute function public.validate_plan_member_gender_eligibility();

create or replace function public.validate_plan_primary_host_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.host_user_id is not null
     and not public.user_is_eligible_for_plan_intents(
       new.id,
       new.host_user_id
     ) then
    raise exception
      'The primary Plan host must satisfy the participation eligibility of every linked Intent.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_plan_primary_host_gender_eligibility_trigger
  on public.plans;
create trigger validate_plan_primary_host_gender_eligibility_trigger
before insert or update of host_user_id
on public.plans
for each row
execute function public.validate_plan_primary_host_gender_eligibility();

create or replace function public.validate_plan_intent_link_gender_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'active') = 'active' then
    if exists (
      select 1
      from public.plans plan
      where plan.id = new.plan_id
        and plan.host_user_id is not null
        and not public.user_is_eligible_for_intent(
          new.intent_id,
          plan.host_user_id
        )
    ) then
      raise exception
        'The primary Plan host does not satisfy the linked Intent participant eligibility.'
        using errcode = '42501';
    end if;

    if exists (
      select 1
      from public.plan_members member
      where member.plan_id = new.plan_id
        and member.status = 'active'
        and not public.user_is_eligible_for_intent(
          new.intent_id,
          member.user_id
        )
    ) then
      raise exception
        'An active Plan member does not satisfy the linked Intent participant eligibility.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_plan_intent_link_gender_eligibility_trigger
  on public.plan_intents;
create trigger validate_plan_intent_link_gender_eligibility_trigger
before insert or update of plan_id, intent_id, status
on public.plan_intents
for each row
execute function public.validate_plan_intent_link_gender_eligibility();

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
    and (
      exists (
        select 1
        from public.intent_communities own_community
        join public.intent_communities target_community
          on target_community.community_id = own_community.community_id
        where own_community.intent_id = own_intent.id
          and target_community.intent_id = target_intent.id
      )
      or (
        not exists (
          select 1
          from public.intent_communities own_community
          where own_community.intent_id = own_intent.id
        )
        and not exists (
          select 1
          from public.intent_communities target_community
          where target_community.intent_id = target_intent.id
        )
      )
    )
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
    and public.user_is_eligible_for_intent(
      own_intent.id,
      target_intent.user_id
    )
    and public.user_is_eligible_for_intent(
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

revoke all on function public.get_visible_intent_participant_eligibility(uuid[]) from public;
grant execute on function public.get_visible_intent_participant_eligibility(uuid[]) to anon, authenticated;
revoke all on function public.update_my_gender_settings(text,boolean) from public;
grant execute on function public.update_my_gender_settings(text,boolean) to authenticated;
revoke all on function public.update_my_profile_with_gender(text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.update_my_profile_with_gender(text,text,text,text,text,text,text,text,boolean) to authenticated;
revoke all on function public.get_public_profile_gender(text) from public;
grant execute on function public.get_public_profile_gender(text) to anon, authenticated;
revoke all on function public.create_my_intent_with_communities_and_eligibility(date,date,text,uuid,uuid,uuid,numeric,text,text,text,text,integer,uuid[],text,text,uuid) from public;
grant execute on function public.create_my_intent_with_communities_and_eligibility(date,date,text,uuid,uuid,uuid,numeric,text,text,text,text,integer,uuid[],text,text,uuid) to authenticated;
revoke all on function public.set_my_intent_participant_eligibility(uuid,text) from public;
grant execute on function public.set_my_intent_participant_eligibility(uuid,text) to authenticated;
revoke all on function public.user_is_eligible_for_intent(uuid,uuid) from public, anon, authenticated;
revoke all on function public.user_is_eligible_for_plan_intents(uuid,uuid) from public, anon, authenticated;
revoke all on function public.can_current_user_invite_user_to_intent(uuid,uuid) from public;
grant execute on function public.can_current_user_invite_user_to_intent(uuid,uuid) to authenticated;
revoke all on function public.can_current_user_assign_plan_lead(uuid,uuid) from public;
grant execute on function public.can_current_user_assign_plan_lead(uuid,uuid) to authenticated;

-- Register new source copy in the dynamic language system when installed.
do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null
     and to_regclass('public.app_locales') is not null then
    insert into public.translation_keys (
      key, namespace, default_text, description, source_revision, is_active
    )
    select
      source_row.key,
      'participation-eligibility',
      source_row.default_text,
      'Gender and participant eligibility',
      1,
      true
    from (
      values
        ('source.participation.gender', 'Gender'),
        ('source.participation.not-selected', 'Not selected'),
        ('source.participation.woman', 'Woman'),
        ('source.participation.man', 'Man'),
        ('source.participation.non-binary', 'Non-binary'),
        ('source.participation.prefer-not-to-say', 'Prefer not to say'),
        ('source.participation.show-profile', 'Show my gender on my profile'),
        ('source.participation.who-can-join', 'Who can participate?'),
        ('source.participation.everyone', 'Everyone'),
        ('source.participation.women-only', 'Women only'),
        ('source.participation.men-only', 'Men only'),
        ('source.participation.open-everyone', 'Open to Everyone'),
        ('source.participation.women-only-badge', 'Women Only'),
        ('source.participation.men-only-badge', 'Men Only'),
        ('source.participation.filter', 'Participant Eligibility'),
        ('source.participation.eligible-for-me', 'Eligible for me'),
        ('source.participation.all-rules', 'All eligibility rules'),
        ('source.participation.not-eligible', 'You are not eligible to join this Intent.'),
        ('source.participation.invitee-not-eligible', 'This person does not match the Intent participant eligibility rule.'),
        ('source.participation.plan-lead-not-eligible', 'This person does not match the participant eligibility of every linked Intent.'),
        ('source.participation.section', 'Participation'),
        ('source.participation.gender-settings', 'Gender settings'),
        ('source.participation.gender-description', 'This optional value is used to enforce women-only and men-only Intent participation rules.'),
        ('source.participation.show-description', 'Off by default. Choosing “Prefer not to say” never displays a gender value.'),
        ('source.participation.checking-profile', 'Checking your profile eligibility...'),
        ('source.participation.woman-create-help', 'You can create women-only or everyone Intents.'),
        ('source.participation.man-create-help', 'You can create men-only or everyone Intents.'),
        ('source.participation.restricted-create-help', 'Select Woman or Man in Profile Settings to create a restricted Intent. Non-binary and Prefer not to say currently participate in everyone Intents only.'),
        ('source.participation.open-profile-settings', 'Open Profile Settings'),
        ('source.participation.accepted-lock', 'A participant has already been accepted. The rule can now only be widened to Everyone.'),
        ('source.participation.woman-edit-help', 'Women-only and Everyone are available for this profile.'),
        ('source.participation.man-edit-help', 'Men-only and Everyone are available for this profile.'),
        ('source.participation.restricted-edit-help', 'Restricted Intents require Woman or Man in Profile Settings.'),
        ('source.participation.hidden-page', 'Intents that do not match the selected participant eligibility are hidden from this page.'),
        ('source.participation.unsupported-gender', 'Unsupported gender value.'),
        ('source.participation.unsupported-rule', 'Unsupported participant eligibility.'),
        ('source.participation.owner-rule', 'Only a woman can create a women-only Intent, and only a man can create a men-only Intent.'),
        ('source.participation.accepted-db-lock', 'After a participant is accepted, eligibility can only be widened to Everyone.'),
        ('source.participation.active-participant-mismatch', 'An active participant does not satisfy the selected eligibility rule.'),
        ('source.participation.active-plan-member-mismatch', 'An active Plan member does not satisfy the selected eligibility rule.'),
        ('source.participation.primary-host-mismatch', 'The primary Plan host does not satisfy the selected eligibility rule.'),
        ('source.participation.change-owned-intents-first', 'Change active restricted Intents to Everyone before changing this gender setting.'),
        ('source.participation.leave-intents-first', 'Leave active restricted Intents before changing this gender setting.'),
        ('source.participation.leave-plan-first', 'Leave active restricted Plan participation before changing this gender setting.'),
        ('source.participation.transfer-host-first', 'Transfer active restricted Plan host roles before changing this gender setting.'),
        ('source.participation.participant-blocked', 'This user is not eligible to participate in this Intent.'),
        ('source.participation.join-request-blocked', 'You are not eligible to request participation in this Intent.'),
        ('source.participation.invitation-blocked', 'This user is not eligible to be invited to this Intent.'),
        ('source.participation.target-blocked', 'You are not eligible for the target Intent.'),
        ('source.participation.receiver-blocked', 'The target user is not eligible for your Intent.'),
        ('source.participation.plan-member-all-intents', 'An active Plan member must satisfy the participation eligibility of every linked Intent.'),
        ('source.participation.primary-host-all-intents', 'The primary Plan host must satisfy the participation eligibility of every linked Intent.'),
        ('source.participation.primary-host-linked-intent', 'The primary Plan host does not satisfy the linked Intent participant eligibility.'),
        ('source.participation.plan-member-linked-intent', 'An active Plan member does not satisfy the linked Intent participant eligibility.')
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
      translation_key_id, locale_code, value, source_revision, updated_by
    )
    select
      translation_key.id,
      'tr',
      translation_row.translated_text,
      translation_key.source_revision,
      null
    from (
      values
        ('source.participation.gender', 'Cinsiyet'),
        ('source.participation.not-selected', 'Seçilmedi'),
        ('source.participation.woman', 'Kadın'),
        ('source.participation.man', 'Erkek'),
        ('source.participation.non-binary', 'Non-binary'),
        ('source.participation.prefer-not-to-say', 'Belirtmek istemiyorum'),
        ('source.participation.show-profile', 'Cinsiyetimi profilimde göster'),
        ('source.participation.who-can-join', 'Kimler katılabilir?'),
        ('source.participation.everyone', 'Herkes'),
        ('source.participation.women-only', 'Sadece kadınlar'),
        ('source.participation.men-only', 'Sadece erkekler'),
        ('source.participation.open-everyone', 'Herkese Açık'),
        ('source.participation.women-only-badge', 'Kadınlara Özel'),
        ('source.participation.men-only-badge', 'Erkeklere Özel'),
        ('source.participation.filter', 'Katılımcı Uygunluğu'),
        ('source.participation.eligible-for-me', 'Bana uygun olanlar'),
        ('source.participation.all-rules', 'Tüm uygunluk kuralları'),
        ('source.participation.not-eligible', 'Bu Intent’e katılmak için uygun değilsin.'),
        ('source.participation.invitee-not-eligible', 'Bu kişi Intent katılımcı uygunluğu kuralını karşılamıyor.'),
        ('source.participation.plan-lead-not-eligible', 'Bu kişi bağlı Intent’lerin tümündeki katılımcı uygunluğu kurallarını karşılamıyor.'),
        ('source.participation.section', 'Katılım'),
        ('source.participation.gender-settings', 'Cinsiyet ayarları'),
        ('source.participation.gender-description', 'Bu isteğe bağlı değer, yalnızca kadınlara ve yalnızca erkeklere açık Intent katılım kurallarını uygulamak için kullanılır.'),
        ('source.participation.show-description', 'Varsayılan olarak kapalıdır. “Belirtmek istemiyorum” seçildiğinde cinsiyet bilgisi hiçbir zaman gösterilmez.'),
        ('source.participation.checking-profile', 'Profil uygunluğun kontrol ediliyor...'),
        ('source.participation.woman-create-help', 'Yalnızca kadınlara açık veya herkese açık Intent oluşturabilirsin.'),
        ('source.participation.man-create-help', 'Yalnızca erkeklere açık veya herkese açık Intent oluşturabilirsin.'),
        ('source.participation.restricted-create-help', 'Sınırlı bir Intent oluşturmak için Profil Ayarları’nda Kadın veya Erkek seç. Non-binary ve Belirtmek istemiyorum seçeneklerini kullananlar ilk sürümde yalnızca herkese açık Intent’lere katılabilir.'),
        ('source.participation.open-profile-settings', 'Profil Ayarlarını Aç'),
        ('source.participation.accepted-lock', 'Bir katılımcı daha önce kabul edildi. Kural artık yalnızca Herkes olarak genişletilebilir.'),
        ('source.participation.woman-edit-help', 'Bu profil için Sadece kadınlar ve Herkes seçenekleri kullanılabilir.'),
        ('source.participation.man-edit-help', 'Bu profil için Sadece erkekler ve Herkes seçenekleri kullanılabilir.'),
        ('source.participation.restricted-edit-help', 'Sınırlı Intent’ler için Profil Ayarları’nda Kadın veya Erkek seçilmelidir.'),
        ('source.participation.hidden-page', 'Seçilen katılımcı uygunluğuna uymayan Intent’ler bu sayfada gizlenir.'),
        ('source.participation.unsupported-gender', 'Desteklenmeyen cinsiyet değeri.'),
        ('source.participation.unsupported-rule', 'Desteklenmeyen katılımcı uygunluğu kuralı.'),
        ('source.participation.owner-rule', 'Yalnızca kadın bir kullanıcı kadınlara özel, yalnızca erkek bir kullanıcı erkeklere özel Intent oluşturabilir.'),
        ('source.participation.accepted-db-lock', 'Bir katılımcı kabul edildikten sonra uygunluk yalnızca Herkes olarak genişletilebilir.'),
        ('source.participation.active-participant-mismatch', 'Aktif katılımcılardan biri seçilen uygunluk kuralını karşılamıyor.'),
        ('source.participation.active-plan-member-mismatch', 'Aktif Plan üyelerinden biri seçilen uygunluk kuralını karşılamıyor.'),
        ('source.participation.primary-host-mismatch', 'Plan ana host’u seçilen uygunluk kuralını karşılamıyor.'),
        ('source.participation.change-owned-intents-first', 'Bu cinsiyet ayarını değiştirmeden önce aktif sınırlı Intent’lerini Herkes olarak değiştir.'),
        ('source.participation.leave-intents-first', 'Bu cinsiyet ayarını değiştirmeden önce aktif sınırlı Intent’lerden ayrıl.'),
        ('source.participation.leave-plan-first', 'Bu cinsiyet ayarını değiştirmeden önce aktif sınırlı Plan katılımlarından ayrıl.'),
        ('source.participation.transfer-host-first', 'Bu cinsiyet ayarını değiştirmeden önce aktif sınırlı Plan host rollerini devret.'),
        ('source.participation.participant-blocked', 'Bu kullanıcı bu Intent’e katılmak için uygun değil.'),
        ('source.participation.join-request-blocked', 'Bu Intent’e katılım isteği göndermek için uygun değilsin.'),
        ('source.participation.invitation-blocked', 'Bu kullanıcı bu Intent’e davet edilmek için uygun değil.'),
        ('source.participation.target-blocked', 'Hedef Intent için uygun değilsin.'),
        ('source.participation.receiver-blocked', 'Hedef kullanıcı senin Intent’in için uygun değil.'),
        ('source.participation.plan-member-all-intents', 'Aktif bir Plan üyesi bağlı tüm Intent’lerin katılımcı uygunluğu kurallarını karşılamalıdır.'),
        ('source.participation.primary-host-all-intents', 'Plan ana host’u bağlı tüm Intent’lerin katılımcı uygunluğu kurallarını karşılamalıdır.'),
        ('source.participation.primary-host-linked-intent', 'Plan ana host’u bağlanan Intent’in katılımcı uygunluğu kuralını karşılamıyor.'),
        ('source.participation.plan-member-linked-intent', 'Aktif Plan üyelerinden biri bağlanan Intent’in katılımcı uygunluğu kuralını karşılamıyor.')
    ) as translation_row(key, translated_text)
    join public.translation_keys translation_key
      on translation_key.key = translation_row.key
    where exists (
      select 1 from public.app_locales locale where locale.code = 'tr'
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
