-- Read-only regression audit for the Library -> scope -> card detail contract.
-- Run after migration 202610080012_canonical_card_read_model_v143.sql:
--   npx supabase db query --linked --file tests/card-read-model-v143.sql

begin;
set transaction read only;
set local statement_timeout = '10min';
set local search_path = public, extensions;

do $audit$
declare
  v_viewer uuid;
  v_targets uuid[];
  v_summary jsonb;
  v_target uuid;
  v_resolved uuid;
  v_alias uuid;
  v_alias_summary jsonb;
  v_resolved_summary jsonb;
  v_wanting bigint;
  v_done bigint;
  v_active bigint;
  v_completed bigint;
  v_expired bigint;
  v_cancelled bigint;
  v_difference_count bigint;
  v_reported_categories jsonb;
  v_reported_count bigint;
  v_expected_count bigint;
  v_type record;
  v_failures jsonb := '[]'::jsonb;
begin
  if to_regprocedure('public.get_uin_card_closure_v143(uuid[],boolean)') is null
     or to_regprocedure('public.resolve_uin_card_targets_v143(uuid[])') is null
     or to_regprocedure('public.get_uin_card_summary_v143(uuid[])') is null then
    raise exception 'v143 canonical card read model is not installed.';
  end if;

  -- Use the account with the broadest personal-card surface. The audit only
  -- emits target ids and counters; no profile or journal content is returned.
  select candidate.user_id
  into v_viewer
  from (
    select seed.user_id, count(*) card_count
    from public.seeds seed
    where seed.canonical_target_id is not null
      and seed.status in ('active', 'completed')
    group by seed.user_id
    union all
    select personal.user_id, count(*) card_count
    from public.canonical_personal_intents_v38 personal
    where personal.target_id is not null
      and personal.status in ('active', 'completed')
    group by personal.user_id
  ) candidate
  group by candidate.user_id
  order by sum(candidate.card_count) desc, candidate.user_id
  limit 1;

  if v_viewer is not null then
    perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  end if;

  -- Every shared/catalogue-backed wish, experience, and social event must
  -- resolve to an active Library identity. Legacy aliases are valid when their
  -- resolved card is active. Catalogue-free Seeds are accepted only when they
  -- remain historical private canonical targets; publishing them as catalogue
  -- rows would expose private goal titles.
  if exists (
    select 1
    from public.seeds seed
    left join public.canonical_targets target
      on target.id=seed.canonical_target_id
    where seed.canonical_target_id is not null
      and seed.status in ('active', 'completed')
      and (
        (
          seed.catalog_item_id is not null
          and not exists (
            select 1
            from public.get_uin_card_identity_aliases_v143(seed.canonical_target_id) identity
            join public.seed_catalog_items item
              on item.canonical_target_id=identity.target_id
             and item.status='active'
          )
        )
        or
        (
          seed.catalog_item_id is null
          and target.kind is distinct from 'personal'
        )
      )
  ) then
    raise exception 'An active/completed seed is not linked to an active Library card.';
  end if;

  if exists (
    select 1
    from public.canonical_personal_intents_v38 personal
    where personal.target_id is not null
      and personal.status in ('active', 'completed')
      and not exists (
        select 1
        from public.get_uin_card_identity_aliases_v143(personal.target_id) identity
        join public.seed_catalog_items item
          on item.canonical_target_id=identity.target_id
         and item.status='active'
      )
  ) then
    raise exception 'A personal intent is not linked to an active Library card.';
  end if;

  if exists (
    select 1
    from public.intents intent
    where intent.canonical_target_id is not null
      and not exists (
        select 1
        from public.get_uin_card_identity_aliases_v143(intent.canonical_target_id) identity
        join public.seed_catalog_items item
          on item.canonical_target_id=identity.target_id
         and item.status='active'
      )
  ) then
    raise exception 'A social intent/event is not linked to an active Library card.';
  end if;

  -- A category badge represents distinct selectable cards, not the number of
  -- active source placements. Multiple active placements for one canonical
  -- target are valid and must collapse into a single displayed card.
  v_reported_categories := public.get_uin_category_counts_v129();
  for v_type in
    select type.id, type.base_kind
    from public.uin_content_types type
    where type.active
  loop
    v_reported_count := coalesce((v_reported_categories ->> v_type.id)::bigint, 0);

    if v_type.base_kind = 'place' then
      v_expected_count := coalesce((public.get_global_place_counts_v122() ->> 'cities')::bigint, 0);
    elsif v_type.id = v_type.base_kind then
      select count(distinct item.canonical_target_id)
      into v_expected_count
      from public.seed_catalog_items item
      join public.canonical_targets target on target.id = item.canonical_target_id
      where item.status = 'active'
        and item.canonical_target_id is not null
        and coalesce(item.metadata ->> 'global_place_catalogue', 'false') <> 'true'
        and (public.is_admin() or coalesce((target.editorial_metadata ->> 'admin_hidden')::boolean, false) = false)
        and case
          when v_type.base_kind = 'series' then item.item_kind in ('series', 'video')
          else item.item_kind = v_type.base_kind
        end;
    else
      select count(distinct item.canonical_target_id)
      into v_expected_count
      from public.seed_catalog_items item
      join public.canonical_targets target on target.id = item.canonical_target_id
      where item.status = 'active'
        and item.canonical_target_id is not null
        and coalesce(item.metadata ->> 'global_place_catalogue', 'false') <> 'true'
        and (public.is_admin() or coalesce((target.editorial_metadata ->> 'admin_hidden')::boolean, false) = false)
        and item.metadata @> jsonb_build_object('content_type_id', v_type.id);
    end if;

    if v_reported_count is distinct from v_expected_count then
      v_failures := v_failures || jsonb_build_array(jsonb_build_object(
        'content_type_id', v_type.id,
        'reported', v_reported_count,
        'selectable', v_expected_count
      ));
    end if;
  end loop;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'Library category badges differ from selectable cards.' using detail = v_failures::text;
  end if;

  -- Start with every target that carries data and walk towards its structural
  -- parents. This covers direct cards as well as city/district/source cards
  -- whose displayed totals aggregate child cards.
  with recursive direct(target_id) as (
    select seed.canonical_target_id
    from public.seeds seed
    where seed.canonical_target_id is not null
      and seed.status in ('active', 'completed')
    union
    select personal.target_id
    from public.canonical_personal_intents_v38 personal
    where personal.target_id is not null
      and personal.status in ('active', 'completed')
    union
    select intent.canonical_target_id
    from public.intents intent
    where intent.canonical_target_id is not null
  ), lineage(target_id) as (
    select direct.target_id from direct
    union
    select parent.target_id
    from lineage child
    cross join lateral (
      select coalesce(
        nullif(target.editorial_metadata #>> '{card_hierarchy,parent_target_id}', '')::uuid,
        nullif(target.editorial_metadata #>> '{place_hierarchy,parent_target_id}', '')::uuid,
        nullif(target.editorial_metadata #>> '{club_hierarchy,parent_target_id}', '')::uuid
      ) target_id
      from public.canonical_targets target
      where target.id = child.target_id
      union
      select relation.related_target_id
      from public.uin_card_relations_v87 relation
      where relation.source_target_id = child.target_id
        and relation.relation_type = 'source_material'
      union
      select node.parent_target_id
      from public.uin_place_nodes_v123 node
      where node.canonical_target_id = child.target_id
    ) parent
    where parent.target_id is not null
  )
  select array_agg(distinct resolved.resolved_id order by resolved.resolved_id)
  into v_targets
  from public.resolve_uin_card_targets_v143(
    coalesce((select array_agg(lineage.target_id) from lineage), array[]::uuid[])
  ) resolved;

  v_targets := coalesce(v_targets, array[]::uuid[]);

  -- A closure is a set. Duplicate paths or a missing resolved root make every
  -- downstream counter ambiguous.
  if exists (
    select 1
    from public.get_uin_card_closure_v143(v_targets, true) closure
    group by closure.requested_id, closure.target_id
    having count(*) <> 1
  ) then
    raise exception 'The v143 closure returned duplicate targets.';
  end if;

  if exists (
    select 1
    from unnest(v_targets) requested(target_id)
    where not exists (
      select 1
      from public.get_uin_card_closure_v143(array[requested.target_id], true) closure
      where closure.resolved_id = requested.target_id
        and closure.target_id = requested.target_id
        and closure.depth = 0
    )
  ) then
    raise exception 'The v143 closure omitted a resolved root.';
  end if;

  -- Compatibility RPCs must remain exact aliases of the canonical summary;
  -- otherwise catalogue, mobile, and modal callers can drift again.
  if exists (
    (
      select value from public.get_uin_card_summary_v143(v_targets) value
      except
      select value from public.get_uin_card_summary_v107(v_targets) value
    )
    union all
    (
      select value from public.get_uin_card_summary_v107(v_targets) value
      except
      select value from public.get_uin_card_summary_v143(v_targets) value
    )
    union all
    (
      select value from public.get_uin_card_summary_v143(v_targets) value
      except
      select value from public.get_uin_card_summary_v129(v_targets) value
    )
    union all
    (
      select value from public.get_uin_card_summary_v129(v_targets) value
      except
      select value from public.get_uin_card_summary_v143(v_targets) value
    )
  ) then
    raise exception 'Legacy summary RPCs drifted from the v143 canonical summary.';
  end if;

  -- The batch summary must equal the exact totals read by the modal. People
  -- readers expose total_count even when the first page is limited to one.
  for v_summary in
    select value
    from public.get_uin_card_summary_v129(v_targets) value
  loop
    v_target := (v_summary ->> 'target_id')::uuid;

    select coalesce(max((person ->> 'total_count')::bigint), 0)
    into v_wanting
    from public.get_uin_card_people_v81(v_target, 'intent', 1, 0) person;

    select coalesce(max((person ->> 'total_count')::bigint), 0)
    into v_done
    from public.get_uin_card_people_v81(v_target, 'experience', 1, 0) person;

    select
      count(distinct coalesce(event ->> 'resource_id', event ->> 'plan_id', event ->> 'intent_id'))
        filter (where event ->> 'event_state' = 'active'),
      count(distinct coalesce(event ->> 'resource_id', event ->> 'plan_id', event ->> 'intent_id'))
        filter (where event ->> 'event_state' = 'completed'),
      count(distinct coalesce(event ->> 'resource_id', event ->> 'plan_id', event ->> 'intent_id'))
        filter (where event ->> 'event_state' = 'expired'),
      count(distinct coalesce(event ->> 'resource_id', event ->> 'plan_id', event ->> 'intent_id'))
        filter (where event ->> 'event_state' = 'cancelled')
    into v_active, v_completed, v_expired, v_cancelled
    from public.get_uin_card_events_v81(v_target) event;

    if (v_summary ->> 'wanting')::bigint is distinct from v_wanting
       or (v_summary ->> 'done')::bigint is distinct from v_done
       or (v_summary ->> 'active')::bigint is distinct from v_active
       or (v_summary ->> 'completed')::bigint is distinct from v_completed
       or (v_summary ->> 'expired')::bigint is distinct from v_expired
       or (v_summary ->> 'cancelled')::bigint is distinct from v_cancelled then
      v_failures := v_failures || jsonb_build_array(jsonb_build_object(
        'target_id', v_target,
        'summary', jsonb_build_array(
          (v_summary ->> 'wanting')::bigint,
          (v_summary ->> 'done')::bigint,
          (v_summary ->> 'active')::bigint,
          (v_summary ->> 'completed')::bigint,
          (v_summary ->> 'expired')::bigint,
          (v_summary ->> 'cancelled')::bigint
        ),
        'modal', jsonb_build_array(
          v_wanting, v_done, v_active, v_completed, v_expired, v_cancelled
        )
      ));
    end if;
  end loop;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'Card summary and modal totals differ.' using detail = v_failures::text;
  end if;

  -- Every legacy identity must expose exactly the same closure and counters as
  -- its resolved card. This is the regression that previously made Nevşehir
  -- show 0/0/0 in the grid and 0/1/0 after opening the modal.
  for v_alias, v_resolved in
    select target.id, public.resolve_uin_card_target_v129(target.id)
    from public.canonical_targets target
    where public.resolve_uin_card_target_v129(target.id) <> target.id
  loop
    select count(*)
    into v_difference_count
    from (
      (
        select closure.target_id
        from public.get_uin_card_closure_v143(array[v_alias], true) closure
        except
        select closure.target_id
        from public.get_uin_card_closure_v143(array[v_resolved], true) closure
      )
      union all
      (
        select closure.target_id
        from public.get_uin_card_closure_v143(array[v_resolved], true) closure
        except
        select closure.target_id
        from public.get_uin_card_closure_v143(array[v_alias], true) closure
      )
    ) difference;

    if v_difference_count <> 0 then
      raise exception 'Alias and resolved closure differ for % -> %.', v_alias, v_resolved;
    end if;

    select value into v_alias_summary
    from public.get_uin_card_summary_v129(array[v_alias]) value
    limit 1;

    select value into v_resolved_summary
    from public.get_uin_card_summary_v129(array[v_resolved]) value
    limit 1;

    if jsonb_build_array(
         v_alias_summary -> 'wanting', v_alias_summary -> 'done',
         v_alias_summary -> 'active', v_alias_summary -> 'completed',
         v_alias_summary -> 'expired', v_alias_summary -> 'cancelled'
       ) is distinct from jsonb_build_array(
         v_resolved_summary -> 'wanting', v_resolved_summary -> 'done',
         v_resolved_summary -> 'active', v_resolved_summary -> 'completed',
         v_resolved_summary -> 'expired', v_resolved_summary -> 'cancelled'
       ) then
      raise exception 'Alias and resolved summary differ for % -> %.', v_alias, v_resolved;
    end if;
  end loop;

  -- Personal scope membership must resolve/deduplicate direct targets only.
  -- Unknown or inactive types are assigned to the active generic `activity`
  -- category, so no card can disappear from the tab/category totals.
  if v_viewer is not null then
    with seed_rows as materialized (
      select to_jsonb(value) row
      from public.get_my_canonical_seeds_v31(null) value
    ), presentations as materialized (
      select to_jsonb(value) row
      from public.get_my_uin_seed_presentations_v70() value
    ), personal_rows as materialized (
      select to_jsonb(value) row
      from public.get_my_uin_personal_cards_v57() value
    ), source_rows as materialized (
      select to_jsonb(value) row
      from public.get_my_uin_topic_sources_v71() value
    ), raw_scope as (
      select 'wishes' scope, (seed.row ->> 'canonical_target_id')::uuid target_id,
        presentation.row ->> 'type_id' declared_type
      from seed_rows seed
      left join presentations presentation
        on presentation.row ->> 'seed_id' = seed.row ->> 'seed_id'
      where seed.row ->> 'status' = 'active'
        and nullif(seed.row ->> 'canonical_target_id', '') is not null
      union all
      select 'wishes', (personal.row ->> 'target_id')::uuid,
        personal.row ->> 'type_id'
      from personal_rows personal
      where nullif(personal.row ->> 'target_id', '') is not null
      union all
      select 'experiences', (seed.row ->> 'canonical_target_id')::uuid,
        presentation.row ->> 'type_id'
      from seed_rows seed
      left join presentations presentation
        on presentation.row ->> 'seed_id' = seed.row ->> 'seed_id'
      where seed.row ->> 'status' = 'completed'
        and nullif(seed.row ->> 'canonical_target_id', '') is not null
      union all
      select 'plans', (source.row ->> 'target_id')::uuid,
        source.row ->> 'type_id'
      from source_rows source
      where nullif(source.row ->> 'target_id', '') is not null
        and nullif(source.row ->> 'resource_id', '') is not null
        and (
          exists (
            select 1 from public.plans plan
            where plan.id = (source.row ->> 'resource_id')::uuid
              and plan.status in ('forming', 'planned', 'active')
          )
          or exists (
            select 1 from public.intents intent
            where intent.id = (source.row ->> 'resource_id')::uuid
              and intent.status in ('open', 'future', 'forming', 'planned')
          )
        )
    ), resolved_scope as (
      select raw.scope, resolved.resolved_id target_id,
        resolved.type_id canonical_type
      from raw_scope raw
      cross join lateral public.resolve_uin_card_targets_v143(array[raw.target_id]) resolved
    ), classified as (
      select resolved.scope, resolved.target_id,
        coalesce(nullif(max(resolved.canonical_type), ''), 'activity') type_id
      from resolved_scope resolved
      join public.canonical_targets target on target.id = resolved.target_id
      join public.uin_content_types type
        on type.id = resolved.canonical_type and type.active
      group by resolved.scope, resolved.target_id
    ), raw_totals as (
      select scope, count(distinct target_id)::bigint total
      from resolved_scope
      group by scope
    ), category_totals as (
      select scope, sum(card_count)::bigint total
      from (
        select scope, type_id, count(*)::bigint card_count
        from classified
        group by scope, type_id
      ) grouped
      group by scope
    )
    select count(*)
    into v_difference_count
    from raw_totals raw
    full join category_totals category using (scope)
    where coalesce(raw.total, 0) <> coalesce(category.total, 0);

    if v_difference_count <> 0 then
      raise exception 'A personal scope total differs from its category totals.';
    end if;

  end if;

  raise notice 'v143 card read-model audit passed for % engaged/resolved targets.', cardinality(v_targets);
end;
$audit$;

rollback;
