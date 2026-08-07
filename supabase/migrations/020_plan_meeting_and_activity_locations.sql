begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- A Plan now keeps three deliberately different location concepts:
-- 1) plans.location_id: approximate public Intent area (country/city/district)
-- 2) existing meeting_point/address/map/coordinates: private meeting point
-- 3) the new activity_* columns: where the Activity actually happens

alter table public.plans
  add column if not exists activity_location_name text,
  add column if not exists activity_address_text text,
  add column if not exists activity_latitude numeric(9, 6),
  add column if not exists activity_longitude numeric(9, 6),
  add column if not exists activity_map_url text,
  add column if not exists activity_street_view_url text,
  add column if not exists meeting_location_same_as_activity boolean not null default false,
  add column if not exists activity_location_visibility text not null default 'members';

alter table public.plans
  drop constraint if exists plans_activity_location_name_length_check,
  drop constraint if exists plans_activity_address_text_length_check,
  drop constraint if exists plans_activity_map_url_http_check,
  drop constraint if exists plans_activity_street_view_url_http_check,
  drop constraint if exists plans_activity_coordinates_pair_check,
  drop constraint if exists plans_activity_latitude_range_check,
  drop constraint if exists plans_activity_longitude_range_check,
  drop constraint if exists plans_activity_location_visibility_check;

alter table public.plans
  add constraint plans_activity_location_name_length_check
    check (
      activity_location_name is null
      or length(activity_location_name) <= 500
    ),
  add constraint plans_activity_address_text_length_check
    check (
      activity_address_text is null
      or length(activity_address_text) <= 1000
    ),
  add constraint plans_activity_map_url_http_check
    check (
      activity_map_url is null
      or activity_map_url ~* '^https?://'
    ),
  add constraint plans_activity_street_view_url_http_check
    check (
      activity_street_view_url is null
      or activity_street_view_url ~* '^https?://'
    ),
  add constraint plans_activity_coordinates_pair_check
    check (
      (activity_latitude is null and activity_longitude is null)
      or (activity_latitude is not null and activity_longitude is not null)
    ),
  add constraint plans_activity_latitude_range_check
    check (
      activity_latitude is null
      or activity_latitude between -90 and 90
    ),
  add constraint plans_activity_longitude_range_check
    check (
      activity_longitude is null
      or activity_longitude between -180 and 180
    ),
  add constraint plans_activity_location_visibility_check
    check (
      activity_location_visibility in ('members', 'public')
    );

comment on column public.plans.meeting_point is
  'Private meeting point name for active Plan members. The approximate public area remains plans.location_id.';

comment on column public.plans.address_text is
  'Private meeting point address/instructions for active Plan members.';

comment on column public.plans.activity_location_name is
  'Name of the venue or place where the Activity actually happens.';

comment on column public.plans.activity_address_text is
  'Exact Activity venue address or arrival instructions.';

comment on column public.plans.meeting_location_same_as_activity is
  'When true, the meeting point is the same place as the Activity location.';

comment on column public.plans.activity_location_visibility is
  'Controls whether public screens may show only the Activity venue name. Exact address, map, coordinates and the meeting point remain Plan-member-only.';

