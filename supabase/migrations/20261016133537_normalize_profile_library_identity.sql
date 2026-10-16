-- Resolve aliases before grouping active profile wishes. Preserve source records,
-- individual experiences and all existing viewer visibility checks.
-- Include visible target-backed wishes as well as legacy Seeds, without rewriting history.
create or replace function uin_private.profile_library_v189(p_profile_user_id uuid)
returns setof jsonb language sql stable security definer
set search_path=public,pg_temp set jit=off as $$
with legacy as materialized (
 select * from public.get_visible_profile_seed_life_v170(p_profile_user_id)
), wishes as materialized (
 select p.*,public.resolve_uin_card_target_v129(p.target_id) resolved_target_id
 from public.canonical_personal_intents_v38 p
 where p.user_id=p_profile_user_id and p.status='active'
 and (p_profile_user_id=auth.uid() or not public.is_managed_minor_user(p_profile_user_id))
 and public.personal_common_intent_visible_v38(p.user_id,p.visibility,auth.uid())
), source_rows as (
select to_jsonb(s)||jsonb_build_object('source_kind','seed') row from legacy s
union all
select jsonb_build_object(
 'source_kind','personal','source_target_id',p.target_id,
 'seed_id',p.id,'catalog_item_id',c.id,'canonical_target_id',t.id,
 'seed_type_icon',coalesce(ct.icon,'✨'),'seed_type_name',coalesce(ct.label,'Aktivite'),
 'seed_type_slug',coalesce(ct.id,c.item_kind),'title',t.title,'subtitle',c.creator_name,
 'cover_url',coalesce(t.editorial_cover_url,c.cover_url),'visibility',p.visibility,
 'seed_scope','library','status','active','target_date',coalesce(p.start_date,p.end_date),
 'key_takeaway',null,'created_at',p.created_at,'updated_at',p.updated_at,
 'relationship_status','want','experience_precision',null,'experience_date',null,
 'experience_year',null,'personal_cover_url',null,'rating',null,'notes',p.notes,
 'creator_name',c.creator_name,'release_year',c.release_year,
 'catalog_cover_url',coalesce(t.editorial_cover_url,c.cover_url),'catalog_item_kind',c.item_kind)
from wishes p
join public.canonical_targets t on t.id=p.resolved_target_id
join lateral (
 select item.* from public.seed_catalog_items item
 where item.canonical_target_id=t.id and item.status='active'
 order by item.created_at,item.id limit 1
) c on true
left join public.uin_content_types ct on ct.id=coalesce(p.content_type_id,c.metadata->>'content_type_id',c.item_kind) and ct.active
where not exists (
 select 1 from legacy s where s.status='active'
 and public.resolve_uin_card_target_v129(s.canonical_target_id)=t.id
)
), identities as materialized (
 select row,public.resolve_uin_card_target_v129((row->>'canonical_target_id')::uuid) target_id
 from source_rows
), normalized as (
 select i.row || case when t.id is null or i.row->>'seed_scope'<>'library' or t.id::text=i.row->>'canonical_target_id' then '{}'::jsonb else jsonb_build_object(
  'canonical_target_id',t.id,
  'source_target_id',coalesce(i.row->>'source_target_id',i.row->>'canonical_target_id'),
  'catalog_item_id',coalesce(c.id::text,i.row->>'catalog_item_id'),
  'title',t.title,
  'catalog_cover_url',coalesce(t.editorial_cover_url,c.cover_url,i.row->>'catalog_cover_url'),
  'cover_url',coalesce(i.row->>'personal_cover_url',t.editorial_cover_url,c.cover_url,i.row->>'cover_url')
 ) end row
 from identities i left join public.canonical_targets t on t.id=i.target_id
 left join lateral (
  select item.id,item.cover_url from public.seed_catalog_items item
  where item.canonical_target_id=t.id and item.status='active'
  order by item.created_at,item.id limit 1
 ) c on true
), ranked as (
 select row,row_number() over (
  partition by case when row->>'status'='active' and row->>'seed_scope'='library'
   then 'active:'||coalesce(row->>'canonical_target_id',row->>'catalog_item_id',row->>'seed_id')
   else 'record:'||(row->>'seed_id') end
  order by (row->>'updated_at')::timestamptz desc nulls last,row->>'seed_id' desc
 ) rank
 from normalized
)
select row from ranked where rank=1;
$$;
revoke all on function uin_private.profile_library_v189(uuid) from public,anon,authenticated;

