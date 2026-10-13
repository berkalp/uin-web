-- Keep the v176 contract. Resolve inherited styles in the bounded directory
-- rather than invoking a second per-target viewer projection for every team.
create or replace function public.get_club_directory_v181() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 with hierarchy as materialized(select * from public.get_club_hierarchy_v78())
 select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object(
  'displayName',h.display_name,'title',t.title,'catalogItemId',c.id,
  'coverUrl',coalesce(nullif(t.editorial_cover_url,''),h.logo_url),'logoUrl',h.logo_url,
  'leagues',coalesce(t.editorial_metadata->'club_competitions',jsonb_build_array(h.league)),
  'cardStyle',coalesce(nullif(t.editorial_metadata->'card_style','null'::jsonb),parent.editorial_metadata->'card_style'),
  'ownStyle',nullif(t.editorial_metadata->'card_style','null'::jsonb)
 ) order by h.target_id),'[]'::jsonb)
 from hierarchy h
 cross join lateral(select title,editorial_cover_url,editorial_metadata from public.canonical_targets where id=h.target_id offset 0)t
 join lateral(select id from public.seed_catalog_items where canonical_target_id=h.target_id and status='active' order by updated_at desc,id limit 1)c on true
 left join public.canonical_targets parent on parent.id=h.parent_target_id and coalesce(parent.editorial_metadata->>'admin_hidden','false')<>'true';
$fn$;
revoke all on function public.get_club_directory_v181() from public;
grant execute on function public.get_club_directory_v181() to anon,authenticated;
notify pgrst,'reload schema';
