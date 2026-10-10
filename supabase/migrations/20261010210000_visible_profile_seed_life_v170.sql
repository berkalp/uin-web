-- Complete, viewer-aware public-profile Seed lifecycle projection.
--
-- This is deliberately versioned instead of replacing v24.  v24 must remain
-- available to older clients, while new clients opt into this fail-closed
-- contract.  There is no result cap: one call returns every profile Seed that
-- the current viewer may see.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

create or replace function public.get_visible_profile_seed_life_v170(
  p_profile_user_id uuid
)
returns table (
  seed_id uuid,
  catalog_item_id uuid,
  canonical_target_id uuid,
  seed_type_icon text,
  seed_type_name text,
  seed_type_slug text,
  title text,
  subtitle text,
  cover_url text,
  visibility text,
  seed_scope text,
  status text,
  target_date date,
  key_takeaway text,
  created_at timestamptz,
  updated_at timestamptz,
  relationship_status text,
  experience_precision text,
  experience_date date,
  experience_year integer,
  personal_cover_url text,
  rating integer,
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
    seed.id::uuid as seed_id,
    seed.catalog_item_id::uuid as catalog_item_id,
    -- A Seed may intentionally point at a more specific hierarchy target than
    -- its catalogue item (for example a fixture/team descendant).  The Seed
    -- identity is authoritative; the catalogue target only covers legacy rows.
    coalesce(seed.canonical_target_id, catalog_item.canonical_target_id)::uuid
      as canonical_target_id,
    seed_type.icon::text as seed_type_icon,
    seed_type.name::text as seed_type_name,
    seed_type.slug::text as seed_type_slug,
    seed.title::text as title,
    seed.subtitle::text as subtitle,
    seed.cover_url::text as cover_url,
    seed.visibility::text as visibility,
    seed.seed_scope::text as seed_scope,
    seed.status::text as status,
    seed.target_date::date as target_date,
    reflection.key_takeaway::text as key_takeaway,
    seed.created_at::timestamptz as created_at,
    seed.updated_at::timestamptz as updated_at,
    case
      when seed.status = 'completed' then 'completed'
      when personal_state.relationship_status = 'in_progress' then 'in_progress'
      else 'want'
    end::text as relationship_status,
    case
      when seed.status = 'completed' then personal_state.experience_precision
      else null
    end::text as experience_precision,
    case
      when seed.status = 'completed' then personal_state.experience_date
      else null
    end::date as experience_date,
    case
      when seed.status = 'completed' then personal_state.experience_year
      else null
    end::integer as experience_year,
    personal_state.personal_cover_url::text as personal_cover_url,
    case
      when seed.status = 'completed' then personal_state.rating
      else null
    end::integer as rating,
    seed.notes::text as notes,
    catalog_item.creator_name::text as creator_name,
    catalog_item.release_year::integer as release_year,
    catalog_item.cover_url::text as catalog_cover_url,
    catalog_item.item_kind::text as catalog_item_kind
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join public.seed_personal_state_v15 personal_state
    on personal_state.seed_id = seed.id
   and personal_state.user_id = seed.user_id
  left join public.seed_catalog_items catalog_item
    on catalog_item.id = seed.catalog_item_id
  left join lateral (
    select journal.key_takeaway
    from public.seed_journal_entries journal
    where journal.seed_id = seed.id
      and journal.entry_kind = 'reflection'
      and public.seed_is_visible_to_viewer(
        seed.user_id,
        journal.visibility,
        auth.uid()
      )
    order by journal.updated_at desc, journal.id desc
    limit 1
  ) reflection on true
  where p_profile_user_id is not null
    -- Managed-minor profiles expose only their dedicated, constrained profile
    -- shell. A direct UUID call must not bypass that boundary; the profile
    -- owner still needs the complete lifecycle for their own signed-in view.
    and (
      p_profile_user_id = auth.uid()
      or not public.is_managed_minor_user(p_profile_user_id)
    )
    and seed.user_id = p_profile_user_id
    and seed.status in ('active', 'completed')
    -- This canonical helper is viewer-aware. It grants the owner access to all
    -- profile-library visibility levels, grants everyone/friends as configured,
    -- rejects only_me for other viewers, and preserves current discovery-control
    -- rules such as accepted friendship and ignore/block policy.
    and public.seed_is_visible_to_viewer(
      seed.user_id,
      seed.visibility,
      auth.uid()
    )
    and (
      -- The owner route is the source of truth for the owner's lifecycle. It
      -- includes both scopes even while a linked catalogue subject is pending,
      -- under review or otherwise unavailable to public viewers.
      (
        seed.user_id = auth.uid()
        and seed.seed_scope in ('library', 'private')
      )
      -- Every non-owner gets the established v2 public-profile boundary and
      -- may only receive Seeds backed by an active Library subject.
      or (
        seed.user_id is distinct from auth.uid()
        and seed.seed_scope = 'library'
        and catalog_item.status = 'active'
      )
    )
  order by
    case seed.status when 'active' then 0 else 1 end,
    seed.updated_at desc,
    seed.id;
$function$;

revoke all on function public.get_visible_profile_seed_life_v170(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_visible_profile_seed_life_v170(uuid)
  to anon, authenticated, service_role;

comment on function public.get_visible_profile_seed_life_v170(uuid) is
  'Uncapped profile Seed lifecycle projection. Managed-minor rows are owner-only even for direct UUID calls. Every remaining row is filtered through seed_is_visible_to_viewer for the current auth.uid; non-owners receive active Library subjects only, while owners receive all of their Library and private scope. Archived rows are excluded.';

notify pgrst, 'reload schema';

commit;
