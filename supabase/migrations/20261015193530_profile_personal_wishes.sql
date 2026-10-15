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
)
select to_jsonb(s)||jsonb_build_object('source_kind','seed') from legacy s
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
);
$$;
revoke all on function uin_private.profile_library_v189(uuid) from public,anon,authenticated;

-- The definer wrapper exposes only the viewer-checked projection above.
create or replace function public.get_visible_profile_library_v189(p_profile_user_id uuid)
returns setof jsonb language sql stable security definer
set search_path=public,pg_temp as $$
 select * from uin_private.profile_library_v189(p_profile_user_id);
$$;
revoke all on function public.get_visible_profile_library_v189(uuid) from public;
grant execute on function public.get_visible_profile_library_v189(uuid) to anon,authenticated,service_role;

-- Reduce mobile round trips without changing the authoritative visibility queries.
create or replace function public.get_mobile_profile_snapshot_v189(p_username text)
returns jsonb language plpgsql volatile security invoker
set search_path = public, pg_temp set jit = off
as $$
declare page jsonb; profile_id uuid; resolved_username text; seeds jsonb; artists jsonb;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
  page := public.get_public_profile_page_with_participation_visibility(p_username);
  profile_id := (page #>> '{profile,id}')::uuid;
  resolved_username := page #>> '{profile,username}';
  if profile_id is null or resolved_username is null then return null; end if;
  select coalesce(jsonb_agg(s), '[]'::jsonb) into seeds
    from public.get_visible_profile_library_v189(profile_id) s;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into artists
    from public.get_public_profile_live_artists_v2914(profile_id) a;
  return jsonb_build_object('page',page,'seeds',seeds,'live_artists',artists,
    'presence',public.get_public_profile_presence(profile_id),
    'reputation',public.get_public_reputation_summary(profile_id),
    'family',public.get_public_profile_family(profile_id),
    'badges',public.get_public_profile_badges(profile_id),
    'professional',public.get_public_profile_professional_status(resolved_username));
end $$;
revoke all on function public.get_mobile_profile_snapshot_v189(text) from public, anon;
grant execute on function public.get_mobile_profile_snapshot_v189(text) to authenticated;


notify pgrst, 'reload schema';
