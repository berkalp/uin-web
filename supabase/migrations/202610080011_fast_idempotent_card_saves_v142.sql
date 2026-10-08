begin;
set local lock_timeout='10s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- Ordinary cards used to pass through the club-profile writer on every save.
-- Keep club validation for clubs, but let places/books/media use the focused
-- card writer and avoid an unrelated metadata rewrite.
create or replace function public.admin_save_uin_card_v62(
  p_target_id uuid,p_title text,p_type_id text,p_creator_name text,
  p_cover_url text,p_description text,p_reference_url text,p_profile jsonb,
  p_cover_position_y numeric
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_base text;v_patch jsonb;v_metadata jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if p_cover_position_y is null or p_cover_position_y<0 or p_cover_position_y>100 or p_cover_position_y::text='NaN' then raise exception 'Kapak konumu geçersiz.';end if;
  select base_kind into v_base from public.uin_content_types where id=p_type_id and active;
  if v_base is null then raise exception 'İçerik türü bulunamadı.';end if;
  if v_base='club' then
    perform public.admin_save_uin_club_v61(p_target_id,p_title,p_type_id,p_creator_name,p_cover_url,p_description,p_reference_url,coalesce(p_profile,'{}'::jsonb));
  else
    perform public.admin_save_uin_card_v55(p_target_id,p_title,p_type_id,p_creator_name,p_cover_url,p_description,p_reference_url);
  end if;
  v_patch:=jsonb_build_object('cover_position_y',p_cover_position_y,'subtitle_hidden',nullif(btrim(p_creator_name),'') is null);
  select coalesce(editorial_metadata,'{}'::jsonb)||v_patch into v_metadata from public.canonical_targets where id=p_target_id;
  update public.canonical_targets set editorial_metadata=v_metadata
  where id=p_target_id and editorial_metadata is distinct from v_metadata;
end;$$;

-- Saving an unchanged activity selection previously deleted and reinserted
-- every permission row. This is both unnecessary and vulnerable to lock waits.
create or replace function public.admin_replace_uin_card_activity_permissions_v114(p_target_id uuid,p_activity_ids uuid[],p_category_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_travel_id uuid;v_current_activities uuid[];v_current_categories uuid[];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
  if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.'; end if;
  if exists(select 1 from unnest(coalesce(p_activity_ids,array[]::uuid[])) id where not exists(select 1 from public.activities a where a.id=id and a.is_active)) then raise exception 'Etkinliklerden biri bulunamadı veya aktif değil.'; end if;
  if exists(select 1 from unnest(coalesce(p_category_ids,array[]::uuid[])) id where not exists(select 1 from public.activity_categories c where c.id=id and c.is_active)) then raise exception 'Etkinlik kategorilerinden biri bulunamadı veya aktif değil.'; end if;
  if public.uin_target_is_place_v114(p_target_id) then
    select id into v_travel_id from public.activity_categories where name='Travel Activity' and is_active limit 1;
    if v_travel_id is not null and not(v_travel_id=any(coalesce(p_category_ids,array[]::uuid[]))) then p_category_ids:=array_append(coalesce(p_category_ids,array[]::uuid[]),v_travel_id); end if;
  end if;
  select coalesce(array_agg(activity_id order by sort_order,activity_id),array[]::uuid[]) into v_current_activities from public.uin_card_activity_options_v106 where target_id=p_target_id;
  select coalesce(array_agg(category_id order by sort_order,category_id),array[]::uuid[]) into v_current_categories from public.uin_card_activity_category_options_v114 where target_id=p_target_id;
  if v_current_activities=coalesce(p_activity_ids,array[]::uuid[]) and v_current_categories=coalesce(p_category_ids,array[]::uuid[]) then return;end if;
  delete from public.uin_card_activity_options_v106 where target_id=p_target_id;
  insert into public.uin_card_activity_options_v106(target_id,activity_id,sort_order,created_by)
  select p_target_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_activity_ids,array[]::uuid[])) with ordinality selected(id,ordinality) on conflict do nothing;
  delete from public.uin_card_activity_category_options_v114 where target_id=p_target_id;
  insert into public.uin_card_activity_category_options_v114(target_id,category_id,sort_order,created_by)
  select p_target_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_category_ids,array[]::uuid[])) with ordinality selected(id,ordinality) on conflict do nothing;
