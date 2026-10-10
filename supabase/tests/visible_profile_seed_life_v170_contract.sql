-- Run after 20261010210000_visible_profile_seed_life_v170.sql.
-- Read-only contract checks; no fixture data is created or retained.

begin;

do $contract$
declare
  v_proc regprocedure := to_regprocedure(
    'public.get_visible_profile_seed_life_v170(uuid)'
  );
  v_legacy_proc regprocedure := to_regprocedure(
    'public.get_visible_profile_seed_life_v24(uuid)'
  );
  v_output_names text[];
  v_expected_names constant text[] := array[
    'seed_id',
    'catalog_item_id',
    'canonical_target_id',
    'seed_type_icon',
    'seed_type_name',
    'seed_type_slug',
    'title',
    'subtitle',
    'cover_url',
    'visibility',
    'seed_scope',
    'status',
    'target_date',
    'key_takeaway',
    'created_at',
    'updated_at',
    'relationship_status',
    'experience_precision',
    'experience_date',
    'experience_year',
    'personal_cover_url',
    'rating',
    'notes',
    'creator_name',
    'release_year',
    'catalog_cover_url',
    'catalog_item_kind'
  ];
  v_definition text;
  v_legacy_definition text;
  v_profile_user_id uuid;
  v_owner_profile_user_id uuid;
  v_managed_minor_user_id uuid;
  v_nonowner_user_id uuid;
  v_expected_count bigint;
  v_actual_count bigint;
