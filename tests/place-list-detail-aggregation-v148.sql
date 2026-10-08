-- Targeted read-only regression for Library/list -> full card detail totals.
-- It pins the Nevşehir structural city and its legacy identity because that card
-- exposed the production regression: the grid showed 1/1/0 while the modal
-- replaced those counters with 0/0/0.
--
-- Run after the canonical read-model migrations:
--   npx supabase db query --linked --file tests/place-list-detail-aggregation-v148.sql

begin;
set transaction read only;
set local statement_timeout = '2min';
set local search_path = public, extensions;

do $audit$
declare
  v_nevsehir uuid;
  v_alias uuid;
  v_requested uuid;
  v_resolved uuid;
  v_summary jsonb;
  v_catalogue jsonb;
  v_wanting bigint;
  v_done bigint;
  v_active bigint;
  v_failures jsonb := '[]'::jsonb;
begin
  if to_regprocedure('public.resolve_uin_card_target_v129(uuid)') is null
     or to_regprocedure('public.get_uin_card_closure_v143(uuid[],boolean)') is null
     or to_regprocedure('public.get_uin_card_summary_v129(uuid[])') is null
     or to_regprocedure('public.get_uin_catalogue_for_targets_v123(uuid[])') is null
     or to_regprocedure('public.get_uin_card_people_v81(uuid,text,integer,integer)') is null
     or to_regprocedure('public.get_uin_card_events_v81(uuid)') is null then
    raise exception 'Canonical place list/detail readers are not installed.';
  end if;

  select node.canonical_target_id
  into v_nevsehir
  from public.uin_place_nodes_v123 node
  where node.scope = 'city'
    and node.country_code = 'TR'
    and node.source_key = 'TR:50'
  order by node.canonical_target_id
  limit 1;

  if v_nevsehir is null then
    raise exception 'Nevşehir structural place fixture (TR:50) is missing.';
  end if;

  if not exists (
    select 1
    from public.seed_catalog_items item
    where item.canonical_target_id = v_nevsehir
      and item.status = 'active'
      and item.item_kind = 'place'
  ) then
    raise exception 'Nevşehir structural target has no active place placement.';
  end if;

  select target.id
  into v_alias
  from public.canonical_targets target
  where target.id <> v_nevsehir
    and public.canonical_normalize_v31(target.title) =
        public.canonical_normalize_v31('Nevşehir')
    and public.resolve_uin_card_target_v129(target.id) = v_nevsehir
  order by target.id
  limit 1;

  if v_alias is null then
    raise exception 'Nevşehir legacy place identity is missing.';
  end if;

  if not exists (
    select 1
    from public.get_uin_card_closure_v143(array[v_nevsehir], true) closure
    where closure.target_id = v_alias
  ) then
    raise exception 'Nevşehir canonical closure omitted its legacy identity %.', v_alias;
  end if;

  foreach v_requested in array array[v_nevsehir, v_alias]
  loop
    v_resolved := public.resolve_uin_card_target_v129(v_requested);

    if v_resolved is distinct from v_nevsehir then
      raise exception 'Nevşehir identity % resolved to %, expected %.',
        v_requested, v_resolved, v_nevsehir;
    end if;

    select value
    into v_summary
    from public.get_uin_card_summary_v129(array[v_requested]) value
    limit 1;

    -- The API canonicalizes the URL id before loading the same catalogue row
    -- that powers the Library grid.
    select value
    into v_catalogue
    from public.get_uin_catalogue_for_targets_v123(array[v_resolved]) value
    limit 1;

    select coalesce(max((person ->> 'total_count')::bigint), 0)
    into v_wanting
    from public.get_uin_card_people_v81(v_requested, 'intent', 1, 0) person;

    select coalesce(max((person ->> 'total_count')::bigint), 0)
    into v_done
    from public.get_uin_card_people_v81(v_requested, 'experience', 1, 0) person;

    select count(distinct coalesce(
      nullif(event ->> 'resource_id', ''),
      nullif(event ->> 'plan_id', ''),
      nullif(event ->> 'intent_id', '')
    )) filter (where event ->> 'event_state' = 'active')
    into v_active
    from public.get_uin_card_events_v81(v_requested) event;

    if v_summary is null or v_catalogue is null
       or (v_summary ->> 'target_id')::uuid is distinct from v_resolved
       or (v_catalogue ->> 'canonical_target_id')::uuid is distinct from v_resolved
       or (v_catalogue ->> 'intent_people_count')::bigint
          is distinct from (v_summary ->> 'wanting')::bigint
       or (v_catalogue ->> 'experience_people_count')::bigint
          is distinct from (v_summary ->> 'done')::bigint
       or (v_catalogue ->> 'active_event_count')::bigint
          is distinct from (v_summary ->> 'active')::bigint
       or (v_summary ->> 'wanting')::bigint is distinct from v_wanting
       or (v_summary ->> 'done')::bigint is distinct from v_done
       or (v_summary ->> 'active')::bigint is distinct from v_active then
      v_failures := v_failures || jsonb_build_array(jsonb_build_object(
        'requested_id', v_requested,
        'resolved_id', v_resolved,
        'summary', jsonb_build_array(
          v_summary -> 'wanting',
          v_summary -> 'done',
          v_summary -> 'active'
        ),
        'catalogue', jsonb_build_array(
          v_catalogue -> 'intent_people_count',
          v_catalogue -> 'experience_people_count',
          v_catalogue -> 'active_event_count'
        ),
        'modal_readers', jsonb_build_array(v_wanting, v_done, v_active)
      ));
    end if;
  end loop;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'Nevşehir list/detail aggregation drifted.'
      using detail = v_failures::text;
  end if;
end;
$audit$;

rollback;