end;$$;

-- The edit form always submits lineage. Return immediately when it is already
-- identical instead of deleting and recreating the relationship graph.
create or replace function public.admin_replace_uin_card_lineage_v111(p_target_id uuid,p_upper_target_ids uuid[],p_lower_target_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare linked_id uuid;v_upper uuid[];v_lower uuid[];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.';end if;
  if cardinality(coalesce(p_upper_target_ids,array[]::uuid[]))>50 or cardinality(coalesce(p_lower_target_ids,array[]::uuid[]))>50 then raise exception 'En fazla 50 üst ve 50 alt kart seçebilirsin.';end if;
  if p_target_id=any(coalesce(p_upper_target_ids,array[]::uuid[])) or p_target_id=any(coalesce(p_lower_target_ids,array[]::uuid[])) then raise exception 'Bir kart kendisine bağlanamaz.';end if;
  if exists(select 1 from unnest(coalesce(p_upper_target_ids,array[]::uuid[])) upper_id join unnest(coalesce(p_lower_target_ids,array[]::uuid[])) lower_id on lower_id=upper_id) then raise exception 'Aynı kart hem üst hem alt kart olamaz.';end if;
  if exists(select 1 from unnest(coalesce(p_upper_target_ids,array[]::uuid[])||coalesce(p_lower_target_ids,array[]::uuid[])) value where not exists(select 1 from public.canonical_targets target where target.id=value)) then raise exception 'Bağlanacak kartlardan biri bulunamadı.';end if;
  select coalesce(array_agg(related_target_id order by sort_order,related_target_id),array[]::uuid[]) into v_upper from public.uin_card_relations_v87 where source_target_id=p_target_id and relation_type='source_material';
  select coalesce(array_agg(source_target_id order by sort_order,source_target_id),array[]::uuid[]) into v_lower from public.uin_card_relations_v87 where related_target_id=p_target_id and relation_type='source_material';
  if v_upper=coalesce(p_upper_target_ids,array[]::uuid[]) and v_lower=coalesce(p_lower_target_ids,array[]::uuid[]) then return;end if;
  delete from public.uin_card_relations_v87 where relation_type='source_material' and (source_target_id=p_target_id or related_target_id=p_target_id);
  foreach linked_id in array coalesce(p_upper_target_ids,array[]::uuid[]) loop
    insert into public.uin_card_relations_v87(source_target_id,related_target_id,relation_type,sort_order,section_title,created_by)
    values(p_target_id,linked_id,'source_material',array_position(p_upper_target_ids,linked_id)-1,'Kaynak / üst kart',auth.uid()) on conflict(source_target_id,related_target_id,relation_type) do update set sort_order=excluded.sort_order,section_title=excluded.section_title,updated_at=now();
  end loop;
  foreach linked_id in array coalesce(p_lower_target_ids,array[]::uuid[]) loop
    insert into public.uin_card_relations_v87(source_target_id,related_target_id,relation_type,sort_order,section_title,created_by)
    values(linked_id,p_target_id,'source_material',array_position(p_lower_target_ids,linked_id)-1,'Bu karttan üretilenler',auth.uid()) on conflict(source_target_id,related_target_id,relation_type) do update set sort_order=excluded.sort_order,section_title=excluded.section_title,updated_at=now();
  end loop;
end;$$;

revoke all on function public.admin_save_uin_card_v62(uuid,text,text,text,text,text,text,jsonb,numeric),public.admin_replace_uin_card_activity_permissions_v114(uuid,uuid[],uuid[]),public.admin_replace_uin_card_lineage_v111(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.admin_save_uin_card_v62(uuid,text,text,text,text,text,text,jsonb,numeric),public.admin_replace_uin_card_activity_permissions_v114(uuid,uuid[],uuid[]),public.admin_replace_uin_card_lineage_v111(uuid,uuid[],uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
