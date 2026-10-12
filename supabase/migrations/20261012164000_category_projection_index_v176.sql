begin;
create index if not exists seed_catalog_items_type_projection_v176_idx
on public.seed_catalog_items ((metadata->>'content_type_id'),updated_at desc,id desc)
where status='active' and canonical_target_id is not null;
analyze public.seed_catalog_items;
commit;
