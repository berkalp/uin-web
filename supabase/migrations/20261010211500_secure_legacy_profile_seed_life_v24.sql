-- Keep older web/mobile clients compatible while routing the legacy profile
-- projection through the viewer-aware v170 boundary.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

create or replace function public.get_visible_profile_seed_life_v24(
  p_profile_user_id uuid
)
returns table (
  seed_id uuid,
  seed_type_icon text,
  seed_type_name text,
  seed_type_slug text,
  title text,
  subtitle text,
  cover_url text,
  status text,
  target_date text,
  key_takeaway text,
  created_at timestamptz,
  updated_at timestamptz,
  relationship_status text,
  experience_precision text,
  experience_date date,
  experience_year integer,
  personal_cover_url text,
  rating smallint,
  notes text,
  creator_name text,
  release_year integer,
  catalog_cover_url text,
  catalog_item_kind text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    visible.seed_id,
    visible.seed_type_icon,
    visible.seed_type_name,
    visible.seed_type_slug,
    visible.title,
    visible.subtitle,
    visible.cover_url,
    visible.status,
    visible.target_date::text,
    visible.key_takeaway,
    visible.created_at,
    visible.updated_at,
    visible.relationship_status,
    visible.experience_precision,
    visible.experience_date,
    visible.experience_year,
    visible.personal_cover_url,
    visible.rating::smallint,
    visible.notes,
    visible.creator_name,
    visible.release_year,
    visible.catalog_cover_url,
    visible.catalog_item_kind
  from public.get_visible_profile_seed_life_v170(p_profile_user_id) visible;
$function$;

revoke all on function public.get_visible_profile_seed_life_v24(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_visible_profile_seed_life_v24(uuid)
  to anon, authenticated, service_role;

comment on function public.get_visible_profile_seed_life_v24(uuid) is
  'Legacy-compatible projection backed by the viewer-aware, uncapped v170 profile Seed boundary.';

notify pgrst, 'reload schema';

commit;
