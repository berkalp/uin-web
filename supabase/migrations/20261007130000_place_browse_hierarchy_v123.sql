begin;
set local statement_timeout='10min';
lock table public.seed_catalog_items in share row exclusive mode;
alter table public.seed_catalog_items disable trigger guard_uin_card_insert_v73;

create table if not exists public.uin_place_nodes_v123(
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  scope text not null check(scope in ('country','city','district')),
  country_code text not null,
  country_name text not null,
  city text,
  district text,
  canonical_target_id uuid not null references public.canonical_targets(id) on delete cascade,
  parent_target_id uuid references public.canonical_targets(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uin_place_nodes_v123_parent_idx on public.uin_place_nodes_v123(parent_target_id,scope);
create index if not exists uin_place_nodes_v123_country_idx on public.uin_place_nodes_v123(country_code,scope);
revoke all on public.uin_place_nodes_v123 from public,anon,authenticated;

do $migration$
declare v_go_type_id uuid;
begin
  select id into v_go_type_id from public.seed_types
  where is_active and slug in ('go','travel','visit','place','git')
  order by case slug when 'go' then 0 when 'travel' then 1 when 'visit' then 2 when 'place' then 3 else 4 end limit 1;
  if v_go_type_id is null then raise exception 'Aktif yer/gezi seed türü bulunamadı.'; end if;

  insert into public.uin_place_nodes_v123(source_key,scope,country_code,country_name,canonical_target_id)
  select 'country:'||(item.metadata->>'country_code'),'country',item.metadata->>'country_code',item.canonical_title,item.canonical_target_id
  from public.seed_catalog_items item
  where item.status='active' and item.item_kind='place' and item.metadata->>'global_place_catalogue'='true'
    and item.metadata->>'global_place_kind'='country' and nullif(item.metadata->>'country_code','') is not null
  on conflict(source_key) do update set country_name=excluded.country_name,canonical_target_id=excluded.canonical_target_id,updated_at=now();

  create temporary table tr_city_choice_v123 on commit drop as
  select location.source_key,location.city,location.province_external_id,
    coalesce(existing.canonical_target_id,global_city.canonical_target_id) canonical_target_id
  from public.locations location
  left join lateral(
    select item.canonical_target_id from public.seed_catalog_items item join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active' and item.item_kind='place'
      and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(location.city)
      and (coalesce(item.metadata->>'country_code','TR')='TR' or item.metadata->'countries' ? 'Türkiye')
    order by case when target.editorial_metadata->'place_hierarchy'->>'kind'='İl' then 0
      when item.metadata->>'global_place_kind'='city' then 1 else 2 end,item.updated_at desc limit 1
  ) existing on true
  left join lateral(
    select item.canonical_target_id from public.seed_catalog_items item
    where item.status='active' and item.item_kind='place' and item.metadata->>'global_place_catalogue'='true'
      and item.metadata->>'global_place_kind'='city' and item.metadata->>'country_code'='TR'
      and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(location.city)
    order by case item.metadata->>'feature_code' when 'PPLA' then 0 when 'PPLC' then 1 else 2 end,
      coalesce((item.metadata->>'population')::bigint,0) desc limit 1
  ) global_city on true
  where location.country_code='TR' and location.scope='city';

  insert into public.seed_catalog_items(seed_type_id,item_kind,canonical_title,creator_name,language_code,external_source,external_id,metadata,status)
  select v_go_type_id,'place',choice.city,'Türkiye','tr','uin-location',choice.source_key,
    jsonb_build_object('content_type_id','place','uin_item_kind','place','source_provider','uin-location',
      'source_external_id',choice.source_key,'place_kind','İl','country_code','TR','country','Türkiye',
      'province_external_id',choice.province_external_id),'active'
  from tr_city_choice_v123 choice where choice.canonical_target_id is null
  on conflict do nothing;

  update tr_city_choice_v123 choice set canonical_target_id=item.canonical_target_id
  from public.seed_catalog_items item where choice.canonical_target_id is null and item.status='active'
    and item.external_source='uin-location' and item.external_id=choice.source_key;

  insert into public.uin_place_nodes_v123(source_key,scope,country_code,country_name,city,canonical_target_id,parent_target_id,sort_order)
  select choice.source_key,'city','TR','Türkiye',choice.city,choice.canonical_target_id,country.canonical_target_id,coalesce(choice.province_external_id,0)
  from tr_city_choice_v123 choice cross join lateral(
    select canonical_target_id from public.uin_place_nodes_v123 where source_key='country:TR'
  ) country where choice.canonical_target_id is not null
  on conflict(source_key) do update set city=excluded.city,canonical_target_id=excluded.canonical_target_id,
    parent_target_id=excluded.parent_target_id,sort_order=excluded.sort_order,updated_at=now();

  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'content_type_id','place','item_kind','place','place_hierarchy',jsonb_build_object('kind','İl','parent_target_id',node.parent_target_id),
    'card_hierarchy',jsonb_build_object('parent_target_id',node.parent_target_id,'sort_order',node.sort_order,'section_title','Türkiye illeri'),
    'country_code','TR','country','Türkiye','location_source_key',node.source_key
  ),updated_at=now()
  from public.uin_place_nodes_v123 node where node.scope='city' and node.country_code='TR' and target.id=node.canonical_target_id;

  create temporary table tr_district_choice_v123 on commit drop as
  select coalesce(location.source_key,'TR:district:'||location.id::text) source_key,location.city,location.district,location.external_id,city_node.canonical_target_id parent_target_id,
    existing.canonical_target_id
  from public.locations location
  join public.uin_place_nodes_v123 city_node on city_node.scope='city' and city_node.country_code='TR' and city_node.city=location.city
  left join lateral(
    select item.canonical_target_id from public.seed_catalog_items item join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active' and item.item_kind='place'
      and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(location.district)
      and target.editorial_metadata->'place_hierarchy'->>'kind'='İlçe'
      and nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid=city_node.canonical_target_id
    order by item.updated_at desc limit 1
  ) existing on true
  where location.country_code='TR' and location.scope='district';

  insert into public.seed_catalog_items(seed_type_id,item_kind,canonical_title,creator_name,language_code,external_source,external_id,metadata,status)
  select v_go_type_id,'place',choice.district||' ('||choice.city||')',choice.city||' ilçesi','tr','uin-location',choice.source_key,
    jsonb_build_object('content_type_id','place','uin_item_kind','place','source_provider','uin-location',
      'source_external_id',choice.source_key,'place_kind','İlçe','country_code','TR','country','Türkiye',
      'city',choice.city,'district',choice.district,'district_external_id',choice.external_id),'active'
  from tr_district_choice_v123 choice where choice.canonical_target_id is null
  on conflict do nothing;

  update tr_district_choice_v123 choice set canonical_target_id=item.canonical_target_id
  from public.seed_catalog_items item where choice.canonical_target_id is null and item.status='active'
    and item.external_source='uin-location' and item.external_id=choice.source_key;

  insert into public.uin_place_nodes_v123(source_key,scope,country_code,country_name,city,district,canonical_target_id,parent_target_id,sort_order)
  select choice.source_key,'district','TR','Türkiye',choice.city,choice.district,choice.canonical_target_id,choice.parent_target_id,coalesce(choice.external_id,0)
  from tr_district_choice_v123 choice where choice.canonical_target_id is not null
  on conflict(source_key) do update set city=excluded.city,district=excluded.district,canonical_target_id=excluded.canonical_target_id,
    parent_target_id=excluded.parent_target_id,sort_order=excluded.sort_order,updated_at=now();

  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'content_type_id','place','item_kind','place','place_hierarchy',jsonb_build_object('kind','İlçe','parent_target_id',node.parent_target_id),
    'card_hierarchy',jsonb_build_object('parent_target_id',node.parent_target_id,'sort_order',node.sort_order,'section_title',node.city||' ilçeleri'),
    'country_code','TR','country','Türkiye','city',node.city,'district',node.district,'location_source_key',node.source_key
  ),updated_at=now()
  from public.uin_place_nodes_v123 node where node.scope='district' and target.id=node.canonical_target_id;

  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'place_hierarchy',jsonb_build_object('kind','Yer','parent_target_id',district.canonical_target_id),
    'card_hierarchy',jsonb_build_object('parent_target_id',district.canonical_target_id,'sort_order',0,'section_title',district.district||' içindeki yerler')
  ),updated_at=now()
  from public.seed_catalog_items item
  join public.uin_place_nodes_v123 district on district.scope='district' and district.country_code='TR'
    and exists(select 1 from jsonb_array_elements_text(coalesce(item.metadata->'admin_areas','[]'::jsonb)) area
      where public.canonical_normalize_v31(area)=public.canonical_normalize_v31(district.district))
  where item.canonical_target_id=target.id and item.status='active' and item.item_kind='place'
    and target.id<>district.canonical_target_id and target.editorial_metadata->'place_hierarchy'->>'kind'='Yer';

  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'place_hierarchy',jsonb_build_object('kind','Yer','parent_target_id',district.canonical_target_id),
    'card_hierarchy',jsonb_build_object('parent_target_id',district.canonical_target_id,'sort_order',0,'section_title','Üsküdar içindeki yerler')
  ),updated_at=now()
  from public.seed_catalog_items item
  join public.uin_place_nodes_v123 district on district.scope='district' and district.country_code='TR'
    and district.city='İstanbul' and district.district='Üsküdar'
  where item.canonical_target_id=target.id and item.status='active' and item.item_kind='place' and item.canonical_title='Kız Kulesi';
