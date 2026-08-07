begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

-- Structured place identity for Visit Seed subjects. Keeping coordinates out of
-- generic JSON makes future nearby/map search possible without JSON scans.
create table if not exists public.seed_catalog_place_details (
  catalog_item_id uuid primary key references public.seed_catalog_items(id) on delete cascade,
  country_name text,
  region_name text,
  city_name text,
  address_text text,
  latitude numeric,
  longitude numeric,
  map_url text,
  external_place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_catalog_place_country_check check (country_name is null or char_length(btrim(country_name)) between 1 and 160),
  constraint seed_catalog_place_region_check check (region_name is null or char_length(btrim(region_name)) between 1 and 240),
  constraint seed_catalog_place_city_check check (city_name is null or char_length(btrim(city_name)) between 1 and 240),
  constraint seed_catalog_place_address_check check (address_text is null or char_length(btrim(address_text)) <= 1000),
  constraint seed_catalog_place_latitude_check check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint seed_catalog_place_longitude_check check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint seed_catalog_place_coordinate_pair_check check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null)),
  constraint seed_catalog_place_map_url_check check (map_url is null or char_length(btrim(map_url)) <= 2000),
  constraint seed_catalog_place_external_id_check check (external_place_id is null or char_length(btrim(external_place_id)) <= 500)
);

create index if not exists seed_catalog_place_lat_lng_idx
  on public.seed_catalog_place_details(latitude, longitude)
  where latitude is not null and longitude is not null;

create or replace function public.touch_seed_catalog_place_details_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_seed_catalog_place_details_updated_at_trigger on public.seed_catalog_place_details;
create trigger touch_seed_catalog_place_details_updated_at_trigger
before update on public.seed_catalog_place_details
for each row execute function public.touch_seed_catalog_place_details_updated_at();

alter table public.seed_catalog_place_details enable row level security;
drop policy if exists seed_catalog_place_details_visible_select on public.seed_catalog_place_details;
create policy seed_catalog_place_details_visible_select
on public.seed_catalog_place_details
for select
using (
  exists (
    select 1
    from public.seed_catalog_items item
    where item.id = seed_catalog_place_details.catalog_item_id
      and (
        item.status = 'active'
        or (auth.uid() is not null and item.created_by = auth.uid())
        or (auth.uid() is not null and public.is_admin())
      )
  )
);

-- Exact queue counts for the admin dashboard and Seed Library tabs.
create or replace function public.get_admin_seed_catalog_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or not public.is_admin() then
      jsonb_build_object('pending', 0, 'active', 0, 'under_review', 0, 'rejected', 0, 'merged', 0)
    else
      jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'active', count(*) filter (where status = 'active'),
        'under_review', count(*) filter (where status = 'under_review'),
        'rejected', count(*) filter (where status = 'rejected'),
        'merged', count(*) filter (where status = 'merged')
      )
    end
  from public.seed_catalog_items;
$$;

