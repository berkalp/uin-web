-- Run after migrations 032 through 037.
do $$
declare
  v_a text;
  v_b text;
  v_c text;
  v_item_id uuid;
begin
  v_a := public.normalize_seed_catalog_text('Suç ve Ceza');
  v_b := public.normalize_seed_catalog_text('Suç & Ceza');
  v_c := public.normalize_seed_catalog_text('Suc ve Ceza');

  if v_a <> 'suc ceza' or v_b <> v_a or v_c <> v_a then
    raise exception 'Seed catalogue normalization failed: %, %, %', v_a, v_b, v_c;
  end if;

  select item.id
  into v_item_id
  from public.seed_catalog_items item
  join public.seed_types seed_type on seed_type.id = item.seed_type_id
  where seed_type.slug = 'read'
    and item.normalized_title = v_a
    and item.status = 'active'
  limit 1;

  if v_item_id is null then
    raise exception 'Demonstration Suç ve Ceza catalogue item was not installed.';
  end if;

  if not exists (
    select 1
    from public.seed_catalog_aliases alias
    where alias.catalog_item_id = v_item_id
      and alias.normalized_alias = public.normalize_seed_catalog_text('Crime and Punishment')
  ) then
    raise exception 'Translated Seed catalogue alias was not installed.';
  end if;
end;
$$;


do $$
begin
  if to_regprocedure('public.get_my_seed_catalog_identity(uuid)') is null then
    raise exception 'Seed Library identity RPC is missing.';
  end if;

  if to_regprocedure('public.admin_update_seed_catalog_item(uuid,text,text,text,integer,text,text)') is null then
    raise exception 'Seed Catalogue admin update RPC is missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'sync_seed_catalogue_identity_to_instances_trigger'
      and not tgisinternal
  ) then
    raise exception 'Seed Catalogue identity sync trigger is missing.';
  end if;
end;
$$;
