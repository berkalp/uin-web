-- Read-only regression: validate all owners of legacy aliases, retaining experiences.
begin;

do $check$
declare actor record; duplicates integer; missing integer;
begin
 for actor in select distinct s.user_id from public.seeds s where s.canonical_target_id<>public.resolve_uin_card_target_v129(s.canonical_target_id)
 loop
  perform set_config('request.jwt.claim.sub',actor.user_id::text,true);
  select count(*) into duplicates from (
   select s->>'canonical_target_id' from public.get_visible_profile_library_v189(actor.user_id) s
   where s->>'status'='active' and s->>'seed_scope'='library'
   group by s->>'canonical_target_id' having count(*)>1
  ) d;
  if duplicates<>0 then raise exception 'Duplicate active profile cards'; end if;
  select count(*) into missing from public.get_visible_profile_seed_life_v170(actor.user_id) old
  where old.status='completed' and not exists(
   select 1 from public.get_visible_profile_library_v189(actor.user_id) s where s->>'seed_id'=old.seed_id::text and s->>'status'='completed'
  );
  if missing<>0 then raise exception 'An existing experience disappeared'; end if;
 end loop;
end $check$;
select count(*) as retained_alias_seed_records from public.seeds s where s.canonical_target_id<>public.resolve_uin_card_target_v129(s.canonical_target_id);

rollback;
