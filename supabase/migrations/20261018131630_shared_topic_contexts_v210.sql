CREATE OR REPLACE FUNCTION public.resolve_uin_card_target_v129(p_target_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_title text;
  v_resolved uuid;
  v_redirect uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if p_target_id is null then
    return null;
  end if;

  -- Editorial redirects keep existing card links usable.
  for i in 1..8 loop
    v_seen := array_append(v_seen,p_target_id);
    select target.id into v_redirect
    from public.canonical_targets source
    join public.canonical_targets target on target.id::text=source.editorial_metadata->>'merged_into_target_id'
    where source.id=p_target_id;
    exit when v_redirect is null or v_redirect=any(v_seen);
    p_target_id := v_redirect;
  end loop;
  if exists(
    select 1
    from public.uin_place_nodes_v123 node
    where node.canonical_target_id=p_target_id
      and node.scope='city'
      and node.country_code='TR'
  ) then
    return p_target_id;
  end if;

  if not public.is_uin_place_target_v146(p_target_id) then
    return p_target_id;
  end if;

  select target.title into v_title
  from public.canonical_targets target
  where target.id=p_target_id;

  if not found then
    return p_target_id;
  end if;

  select node.canonical_target_id into v_resolved
  from public.uin_place_nodes_v123 node
  where node.scope='city'
    and node.country_code='TR'
    and public.canonical_normalize_v31(node.city)=public.canonical_normalize_v31(v_title)
  order by node.source_key
  limit 1;

  return coalesce(v_resolved,p_target_id);
end;
$function$;


-- Categories describe a shared topic; the purpose belongs to each person's visible wish.
create or replace function public.get_uin_card_intent_contexts_v210(p_target_ids uuid[])
returns table(target_id uuid,user_id uuid,content_type_id text,label text,want_label text)
language sql stable security definer set search_path=public,pg_temp as $fn$
 with allowed as materialized (
   select (row->>'target_id')::uuid id
   from jsonb_array_elements(public.get_uin_card_content_types_v177(p_target_ids[1:500])) row
 ), closure as materialized (
   select tree.resolved_id,tree.target_id
   from public.get_uin_card_closure_v143(array(select id from allowed),true) tree
 ), wishes as (
   select tree.resolved_id,personal.user_id,personal.content_type_id
   from closure tree join public.canonical_personal_intents_v38 personal on personal.target_id=tree.target_id
   where personal.status='active'
     and public.personal_common_intent_visible_v38(personal.user_id,personal.visibility,(select auth.uid()))
     and (personal.end_date is null or personal.end_date >= (now() at time zone 'Europe/Istanbul')::date)
   union all
   select tree.resolved_id,visible.user_id,nullif(item.metadata->>'content_type_id','')
   from public.visible_canonical_seeds_v31() visible
   join public.seeds seed on seed.id=visible.seed_id
   join closure tree on tree.target_id=visible.target_id
   left join public.seed_catalog_items item on item.id=seed.catalog_item_id
   where visible.relationship_status<>'completed'
     and (seed.target_date is null or seed.target_date >= (now() at time zone 'Europe/Istanbul')::date)
 ), contexts as (
   select distinct wishes.resolved_id,wishes.user_id,kind.id,kind.label,kind.ui_labels->>'want' want_label
   from wishes
   left join public.uin_content_types kind on kind.id=wishes.content_type_id and kind.active
 )
 select resolved_id,user_id,id,coalesce(label,'Amaç belirtilmemiş'),
   coalesce(want_label,label,'Amaç belirtilmemiş') from contexts;
$fn$;
revoke all on function public.get_uin_card_intent_contexts_v210(uuid[]) from public;
grant execute on function public.get_uin_card_intent_contexts_v210(uuid[]) to anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION public.get_uin_card_people_v81(p_target_id uuid, p_group text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with contexts as materialized (
    select user_id,jsonb_agg(jsonb_build_object('id',content_type_id,'label',label,'want_label',want_label) order by label) purposes
    from public.get_uin_card_intent_contexts_v210(array[p_target_id])
    where p_group<>'experience'
    group by user_id
  ), candidates as materialized (
    select projection.*,
      row_number() over(
        partition by projection.user_id
        order by
          case projection.source_kind
            when 'seed' then 0
            when 'personal' then 1
            else 2
          end,
          projection.target_date desc nulls last,
          projection.source_id
      ) rn
    from public.get_uin_card_people_projection_v143(array[p_target_id]) projection
    where projection.relationship_status=case when p_group='experience' then 'completed' else 'want' end
  ), selected as materialized (
    select candidates.*,target.title source_target_title
    from candidates
    join public.canonical_targets target on target.id=candidates.source_target_id
    where candidates.rn=1
  )
  select jsonb_build_object(
    'kind','personal',
    'intent_contexts',coalesce(contexts.purposes,'[]'::jsonb),
    'id',selected.source_id,
    'user_id',selected.user_id,
    'full_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
    'username',profile.username,
    'avatar_url',profile.avatar_url,
    'seed_id',case when selected.source_kind='seed' then selected.source_id end,
    'source_kind',selected.source_kind,
    'source_id',selected.source_id,
    'source_target_id',selected.source_target_id,
    'source_target_title',selected.source_target_title,
    'target_date',selected.target_date,
    'start_date',case when selected.source_kind='personal' then personal.start_date else seed.target_date end,
    'end_date',case when selected.source_kind='personal' then personal.end_date else seed.target_date end,
    'timing_precision',case when selected.source_kind='personal' then personal.timing_precision else 'day' end,
    'date_options',case when selected.source_kind='personal' then personal.date_options else '[]'::jsonb end,
    'notes',case when selected.source_kind='personal' then personal.notes end,
    'visibility',case when selected.source_kind='personal' then personal.visibility else seed.visibility end,
    'location_id',location.id,
    'location',nullif(concat_ws(', ',nullif(location.district,''),nullif(location.city,''),nullif(location.country_name,'')) ,''),
    'location_scope',location.scope,
    'latitude',location.latitude,
    'longitude',location.longitude,
    'rating',case when selected.source_kind='seed' then personal_state.rating end,
    'experience_precision',case when selected.source_kind='seed' then coalesce(personal_state.experience_precision,case when personal_state.experience_date is not null then 'exact' when personal_state.experience_year is not null then 'year' end,seed.completed_date_precision,'unknown') end,
    'experience_date',case when selected.source_kind='seed' and coalesce(personal_state.experience_precision,case when personal_state.experience_date is not null then 'exact' when personal_state.experience_year is not null then 'year' end,seed.completed_date_precision,'unknown')='exact' then coalesce(personal_state.experience_date,case when seed.completed_date_precision='exact' then seed.completed_at::date end) end,
    'experience_year',case when selected.source_kind='seed' and coalesce(personal_state.experience_precision,case when personal_state.experience_date is not null then 'exact' when personal_state.experience_year is not null then 'year' end,seed.completed_date_precision,'unknown')='year' then coalesce(personal_state.experience_year,seed.completed_year) end,
    'experience_text',case when selected.source_kind='seed' then reflection.body end,
    'comment_count',case when selected.source_kind='seed' then (
      select count(*) from public.seed_experience_comments comment
      where comment.seed_id=seed.id and comment.deleted_at is null
    ) else 0 end,
    'total_count',count(*) over()
  )
  from selected
  left join contexts on contexts.user_id=selected.user_id
  join public.profiles profile on profile.id=selected.user_id
  left join public.seeds seed on seed.id=selected.source_id and selected.source_kind='seed'
  left join public.canonical_personal_intents_v38 personal
    on personal.id=selected.source_id and selected.source_kind='personal'
  left join public.locations location on location.id=personal.location_id
  left join public.seed_personal_state_v15 personal_state
    on personal_state.seed_id=seed.id and personal_state.user_id=selected.user_id
  left join lateral (
    select journal.body
    from public.seed_journal_entries journal
    where journal.seed_id=seed.id
      and journal.entry_kind='reflection'
      and public.seed_is_visible_to_viewer(selected.user_id,journal.visibility,auth.uid())
    order by journal.occurred_on desc,journal.created_at desc
    limit 1
  ) reflection on true
  order by case when selected.user_id=auth.uid() then 0 else 1 end,
    selected.target_date nulls last,selected.user_id
  limit greatest(1,least(coalesce(p_limit,50),100))
  offset greatest(coalesce(p_offset,0),0);
$function$;


CREATE OR REPLACE FUNCTION public.get_my_common_personal_intent_v39(p_target_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('id',personal.id,'status',personal.status,'start_date',personal.start_date,'end_date',personal.end_date,
  'visibility',personal.visibility,'collaboration_mode',personal.collaboration_mode,'location_id',personal.location_id,'notes',personal.notes,
  'content_type_id',personal.content_type_id,'timing_precision',personal.timing_precision,'date_options',personal.date_options)
 from public.canonical_personal_intents_v38 personal
 where personal.target_id=public.resolve_uin_card_target_v129(p_target_id) and personal.user_id=auth.uid() and personal.status in ('active','completed')
 order by personal.updated_at desc limit 1;
$function$;


CREATE OR REPLACE FUNCTION public.admin_create_uin_card_v59(p_seed_type_id uuid, p_type_id text, p_title text, p_creator_name text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_reference_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare type_kind text; item_id uuid; target_id uuid; category_ids text[];
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
 select base_kind into type_kind from public.uin_content_types where id=p_type_id and active;
 if type_kind is null then raise exception 'Geçerli bir içerik türü seç.';end if;
 if nullif(btrim(p_title),'') is null then raise exception 'Kartın adı gerekli.';end if;
 -- Serialize exact topic creation across categories; people, works and places keep their own identity rules.
 if p_type_id in ('activity','hobby','sport','writer','director','food','route','volunteering','project')
    and nullif(btrim(p_creator_name),'') is null then
   perform pg_advisory_xact_lock(hashtextextended('uin-topic:'||public.canonical_normalize_v31(p_title),0));
   select item.canonical_target_id into target_id
   from public.seed_catalog_items item
   join public.canonical_targets target on target.id=item.canonical_target_id
   where item.status='active'
     and public.canonical_normalize_v31(target.title)=public.canonical_normalize_v31(p_title)
     and nullif(btrim(item.creator_name),'') is null
     and exists(select 1 from public.uin_card_content_types_v177 m where m.target_id=target.id
       and m.content_type_id in ('activity','hobby','sport','writer','director','food','route','volunteering','project'))
   order by item.created_at,item.id limit 1;
   if target_id is not null then
     select array_agg(distinct x) into category_ids from (
       select content_type_id x from public.uin_card_content_types_v177 where uin_card_content_types_v177.target_id=admin_create_uin_card_v59.target_id
       union select p_type_id
     ) categories;
     perform public.admin_save_uin_card_content_types_v177(target_id,category_ids);
     return target_id;
   end if;
 end if;
 item_id:=public.suggest_seed_catalog_item(p_seed_type_id,case when type_kind in ('book','movie','series','game','artist','place') then type_kind else 'generic' end,btrim(p_title),nullif(btrim(p_creator_name),''),null,null,nullif(btrim(p_cover_url),''),'tr',jsonb_build_object('description',coalesce(p_description,''),'reference_url',coalesce(p_reference_url,''),'content_type_id',p_type_id,'submission','admin'));
 if exists(select 1 from public.seed_catalog_items where id=item_id and status='active') then raise exception 'Bu kart zaten var. Mevcut kartı açabilirsin.';end if;
 perform public.admin_review_seed_catalog_item(item_id,'approve',null);
 select canonical_target_id into target_id from public.seed_catalog_items where id=item_id;
 if target_id is null then raise exception 'UIN kartı oluşturulamadı.';end if;
 perform public.admin_save_uin_card_v55(target_id,btrim(p_title),p_type_id,p_creator_name,p_cover_url,p_description,p_reference_url);
 return target_id;
end;$function$;

