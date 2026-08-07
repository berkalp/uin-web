-- Run after migrations 032 through 037.
-- These checks are non-mutating and verify the database contract used by the UI.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seeds'
      and column_name = 'origin'
  ) then
    raise exception 'seeds.origin is missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seeds'
      and column_name = 'completed_date_precision'
  ) then
    raise exception 'seeds.completed_date_precision is missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seeds'
      and column_name = 'completed_year'
  ) then
    raise exception 'seeds.completed_year is missing.';
  end if;

  if to_regprocedure(
    'public.add_past_seed_experience_from_catalog(uuid,date,text,integer,text,text,text)'
  ) is null then
    raise exception 'Past Seed experience RPC is missing.';
  end if;

  if to_regprocedure(
    'public.complete_my_seed_with_reflection_v2(uuid,date,text,integer,text,text,text,jsonb)'
  ) is null then
    raise exception 'Seed completion v2 RPC is missing.';
  end if;

  if to_regprocedure(
    'public.admin_create_seed_catalog_item(uuid,text,text,text,text,integer,text,text,text[])'
  ) is null then
    raise exception 'Admin Library creation RPC is missing.';
  end if;
end;
$$;
