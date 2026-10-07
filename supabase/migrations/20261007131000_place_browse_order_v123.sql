begin;
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
  where (p_district_target_id is not null and node.canonical_target_id=p_district_target_id)
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
), dedup as (
  select distinct on(rows.target_id) rows.* from rows
  where nullif(btrim(coalesce(p_query,'')),'') is null or public.canonical_normalize_v31(rows.title) like '%'||public.canonical_normalize_v31(p_query)||'%'
  order by rows.target_id
)
select dedup.target_id,dedup.title,dedup.scope,dedup.parent_target_id,dedup.source_key,dedup.child_count
from dedup order by case when dedup.target_id=coalesce(p_district_target_id,p_city_target_id) then 0
  when dedup.scope in ('İl','Şehir','city') then 1 when dedup.scope in ('İlçe','district') then 2 else 3 end,
  public.canonical_normalize_v31(dedup.title)
limit greatest(1,least(coalesce(p_limit,500),500)) offset greatest(coalesce(p_offset,0),0);
$$;
revoke all on function public.get_uin_place_level_v123(text,uuid,uuid,text,integer,integer) from public;
grant execute on function public.get_uin_place_level_v123(text,uuid,uuid,text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
