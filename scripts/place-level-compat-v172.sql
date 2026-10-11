CREATE OR REPLACE FUNCTION public.get_uin_place_level_v123(p_country_code text DEFAULT 'TR'::text, p_city_target_id uuid DEFAULT NULL::uuid, p_district_target_id uuid DEFAULT NULL::uuid, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS TABLE(target_id uuid, title text, scope text, parent_target_id uuid, source_key text, child_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
with structural as materialized (
  select node.canonical_target_id target_id,coalesce(node.district,node.city,node.country_name) title,node.scope,
    node.parent_target_id,node.source_key
  from public.uin_place_nodes_v123 node
  where (p_district_target_id is not null and node.canonical_target_id=p_district_target_id)
     or (p_district_target_id is null and p_city_target_id is not null and
       (node.canonical_target_id=p_city_target_id or (node.parent_target_id=p_city_target_id and node.scope='district')))
     or (p_district_target_id is null and p_city_target_id is null and node.scope='city'
       and node.country_code=coalesce(nullif(p_country_code,''),'TR'))
 union all
 select d.target_id,d.title,'city',d.parent_target_id,d.source_key from public.uin_place_directory_v172 d
 where d.target_id=p_city_target_id and p_district_target_id is null and not exists(select 1 from public.uin_place_nodes_v123 n where n.canonical_target_id=d.target_id)
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
  select node.target_id,node.title,node.scope,node.parent_target_id,node.source_key,
    coalesce(counts.child_count,0) child_count,null::integer population_rank
  from structural_dedup node left join child_counts counts on counts.parent_id=node.target_id::text
  union all
  select target.id,target.title,coalesce(target.editorial_metadata->'place_hierarchy'->>'kind','Yer'),
    p_district_target_id,coalesce(target.editorial_metadata->>'location_source_key','target:'||target.id),0,null::integer
  from public.canonical_targets target
  where p_district_target_id is not null
    and target.editorial_metadata #>> '{place_hierarchy,parent_target_id}'=p_district_target_id::text
    and not exists(select 1 from public.uin_place_nodes_v123 node where node.canonical_target_id=target.id)
  union all
  select d.target_id,d.title,'city',d.parent_target_id,d.source_key,0,null::integer
  from public.uin_place_directory_v172 d
  where p_city_target_id is null and p_district_target_id is null and coalesce(nullif(p_country_code,''),'TR')<>'TR'
    and d.country_code=coalesce(nullif(p_country_code,''),'TR')
), filtered as (
  select distinct on(rows.target_id) rows.* from rows
  where nullif(btrim(coalesce(p_query,'')),'') is null
    or public.canonical_normalize_v31(rows.title) like '%'||public.canonical_normalize_v31(p_query)||'%'
  order by rows.target_id,rows.population_rank nulls last
)
select filtered.target_id,filtered.title,filtered.scope,filtered.parent_target_id,filtered.source_key,filtered.child_count
from filtered
order by case when filtered.target_id=coalesce(p_district_target_id,p_city_target_id) then 0 else 1 end,
  filtered.population_rank nulls last,public.canonical_normalize_v31(filtered.title),filtered.target_id
limit greatest(1,least(coalesce(p_limit,500),500)) offset greatest(coalesce(p_offset,0),0);
$function$
