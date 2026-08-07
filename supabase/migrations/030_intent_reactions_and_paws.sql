begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

alter table public.profiles
  add column if not exists paw_profile_visibility text not null default 'friends';

alter table public.profiles
  drop constraint if exists profiles_paw_profile_visibility_check;

alter table public.profiles
  add constraint profiles_paw_profile_visibility_check
  check (paw_profile_visibility in ('only_me', 'friends', 'everyone'));

comment on column public.profiles.paw_profile_visibility is
  'Controls who may see the Intents this profile has Pawed.';

create table if not exists public.intent_reactions (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  visibility text not null default 'only_me',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intent_reactions_type_check
    check (reaction_type in ('save', 'paw')),
  constraint intent_reactions_visibility_check
    check (
      (reaction_type = 'save' and visibility = 'only_me')
      or
      (reaction_type = 'paw' and visibility in ('only_me', 'friends', 'everyone'))
    ),
  constraint intent_reactions_unique
    unique (intent_id, user_id, reaction_type)
);

comment on table public.intent_reactions is
  'Private Saves and social Paw recommendations for Intents.';
comment on column public.intent_reactions.reaction_type is
  'save is private bookmarking; paw is a social recommendation.';
comment on column public.intent_reactions.visibility is
  'Save is always only_me. Paw may be only_me, friends or everyone.';

create index if not exists intent_reactions_intent_type_idx
  on public.intent_reactions(intent_id, reaction_type);
create index if not exists intent_reactions_user_type_updated_idx
  on public.intent_reactions(user_id, reaction_type, updated_at desc);
create index if not exists intent_reactions_social_idx
  on public.intent_reactions(reaction_type, visibility, updated_at desc)
  where reaction_type = 'paw';

create or replace function public.touch_intent_reaction_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_intent_reaction_updated_at_trigger
  on public.intent_reactions;
create trigger touch_intent_reaction_updated_at_trigger
before update on public.intent_reactions
for each row
execute function public.touch_intent_reaction_updated_at();

create or replace function public.intent_reaction_is_visible_to_viewer(
  p_reaction_user_id uuid,
  p_visibility text,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_reaction_user_id is null then false
    when p_viewer_user_id = p_reaction_user_id then true
    when p_visibility = 'everyone' then true
    when p_visibility = 'friends' then
      public.users_are_accepted_friends(
        p_reaction_user_id,
        p_viewer_user_id
      )
    else false
  end;
$$;

create or replace function public.intent_accepts_new_reactions(
  p_intent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      intent.status in ('active', 'planned')
      and intent.expired_at is null
      and intent.end_date >= current_date
      and intent.recruitment_status <> 'closed'
      and (
        exists (
          select 1
          from public.plan_intents plan_link
          join public.plans plan
            on plan.id = plan_link.plan_id
          where plan_link.intent_id = intent.id
            and plan_link.status = 'active'
            and plan.status in ('forming', 'planned')
        )
        or intent.matching_status <> 'closed'
      )
    from public.intents intent
    where intent.id = p_intent_id
    limit 1
  ), false);
$$;

