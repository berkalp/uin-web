begin;
set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

-- One hierarchy contract for every UIN card. Existing place and club relations are
-- projected into this contract so older editors and histories continue to work.
update public.canonical_targets
set editorial_metadata = coalesce(editorial_metadata, '{}'::jsonb) || jsonb_build_object(
  'card_hierarchy', jsonb_strip_nulls(jsonb_build_object(
    'parent_target_id', coalesce(
      nullif(editorial_metadata->'card_hierarchy'->>'parent_target_id', ''),
      nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id', ''),
      nullif(editorial_metadata->'club_hierarchy'->>'parent_target_id', '')
    ),
    'sort_order', coalesce((editorial_metadata->'card_hierarchy'->>'sort_order')::integer, 0),
    'section_title', nullif(editorial_metadata->'card_hierarchy'->>'section_title', '')
  ))
)
where coalesce(
  nullif(editorial_metadata->'card_hierarchy'->>'parent_target_id', ''),
  nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id', ''),
  nullif(editorial_metadata->'club_hierarchy'->>'parent_target_id', '')
) is not null;

-- Preserve the known Ankara > Anıtkabir relationship even when older place
-- metadata was incomplete. The update is deliberately limited to unique visible
-- place cards with these exact Turkish titles.
with place_cards as (
  select t.id, lower(trim(t.title)) as normalized_title
  from public.canonical_targets t
  left join public.uin_content_types u on u.id = t.editorial_metadata->>'content_type_id'
  where u.base_kind = 'place'
    and coalesce(t.editorial_metadata->>'admin_hidden', 'false') <> 'true'
), ankara as (
  select (array_agg(id))[1] as id from place_cards where normalized_title = 'ankara'
  having count(*) = 1
), anitkabir as (
  select (array_agg(id))[1] as id from place_cards where normalized_title in ('anıtkabir', 'anitkabir')
  having count(*) = 1
)
update public.canonical_targets child
set editorial_metadata = coalesce(child.editorial_metadata, '{}'::jsonb) || jsonb_build_object(
  'card_hierarchy', jsonb_build_object(
    'parent_target_id', parent.id,
    'sort_order', 10,
    'section_title', 'Ankara’da keşfet'
  )
)
from ankara parent, anitkabir landmark
where child.id = landmark.id and parent.id is not null and landmark.id is not null;

create or replace function public.get_uin_card_hierarchy_v81(p_target_ids uuid[] default null)
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
set search_path = public, pg_temp
as $$
  with recursive visible as (
    select t.id,
      coalesce(
        nullif(t.editorial_metadata->'card_hierarchy'->>'parent_target_id', '')::uuid,
        nullif(t.editorial_metadata->'place_hierarchy'->>'parent_target_id', '')::uuid,
        nullif(t.editorial_metadata->'club_hierarchy'->>'parent_target_id', '')::uuid
      ) as parent_id,
      coalesce((t.editorial_metadata->'card_hierarchy'->>'sort_order')::integer, 0) as position,
      nullif(t.editorial_metadata->'card_hierarchy'->>'section_title', '') as heading
    from public.canonical_targets t
    where coalesce(t.editorial_metadata->>'admin_hidden', 'false') <> 'true' or public.is_admin()
  ), tree as (
    select v.id, v.parent_id, v.position, v.heading, 0 as level, array[v.id] as ids
    from visible v
    where v.parent_id is null
    union all
    select child.id, child.parent_id, child.position, child.heading, tree.level + 1, tree.ids || child.id
    from tree
    join visible child on child.parent_id = tree.id
    where tree.level < 12 and not child.id = any(tree.ids)
  )
  select tree.id, tree.parent_id, tree.position, tree.heading, tree.level, tree.ids
  from tree
  where p_target_ids is null or tree.id = any(p_target_ids)
  order by tree.ids, tree.position, tree.id;
$$;

