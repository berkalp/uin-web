begin;
create or replace function public.get_club_directory_v176() returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 with hierarchy as materialized(select * from public.get_club_hierarchy_v78()),
 styles as materialized(select * from public.get_uin_card_styles_v76(array(select target_id from hierarchy)))
 select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('displayName',h.display_name,'title',t.title,'catalogItemId',c.id,'coverUrl',coalesce(nullif(t.editorial_cover_url,''),h.logo_url),'logoUrl',h.logo_url,'leagues',coalesce(t.editorial_metadata->'club_competitions',jsonb_build_array(h.league)),'cardStyle',s.card_style,'ownStyle',s.own_style) order by h.target_id),'[]'::jsonb)
 from hierarchy h join public.canonical_targets t on t.id=h.target_id
 join lateral(select id from public.seed_catalog_items where canonical_target_id=h.target_id and status='active' order by updated_at desc,id limit 1)c on true
 left join styles s on s.target_id=h.target_id;
$fn$;
revoke all on function public.get_club_directory_v176() from public;
grant execute on function public.get_club_directory_v176() to anon,authenticated;
notify pgrst,'reload schema';
commit;
