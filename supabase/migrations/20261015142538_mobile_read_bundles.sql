-- Reduce mobile round trips without changing the authoritative visibility queries.
create or replace function public.get_mobile_profile_snapshot(p_username text)
returns jsonb language plpgsql stable security invoker
set search_path = public, pg_temp set jit = off
as $$
declare page jsonb; profile_id uuid; resolved_username text; seeds jsonb; artists jsonb;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
  page := public.get_public_profile_page_with_participation_visibility(p_username);
  profile_id := (page #>> '{profile,id}')::uuid;
  resolved_username := page #>> '{profile,username}';
  if profile_id is null or resolved_username is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into seeds
    from public.get_visible_profile_seed_life_v170(profile_id) s;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into artists
    from public.get_public_profile_live_artists_v2914(profile_id) a;
  return jsonb_build_object('page',page,'seeds',seeds,'live_artists',artists,
    'presence',public.get_public_profile_presence(profile_id),
    'reputation',public.get_public_reputation_summary(profile_id),
    'family',public.get_public_profile_family(profile_id),
    'badges',public.get_public_profile_badges(profile_id),
    'professional',public.get_public_profile_professional_status(resolved_username));
end $$;
revoke all on function public.get_mobile_profile_snapshot(text) from public, anon;
grant execute on function public.get_mobile_profile_snapshot(text) to authenticated;

create or replace function public.get_my_mobile_library_snapshot()
returns jsonb language plpgsql stable security invoker
set search_path = public, pg_temp set jit = off
as $$
declare personal jsonb; types jsonb;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
  personal := public.get_my_mobile_personal_scope_snapshot();
  select coalesce(jsonb_agg(to_jsonb(t) order by t.position,t.label),'[]'::jsonb) into types
  from (select id,label,icon,base_kind,position,ui_labels from public.uin_content_types where active) t;
  return personal || jsonb_build_object('catalogue',jsonb_build_object(
    'types',types,'counts',public.get_uin_category_counts_v129()));
end $$;
revoke all on function public.get_my_mobile_library_snapshot() from public, anon;
grant execute on function public.get_my_mobile_library_snapshot() to authenticated;
