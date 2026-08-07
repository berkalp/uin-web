begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

alter table public.profiles
  add column if not exists participation_profile_visibility text
  not null default 'friends';

alter table public.profiles
  drop constraint if exists profiles_participation_profile_visibility_check;

alter table public.profiles
  add constraint profiles_participation_profile_visibility_check
  check (
    participation_profile_visibility in (
      'public',
      'friends',
      'private'
    )
  );

create or replace function public.get_profile_plan_relationship(
  p_profile_user_id uuid,
  p_plan_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when plan.host_user_id = p_profile_user_id then 'host'
      when member.role = 'co_host' then 'co_host'
      when member.user_id is not null then 'participant'
      else null
    end
  from public.plans plan
  left join public.plan_members member
    on member.plan_id = plan.id
    and member.user_id = p_profile_user_id
  where plan.id = p_plan_id
  limit 1;
$$;

create or replace function public.decorate_visible_profile_activity_items(
  p_items jsonb,
  p_profile_user_id uuid,
  p_can_view_participation boolean
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      item_with_role
      order by ordinal_position
    ),
    '[]'::jsonb
  )
  from (
    select
      item || jsonb_build_object(
        'relationship',
        relationship
      ) as item_with_role,
      ordinal_position
    from jsonb_array_elements(
      coalesce(p_items, '[]'::jsonb)
    ) with ordinality as activity_item(
      item,
      ordinal_position
    )
    cross join lateral (
      select public.get_profile_plan_relationship(
        p_profile_user_id,
        nullif(item ->> 'id', '')::uuid
      ) as relationship
    ) role_data
    where
      relationship in ('host', 'co_host')
      or (
        relationship = 'participant'
        and p_can_view_participation
      )
  ) visible_items;
$$;

create or replace function public.get_public_profile_page_with_participation_visibility(
  p_username text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page jsonb;
  v_profile_user_id uuid;
  v_visibility text;
  v_can_view_participation boolean;
  v_forming jsonb;
  v_upcoming jsonb;
  v_completed jsonb;
begin
  v_page := public.get_public_profile_page_visibility(
    p_username
  );

  if v_page is null then
    return null;
  end if;

  v_profile_user_id :=
    nullif(v_page #>> '{profile,id}', '')::uuid;

  select coalesce(
    profile.participation_profile_visibility,
    'friends'
  )
  into v_visibility
  from public.profiles profile
  where profile.id = v_profile_user_id;

  v_can_view_participation :=
    public.profile_visibility_allows(
      v_profile_user_id,
      v_visibility,
      auth.uid()
    );

  v_forming :=
    public.decorate_visible_profile_activity_items(
      v_page -> 'forming_activities',
      v_profile_user_id,
      v_can_view_participation
    );

  v_upcoming :=
    public.decorate_visible_profile_activity_items(
      v_page -> 'upcoming_activities',
      v_profile_user_id,
      v_can_view_participation
    );

  v_completed :=
    public.decorate_visible_profile_activity_items(
      v_page -> 'completed_activities',
      v_profile_user_id,
      v_can_view_participation
    );

  v_page := jsonb_set(
    v_page,
    '{forming_activities}',
    v_forming,
    true
  );

  v_page := jsonb_set(
    v_page,
    '{upcoming_activities}',
    v_upcoming,
    true
  );

  v_page := jsonb_set(
    v_page,
    '{completed_activities}',
    v_completed,
    true
  );

  v_page := jsonb_set(
    v_page,
    '{summary,forming_activities}',
    to_jsonb(jsonb_array_length(v_forming)),
    true
  );

  v_page := jsonb_set(
    v_page,
    '{summary,upcoming_activities}',
    to_jsonb(jsonb_array_length(v_upcoming)),
    true
  );

  v_page := jsonb_set(
    v_page,
    '{summary,completed_activities}',
    to_jsonb(jsonb_array_length(v_completed)),
    true
  );

  return v_page;
end;
$$;

create or replace function public.update_my_profile_with_gender_and_participation_visibility(
  p_full_name text,
  p_username text,
  p_bio text,
  p_city text,
  p_country text,
  p_avatar_url text,
  p_cover_url text,
  p_gender text,
  p_show_gender boolean default false,
  p_participation_profile_visibility text default 'friends'
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
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_participation_profile_visibility not in (
    'public',
    'friends',
    'private'
  ) then
    raise exception 'Unsupported participation profile visibility.'
      using errcode = '22023';
  end if;

  perform public.update_my_profile_with_gender(
    p_full_name => p_full_name,
    p_username => p_username,
    p_bio => p_bio,
    p_city => p_city,
    p_country => p_country,
    p_avatar_url => p_avatar_url,
    p_cover_url => p_cover_url,
    p_gender => p_gender,
    p_show_gender => p_show_gender
  );

  update public.profiles
  set participation_profile_visibility =
    p_participation_profile_visibility
  where id = v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.get_profile_plan_relationship(uuid, uuid)
  from public;
revoke all on function public.decorate_visible_profile_activity_items(jsonb, uuid, boolean)
  from public;
revoke all on function public.get_public_profile_page_with_participation_visibility(text)
  from public;
revoke all on function public.update_my_profile_with_gender_and_participation_visibility(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
) from public;

grant execute on function public.get_public_profile_page_with_participation_visibility(text)
  to anon, authenticated;
grant execute on function public.update_my_profile_with_gender_and_participation_visibility(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
) to authenticated;

commit;
