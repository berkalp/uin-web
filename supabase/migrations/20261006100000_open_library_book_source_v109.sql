begin;

create or replace function public.admin_save_uin_content_type_v58(p_id text,p_label text,p_icon text,p_base_kind text,p_active boolean default true,p_ui_labels jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; cleaned jsonb:='{}'::jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
 if jsonb_typeof(p_ui_labels) is distinct from 'object' then raise exception 'Kart ayarları geçersiz.'; end if;
 for item in select key,value from jsonb_each(p_ui_labels) loop
  if item.key not in ('want','done','wanting','doers','event','action','question','search_provider','search_entity','manual_fallback') or jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>120 then raise exception 'Kart ayarları geçersiz veya çok uzun.'; end if;
  if item.key='search_provider' and (item.value#>>'{}') not in ('auto','wikidata','open_library','google_books','spotify','tvmaze','igdb','manual') then raise exception 'Arama kaynağı geçersiz.'; end if;
  if item.key='manual_fallback' and (item.value#>>'{}') not in ('true','false') then raise exception 'Öneri ayarı geçersiz.'; end if;
  if nullif(btrim(item.value#>>'{}'),'') is not null then cleaned:=cleaned||jsonb_build_object(item.key,btrim(item.value#>>'{}'));end if;
 end loop;
 perform public.admin_save_uin_content_type_v55(p_id,p_label,p_icon,p_base_kind,p_active);
 update public.uin_content_types set ui_labels=cleaned where id=p_id;
end;$$;

update public.uin_content_types
set ui_labels=coalesce(ui_labels,'{}'::jsonb)||jsonb_build_object('search_provider','open_library')
where base_kind='book'
  and coalesce(ui_labels->>'search_provider','auto') in ('auto','google_books');

create or replace function public.add_verified_seed_catalog_item_v42(
  p_seed_type_id uuid,p_item_kind text,p_canonical_title text,p_creator_name text default null,
  p_cover_url text default null,p_provider text default null,p_external_id text default null,
  p_source_url text default null,p_metadata jsonb default '{}'::jsonb
)
returns table(catalog_item_id uuid, canonical_target_id uuid)
language plpgsql security definer set search_path=public,extensions as $$
declare
  v_item uuid;v_provider text:=lower(btrim(coalesce(p_provider,'')));v_external text:=btrim(coalesce(p_external_id,''));
  v_normalized_title text:=public.canonical_normalize_v31(p_canonical_title);v_normalized_creator text:=public.canonical_normalize_v31(p_creator_name);
  v_is_book boolean:=lower(coalesce(p_item_kind,''))='book';v_isbns text[]:=public.canonical_isbn_family_v80(coalesce(p_metadata,'{}'::jsonb));
begin
  if auth.uid() is null then raise exception 'Konu eklemek için giriş yapmalısın.' using errcode='42501';end if;
  if v_provider not in ('spotify','open_library','google_books','tvmaze','igdb','wikidata') or v_external='' then raise exception 'Doğrulanmış kaynak bilgisi eksik.' using errcode='22023';end if;
  if not exists(select 1 from public.seed_types where id=p_seed_type_id and is_active) then raise exception 'Geçerli bir konu eylemi seç.' using errcode='23503';end if;
  select exists(select 1 from public.seed_types where id=p_seed_type_id and slug in ('read','book','oku')) or v_is_book into v_is_book;
  perform pg_advisory_xact_lock(hashtextextended(p_seed_type_id::text||':'||v_provider||':'||v_external||':'||v_normalized_title||':'||v_normalized_creator,0));
  select item.id into v_item from public.seed_catalog_items item
  where item.seed_type_id=p_seed_type_id and item.status in ('active','pending','approved') and (
    (lower(coalesce(item.external_source,item.metadata->>'source_provider',''))=v_provider and coalesce(item.external_id,item.metadata->>'source_external_id','')=v_external)
    or (v_is_book and cardinality(v_isbns)>0 and public.canonical_isbn_family_v80(coalesce(item.metadata,'{}'::jsonb))&&v_isbns)
    or (v_is_book and v_normalized_creator<>'' and public.canonical_normalize_v31(item.canonical_title)=v_normalized_title and public.canonical_normalize_v31(item.creator_name)=v_normalized_creator)
    or (not v_is_book and public.canonical_normalize_v31(item.canonical_title)=v_normalized_title)
  ) order by case when lower(coalesce(item.external_source,item.metadata->>'source_provider',''))=v_provider and coalesce(item.external_id,item.metadata->>'source_external_id','')=v_external then 0 when v_is_book and cardinality(v_isbns)>0 and public.canonical_isbn_family_v80(coalesce(item.metadata,'{}'::jsonb))&&v_isbns then 1 else 2 end,case item.status when 'active' then 0 when 'approved' then 1 else 2 end,item.created_at,item.id limit 1;
  if v_item is null then
    v_item:=public.suggest_seed_catalog_item(p_seed_type_id,p_item_kind,btrim(p_canonical_title),nullif(btrim(p_creator_name),''),null,null,nullif(btrim(p_cover_url),''),'tr',coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('source_provider',v_provider,'source_external_id',v_external)||case when nullif(btrim(p_source_url),'') is null then '{}'::jsonb else jsonb_build_object('reference_url',btrim(p_source_url)) end);
    update public.seed_catalog_items item set status='active',external_source=coalesce(nullif(item.external_source,''),v_provider),external_id=coalesce(nullif(item.external_id,''),v_external),metadata=coalesce(item.metadata,'{}'::jsonb)||jsonb_build_object('source_provider',v_provider,'source_external_id',v_external) where item.id=v_item;
  end if;
  return query select item.id,item.canonical_target_id from public.seed_catalog_items item where item.id=v_item;
end;$$;

revoke all on function public.admin_save_uin_content_type_v58(text,text,text,text,boolean,jsonb) from public,anon;
grant execute on function public.admin_save_uin_content_type_v58(text,text,text,text,boolean,jsonb) to authenticated;
revoke all on function public.add_verified_seed_catalog_item_v42(uuid,text,text,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.add_verified_seed_catalog_item_v42(uuid,text,text,text,text,text,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
