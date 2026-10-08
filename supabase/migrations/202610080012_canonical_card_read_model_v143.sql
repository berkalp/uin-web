begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- One indexed edge lookup is used by the canonical closure below.
create index if not exists uin_card_relations_source_material_v143_idx
on public.uin_card_relations_v87(related_target_id,source_target_id)
where relation_type='source_material';

-- Identity aliases are not descendants. Keep them separate so a direct user
-- action can be looked up without accidentally inheriting an action from a
-- child card. The legacy alias rule only applies to structural Turkish cities.
create or replace function public.get_uin_card_identity_aliases_v143(p_target_id uuid)
returns table(target_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with root as materialized (
    select public.resolve_uin_card_target_v129(p_target_id) id
  ), root_card as materialized (
    select target.id,target.title
    from root
    join public.canonical_targets target on target.id=root.id
  ), legacy_city as materialized (
    select distinct item.canonical_target_id target_id
    from root_card
    join public.uin_place_nodes_v123 node
      on node.canonical_target_id=root_card.id
     and node.scope='city'
     and node.country_code='TR'
    join public.seed_catalog_items item
      on item.status='active'
     and item.item_kind='place'
     and item.canonical_target_id is not null
     and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(root_card.title)
  )
  select root.id from root
  union
  select p_target_id
  where exists(select 1 from public.canonical_targets target where target.id=p_target_id)
  union
  select legacy_city.target_id from legacy_city;
$function$;

-- Cheap batch mapping for personal scope membership. Clients must resolve and
-- deduplicate their direct target ids with this function; they must not use the
-- descendant closure for membership, because a wish on Kız Kulesi is not a
-- direct wish on every ancestor card.
create or replace function public.resolve_uin_card_targets_v143(p_target_ids uuid[])
returns table(requested_id uuid,resolved_id uuid,type_id text)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select distinct input.id requested_id,resolved.id resolved_id,
    coalesce(content_type.id,'activity') type_id
  from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  join public.canonical_targets target on target.id=input.id
  cross join lateral (
    select public.resolve_uin_card_target_v129(input.id) id
  ) resolved
  join public.canonical_targets resolved_target on resolved_target.id=resolved.id
  left join lateral (
    select item.item_kind,item.metadata
    from public.seed_catalog_items item
    where item.canonical_target_id=resolved.id and item.status='active'
    order by item.updated_at desc,item.id
    limit 1
  ) catalogue on true
  left join lateral (
    select type.id
    from (values
      (1,nullif(resolved_target.editorial_metadata->>'content_type_id','')),
      (2,nullif(catalogue.metadata->>'content_type_id','')),
      (3,case when catalogue.item_kind='video' then 'series' else catalogue.item_kind end)
    ) candidate(priority,id)
    join public.uin_content_types type on type.id=candidate.id and type.active
    order by candidate.priority
    limit 1
  ) content_type on true;
$function$;

-- The former hierarchy RPC built the entire forest before filtering the
-- requested ids. Card grids only need each requested card's direct parent, so
-- read those edges with indexed lookups. Metadata is authoritative, followed
-- by the place-node parent and the generic source-material relation.
create or replace function public.get_uin_card_parent_edges_v143(p_target_ids uuid[])
returns table(
  target_id uuid,
  parent_target_id uuid,
  sort_order integer,
  section_title text,
  depth integer,
  path uuid[]
)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with requested as materialized (
    select distinct input.id target_id,
      public.resolve_uin_card_target_v129(input.id) resolved_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
    join public.canonical_targets target on target.id=input.id
  )
  select requested.target_id,parent.id parent_target_id,
    coalesce(edge.sort_order,0)::integer sort_order,
    edge.section_title,
    case when parent.id is null then 0 else 1 end::integer depth,
    case when parent.id is null then array[requested.target_id]
      else array[parent.id,requested.target_id] end path
  from requested
  join public.canonical_targets target on target.id=requested.resolved_id
  left join lateral (
    select candidate.parent_target_id,candidate.sort_order,candidate.section_title
    from (
      select coalesce(
          nullif(target.editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
          nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
          nullif(target.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
        ) parent_target_id,
        coalesce((target.editorial_metadata->'card_hierarchy'->>'sort_order')::integer,0) sort_order,
        nullif(target.editorial_metadata->'card_hierarchy'->>'section_title','') section_title,
        1 priority

      union all

      select node.parent_target_id,coalesce(node.sort_order,0),null::text,2
      from public.uin_place_nodes_v123 node
      where node.canonical_target_id=requested.resolved_id
        and node.parent_target_id is not null

      union all

      select relation.related_target_id,relation.sort_order,relation.section_title,3
      from public.uin_card_relations_v87 relation
      where relation.source_target_id=requested.resolved_id
        and relation.relation_type='source_material'
    ) candidate
    where candidate.parent_target_id is not null
    order by candidate.priority,candidate.sort_order,candidate.parent_target_id
    limit 1
  ) edge on true
  left join public.canonical_targets parent
    on parent.id=public.resolve_uin_card_target_v129(edge.parent_target_id)
   and (public.is_admin() or coalesce((parent.editorial_metadata->>'admin_hidden')::boolean,false)=false)
  where public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
  order by requested.target_id;
$function$;

-- This is the sole card tree used by detail readers and batch summaries.
-- It expands metadata parents, generic source-material relations and place
-- hierarchy edges through get_uin_card_direct_children_v135, while folding in
-- every identity alias at each level. Cycles and duplicate paths are removed.
create or replace function public.get_uin_card_closure_v143(
  p_target_ids uuid[],
  p_include_self boolean default true
)
returns table(requested_id uuid,resolved_id uuid,target_id uuid,depth integer)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with recursive requested as materialized (
    select distinct input.id requested_id,
      public.resolve_uin_card_target_v129(input.id) resolved_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
    join public.canonical_targets target on target.id=input.id
  ), root_sets as materialized (
    select requested.requested_id,requested.resolved_id,
      array_agg(distinct identity.target_id) identities
    from requested
    cross join lateral public.get_uin_card_identity_aliases_v143(requested.resolved_id) identity
    group by requested.requested_id,requested.resolved_id
  ), walk(requested_id,resolved_id,target_id,depth,visited) as (
    select root_sets.requested_id,root_sets.resolved_id,identity.target_id,0,
      root_sets.identities
    from root_sets
    cross join lateral unnest(root_sets.identities) identity(target_id)

    union all

    select walk.requested_id,walk.resolved_id,next_target.target_id,walk.depth+1,
      walk.visited||next_target.target_id
    from walk
    cross join lateral (
      select distinct identity.target_id
      from (
        select child.target_id
        from public.get_uin_card_direct_children_v135(walk.target_id) child
        union
        select node.canonical_target_id
        from public.uin_place_nodes_v123 node
        where node.parent_target_id=walk.target_id
      ) edge
      cross join lateral public.get_uin_card_identity_aliases_v143(edge.target_id) identity
    ) next_target
    join public.canonical_targets target on target.id=next_target.target_id
    where walk.depth<12
      and not next_target.target_id=any(walk.visited)
      and (public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false)
  ), deduped as (
    select walk.requested_id,walk.resolved_id,walk.target_id,min(walk.depth)::integer depth
    from walk
    group by walk.requested_id,walk.resolved_id,walk.target_id
  )
  select deduped.requested_id,deduped.resolved_id,deduped.target_id,deduped.depth
  from deduped
  where p_include_self or deduped.depth>0
  order by deduped.requested_id,deduped.depth,deduped.target_id;
$function$;

-- Backwards-compatible single-card closure. Modal people/event readers already
-- call this function, so replacing it makes them share the batch read model.
create or replace function public.get_uin_card_descendants_v81(
  p_target_id uuid,
  p_include_self boolean default true
)
returns table(target_id uuid,depth integer)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select closure.target_id,min(closure.depth)::integer depth
  from public.get_uin_card_closure_v143(array[p_target_id],p_include_self) closure
  group by closure.target_id
  order by depth,closure.target_id;
$function$;

-- Structural children drive the badge shown on parent cards. Identity aliases
-- contribute people and events but are intentionally excluded from this count.
create or replace function public.get_uin_card_visible_children_v137(p_parent_target_id uuid)
returns table(target_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select target.id
  from public.canonical_targets target
  where coalesce(
    nullif(target.editorial_metadata->'card_hierarchy'->>'parent_target_id','')::uuid,
    nullif(target.editorial_metadata->'place_hierarchy'->>'parent_target_id','')::uuid,
    nullif(target.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid
  )=p_parent_target_id
  union
  select relation.source_target_id
  from public.uin_card_relations_v87 relation
  where relation.related_target_id=p_parent_target_id
    and relation.relation_type='source_material'
  union
  select node.canonical_target_id
  from public.uin_place_nodes_v123 node
  where node.parent_target_id=p_parent_target_id;
$function$;

-- Batch structural walk for child badges. This intentionally excludes identity
-- aliases, and replaces one recursive function call per card with one walk for
-- the whole requested page.
create or replace function public.get_uin_card_structural_closure_v143(p_target_ids uuid[])
returns table(requested_id uuid,target_id uuid,depth integer)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with recursive requested as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) requested_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
    join public.canonical_targets target on target.id=input.id
  ), walk(requested_id,target_id,depth,visited) as (
    select requested.requested_id,requested.requested_id,0,array[requested.requested_id]
    from requested

    union all

    select walk.requested_id,child.target_id,walk.depth+1,walk.visited||child.target_id
    from walk
    cross join lateral public.get_uin_card_visible_children_v137(walk.target_id) child
    join public.canonical_targets target on target.id=child.target_id
    where walk.depth<12
      and not child.target_id=any(walk.visited)
      and (public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false)
  )
  select walk.requested_id,walk.target_id,min(walk.depth)::integer depth
  from walk
  group by walk.requested_id,walk.target_id
  order by walk.requested_id,depth,walk.target_id;
$function$;

create or replace function public.get_uin_card_visible_descendant_count_v137(p_target_id uuid)
returns integer
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select count(*) filter(where closure.depth>0)::integer
  from public.get_uin_card_structural_closure_v143(array[p_target_id]) closure;
$function$;

-- Canonical participant projection. Wanting and completed are independent
-- relationships: somebody can have visited a card before and currently want
-- to do it again. Pick one source row per target/user/status, rather than
-- allowing a completed row to hide that person's current wish.
create or replace function public.get_uin_card_people_projection_v143(p_target_ids uuid[])
returns table(
  requested_id uuid,
  source_target_id uuid,
  user_id uuid,
  source_kind text,
  source_id uuid,
  relationship_status text,
  target_date date
)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with resolved as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) target_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  ), closure as materialized (
    select tree.resolved_id requested_id,tree.target_id source_target_id
    from public.get_uin_card_closure_v143(
      coalesce((select array_agg(target_id) from resolved),array[]::uuid[]),true
    ) tree
    group by tree.resolved_id,tree.target_id
  ), candidates as materialized (
    select closure.requested_id,closure.source_target_id,
      person.user_id,person.source_kind::text source_kind,person.source_id,
      person.relationship_status::text relationship_status,person.target_date
    from public.visible_common_target_people_v38() person
    join closure on closure.source_target_id=person.target_id
    where person.source_kind in('seed','personal')
      and (
        person.relationship_status='completed'
        or (
          person.relationship_status='want'
          and (person.target_date is null or person.target_date>=(now() at time zone 'Europe/Istanbul')::date)
        )
      )
  ), ranked as (
    select candidates.*,
      row_number() over(
        partition by candidates.requested_id,candidates.source_target_id,
          candidates.user_id,candidates.relationship_status
        order by
          case candidates.source_kind when 'seed' then 0 else 1 end,
          candidates.target_date desc nulls last,
          candidates.source_id
      ) rn
    from candidates
  )
  select ranked.requested_id,ranked.source_target_id,ranked.user_id,
    ranked.source_kind,ranked.source_id,ranked.relationship_status,ranked.target_date
  from ranked
  where ranked.rn=1;
$function$;

create or replace function public.get_uin_card_people_v81(
  p_target_id uuid,
  p_group text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with candidates as materialized (
    select projection.*,
      row_number() over(
        partition by projection.user_id
        order by
          case projection.source_kind when 'seed' then 0 else 1 end,
          projection.target_date desc nulls last,
          projection.source_id
      ) rn
    from public.get_uin_card_people_projection_v143(array[p_target_id]) projection
    where projection.relationship_status=case when p_group='experience' then 'completed' else 'want' end
  ), selected as materialized (
    select candidates.*,target.title source_target_title
    from candidates
    join public.canonical_targets target on target.id=candidates.source_target_id
    where candidates.rn=1
  )
  select jsonb_build_object(
    'kind','personal',
    'id',selected.source_id,
    'user_id',selected.user_id,
    'full_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
    'username',profile.username,
    'avatar_url',profile.avatar_url,
    'seed_id',case when selected.source_kind='seed' then selected.source_id end,
    'source_kind',selected.source_kind,
    'source_id',selected.source_id,
    'source_target_id',selected.source_target_id,
    'source_target_title',selected.source_target_title,
    'target_date',selected.target_date,
    'start_date',case when selected.source_kind='personal' then personal.start_date else seed.target_date end,
    'end_date',case when selected.source_kind='personal' then personal.end_date else seed.target_date end,
    'timing_precision',case when selected.source_kind='personal' then personal.timing_precision else 'day' end,
    'date_options',case when selected.source_kind='personal' then personal.date_options else '[]'::jsonb end,
    'notes',case when selected.source_kind='personal' then personal.notes end,
    'visibility',case when selected.source_kind='personal' then personal.visibility else seed.visibility end,
    'location_id',location.id,
    'location',nullif(concat_ws(', ',nullif(location.district,''),nullif(location.city,''),nullif(location.country_name,'')) ,''),
    'location_scope',location.scope,
    'latitude',location.latitude,
    'longitude',location.longitude,
    'rating',case when selected.source_kind='seed' then personal_state.rating end,
    'experience_date',case when selected.source_kind='seed' then coalesce(personal_state.experience_date,seed.completed_at::date) end,
    'experience_year',case when selected.source_kind='seed' then personal_state.experience_year end,
    'experience_text',case when selected.source_kind='seed' then reflection.body end,
    'comment_count',case when selected.source_kind='seed' then (
      select count(*) from public.seed_experience_comments comment
      where comment.seed_id=seed.id and comment.deleted_at is null
    ) else 0 end,
    'total_count',count(*) over()
  )
  from selected
  join public.profiles profile on profile.id=selected.user_id
  left join public.seeds seed on seed.id=selected.source_id and selected.source_kind='seed'
  left join public.canonical_personal_intents_v38 personal
    on personal.id=selected.source_id and selected.source_kind='personal'
  left join public.locations location on location.id=personal.location_id
  left join public.seed_personal_state_v15 personal_state
    on personal_state.seed_id=seed.id and personal_state.user_id=selected.user_id
  left join lateral (
    select journal.body
    from public.seed_journal_entries journal
    where journal.seed_id=seed.id
      and journal.entry_kind='reflection'
      and public.seed_is_visible_to_viewer(selected.user_id,journal.visibility,auth.uid())
    order by journal.occurred_on desc,journal.created_at desc
    limit 1
  ) reflection on true
  order by case when selected.user_id=auth.uid() then 0 else 1 end,
    selected.target_date nulls last,selected.user_id
  limit greatest(1,least(coalesce(p_limit,50),100))
  offset greatest(coalesce(p_offset,0),0);
$function$;

-- Set-based event projection shared by the card summary and detail reader.
create or replace function public.get_uin_card_event_projection_v143(p_target_ids uuid[])
returns table(
  requested_id uuid,
  source_target_id uuid,
  source_target_title text,
  intent_id uuid,
  plan_id uuid,
  resource_id uuid,
  event_state text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with resolved as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) target_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  ), closure as materialized (
    select tree.resolved_id requested_id,tree.target_id,tree.depth,target.title,
      coalesce(target.editorial_metadata->>'content_type_id','')='place'
        or exists(
          select 1 from public.seed_catalog_items place_item
          where place_item.canonical_target_id=target.id and place_item.item_kind='place'
        ) is_place
    from public.get_uin_card_closure_v143(
      coalesce((select array_agg(target_id) from resolved),array[]::uuid[]),true
    ) tree
    join public.canonical_targets target on target.id=tree.target_id
  ), linked_candidates as materialized (
    select closure.requested_id,intent.id intent_id,closure.target_id,closure.title,closure.depth
    from public.intents intent
    join closure on closure.target_id=intent.canonical_target_id

    union all

    select closure.requested_id,intent.id,closure.target_id,closure.title,closure.depth
    from public.seed_intent_links seed_link
    join public.intents intent on intent.id=seed_link.intent_id
    join public.seeds seed on seed.id=seed_link.seed_id
    left join public.seed_catalog_items item on item.id=seed.catalog_item_id
    join closure on closure.target_id=coalesce(seed.canonical_target_id,item.canonical_target_id)

    union all

    select closure.requested_id,intent.id,closure.target_id,closure.title,closure.depth
    from public.intents intent
    join public.locations location on location.id=intent.location_id
    join closure on closure.is_place and public.canonical_normalize_v31(closure.title) in(
      public.canonical_normalize_v31(coalesce(location.district,'')),
      public.canonical_normalize_v31(coalesce(location.city,'')),
      public.canonical_normalize_v31(coalesce(location.country_name,''))
    )
  ), linked as materialized (
    select distinct on(requested_id,intent_id)
      requested_id,intent_id,target_id,title
    from linked_candidates
    order by requested_id,intent_id,depth desc,target_id
  ), rows as materialized (
    select linked.requested_id,linked.target_id source_target_id,
      linked.title source_target_title,intent.id intent_id,plan.id plan_id,
      coalesce(plan.id,intent.id) resource_id,
      case
        when coalesce(intent.status,'') in('cancelled','canceled')
          or coalesce(plan.status,'') in('cancelled','canceled') then 'cancelled'
        when coalesce(intent.status,'')='completed' or coalesce(plan.status,'')='completed' then 'completed'
        when coalesce(plan.scheduled_end::date,intent.end_date,plan.scheduled_start::date,intent.start_date)
          <(now() at time zone 'Europe/Istanbul')::date then 'expired'
        else 'active'
      end event_state
    from linked
    join public.intents intent on intent.id=linked.intent_id
    left join lateral (
      select candidate.id,candidate.status,candidate.scheduled_start,candidate.scheduled_end
      from public.plan_intents plan_link
      join public.plans candidate on candidate.id=plan_link.plan_id
      where plan_link.intent_id=intent.id and plan_link.status='active'
      order by plan_link.linked_at desc
      limit 1
    ) plan on true
    where intent.status in('active','planned','completed','cancelled','canceled')
      and public.intent_is_visible_to_viewer_v38(intent.id,auth.uid())
  )
  select rows.requested_id,rows.source_target_id,rows.source_target_title,
    rows.intent_id,rows.plan_id,rows.resource_id,rows.event_state
  from rows;
$function$;

create or replace function public.get_uin_card_events_v81(p_target_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with events as materialized (
    select projection.*
    from public.get_uin_card_event_projection_v143(array[p_target_id]) projection
  )
  select jsonb_build_object(
    'target_id',public.resolve_uin_card_target_v129(p_target_id),
    'source_target_id',event.source_target_id,
    'source_target_title',event.source_target_title,
    'intent_id',intent.id,
    'plan_id',event.plan_id,
    'resource_id',event.resource_id,
    'subtitle',intent.common_intent_subtitle,
    'start_date',intent.start_date,
    'end_date',intent.end_date,
    'visibility',intent.visibility,
    'status',intent.status,
    'plan_status',plan.status,
    'event_state',event.event_state,
    'location',nullif(concat_ws(', ',nullif(location.district,''),nullif(location.city,''),nullif(location.country_name,'')) ,''),
    'owner_user_id',intent.user_id,
    'owner_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
    'owner_username',profile.username,
    'owner_avatar_url',profile.avatar_url,
    'participant_count',1+(
      select count(*) from public.intent_participants participant
      where participant.intent_id=intent.id and participant.status='active' and participant.user_id<>intent.user_id
    ),
    'participants',jsonb_build_array(jsonb_build_object(
      'user_id',intent.user_id,'full_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
      'username',profile.username,'avatar_url',profile.avatar_url,'role','owner'
    ))||coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',member.id,'full_name',coalesce(member.full_name,member.username,'UIN üyesi'),
        'username',member.username,'avatar_url',member.avatar_url,'role','participant'
      ) order by participant.joined_at)
      from public.intent_participants participant
      join public.profiles member on member.id=participant.user_id
      where participant.intent_id=intent.id and participant.status='active' and participant.user_id<>intent.user_id
    ),'[]'::jsonb),
    'max_participants',intent.max_participants,
    'viewer_is_owner',intent.user_id=auth.uid(),
    'viewer_is_member',intent.user_id=auth.uid() or exists(
      select 1 from public.intent_participants participant
      where participant.intent_id=intent.id and participant.user_id=auth.uid() and participant.status='active'
    )
  )
  from events event
  join public.intents intent on intent.id=event.intent_id
  left join public.plans plan on plan.id=event.plan_id
  left join public.locations location on location.id=intent.location_id
  join public.profiles profile on profile.id=intent.user_id
  order by case event.event_state when 'active' then 0 when 'completed' then 1 when 'expired' then 2 else 3 end,
    case when event.event_state='active' then intent.start_date end,intent.end_date desc,intent.id;
