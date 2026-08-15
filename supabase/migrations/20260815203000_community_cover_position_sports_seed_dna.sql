begin;

-- ---------------------------------------------------------------------------
-- Community cover focal point
-- ---------------------------------------------------------------------------

alter table public.communities
  add column if not exists cover_position_x smallint not null default 50,
  add column if not exists cover_position_y smallint not null default 50;

alter table public.communities
  drop constraint if exists communities_cover_position_x_check;

alter table public.communities
  add constraint communities_cover_position_x_check
  check (cover_position_x between 0 and 100);

alter table public.communities
  drop constraint if exists communities_cover_position_y_check;

alter table public.communities
  add constraint communities_cover_position_y_check
  check (cover_position_y between 0 and 100);

create or replace function public.get_community_cover_presentation(
  p_community_id uuid
)
returns table(
  cover_image_url text,
  cover_position_x integer,
  cover_position_y integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    community.cover_image_url::text,
    community.cover_position_x::integer,
    community.cover_position_y::integer
  from public.communities community
  where community.id = p_community_id
    and (
      community.status = 'active'
      or public.is_admin()
    )
  limit 1;
$$;

create or replace function public.get_admin_community_cover_presentations()
returns table(
  community_id uuid,
  cover_image_url text,
  cover_position_x integer,
  cover_position_y integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  return query
  select
    community.id,
    community.cover_image_url,
    community.cover_position_x::integer,
    community.cover_position_y::integer
  from public.communities community
  order by community.name;
end;
$$;

create or replace function public.admin_set_community_cover_presentation(
  p_community_id uuid,
  p_cover_image_url text,
  p_cover_position_x integer default 50,
  p_cover_position_y integer default 50
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cover_image_url text;
  v_position_x integer;
  v_position_y integer;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.communities community
    where community.id = p_community_id
  ) then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;

  v_cover_image_url :=
    nullif(btrim(coalesce(p_cover_image_url, '')), '');

  if
    v_cover_image_url is not null
    and v_cover_image_url !~* '^https://'
  then
    raise exception
      'Community cover image URL must use HTTPS.'
      using errcode = '22023';
  end if;

  v_position_x := coalesce(p_cover_position_x, 50);
  v_position_y := coalesce(p_cover_position_y, 50);

  if v_position_x not between 0 and 100 then
    raise exception
      'Horizontal cover position must be between 0 and 100.'
      using errcode = '22023';
  end if;

  if v_position_y not between 0 and 100 then
    raise exception
      'Vertical cover position must be between 0 and 100.'
      using errcode = '22023';
  end if;

  update public.communities
  set
    cover_image_url = v_cover_image_url,
    cover_position_x = v_position_x,
    cover_position_y = v_position_y,
    updated_by_admin_id = auth.uid(),
    updated_at = now()
  where id = p_community_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Community-specific Sport filters
-- ---------------------------------------------------------------------------

create or replace function public.get_active_sports_for_community(
  p_community_id uuid
)
returns table(
  sport_id uuid,
  sport_name text,
  sport_slug text,
  default_cover_url text,
  sort_order integer
)
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
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  return query
  select
    sport.id::uuid,
    sport.name::text,
    sport.slug::text,
    community_sport.default_cover_url::text,
    community_sport.sort_order::integer
  from public.community_sports community_sport
  join public.communities community
    on community.id = community_sport.community_id
  join public.sports sport
    on sport.id = community_sport.sport_id
  where community_sport.community_id = p_community_id
    and community_sport.is_active = true
    and community.status = 'active'
    and sport.is_active = true
  order by
    community_sport.sort_order,
    sport.sort_order,
    sport.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Intent DNA: completed Seeds remain legitimate origins.
-- Past-due unfinished Seeds are not offered as optional active DNA until their
-- target date is moved to today/future. Direct primary context remains intact.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_seed_growth_candidates(
  p_primary_seed_id uuid default null
)
returns table(
  seed_id uuid,
  seed_title text,
  seed_type_name text,
  seed_type_icon text,
  seed_scope text,
  catalog_item_id uuid,
  is_primary boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed.title,
    seed_type.name,
    seed_type.icon,
    seed.seed_scope,
    seed.catalog_item_id,
    seed.id = p_primary_seed_id
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  where seed.user_id = auth.uid()
    and (
      seed.status = 'completed'
      or (
        seed.status = 'active'
        and (
          seed.target_date is null
          or seed.target_date >= current_date
        )
      )
    )
  order by
    (seed.id = p_primary_seed_id) desc,
    case seed.status when 'active' then 0 else 1 end,
    seed.updated_at desc,
    seed.id
  limit 24;
$$;

revoke all on function public.get_community_cover_presentation(uuid)
from public;
grant execute on function public.get_community_cover_presentation(uuid)
to authenticated;

revoke all on function public.get_admin_community_cover_presentations()
from public;
grant execute on function public.get_admin_community_cover_presentations()
to authenticated;

revoke all on function public.admin_set_community_cover_presentation(
  uuid,
  text,
  integer,
  integer
)
from public;
grant execute on function public.admin_set_community_cover_presentation(
  uuid,
  text,
  integer,
  integer
)
to authenticated;

revoke all on function public.get_active_sports_for_community(uuid)
from public;
grant execute on function public.get_active_sports_for_community(uuid)
to authenticated;

revoke all on function public.get_my_seed_growth_candidates(uuid)
from public;
grant execute on function public.get_my_seed_growth_candidates(uuid)
to authenticated;

notify pgrst, 'reload schema';

commit;
