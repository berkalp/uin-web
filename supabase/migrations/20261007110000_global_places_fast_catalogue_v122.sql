begin;
set local lock_timeout='30s';
set local statement_timeout='5min';

create table if not exists public.uin_global_place_kind_stats_v122(
  place_kind text primary key,
  card_count integer not null,
  updated_at timestamptz not null default now()
);

insert into public.uin_global_place_kind_stats_v122(place_kind,card_count,updated_at)
select metadata->>'global_place_kind',count(*)::integer,now()
from public.seed_catalog_items
where status='active' and metadata->>'global_place_catalogue'='true'
group by metadata->>'global_place_kind'
on conflict(place_kind) do update
set card_count=excluded.card_count,updated_at=excluded.updated_at;

revoke all on public.uin_global_place_kind_stats_v122 from public,anon,authenticated;

create or replace function public.get_global_place_counts_v122()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'countries',coalesce(max(card_count) filter(where place_kind='country'),0),
    'cities',coalesce(max(card_count) filter(where place_kind='city'),0),
    'total',coalesce(sum(card_count),0)
  )
  from public.uin_global_place_kind_stats_v122;
$$;
revoke all on function public.get_global_place_counts_v122() from public;
grant execute on function public.get_global_place_counts_v122() to anon,authenticated;

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
      from public.seed_catalog_items item
      where item.status='active' and item.canonical_target_id is not null
        and item.metadata->>'global_place_catalogue'='true'
        and item.metadata->>'global_place_kind'='city'
        and public.canonical_normalize_v31(item.canonical_title||' '||coalesce(item.creator_name,''))
          like '%'||public.canonical_normalize_v31(p_query)||'%';
  end if;
end;
$$;
revoke all on function public.get_uin_catalogue_candidate_ids_v122(text,uuid) from public,anon,authenticated;

create or replace function public.get_uin_catalogue_fast_v122(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0,
  p_target_id uuid default null
) returns setof jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  with candidate_ids as materialized (
    select id from public.get_uin_catalogue_candidate_ids_v122(p_query,p_target_id) id
  ), candidates as materialized (
    select target.*
    from candidate_ids candidate
    join public.canonical_targets target on target.id=candidate.id
    where not (coalesce(target.editorial_metadata,'{}'::jsonb) ? 'merged_into_target_id')
  )
  select jsonb_build_object(
    'canonical_target_id',target.id,
    'canonical_kind',target.kind,
    'source_seed_id',null,
    'title',target.title,
    'subtitle',coalesce(target.creator_name,community.name),
    'seed_type_name',coalesce(seed_type.name,category.name),
    'seed_type_slug',coalesce(nullif(target.editorial_metadata->>'action_key',''),case when target.kind='live_match' then 'sport-live' else seed_type.slug end),
    'seed_type_icon',coalesce(nullif(target.editorial_metadata->>'display_icon',''),case when target.kind='live_match' then '🏟️' else coalesce(seed_type.icon,'🌱') end),
    'subject_type',nullif(target.editorial_metadata->>'subject_type',''),
    'item_kind',coalesce(catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind','')),
    'primary_category_id',coalesce(catalogue.primary_category_id,target.primary_category_id),
    'cover_url',coalesce(target.editorial_cover_url,catalogue.cover_url,activity.default_cover_url,category.default_cover_url),
    'catalog_cover_url',catalogue.cover_url,
    'own_seed_id',own_seed.id,
    'own_common_intent_id',null,
    'intent_people_count',0,
    'experience_people_count',0,
    'social_intent_count',0,
    'activity_id',target.activity_id,
    'sport_name',sport.name,
    'community_name',community.name,
    'updated_at',coalesce(catalogue.updated_at,target.updated_at)
  )
  from candidates target
  left join public.activities activity on activity.id=target.activity_id
  left join public.activity_categories category on category.id=activity.category_id
  left join public.sports sport on sport.id=target.sport_id
  left join public.communities community on community.id=target.primary_community_id
  left join lateral (
    select item.* from public.seed_catalog_items item
    where item.canonical_target_id=target.id and item.status='active'
    order by item.updated_at desc,item.id limit 1
  ) catalogue on true
  left join public.seed_types seed_type on seed_type.id=catalogue.seed_type_id
  left join lateral (
    select seed.id from public.seeds seed
    where seed.canonical_target_id=target.id and seed.user_id=auth.uid()
      and seed.status in ('active','completed')
    order by seed.updated_at desc limit 1
  ) own_seed on true
  where (public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false)
    and (
      nullif(btrim(coalesce(p_query,'')),'') is null
      or public.canonical_normalize_v31(target.title||' '||coalesce(target.creator_name,'')||' '||coalesce(community.name,'')||' '||coalesce(sport.name,''))
        like '%'||public.canonical_normalize_v31(p_query)||'%'
    )
  order by coalesce(catalogue.updated_at,target.updated_at) desc,target.id
  limit greatest(1,least(coalesce(p_limit,100),200))
  offset greatest(coalesce(p_offset,0),0);
$$;
revoke all on function public.get_uin_catalogue_fast_v122(text,integer,integer,uuid) from public;
grant execute on function public.get_uin_catalogue_fast_v122(text,integer,integer,uuid) to anon,authenticated;

notify pgrst,'reload schema';
commit;
