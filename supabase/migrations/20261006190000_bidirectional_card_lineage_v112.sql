begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create or replace function public.admin_replace_uin_card_lineage_v111(
  p_target_id uuid,
  p_upper_target_ids uuid[],
  p_lower_target_ids uuid[]
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare linked_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin yetkisi gerekir.' using errcode='42501';
  end if;
  if not exists(select 1 from public.canonical_targets where id=p_target_id) then
    raise exception 'Kart bulunamadı.';
  end if;
  if cardinality(coalesce(p_upper_target_ids,array[]::uuid[]))>50 or cardinality(coalesce(p_lower_target_ids,array[]::uuid[]))>50 then
    raise exception 'En fazla 50 üst ve 50 alt kart seçebilirsin.';
  end if;
  if p_target_id=any(coalesce(p_upper_target_ids,array[]::uuid[])) or p_target_id=any(coalesce(p_lower_target_ids,array[]::uuid[])) then
    raise exception 'Bir kart kendisine bağlanamaz.';
  end if;
  if exists(
    select 1
    from unnest(coalesce(p_upper_target_ids,array[]::uuid[])) upper_id
    join unnest(coalesce(p_lower_target_ids,array[]::uuid[])) lower_id on lower_id=upper_id
  ) then
    raise exception 'Aynı kart hem üst hem alt kart olamaz.';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_upper_target_ids,array[]::uuid[])||coalesce(p_lower_target_ids,array[]::uuid[])) value
    where not exists(select 1 from public.canonical_targets target where target.id=value)
  ) then
    raise exception 'Bağlanacak kartlardan biri bulunamadı.';
  end if;

  delete from public.uin_card_relations_v87
  where relation_type='source_material' and (source_target_id=p_target_id or related_target_id=p_target_id);

  foreach linked_id in array coalesce(p_upper_target_ids,array[]::uuid[]) loop
    insert into public.uin_card_relations_v87(source_target_id,related_target_id,relation_type,sort_order,section_title,created_by)
    values(p_target_id,linked_id,'source_material',array_position(p_upper_target_ids,linked_id)-1,'Kaynak / üst kart',auth.uid())
    on conflict(source_target_id,related_target_id,relation_type) do update set sort_order=excluded.sort_order,section_title=excluded.section_title,updated_at=now();
  end loop;
  foreach linked_id in array coalesce(p_lower_target_ids,array[]::uuid[]) loop
    insert into public.uin_card_relations_v87(source_target_id,related_target_id,relation_type,sort_order,section_title,created_by)
    values(linked_id,p_target_id,'source_material',array_position(p_lower_target_ids,linked_id)-1,'Bu karttan üretilenler',auth.uid())
    on conflict(source_target_id,related_target_id,relation_type) do update set sort_order=excluded.sort_order,section_title=excluded.section_title,updated_at=now();
  end loop;
end;$$;

revoke all on function public.admin_replace_uin_card_lineage_v111(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.admin_replace_uin_card_lineage_v111(uuid,uuid[],uuid[]) to authenticated;

notify pgrst,'reload schema';
commit;
