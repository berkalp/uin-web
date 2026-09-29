begin;

create or replace function public.ensure_my_uin_experience_seed_v82(p_target_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_seed uuid;
  v_catalog_item uuid;
  v_source_seed uuid;
begin
  if auth.uid() is null then
    raise exception 'Deneyim eklemek için giriş yapmalısın.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.canonical_targets target
    where target.id=p_target_id
      and coalesce(target.editorial_metadata->>'admin_hidden','false')<>'true'
  ) then
    raise exception 'Kütüphane kartı bulunamadı.' using errcode='P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':experience:'||p_target_id::text,0));

  select seed.id into v_seed
  from public.seeds seed
  where seed.user_id=auth.uid()
    and seed.canonical_target_id=p_target_id
    and seed.status in ('active','completed')
  order by case seed.status when 'completed' then 0 else 1 end,seed.updated_at desc
  limit 1;
  if v_seed is not null then return v_seed; end if;

  select item.id into v_catalog_item
  from public.seed_catalog_items item
  where item.canonical_target_id=p_target_id
    and item.status='active'
  order by item.updated_at desc,item.id
  limit 1;

  if v_catalog_item is not null then
    v_seed:=public.plant_seed_from_catalog(v_catalog_item,'everyone',null,null,null,null,null);
    if v_seed is not null then return v_seed; end if;
  end if;

  select visible.seed_id into v_source_seed
  from public.visible_canonical_seeds_v31() visible
  where visible.target_id=p_target_id
  limit 1;
  if v_source_seed is not null then
    select added.seed_id into v_seed
    from public.add_canonical_target_to_my_life_v31(v_source_seed) added;
    if v_seed is not null then return v_seed; end if;
  end if;

  raise exception 'Bu kart kişisel deneyime bağlanamadı.' using errcode='P0002';
end;
$$;

revoke all on function public.ensure_my_uin_experience_seed_v82(uuid) from public,anon;
grant execute on function public.ensure_my_uin_experience_seed_v82(uuid) to authenticated;
notify pgrst,'reload schema';
commit;