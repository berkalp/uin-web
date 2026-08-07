begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Approximate map coordinates belong to the catalogue location, not the user.
-- Exact meeting-point coordinates remain private inside plans and are never
-- returned by the Discover map RPC.
alter table public.locations
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6);

alter table public.locations
  drop constraint if exists locations_map_coordinates_pair_check,
  drop constraint if exists locations_map_latitude_range_check,
  drop constraint if exists locations_map_longitude_range_check;

alter table public.locations
  add constraint locations_map_coordinates_pair_check
    check (
      (latitude is null and longitude is null)
      or (latitude is not null and longitude is not null)
    ),
  add constraint locations_map_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint locations_map_longitude_range_check
    check (longitude is null or longitude between -180 and 180);

comment on column public.locations.latitude is
  'Approximate catalogue coordinate used for public discovery maps. It must never contain a private meeting point.';
comment on column public.locations.longitude is
  'Approximate catalogue coordinate used for public discovery maps. It must never contain a private meeting point.';

-- Useful initial coordinates for the locations already used in the current
-- catalogue. Missing locations are safely geocoded from city/district text by
-- the application and may be curated later.
update public.locations
set
  latitude = case
    when scope = 'country' and country_code = 'TR' then 39.000000
    when city = 'İstanbul' and district = 'Üsküdar' then 41.025600
    when city = 'İstanbul' and district = 'Beşiktaş' then 41.043000
    when city = 'İstanbul' and district = 'Kadıköy' then 40.991700
    when city = 'İstanbul' and district = 'Adalar' then 40.876300
    when city = 'İstanbul' and district = 'Şişli' then 41.060200
    when city = 'İstanbul' and district = 'Sarıyer' then 41.166300
    when city = 'İstanbul' and district = 'Beykoz' then 41.132800
    when city = 'İstanbul' and district = 'Fatih' then 41.019300
    when city = 'İstanbul' and district = 'Bakırköy' then 40.981900
    when city = 'İstanbul' and district = 'Ataşehir' then 40.983300
    when city = 'İstanbul' and district = 'Maltepe' then 40.935700
    when city = 'İstanbul' and district = 'Kartal' then 40.889700
    when city = 'İstanbul' and district = 'Pendik' then 40.877500
    when city = 'İstanbul' and district is null then 41.008200
    when city = 'İzmir' and district = 'Bornova' then 38.462200
    when city = 'İzmir' and district is null then 38.423700
    when city = 'Bolu' then 40.735000
    when city = 'Ankara' and district = 'Çankaya' then 39.917900
    when city = 'Ankara' and district is null then 39.933400
    else latitude
  end,
  longitude = case
    when scope = 'country' and country_code = 'TR' then 35.000000
    when city = 'İstanbul' and district = 'Üsküdar' then 29.015300
    when city = 'İstanbul' and district = 'Beşiktaş' then 29.009400
    when city = 'İstanbul' and district = 'Kadıköy' then 29.027700
    when city = 'İstanbul' and district = 'Adalar' then 29.091700
    when city = 'İstanbul' and district = 'Şişli' then 28.987700
    when city = 'İstanbul' and district = 'Sarıyer' then 29.050000
    when city = 'İstanbul' and district = 'Beykoz' then 29.105700
    when city = 'İstanbul' and district = 'Fatih' then 28.949300
    when city = 'İstanbul' and district = 'Bakırköy' then 28.877200
    when city = 'İstanbul' and district = 'Ataşehir' then 29.127800
    when city = 'İstanbul' and district = 'Maltepe' then 29.155100
    when city = 'İstanbul' and district = 'Kartal' then 29.185500
    when city = 'İstanbul' and district = 'Pendik' then 29.272400
    when city = 'İstanbul' and district is null then 28.978400
    when city = 'İzmir' and district = 'Bornova' then 27.220000
    when city = 'İzmir' and district is null then 27.142800
    when city = 'Bolu' then 31.606100
    when city = 'Ankara' and district = 'Çankaya' then 32.862700
    when city = 'Ankara' and district is null then 32.859700
    else longitude
  end
where latitude is null or longitude is null;

create or replace function public.get_visible_discover_map_points(
  p_intent_ids uuid[]
)
returns table (
  intent_id uuid,
  plan_id uuid,
  latitude numeric,
  longitude numeric,
  location_precision text,
  location_query text,
  public_location_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    intent.id as intent_id,
    linked_plan.id as plan_id,
    case
      when linked_plan.activity_location_visibility = 'public'
       and linked_plan.activity_latitude is not null
       and linked_plan.activity_longitude is not null
        then linked_plan.activity_latitude
      else location.latitude
    end as latitude,
    case
      when linked_plan.activity_location_visibility = 'public'
       and linked_plan.activity_latitude is not null
       and linked_plan.activity_longitude is not null
        then linked_plan.activity_longitude
      else location.longitude
    end as longitude,
    case
      when linked_plan.activity_location_visibility = 'public'
       and linked_plan.activity_latitude is not null
       and linked_plan.activity_longitude is not null
        then 'public_venue'
      else 'approximate'
    end as location_precision,
    concat_ws(
      ', ',
      nullif(location.district, ''),
      nullif(location.city, ''),
      nullif(location.country_name, '')
    ) as location_query,
    case
      when linked_plan.activity_location_visibility = 'public'
        then nullif(btrim(linked_plan.activity_location_name), '')
      else coalesce(nullif(location.district, ''), nullif(location.city, ''))
    end as public_location_name
  from public.intents intent
  join public.locations location
    on location.id = intent.location_id
  left join lateral (
    select plan.*
    from public.plan_intents plan_intent
    join public.plans plan
      on plan.id = plan_intent.plan_id
    where plan_intent.intent_id = intent.id
      and plan_intent.status = 'active'
    order by
      case when plan_intent.relationship = 'host_source' then 0 else 1 end,
      plan.created_at desc
    limit 1
  ) linked_plan on true
  where intent.id = any(coalesce(p_intent_ids, array[]::uuid[]))
    and public.can_user_view_intent_activity(intent.id, auth.uid());
$$;

revoke all on function public.get_visible_discover_map_points(uuid[]) from public;
grant execute on function public.get_visible_discover_map_points(uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
