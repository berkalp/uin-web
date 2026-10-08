-- Read-only regression audit for place-title collisions (for example the
-- Batman city and a book named Batman). Equal normalized titles are valid;
-- they must remain separate identities unless the catalogue target is an
-- unambiguous place alias.
--
-- This audit intentionally does not inspect generic card_hierarchy,
-- club_hierarchy, or source_material edges. Cross-kind relations in those
-- graphs are valid and are outside the place-identity contract.

begin;
set transaction read only;
set local statement_timeout = '2min';
set local search_path = public, extensions;

do $audit$
declare
  v_failures jsonb;
  v_batman_books bigint;
begin
  if to_regprocedure('public.is_uin_place_target_v146(uuid)') is null
     or to_regprocedure('public.resolve_uin_card_target_v129(uuid)') is null
     or to_regprocedure('public.resolve_uin_card_targets_v143(uuid[])') is null
     or to_regprocedure('public.get_uin_card_structural_closure_v143(uuid[])') is null
     or to_regprocedure('public.get_uin_catalogue_for_targets_v123(uuid[])') is null then
    raise exception 'v146 canonical place/card read model is not installed.';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger tg
    where not tg.tgisinternal
      and tg.tgdeferrable
      and tg.tginitdeferred
      and tg.tgname in(
        'guard_uin_place_node_identity_v146',
        'guard_uin_place_catalogue_identity_v146',
        'guard_uin_place_target_metadata_v146'
      )
  )<>3 then
    raise exception 'v146 deferred place identity guards are not installed.';
  end if;

  -- Every structural place node must have an active place placement, must not
  -- share its target with an active non-place placement, and may only carry
  -- explicit place type metadata.
  select jsonb_agg(to_jsonb(example) order by example.source_key)
  into v_failures
  from (
    select node.source_key,node.scope,node.canonical_target_id,target.title,
      count(distinct item.id) filter(where item.item_kind='place') active_place_count,
      array_agg(distinct item.item_kind order by item.item_kind)
        filter(where item.item_kind<>'place') active_non_place_kinds,
      nullif(target.editorial_metadata->>'content_type_id','') editorial_content_type,
      nullif(target.editorial_metadata->>'item_kind','') editorial_item_kind
    from public.uin_place_nodes_v123 node
    join public.canonical_targets target on target.id=node.canonical_target_id
    left join public.seed_catalog_items item
      on item.canonical_target_id=node.canonical_target_id
     and item.status='active'
    group by node.source_key,node.scope,node.canonical_target_id,target.title,
      target.editorial_metadata
    having count(distinct item.id) filter(where item.item_kind='place')=0
       or count(distinct item.id) filter(where item.item_kind<>'place')>0
       or (
         nullif(target.editorial_metadata->>'content_type_id','') is not null
         and target.editorial_metadata->>'content_type_id'<>'place'
       )
       or (
         nullif(target.editorial_metadata->>'item_kind','') is not null
         and target.editorial_metadata->>'item_kind'<>'place'
       )
    order by node.source_key
    limit 25
  ) example;

  if coalesce(jsonb_array_length(v_failures),0)>0 then
    raise exception 'A place node violates the active place identity contract.'
      using detail=v_failures::text;
  end if;

  -- Explicit place hierarchy metadata is likewise reserved for active place
  -- identities; it cannot be attached to a book or another content target.
  select jsonb_agg(to_jsonb(example) order by example.title,example.target_id)
  into v_failures
  from (
    select target.id target_id,target.title,
      count(distinct item.id) filter(where item.item_kind='place') active_place_count,
      array_agg(distinct item.item_kind order by item.item_kind)
        filter(where item.item_kind<>'place') active_non_place_kinds,
      target.editorial_metadata->'place_hierarchy' place_hierarchy,
      nullif(target.editorial_metadata->>'content_type_id','') editorial_content_type,
      nullif(target.editorial_metadata->>'item_kind','') editorial_item_kind
    from public.canonical_targets target
    left join public.seed_catalog_items item
      on item.canonical_target_id=target.id
     and item.status='active'
    where target.editorial_metadata ? 'place_hierarchy'
    group by target.id,target.title,target.editorial_metadata
    having count(distinct item.id) filter(where item.item_kind='place')=0
       or count(distinct item.id) filter(where item.item_kind<>'place')>0
       or (
         nullif(target.editorial_metadata->>'content_type_id','') is not null
         and target.editorial_metadata->>'content_type_id'<>'place'
       )
       or (
         nullif(target.editorial_metadata->>'item_kind','') is not null
         and target.editorial_metadata->>'item_kind'<>'place'
       )
    order by target.title,target.id
    limit 25
  ) example;

  if coalesce(jsonb_array_length(v_failures),0)>0 then
    raise exception 'Place hierarchy metadata is attached to a non-place identity.'
      using detail=v_failures::text;
  end if;

  -- Node parentage itself must remain inside the place-node graph.
  select jsonb_agg(to_jsonb(example) order by example.source_key)
  into v_failures
  from (
    select child.source_key,child.scope,child.canonical_target_id,child.parent_target_id
    from public.uin_place_nodes_v123 child
    where child.parent_target_id is not null
      and not exists(
        select 1
        from public.uin_place_nodes_v123 parent
        where parent.canonical_target_id=child.parent_target_id
      )
    order by child.source_key
    limit 25
  ) example;

  if coalesce(jsonb_array_length(v_failures),0)>0 then
    raise exception 'A place node points to a non-place parent identity.'
      using detail=v_failures::text;
  end if;

  -- The legacy Turkish-city resolver is place-only. Every active non-place
  -- target, whether or not its title collides with a city, must resolve to
  -- itself. This is the general form of the Batman regression.
  with active_non_place as materialized (
    select distinct target.id target_id,target.title
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active' and item.item_kind<>'place'
  ), bad as (
    select card.*,
      public.resolve_uin_card_target_v129(card.target_id) resolved_id
    from active_non_place card
    where public.resolve_uin_card_target_v129(card.target_id)
      is distinct from card.target_id
  )
  select jsonb_agg(to_jsonb(bad) order by bad.title,bad.target_id)
  into v_failures
  from (select * from bad order by title,target_id limit 25) bad;

  if coalesce(jsonb_array_length(v_failures),0)>0 then
    raise exception 'An active non-place card was resolved to a place identity.'
      using detail=v_failures::text;
  end if;

  -- The batch resolver must preserve the same root and non-place type.
  with active_non_place as materialized (
    select distinct target.id target_id,target.title
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active' and item.item_kind<>'place'
  ), bad as (
    select card.*,mapping.resolved_id,mapping.type_id,
      resolved_type.base_kind resolved_base_kind
    from active_non_place card
    left join lateral public.resolve_uin_card_targets_v143(array[card.target_id]) mapping
      on mapping.requested_id=card.target_id
    left join public.uin_content_types resolved_type on resolved_type.id=mapping.type_id
    where mapping.requested_id is null
       or mapping.resolved_id is distinct from card.target_id
       or resolved_type.id is null
       or resolved_type.base_kind='place'
  )
  select jsonb_agg(to_jsonb(bad) order by bad.title,bad.target_id)
  into v_failures
  from (select * from bad order by title,target_id limit 25) bad;

  if coalesce(jsonb_array_length(v_failures),0)>0 then
    raise exception 'Batch resolution leaked a place identity into a non-place card.'
      using detail=v_failures::text;
  end if;

  -- Keep an explicit fixture for the reported collision. Every active Batman
  -- book must remain its own structural root and must be browseable as a book.
  with batman_books as materialized (
    select distinct item.canonical_target_id target_id
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active'
      and item.item_kind='book'
      and (
        public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31('Batman')
        or public.canonical_normalize_v31(target.title)=public.canonical_normalize_v31('Batman')
      )
  )
  select count(*) into v_batman_books from batman_books;

  if v_batman_books=0 then
    raise exception 'Batman book regression fixture is missing from the active catalogue.';
  end if;

  with batman_books as materialized (
    select distinct item.canonical_target_id target_id
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active'
      and item.item_kind='book'
      and (
        public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31('Batman')
        or public.canonical_normalize_v31(target.title)=public.canonical_normalize_v31('Batman')
      )
  ), inspected as (
    select book.target_id,mapping.resolved_id,mapping.type_id,
      resolved_type.base_kind resolved_base_kind,
      browse.row_count,browse.returned_target_id,browse.item_kind,
      browse.content_type_id,browse_type.base_kind browse_base_kind,
      exists(
        select 1
        from public.get_uin_card_structural_closure_v143(array[book.target_id]) closure
        where closure.requested_id=book.target_id
          and closure.target_id=book.target_id
          and closure.depth=0
      ) is_structural_root
    from batman_books book
    left join lateral public.resolve_uin_card_targets_v143(array[book.target_id]) mapping
      on mapping.requested_id=book.target_id
    left join public.uin_content_types resolved_type on resolved_type.id=mapping.type_id
    left join lateral (
      select count(*) row_count,
        min(nullif(card->>'canonical_target_id',''))::uuid returned_target_id,
        min(card->>'item_kind') item_kind,
        min(card->>'content_type_id') content_type_id
      from public.get_uin_catalogue_for_targets_v123(array[book.target_id]) catalogue(card)
    ) browse on true
    left join public.uin_content_types browse_type on browse_type.id=browse.content_type_id
  ), bad as (
    select *
    from inspected
    where resolved_id is distinct from target_id
       or resolved_base_kind is distinct from 'book'
       or row_count<>1
       or returned_target_id is distinct from target_id
       or item_kind is distinct from 'book'
       or browse_base_kind is distinct from 'book'
       or not is_structural_root
  )
  select jsonb_agg(to_jsonb(bad) order by bad.target_id)
  into v_failures
  from bad;

  if coalesce(jsonb_array_length(v_failures),0)>0 then
    raise exception 'Batman book is not a browseable non-place root.'
      using detail=v_failures::text;
  end if;

  raise notice 'Place identity/title collision audit passed (% Batman book target(s)).',
    v_batman_books;
end;
$audit$;

rollback;
