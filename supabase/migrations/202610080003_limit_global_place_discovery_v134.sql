begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- Keep the complete imported place catalogue intact for existing links and user
-- records, but expose only the 100 most populous cities of each country in
-- discovery. Turkey's local country/city/district hierarchy remains separate.
create table if not exists public.uin_global_place_visibility_v134(
  target_id uuid primary key references public.canonical_targets(id) on delete cascade,
  country_code text not null,
  population bigint not null default 0,
  country_rank integer not null,
  updated_at timestamptz not null default now()
);

create index if not exists uin_global_place_visibility_country_rank_v134_idx
on public.uin_global_place_visibility_v134(country_code,country_rank,target_id);

truncate table public.uin_global_place_visibility_v134;

with source as materialized (
  select distinct on(item.canonical_target_id)
    item.canonical_target_id target_id,
    item.metadata->>'country_code' country_code,
    case
      when coalesce(item.metadata->>'population','') ~ '^[0-9]+$'
        then (item.metadata->>'population')::bigint
      else 0::bigint
    end population,
    item.canonical_title
  from public.seed_catalog_items item
  where item.status='active'
    and item.canonical_target_id is not null
    and item.metadata->>'global_place_catalogue'='true'
    and item.metadata->>'global_place_kind'='city'
    and nullif(item.metadata->>'country_code','') is not null
  order by item.canonical_target_id,item.updated_at desc,item.id
), ranked as materialized (
  select source.*,
    row_number() over(
      partition by source.country_code
      order by source.population desc,
        public.canonical_normalize_v31(source.canonical_title),source.target_id
    )::integer country_rank
  from source
)
insert into public.uin_global_place_visibility_v134(target_id,country_code,population,country_rank)
select target_id,country_code,population,country_rank
from ranked
where country_rank<=100;

revoke all on public.uin_global_place_visibility_v134 from public,anon,authenticated;

insert into public.uin_global_place_kind_stats_v122(place_kind,card_count,updated_at)
select 'city',count(*)::integer,now()
from public.uin_global_place_visibility_v134
on conflict(place_kind) do update
set card_count=excluded.card_count,updated_at=excluded.updated_at;

create or replace function public.get_uin_place_countries_v123()
returns table(country_code text,country_name text,target_id uuid,city_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  with local_counts as materialized (
    select node.country_code,count(*)::bigint city_count
    from public.uin_place_nodes_v123 node
    where node.scope='city'
    group by node.country_code
  ), visible_counts as materialized (
    select visible.country_code,count(*)::bigint city_count
    from public.uin_global_place_visibility_v134 visible
    group by visible.country_code
  )
  select node.country_code,node.country_name,node.canonical_target_id,
    case when node.country_code='TR'
      then coalesce(local_counts.city_count,0)
      else coalesce(visible_counts.city_count,0)
    end
  from public.uin_place_nodes_v123 node
  left join local_counts using(country_code)
  left join visible_counts using(country_code)
  where node.scope='country'
  order by public.canonical_normalize_v31(node.country_name),node.country_code;
$$;

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
  select item.canonical_target_id,item.canonical_title,'city',country.canonical_target_id,
    coalesce(item.external_id,item.metadata->>'source_external_id'),0,visible.country_rank
  from public.uin_global_place_visibility_v134 visible
  join public.seed_catalog_items item on item.canonical_target_id=visible.target_id
    and item.status='active'
    and item.metadata->>'global_place_catalogue'='true'
    and item.metadata->>'global_place_kind'='city'
  join public.uin_place_nodes_v123 country on country.scope='country' and country.country_code=visible.country_code
  where p_city_target_id is null and p_district_target_id is null and coalesce(nullif(p_country_code,''),'TR')<>'TR'
    and visible.country_code=coalesce(nullif(p_country_code,''),'TR')
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
$$;

create or replace function public.get_uin_catalogue_candidate_ids_v122(p_query text,p_target_id uuid)
returns setof uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if p_target_id is not null then
    return next p_target_id;
    return;
  end if;
  return query
    select distinct item.canonical_target_id
    from public.seed_catalog_items item
    where item.status='active' and item.canonical_target_id is not null
      and coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
    union
    select distinct item.canonical_target_id
    from public.seed_catalog_items item
    where item.status='active' and item.canonical_target_id is not null
      and item.metadata->>'global_place_catalogue'='true'
      and item.metadata->>'global_place_kind'='country';
  if nullif(btrim(coalesce(p_query,'')),'') is not null then
    return query
      select distinct item.canonical_target_id
      from public.uin_global_place_visibility_v134 visible
      join public.seed_catalog_items item on item.canonical_target_id=visible.target_id
      where item.status='active'
        and item.metadata->>'global_place_catalogue'='true'
        and item.metadata->>'global_place_kind'='city'
        and public.canonical_normalize_v31(item.canonical_title||' '||coalesce(item.creator_name,''))
          like '%'||public.canonical_normalize_v31(p_query)||'%';
  end if;
end;
$$;

revoke all on function public.get_uin_place_countries_v123() from public;
revoke all on function public.get_uin_place_level_v123(text,uuid,uuid,text,integer,integer) from public;
revoke all on function public.get_uin_catalogue_candidate_ids_v122(text,uuid) from public,anon,authenticated;
grant execute on function public.get_uin_place_countries_v123() to anon,authenticated;
grant execute on function public.get_uin_place_level_v123(text,uuid,uuid,text,integer,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;
