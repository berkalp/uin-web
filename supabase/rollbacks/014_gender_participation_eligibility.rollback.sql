-- 014_gender_participation_eligibility.rollback.sql
begin;

-- Remove feature-specific translation entries first.
do $$
begin
  if to_regclass('public.translation_keys') is not null then
    delete from public.translation_keys
    where namespace = 'participation-eligibility';
  end if;
end;
$$;

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

drop trigger if exists validate_plan_intent_link_gender_eligibility_trigger on public.plan_intents;
drop trigger if exists validate_plan_primary_host_gender_eligibility_trigger on public.plans;
drop trigger if exists validate_plan_member_gender_eligibility_trigger on public.plan_members;
drop trigger if exists validate_plan_lead_gender_eligibility_trigger on public.plan_members;
drop trigger if exists validate_plan_co_host_gender_eligibility_trigger on public.plan_members;
drop trigger if exists validate_intent_match_request_gender_eligibility_trigger on public.intent_requests;
drop trigger if exists validate_intent_invitation_gender_eligibility_trigger on public.intent_invitations;
drop trigger if exists validate_intent_join_request_gender_eligibility_trigger on public.intent_join_requests;
drop trigger if exists validate_intent_participant_gender_eligibility_trigger on public.intent_participants;
drop trigger if exists validate_profile_gender_change_against_participation_trigger on public.profiles;
drop trigger if exists validate_intent_owner_participant_eligibility_trigger on public.intents;

drop function if exists public.validate_plan_intent_link_gender_eligibility();
drop function if exists public.validate_plan_primary_host_gender_eligibility();
drop function if exists public.validate_plan_member_gender_eligibility();
drop function if exists public.validate_plan_lead_gender_eligibility();
drop function if exists public.validate_plan_co_host_gender_eligibility();
drop function if exists public.validate_intent_match_request_gender_eligibility();
drop function if exists public.validate_intent_invitation_gender_eligibility();
drop function if exists public.validate_intent_join_request_gender_eligibility();
drop function if exists public.validate_intent_participant_gender_eligibility();
drop function if exists public.validate_profile_gender_change_against_participation();
drop function if exists public.validate_intent_owner_participant_eligibility();
drop function if exists public.create_my_intent_with_communities_and_eligibility(date,date,text,uuid,uuid,uuid,numeric,text,text,text,text,integer,uuid[],text,text,uuid);
drop function if exists public.set_my_intent_participant_eligibility(uuid,text);
drop function if exists public.get_visible_intent_participant_eligibility(uuid[]);
drop function if exists public.update_my_profile_with_gender(text,text,text,text,text,text,text,text,boolean);
drop function if exists public.get_public_profile_gender(text);
drop function if exists public.update_my_gender_settings(text,boolean);
drop function if exists public.can_current_user_assign_plan_lead(uuid,uuid);
drop function if exists public.can_current_user_invite_user_to_intent(uuid,uuid);
drop function if exists public.user_is_eligible_for_plan_intents(uuid,uuid);
drop function if exists public.user_is_eligible_for_intent(uuid,uuid);
drop function if exists public.gender_matches_participant_eligibility(text,text);

drop index if exists public.intents_participant_eligibility_idx;

alter table public.intents
  drop constraint if exists intents_participant_eligibility_check,
  drop column if exists participant_eligibility;

alter table public.profiles
  drop constraint if exists profiles_show_gender_requires_visible_gender_check,
  drop constraint if exists profiles_gender_check,
  drop column if exists show_gender,
  drop column if exists gender;

commit;
