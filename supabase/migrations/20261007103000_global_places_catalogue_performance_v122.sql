begin;
set local lock_timeout='30s';
set local statement_timeout='5min';

create index if not exists seed_catalog_global_city_target_v122
on public.seed_catalog_items(canonical_target_id)
where status='active'
  and metadata->>'global_place_catalogue'='true'
  and metadata->>'global_place_kind'='city';

create index if not exists seed_catalog_non_global_active_v122
on public.seed_catalog_items(canonical_target_id,((metadata->>'content_type_id')))
where status='active'
  and coalesce(metadata->>'global_place_catalogue','false')<>'true';

do $catalogue_performance$
declare
  definition text;
  select_marker text := '  select jsonb_build_object(';
  source_marker text := 'from public.canonical_targets t left join stats';
  candidate_cte text := ',
  candidates as materialized (
    select candidate.*
    from public.canonical_targets candidate
    where p_target_id is not null
      or not exists(
        select 1 from public.seed_catalog_items bulk_city
        where bulk_city.canonical_target_id=candidate.id
          and bulk_city.status=''active''
          and bulk_city.metadata->>''global_place_catalogue''=''true''
          and bulk_city.metadata->>''global_place_kind''=''city''
      )
      or (
        nullif(btrim(coalesce(p_query,'''')),'''') is not null
        and public.canonical_normalize_v31(candidate.title||'' ''||coalesce(candidate.creator_name,''''))
          like ''%''||public.canonical_normalize_v31(p_query)||''%''
      )
  )
  select jsonb_build_object(';
begin
  definition:=pg_get_functiondef('public.get_uin_catalogue_v64(text,integer,integer,uuid)'::regprocedure);
  if position('from candidates t left join stats' in definition)=0 then
    if position(select_marker in definition)=0 or position(source_marker in definition)=0 then
      raise exception 'Catalogue definition changed before global-place optimization';
    end if;
    definition:=replace(definition,select_marker,candidate_cte);
    definition:=replace(definition,source_marker,'from candidates t left join stats');
    execute definition;
  end if;
end;
$catalogue_performance$;

create table if not exists public.uin_global_place_stats_v122(
  content_type_id text primary key,
  card_count integer not null,
  updated_at timestamptz not null default now()
);

insert into public.uin_global_place_stats_v122(content_type_id,card_count,updated_at)
select coalesce(nullif(metadata->>'content_type_id',''),'place'),count(distinct canonical_target_id)::integer,now()
from public.seed_catalog_items
where status='active'
  and canonical_target_id is not null
  and metadata->>'global_place_catalogue'='true'
group by coalesce(nullif(metadata->>'content_type_id',''),'place')
on conflict(content_type_id) do update
set card_count=excluded.card_count,updated_at=excluded.updated_at;

revoke all on public.uin_global_place_stats_v122 from public,anon,authenticated;

create or replace function public.get_uin_content_type_counts_v120()
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with non_global_items as materialized (
    select item.canonical_target_id,item.metadata,item.item_kind
    from public.seed_catalog_items item
    where item.status='active'
      and item.canonical_target_id is not null
      and coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
  ), visible_targets as materialized (
    select distinct item.canonical_target_id as target_id,
      coalesce(
        nullif(item.metadata->>'content_type_id',''),
        nullif((select target.editorial_metadata->>'content_type_id' from public.canonical_targets target where target.id=item.canonical_target_id),''),
        case when item.item_kind='video' then 'series' else item.item_kind end
      ) as content_type_id
    from non_global_items item
    where coalesce(((select target.editorial_metadata from public.canonical_targets target where target.id=item.canonical_target_id)->>'admin_hidden')::boolean,false)=false
  ), dynamic_counts as (
    select content_type_id,count(*)::integer as card_count
    from visible_targets
    where content_type_id is not null
    group by content_type_id
  ), counts as (
    select content_type_id,sum(card_count)::integer as card_count
    from (
      select content_type_id,card_count from dynamic_counts
      union all
      select content_type_id,card_count from public.uin_global_place_stats_v122
    ) combined
    group by content_type_id
  )
  select jsonb_build_object('content_type_id',type.id,'count',coalesce(counts.card_count,0))
  from public.uin_content_types type
  left join counts on counts.content_type_id=type.id
  where type.active
  order by type.position,type.label;
$$;

notify pgrst,'reload schema';
commit;
