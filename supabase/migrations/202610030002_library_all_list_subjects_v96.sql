begin;
set local lock_timeout='10s';
set local statement_timeout='180s';
set local search_path=public,extensions;

create or replace function public.infer_uin_content_type_v96(
  p_catalog_kind text,
  p_catalog_metadata jsonb,
  p_seed_type_slug text,
  p_seed_type_name text
) returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case
    when nullif(btrim(coalesce(p_catalog_metadata->>'content_type_id','')),'') is not null
      then btrim(p_catalog_metadata->>'content_type_id')
    when lower(coalesce(p_catalog_kind,''))='video' then 'series'
    when lower(coalesce(p_catalog_kind,'')) in ('track','album','music') then 'artist'
    when lower(coalesce(p_catalog_kind,'')) not in ('','generic') then lower(p_catalog_kind)
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(sport activity|sport-do|spor dal)' then 'sport'
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(watch|izle)' then 'movie'
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(read|oku)' then 'book'
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(listen|dinle|music|müzik)' then 'artist'
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(visit|ziyaret|git)' then 'place'
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(play|oyna)' then 'game'
    when lower(coalesce(p_seed_type_slug,'')||' '||coalesce(p_seed_type_name,'')) ~ '(learn|öğren|ogren|eğitim|egitim)' then 'learning_skill'
    else 'activity'
  end;
$$;

-- Older Listem rows already have a canonical target, but many targets predate
-- content_type_id. Fill only missing classifications and keep every admin choice.
with candidates as (
  select distinct on (seed.canonical_target_id)
    seed.canonical_target_id as target_id,
    public.infer_uin_content_type_v96(item.item_kind,item.metadata,seed_type.slug,seed_type.name) as type_id
  from public.seeds seed
  join public.canonical_targets target on target.id=seed.canonical_target_id
  left join public.seed_types seed_type on seed_type.id=seed.seed_type_id
  left join lateral (
    select catalog.item_kind,catalog.metadata
    from public.seed_catalog_items catalog
    where catalog.id=seed.catalog_item_id or catalog.canonical_target_id=seed.canonical_target_id
    order by
      (catalog.id=seed.catalog_item_id) desc,
      (catalog.status='active') desc,
      (catalog.status<>'rejected') desc,
      catalog.updated_at desc,
      catalog.id
    limit 1
  ) item on true
  where seed.canonical_target_id is not null
    and seed.status in ('active','completed')
    and nullif(btrim(coalesce(target.editorial_metadata->>'content_type_id','')),'') is null
  order by seed.canonical_target_id,seed.updated_at desc,seed.id
)
update public.canonical_targets target
set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object('content_type_id',candidate.type_id),
    updated_at=now()
from candidates candidate
where target.id=candidate.target_id
  and exists(select 1 from public.uin_content_types type where type.id=candidate.type_id);

-- A user's own Listem is authoritative for that user's Library. Published
-- catalogue rows remain shared globally; pending/private subjects are returned
-- only to their owner by this authenticated projection.
create or replace function public.get_my_uin_library_subjects_v96()
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with ranked as (
    select seed.*,
      row_number() over(
        partition by seed.canonical_target_id
        order by case seed.status when 'completed' then 0 else 1 end,seed.updated_at desc,seed.id
      ) as rn
    from public.seeds seed
    where seed.user_id=auth.uid()
      and seed.status in ('active','completed')
      and seed.canonical_target_id is not null
  )
  select jsonb_build_object(
    'canonical_target_id',target.id,
    'canonical_kind',target.kind,
    'source_seed_id',seed.id,
    'title',coalesce(nullif(btrim(target.title),''),seed.title),
    'subtitle',coalesce(target.creator_name,item.creator_name,seed.subtitle),
    'seed_type_name',seed_type.name,
    'seed_type_slug',seed_type.slug,
    'seed_type_icon',seed_type.icon,
    'item_kind',item.item_kind,
    'content_type_id',coalesce(
      nullif(btrim(target.editorial_metadata->>'content_type_id'),''),
      public.infer_uin_content_type_v96(item.item_kind,item.metadata,seed_type.slug,seed_type.name)
    ),
    'cover_url',coalesce(target.editorial_cover_url,item.cover_url),
    'catalog_cover_url',item.cover_url,
    'catalog_item_id',item.id,
    'own_seed_id',seed.id,
    'own_seed_status',seed.status,
    'intent_people_count',case when seed.status='completed' then 0 else 1 end,
    'experience_people_count',case when seed.status='completed' then 1 else 0 end,
    'social_intent_count',0,
    'updated_at',greatest(seed.updated_at,target.updated_at)
  )
  from ranked seed
  join public.canonical_targets target on target.id=seed.canonical_target_id
  left join public.seed_types seed_type on seed_type.id=seed.seed_type_id
  left join lateral (
    select catalog.id,catalog.item_kind,catalog.creator_name,catalog.cover_url,catalog.metadata
    from public.seed_catalog_items catalog
    where catalog.id=seed.catalog_item_id or catalog.canonical_target_id=target.id
    order by
      (catalog.id=seed.catalog_item_id) desc,
      (catalog.status='active') desc,
      (catalog.status<>'rejected') desc,
      catalog.updated_at desc,
      catalog.id
    limit 1
  ) item on true
  where seed.rn=1
  order by seed.updated_at desc,seed.id;
$$;

revoke all on function public.infer_uin_content_type_v96(text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.get_my_uin_library_subjects_v96() from public,anon;
grant execute on function public.get_my_uin_library_subjects_v96() to authenticated;
notify pgrst,'reload schema';
commit;
