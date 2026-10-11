begin;
set local statement_timeout='10min';
-- Repair only proven city aliases. Preserve every child's ID and user history.
with parents as materialized (
 select distinct p.id from public.canonical_targets p join public.uin_place_nodes_v123 n on n.scope='city' and n.country_code='TR' and public.canonical_normalize_v31(p.title)=public.canonical_normalize_v31(n.city)
), aliases as materialized (
 select r.requested_id,r.resolved_id from public.resolve_uin_card_targets_v143((select array_agg(id) from parents)) r join public.uin_place_nodes_v123 n on n.canonical_target_id=r.resolved_id and n.scope='city' where r.requested_id<>r.resolved_id
)
update public.canonical_targets t set editorial_metadata=
 case when t.editorial_metadata #>> '{card_hierarchy,parent_target_id}'=a.requested_id::text then jsonb_set(t.editorial_metadata,'{card_hierarchy,parent_target_id}',to_jsonb(a.resolved_id::text)) else t.editorial_metadata end,
 updated_at=now() from aliases a where t.editorial_metadata #>> '{card_hierarchy,parent_target_id}'=a.requested_id::text;
with parents as materialized (
 select distinct p.id from public.canonical_targets p join public.uin_place_nodes_v123 n on n.scope='city' and n.country_code='TR' and public.canonical_normalize_v31(p.title)=public.canonical_normalize_v31(n.city)
), aliases as materialized (
 select r.requested_id,r.resolved_id from public.resolve_uin_card_targets_v143((select array_agg(id) from parents)) r join public.uin_place_nodes_v123 n on n.canonical_target_id=r.resolved_id and n.scope='city' where r.requested_id<>r.resolved_id
)
update public.canonical_targets t set editorial_metadata=jsonb_set(t.editorial_metadata,'{place_hierarchy,parent_target_id}',to_jsonb(a.resolved_id::text)),updated_at=now() from aliases a where t.editorial_metadata #>> '{place_hierarchy,parent_target_id}'=a.requested_id::text;
-- Indexed directory of every imported city. No user records or canonical IDs change.
create table if not exists public.uin_place_directory_v172(
 target_id uuid primary key references public.canonical_targets(id) on delete cascade,
 country_code text not null,title text not null,search_title text not null,source_key text not null,
 parent_target_id uuid, population bigint,region_code text,region_name text
);
create index if not exists uin_place_directory_country_population_v172 on public.uin_place_directory_v172(country_code,population desc nulls last,target_id);
create index if not exists uin_place_directory_region_population_v172 on public.uin_place_directory_v172(country_code,region_code,population desc nulls last,target_id);
revoke all on public.uin_place_directory_v172 from public,anon,authenticated;
with regions as (select value->>0 source_key,value->>1 code,value->>2 name from jsonb_array_elements($regions$__REGIONS__$regions$::jsonb)),
items as (select distinct on(i.canonical_target_id) i.* from public.seed_catalog_items i where i.status='active' and i.metadata->>'global_place_kind'='city' and i.metadata->>'global_place_catalogue'='true' and i.metadata->>'country_code'<>'TR' order by i.canonical_target_id,i.updated_at desc,i.id)
insert into public.uin_place_directory_v172
select i.canonical_target_id,i.metadata->>'country_code',i.canonical_title,public.canonical_normalize_v31(i.canonical_title),i.external_id,c.canonical_target_id,
 case when i.metadata->>'population'~'^[0-9]+$' and (i.metadata->>'population')::bigint>0 then (i.metadata->>'population')::bigint end,r.code,r.name
from items i left join regions r on r.source_key=i.external_id left join public.uin_place_nodes_v123 c on c.scope='country' and c.country_code=i.metadata->>'country_code'
on conflict(target_id) do update set title=excluded.title,search_title=excluded.search_title,population=excluded.population,region_code=excluded.region_code,region_name=excluded.region_name;
insert into public.uin_place_directory_v172
select n.canonical_target_id,n.country_code,n.city,public.canonical_normalize_v31(n.city),n.source_key,n.parent_target_id,
 ($tr$__TR_POPULATIONS__$tr$::jsonb->>n.city)::bigint,null,null
