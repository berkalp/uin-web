begin;

set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $$
declare
  v_activity_id uuid;
  v_current_category_id uuid;
  v_current_category_name text;
  v_sport_category_id uuid;
  v_sport_category_name text;
begin
  select
    activity.id,
    activity.category_id,
    category.name
  into
    v_activity_id,
    v_current_category_id,
    v_current_category_name
  from public.activities activity
  join public.activity_categories category
    on category.id =
      activity.category_id
  where
    lower(
      btrim(
        activity.name
      )
    ) =
      'live sports match'
  order by
    activity.is_active desc,
    activity.created_at asc
  limit 1;

  if v_activity_id is null then
    raise exception
      'The canonical Activity "Live Sports Match" was not found.'
      using errcode = 'P0002';
  end if;

  select
    category.id,
    category.name
  into
    v_sport_category_id,
    v_sport_category_name
  from public.activity_categories category
  where
    category.is_active
    and lower(
      btrim(
        category.name
      )
    ) in (
      'sport activity',
      'sports activity',
      'sports',
      'sport'
    )
  order by
    case lower(
      btrim(
        category.name
      )
    )
      when 'sport activity'
        then 0
      when 'sports activity'
        then 1
      when 'sports'
        then 2
      else 3
    end,
    category.created_at asc
  limit 1;

  if v_sport_category_id is null then
    select
      category.id,
      category.name
    into
      v_sport_category_id,
      v_sport_category_name
    from public.activity_categories category
    where
      category.is_active
      and category.name ilike
        '%sport%'
    order by
      category.created_at asc
    limit 1;
  end if;

  if v_sport_category_id is null then
    raise exception
      'No active Sport Activity category was found.'
      using errcode = 'P0002';
  end if;

  if
    v_current_category_id =
      v_sport_category_id
  then
    raise notice
      '"Live Sports Match" is already under "%".',
      v_sport_category_name;

    return;
  end if;

  if exists (
    select 1
    from public.activities existing_activity
    where
      existing_activity.category_id =
        v_sport_category_id
      and lower(
        btrim(
          existing_activity.name
        )
      ) =
        'live sports match'
      and existing_activity.id <>
        v_activity_id
  ) then
    raise exception
      'Another "Live Sports Match" Activity already exists under "%". Merge the duplicate before moving this record.',
      v_sport_category_name
      using errcode = '23505';
  end if;

  update public.activities
  set
    category_id =
      v_sport_category_id,
    updated_at =
      now()
  where
    id =
      v_activity_id;

  raise notice
    'Moved "Live Sports Match" from "%" to "%".',
    v_current_category_name,
    v_sport_category_name;
end;
$$;

commit;