-- Admin edit with generic metadata + structured place identity. Metadata is
-- merged rather than replaced so future fields are not accidentally erased.
create or replace function public.admin_update_seed_catalog_item_v3(
  p_catalog_item_id uuid,
  p_canonical_title text,
  p_creator_name text default null,
  p_original_title text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_language_code text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_place_country text default null,
  p_place_region text default null,
  p_place_city text default null,
  p_place_address_text text default null,
  p_place_latitude numeric default null,
  p_place_longitude numeric default null,
  p_place_map_url text default null,
  p_place_external_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item_id uuid;
  v_seed_type_slug text;
  v_item_kind text;
  v_has_place_data boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  v_item_id := public.admin_update_seed_catalog_item(
    p_catalog_item_id,
    p_canonical_title,
    p_creator_name,
    p_original_title,
    p_release_year,
    p_cover_url,
    p_language_code
  );

  update public.seed_catalog_items item
  set metadata = jsonb_strip_nulls(coalesce(item.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)),
      updated_at = now()
  where item.id = v_item_id;

  select seed_type.slug, item.item_kind
  into v_seed_type_slug, v_item_kind
  from public.seed_catalog_items item
  join public.seed_types seed_type on seed_type.id = item.seed_type_id
  where item.id = v_item_id;

  v_has_place_data :=
    nullif(btrim(p_place_country), '') is not null
    or nullif(btrim(p_place_region), '') is not null
    or nullif(btrim(p_place_city), '') is not null
    or nullif(btrim(p_place_address_text), '') is not null
    or p_place_latitude is not null
    or p_place_longitude is not null
    or nullif(btrim(p_place_map_url), '') is not null
    or nullif(btrim(p_place_external_id), '') is not null;

  if v_seed_type_slug = 'visit' or v_item_kind = 'place' then
    if (p_place_latitude is null) <> (p_place_longitude is null) then
      raise exception 'Latitude and longitude must be provided together.' using errcode = '22023';
    end if;

    if p_place_latitude is not null and (p_place_latitude < -90 or p_place_latitude > 90) then
      raise exception 'Latitude is invalid.' using errcode = '22023';
    end if;

    if p_place_longitude is not null and (p_place_longitude < -180 or p_place_longitude > 180) then
      raise exception 'Longitude is invalid.' using errcode = '22023';
    end if;

    if v_has_place_data then
      insert into public.seed_catalog_place_details (
        catalog_item_id,
        country_name,
        region_name,
        city_name,
        address_text,
        latitude,
        longitude,
        map_url,
        external_place_id
      ) values (
        v_item_id,
        nullif(btrim(p_place_country), ''),
        nullif(btrim(p_place_region), ''),
        nullif(btrim(p_place_city), ''),
        nullif(btrim(p_place_address_text), ''),
        p_place_latitude,
        p_place_longitude,
        public.normalize_seed_url(p_place_map_url),
        nullif(btrim(p_place_external_id), '')
      )
      on conflict (catalog_item_id) do update
      set country_name = excluded.country_name,
          region_name = excluded.region_name,
          city_name = excluded.city_name,
          address_text = excluded.address_text,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          map_url = excluded.map_url,
          external_place_id = excluded.external_place_id,
          updated_at = now();
    else
      delete from public.seed_catalog_place_details where catalog_item_id = v_item_id;
    end if;
  end if;

  return v_item_id;
end;
$$;

create or replace function public.admin_create_seed_catalog_item_v3(
  p_seed_type_id uuid,
  p_item_kind text,
  p_canonical_title text,
  p_original_title text default null,
  p_creator_name text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_language_code text default null,
  p_aliases text[] default '{}'::text[],
  p_metadata jsonb default '{}'::jsonb,
  p_place_country text default null,
  p_place_region text default null,
  p_place_city text default null,
  p_place_address_text text default null,
  p_place_latitude numeric default null,
  p_place_longitude numeric default null,
  p_place_map_url text default null,
  p_place_external_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  v_item_id := public.admin_create_seed_catalog_item(
    p_seed_type_id,
    p_item_kind,
    p_canonical_title,
    p_original_title,
    p_creator_name,
    p_release_year,
    p_cover_url,
    p_language_code,
    p_aliases
  );

  update public.seed_catalog_items item
  set metadata = jsonb_strip_nulls(coalesce(item.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)),
      updated_at = now()
  where item.id = v_item_id;

  perform public.admin_update_seed_catalog_item_v3(
    v_item_id,
    p_canonical_title,
    p_creator_name,
    p_original_title,
    p_release_year,
    p_cover_url,
    p_language_code,
    p_metadata,
    p_place_country,
    p_place_region,
    p_place_city,
    p_place_address_text,
    p_place_latitude,
    p_place_longitude,
    p_place_map_url,
    p_place_external_id
  );

  return v_item_id;
end;
$$;

-- Admin feed: queue context, structured place data and likely duplicate
-- candidates. Candidates are deliberately limited to the same Seed Type and
-- subject kind so a place can never suggest merging into a book.
create or replace function public.get_admin_seed_catalog_items(
  p_status text default 'pending',
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_query text := nullif(public.normalize_seed_catalog_text(p_query), '');
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  with selected_items as (
    select item.id
    from public.seed_catalog_items item
    where (p_status is null or p_status = '' or item.status = p_status)
      and (
        v_query is null
        or item.normalized_title like '%' || v_query || '%'
        or item.normalized_creator like '%' || v_query || '%'
        or exists (
          select 1 from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias like '%' || v_query || '%'
        )
      )
    order by
      case item.status when 'under_review' then 0 when 'pending' then 1 when 'active' then 2 else 3 end,
      item.created_at desc,
      item.id desc
    limit greatest(1, least(coalesce(p_limit, 100), 300))
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'catalog_item_id', item.id,
      'seed_type_id', item.seed_type_id,
      'seed_type_name', seed_type.name,
      'seed_type_slug', seed_type.slug,
      'seed_type_icon', seed_type.icon,
      'item_kind', item.item_kind,
      'canonical_title', item.canonical_title,
      'original_title', item.original_title,
      'creator_name', item.creator_name,
      'release_year', item.release_year,
      'cover_url', item.cover_url,
      'language_code', item.language_code,
      'status', item.status,
      'metadata', item.metadata,
      'created_at', item.created_at,
      'created_by', case when creator.id is null then null else jsonb_build_object(
        'user_id', creator.id, 'full_name', creator.full_name, 'username', creator.username
      ) end,
      'place', case when place.catalog_item_id is null then null else jsonb_build_object(
        'country_name', place.country_name,
        'region_name', place.region_name,
        'city_name', place.city_name,
        'address_text', place.address_text,
        'latitude', place.latitude,
        'longitude', place.longitude,
        'map_url', place.map_url,
        'external_place_id', place.external_place_id
      ) end,
      'personal_seed_count', (select count(*)::bigint from public.seeds seed where seed.catalog_item_id = item.id),
      'report_count', (select count(*)::bigint from public.seed_catalog_reports report where report.catalog_item_id = item.id and report.status = 'open'),
      'latest_report', (
        select jsonb_build_object(
          'report_id', report.id,
          'reason', report.reason,
          'details', report.details,
          'created_at', report.created_at,
          'reporter', jsonb_build_object(
            'user_id', reporter.id,
            'full_name', reporter.full_name,
            'username', reporter.username
          )
        )
        from public.seed_catalog_reports report
        left join public.profiles reporter on reporter.id = report.reporter_id
        where report.catalog_item_id = item.id and report.status = 'open'
        order by report.created_at desc, report.id desc
        limit 1
      ),
      'aliases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', alias.id, 'alias', alias.alias, 'language_code', alias.language_code,
          'source', alias.source, 'is_primary', alias.is_primary
        ) order by alias.is_primary desc, lower(alias.alias), alias.id)
        from public.seed_catalog_aliases alias
        where alias.catalog_item_id = item.id
      ), '[]'::jsonb),
      'duplicate_candidates', case
        when item.status in ('pending', 'under_review') then coalesce((
          select jsonb_agg(candidate.payload order by candidate.score desc, candidate.title)
          from (
            select
              greatest(
                similarity(item.normalized_title, target.normalized_title),
                coalesce((
                  select max(similarity(item.normalized_title, target_alias.normalized_alias))
                  from public.seed_catalog_aliases target_alias
                  where target_alias.catalog_item_id = target.id
                ), 0),
                coalesce((
                  select max(similarity(source_alias.normalized_alias, target.normalized_title))
                  from public.seed_catalog_aliases source_alias
                  where source_alias.catalog_item_id = item.id
                ), 0)
              ) + case
                when coalesce(item.normalized_creator, '') <> ''
                  and item.normalized_creator = target.normalized_creator then 0.12
                else 0
              end as score,
              target.canonical_title as title,
              jsonb_build_object(
                'catalog_item_id', target.id,
                'canonical_title', target.canonical_title,
                'creator_name', target.creator_name,
                'item_kind', target.item_kind,
                'score', round((greatest(
                  similarity(item.normalized_title, target.normalized_title),
                  coalesce((select max(similarity(item.normalized_title, ta.normalized_alias)) from public.seed_catalog_aliases ta where ta.catalog_item_id = target.id), 0),
                  coalesce((select max(similarity(sa.normalized_alias, target.normalized_title)) from public.seed_catalog_aliases sa where sa.catalog_item_id = item.id), 0)
                ) + case when coalesce(item.normalized_creator, '') <> '' and item.normalized_creator = target.normalized_creator then 0.12 else 0 end)::numeric, 3)
              ) as payload
            from public.seed_catalog_items target
            where target.status = 'active'
              and target.id <> item.id
              and target.seed_type_id = item.seed_type_id
              and target.item_kind = item.item_kind
              and (
                similarity(item.normalized_title, target.normalized_title) >= 0.38
                or target.normalized_title like '%' || item.normalized_title || '%'
                or item.normalized_title like '%' || target.normalized_title || '%'
                or exists (
                  select 1
                  from public.seed_catalog_aliases ta
                  where ta.catalog_item_id = target.id
                    and similarity(item.normalized_title, ta.normalized_alias) >= 0.38
                )
              )
            order by score desc, target.canonical_title
            limit 3
          ) candidate
          where candidate.score >= 0.38
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
    ) order by
      case item.status when 'under_review' then 0 when 'pending' then 1 when 'active' then 2 else 3 end,
      item.created_at desc, item.id desc
  ), '[]'::jsonb)
  into v_result
  from selected_items selected
  join public.seed_catalog_items item on item.id = selected.id
  join public.seed_types seed_type on seed_type.id = item.seed_type_id
  left join public.profiles creator on creator.id = item.created_by
  left join public.seed_catalog_place_details place on place.catalog_item_id = item.id;

  return v_result;
end;
$$;

revoke all on table public.seed_catalog_place_details from public, anon, authenticated;
grant select on table public.seed_catalog_place_details to anon, authenticated;

revoke all on function public.get_admin_seed_catalog_counts() from public;
revoke all on function public.admin_update_seed_catalog_item_v3(uuid, text, text, text, integer, text, text, jsonb, text, text, text, text, numeric, numeric, text, text) from public;
revoke all on function public.admin_create_seed_catalog_item_v3(uuid, text, text, text, text, integer, text, text, text[], jsonb, text, text, text, text, numeric, numeric, text, text) from public;

grant execute on function public.get_admin_seed_catalog_counts() to authenticated;
grant execute on function public.admin_update_seed_catalog_item_v3(uuid, text, text, text, integer, text, text, jsonb, text, text, text, text, numeric, numeric, text, text) to authenticated;
grant execute on function public.admin_create_seed_catalog_item_v3(uuid, text, text, text, text, integer, text, text, text[], jsonb, text, text, text, text, numeric, numeric, text, text) to authenticated;

commit;