create or replace function public.get_uin_card_descendants_v81(p_target_id uuid, p_include_self boolean default true)
returns table(target_id uuid, depth integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive walk as (
    select p_target_id as id, 0 as level, array[p_target_id] as visited
    union all
    select h.target_id, walk.level + 1, walk.visited || h.target_id
    from walk
    join public.get_uin_card_hierarchy_v81(null) h on h.parent_target_id = walk.id
    where walk.level < 12 and not h.target_id = any(walk.visited)
  )
  select id, level from walk where p_include_self or level > 0;
$$;

create or replace function public.admin_save_card_hierarchy_v81(
  p_target_id uuid,
  p_parent_target_id uuid default null,
  p_sort_order integer default 0,
  p_section_title text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cursor_id uuid;
  target_base text;
  parent_base text;
  visited uuid[] := array[p_target_id];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin yetkisi gerekir.' using errcode = '42501';
  end if;
  if p_sort_order < -10000 or p_sort_order > 10000 then
    raise exception 'Alt kart sırası -10000 ile 10000 arasında olmalı.';
  end if;
  if length(coalesce(p_section_title, '')) > 120 then
    raise exception 'Bölüm başlığı en fazla 120 karakter olabilir.';
  end if;
  if not exists(select 1 from public.canonical_targets where id = p_target_id) then
    raise exception 'Kart bulunamadı.';
  end if;
  if p_parent_target_id = p_target_id then
    raise exception 'Bir kart kendisine bağlanamaz.';
  end if;
  if p_parent_target_id is not null then
    select u.base_kind into target_base
    from public.canonical_targets t
    left join public.uin_content_types u on u.id = t.editorial_metadata->>'content_type_id'
    where t.id = p_target_id;
    select u.base_kind into parent_base
    from public.canonical_targets t
    left join public.uin_content_types u on u.id = t.editorial_metadata->>'content_type_id'
    where t.id = p_parent_target_id
      and coalesce(t.editorial_metadata->>'admin_hidden', 'false') <> 'true';
    if parent_base is null then raise exception 'Üst kart bulunamadı.'; end if;
    if target_base is distinct from parent_base then
      raise exception 'Üst ve alt kart aynı temel içerik türünde olmalı.';
    end if;
    cursor_id := p_parent_target_id;
    while cursor_id is not null loop
      if cursor_id = any(visited) then
        raise exception 'Bu bağlantı kartlarda döngü oluşturur.';
      end if;
      visited := array_append(visited, cursor_id);
      select coalesce(
        nullif(editorial_metadata->'card_hierarchy'->>'parent_target_id', '')::uuid,
        nullif(editorial_metadata->'place_hierarchy'->>'parent_target_id', '')::uuid,
        nullif(editorial_metadata->'club_hierarchy'->>'parent_target_id', '')::uuid
      ) into cursor_id
      from public.canonical_targets where id = cursor_id;
    end loop;
  end if;
  update public.canonical_targets
  set editorial_metadata = coalesce(editorial_metadata, '{}'::jsonb) || jsonb_build_object(
    'card_hierarchy', jsonb_strip_nulls(jsonb_build_object(
      'parent_target_id', p_parent_target_id,
      'sort_order', coalesce(p_sort_order, 0),
      'section_title', nullif(trim(coalesce(p_section_title, '')), '')
    ))
  )
  where id = p_target_id;
end;
$$;

-- Parent summaries include the parent itself and every descendant. People are
-- unique across the whole branch; events are unique by their real resource id.
create or replace function public.get_uin_card_summary_v81(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested as (
    select distinct value as requested_id
    from unnest(coalesce(p_target_ids, array[]::uuid[])) value
  ), closure as materialized (
    select requested.requested_id, descendants.target_id
    from requested
    cross join lateral public.get_uin_card_descendants_v81(requested.requested_id, true) descendants
  ), ranked_people as materialized (
    select closure.requested_id, raw.user_id, raw.relationship_status,
      row_number() over (
        partition by closure.requested_id, raw.user_id
        order by case when raw.relationship_status = 'completed' then 0 else 1 end,
          case raw.source_kind when 'seed' then 0 else 1 end,
          raw.target_date desc nulls last,
          raw.source_id
      ) as rn
    from closure
    join public.visible_common_target_people_v38() raw on raw.target_id = closure.target_id
    where raw.source_kind in ('seed', 'personal')
      and (raw.relationship_status = 'completed' or (
        raw.relationship_status = 'want'
        and (raw.target_date is null or raw.target_date >= (now() at time zone 'Europe/Istanbul')::date)
      ))
  ), people_stats as (
    select requested_id,
      count(*) filter(where rn = 1 and relationship_status = 'want') as wanting,
      count(*) filter(where rn = 1 and relationship_status = 'completed') as done
    from ranked_people group by requested_id
  ), raw_events as materialized (
    select closure.requested_id, event,
      coalesce(event->>'resource_id', event->>'plan_id', event->>'intent_id') as resource_id
    from closure
    cross join lateral public.get_uin_card_events_v80(closure.target_id) event
  ), events as (
    select distinct on (requested_id, resource_id) requested_id, event
    from raw_events
    order by requested_id, resource_id
  ), event_stats as (
    select requested_id,
      count(*) filter(where event->>'event_state' = 'active') as active,
      count(*) filter(where event->>'event_state' = 'completed') as completed,
      count(*) filter(where event->>'event_state' = 'expired') as expired,
      count(*) filter(where event->>'event_state' = 'cancelled') as cancelled
    from events group by requested_id
  )
  select jsonb_build_object(
    'target_id', target.id,
    'wanting', coalesce(people.wanting, 0),
    'done', coalesce(people.done, 0),
    'active', coalesce(events.active, 0),
    'completed', coalesce(events.completed, 0),
    'expired', coalesce(events.expired, 0),
    'cancelled', coalesce(events.cancelled, 0),
    'type_id', target.editorial_metadata->>'content_type_id',
    'creator_name', target.creator_name,
    'editorial_cover_url', target.editorial_cover_url,
    'child_count', (select count(*) from closure c where c.requested_id = target.id and c.target_id <> target.id)
  )
  from requested
  join public.canonical_targets target on target.id = requested.requested_id
  left join people_stats people on people.requested_id = target.id
  left join event_stats events on events.requested_id = target.id;
$$;

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
set search_path = public, pg_temp
as $$
  with rows as materialized (
    select descendant.target_id as source_target_id, person
    from public.get_uin_card_descendants_v81(p_target_id, true) descendant
    cross join generate_series(0, 9) page
    cross join lateral public.get_uin_card_people_v80(descendant.target_id, p_group, 100, page * 100) person
  ), ranked as (
    select rows.*,
      row_number() over (
        partition by person->>'user_id'
        order by case when person->>'source_kind' = 'seed' then 0 else 1 end,
          person->>'target_date' desc nulls last,
          person->>'source_id'
      ) as rn
    from rows
  ), selected as (
    select ranked.*, target.title as source_target_title
    from ranked
    join public.canonical_targets target on target.id = ranked.source_target_id
    where ranked.rn = 1
  )
  select (person - 'total_count') || jsonb_build_object(
    'source_target_id', source_target_id,
    'source_target_title', source_target_title,
    'total_count', count(*) over()
  )
  from selected
  order by case when person->>'user_id' = auth.uid()::text then 0 else 1 end,
    person->>'target_date' nulls last,
    person->>'user_id'
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_uin_card_events_v81(p_target_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rows as materialized (
    select descendant.target_id as source_target_id, event,
      coalesce(event->>'resource_id', event->>'plan_id', event->>'intent_id') as resource_id
    from public.get_uin_card_descendants_v81(p_target_id, true) descendant
    cross join lateral public.get_uin_card_events_v80(descendant.target_id) event
  ), selected as (
    select distinct on (rows.resource_id) rows.*, target.title as source_target_title
    from rows
    join public.canonical_targets target on target.id = rows.source_target_id
    order by rows.resource_id, case rows.event->>'event_state' when 'active' then 0 when 'completed' then 1 when 'expired' then 2 else 3 end
  )
  select event || jsonb_build_object(
    'source_target_id', source_target_id,
    'source_target_title', source_target_title
  )
  from selected
  order by case event->>'event_state' when 'active' then 0 when 'completed' then 1 when 'expired' then 2 else 3 end,
    event->>'start_date';
$$;

revoke all on function public.get_uin_card_hierarchy_v81(uuid[]),
  public.get_uin_card_descendants_v81(uuid, boolean),
  public.get_uin_card_summary_v81(uuid[]),
  public.get_uin_card_people_v81(uuid, text, integer, integer),
  public.get_uin_card_events_v81(uuid) from public;
grant execute on function public.get_uin_card_hierarchy_v81(uuid[]),
  public.get_uin_card_descendants_v81(uuid, boolean),
  public.get_uin_card_summary_v81(uuid[]),
  public.get_uin_card_people_v81(uuid, text, integer, integer),
  public.get_uin_card_events_v81(uuid) to anon, authenticated;
revoke all on function public.admin_save_card_hierarchy_v81(uuid, uuid, integer, text) from public, anon;
grant execute on function public.admin_save_card_hierarchy_v81(uuid, uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
commit;


