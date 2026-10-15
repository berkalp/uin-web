-- Read-only regression contract. Existing rows are never changed.
begin;
do $test$
declare owner_id uuid; viewer_id uuid; actual jsonb; expected_count integer; actual_count integer;
begin
 select p.user_id into owner_id from public.canonical_personal_intents_v38 p
 where p.status='active' and p.visibility='friends' order by p.updated_at desc limit 1;
 if owner_id is null then raise exception 'A friends-visible personal wish is required for this regression'; end if;
 for viewer_id in select id from public.profiles where id=owner_id or public.users_are_accepted_friends(id,owner_id)
 loop
  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  select coalesce(jsonb_agg(s),'[]'::jsonb) into actual from public.get_visible_profile_library_v189(owner_id) s;
  -- Every formerly visible Seed retains all its fields and lifecycle.
  if exists(select 1 from public.get_visible_profile_seed_life_v170(owner_id) old
    where not exists(select 1 from jsonb_array_elements(actual) r where r @> to_jsonb(old))) then
   raise exception 'Existing profile history was lost'; end if;
  -- Every currently visible personal wish with an active catalogue card is represented.
  if exists(select 1 from public.canonical_personal_intents_v38 p
    where p.user_id=owner_id and p.status='active'
    and public.personal_common_intent_visible_v38(p.user_id,p.visibility,viewer_id)
    and exists(select 1 from public.seed_catalog_items c where c.canonical_target_id=public.resolve_uin_card_target_v129(p.target_id) and c.status='active')
    and not exists(select 1 from jsonb_array_elements(actual) r where r->>'status'='active'
      and public.resolve_uin_card_target_v129((r->>'canonical_target_id')::uuid)=public.resolve_uin_card_target_v129(p.target_id))) then
   raise exception 'Visible personal wish is absent from profile'; end if;
  if exists(select 1 from jsonb_array_elements(actual) r join public.canonical_personal_intents_v38 p on p.id=(r->>'seed_id')::uuid
    where r->>'source_kind'='personal' and (p.user_id<>owner_id or p.status<>'active'
    or not public.personal_common_intent_visible_v38(p.user_id,p.visibility,viewer_id))) then
   raise exception 'Profile exposed an unauthorized personal wish'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.get_visible_profile_library_v189(owner_id) r where r->>'visibility'<>'everyone') then
  raise exception 'Anonymous viewer received a non-public wish'; end if;
 select id into viewer_id from public.profiles where id<>owner_id and not public.users_are_accepted_friends(id,owner_id) limit 1;
 if viewer_id is not null then
  perform set_config('request.jwt.claim.sub',viewer_id::text,true);
  if exists(select 1 from public.get_visible_profile_library_v189(owner_id) r where r->>'visibility'<>'everyone') then
   raise exception 'Unrelated viewer received a non-public wish'; end if;
 end if;
 if has_function_privilege('anon','uin_private.profile_library_v189(uuid)','EXECUTE')
   or has_function_privilege('authenticated','uin_private.profile_library_v189(uuid)','EXECUTE') then
  raise exception 'Internal helper is directly callable'; end if;
end $test$;
select 'profile wishes, history and visibility verified' as result;
rollback;
