begin;

-- UIN lifecycle refinement:
-- A confirmed Activity may end earlier than the originally scheduled end time.
-- Once the confirmed start time has passed, an authorized Host / Co-host may
-- record attendance and complete the Activity. The original confirmed schedule
-- is preserved; completed_at remains the actual recorded completion time.
--
-- We deliberately patch only the temporal gate in the existing RPCs so every
-- other authorization, attendance, Intent-link and reputation side effect of
-- the production functions remains unchanged.

do $migration$
declare
  v_function_name text;
  v_oid oid;
  v_definition text;
  v_patched text;
  v_before text;
  v_after text;
begin
  foreach v_function_name in array array[
    'complete_shared_plan',
    'mark_shared_plan_not_happened_v2'
  ]
  loop
    select procedure.oid
    into v_oid
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
    order by procedure.oid desc
    limit 1;

    if v_oid is null then
      raise exception 'Required lifecycle function public.% was not found.', v_function_name;
    end if;

    v_definition := pg_get_functiondef(v_oid);
    v_patched := v_definition;

    -- Common PL/pgSQL forms used by UIN lifecycle guards.
    v_before := v_patched;
    v_patched := regexp_replace(
      v_patched,
      $re$([A-Za-z_][A-Za-z0-9_]*)\.scheduled_end([[:space:]]*)>([[:space:]]*)now\(\)$re$,
      $rp$\1.scheduled_start\2>\3now()$rp$,
      'gi'
    );

    v_patched := regexp_replace(
      v_patched,
      $re$now\(\)([[:space:]]*)<([[:space:]]*)([A-Za-z_][A-Za-z0-9_]*)\.scheduled_end$re$,
      $rp$now()\1<\2\3.scheduled_start$rp$,
      'gi'
    );

    v_patched := regexp_replace(
      v_patched,
      $re$([A-Za-z_][A-Za-z0-9_]*)\.scheduled_end([[:space:]]*)>([[:space:]]*)current_timestamp$re$,
      $rp$\1.scheduled_start\2>\3current_timestamp$rp$,
      'gi'
    );

    v_patched := regexp_replace(
      v_patched,
      $re$current_timestamp([[:space:]]*)<([[:space:]]*)([A-Za-z_][A-Za-z0-9_]*)\.scheduled_end$re$,
      $rp$current_timestamp\1<\2\3.scheduled_start$rp$,
      'gi'
    );

    -- Keep diagnostics truthful after changing the gate.
    v_patched := replace(
      v_patched,
      'The confirmed schedule has not ended yet.',
      'The Activity has not started yet.'
    );
    v_patched := replace(
      v_patched,
      'The Activity has not ended yet.',
      'The Activity has not started yet.'
    );
    v_patched := replace(
      v_patched,
      'Activity has not ended yet.',
      'Activity has not started yet.'
    );

    if v_patched = v_definition then
      -- Idempotency: if the start-time gate is already present, this migration
      -- has effectively been applied and there is nothing else to do.
      if v_definition ~* $re$([A-Za-z_][A-Za-z0-9_]*)\.scheduled_start([[:space:]]*)>([[:space:]]*)now\(\)$re$
         or v_definition ~* $re$now\(\)([[:space:]]*)<([[:space:]]*)([A-Za-z_][A-Za-z0-9_]*)\.scheduled_start$re$
         or v_definition ~* $re$([A-Za-z_][A-Za-z0-9_]*)\.scheduled_start([[:space:]]*)>([[:space:]]*)current_timestamp$re$
         or v_definition ~* $re$current_timestamp([[:space:]]*)<([[:space:]]*)([A-Za-z_][A-Za-z0-9_]*)\.scheduled_start$re$
      then
        continue;
      end if;

      raise exception
        'Could not locate the scheduled-end lifecycle gate inside public.%. The function was left unchanged.',
        v_function_name;
    end if;

    execute v_patched;
  end loop;
end;
$migration$;

comment on function public.mark_shared_plan_not_happened_v2(uuid, text) is
  'Records that a confirmed Planned Activity did not happen. Once its confirmed start time has passed, the Primary Host may resolve the outcome without waiting for the scheduled end; Intent links are detached before linked Intents are reopened or expired.';

commit;
