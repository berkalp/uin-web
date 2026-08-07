begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

drop function if exists public.get_visible_public_plan_activity_locations(uuid[]);

drop function if exists public.update_plan_presentation_and_locations(
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
);

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
  drop column if exists activity_location_name,
  drop column if exists activity_address_text,
  drop column if exists activity_latitude,
  drop column if exists activity_longitude,
  drop column if exists activity_map_url,
  drop column if exists activity_street_view_url,
  drop column if exists meeting_location_same_as_activity,
  drop column if exists activity_location_visibility;

commit;
