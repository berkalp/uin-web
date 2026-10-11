-- Shared card parity: six DNA sources and exact personal sort values in the existing RPC.
-- Permissions and visibility stay in the existing functions. No new endpoint or per-card request.
begin;
CREATE OR REPLACE FUNCTION public.replace_my_intent_seed_dna_v21_2(p_intent_id uuid, p_primary_seed_id uuid DEFAULT NULL::uuid, p_related_seed_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_related uuid[];
  v_all uuid[];
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.intents intent
    where intent.id = p_intent_id
      and intent.user_id = v_user_id
  ) then
    raise exception 'Intent not found or cannot be edited.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct wanted), '{}'::uuid[])
  into v_related
  from unnest(coalesce(p_related_seed_ids, '{}'::uuid[])) wanted
  where wanted is not null
    and wanted is distinct from p_primary_seed_id;

  v_all := case
    when p_primary_seed_id is null then v_related
    else array_prepend(p_primary_seed_id, v_related)
  end;

  if coalesce(cardinality(v_all), 0) > 6 then
    raise exception 'An Intent can have at most 6 Seeds.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(v_all, '{}'::uuid[])) wanted(seed_id)
    left join public.seeds seed
      on seed.id = wanted.seed_id
     and seed.user_id = v_user_id
     and seed.status <> 'archived'
    where seed.id is null
  ) then
    raise exception 'One or more selected Seeds are unavailable.' using errcode = '22023';
  end if;

  delete from public.seed_intent_links
  where intent_id = p_intent_id;

  if p_primary_seed_id is not null then
    insert into public.seed_intent_links(seed_id, intent_id, relationship)
    values (p_primary_seed_id, p_intent_id, 'spawned_from');
  end if;

  insert into public.seed_intent_links(seed_id, intent_id, relationship)
  select seed_id, p_intent_id, 'inspired_by'
  from unnest(coalesce(v_related, '{}'::uuid[])) seed_id
  on conflict on constraint seed_intent_links_unique
  do update set relationship = excluded.relationship;

  select count(*)::integer into v_count
  from public.seed_intent_links
  where intent_id = p_intent_id;

  return v_count;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_canonical_seeds_v31(p_status text DEFAULT NULL::text)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with records as (
    select to_jsonb(r) || jsonb_build_object('personal_rating',case when s.status='completed' then ps.rating else null end,'experience_precision',case when s.status='completed' then ps.experience_precision else null end,'experience_date',case when s.status='completed' then ps.experience_date else null end,'experience_year',case when s.status='completed' then ps.experience_year else null end) as data, s.canonical_target_id, s.id, s.status, s.updated_at,
      row_number() over(partition by s.canonical_target_id, s.status order by s.updated_at desc,s.id) as rn,
      jsonb_agg(s.id) over(partition by s.canonical_target_id,s.status) as source_ids
    from public.get_my_seeds_v2(p_status) r join public.seeds s on s.id=r.seed_id
    left join public.seed_personal_state_v15 ps on ps.seed_id=s.id and ps.user_id=s.user_id
    where s.user_id=auth.uid()
  ) select r.data || jsonb_build_object('canonical_target_id',t.id,'title',t.title,
      'subtitle',coalesce(t.creator_name,r.data->>'subtitle'),'canonical_source_seed_ids',r.source_ids)
    from records r join public.canonical_targets t on t.id=r.canonical_target_id
    where r.rn=1 order by r.updated_at desc,r.id;
$function$
;
CREATE OR REPLACE FUNCTION public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[])
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with requested as materialized (
    select input.id,public.resolve_uin_card_target_v129(input.id) resolved_id,input.position
    from unnest(coalesce(p_target_ids,array[]::uuid[])) with ordinality input(id,position)
  ), summaries as materialized (
    select value row
    from public.get_uin_card_summary_v143(coalesce(p_target_ids,array[]::uuid[])) value
  ), identities as materialized (
    select distinct requested.resolved_id,identity.target_id
    from requested
    cross join lateral public.get_uin_card_identity_aliases_v143(requested.resolved_id) identity
  )
  select jsonb_build_object(
    'canonical_target_id',target.id,
    'canonical_kind',target.kind,
    'created_at',target.created_at,
    'source_seed_id',null,
    'title',target.title,
    'subtitle',coalesce(summary.row->>'creator_name',target.creator_name,community.name),
    'seed_type_name',coalesce(seed_type.name,category.name),
    'seed_type_slug',coalesce(nullif(target.editorial_metadata->>'action_key',''),case when target.kind='live_match' then 'sport-live' else seed_type.slug end),
    'seed_type_icon',coalesce(nullif(target.editorial_metadata->>'display_icon',''),case when target.kind='live_match' then '🏟️' else coalesce(seed_type.icon,'🌱') end),
    'subject_type',nullif(target.editorial_metadata->>'subject_type',''),
    'item_kind',coalesce(catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'activity'),
    'content_type_id',coalesce(summary.row->>'type_id',catalogue.metadata->>'content_type_id',catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'activity'),
    'primary_category_id',coalesce(catalogue.primary_category_id,target.primary_category_id),
    'cover_url',coalesce(target.editorial_cover_url,catalogue.cover_url,activity.default_cover_url,category.default_cover_url),
    'catalog_cover_url',catalogue.cover_url,
    'own_seed_id',own_seed.id,
    'own_seed_status',own_seed.status,
    'own_common_intent_id',own_personal.id,
    'intent_people_count',coalesce((summary.row->>'wanting')::integer,0),
    'experience_people_count',coalesce((summary.row->>'done')::integer,0),
    'active_event_count',coalesce((summary.row->>'active')::integer,0),
    'social_intent_count',coalesce((summary.row->>'active')::integer,0),
    'completed_event_count',coalesce((summary.row->>'completed')::integer,0),
    'expired_event_count',coalesce((summary.row->>'expired')::integer,0),
    'cancelled_event_count',coalesce((summary.row->>'cancelled')::integer,0),
    'child_count',coalesce((summary.row->>'child_count')::integer,0),
    'activity_id',target.activity_id,
    'sport_name',sport.name,
    'community_name',community.name,
    'updated_at',coalesce(catalogue.updated_at,target.updated_at)
  )
  from requested
  join public.canonical_targets target on target.id=requested.id
  left join summaries summary on (summary.row->>'target_id')::uuid=requested.resolved_id
  left join public.activities activity on activity.id=target.activity_id
  left join public.activity_categories category on category.id=activity.category_id
  left join public.sports sport on sport.id=target.sport_id
  left join public.communities community on community.id=target.primary_community_id
  left join lateral (
    select item.*
    from public.seed_catalog_items item
    where item.canonical_target_id=target.id and item.status='active'
    order by item.updated_at desc,item.id
    limit 1
  ) catalogue on true
  left join public.seed_types seed_type on seed_type.id=catalogue.seed_type_id
  left join lateral (
    select seed.id,seed.status
    from identities identity
    join public.seeds seed on seed.canonical_target_id=identity.target_id
    where identity.resolved_id=requested.resolved_id
      and seed.user_id=auth.uid()
      and seed.status in('active','completed')
    order by case seed.status when 'active' then 0 else 1 end,seed.updated_at desc,seed.id
    limit 1
  ) own_seed on true
  left join lateral (
    select personal.id
    from identities identity
    join public.canonical_personal_intents_v38 personal on personal.target_id=identity.target_id
    where identity.resolved_id=requested.resolved_id
      and personal.user_id=auth.uid()
      and personal.status='active'
    order by personal.updated_at desc,personal.id
    limit 1
  ) own_personal on true
  where public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
  order by requested.position;
$function$
;
commit;
