begin;
-- Preserve visible legacy branches that existed outside the root editor's list.
with missing as (
 select parent.id parent_id,jsonb_agg(coalesce(child.editorial_metadata->'club_profile'->'teams'->0,
  jsonb_build_object('id',child.editorial_metadata->'club_hierarchy'->>'profile_team_id','name',child.editorial_metadata->'club_hierarchy'->>'display_name','sport',child.editorial_metadata->'club_hierarchy'->>'sport','division',child.editorial_metadata->'club_hierarchy'->>'division','league',child.editorial_metadata->'club_hierarchy'->>'league','season',child.editorial_metadata->'club_hierarchy'->>'season'))) teams
 from public.canonical_targets child
 join public.canonical_targets parent on parent.id=nullif(child.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
 where child.editorial_metadata->>'content_type_id'='club' and coalesce(child.editorial_metadata->>'admin_hidden','false')<>'true'
  and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=child.id and ci.status='active')
  and not exists(select 1 from jsonb_array_elements(coalesce(parent.editorial_metadata->'club_profile'->'teams','[]'::jsonb)) team where team->>'id'=child.editorial_metadata->'club_hierarchy'->>'profile_team_id')
 group by parent.id
)
update public.canonical_targets parent set editorial_metadata=jsonb_set(parent.editorial_metadata,'{club_profile,teams}',coalesce(parent.editorial_metadata->'club_profile'->'teams','[]'::jsonb)||missing.teams) from missing where parent.id=missing.parent_id;
commit;