$function$;

create or replace function public.get_uin_card_summary_v143(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with requested as materialized (
    select distinct public.resolve_uin_card_target_v129(input.id) target_id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  ), types as materialized (
    select mapping.resolved_id,mapping.type_id
    from public.resolve_uin_card_targets_v143(
      coalesce((select array_agg(target_id) from requested),array[]::uuid[])
    ) mapping
  ), people as materialized (
    select projection.*
    from public.get_uin_card_people_projection_v143(
      coalesce((select array_agg(target_id) from requested),array[]::uuid[])
    ) projection
  ), people_stats as materialized (
    select people.requested_id,
      count(distinct people.user_id) filter(where people.relationship_status='want')::integer wanting,
      count(distinct people.user_id) filter(where people.relationship_status='completed')::integer done
    from people
    group by people.requested_id
  ), events as materialized (
    select projection.*
    from public.get_uin_card_event_projection_v143(
      coalesce((select array_agg(target_id) from requested),array[]::uuid[])
    ) projection
  ), event_stats as materialized (
    select events.requested_id,
      count(distinct events.resource_id) filter(where events.event_state='active')::integer active,
      count(distinct events.resource_id) filter(where events.event_state='completed')::integer completed,
      count(distinct events.resource_id) filter(where events.event_state='expired')::integer expired,
      count(distinct events.resource_id) filter(where events.event_state='cancelled')::integer cancelled
    from events
    group by events.requested_id
  ), child_stats as materialized (
    select closure.requested_id,
      count(*) filter(where closure.depth>0)::integer child_count
    from public.get_uin_card_structural_closure_v143(
      coalesce((select array_agg(target_id) from requested),array[]::uuid[])
    ) closure
    group by closure.requested_id
  )
  select jsonb_build_object(
    'target_id',target.id,
    'wanting',coalesce(people_stats.wanting,0),
    'done',coalesce(people_stats.done,0),
    'active',coalesce(event_stats.active,0),
    'completed',coalesce(event_stats.completed,0),
    'expired',coalesce(event_stats.expired,0),
    'cancelled',coalesce(event_stats.cancelled,0),
    'type_id',coalesce(types.type_id,'activity'),
    'creator_name',target.creator_name,
    'editorial_cover_url',target.editorial_cover_url,
    'child_count',coalesce(child_stats.child_count,0)
  )
  from requested
  join public.canonical_targets target on target.id=requested.target_id
  left join types on types.resolved_id=target.id
  left join people_stats on people_stats.requested_id=target.id
  left join event_stats on event_stats.requested_id=target.id
  left join child_stats on child_stats.requested_id=target.id;
$function$;

-- Old public RPC names remain available, but both now delegate to the same
-- canonical summary implementation.
create or replace function public.get_uin_card_summary_v107(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select summary
  from public.get_uin_card_summary_v143(p_target_ids) summary;
$function$;

create or replace function public.get_uin_card_summary_v129(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select summary
  from public.get_uin_card_summary_v143(p_target_ids) summary;
$function$;

-- Category badges count cards, not catalogue source rows. A canonical target
-- can legitimately have more than one active source row, so row counts made
-- the category total larger than the number of cards the user could open.
create or replace function public.get_uin_category_counts_v129()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with base_counts as materialized (
    select case when item.item_kind='video' then 'series' else item.item_kind end type_id,
      count(distinct item.canonical_target_id) item_count
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active' and item.canonical_target_id is not null
      and coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
      and (public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false)
    group by 1
  ), metadata_counts as materialized (
    select item.metadata->>'content_type_id' type_id,
      count(distinct item.canonical_target_id) item_count
    from public.seed_catalog_items item
    join public.canonical_targets target on target.id=item.canonical_target_id
    where item.status='active' and item.canonical_target_id is not null
      and coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
      and item.metadata ? 'content_type_id'
      and (public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false)
    group by 1
  ), place_count as materialized (
    select coalesce((public.get_global_place_counts_v122()->>'cities')::bigint,0) item_count
  )
  select coalesce(jsonb_object_agg(type.id,
    case
      when type.base_kind='place' then place_count.item_count
      when type.id=type.base_kind then coalesce(base.item_count,0)
      else coalesce(metadata.item_count,0)
    end
  ),'{}'::jsonb)
  from public.uin_content_types type
  cross join place_count
  left join base_counts base on base.type_id=type.base_kind
  left join metadata_counts metadata on metadata.type_id=type.id
  where type.active;
$function$;

-- Catalogue cards use aggregate closure metrics, but viewer actions are direct
-- membership on the resolved identity set only. Looking through aliases fixes
-- legacy place cards without making a child wish become an ancestor wish.
create or replace function public.get_uin_catalogue_for_targets_v123(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with requested as materialized (
    select input.id,public.resolve_uin_card_target_v129(input.id) resolved_id,input.position
    from unnest(coalesce(p_target_ids,array[]::uuid[])) with ordinality input(id,position)
  ), summaries as materialized (
    select value row
    from public.get_uin_card_summary_v143(coalesce(p_target_ids,array[]::uuid[])) value
  ), identities as materialized (
    select distinct requested.resolved_id,identity.target_id
    from requested
    cross join lateral public.get_uin_card_identity_aliases_v143(requested.resolved_id) identity
  )
  select jsonb_build_object(
    'canonical_target_id',target.id,
    'canonical_kind',target.kind,
    'source_seed_id',null,
    'title',target.title,
    'subtitle',coalesce(summary.row->>'creator_name',target.creator_name,community.name),
    'seed_type_name',coalesce(seed_type.name,category.name),
    'seed_type_slug',coalesce(nullif(target.editorial_metadata->>'action_key',''),case when target.kind='live_match' then 'sport-live' else seed_type.slug end),
    'seed_type_icon',coalesce(nullif(target.editorial_metadata->>'display_icon',''),case when target.kind='live_match' then '🏟️' else coalesce(seed_type.icon,'🌱') end),
    'subject_type',nullif(target.editorial_metadata->>'subject_type',''),
    'item_kind',coalesce(catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'activity'),
    'content_type_id',coalesce(summary.row->>'type_id',catalogue.metadata->>'content_type_id',catalogue.item_kind,nullif(target.editorial_metadata->>'item_kind',''),'activity'),
    'primary_category_id',coalesce(catalogue.primary_category_id,target.primary_category_id),
    'cover_url',coalesce(target.editorial_cover_url,catalogue.cover_url,activity.default_cover_url,category.default_cover_url),
    'catalog_cover_url',catalogue.cover_url,
    'own_seed_id',own_seed.id,
    'own_seed_status',own_seed.status,
    'own_common_intent_id',own_personal.id,
    'intent_people_count',coalesce((summary.row->>'wanting')::integer,0),
    'experience_people_count',coalesce((summary.row->>'done')::integer,0),
    'active_event_count',coalesce((summary.row->>'active')::integer,0),
    'social_intent_count',coalesce((summary.row->>'active')::integer,0),
    'completed_event_count',coalesce((summary.row->>'completed')::integer,0),
    'expired_event_count',coalesce((summary.row->>'expired')::integer,0),
    'cancelled_event_count',coalesce((summary.row->>'cancelled')::integer,0),
    'child_count',coalesce((summary.row->>'child_count')::integer,0),
    'activity_id',target.activity_id,
    'sport_name',sport.name,
    'community_name',community.name,
    'updated_at',coalesce(catalogue.updated_at,target.updated_at)
  )
  from requested
  join public.canonical_targets target on target.id=requested.id
  left join summaries summary on (summary.row->>'target_id')::uuid=requested.resolved_id
  left join public.activities activity on activity.id=target.activity_id
  left join public.activity_categories category on category.id=activity.category_id
  left join public.sports sport on sport.id=target.sport_id
  left join public.communities community on community.id=target.primary_community_id
  left join lateral (
    select item.*
    from public.seed_catalog_items item
    where item.canonical_target_id=target.id and item.status='active'
    order by item.updated_at desc,item.id
    limit 1
  ) catalogue on true
  left join public.seed_types seed_type on seed_type.id=catalogue.seed_type_id
  left join lateral (
    select seed.id,seed.status
    from identities identity
    join public.seeds seed on seed.canonical_target_id=identity.target_id
    where identity.resolved_id=requested.resolved_id
      and seed.user_id=auth.uid()
      and seed.status in('active','completed')
    order by case seed.status when 'active' then 0 else 1 end,seed.updated_at desc,seed.id
    limit 1
  ) own_seed on true
  left join lateral (
    select personal.id
    from identities identity
    join public.canonical_personal_intents_v38 personal on personal.target_id=identity.target_id
    where identity.resolved_id=requested.resolved_id
      and personal.user_id=auth.uid()
      and personal.status='active'
    order by personal.updated_at desc,personal.id
    limit 1
  ) own_personal on true
  where public.is_admin() or coalesce((target.editorial_metadata->>'admin_hidden')::boolean,false)=false
  order by requested.position;
$function$;

revoke all on function
  public.get_uin_card_identity_aliases_v143(uuid),
  public.resolve_uin_card_targets_v143(uuid[]),
  public.get_uin_card_parent_edges_v143(uuid[]),
  public.get_uin_card_closure_v143(uuid[],boolean),
  public.get_uin_card_people_projection_v143(uuid[]),
  public.get_uin_card_event_projection_v143(uuid[]),
  public.get_uin_card_summary_v143(uuid[]),
  public.get_uin_card_descendants_v81(uuid,boolean),
  public.get_uin_card_visible_children_v137(uuid),
  public.get_uin_card_structural_closure_v143(uuid[]),
  public.get_uin_card_visible_descendant_count_v137(uuid),
  public.get_uin_card_people_v81(uuid,text,integer,integer),
  public.get_uin_card_events_v81(uuid),
  public.get_uin_card_summary_v107(uuid[]),
  public.get_uin_card_summary_v129(uuid[]),
  public.get_uin_category_counts_v129(),
  public.get_uin_catalogue_for_targets_v123(uuid[])
from public;

grant execute on function
  public.resolve_uin_card_targets_v143(uuid[]),
  public.get_uin_card_parent_edges_v143(uuid[]),
  public.get_uin_card_closure_v143(uuid[],boolean),
  public.get_uin_card_summary_v143(uuid[]),
  public.get_uin_card_descendants_v81(uuid,boolean),
  public.get_uin_card_people_v81(uuid,text,integer,integer),
  public.get_uin_card_events_v81(uuid),
  public.get_uin_card_summary_v107(uuid[]),
  public.get_uin_card_summary_v129(uuid[]),
  public.get_uin_category_counts_v129(),
  public.get_uin_catalogue_for_targets_v123(uuid[])
to anon,authenticated;

notify pgrst,'reload schema';
commit;