from public.uin_place_nodes_v123 n where n.scope='city' and n.country_code='TR'
on conflict(target_id) do update set title=excluded.title,search_title=excluded.search_title,population=excluded.population;

create or replace function public.get_uin_place_countries_v123()
returns table(country_code text,country_name text,target_id uuid,city_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.country_code,c.country_name,c.canonical_target_id,count(d.target_id)
 from public.uin_place_nodes_v123 c left join public.uin_place_directory_v172 d using(country_code)
 where c.scope='country' group by c.country_code,c.country_name,c.canonical_target_id order by public.canonical_normalize_v31(c.country_name);
$$;

create or replace function public.get_uin_place_directory_v172(p_country text default 'TR',p_region text default null,p_query text default null,p_sort text default 'population_desc',p_limit integer default 100,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with country as materialized(select d.* from public.uin_place_directory_v172 d join public.canonical_targets t on t.id=d.target_id where d.country_code=p_country and ((select public.is_admin()) or coalesce((t.editorial_metadata->>'admin_hidden')::boolean,false)=false)),
 filtered as materialized(select * from country where (nullif(p_region,'') is null or coalesce(region_code,'unknown')=p_region) and (nullif(btrim(p_query),'') is null or search_title like '%'||public.canonical_normalize_v31(p_query)||'%')),
 page as (select * from filtered order by case when p_sort='population_asc' then population end asc nulls last,case when p_sort='population_desc' then population end desc nulls last,search_title,target_id limit greatest(1,least(p_limit,100)) offset greatest(0,p_offset)),
 regions as (select coalesce(region_code,'unknown') code,coalesce(region_name,'Bölgesi belirtilmemiş') name,count(*) total from country group by 1,2)
 select jsonb_build_object('total',(select count(*) from filtered),'offset',greatest(0,p_offset),'nodes',coalesce((select jsonb_agg(jsonb_build_object('target_id',target_id,'title',title,'scope','city','parent_target_id',parent_target_id,'source_key',source_key,'population',population,'region_code',region_code,'region_name',region_name)) from page),'[]'::jsonb),'regions',coalesce((select jsonb_agg(to_jsonb(r) order by r.name) from regions r),'[]'::jsonb));
$$;

create or replace function public.get_uin_place_children_v172(p_target_id uuid,p_limit integer default 20,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with children as materialized(
 select t.id target_id,t.title,d.depth,n.scope,coalesce(n.district,n.city) location,
 coalesce(nullif(t.editorial_metadata #>> '{card_hierarchy,parent_target_id}','')::uuid,nullif(t.editorial_metadata #>> '{place_hierarchy,parent_target_id}','')::uuid) parent_target_id,
 coalesce(t.editorial_cover_url,i.cover_url) cover_url,i.id catalog_item_id
 from public.get_uin_card_descendants_v81(p_target_id,false) d join public.canonical_targets t on t.id=d.target_id
 left join public.uin_place_nodes_v123 n on n.canonical_target_id=t.id
 left join lateral(select item.id,item.cover_url from public.seed_catalog_items item where item.canonical_target_id=t.id and item.status='active' order by item.updated_at desc,item.id limit 1) i on true
 ), page as (select * from children order by case when scope='district' then 1 else 0 end,public.canonical_normalize_v31(title),target_id limit greatest(1,least(p_limit,100)) offset greatest(0,p_offset))
 select jsonb_build_object('total',(select count(*) from children),'nodes',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
revoke all on function public.get_uin_place_directory_v172(text,text,text,text,integer,integer) from public;
revoke all on function public.get_uin_place_children_v172(uuid,integer,integer) from public;
grant execute on function public.get_uin_place_directory_v172(text,text,text,text,integer,integer),public.get_uin_place_children_v172(uuid,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