begin
  if v_proc is null then
    raise exception 'get_visible_profile_seed_life_v170(uuid) is missing.';
  end if;

  if v_legacy_proc is null then
    raise exception 'get_visible_profile_seed_life_v24(uuid) is missing.';
  end if;

  select array_agg(argument.name order by argument.ordinality)
  into v_output_names
  from pg_proc procedure_record
  cross join lateral unnest(
    procedure_record.proargnames,
    procedure_record.proargmodes
  ) with ordinality as argument(name, mode, ordinality)
  where procedure_record.oid = v_proc
    and argument.mode in ('o', 't');

  if v_output_names is distinct from v_expected_names then
    raise exception
      'Unexpected v170 output contract. Expected %, got %.',
      v_expected_names,
      v_output_names;
  end if;

  select pg_get_functiondef(v_proc)
  into v_definition;

  select pg_get_functiondef(v_legacy_proc)
  into v_legacy_definition;

  if not exists (
    select 1
    from pg_proc procedure_record
    cross join lateral unnest(procedure_record.proconfig) setting(value)
    where procedure_record.oid = v_proc
      and procedure_record.prosecdef
      and setting.value like 'search_path=%public%pg_temp%'
  ) then
    raise exception 'v170 must be SECURITY DEFINER with a fixed public, pg_temp search_path.';
  end if;

  if position('SECURITY DEFINER' in upper(v_definition)) = 0
     or position('seed_is_visible_to_viewer' in v_definition) = 0
     or position('seed.seed_scope = ''library''' in v_definition) = 0
     or position('''private''' in v_definition) = 0
     or position('seed.user_id = auth.uid()' in v_definition) = 0
     or position('p_profile_user_id = auth.uid()' in v_definition) = 0
     or position(
       'not public.is_managed_minor_user(p_profile_user_id)'
       in v_definition
     ) = 0
     or position('seed.status in (''active'', ''completed'')' in v_definition) = 0 then
    raise exception 'v170 is missing a required fail-closed profile boundary.';
  end if;

  if position('SECURITY DEFINER' in upper(v_legacy_definition)) = 0
     or position('get_visible_profile_seed_life_v170' in v_legacy_definition) = 0 then
    raise exception 'Legacy v24 must delegate to the secured v170 boundary.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_visible_profile_seed_life_v170(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_visible_profile_seed_life_v170(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.get_visible_profile_seed_life_v170(uuid)',
    'EXECUTE'
  ) then
    raise exception 'v170 API-role execute grants are incomplete.';
  end if;

  if exists (
    select 1
    from pg_proc procedure_record
    cross join lateral aclexplode(procedure_record.proacl) privilege
    where procedure_record.oid = v_proc
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'v170 must not grant EXECUTE to PUBLIC.';
  end if;

  -- Exercise the anonymous contract against the largest current profile. The
  -- exact-count assertion catches both hidden caps and SECURITY DEFINER leaks.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  select seed.user_id
  into v_profile_user_id
  from public.seeds seed
  join public.seed_catalog_items catalog_item
    on catalog_item.id = seed.catalog_item_id
   and catalog_item.status = 'active'
  where seed.seed_scope = 'library'
    and seed.status in ('active', 'completed')
    and not public.is_managed_minor_user(seed.user_id)
    and public.seed_is_visible_to_viewer(
      seed.user_id,
      seed.visibility,
      auth.uid()
    )
  group by seed.user_id
  order by count(*) desc, seed.user_id
  limit 1;

  if v_profile_user_id is not null then
    select count(*)
    into v_expected_count
    from public.seeds seed
    join public.seed_catalog_items catalog_item
      on catalog_item.id = seed.catalog_item_id
     and catalog_item.status = 'active'
    where seed.user_id = v_profile_user_id
      and seed.seed_scope = 'library'
      and seed.status in ('active', 'completed')
      and not public.is_managed_minor_user(seed.user_id)
      and public.seed_is_visible_to_viewer(
        seed.user_id,
        seed.visibility,
        auth.uid()
      );

    select count(*)
    into v_actual_count
    from public.get_visible_profile_seed_life_v170(v_profile_user_id);

    if v_actual_count <> v_expected_count then
      raise exception
        'Anonymous v170 completeness/visibility mismatch for profile %: expected %, got %.',
        v_profile_user_id,
        v_expected_count,
        v_actual_count;
    end if;

    if exists (
      select seed_id
      from public.get_visible_profile_seed_life_v170(v_profile_user_id)
      except
      select seed_id
      from public.get_visible_profile_seed_life_v24(v_profile_user_id)
    ) or exists (
      select seed_id
      from public.get_visible_profile_seed_life_v24(v_profile_user_id)
      except
      select seed_id
      from public.get_visible_profile_seed_life_v170(v_profile_user_id)
    ) then
      raise exception 'Legacy v24 and secured v170 expose different anonymous Seed IDs.';
    end if;

    if exists (
      select 1
      from public.get_visible_profile_seed_life_v170(v_profile_user_id) visible
      join public.seeds seed on seed.id = visible.seed_id
      left join public.seed_catalog_items catalog_item
        on catalog_item.id = seed.catalog_item_id
      where seed.user_id <> v_profile_user_id
         or seed.seed_scope <> 'library'
         or seed.status not in ('active', 'completed')
         or catalog_item.status is distinct from 'active'
         or not public.seed_is_visible_to_viewer(
           seed.user_id,
           seed.visibility,
           auth.uid()
         )
         or visible.visibility is distinct from seed.visibility
         or visible.seed_scope is distinct from seed.seed_scope
         or visible.catalog_item_id is distinct from catalog_item.id
         or visible.canonical_target_id is distinct from
            coalesce(seed.canonical_target_id, catalog_item.canonical_target_id)
         or (visible.status = 'completed') is distinct from
            (visible.relationship_status = 'completed')
    ) then
      raise exception 'Anonymous v170 returned a row outside the v2 visibility boundary.';
    end if;
  end if;

  -- The public profile page has a managed-minor presentation boundary, but an
  -- RPC caller can supply the profile UUID directly. Exercise that direct path
  -- with an existing managed profile: anonymous and authenticated non-owners
  -- must get no rows, while the owner retains their complete lifecycle.
  select profile.id
  into v_managed_minor_user_id
  from public.profiles profile
  where public.is_managed_minor_user(profile.id)
  order by (
    select count(*)
    from public.seeds seed
    where seed.user_id = profile.id
      and seed.status in ('active', 'completed')
      and seed.seed_scope in ('library', 'private')
  ) desc,
  profile.id
  limit 1;

  if v_managed_minor_user_id is not null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);

    select count(*)
    into v_actual_count
    from public.get_visible_profile_seed_life_v170(v_managed_minor_user_id);

    if v_actual_count <> 0 then
      raise exception
        'Anonymous direct UUID access exposed % managed-minor Seed rows for profile %.',
        v_actual_count,
        v_managed_minor_user_id;
    end if;

    v_nonowner_user_id := case
      when v_managed_minor_user_id <>
        '00000000-0000-0000-0000-000000000001'::uuid
        then '00000000-0000-0000-0000-000000000001'::uuid
      else '00000000-0000-0000-0000-000000000002'::uuid
    end;

    perform set_config(
      'request.jwt.claim.sub',
      v_nonowner_user_id::text,
      true
    );
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'role', 'authenticated',
        'sub', v_nonowner_user_id
      )::text,
      true
    );

    select count(*)
    into v_actual_count
    from public.get_visible_profile_seed_life_v170(v_managed_minor_user_id);

    if v_actual_count <> 0 then
      raise exception
        'Authenticated non-owner direct UUID access exposed % managed-minor Seed rows for profile %.',
        v_actual_count,
        v_managed_minor_user_id;
    end if;

    perform set_config(
      'request.jwt.claim.sub',
      v_managed_minor_user_id::text,
      true
    );
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'role', 'authenticated',
        'sub', v_managed_minor_user_id
      )::text,
      true
    );

    select count(*)
    into v_expected_count
    from public.seeds seed
    where seed.user_id = v_managed_minor_user_id
      and seed.status in ('active', 'completed')
      and seed.seed_scope in ('library', 'private')
      and public.seed_is_visible_to_viewer(
        seed.user_id,
        seed.visibility,
        auth.uid()
      );

    select count(*)
    into v_actual_count
    from public.get_visible_profile_seed_life_v170(v_managed_minor_user_id);

    if v_actual_count <> v_expected_count then
      raise exception
        'Managed-minor owner completeness mismatch for profile %: expected %, got %.',
        v_managed_minor_user_id,
        v_expected_count,
        v_actual_count;
    end if;
  end if;

  -- An owner sees every non-archived lifecycle row in both scopes regardless
  -- of catalogue moderation state. This read-only check uses an existing owner
  -- so the contract test creates no user fixture.
  select seed.user_id
  into v_owner_profile_user_id
  from public.seeds seed
  where seed.seed_scope = 'private'
    and seed.status in ('active', 'completed')
  group by seed.user_id
  order by count(*) desc, seed.user_id
  limit 1;

  if v_owner_profile_user_id is not null then
    perform set_config(
      'request.jwt.claim.sub',
      v_owner_profile_user_id::text,
      true
    );
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'role', 'authenticated',
        'sub', v_owner_profile_user_id
      )::text,
      true
    );

    select count(*)
    into v_expected_count
    from public.seeds seed
    where seed.user_id = v_owner_profile_user_id
      and seed.status in ('active', 'completed')
      and seed.seed_scope in ('library', 'private')
      and public.seed_is_visible_to_viewer(
        seed.user_id,
        seed.visibility,
        auth.uid()
      );

    select count(*)
    into v_actual_count
    from public.get_visible_profile_seed_life_v170(v_owner_profile_user_id);

    if v_actual_count <> v_expected_count then
      raise exception
        'Owner v170 completeness mismatch for profile %: expected %, got %.',
        v_owner_profile_user_id,
        v_expected_count,
        v_actual_count;
    end if;

    select count(*)
    into v_actual_count
    from public.get_visible_profile_seed_life_v24(v_owner_profile_user_id);

    if v_actual_count <> v_expected_count then
      raise exception
        'Legacy v24 owner completeness mismatch for profile %: expected %, got %.',
        v_owner_profile_user_id,
        v_expected_count,
        v_actual_count;
    end if;

    if not exists (
      select 1
      from public.get_visible_profile_seed_life_v170(v_owner_profile_user_id)
      where seed_scope = 'private'
    ) then
      raise exception 'Owner v170 omitted existing private-scope lifecycle rows.';
    end if;

    if exists (
      select 1
      from public.get_visible_profile_seed_life_v170(v_owner_profile_user_id) visible
      join public.seeds seed on seed.id = visible.seed_id
      left join public.seed_catalog_items catalog_item
        on catalog_item.id = seed.catalog_item_id
      where seed.user_id <> v_owner_profile_user_id
         or seed.status not in ('active', 'completed')
         or seed.seed_scope not in ('library', 'private')
         or not public.seed_is_visible_to_viewer(
           seed.user_id,
           seed.visibility,
           auth.uid()
         )
         or visible.visibility is distinct from seed.visibility
         or visible.seed_scope is distinct from seed.seed_scope
         or visible.catalog_item_id is distinct from catalog_item.id
         or visible.canonical_target_id is distinct from
            coalesce(seed.canonical_target_id, catalog_item.canonical_target_id)
         or (visible.status = 'completed') is distinct from
            (visible.relationship_status = 'completed')
         or (
           visible.status = 'active'
           and (
             visible.rating is not null
             or visible.experience_precision is not null
             or visible.experience_date is not null
             or visible.experience_year is not null
           )
         )
    ) then
      raise exception 'Owner v170 returned a row outside its lifecycle contract.';
    end if;
  end if;
end;
$contract$;

rollback;
