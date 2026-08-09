-- UIN user discovery controls smoke test
-- Safe to run in Supabase SQL Editor. All test data changes are rolled back.

begin;

do $test$
declare
  v_first uuid;
  v_second uuid;
begin
  if to_regclass('public.user_discovery_controls') is null then
    raise exception 'user_discovery_controls table is missing.';
  end if;

  if to_regprocedure('public.can_users_discover_each_other(uuid,uuid)') is null then
    raise exception 'can_users_discover_each_other(uuid,uuid) is missing.';
  end if;

  select profile.id
  into v_first
  from public.profiles profile
  order by profile.created_at, profile.id
  limit 1;

  select profile.id
  into v_second
  from public.profiles profile
  where profile.id <> v_first
  order by profile.created_at, profile.id
  limit 1;

  if v_first is null or v_second is null then
    raise notice 'Need at least two profiles for behavioural assertions. Schema checks passed.';
    return;
  end if;

  delete from public.user_discovery_controls
  where (actor_user_id = v_first and target_user_id = v_second)
     or (actor_user_id = v_second and target_user_id = v_first);

  insert into public.user_discovery_controls (
    actor_user_id,
    target_user_id,
    control_type
  ) values (
    v_first,
    v_second,
    'ignore'
  );

  if public.can_users_discover_each_other(v_first, v_second) then
    raise exception 'Ignore failed: actor can still discover target.';
  end if;

  if not public.can_users_discover_each_other(v_second, v_first) then
    raise exception 'Ignore failed: target should still be able to discover actor.';
  end if;

  update public.user_discovery_controls
  set control_type = 'block'
  where actor_user_id = v_first
    and target_user_id = v_second;

  if public.can_users_discover_each_other(v_first, v_second) then
    raise exception 'Block failed in actor -> target direction.';
  end if;

  if public.can_users_discover_each_other(v_second, v_first) then
    raise exception 'Block failed in target -> actor direction.';
  end if;

  raise notice 'UIN user discovery control behavioural checks passed.';
end;
$test$;

rollback;