create or replace function public.update_plan_presentation_and_locations(
  p_plan_id uuid,
  p_cover_url text default null,
  p_meeting_point text default null,
  p_meeting_address_text text default null,
  p_meeting_map_url text default null,
  p_meeting_street_view_url text default null,
  p_meeting_latitude numeric default null,
  p_meeting_longitude numeric default null,
  p_activity_location_name text default null,
  p_activity_address_text text default null,
  p_activity_map_url text default null,
  p_activity_street_view_url text default null,
  p_activity_latitude numeric default null,
  p_activity_longitude numeric default null,
  p_meeting_location_same_as_activity boolean default false,
  p_activity_location_visibility text default 'members'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan public.plans%rowtype;
  v_cover_url text;
  v_meeting_point text;
  v_meeting_address_text text;
  v_meeting_map_url text;
  v_meeting_street_view_url text;
  v_activity_location_name text;
  v_activity_address_text text;
  v_activity_map_url text;
  v_activity_street_view_url text;
  v_activity_location_visibility text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  if v_plan.status not in ('forming', 'planned', 'completed', 'cancelled') then
    raise exception 'Unsupported Plan lifecycle status.' using errcode = '22023';
  end if;

  if v_plan.host_user_id <> v_user_id
     and not exists (
       select 1
       from public.plan_members member
       where member.plan_id = p_plan_id
         and member.user_id = v_user_id
         and member.role = 'co_host'
         and member.status = 'active'
     )
  then
    raise exception
      'Only the Primary Host or an active Co-host may edit these details.'
      using errcode = '42501';
  end if;

  v_cover_url := nullif(btrim(p_cover_url), '');
  v_activity_location_name := nullif(btrim(p_activity_location_name), '');
  v_activity_address_text := nullif(btrim(p_activity_address_text), '');
  v_activity_map_url := nullif(btrim(p_activity_map_url), '');
  v_activity_street_view_url := nullif(btrim(p_activity_street_view_url), '');
  v_activity_location_visibility := lower(coalesce(nullif(btrim(p_activity_location_visibility), ''), 'members'));

  if coalesce(p_meeting_location_same_as_activity, false) then
    v_meeting_point := v_activity_location_name;
    v_meeting_address_text := v_activity_address_text;
    v_meeting_map_url := v_activity_map_url;
    v_meeting_street_view_url := v_activity_street_view_url;
    p_meeting_latitude := p_activity_latitude;
    p_meeting_longitude := p_activity_longitude;
  else
    v_meeting_point := nullif(btrim(p_meeting_point), '');
    v_meeting_address_text := nullif(btrim(p_meeting_address_text), '');
    v_meeting_map_url := nullif(btrim(p_meeting_map_url), '');
    v_meeting_street_view_url := nullif(btrim(p_meeting_street_view_url), '');
  end if;

  if v_cover_url is not null
     and (length(v_cover_url) > 2000 or v_cover_url !~* '^https?://') then
    raise exception 'Cover URL must be a valid HTTP or HTTPS URL.' using errcode = '22023';
  end if;

  if v_meeting_point is not null and length(v_meeting_point) > 500 then
    raise exception 'Meeting point name must be 500 characters or fewer.' using errcode = '22023';
  end if;

  if v_activity_location_name is not null and length(v_activity_location_name) > 500 then
    raise exception 'Activity location name must be 500 characters or fewer.' using errcode = '22023';
  end if;

  if v_meeting_address_text is not null and length(v_meeting_address_text) > 1000 then
    raise exception 'Meeting point details must be 1000 characters or fewer.' using errcode = '22023';
  end if;

  if v_activity_address_text is not null and length(v_activity_address_text) > 1000 then
    raise exception 'Activity location details must be 1000 characters or fewer.' using errcode = '22023';
  end if;

  if v_meeting_map_url is not null
     and (length(v_meeting_map_url) > 2000 or v_meeting_map_url !~* '^https?://') then
    raise exception 'Meeting map URL must be a valid HTTP or HTTPS URL.' using errcode = '22023';
  end if;

  if v_meeting_street_view_url is not null
     and (length(v_meeting_street_view_url) > 2000 or v_meeting_street_view_url !~* '^https?://') then
    raise exception 'Meeting Street View URL must be a valid HTTP or HTTPS URL.' using errcode = '22023';
  end if;

  if v_activity_map_url is not null
     and (length(v_activity_map_url) > 2000 or v_activity_map_url !~* '^https?://') then
    raise exception 'Activity map URL must be a valid HTTP or HTTPS URL.' using errcode = '22023';
  end if;

  if v_activity_street_view_url is not null
     and (length(v_activity_street_view_url) > 2000 or v_activity_street_view_url !~* '^https?://') then
    raise exception 'Activity Street View URL must be a valid HTTP or HTTPS URL.' using errcode = '22023';
  end if;

  if (p_meeting_latitude is null) <> (p_meeting_longitude is null) then
    raise exception 'Meeting latitude and longitude must be supplied together.' using errcode = '22023';
  end if;

  if (p_activity_latitude is null) <> (p_activity_longitude is null) then
    raise exception 'Activity latitude and longitude must be supplied together.' using errcode = '22023';
  end if;

  if p_meeting_latitude is not null and p_meeting_latitude not between -90 and 90 then
    raise exception 'Meeting latitude must be between -90 and 90.' using errcode = '22023';
  end if;

  if p_meeting_longitude is not null and p_meeting_longitude not between -180 and 180 then
    raise exception 'Meeting longitude must be between -180 and 180.' using errcode = '22023';
  end if;

  if p_activity_latitude is not null and p_activity_latitude not between -90 and 90 then
    raise exception 'Activity latitude must be between -90 and 90.' using errcode = '22023';
  end if;

  if p_activity_longitude is not null and p_activity_longitude not between -180 and 180 then
    raise exception 'Activity longitude must be between -180 and 180.' using errcode = '22023';
  end if;

  if v_activity_location_visibility not in ('members', 'public') then
    raise exception 'Activity location visibility must be members or public.' using errcode = '22023';
  end if;

  update public.plans
  set
    cover_url = v_cover_url,
    meeting_point = v_meeting_point,
    address_text = v_meeting_address_text,
    map_url = v_meeting_map_url,
    street_view_url = v_meeting_street_view_url,
    latitude = p_meeting_latitude,
    longitude = p_meeting_longitude,
    activity_location_name = v_activity_location_name,
    activity_address_text = v_activity_address_text,
    activity_map_url = v_activity_map_url,
    activity_street_view_url = v_activity_street_view_url,
    activity_latitude = p_activity_latitude,
    activity_longitude = p_activity_longitude,
    meeting_location_same_as_activity = coalesce(p_meeting_location_same_as_activity, false),
    activity_location_visibility = v_activity_location_visibility,
    updated_at = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'cover_url', v_cover_url,
    'meeting_point', v_meeting_point,
    'meeting_address_text', v_meeting_address_text,
    'meeting_map_url', v_meeting_map_url,
    'meeting_street_view_url', v_meeting_street_view_url,
    'meeting_latitude', p_meeting_latitude,
    'meeting_longitude', p_meeting_longitude,
    'activity_location_name', v_activity_location_name,
    'activity_address_text', v_activity_address_text,
    'activity_map_url', v_activity_map_url,
    'activity_street_view_url', v_activity_street_view_url,
    'activity_latitude', p_activity_latitude,
    'activity_longitude', p_activity_longitude,
    'meeting_location_same_as_activity', coalesce(p_meeting_location_same_as_activity, false),
    'activity_location_visibility', v_activity_location_visibility
  );
