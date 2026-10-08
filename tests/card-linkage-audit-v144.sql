begin;
set transaction read only;
set local statement_timeout='10min';
set local search_path=public,extensions;

with source_refs as materialized (
  select 'seed'::text source_kind,seed.id source_id,seed.status source_status,
    seed.canonical_target_id target_id,seed.catalog_item_id,target.kind target_kind
  from public.seeds seed
  left join public.canonical_targets target on target.id=seed.canonical_target_id
  where seed.status in('active','completed') and seed.canonical_target_id is not null

  union all

  select 'personal',personal.id,personal.status,personal.target_id,
    null::uuid,target.kind
  from public.canonical_personal_intents_v38 personal
  left join public.canonical_targets target on target.id=personal.target_id
  where personal.status in('active','completed') and personal.target_id is not null

  union all

  select 'event',intent.id,intent.status,intent.canonical_target_id,
    null::uuid,target.kind
  from public.intents intent
  left join public.canonical_targets target on target.id=intent.canonical_target_id
  where intent.canonical_target_id is not null
), coverage as materialized (
  select reference.*,
    public.resolve_uin_card_target_v129(reference.target_id) resolved_id,
    exists(
      select 1 from public.seed_catalog_items item
      where item.canonical_target_id=reference.target_id and item.status='active'
    ) direct_active,
    exists(
      select 1 from public.seed_catalog_items item
      where item.canonical_target_id=public.resolve_uin_card_target_v129(reference.target_id)
        and item.status='active'
    ) resolved_active,
    exists(
      select 1
      from public.get_uin_card_identity_aliases_v143(reference.target_id) identity
      join public.seed_catalog_items item
        on item.canonical_target_id=identity.target_id and item.status='active'
    ) alias_active,
    reference.source_kind='seed'
      and reference.catalog_item_id is null
      and reference.target_kind='personal' legacy_private_personal
  from source_refs reference
), counts as (
  select source_kind,count(*) total,
    count(*) filter(where not direct_active) direct_missing,
    count(*) filter(where not direct_active and resolved_active) covered_by_resolved,
    count(*) filter(where not direct_active and not resolved_active and alias_active) covered_by_other_alias,
    count(*) filter(where not alias_active) without_public_card,
    count(*) filter(where legacy_private_personal) legacy_private_personal,
    count(*) filter(where not alias_active and not legacy_private_personal) contract_missing
  from coverage
  group by source_kind
), examples as (
  select coverage.source_kind,coverage.source_id,coverage.source_status,
    coverage.target_id,coverage.resolved_id,target.title,
    coverage.catalog_item_id,coverage.target_kind,
    coverage.direct_active,coverage.resolved_active,coverage.alias_active,
    coverage.legacy_private_personal,
    (not coverage.alias_active and not coverage.legacy_private_personal) contract_missing
  from coverage
  left join public.canonical_targets target on target.id=coverage.target_id
  where not coverage.direct_active
  order by coverage.source_kind,coverage.alias_active,coverage.target_id,coverage.source_id
  limit 50
)
select jsonb_pretty(jsonb_build_object(
  'counts',coalesce((select jsonb_agg(to_jsonb(counts) order by source_kind) from counts),'[]'::jsonb),
  'examples',coalesce((select jsonb_agg(to_jsonb(examples) order by source_kind,target_id,source_id) from examples),'[]'::jsonb)
));

rollback;