create or replace function public.get_visible_intent_reaction_context(
  p_intent_ids uuid[]
)
returns table (
  intent_id uuid,
  save_count bigint,
  paw_count bigint,
  viewer_saved boolean,
  viewer_pawed boolean,
  viewer_paw_visibility text,
  friend_paw_count bigint,
  friend_paw_preview jsonb,
  viewer_can_react boolean,
  reaction_disabled_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct requested_id as intent_id
    from unnest(coalesce(p_intent_ids, array[]::uuid[])) requested_id
  ),
  visible_intents as (
    select intent.*
    from requested
    join public.intents intent
      on intent.id = requested.intent_id
    where public.can_user_view_intent_activity(
      intent.id,
      auth.uid()
    )
  )
  select
    intent.id as intent_id,
    case
      when auth.uid() = intent.user_id then (
        select count(*)
        from public.intent_reactions reaction
        where reaction.intent_id = intent.id
          and reaction.reaction_type = 'save'
      )
      else 0
    end::bigint as save_count,
    (
      select count(*)
      from public.intent_reactions reaction
      where reaction.intent_id = intent.id
        and reaction.reaction_type = 'paw'
        and (
          auth.uid() = intent.user_id
          or public.intent_reaction_is_visible_to_viewer(
            reaction.user_id,
            reaction.visibility,
            auth.uid()
          )
        )
    )::bigint as paw_count,
    coalesce(exists (
      select 1
      from public.intent_reactions reaction
      where reaction.intent_id = intent.id
        and reaction.user_id = auth.uid()
        and reaction.reaction_type = 'save'
    ), false) as viewer_saved,
    coalesce(exists (
      select 1
      from public.intent_reactions reaction
      where reaction.intent_id = intent.id
        and reaction.user_id = auth.uid()
        and reaction.reaction_type = 'paw'
    ), false) as viewer_pawed,
    coalesce(
      (
        select reaction.visibility
        from public.intent_reactions reaction
        where reaction.intent_id = intent.id
          and reaction.user_id = auth.uid()
          and reaction.reaction_type = 'paw'
        limit 1
      ),
      (
        select profile.paw_profile_visibility
        from public.profiles profile
        where profile.id = auth.uid()
      ),
      'friends'
    )::text as viewer_paw_visibility,
    case
      when auth.uid() is null then 0
      else (
        select count(*)
        from public.intent_reactions reaction
        where reaction.intent_id = intent.id
          and reaction.reaction_type = 'paw'
          and reaction.user_id <> auth.uid()
          and reaction.visibility in ('friends', 'everyone')
          and public.users_are_accepted_friends(
            reaction.user_id,
            auth.uid()
          )
      )
    end::bigint as friend_paw_count,
    case
      when auth.uid() is null then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'user_id', preview.user_id,
            'full_name', preview.full_name,
            'username', preview.username,
            'avatar_url', preview.avatar_url
          )
          order by preview.updated_at desc
        )
        from (
          select
            profile.id as user_id,
            profile.full_name,
            profile.username,
            profile.avatar_url,
            reaction.updated_at
          from public.intent_reactions reaction
          join public.profiles profile
            on profile.id = reaction.user_id
          where reaction.intent_id = intent.id
            and reaction.reaction_type = 'paw'
            and reaction.user_id <> auth.uid()
            and reaction.visibility in ('friends', 'everyone')
            and public.users_are_accepted_friends(
              reaction.user_id,
              auth.uid()
            )
          order by reaction.updated_at desc
          limit 3
        ) preview
      ), '[]'::jsonb)
    end as friend_paw_preview,
    (
      auth.uid() is not null
      and auth.uid() <> intent.user_id
      and public.intent_accepts_new_reactions(intent.id)
      and public.user_is_eligible_for_intent(intent.id, auth.uid())
    ) as viewer_can_react,
    case
      when auth.uid() is null then 'Sign in to Save or Paw this Intent.'
      when auth.uid() = intent.user_id then 'You cannot react to your own Intent.'
      when not public.user_is_eligible_for_intent(intent.id, auth.uid())
        then 'This Intent is not open to your participant profile.'
      when not public.intent_accepts_new_reactions(intent.id)
        then 'This Intent is no longer accepting new reactions.'
      else null
    end::text as reaction_disabled_reason
  from visible_intents intent
  order by array_position(p_intent_ids, intent.id);
$$;