end;
$function$;

revoke all
on function public.update_plan_presentation_and_locations(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  boolean,
  text
)
from public;

grant execute
on function public.update_plan_presentation_and_locations(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  boolean,
  text
)
to authenticated;

comment on function public.update_plan_presentation_and_locations(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  boolean,
  text
)
is
  'Updates a Plan cover, its private meeting point and its separate Activity location. Only the Primary Host or an active Co-host may call it.';


create or replace function public.get_visible_public_plan_activity_locations(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  activity_location_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid := auth.uid();
begin
  if p_plan_ids is null
     or cardinality(p_plan_ids) = 0 then
    return;
  end if;

  if cardinality(p_plan_ids) > 100 then
    raise exception
      'Too many Plan records requested.'
      using errcode = '22023';
  end if;

  return query
  select
    plan.id,
    plan.activity_location_name
  from public.plans plan
  join lateral (
    select linked_intent.intent_id
    from public.plan_intents linked_intent
    where linked_intent.plan_id = plan.id
      and linked_intent.status = 'active'
    order by
      case
        when linked_intent.relationship = 'host_source' then 0
        else 1
      end,
      linked_intent.id
    limit 1
  ) source_link on true
  where plan.id = any(p_plan_ids)
    and plan.activity_location_visibility = 'public'
    and nullif(btrim(plan.activity_location_name), '') is not null
    and (
      plan.host_user_id = v_viewer_user_id
      or exists (
        select 1
        from public.plan_members viewer_member
        where viewer_member.plan_id = plan.id
          and viewer_member.user_id = v_viewer_user_id
          and viewer_member.status = 'active'
      )
      or public.can_user_view_intent_activity(
        source_link.intent_id,
        v_viewer_user_id
      )
    );
end;
$$;

revoke all
on function public.get_visible_public_plan_activity_locations(uuid[])
from public;

grant execute
on function public.get_visible_public_plan_activity_locations(uuid[])
to anon, authenticated;

comment on function public.get_visible_public_plan_activity_locations(uuid[])
is
  'Returns only an explicitly public Activity venue name for visible Plans. Exact addresses, coordinates, map URLs and meeting points are never returned.';

commit;
