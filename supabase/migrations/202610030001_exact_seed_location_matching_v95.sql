begin;

create or replace function public.get_my_intent_location_default_v20_1(
  p_seed_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_place_text text := null;
  v_seed_key text := null;
  v_location public.locations%rowtype;
  v_source text := null;
  v_seed_title text := null;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_seed_id is not null then
    select
      seed.title,
      public.normalize_activity_catalogue_name(seed.title),
      public.normalize_activity_catalogue_name(
        concat_ws(
          ' ',
          seed.title,
          item.canonical_title,
          item.original_title,
          place.country_name,
          place.region_name,
          place.city_name,
          place.address_text,
          item.metadata::text
        )
      )
    into v_seed_title, v_seed_key, v_place_text
    from public.seeds seed
    left join public.seed_catalog_items item on item.id = seed.catalog_item_id
    left join public.seed_catalog_place_details place on place.catalog_item_id = seed.catalog_item_id
    where seed.id = p_seed_id
      and seed.user_id = v_user_id
    limit 1;

    if v_place_text is not null and v_place_text <> '' then
      select location.*
      into v_location
      from public.locations location
      where
        (
          location.scope = 'district'
          and public.normalize_activity_catalogue_name(coalesce(location.district, '')) <> ''
          and (
            v_seed_key = public.normalize_activity_catalogue_name(location.district)
            or (' ' || v_place_text || ' ') like '% ' || public.normalize_activity_catalogue_name(location.district) || ' %'
          )
        )
        or (
          location.scope = 'city'
          and public.normalize_activity_catalogue_name(coalesce(location.city, '')) <> ''
          and (
            v_seed_key = public.normalize_activity_catalogue_name(location.city)
            or (' ' || v_place_text || ' ') like '% ' || public.normalize_activity_catalogue_name(location.city) || ' %'
          )
        )
        or (
          location.scope = 'country'
          and public.normalize_activity_catalogue_name(coalesce(location.country_name, '')) <> ''
          and (
            v_seed_key = public.normalize_activity_catalogue_name(location.country_name)
            or (' ' || v_place_text || ' ') like '% ' || public.normalize_activity_catalogue_name(location.country_name) || ' %'
          )
        )
      order by
        case
          when location.scope = 'district'
            and v_seed_key = public.normalize_activity_catalogue_name(location.district) then 600
          when location.scope = 'city'
            and v_seed_key = public.normalize_activity_catalogue_name(location.city) then 600
          when location.scope = 'country'
            and v_seed_key = public.normalize_activity_catalogue_name(location.country_name) then 600
          when location.scope = 'district' then 300
          when location.scope = 'city' then 200
          else 100
        end desc,
        char_length(coalesce(location.district, location.city, location.country_name, '')) desc,
        location.id
      limit 1;

      if v_location.id is not null then
        v_source := 'seed';
      end if;
    end if;
  end if;

  if v_location.id is null then
    select location.*
    into v_location
    from public.intents intent
    join public.locations location on location.id = intent.location_id
    where intent.user_id = v_user_id
    order by intent.created_at desc, intent.id desc
    limit 1;

    if v_location.id is not null then
      v_source := 'recent';
    end if;
  end if;

  if v_location.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'location_id', v_location.id,
    'source', v_source,
    'seed_title', v_seed_title,
    'country_name', v_location.country_name,
    'city', v_location.city,
    'district', v_location.district,
    'scope', v_location.scope,
    'label', concat_ws(
      ', ',
      v_location.district,
      v_location.city,
      case
        when v_location.country_name is null then null
        when v_location.city = v_location.country_name then null
        else v_location.country_name
      end
    )
  );
end;
$$;

revoke all on function public.get_my_intent_location_default_v20_1(uuid) from public;
grant execute on function public.get_my_intent_location_default_v20_1(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
