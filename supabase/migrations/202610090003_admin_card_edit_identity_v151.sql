begin;
set local lock_timeout='10s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- Editing an existing card must not collide with another catalogue placement
-- that already belongs to the same canonical card. Creator/subtitle is only
-- part of identity for media works, so clearing a legacy place subtitle is a
-- metadata edit rather than a new-card collision.
create or replace function public.guard_uin_card_insert_v73()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare k text;
begin
  select base_kind into k from public.uin_content_types where id=new.metadata->>'content_type_id';
  k:=coalesce(k,case when new.item_kind='video' then 'series' else new.item_kind end);
  if k in ('sport','club') and auth.uid() is not null and not public.is_admin() then
    raise exception 'Spor ve spor kulübü kartlarını yalnızca admin ekleyebilir.' using errcode='42501';
  end if;
  if tg_op='UPDATE'
    and public.canonical_normalize_v31(old.canonical_title)=public.canonical_normalize_v31(new.canonical_title)
    and coalesce((select base_kind from public.uin_content_types where id=old.metadata->>'content_type_id'),case when old.item_kind='video' then 'series' else old.item_kind end)=k
    and old.status=new.status
    and (k not in ('movie','series','book','game') or coalesce(old.creator_name,'')=coalesce(new.creator_name,''))
  then
    return new;
  end if;
  if new.status in ('active','pending') then
    perform pg_advisory_xact_lock(hashtextextended(k||':'||public.canonical_normalize_v31(new.canonical_title),0));
    if exists(
      select 1
      from public.seed_catalog_items ci
      left join public.canonical_targets target on target.id=ci.canonical_target_id
      left join public.uin_content_types ct on ct.id=coalesce(ci.metadata->>'content_type_id',target.editorial_metadata->>'content_type_id')
      where ci.id<>new.id
        and (new.canonical_target_id is null or ci.canonical_target_id is distinct from new.canonical_target_id)
        and ci.status in ('active','pending')
        and coalesce(ct.base_kind,case when ci.item_kind='video' then 'series' else ci.item_kind end)=k
        and (
          public.canonical_normalize_v31(ci.canonical_title)=public.canonical_normalize_v31(new.canonical_title)
          or public.canonical_normalize_v31(target.title)=public.canonical_normalize_v31(new.canonical_title)
        )
        and (
          k not in ('movie','series','book','game')
          or nullif(btrim(new.creator_name),'') is null
          or nullif(btrim(ci.creator_name),'') is null
          or public.canonical_normalize_v31(ci.creator_name)=public.canonical_normalize_v31(new.creator_name)
        )
    ) then
      raise exception 'Bu UIN kartı zaten var. Mevcut kartı açabilirsin.' using errcode='23505';
    end if;
  end if;
  return new;
end;$$;

-- Country -> province/city -> district -> place is a valid hierarchy. Earlier
-- code only accepted a parent for district/place, so existing province cards
-- such as Ankara could not be saved without deleting their country link.
create or replace function public.admin_save_place_card_v74(
  p_target_id uuid,p_title text,p_type_id text,p_creator_name text,p_cover_url text,
  p_description text,p_reference_url text,p_profile jsonb,p_cover_position_y numeric,
  p_place_kind text,p_parent_target_id uuid
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cursor_id uuid;visited uuid[]:=array[p_target_id];v_hierarchy jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if not exists(select 1 from public.uin_content_types where id=p_type_id and base_kind='place') then raise exception 'Bu işlem yalnızca yer kartlarında kullanılabilir.';end if;
  if p_place_kind not in ('','Ülke','İl','Şehir','İlçe','Yer') or p_place_kind is null then raise exception 'Yer türü geçersiz.';end if;
  if p_parent_target_id is not null and p_place_kind in ('','Ülke') then raise exception 'Ülke veya otomatik yer türü bir üst yere bağlanamaz.';end if;
  if p_parent_target_id is not null and not exists(
    select 1 from public.canonical_targets t
    join public.seed_catalog_items c on c.canonical_target_id=t.id
    where t.id=p_parent_target_id and c.item_kind='place' and c.status='active'
      and coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true'
  ) then raise exception 'Bağlı üst yer kartı bulunamadı.';end if;
  cursor_id:=p_parent_target_id;
  while cursor_id is not null loop
    if cursor_id=any(visited) then raise exception 'Bir yer kendisine veya altındaki bir yere bağlanamaz.';end if;
    visited:=array_append(visited,cursor_id);
    select nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid into cursor_id
    from public.canonical_targets where id=cursor_id;
  end loop;
  perform public.admin_save_uin_card_v62(p_target_id,p_title,p_type_id,p_creator_name,p_cover_url,p_description,p_reference_url,p_profile,p_cover_position_y);
  v_hierarchy:=jsonb_build_object('kind',nullif(p_place_kind,''),'parent_target_id',p_parent_target_id);
  update public.canonical_targets target
  set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object('place_hierarchy',v_hierarchy)
  where target.id=p_target_id and target.editorial_metadata->'place_hierarchy' is distinct from v_hierarchy;
end;$$;

revoke all on function public.guard_uin_card_insert_v73(),public.admin_save_place_card_v74(uuid,text,text,text,text,text,text,jsonb,numeric,text,uuid) from public,anon;
grant execute on function public.admin_save_place_card_v74(uuid,text,text,text,text,text,text,jsonb,numeric,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;