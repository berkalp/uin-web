begin;

create or replace function public.admin_save_place_coordinates_v128(
  p_target_id uuid,
  p_latitude double precision,
  p_longitude double precision
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  coordinate_patch jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin yetkisi gerekir.' using errcode='42501';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Enlem ve boylam birlikte girilmelidir.';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then
    raise exception 'Koordinatlar geçerli aralıkta değil.';
  end if;
  if not exists (
    select 1 from public.seed_catalog_items
    where canonical_target_id=p_target_id and item_kind='place' and status='active'
  ) then
    raise exception 'Yer kartı bulunamadı.';
  end if;

  if p_latitude is not null then
    coordinate_patch := jsonb_build_object('latitude',p_latitude,'longitude',p_longitude);
  end if;

  update public.seed_catalog_items
  set metadata=((coalesce(metadata,'{}'::jsonb)-'latitude'-'longitude'-'lat'-'lng'-'lon')||coordinate_patch),
      updated_at=now()
  where canonical_target_id=p_target_id and item_kind='place' and status<>'rejected';

  update public.canonical_targets
  set editorial_metadata=((coalesce(editorial_metadata,'{}'::jsonb)-'latitude'-'longitude'-'lat'-'lng'-'lon')||coordinate_patch),
      updated_at=now()
  where id=p_target_id;
end;
$$;

revoke all on function public.admin_save_place_coordinates_v128(uuid,double precision,double precision) from public,anon;
grant execute on function public.admin_save_place_coordinates_v128(uuid,double precision,double precision) to authenticated;
notify pgrst,'reload schema';
commit;
