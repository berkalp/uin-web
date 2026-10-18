CREATE OR REPLACE FUNCTION public.admin_create_uin_card_v59(p_seed_type_id uuid, p_type_id text, p_title text, p_creator_name text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_reference_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare type_kind text; item_id uuid; v_target_id uuid; category_ids text[];
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
 select base_kind into type_kind from public.uin_content_types where id=p_type_id and active;
 if type_kind is null then raise exception 'Geçerli bir içerik türü seç.';end if;
 if nullif(btrim(p_title),'') is null then raise exception 'Kartın adı gerekli.';end if;
 -- Serialize exact topic creation across categories; people, works and places keep their own identity rules.
 if p_type_id in ('activity','hobby','sport','writer','director','food','route','volunteering','project')
    and nullif(btrim(p_creator_name),'') is null then
   perform pg_advisory_xact_lock(hashtextextended('uin-topic:'||public.canonical_normalize_v31(p_title),0));
   select item.canonical_target_id into v_target_id
   from public.seed_catalog_items item
   join public.canonical_targets target on target.id=item.canonical_target_id
   where item.status='active'
     and (public.canonical_normalize_v31(target.title)=public.canonical_normalize_v31(p_title)
       or exists(select 1 from jsonb_array_elements_text(coalesce(target.editorial_metadata->'topic_aliases','[]'::jsonb)) alias(title)
         where public.canonical_normalize_v31(alias.title)=public.canonical_normalize_v31(p_title)))
     and nullif(btrim(item.creator_name),'') is null
     and exists(select 1 from public.uin_card_content_types_v177 m where m.target_id=target.id
       and m.content_type_id in ('activity','hobby','sport','writer','director','food','route','volunteering','project'))
   order by item.created_at,item.id limit 1;
   if v_target_id is not null then
     select array_agg(distinct x) into category_ids from (
       select content_type_id x from public.uin_card_content_types_v177 where uin_card_content_types_v177.target_id=v_target_id
       union select p_type_id
     ) categories;
     perform public.admin_save_uin_card_content_types_v177(v_target_id,category_ids);
     return v_target_id;
   end if;
 end if;
 item_id:=public.suggest_seed_catalog_item(p_seed_type_id,case when type_kind in ('book','movie','series','game','artist','place') then type_kind else 'generic' end,btrim(p_title),nullif(btrim(p_creator_name),''),null,null,nullif(btrim(p_cover_url),''),'tr',jsonb_build_object('description',coalesce(p_description,''),'reference_url',coalesce(p_reference_url,''),'content_type_id',p_type_id,'submission','admin'));
 if exists(select 1 from public.seed_catalog_items where id=item_id and status='active') then raise exception 'Bu kart zaten var. Mevcut kartı açabilirsin.';end if;
 perform public.admin_review_seed_catalog_item(item_id,'approve',null);
 select canonical_target_id into v_target_id from public.seed_catalog_items where id=item_id;
 if v_target_id is null then raise exception 'UIN kartı oluşturulamadı.';end if;
 perform public.admin_save_uin_card_v55(v_target_id,btrim(p_title),p_type_id,p_creator_name,p_cover_url,p_description,p_reference_url);
 return v_target_id;
end;$function$;
