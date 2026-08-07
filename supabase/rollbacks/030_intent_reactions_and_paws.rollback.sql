begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.translation_keys') is not null then
    delete from public.translation_keys
    where namespace = 'intent-reactions';
  end if;
end;
$$;


-- Restore the pre-reaction Match Engine ordering.
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

drop function if exists public.get_intent_interest_signal(uuid, uuid);
drop function if exists public.get_profile_visible_intent_reactions(uuid, text, integer, integer);
drop function if exists public.set_my_paw_profile_visibility(text);
drop function if exists public.set_my_intent_reaction(uuid, text, boolean);
drop function if exists public.get_visible_intent_reaction_context(uuid[]);
drop function if exists public.intent_accepts_new_reactions(uuid);
drop function if exists public.intent_reaction_is_visible_to_viewer(uuid, text, uuid);
drop trigger if exists touch_intent_reaction_updated_at_trigger on public.intent_reactions;
drop function if exists public.touch_intent_reaction_updated_at();
drop table if exists public.intent_reactions;

alter table public.profiles
  drop constraint if exists profiles_paw_profile_visibility_check;
alter table public.profiles
  drop column if exists paw_profile_visibility;

commit;