create or replace function public.set_my_intent_reaction(
  p_intent_id uuid,
  p_reaction_type text,
  p_active boolean
)
returns table (
  intent_id uuid,
  save_count bigint,
  paw_count bigint,
  viewer_saved boolean,
  viewer_pawed boolean,
  viewer_paw_visibility text,
  friend_paw_count bigint,
  friend_paw_preview jsonb,
  viewer_can_react boolean,
  reaction_disabled_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_visibility text;
begin
  if v_user_id is null then
    raise exception 'Sign in to Save or Paw an Intent.' using errcode = '42501';
  end if;

  if p_reaction_type not in ('save', 'paw') then
    raise exception 'Unsupported Intent reaction.' using errcode = '22023';
  end if;

  select intent.user_id
  into v_owner_user_id
  from public.intents intent
  where intent.id = p_intent_id;

  if v_owner_user_id is null then
    raise exception 'Intent not found.' using errcode = 'P0002';
  end if;

  if p_active = false then
    delete from public.intent_reactions reaction
    where reaction.intent_id = p_intent_id
      and reaction.user_id = v_user_id
      and reaction.reaction_type = p_reaction_type;

    return query
    select *
    from public.get_visible_intent_reaction_context(array[p_intent_id]);
    return;
  end if;

  if not public.can_user_view_intent_activity(p_intent_id, v_user_id) then
    raise exception 'This Intent is not visible to you.' using errcode = '42501';
  end if;

  if v_owner_user_id = v_user_id then
    raise exception 'You cannot react to your own Intent.' using errcode = '22023';
  end if;

  if not public.user_is_eligible_for_intent(p_intent_id, v_user_id) then
    raise exception 'This Intent is not open to your participant profile.' using errcode = '42501';
  end if;

  if not public.intent_accepts_new_reactions(p_intent_id) then
    raise exception 'This Intent is no longer accepting new reactions.' using errcode = '22023';
  end if;

  if p_reaction_type = 'save' then
    v_visibility := 'only_me';
  else
    select coalesce(profile.paw_profile_visibility, 'friends')
    into v_visibility
    from public.profiles profile
    where profile.id = v_user_id;
  end if;

  insert into public.intent_reactions (
    intent_id,
    user_id,
    reaction_type,
    visibility
  ) values (
    p_intent_id,
    v_user_id,
    p_reaction_type,
    coalesce(v_visibility, 'friends')
  )
  on conflict (intent_id, user_id, reaction_type)
  do update
  set
    visibility = excluded.visibility,
    updated_at = now();

  return query
  select *
  from public.get_visible_intent_reaction_context(array[p_intent_id]);
end;
$$;

create or replace function public.set_my_paw_profile_visibility(
  p_visibility text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to update Paw visibility.' using errcode = '42501';
  end if;

  if p_visibility not in ('only_me', 'friends', 'everyone') then
    raise exception 'Unsupported Paw profile visibility.' using errcode = '22023';
  end if;

  update public.profiles
  set paw_profile_visibility = p_visibility
  where id = v_user_id;

  update public.intent_reactions
  set visibility = p_visibility
  where user_id = v_user_id
    and reaction_type = 'paw';

  return p_visibility;
end;
$$;

create or replace function public.get_profile_visible_intent_reactions(
  p_profile_user_id uuid,
  p_reaction_type text,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  reaction_id uuid,
  reaction_type text,
  reaction_visibility text,
  reacted_at timestamptz,
  intent_id uuid,
  resource_id uuid,
  plan_id uuid,
  owner_user_id uuid,
  owner_full_name text,
  owner_username text,
  owner_avatar_url text,
  activity_name text,
  activity_cover_url text,
  category_name text,
  category_cover_url text,
  city text,
  district text,
  start_date date,
  end_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  lifecycle_status text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_reactions as (
    select reaction.*
    from public.intent_reactions reaction
    where reaction.user_id = p_profile_user_id
      and reaction.reaction_type = p_reaction_type
      and p_reaction_type in ('save', 'paw')
      and (
        auth.uid() = p_profile_user_id
        or (
          reaction.reaction_type = 'paw'
          and public.intent_reaction_is_visible_to_viewer(
            reaction.user_id,
            reaction.visibility,
            auth.uid()
          )
        )
      )
      and public.can_user_view_intent_activity(
        reaction.intent_id,
        auth.uid()
      )
  ),
  reaction_cards as (
    select
      reaction.id as reaction_id,
      reaction.reaction_type,
      reaction.visibility as reaction_visibility,
      reaction.updated_at as reacted_at,
      intent.id as intent_id,
      coalesce(current_plan.id, intent.id) as resource_id,
      current_plan.id as plan_id,
      owner_profile.id as owner_user_id,
      owner_profile.full_name as owner_full_name,
      owner_profile.username as owner_username,
      owner_profile.avatar_url as owner_avatar_url,
      activity.name as activity_name,
      activity.default_cover_url as activity_cover_url,
      category.name as category_name,
      category.default_cover_url as category_cover_url,
      coalesce(location.city, location.country_name) as city,
      location.district as district,
      intent.start_date,
      intent.end_date,
      current_plan.scheduled_start,
      current_plan.scheduled_end,
      case
        when current_plan.status = 'forming' then 'forming'
        when current_plan.status = 'planned' then 'planned'
        when current_plan.status = 'completed' then 'completed'
        when current_plan.status = 'cancelled' then 'cancelled'
        when intent.expired_at is not null or intent.end_date < current_date then 'expired'
        when intent.status = 'cancelled' then 'cancelled'
        when intent.status = 'completed' then 'completed'
        when intent.start_date > current_date then 'future'
        when intent.matching_status = 'closed' or intent.recruitment_status = 'closed' then 'closed'
        else 'open'
      end::text as lifecycle_status
    from visible_reactions reaction
    join public.intents intent
      on intent.id = reaction.intent_id
    join public.profiles owner_profile
      on owner_profile.id = intent.user_id
    join public.activities activity
      on activity.id = intent.activity_id
    join public.activity_categories category
      on category.id = activity.category_id
    join public.locations location
      on location.id = intent.location_id
    left join lateral (
      select plan.*
      from public.plan_intents plan_link
      join public.plans plan
        on plan.id = plan_link.plan_id
      where plan_link.intent_id = intent.id
        and plan_link.status = 'active'
      order by
        case plan.status
          when 'forming' then 0
          when 'planned' then 1
          when 'completed' then 2
          when 'cancelled' then 3
          else 4
        end,
        plan.created_at desc
      limit 1
    ) current_plan on true
  )
  select
    card.*,
    count(*) over()::bigint as total_count
  from reaction_cards card
  order by card.reacted_at desc, card.reaction_id desc
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_intent_interest_signal(
  p_intent_id uuid,
  p_user_id uuid default auth.uid()
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(
    case reaction.reaction_type
      when 'paw' then 2.0
      when 'save' then 1.0
      else 0.0
    end
  ), 0.0)::numeric
  from public.intent_reactions reaction
  where reaction.intent_id = p_intent_id
    and reaction.user_id = p_user_id;
$$;

-- Keep matching eligibility unchanged while using Save/Paw as a secondary interest signal.
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
    public.get_intent_interest_signal(
      target_intent.id,
      auth.uid()
    ) desc,
    greatest(
      own_intent.start_date,
      target_intent.start_date
    ),
    target_intent.created_at desc,
    target_intent.id;
$function$;

alter table public.intent_reactions enable row level security;

drop policy if exists intent_reactions_visible_select on public.intent_reactions;
create policy intent_reactions_visible_select
on public.intent_reactions
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    reaction_type = 'paw'
    and public.intent_reaction_is_visible_to_viewer(
      user_id,
      visibility,
      auth.uid()
    )
    and public.can_user_view_intent_activity(intent_id, auth.uid())
  )
);

drop policy if exists intent_reactions_own_insert on public.intent_reactions;
create policy intent_reactions_own_insert
on public.intent_reactions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists intent_reactions_own_update on public.intent_reactions;
create policy intent_reactions_own_update
on public.intent_reactions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists intent_reactions_own_delete on public.intent_reactions;
create policy intent_reactions_own_delete
on public.intent_reactions
for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.intent_reactions from public, anon;
grant select on table public.intent_reactions to authenticated;

revoke all on function public.intent_reaction_is_visible_to_viewer(uuid, text, uuid) from public;
revoke all on function public.intent_accepts_new_reactions(uuid) from public;
revoke all on function public.get_visible_intent_reaction_context(uuid[]) from public;
revoke all on function public.set_my_intent_reaction(uuid, text, boolean) from public;
revoke all on function public.set_my_paw_profile_visibility(text) from public;
revoke all on function public.get_profile_visible_intent_reactions(uuid, text, integer, integer) from public;
revoke all on function public.get_intent_interest_signal(uuid, uuid) from public;

grant execute on function public.get_visible_intent_reaction_context(uuid[]) to anon, authenticated;
grant execute on function public.set_my_intent_reaction(uuid, text, boolean) to authenticated;
grant execute on function public.set_my_paw_profile_visibility(text) to authenticated;
grant execute on function public.get_profile_visible_intent_reactions(uuid, text, integer, integer) to anon, authenticated;
grant execute on function public.get_intent_interest_signal(uuid, uuid) to authenticated;

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
      'intent-reactions',
      source_row.default_text,
      'Private Save and social Paw interactions',
      1,
      true
    from (
      values
        ('source.intent-reaction.save', 'Save'),
        ('source.intent-reaction.saved', 'Saved'),
        ('source.intent-reaction.save-help', 'Keep this Intent private for later.'),
        ('source.intent-reaction.paw', 'Paw'),
        ('source.intent-reaction.pawed', 'Pawed'),
        ('source.intent-reaction.paw-help', 'Recommend this Intent to people who can see your Paws.'),
        ('source.intent-reaction.paw-count', '{0} Paws'),
        ('source.intent-reaction.friend-paw', '{0} friend Pawed this'),
        ('source.intent-reaction.friend-paws', '{0} friends Pawed this'),
        ('source.intent-reaction.saved-intents', 'Saved Intents'),
        ('source.intent-reaction.pawed-intents', 'Pawed Intents'),
        ('source.intent-reaction.saved-private', 'Only you can see your Saved Intents.'),
        ('source.intent-reaction.pawed-social', 'Intents this person recommends with a Paw.'),
        ('source.intent-reaction.paw-visibility', 'Who can see the Intents I Paw?'),
        ('source.intent-reaction.only-me', 'Only me'),
        ('source.intent-reaction.friends', 'Friends'),
        ('source.intent-reaction.everyone', 'Everyone'),
        ('source.intent-reaction.no-saved', 'No Saved Intents yet.'),
        ('source.intent-reaction.no-pawed', 'No visible Pawed Intents yet.'),
        ('source.intent-reaction.sign-in', 'Sign in to Save or Paw this Intent.'),
        ('source.intent-reaction.own-intent', 'You cannot react to your own Intent.'),
        ('source.intent-reaction.closed', 'This Intent is no longer accepting new reactions.')
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
        ('source.intent-reaction.save', 'Kaydet'),
        ('source.intent-reaction.saved', 'Kaydedildi'),
        ('source.intent-reaction.save-help', 'Bu Intent’i daha sonra bakmak için özel olarak sakla.'),
        ('source.intent-reaction.paw', 'Pati bırak'),
        ('source.intent-reaction.pawed', 'Pati bıraktın'),
        ('source.intent-reaction.paw-help', 'Bu Intent’i patilerini görebilen kişilere öner.'),
        ('source.intent-reaction.paw-count', '{0} Pati'),
        ('source.intent-reaction.friend-paw', '{0} arkadaşın pati bıraktı'),
        ('source.intent-reaction.friend-paws', '{0} arkadaşın pati bıraktı'),
        ('source.intent-reaction.saved-intents', 'Kaydedilen Intent’ler'),
        ('source.intent-reaction.pawed-intents', 'Pati Bırakılan Intent’ler'),
        ('source.intent-reaction.saved-private', 'Kaydettiğin Intent’leri yalnız sen görebilirsin.'),
        ('source.intent-reaction.pawed-social', 'Bu kişinin pati bırakarak önerdiği Intent’ler.'),
        ('source.intent-reaction.paw-visibility', 'Pati bıraktığım Intent’leri kim görebilir?'),
        ('source.intent-reaction.only-me', 'Yalnız ben'),
        ('source.intent-reaction.friends', 'Arkadaşlarım'),
        ('source.intent-reaction.everyone', 'Herkes'),
        ('source.intent-reaction.no-saved', 'Henüz kaydedilmiş Intent yok.'),
        ('source.intent-reaction.no-pawed', 'Görünür bir pati bırakılmış Intent yok.'),
        ('source.intent-reaction.sign-in', 'Bu Intent’i kaydetmek veya pati bırakmak için giriş yap.'),
        ('source.intent-reaction.own-intent', 'Kendi Intent’ine tepki veremezsin.'),
        ('source.intent-reaction.closed', 'Bu Intent artık yeni tepki kabul etmiyor.')
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
