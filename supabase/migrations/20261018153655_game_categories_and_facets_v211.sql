-- A physical game may share a canonical card with Sport / Hobby / Learning.

-- Keep physical games separate from same-named video games on import.
CREATE OR REPLACE FUNCTION public.add_verified_seed_catalog_item_v42(p_seed_type_id uuid, p_item_kind text, p_canonical_title text, p_creator_name text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_provider text DEFAULT NULL::text, p_external_id text DEFAULT NULL::text, p_source_url text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(catalog_item_id uuid, canonical_target_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  where item.seed_type_id=p_seed_type_id and (p_item_kind <> 'game' or item.item_kind='game') and item.status in ('active','pending','approved') and (
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
end;$function$;


CREATE OR REPLACE FUNCTION public.suggest_seed_catalog_item(p_seed_type_id uuid, p_item_kind text, p_canonical_title text, p_creator_name text DEFAULT NULL::text, p_original_title text DEFAULT NULL::text, p_release_year integer DEFAULT NULL::integer, p_cover_url text DEFAULT NULL::text, p_language_code text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_title text := btrim(coalesce(p_canonical_title, ''));
  v_creator text := nullif(btrim(p_creator_name), '');
  v_normalized_title text;
  v_normalized_creator text;
  v_catalog_item_id uuid;
  v_match_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to suggest a Seed subject.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.seed_types seed_type
    where seed_type.id = p_seed_type_id and seed_type.is_active
  ) then
    raise exception 'Select an active Seed Type.' using errcode = '23503';
  end if;

  if p_item_kind not in (
    'book', 'movie', 'series', 'game', 'learning_topic', 'album', 'artist', 'podcast', 'course',
    'place', 'restaurant', 'recipe', 'skill', 'challenge', 'generic'
  ) then
    raise exception 'Unsupported catalogue item kind.' using errcode = '22023';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 240 then
    raise exception 'Subject title must be between 1 and 240 characters.'
      using errcode = '22023';
  end if;

  v_normalized_title := public.normalize_seed_catalog_text(v_title);
  v_normalized_creator := public.normalize_seed_catalog_text(v_creator);

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_seed_type_id::text || ':' || v_normalized_title || ':' || coalesce(v_normalized_creator, ''),
      0
    )
  );

  if v_creator is not null then
    select item.id into v_catalog_item_id
    from public.seed_catalog_items item
    where item.seed_type_id = p_seed_type_id
      and ((p_item_kind='game')=(item.item_kind='game'))
      and (item.status = 'active' or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin())))
      and item.normalized_creator = v_normalized_creator
      and (
        item.normalized_title = v_normalized_title
        or exists (
          select 1
          from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias = v_normalized_title
        )
      )
    order by case item.status when 'active' then 0 else 1 end, item.created_at
    limit 1;
  else
    select count(distinct item.id)::integer
    into v_match_count
    from public.seed_catalog_items item
    where item.seed_type_id = p_seed_type_id
      and ((p_item_kind='game')=(item.item_kind='game'))
      and (item.status = 'active' or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin())))
      and (
        item.normalized_title = v_normalized_title
        or exists (
          select 1
          from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias = v_normalized_title
        )
      );

    if coalesce(v_match_count, 0) = 1 then
      select item.id
      into v_catalog_item_id
      from public.seed_catalog_items item
      where item.seed_type_id = p_seed_type_id
      and ((p_item_kind='game')=(item.item_kind='game'))
        and (item.status = 'active' or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin())))
        and (
          item.normalized_title = v_normalized_title
          or exists (
            select 1
            from public.seed_catalog_aliases alias
            where alias.catalog_item_id = item.id
              and alias.normalized_alias = v_normalized_title
          )
        )
      order by case item.status when 'active' then 0 else 1 end, item.created_at
      limit 1;
    else
      v_catalog_item_id := null;
    end if;
  end if;

  if v_catalog_item_id is not null then
    insert into public.seed_catalog_aliases (
      catalog_item_id,
      alias,
      language_code,
      source,
      is_primary
    ) values (
      v_catalog_item_id,
      v_title,
      p_language_code,
      'user',
      false
    ) on conflict (catalog_item_id, normalized_alias) do nothing;

    return v_catalog_item_id;
  end if;

  insert into public.seed_catalog_items (
    seed_type_id,
    item_kind,
    canonical_title,
    original_title,
    creator_name,
    release_year,
    cover_url,
    language_code,
    metadata,
    status,
    created_by
  ) values (
    p_seed_type_id,
    p_item_kind,
    v_title,
    p_original_title,
    v_creator,
    p_release_year,
    p_cover_url,
    p_language_code,
    coalesce(p_metadata, '{}'::jsonb),
    'pending',
    auth.uid()
  ) returning id into v_catalog_item_id;

  return v_catalog_item_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.sync_seed_catalogue_identity_to_instances()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.seeds seed
  set
    seed_type_id = new.seed_type_id,
    title = new.canonical_title,
    subtitle = new.creator_name,
    cover_url = new.cover_url,
    updated_at = now()
  where seed.catalog_item_id = new.id
    and (seed.seed_type_id,seed.title,seed.subtitle,seed.cover_url) is distinct from
        (new.seed_type_id,new.canonical_title,new.creator_name,new.cover_url);

  return new;
end;
$function$;

-- Keep the existing administrator check and category membership guard.
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
 if p_type_id in ('activity','hobby','sport','writer','director','food','route','volunteering','project','board_game')
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
       and m.content_type_id in ('activity','hobby','sport','writer','director','food','route','volunteering','project','board_game'))
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
end;$function$

