begin;
set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

-- Web core v80: a personal intent is distinct from membership in a social plan.
-- The legacy visible_common_target_people_v38 function remains untouched for older
-- clients; web screens use these canonical projections.
create or replace function public.get_uin_card_people_v80(
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
  with candidates as materialized (
    select p.*
    from public.visible_common_target_people_v38() p
    where p.target_id = p_target_id
      and p.source_kind in ('seed', 'personal')
      and (
        p.relationship_status = 'completed'
        or (
          p.relationship_status = 'want'
          and (p.target_date is null or p.target_date >= (now() at time zone 'Europe/Istanbul')::date)
        )
      )
  ), ranked as (
    select c.*,
      row_number() over (
        partition by c.user_id
        order by
          case when c.relationship_status = 'completed' then 0 else 1 end,
          case c.source_kind when 'seed' then 0 else 1 end,
          c.target_date desc nulls last,
          c.source_id
      ) as rn
    from candidates c
  ), selected as (
    select *
    from ranked
    where rn = 1
      and relationship_status = case when p_group = 'experience' then 'completed' else 'want' end
  )
  select jsonb_build_object(
    'kind', 'personal',
    'id', s.source_id,
    'user_id', s.user_id,
    'full_name', coalesce(profile.full_name, profile.username, 'UIN üyesi'),
    'username', profile.username,
    'avatar_url', profile.avatar_url,
    'seed_id', case when s.source_kind = 'seed' then s.source_id end,
    'source_kind', s.source_kind,
    'source_id', s.source_id,
    'target_date', s.target_date,
    'start_date', case when s.source_kind = 'personal' then personal.start_date else seed.target_date end,
    'end_date', case when s.source_kind = 'personal' then personal.end_date else seed.target_date end,
    'timing_precision', case when s.source_kind = 'personal' then personal.timing_precision else 'day' end,
    'date_options', case when s.source_kind = 'personal' then personal.date_options else '[]'::jsonb end,
    'notes', case when s.source_kind = 'personal' then personal.notes else null end,
    'visibility', case when s.source_kind = 'personal' then personal.visibility else seed.visibility end,
    'location_id', location.id,
    'location', nullif(concat_ws(', ', nullif(location.district, ''), nullif(location.city, ''), nullif(location.country_name, '')), ''),
    'location_scope', location.scope,
    'latitude', location.latitude,
    'longitude', location.longitude,
    'rating', case when s.source_kind = 'seed' then personal_state.rating end,
    'experience_date', case when s.source_kind = 'seed' then coalesce(personal_state.experience_date, seed.completed_at::date) end,
    'experience_year', case when s.source_kind = 'seed' then personal_state.experience_year end,
    'experience_text', case when s.source_kind = 'seed' then reflection.body end,
    'comment_count', case when s.source_kind = 'seed' then (
      select count(*) from public.seed_experience_comments comment
      where comment.seed_id = seed.id and comment.deleted_at is null
    ) else 0 end,
    'total_count', count(*) over()
  )
  from selected s
  join public.profiles profile on profile.id = s.user_id
  left join public.seeds seed on seed.id = s.source_id and s.source_kind = 'seed'
  left join public.canonical_personal_intents_v38 personal on personal.id = s.source_id and s.source_kind = 'personal'
  left join public.locations location on location.id = personal.location_id
  left join public.seed_personal_state_v15 personal_state
    on personal_state.seed_id = seed.id and personal_state.user_id = s.user_id
  left join lateral (
    select journal.body
    from public.seed_journal_entries journal
    where journal.seed_id = seed.id
      and journal.entry_kind = 'reflection'
      and public.seed_is_visible_to_viewer(s.user_id, journal.visibility, auth.uid())
    order by journal.occurred_on desc, journal.created_at desc
    limit 1
  ) reflection on true
  order by
    case when s.user_id = auth.uid() then 0 else 1 end,
    s.target_date nulls last,
    s.user_id
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_uin_card_events_v80(p_target_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as materialized (
    select distinct intent.id as intent_id
    from public.intents intent
    left join public.seed_intent_links seed_link on seed_link.intent_id = intent.id
    left join public.seeds seed on seed.id = seed_link.seed_id
    left join public.seed_catalog_items item on item.id = seed.catalog_item_id
    where intent.canonical_target_id = p_target_id
       or coalesce(seed.canonical_target_id, item.canonical_target_id) = p_target_id
  ), rows as (
    select
      intent.*,
      location.district,
      location.city,
      location.country_name,
      linked_plan.plan_id,
      linked_plan.plan_status,
      linked_plan.scheduled_start,
      linked_plan.scheduled_end,
      case
        when coalesce(intent.status, '') in ('cancelled', 'canceled')
          or coalesce(linked_plan.plan_status, '') in ('cancelled', 'canceled') then 'cancelled'
        when coalesce(intent.status, '') = 'completed'
          or coalesce(linked_plan.plan_status, '') = 'completed' then 'completed'
        when coalesce(
          linked_plan.scheduled_end::date,
          intent.end_date,
          linked_plan.scheduled_start::date,
          intent.start_date
        ) < (now() at time zone 'Europe/Istanbul')::date then 'expired'
        else 'active'
      end as event_state
    from linked
    join public.intents intent on intent.id = linked.intent_id
    left join public.locations location on location.id = intent.location_id
    left join lateral (
      select plan.id as plan_id, plan.status as plan_status, plan.scheduled_start, plan.scheduled_end
      from public.plan_intents plan_link
      join public.plans plan on plan.id = plan_link.plan_id
      where plan_link.intent_id = intent.id
        and plan_link.status = 'active'
      order by plan_link.linked_at desc
      limit 1
    ) linked_plan on true
    where intent.status in ('active', 'planned', 'completed', 'cancelled', 'canceled')
      and public.intent_is_visible_to_viewer_v38(intent.id, auth.uid())
  )
  select jsonb_build_object(
    'target_id', p_target_id,
    'intent_id', row.id,
    'plan_id', row.plan_id,
    'resource_id', coalesce(row.plan_id, row.id),
    'subtitle', row.common_intent_subtitle,
    'start_date', row.start_date,
    'end_date', row.end_date,
    'visibility', row.visibility,
    'status', row.status,
    'plan_status', row.plan_status,
    'event_state', row.event_state,
    'location', nullif(concat_ws(', ', nullif(row.district, ''), nullif(row.city, ''), nullif(row.country_name, '')), ''),
    'owner_user_id', row.user_id,
    'owner_name', coalesce(profile.full_name, profile.username, 'UIN üyesi'),
    'owner_username', profile.username,
    'owner_avatar_url', profile.avatar_url,
    'participant_count', 1 + (
      select count(*) from public.intent_participants participant
      where participant.intent_id = row.id and participant.status = 'active' and participant.user_id <> row.user_id
    ),
    'participants', jsonb_build_array(jsonb_build_object(
      'user_id', row.user_id,
      'full_name', coalesce(profile.full_name, profile.username, 'UIN üyesi'),
      'username', profile.username,
      'avatar_url', profile.avatar_url,
      'role', 'owner'
    )) || coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', member.id,
        'full_name', coalesce(member.full_name, member.username, 'UIN üyesi'),
        'username', member.username,
        'avatar_url', member.avatar_url,
        'role', 'participant'
      ) order by participant.joined_at)
      from public.intent_participants participant
      join public.profiles member on member.id = participant.user_id
      where participant.intent_id = row.id
        and participant.status = 'active'
        and participant.user_id <> row.user_id
    ), '[]'::jsonb),
    'max_participants', row.max_participants,
    'viewer_is_owner', row.user_id = auth.uid(),
    'viewer_is_member', row.user_id = auth.uid() or exists (
      select 1 from public.intent_participants participant
      where participant.intent_id = row.id
        and participant.user_id = auth.uid()
        and participant.status = 'active'
    )
  )
  from rows row
  join public.profiles profile on profile.id = row.user_id
  order by
    case row.event_state when 'active' then 0 when 'completed' then 1 when 'expired' then 2 else 3 end,
    case when row.event_state = 'active' then row.start_date end,
    row.end_date desc,
    row.id;
