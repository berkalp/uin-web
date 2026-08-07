begin;

drop function if exists public.get_visible_discover_map_points(uuid[]);

alter table public.locations
  drop constraint if exists locations_map_coordinates_pair_check,
  drop constraint if exists locations_map_latitude_range_check,
  drop constraint if exists locations_map_longitude_range_check,
  drop column if exists latitude,
  drop column if exists longitude;

notify pgrst, 'reload schema';

commit;
