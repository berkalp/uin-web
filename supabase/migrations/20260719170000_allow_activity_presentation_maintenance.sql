begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Presentation metadata remains maintainable after finalization because it is
-- not part of the Activity lifecycle record. Schedule, attendance and status
-- remain controlled by their dedicated workflows.

create or replace function public.update_plan_presentation_details(
  p_plan_id uuid,
  p_cover_url text default null,
  p_address_text text default null,
  p_map_url text default null,
  p_street_view_url text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
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
  v_address_text text;
  v_map_url text;
  v_street_view_url text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception
      'Plan not found.'
      using errcode = 'P0002';
  end if;

  if v_plan.status not in (
    'forming',
    'planned',
    'completed',
    'cancelled'
  ) then
    raise exception
      'Unsupported Plan lifecycle status.'
      using errcode = '22023';
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
  v_address_text := nullif(btrim(p_address_text), '');
  v_map_url := nullif(btrim(p_map_url), '');
  v_street_view_url := nullif(btrim(p_street_view_url), '');

  if v_cover_url is not null
     and (
       length(v_cover_url) > 2000
       or v_cover_url !~* '^https?://'
     )
  then
    raise exception
      'Cover URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if v_address_text is not null
     and length(v_address_text) > 1000
  then
    raise exception
      'Address must be 1000 characters or fewer.'
      using errcode = '22023';
  end if;

  if v_map_url is not null
     and (
       length(v_map_url) > 2000
       or v_map_url !~* '^https?://'
     )
  then
    raise exception
      'Map URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if v_street_view_url is not null
     and (
       length(v_street_view_url) > 2000
       or v_street_view_url !~* '^https?://'
     )
  then
    raise exception
      'Street View URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if (p_latitude is null) <> (p_longitude is null) then
    raise exception
      'Latitude and longitude must be supplied together.'
      using errcode = '22023';
  end if;

  if p_latitude is not null
     and p_latitude not between -90 and 90
  then
    raise exception
      'Latitude must be between -90 and 90.'
      using errcode = '22023';
  end if;

  if p_longitude is not null
     and p_longitude not between -180 and 180
  then
    raise exception
      'Longitude must be between -180 and 180.'
      using errcode = '22023';
  end if;

  update public.plans
  set
    cover_url = v_cover_url,
    address_text = v_address_text,
    map_url = v_map_url,
    street_view_url = v_street_view_url,
    latitude = p_latitude,
    longitude = p_longitude,
    updated_at = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'cover_url', v_cover_url,
    'address_text', v_address_text,
    'map_url', v_map_url,
    'street_view_url', v_street_view_url,
    'latitude', p_latitude,
    'longitude', p_longitude
  );
end;
$function$;

revoke all
on function public.update_plan_presentation_details(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric
)
from public;

grant execute
on function public.update_plan_presentation_details(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric
)
to authenticated;

comment on function public.update_plan_presentation_details(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric
)
is
  'Updates non-lifecycle presentation metadata for a Plan or Activity. Access is limited to the Primary Host and active Co-hosts. Schedule, attendance and lifecycle state are not changed.';

commit;
