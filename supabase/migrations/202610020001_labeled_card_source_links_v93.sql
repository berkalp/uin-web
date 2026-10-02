begin;

create or replace function public.admin_save_uin_card_reference_links_v93(
  p_target_id uuid,
  p_links jsonb
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_links jsonb;
  v_first_url text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin yetkisi gerekir.' using errcode='42501';
  end if;
  if p_target_id is null or not exists(select 1 from public.canonical_targets where id=p_target_id) then
    raise exception 'Kart bulunamadı.';
  end if;
  if p_links is null or jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links)>20 then
    raise exception 'Kaynak bağlantıları geçersiz.';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_links) item
    where jsonb_typeof(item)<>'object'
      or length(btrim(coalesce(item->>'label','')))>80
      or nullif(btrim(coalesce(item->>'url','')),'') is null
      or btrim(item->>'url') !~* '^https?://'
  ) then
    raise exception 'Kaynak bağlantılarını kontrol et.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label',coalesce(nullif(btrim(item->>'label'),''),'Kaynak'),
        'url',btrim(item->>'url')
      )
      order by ordinality
    ),
    '[]'::jsonb
  )
  into v_links
  from jsonb_array_elements(p_links) with ordinality as source(item,ordinality);

  v_first_url=nullif(v_links->0->>'url','');

  update public.canonical_targets
  set editorial_metadata=case
    when jsonb_array_length(v_links)=0 then coalesce(editorial_metadata,'{}'::jsonb)-'reference_links'-'reference_url'
    else jsonb_set(
      jsonb_set(coalesce(editorial_metadata,'{}'::jsonb),'{reference_links}',v_links,true),
      '{reference_url}',to_jsonb(v_first_url),true
    )
  end
  where id=p_target_id;

  update public.seed_catalog_items
  set metadata=case
    when jsonb_array_length(v_links)=0 then coalesce(metadata,'{}'::jsonb)-'reference_links'-'reference_url'
    else jsonb_set(
      jsonb_set(coalesce(metadata,'{}'::jsonb),'{reference_links}',v_links,true),
      '{reference_url}',to_jsonb(v_first_url),true
    )
  end
  where canonical_target_id=p_target_id;
end;
$$;

revoke all on function public.admin_save_uin_card_reference_links_v93(uuid,jsonb) from public,anon;
grant execute on function public.admin_save_uin_card_reference_links_v93(uuid,jsonb) to authenticated;

create or replace function public.get_uin_card_profile_v60(p_target_id uuid) returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'title',t.title,
    'creator_name',case
      when coalesce((t.editorial_metadata->>'subtitle_hidden')::boolean,false) then null
      when exists(
        select 1 from public.uin_content_types ct
        where ct.id=t.editorial_metadata->>'content_type_id'
          and (
            ct.base_kind not in ('artist','book','movie','series','game','director','actor','writer')
            or ct.id ~* '(festival|concert|konser)'
          )
      ) then null
      else coalesce(t.creator_name,c.creator_name)
    end,
    'cover_url',coalesce(t.editorial_cover_url,c.cover_url),
    'catalog_item_id',c.id,
    'metadata',jsonb_build_object(
      'cover_position_y',t.editorial_metadata->'cover_position_y',
      'content_type_id',t.editorial_metadata->'content_type_id',
      'description',coalesce(t.editorial_metadata->'description',c.metadata->'description',c.metadata->'overview',c.metadata->'summary'),
      'reference_links',coalesce(t.editorial_metadata->'reference_links',c.metadata->'reference_links'),
      'reference_url',coalesce(t.editorial_metadata->'reference_url',c.metadata->'reference_url'),
      'legacy_viewing_context',t.editorial_metadata->'legacy_viewing_context',
      'club_profile',public.club_public_profile_v61(t.editorial_metadata->'club_profile')
    )
  )
  from public.canonical_targets t
  left join lateral(
    select id,creator_name,cover_url,metadata
    from public.seed_catalog_items
    where canonical_target_id=t.id and status='active'
    order by updated_at desc
    limit 1
  ) c on true
  where t.id=p_target_id
    and (coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true' or public.is_admin());
$$;

notify pgrst,'reload schema';
commit;