$$;

create or replace function public.get_uin_card_summary_v80(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested as (
    select distinct value as target_id
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value
  ), people as materialized (
    select requested.target_id, person
    from requested
    cross join lateral public.get_uin_card_people_v80(requested.target_id, 'intent', 100, 0) person
    union all
    select requested.target_id, person
    from requested
    cross join lateral public.get_uin_card_people_v80(requested.target_id, 'experience', 100, 0) person
  ), people_stats as (
    select target_id,
      count(*) filter (where person->>'source_id' is not null and person->>'experience_date' is null and person->>'experience_year' is null and person->>'rating' is null and person->>'experience_text' is null) as wanting_fallback,
      count(*) filter (where person->>'experience_date' is not null or person->>'experience_year' is not null or person->>'rating' is not null or person->>'experience_text' is not null) as done_fallback
    from people
    group by target_id
  ), canonical_people as (
    select p.target_id,
      count(*) filter (where p.relationship_status = 'want') as wanting,
      count(*) filter (where p.relationship_status = 'completed') as done
    from (
      select distinct on (raw.target_id, raw.user_id)
        raw.target_id, raw.user_id, raw.relationship_status
      from public.visible_common_target_people_v38() raw
      where raw.target_id = any(coalesce(p_target_ids, array[]::uuid[]))
        and raw.source_kind in ('seed', 'personal')
        and (
          raw.relationship_status = 'completed'
          or (
            raw.relationship_status = 'want'
            and (raw.target_date is null or raw.target_date >= (now() at time zone 'Europe/Istanbul')::date)
          )
        )
      order by raw.target_id, raw.user_id,
        case when raw.relationship_status = 'completed' then 0 else 1 end,
        case raw.source_kind when 'seed' then 0 else 1 end
    ) p
    group by p.target_id
  ), event_stats as (
    select requested.target_id,
      count(*) filter (where event->>'event_state' = 'active') as active,
      count(*) filter (where event->>'event_state' = 'completed') as completed,
      count(*) filter (where event->>'event_state' = 'expired') as expired,
      count(*) filter (where event->>'event_state' = 'cancelled') as cancelled
    from requested
    left join lateral public.get_uin_card_events_v80(requested.target_id) event on true
    group by requested.target_id
  )
  select jsonb_build_object(
    'target_id', target.id,
    'wanting', coalesce(person_stats.wanting, 0),
    'done', coalesce(person_stats.done, 0),
    'active', coalesce(event_stats.active, 0),
    'completed', coalesce(event_stats.completed, 0),
    'expired', coalesce(event_stats.expired, 0),
    'cancelled', coalesce(event_stats.cancelled, 0),
    'type_id', target.editorial_metadata->>'content_type_id',
    'creator_name', target.creator_name,
    'editorial_cover_url', target.editorial_cover_url
  )
  from requested
  join public.canonical_targets target on target.id = requested.target_id
  left join canonical_people person_stats on person_stats.target_id = target.id
  left join event_stats on event_stats.target_id = target.id;
$$;

-- Compatibility wrappers keep existing web/mobile callers on the corrected source.
create or replace function public.get_uin_card_summary_v55(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.get_uin_card_summary_v80(p_target_ids);
$$;

create or replace function public.get_uin_card_active_counts_v33(p_target_ids uuid[])
returns table(target_id uuid, active bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (summary->>'target_id')::uuid, (summary->>'active')::bigint
  from public.get_uin_card_summary_v80(p_target_ids) summary;
$$;

create or replace function public.get_common_target_social_intents_v38(p_target_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.get_uin_card_events_v80(p_target_id);
$$;

-- ISBN family extraction supports edition-aware book identity checks.
create or replace function public.canonical_isbn_family_v80(p_metadata jsonb)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(array_agg(distinct normalized) filter (where length(normalized) in (10, 13)), array[]::text[])
  from (
    select upper(regexp_replace(match[1], '[^0-9Xx]', '', 'g')) as normalized
    from regexp_matches(coalesce(p_metadata::text, ''), '([0-9Xx][0-9Xx -]{8,20}[0-9Xx])', 'g') match
  ) values_found;
$$;

create or replace function public.add_verified_seed_catalog_item_v42(
  p_seed_type_id uuid,
  p_item_kind text,
  p_canonical_title text,
  p_creator_name text default null,
  p_cover_url text default null,
  p_provider text default null,
  p_external_id text default null,
  p_source_url text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(catalog_item_id uuid, canonical_target_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item uuid;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_external text := btrim(coalesce(p_external_id, ''));
  v_normalized_title text := public.canonical_normalize_v31(p_canonical_title);
  v_normalized_creator text := public.canonical_normalize_v31(p_creator_name);
  v_is_book boolean := lower(coalesce(p_item_kind, '')) = 'book';
  v_isbns text[] := public.canonical_isbn_family_v80(coalesce(p_metadata, '{}'::jsonb));
begin
  if auth.uid() is null then
    raise exception 'Konu eklemek için giriş yapmalısın.' using errcode = '42501';
  end if;
  if v_provider not in ('spotify', 'google_books', 'tvmaze', 'igdb', 'wikidata') or v_external = '' then
    raise exception 'Doğrulanmış kaynak bilgisi eksik.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.seed_types where id = p_seed_type_id and is_active) then
    raise exception 'Geçerli bir konu eylemi seç.' using errcode = '23503';
  end if;

  select exists(
    select 1 from public.seed_types
    where id = p_seed_type_id and slug in ('read', 'book', 'oku')
  ) or v_is_book into v_is_book;

  perform pg_advisory_xact_lock(hashtextextended(
    p_seed_type_id::text || ':' || v_provider || ':' || v_external || ':' ||
    v_normalized_title || ':' || v_normalized_creator, 0
  ));

  select item.id into v_item
  from public.seed_catalog_items item
  where item.seed_type_id = p_seed_type_id
    and item.status in ('active', 'pending', 'approved')
    and (
      (lower(coalesce(item.external_source, item.metadata->>'source_provider', '')) = v_provider
        and coalesce(item.external_id, item.metadata->>'source_external_id', '') = v_external)
      or (
        v_is_book
        and cardinality(v_isbns) > 0
        and public.canonical_isbn_family_v80(coalesce(item.metadata, '{}'::jsonb)) && v_isbns
      )
      or (
        v_is_book
        and v_normalized_creator <> ''
        and public.canonical_normalize_v31(item.canonical_title) = v_normalized_title
        and public.canonical_normalize_v31(item.creator_name) = v_normalized_creator
      )
      or (
        not v_is_book
        and public.canonical_normalize_v31(item.canonical_title) = v_normalized_title
      )
    )
  order by
    case
      when lower(coalesce(item.external_source, item.metadata->>'source_provider', '')) = v_provider
        and coalesce(item.external_id, item.metadata->>'source_external_id', '') = v_external then 0
      when v_is_book and cardinality(v_isbns) > 0
        and public.canonical_isbn_family_v80(coalesce(item.metadata, '{}'::jsonb)) && v_isbns then 1
      else 2
    end,
    case item.status when 'active' then 0 when 'approved' then 1 else 2 end,
    item.created_at,
    item.id
  limit 1;

  if v_item is null then
    v_item := public.suggest_seed_catalog_item(
      p_seed_type_id,
      p_item_kind,
      btrim(p_canonical_title),
      nullif(btrim(p_creator_name), ''),
      null,
      null,
      nullif(btrim(p_cover_url), ''),
      'tr',
      coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('source_provider', v_provider, 'source_external_id', v_external)
        || case when nullif(btrim(p_source_url), '') is null
          then '{}'::jsonb
          else jsonb_build_object('reference_url', btrim(p_source_url))
        end
    );

    update public.seed_catalog_items item
    set status = 'active',
        external_source = coalesce(nullif(item.external_source, ''), v_provider),
        external_id = coalesce(nullif(item.external_id, ''), v_external),
        metadata = coalesce(item.metadata, '{}'::jsonb)
          || jsonb_build_object('source_provider', v_provider, 'source_external_id', v_external)
    where item.id = v_item;
  end if;

  return query
  select item.id, item.canonical_target_id
  from public.seed_catalog_items item
  where item.id = v_item;
end;
$$;

revoke all on function public.get_uin_card_people_v80(uuid, text, integer, integer),
  public.get_uin_card_events_v80(uuid),
  public.get_uin_card_summary_v80(uuid[]),
  public.canonical_isbn_family_v80(jsonb) from public, anon, authenticated;
grant execute on function public.get_uin_card_people_v80(uuid, text, integer, integer),
  public.get_uin_card_events_v80(uuid),
  public.get_uin_card_summary_v80(uuid[]) to anon, authenticated;
grant execute on function public.canonical_isbn_family_v80(jsonb) to authenticated;
revoke all on function public.add_verified_seed_catalog_item_v42(uuid, text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.add_verified_seed_catalog_item_v42(uuid, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.get_uin_card_summary_v55(uuid[]),
  public.get_uin_card_active_counts_v33(uuid[]),
  public.get_common_target_social_intents_v38(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
