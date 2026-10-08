begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- One hierarchy rule for every card type. Metadata parents and the generic
-- upper/lower card editor both participate in the same descendant tree.
create or replace function public.get_uin_card_direct_children_v135(p_parent_target_id uuid)
returns table(target_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select target.id
  from public.canonical_targets target
  where coalesce(
    nullif(target.editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
    nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
    nullif(target.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
  )=p_parent_target_id
  union
  select relation.source_target_id
  from public.uin_card_relations_v87 relation
  where relation.related_target_id=p_parent_target_id and relation.relation_type='source_material';
$function$;

create or replace function public.get_uin_card_descendants_v81(
  p_target_id uuid,
  p_include_self boolean default true
)
returns table(target_id uuid,depth integer)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
with recursive walk as (
  select p_target_id id,0 level,array[p_target_id] visited
  union all
  select child.id,walk.level+1,walk.visited||child.id
  from walk
  cross join lateral public.get_uin_card_direct_children_v135(walk.id) edge
  join public.canonical_targets child on child.id=edge.target_id
  where walk.level<12
    and not child.id=any(walk.visited)
    and (public.is_admin() or coalesce((child.editorial_metadata->>'admin_hidden')::boolean,false)=false)
), deduped as (
  select id,min(level)::integer depth
  from walk
  group by id
)
select id,depth from deduped
where p_include_self or depth>0
order by depth,id;
$function$;

-- Resolve all descendants for counters. Legacy city identities are retained so
-- older intentions still roll up into the structural city card.
create or replace function public.get_uin_card_identity_targets_v129(p_target_id uuid)
returns table(target_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with root as materialized (
    select public.resolve_uin_card_target_v129(p_target_id) id
  ), root_card as materialized (
    select target.id,target.title
    from root join public.canonical_targets target on target.id=root.id
  ), hierarchy as materialized (
    select descendant.target_id
    from root
    cross join lateral public.get_uin_card_descendants_v81(root.id,true) descendant
  ), legacy_city as materialized (
    select distinct item.canonical_target_id target_id
    from root_card
    join public.seed_catalog_items item
      on item.status='active' and item.item_kind='place'
     and item.canonical_target_id is not null
     and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(root_card.title)
    where exists (
      select 1 from public.uin_place_nodes_v123 node
      where node.canonical_target_id=root_card.id and node.scope='city' and node.country_code='TR'
    )
  )
  select hierarchy.target_id from hierarchy
  union
  select legacy_city.target_id from legacy_city;
$function$;

create or replace function public.get_uin_card_summary_v129(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
with requested as materialized (
  select distinct public.resolve_uin_card_target_v129(value) target_id
  from unnest(coalesce(p_target_ids,array[]::uuid[])) value
), identity as materialized (
  select requested.target_id requested_id,linked.target_id
  from requested
  cross join lateral public.get_uin_card_identity_targets_v129(requested.target_id) linked
), wanting_people as materialized (
  select identity.requested_id,person->>'user_id' user_id
  from identity
  cross join lateral public.get_uin_card_people_v80(identity.target_id,'intent',100,0) person
), done_people as materialized (
  select identity.requested_id,person->>'user_id' user_id
  from identity
  cross join lateral public.get_uin_card_people_v80(identity.target_id,'experience',100,0) person
), raw_events as materialized (
  select identity.requested_id,event->>'event_state' event_state,
    coalesce(event->>'resource_id',event->>'plan_id',event->>'intent_id') resource_id
  from identity
  cross join lateral public.get_uin_card_events_v80(identity.target_id) event
), events as materialized (
  select distinct on(requested_id,resource_id) requested_id,event_state
  from raw_events
  order by requested_id,resource_id
), descendants as materialized (
  select requested.target_id requested_id,count(*) filter(where child.depth>0)::integer child_count
  from requested
  cross join lateral public.get_uin_card_descendants_v81(requested.target_id,true) child
  group by requested.target_id
)
select jsonb_build_object(
  'target_id',target.id,
  'wanting',(select count(distinct user_id) from wanting_people where requested_id=target.id),
  'done',(select count(distinct user_id) from done_people where requested_id=target.id),
  'active',(select count(*) from events where requested_id=target.id and event_state='active'),
  'completed',(select count(*) from events where requested_id=target.id and event_state='completed'),
  'expired',(select count(*) from events where requested_id=target.id and event_state='expired'),
  'cancelled',(select count(*) from events where requested_id=target.id and event_state='cancelled'),
  'type_id',target.editorial_metadata->>'content_type_id',
  'creator_name',target.creator_name,
  'editorial_cover_url',target.editorial_cover_url,
  'child_count',coalesce(descendants.child_count,0)
)
from requested
join public.canonical_targets target on target.id=requested.target_id
left join descendants on descendants.requested_id=target.id;
$function$;

-- Avoid rewriting catalogue identity columns during a cover/description edit.
-- Those rewrites fired canonicalisation and duplicate guards several times for
-- one Save click and were the source of intermittent timeouts/duplicate errors.
create or replace function public.admin_update_uin_card_v54(
  p_target_id uuid,p_catalog_item_id uuid default null,p_title text default null,
  p_item_kind text default null
) returns void language plpgsql security definer set search_path=public,extensions as $$
declare v_catalog_id uuid;v_action text;v_icon text;v_old_title text;v_old_kind text;v_identity_changed boolean;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode='42501'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Başlık boş olamaz.' using errcode='22023'; end if;
  if p_item_kind not in ('artist','book','movie','series','game','place','director','actor','writer','comedian','theatre_artist','athlete','club','sport','hobby','activity') then raise exception 'Geçersiz içerik türü.' using errcode='22023'; end if;
  select target.title,coalesce(type.base_kind,target.editorial_metadata->>'item_kind')
    into v_old_title,v_old_kind
  from public.canonical_targets target
  left join public.uin_content_types type on type.id=target.editorial_metadata->>'content_type_id'
  where target.id=p_target_id;
  if v_old_title is null then raise exception 'UIN Kartı bulunamadı.' using errcode='P0002'; end if;
  v_identity_changed:=public.canonical_normalize_v31(v_old_title) is distinct from public.canonical_normalize_v31(btrim(p_title))
    or coalesce(v_old_kind,'') is distinct from p_item_kind;
  v_action:=case when p_item_kind in ('movie','series','director','actor') then 'watch' when p_item_kind in ('book','writer') then 'read' when p_item_kind='artist' then 'listen' when p_item_kind='game' then 'play' when p_item_kind in ('place','club') then 'visit' when p_item_kind='athlete' then 'sport-do' else 'do' end;
  v_icon:=case when p_item_kind='movie' then '🎬' when p_item_kind='series' then '📺' when p_item_kind='book' then '📚' when p_item_kind='artist' then '🎵' when p_item_kind='game' then '🎮' when p_item_kind='place' then '📍' when p_item_kind='club' then '⚽' when p_item_kind='sport' then '🏃' when p_item_kind='director' then '🎥' when p_item_kind in ('actor','theatre_artist') then '🎭' when p_item_kind='writer' then '✍️' when p_item_kind='comedian' then '🎙️' when p_item_kind='athlete' then '🏅' when p_item_kind='hobby' then '🧩' else '✨' end;
  update public.canonical_targets target set title=btrim(p_title),primary_category_id=null,
    editorial_metadata=(coalesce(target.editorial_metadata,'{}'::jsonb)-'admin_hidden'-'uin_primary_category_id'-'uin_primary_category_name')||jsonb_build_object('item_kind',p_item_kind,'action_key',v_action,'display_icon',v_icon),updated_at=now()
  where target.id=p_target_id;
  if v_identity_changed then
    select item.id into v_catalog_id from public.seed_catalog_items item where item.id=p_catalog_item_id and item.canonical_target_id=p_target_id;
    if v_catalog_id is null then select item.id into v_catalog_id from public.seed_catalog_items item where item.canonical_target_id=p_target_id order by (item.status='active') desc,item.updated_at desc limit 1; end if;
    if v_catalog_id is not null then
      update public.seed_catalog_items item set canonical_title=btrim(p_title),item_kind=p_item_kind,primary_category_id=null,
        metadata=(coalesce(item.metadata,'{}'::jsonb)-'uin_primary_category_id'-'uin_primary_category_name')||jsonb_build_object('uin_item_kind',p_item_kind)
      where item.id=v_catalog_id
        and (public.canonical_normalize_v31(item.canonical_title) is distinct from public.canonical_normalize_v31(btrim(p_title)) or item.item_kind is distinct from p_item_kind);
    end if;
  end if;
end;$$;

create or replace function public.admin_save_uin_card_v55(p_target_id uuid,p_title text,p_type_id text,p_creator_name text,p_cover_url text,p_description text,p_reference_url text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_base text;v_creator text;v_cover text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
  select base_kind into v_base from public.uin_content_types where id=p_type_id;
  if v_base is null then raise exception 'İçerik türü bulunamadı.'; end if;
  if char_length(coalesce(p_description,''))>4000 then raise exception 'Açıklama 4000 karakteri geçemez.';end if;
  v_creator:=nullif(btrim(p_creator_name),'');v_cover:=nullif(btrim(p_cover_url),'');
  perform public.admin_update_uin_card_v54(p_target_id,null,p_title,v_base);
  update public.canonical_targets target set creator_name=v_creator,editorial_cover_url=v_cover,
    editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
      'description',nullif(btrim(p_description),''),'reference_url',nullif(btrim(p_reference_url),''),'content_type_id',p_type_id
    ),updated_at=now()
  where target.id=p_target_id;
  update public.seed_catalog_items item set cover_url=v_cover,updated_at=now()
  where item.canonical_target_id=p_target_id and item.status<>'rejected' and item.cover_url is distinct from v_cover;
  update public.seed_catalog_items item set creator_name=v_creator,updated_at=now()
  where item.canonical_target_id=p_target_id and item.status<>'rejected' and item.creator_name is distinct from v_creator;
end;$$;

create or replace function public.admin_save_place_card_v74(p_target_id uuid,p_title text,p_type_id text,p_creator_name text,p_cover_url text,p_description text,p_reference_url text,p_profile jsonb,p_cover_position_y numeric,p_place_kind text,p_parent_target_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cursor_id uuid;visited uuid[]:=array[p_target_id];v_hierarchy jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if not exists(select 1 from public.uin_content_types where id=p_type_id and base_kind='place') then raise exception 'Bu işlem yalnızca yer kartlarında kullanılabilir.';end if;
  if p_place_kind not in ('','Ülke','İl','Şehir','İlçe','Yer') or p_place_kind is null then raise exception 'Yer türü geçersiz.';end if;
  if p_parent_target_id is not null and p_place_kind not in ('İlçe','Yer') then raise exception 'Bağlı yerin türünü İlçe veya Yer seç.';end if;
  if p_parent_target_id is not null and not exists(select 1 from public.canonical_targets t join public.seed_catalog_items c on c.canonical_target_id=t.id where t.id=p_parent_target_id and c.item_kind='place' and c.status='active' and coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true') then raise exception 'Bağlı il / şehir kartı bulunamadı.';end if;
  cursor_id:=p_parent_target_id;
  while cursor_id is not null loop
    if cursor_id=any(visited) then raise exception 'Bir yer kendisine veya altındaki bir yere bağlanamaz.';end if;
    visited:=array_append(visited,cursor_id);
    select nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid into cursor_id from public.canonical_targets where id=cursor_id;
  end loop;
  perform public.admin_save_uin_card_v62(p_target_id,p_title,p_type_id,p_creator_name,p_cover_url,p_description,p_reference_url,p_profile,p_cover_position_y);
  v_hierarchy:=jsonb_build_object('kind',nullif(p_place_kind,''),'parent_target_id',p_parent_target_id);
  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object('place_hierarchy',v_hierarchy)
  where target.id=p_target_id and target.editorial_metadata->'place_hierarchy' is distinct from v_hierarchy;
end;$$;

create or replace function public.admin_save_uin_card_reference_links_v93(p_target_id uuid,p_links jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_links jsonb;v_first_url text;v_metadata jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if p_target_id is null or not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.';end if;
  if p_links is null or jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links)>20 then raise exception 'Kaynak bağlantıları geçersiz.';end if;
  if exists(select 1 from jsonb_array_elements(p_links) item where jsonb_typeof(item)<>'object' or length(btrim(coalesce(item->>'label','')))>80 or nullif(btrim(coalesce(item->>'url','')),'') is null or btrim(item->>'url')!~*'^https?://') then raise exception 'Kaynak bağlantılarını kontrol et.';end if;
  select coalesce(jsonb_agg(jsonb_build_object('label',coalesce(nullif(btrim(item->>'label'),''),'Kaynak'),'url',btrim(item->>'url')) order by ordinality),'[]'::jsonb)
    into v_links from jsonb_array_elements(p_links) with ordinality source(item,ordinality);
  v_first_url:=nullif(v_links->0->>'url','');
  select case when jsonb_array_length(v_links)=0 then coalesce(editorial_metadata,'{}'::jsonb)-'reference_links'-'reference_url'
    else jsonb_set(jsonb_set(coalesce(editorial_metadata,'{}'::jsonb),'{reference_links}',v_links,true),'{reference_url}',to_jsonb(v_first_url),true) end
    into v_metadata from public.canonical_targets where id=p_target_id;
  update public.canonical_targets set editorial_metadata=v_metadata where id=p_target_id and editorial_metadata is distinct from v_metadata;
end;$$;

create or replace function public.admin_save_place_coordinates_v128(p_target_id uuid,p_latitude double precision,p_longitude double precision)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare coordinate_patch jsonb:='{}'::jsonb;v_metadata jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if (p_latitude is null)<>(p_longitude is null) then raise exception 'Enlem ve boylam birlikte girilmelidir.';end if;
  if p_latitude is not null and (p_latitude< -90 or p_latitude>90 or p_longitude< -180 or p_longitude>180) then raise exception 'Koordinatlar geçerli aralıkta değil.';end if;
  if not exists(select 1 from public.seed_catalog_items where canonical_target_id=p_target_id and item_kind='place' and status='active') then raise exception 'Yer kartı bulunamadı.';end if;
  if p_latitude is not null then coordinate_patch:=jsonb_build_object('latitude',p_latitude,'longitude',p_longitude);end if;
  update public.seed_catalog_items item set metadata=((coalesce(item.metadata,'{}'::jsonb)-'latitude'-'longitude'-'lat'-'lng'-'lon')||coordinate_patch),updated_at=now()
  where item.canonical_target_id=p_target_id and item.item_kind='place' and item.status<>'rejected'
    and item.metadata is distinct from ((coalesce(item.metadata,'{}'::jsonb)-'latitude'-'longitude'-'lat'-'lng'-'lon')||coordinate_patch);
  select ((coalesce(editorial_metadata,'{}'::jsonb)-'latitude'-'longitude'-'lat'-'lng'-'lon')||coordinate_patch) into v_metadata from public.canonical_targets where id=p_target_id;
  update public.canonical_targets set editorial_metadata=v_metadata,updated_at=now() where id=p_target_id and editorial_metadata is distinct from v_metadata;
end;$$;

-- Type synchronisation is now a no-op when the selected type did not change.
create or replace function public.admin_sync_uin_card_type_v87(p_target_id uuid,p_type_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare base text;seed_type uuid;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  select base_kind into base from public.uin_content_types where id=p_type_id and active;
  if base is null then raise exception 'İçerik türü geçersiz.';end if;
  select id into seed_type from public.seed_types where is_active and case
    when base in ('movie','series','director','actor') then slug~*'(watch|izle|movie|series)'
    when base in ('book','writer') then slug~*'(read|oku|book)'
    when base in ('artist','album','podcast','music') then slug~*'(listen|dinle|music|podcast)'
    when base='game' then slug~*'(play|oyna|game)'
    when base='place' then slug~*'(visit|git|travel|place)'
    else slug~*'(try|do|make|dene|yap)' end
  order by case when slug in('watch','read','listen','play','visit','try') then 0 else 1 end,slug limit 1;
  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object('content_type_id',p_type_id)
  where target.id=p_target_id and target.editorial_metadata->>'content_type_id' is distinct from p_type_id;
  update public.seed_catalog_items item set item_kind=base,seed_type_id=coalesce(seed_type,item.seed_type_id),metadata=coalesce(item.metadata,'{}'::jsonb)||jsonb_build_object('content_type_id',p_type_id),updated_at=now()
  where item.canonical_target_id=p_target_id and item.status<>'rejected'
    and (item.item_kind is distinct from base or item.metadata->>'content_type_id' is distinct from p_type_id or (seed_type is not null and item.seed_type_id is distinct from seed_type));
  if seed_type is not null then update public.seeds set seed_type_id=seed_type,updated_at=now() where canonical_target_id=p_target_id and seed_type_id is distinct from seed_type;end if;
end;$$;

revoke all on function public.get_uin_card_direct_children_v135(uuid),public.get_uin_card_descendants_v81(uuid,boolean),public.get_uin_card_identity_targets_v129(uuid),public.get_uin_card_summary_v129(uuid[]) from public;
grant execute on function public.get_uin_card_descendants_v81(uuid,boolean),public.get_uin_card_identity_targets_v129(uuid),public.get_uin_card_summary_v129(uuid[]) to anon,authenticated;
revoke all on function public.admin_update_uin_card_v54(uuid,uuid,text,text),public.admin_save_uin_card_v55(uuid,text,text,text,text,text,text),public.admin_save_place_card_v74(uuid,text,text,text,text,text,text,jsonb,numeric,text,uuid),public.admin_save_uin_card_reference_links_v93(uuid,jsonb),public.admin_save_place_coordinates_v128(uuid,double precision,double precision),public.admin_sync_uin_card_type_v87(uuid,text) from public,anon;
grant execute on function public.admin_update_uin_card_v54(uuid,uuid,text,text),public.admin_save_uin_card_v55(uuid,text,text,text,text,text,text),public.admin_save_place_card_v74(uuid,text,text,text,text,text,text,jsonb,numeric,text,uuid),public.admin_save_uin_card_reference_links_v93(uuid,jsonb),public.admin_save_place_coordinates_v128(uuid,double precision,double precision),public.admin_sync_uin_card_type_v87(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;