end;
$migration$;

alter table public.seed_catalog_items enable trigger guard_uin_card_insert_v73;

create or replace function public.get_uin_place_countries_v123()
returns table(country_code text,country_name text,target_id uuid,city_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  select node.country_code,node.country_name,node.canonical_target_id,
    case when node.country_code='TR' then (select count(*) from public.uin_place_nodes_v123 city where city.scope='city' and city.country_code='TR')
      else (select count(*) from public.seed_catalog_items item where item.status='active' and item.metadata->>'global_place_catalogue'='true'
        and item.metadata->>'global_place_kind'='city' and item.metadata->>'country_code'=node.country_code) end
  from public.uin_place_nodes_v123 node where node.scope='country'
  order by public.canonical_normalize_v31(node.country_name),node.country_code;
$$;

create or replace function public.get_uin_place_level_v123(
  p_country_code text default 'TR',p_city_target_id uuid default null,p_district_target_id uuid default null,
  p_query text default null,p_limit integer default 500,p_offset integer default 0
) returns table(target_id uuid,title text,scope text,parent_target_id uuid,source_key text,child_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
with rows as (
  select node.canonical_target_id target_id,coalesce(node.district,node.city,node.country_name) title,node.scope,
    node.parent_target_id,node.source_key,
    (select count(*) from public.uin_place_nodes_v123 child where child.parent_target_id=node.canonical_target_id)
      +(select count(*) from public.canonical_targets child where nullif(child.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid=node.canonical_target_id
        and not exists(select 1 from public.uin_place_nodes_v123 known where known.canonical_target_id=child.id)) child_count
  from public.uin_place_nodes_v123 node
  where (p_district_target_id is not null and (node.canonical_target_id=p_district_target_id))
     or (p_district_target_id is null and p_city_target_id is not null and (node.canonical_target_id=p_city_target_id or node.parent_target_id=p_city_target_id))
     or (p_district_target_id is null and p_city_target_id is null and node.scope='city' and node.country_code=coalesce(nullif(p_country_code,''),'TR'))
  union all
  select target.id,target.title,coalesce(target.editorial_metadata->'place_hierarchy'->>'kind','Yer'),
    nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
    coalesce(target.editorial_metadata->>'location_source_key','target:'||target.id),0
  from public.canonical_targets target
  where ((p_district_target_id is not null and nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid=p_district_target_id)
    or (p_district_target_id is null and p_city_target_id is not null and nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid=p_city_target_id))
    and not exists(select 1 from public.uin_place_nodes_v123 node where node.canonical_target_id=target.id)
  union all
  select item.canonical_target_id,item.canonical_title,'city',country.canonical_target_id,
    coalesce(item.external_id,item.metadata->>'source_external_id'),0
  from public.seed_catalog_items item
  join public.uin_place_nodes_v123 country on country.scope='country' and country.country_code=item.metadata->>'country_code'
  where p_city_target_id is null and p_district_target_id is null and coalesce(nullif(p_country_code,''),'TR')<>'TR'
    and item.status='active' and item.metadata->>'global_place_catalogue'='true' and item.metadata->>'global_place_kind'='city'
    and item.metadata->>'country_code'=coalesce(nullif(p_country_code,''),'TR')
)
select distinct on(rows.target_id) rows.target_id,rows.title,rows.scope,rows.parent_target_id,rows.source_key,rows.child_count
from rows where nullif(btrim(coalesce(p_query,'')),'') is null or public.canonical_normalize_v31(rows.title) like '%'||public.canonical_normalize_v31(p_query)||'%'
order by rows.target_id,
  case when rows.target_id=coalesce(p_district_target_id,p_city_target_id) then 0 when rows.scope in ('İl','Şehir','city') then 1 when rows.scope in ('İlçe','district') then 2 else 3 end,
  public.canonical_normalize_v31(rows.title)
limit greatest(1,least(coalesce(p_limit,500),500)) offset greatest(coalesce(p_offset,0),0);
$$;

create or replace function public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select card from unnest(coalesce(p_target_ids,array[]::uuid[])) with ordinality requested(id,position)
  cross join lateral public.get_uin_catalogue_fast_v122(null,1,0,requested.id) card
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
