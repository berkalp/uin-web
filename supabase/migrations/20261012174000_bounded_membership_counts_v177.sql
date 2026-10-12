begin;
create index if not exists canonical_targets_hidden_ids_v177 on public.canonical_targets(id)
where coalesce(editorial_metadata->>'admin_hidden','false')='true';
create or replace function public.get_uin_category_counts_v129() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 with viewer as materialized(select public.is_admin() is_admin), eligible as materialized (
 select distinct ci.canonical_target_id from public.seed_catalog_items ci cross join viewer
 where ci.status='active' and ci.canonical_target_id is not null and coalesce(ci.metadata->>'global_place_catalogue','false')<>'true'
 and (viewer.is_admin or not exists(select 1 from public.canonical_targets c where c.id=ci.canonical_target_id and coalesce(c.editorial_metadata->>'admin_hidden','false')='true' offset 0))
 ), counts as materialized (
 select m.content_type_id,count(*) n from eligible e
 cross join lateral(select membership.content_type_id from public.uin_card_content_types_v177 membership where membership.target_id=e.canonical_target_id offset 0) m
 group by m.content_type_id
 ), places as materialized(select coalesce((public.get_global_place_counts_v122()->>'cities')::bigint,0) n),
 total as materialized(select count(*) n from eligible e where not exists(
 select 1 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.base_kind='place' where m.target_id=e.canonical_target_id offset 0))
 select coalesce(jsonb_object_agg(t.id,case when t.base_kind='place' then places.n else coalesce(counts.n,0) end),'{}'::jsonb)
 ||jsonb_build_object('_total',total.n+places.n)
 from public.uin_content_types t cross join places cross join total left join counts on counts.content_type_id=t.id where t.active group by places.n,total.n;
$fn$;
analyze public.canonical_targets;
notify pgrst,'reload schema';
commit;
