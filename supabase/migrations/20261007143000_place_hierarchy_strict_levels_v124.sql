begin;
set local statement_timeout='10min';

create index if not exists canonical_targets_place_parent_v124_idx
on public.canonical_targets ((editorial_metadata #>> '{place_hierarchy,parent_target_id}'));

create or replace function public.get_uin_place_countries_v123()
returns table(country_code text,country_name text,target_id uuid,city_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  with local_counts as materialized (
    select country_code,count(*)::bigint city_count
    from public.uin_place_nodes_v123 where scope='city' group by country_code
  ), global_counts as materialized (
    select item.metadata->>'country_code' country_code,count(*)::bigint city_count
    from public.seed_catalog_items item
    where item.status='active' and item.metadata->>'global_place_catalogue'='true'
      and item.metadata->>'global_place_kind'='city'
    group by item.metadata->>'country_code'
  )
  select node.country_code,node.country_name,node.canonical_target_id,
    case when node.country_code='TR' then coalesce(local_counts.city_count,0)
      else coalesce(global_counts.city_count,0) end
  from public.uin_place_nodes_v123 node
  left join local_counts using(country_code)
  left join global_counts using(country_code)
  where node.scope='country'
  order by public.canonical_normalize_v31(node.country_name),node.country_code;
$$;

-- İstanbul yerlerini kaynak ilçe verisine göre eşleştir. Anahtarları önce çıkarmak,
-- her kartı tüm ilçelerle karşılaştıran pahalı çapraz taramayı önler.
with district_keys as materialized (
  select canonical_target_id parent_target_id,district,
    public.canonical_normalize_v31(district) district_key
  from public.uin_place_nodes_v123
  where scope='district' and city='İstanbul'
), place_items as materialized (
  select distinct on(item.canonical_target_id) item.canonical_target_id,item.metadata
  from public.seed_catalog_items item
  where item.status='active' and item.item_kind='place' and item.canonical_target_id is not null
    and not exists(select 1 from public.uin_place_nodes_v123 structural where structural.canonical_target_id=item.canonical_target_id)
  order by item.canonical_target_id,item.updated_at desc,item.id
), candidate_keys as materialized (
  select item.canonical_target_id target_id,
    public.canonical_normalize_v31(item.metadata->>'district') district_key
  from place_items item
  where nullif(item.metadata->>'district','') is not null
    and (public.canonical_normalize_v31(coalesce(item.metadata->>'city',''))='istanbul'
      or exists(select 1 from jsonb_array_elements_text(coalesce(item.metadata->'admin_areas','[]'::jsonb)) area(value)
        where public.canonical_normalize_v31(area.value)='istanbul'))
  union all
  select item.canonical_target_id,public.canonical_normalize_v31(area.value)
  from place_items item
  cross join lateral jsonb_array_elements_text(coalesce(item.metadata->'admin_areas','[]'::jsonb)) area(value)
  where exists(select 1 from jsonb_array_elements_text(coalesce(item.metadata->'admin_areas','[]'::jsonb)) city(value)
    where public.canonical_normalize_v31(city.value)='istanbul')
  union all
  select target.id,public.canonical_normalize_v31('Beykoz') from public.canonical_targets target
  where public.canonical_normalize_v31(target.title) in ('anadolufeneri','anadolu feneri')
  union all
  select target.id,public.canonical_normalize_v31('Üsküdar') from public.canonical_targets target
  where public.canonical_normalize_v31(target.title) in ('kiz kulesi','eski valide camii','adile sultan kasri','iii ahmed cesmesi','uskudar selimiye camii','yeni valide camii')
), candidates as materialized (
  select distinct on(keys.target_id) keys.target_id,district.parent_target_id,district.district
  from candidate_keys keys join district_keys district using(district_key)
  where keys.target_id<>district.parent_target_id
  order by keys.target_id,district.parent_target_id
)
update public.canonical_targets target set
  editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'place_hierarchy',coalesce(target.editorial_metadata->'place_hierarchy','{}'::jsonb)||jsonb_build_object('kind','Yer','parent_target_id',candidate.parent_target_id),
    'card_hierarchy',coalesce(target.editorial_metadata->'card_hierarchy','{}'::jsonb)||jsonb_build_object('parent_target_id',candidate.parent_target_id,'sort_order',0,'section_title',candidate.district||' içindeki yerler')
  ),updated_at=now()
from candidates candidate where target.id=candidate.target_id;

-- İstanbul ilçelerine coğrafi olarak doğru ve hızlı yüklenen harita kapakları ekle.
with covers(district,lat,lon) as (values
 ('Adalar',40.8741659,29.1293251),('Arnavutköy',41.1844710,28.7412446),('Ataşehir',40.9929379,29.1135187),
 ('Avcılar',40.9799389,28.7216689),('Bağcılar',41.0345470,28.8567558),('Bahçelievler',41.0030495,28.8657701),
 ('Bakırköy',40.9782585,28.8744461),('Başakşehir',41.1075794,28.7950711),('Bayrampaşa',41.0345549,28.9118417),
 ('Beşiktaş',41.0428465,29.0075283),('Beykoz',41.1343001,29.0920378),('Beylikdüzü',41.0038148,28.6372878),
 ('Beyoğlu',41.0284233,28.9736808),('Büyükçekmece',41.0216540,28.5797570),('Çatalca',41.1436804,28.4605154),
 ('Çekmeköy',41.0351579,29.1739149),('Esenler',41.0376175,28.8824519),('Esenyurt',41.0342862,28.6801113),
 ('Eyüpsultan',41.0478358,28.9327383),('Fatih',41.0192846,28.9479296),('Gaziosmanpaşa',41.0578305,28.9122452),
 ('Güngören',41.0252832,28.8726498),('Kadıköy',40.9912955,29.0245631),('Kağıthane',41.0796544,28.9731198),
 ('Kartal',40.8885036,29.1858900),('Küçükçekmece',40.9918737,28.7711956),('Maltepe',40.9247539,29.1310782),
 ('Pendik',40.8768715,29.2349672),('Sancaktepe',40.9905196,29.2288624),('Sarıyer',41.1685803,29.0572623),
 ('Şile',41.1744067,29.6125216),('Silivri',41.0742476,28.2481709),('Şişli',41.0637891,28.9831642),
 ('Sultanbeyli',40.9670242,29.2671314),('Sultangazi',41.1043344,28.8614367),('Tuzla',40.8161732,29.3034194),
 ('Ümraniye',41.0256362,29.0963049),('Üsküdar',41.0265498,29.0151321),('Zeytinburnu',40.9898653,28.9037467)
)
update public.canonical_targets target set editorial_cover_url=coalesce(target.editorial_cover_url,
  'https://staticmap.openstreetmap.de/staticmap.php?center='||covers.lat||','||covers.lon||'&zoom=12&size=900x600&maptype=mapnik&markers='||covers.lat||','||covers.lon||',red-pushpin'),updated_at=now()
from public.uin_place_nodes_v123 node join covers on covers.district=node.district
where node.scope='district' and node.city='İstanbul' and target.id=node.canonical_target_id;

create or replace function public.get_uin_place_level_v123(
  p_country_code text default 'TR',p_city_target_id uuid default null,p_district_target_id uuid default null,
  p_query text default null,p_limit integer default 500,p_offset integer default 0
) returns table(target_id uuid,title text,scope text,parent_target_id uuid,source_key text,child_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
with structural as materialized (
  select node.canonical_target_id target_id,coalesce(node.district,node.city,node.country_name) title,node.scope,
    node.parent_target_id,node.source_key
  from public.uin_place_nodes_v123 node
  where (p_district_target_id is not null and node.canonical_target_id=p_district_target_id)
     or (p_district_target_id is null and p_city_target_id is not null and
       (node.canonical_target_id=p_city_target_id or (node.parent_target_id=p_city_target_id and node.scope='district')))
     or (p_district_target_id is null and p_city_target_id is null and node.scope='city'
       and node.country_code=coalesce(nullif(p_country_code,''),'TR'))
), structural_dedup as materialized (
  select distinct on(case when scope='district' then public.canonical_normalize_v31(regexp_replace(title,'\s*\(ilçe\)\s*$','','i')) else target_id::text end)
    structural.*
  from structural
  order by case when scope='district' then public.canonical_normalize_v31(regexp_replace(title,'\s*\(ilçe\)\s*$','','i')) else target_id::text end,
    case when title~*'\(ilçe\)\s*$' then 1 else 0 end,target_id
), selected_ids as materialized(select target_id from structural_dedup), child_counts as materialized (
  select parent_id,count(*)::bigint child_count from (
    select child.parent_target_id::text parent_id from public.uin_place_nodes_v123 child join selected_ids parent on parent.target_id=child.parent_target_id
    union all
    select target.editorial_metadata #>> '{place_hierarchy,parent_target_id}' parent_id
    from public.canonical_targets target
    join structural_dedup parent
      on target.editorial_metadata #>> '{place_hierarchy,parent_target_id}'=parent.target_id::text
     and parent.scope='district'
    where not exists(select 1 from public.uin_place_nodes_v123 known where known.canonical_target_id=target.id)
  ) children group by parent_id
), rows as (
  select node.target_id,node.title,node.scope,node.parent_target_id,node.source_key,coalesce(counts.child_count,0) child_count
  from structural_dedup node left join child_counts counts on counts.parent_id=node.target_id::text
  union all
  select target.id,target.title,coalesce(target.editorial_metadata->'place_hierarchy'->>'kind','Yer'),
    p_district_target_id,coalesce(target.editorial_metadata->>'location_source_key','target:'||target.id),0
  from public.canonical_targets target
  where p_district_target_id is not null
    and target.editorial_metadata #>> '{place_hierarchy,parent_target_id}'=p_district_target_id::text
    and not exists(select 1 from public.uin_place_nodes_v123 node where node.canonical_target_id=target.id)
  union all
  select item.canonical_target_id,item.canonical_title,'city',country.canonical_target_id,
    coalesce(item.external_id,item.metadata->>'source_external_id'),0
  from public.seed_catalog_items item
  join public.uin_place_nodes_v123 country on country.scope='country' and country.country_code=item.metadata->>'country_code'
  where p_city_target_id is null and p_district_target_id is null and coalesce(nullif(p_country_code,''),'TR')<>'TR'
    and item.status='active' and item.metadata->>'global_place_catalogue'='true' and item.metadata->>'global_place_kind'='city'
    and item.metadata->>'country_code'=coalesce(nullif(p_country_code,''),'TR')
), filtered as (
  select distinct on(rows.target_id) rows.* from rows
  where nullif(btrim(coalesce(p_query,'')),'') is null or public.canonical_normalize_v31(rows.title) like '%'||public.canonical_normalize_v31(p_query)||'%'
  order by rows.target_id
)
select filtered.* from filtered
order by case when filtered.target_id=coalesce(p_district_target_id,p_city_target_id) then 0 else 1 end,
  public.canonical_normalize_v31(filtered.title),filtered.target_id
limit greatest(1,least(coalesce(p_limit,500),500)) offset greatest(coalesce(p_offset,0),0);
$$;

create or replace function public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with requested as materialized (
    select id,position from unnest(coalesce(p_target_ids,array[]::uuid[])) with ordinality input(id,position)
  )
  select jsonb_build_object(
    'canonical_target_id',target.id,'canonical_kind',target.kind,'source_seed_id',null,
    'title',target.title,'subtitle',coalesce(target.creator_name,community.name),
    'seed_type_name',coalesce(seed_type.name,category.name),
    'seed_type_slug',coalesce(nullif(target.editorial_metadata->>'action_key',''),case when target.kind='live_match' then 'sport-live' else seed_type.slug end),
    'seed_type_icon',coalesce(nullif(target.editorial_metadata->>'display_icon',''),case when target.kind='live_match' then '🏟️' else coalesce(seed_type.icon,'🌱') end),
    'subject_type',nullif(target.editorial_metadata->>'subject_type',''),
    'item_kind',coalesce(catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'place'),
    'primary_category_id',coalesce(catalogue.primary_category_id,target.primary_category_id),
    'cover_url',coalesce(target.editorial_cover_url,catalogue.cover_url,activity.default_cover_url,category.default_cover_url),
    'catalog_cover_url',catalogue.cover_url,'own_seed_id',own_seed.id,'own_common_intent_id',null,
    'intent_people_count',0,'experience_people_count',0,'social_intent_count',0,
    'activity_id',target.activity_id,'sport_name',sport.name,'community_name',community.name,
    'updated_at',coalesce(catalogue.updated_at,target.updated_at)
  )
  from requested
  join public.canonical_targets target on target.id=requested.id
  left join public.activities activity on activity.id=target.activity_id
  left join public.activity_categories category on category.id=activity.category_id
  left join public.sports sport on sport.id=target.sport_id
  left join public.communities community on community.id=target.primary_community_id
  left join lateral(select item.* from public.seed_catalog_items item where item.canonical_target_id=target.id and item.status='active' order by item.updated_at desc,item.id limit 1) catalogue on true
  left join public.seed_types seed_type on seed_type.id=catalogue.seed_type_id
  left join lateral(select seed.id from public.seeds seed where seed.canonical_target_id=target.id and seed.user_id=auth.uid() and seed.status in('active','completed') order by seed.updated_at desc limit 1) own_seed on true
  where public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
  order by requested.position;
$$;

revoke all on function public.get_uin_place_countries_v123() from public;
revoke all on function public.get_uin_place_level_v123(text,uuid,uuid,text,integer,integer) from public;
revoke all on function public.get_uin_catalogue_for_targets_v123(uuid[]) from public;
grant execute on function public.get_uin_place_countries_v123() to anon,authenticated;
grant execute on function public.get_uin_place_level_v123(text,uuid,uuid,text,integer,integer) to anon,authenticated;
grant execute on function public.get_uin_catalogue_for_targets_v123(uuid[]) to anon,authenticated;
notify pgrst,'reload schema';
commit;
