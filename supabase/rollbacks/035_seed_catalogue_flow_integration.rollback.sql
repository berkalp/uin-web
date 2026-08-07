begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

-- Restores the pre-integration migration 034 behaviour.

create or replace function public.search_seed_catalog(
  p_seed_type_id uuid default null,
  p_query text default null,
  p_limit integer default 24
)
returns table(
  catalog_item_id uuid,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  item_kind text,
  canonical_title text,
  original_title text,
  creator_name text,
  release_year integer,
  cover_url text,
  metadata jsonb,
  planted_count bigint,
  active_count bigint,
  completed_count bigint,
  experience_count bigint,
  viewer_has_active_seed boolean,
  viewer_seed_id uuid,
  search_score double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with input as (
    select nullif(public.normalize_seed_catalog_text(p_query), '') as normalized_query
  )
  select
    item.id,
    seed_type.id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    item.item_kind,
    item.canonical_title,
    item.original_title,
    item.creator_name,
    item.release_year,
    item.cover_url,
    item.metadata,
    coalesce(stats.planted_count, 0)::bigint,
    coalesce(stats.active_count, 0)::bigint,
    coalesce(stats.completed_count, 0)::bigint,
    coalesce(stats.experience_count, 0)::bigint,
    viewer_seed.seed_id is not null,
    viewer_seed.seed_id,
    greatest(
      case
        when input.normalized_query is null then 0
        when item.normalized_title = input.normalized_query then 1
        when alias_score.has_exact_alias then 1
        when item.normalized_title like input.normalized_query || '%' then 0.95
        else similarity(item.normalized_title, input.normalized_query)
      end,
      coalesce(alias_score.best_similarity, 0)
    )::double precision
  from public.seed_catalog_items item
  join public.seed_types seed_type
    on seed_type.id = item.seed_type_id
   and seed_type.is_active
  cross join input
  left join lateral (
    select
      bool_or(alias.normalized_alias = input.normalized_query) as has_exact_alias,
      max(
        case
          when input.normalized_query is null then 0
          else similarity(alias.normalized_alias, input.normalized_query)
        end
      ) as best_similarity,
      bool_or(
        input.normalized_query is not null
        and alias.normalized_alias like '%' || input.normalized_query || '%'
      ) as contains_query
    from public.seed_catalog_aliases alias
    where alias.catalog_item_id = item.id
  ) alias_score on true
  left join lateral (
    select
      count(*) filter (where seed.status in ('active', 'completed'))::bigint as planted_count,
      count(*) filter (where seed.status = 'active')::bigint as active_count,
      count(*) filter (where seed.status = 'completed')::bigint as completed_count,
      count(*) filter (
        where seed.status = 'completed'
          and exists (
            select 1
            from public.seed_journal_entries entry
            where entry.seed_id = seed.id
              and entry.entry_kind = 'reflection'
              and public.seed_is_visible_to_viewer(
                seed.user_id,
                entry.visibility,
                auth.uid()
              )
          )
      )::bigint as experience_count
    from public.seeds seed
    where seed.catalog_item_id = item.id
      and seed.status in ('active', 'completed')
      and public.seed_is_visible_to_viewer(
        seed.user_id,
        seed.visibility,
        auth.uid()
      )
  ) stats on true
  left join lateral (
    select seed.id as seed_id
    from public.seeds seed
    where auth.uid() is not null
      and seed.user_id = auth.uid()
      and seed.catalog_item_id = item.id
      and seed.status = 'active'
    order by seed.created_at desc, seed.id desc
    limit 1
  ) viewer_seed on true
  where (p_seed_type_id is null or item.seed_type_id = p_seed_type_id)
    and (
      item.status = 'active'
      or (
        item.status = 'pending'
        and item.created_by = auth.uid()
      )
    )
    and (
      input.normalized_query is null
      or item.normalized_title like '%' || input.normalized_query || '%'
      or coalesce(alias_score.contains_query, false)
      or similarity(item.normalized_title, input.normalized_query) >= 0.22
      or coalesce(alias_score.best_similarity, 0) >= 0.22
    )
  order by
    case
      when input.normalized_query is null then coalesce(stats.planted_count, 0)
      else null
    end desc,
    greatest(
      case
        when input.normalized_query is null then 0
        when item.normalized_title = input.normalized_query then 1
        when alias_score.has_exact_alias then 1
        when item.normalized_title like input.normalized_query || '%' then 0.95
        else similarity(item.normalized_title, input.normalized_query)
      end,
      coalesce(alias_score.best_similarity, 0)
    ) desc,
    lower(item.canonical_title),
    item.id
  limit greatest(1, least(coalesce(p_limit, 24), 60));
$$;

create or replace function public.get_seed_catalog_detail(p_catalog_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'subject', jsonb_build_object(
      'catalog_item_id', item.id,
      'seed_type_id', seed_type.id,
      'seed_type_name', seed_type.name,
      'seed_type_slug', seed_type.slug,
      'seed_type_icon', seed_type.icon,
      'item_kind', item.item_kind,
      'canonical_title', item.canonical_title,
      'original_title', item.original_title,
      'creator_name', item.creator_name,
      'release_year', item.release_year,
      'cover_url', item.cover_url,
      'language_code', item.language_code,
      'metadata', item.metadata,
      'status', item.status
    ),
    'aliases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', alias.id,
          'alias', alias.alias,
          'language_code', alias.language_code,
          'source', alias.source,
          'is_primary', alias.is_primary
        ) order by alias.is_primary desc, lower(alias.alias), alias.id
      )
      from public.seed_catalog_aliases alias
      where alias.catalog_item_id = item.id
    ), '[]'::jsonb),
    'editions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', edition.id,
          'edition_label', edition.edition_label,
          'isbn', edition.isbn,
          'publisher', edition.publisher,
          'translator', edition.translator,
          'language_code', edition.language_code,
          'publication_year', edition.publication_year,
          'format', edition.format,
          'metadata', edition.metadata
        ) order by edition.publication_year nulls last, edition.id
      )
      from public.seed_catalog_editions edition
      where edition.catalog_item_id = item.id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'planted_count', coalesce(stats.planted_count, 0),
      'active_count', coalesce(stats.active_count, 0),
      'completed_count', coalesce(stats.completed_count, 0),
      'experience_count', coalesce(stats.experience_count, 0),
      'inspired_seed_count', coalesce(stats.inspired_seed_count, 0)
    ),
    'viewer_seed', case
      when viewer_seed.seed_id is null then null
      else jsonb_build_object(
        'seed_id', viewer_seed.seed_id,
        'status', viewer_seed.status,
        'title', viewer_seed.title
      )
    end,
    'experiences', coalesce(experiences.items, '[]'::jsonb)
  ) into v_result
  from public.seed_catalog_items item
  join public.seed_types seed_type
    on seed_type.id = item.seed_type_id
  left join lateral (
    select
      count(*) filter (where seed.status in ('active', 'completed'))::bigint as planted_count,
      count(*) filter (where seed.status = 'active')::bigint as active_count,
      count(*) filter (where seed.status = 'completed')::bigint as completed_count,
      count(*) filter (
        where seed.status = 'completed'
          and exists (
            select 1
            from public.seed_journal_entries entry
            where entry.seed_id = seed.id
              and entry.entry_kind = 'reflection'
              and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
          )
      )::bigint as experience_count,
      count(*) filter (where seed.inspired_by_seed_id is not null)::bigint as inspired_seed_count
    from public.seeds seed
    where seed.catalog_item_id = item.id
      and seed.status in ('active', 'completed')
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
  ) stats on true
  left join lateral (
    select seed.id as seed_id, seed.status, seed.title
    from public.seeds seed
    where auth.uid() is not null
      and seed.user_id = auth.uid()
      and seed.catalog_item_id = item.id
    order by
      case seed.status when 'active' then 0 when 'completed' then 1 else 2 end,
      seed.updated_at desc,
      seed.id desc
    limit 1
  ) viewer_seed on true
  left join lateral (
    select jsonb_agg(experience.row_data order by experience.completed_at desc, experience.seed_id desc) as items
    from (
      select
        seed.id as seed_id,
        seed.completed_at,
        jsonb_build_object(
          'seed_id', seed.id,
          'title', seed.title,
          'completed_at', seed.completed_at,
          'owner', jsonb_build_object(
            'user_id', profile.id,
            'full_name', profile.full_name,
            'username', profile.username,
            'avatar_url', profile.avatar_url
          ),
          'reflection', jsonb_build_object(
            'entry_id', reflection.id,
            'body', reflection.body,
            'key_takeaway', reflection.key_takeaway,
            'attachments', reflection.attachments,
            'occurred_on', reflection.occurred_on
          ),
          'inspired_seed_count', (
            select count(*)::bigint
            from public.seeds inspired_seed
            where inspired_seed.inspired_by_seed_id = seed.id
          ),
          'experience_comment_policy', seed.experience_comment_policy,
          'engagement', jsonb_build_object(
            'inspired_count', (
              select count(*)::bigint
              from public.seed_reactions reaction
              where reaction.seed_id = seed.id
                and reaction.reaction_type = 'inspired'
            ),
            'viewer_saved', exists (
              select 1
              from public.seed_reactions reaction
              where reaction.seed_id = seed.id
                and reaction.user_id = auth.uid()
                and reaction.reaction_type = 'save'
            ),
            'viewer_inspired', exists (
              select 1
              from public.seed_reactions reaction
              where reaction.seed_id = seed.id
                and reaction.user_id = auth.uid()
                and reaction.reaction_type = 'inspired'
            ),
            'comment_count', (
              select count(*)::bigint
              from public.seed_experience_comments comment_record
              where comment_record.seed_id = seed.id
                and comment_record.deleted_at is null
            ),
            'viewer_can_comment', public.can_comment_on_seed_experience(
              seed.id,
              auth.uid()
            ),
            'is_owner', seed.user_id = auth.uid()
          ),
          'comments', coalesce((
            select jsonb_agg(
              comment_preview.row_data
              order by comment_preview.created_at, comment_preview.comment_id
            )
            from (
              select
                comment_record.id as comment_id,
                comment_record.created_at,
                jsonb_build_object(
                  'comment_id', comment_record.id,
                  'parent_comment_id', comment_record.parent_comment_id,
                  'comment_kind', comment_record.comment_kind,
                  'body', comment_record.body,
                  'created_at', comment_record.created_at,
                  'deleted_at', comment_record.deleted_at,
                  'author', jsonb_build_object(
                    'user_id', comment_profile.id,
                    'full_name', comment_profile.full_name,
                    'username', comment_profile.username,
                    'avatar_url', comment_profile.avatar_url
                  )
                ) as row_data
              from public.seed_experience_comments comment_record
              join public.profiles comment_profile
                on comment_profile.id = comment_record.user_id
              where comment_record.seed_id = seed.id
              order by comment_record.created_at desc, comment_record.id desc
              limit 5
            ) comment_preview
          ), '[]'::jsonb)
        ) as row_data
      from public.seeds seed
      join public.profiles profile on profile.id = seed.user_id
      join lateral (
        select entry.*
        from public.seed_journal_entries entry
        where entry.seed_id = seed.id
          and entry.entry_kind = 'reflection'
          and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
        order by entry.updated_at desc, entry.id desc
        limit 1
      ) reflection on true
      where seed.catalog_item_id = item.id
        and seed.status = 'completed'
        and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
      order by seed.completed_at desc nulls last, seed.id desc
      limit 12
    ) experience
  ) experiences on true
  where item.id = p_catalog_item_id
    and (
      item.status = 'active'
      or (item.status = 'pending' and item.created_by = auth.uid())
    );

  return v_result;
end;
$$;

create or replace function public.plant_seed_from_catalog(
  p_catalog_item_id uuid,
  p_visibility text default 'only_me',
  p_note text default null,
  p_target_date date default null,
  p_custom_title text default null,
  p_catalog_edition_id uuid default null,
  p_inspired_by_seed_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item public.seed_catalog_items%rowtype;
  v_seed_id uuid;
  v_title text;
  v_inspired_seed public.seeds%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to plant a Seed.'
      using errcode = '42501';
  end if;

  if p_visibility not in ('only_me', 'friends', 'everyone') then
    raise exception 'Invalid Seed visibility.' using errcode = '22023';
  end if;

  select item.* into v_item
  from public.seed_catalog_items item
  where item.id = p_catalog_item_id
    and (
      item.status = 'active'
      or (item.status = 'pending' and item.created_by = auth.uid())
    );

  if v_item.id is null then
    raise exception 'Seed catalogue item not found or unavailable.'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || v_item.id::text, 0)
  );

  select seed.id into v_seed_id
  from public.seeds seed
  where seed.user_id = auth.uid()
    and seed.catalog_item_id = v_item.id
    and seed.status = 'active'
  order by seed.created_at desc, seed.id desc
  limit 1;

  if v_seed_id is not null then
    return v_seed_id;
  end if;

  if p_catalog_edition_id is not null and not exists (
    select 1
    from public.seed_catalog_editions edition
    where edition.id = p_catalog_edition_id
      and edition.catalog_item_id = v_item.id
  ) then
    raise exception 'The selected edition does not belong to this subject.'
      using errcode = '23514';
  end if;

  if p_inspired_by_seed_id is not null then
    select seed.* into v_inspired_seed
    from public.seeds seed
    where seed.id = p_inspired_by_seed_id
      and seed.status = 'completed'
      and seed.catalog_item_id = v_item.id
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid());

    if v_inspired_seed.id is null then
      raise exception 'The inspiring Seed is unavailable or belongs to another subject.'
        using errcode = '23514';
    end if;
  end if;

  v_title := coalesce(nullif(btrim(p_custom_title), ''), v_item.canonical_title);

  if char_length(v_title) > 180 then
    raise exception 'Personal Seed title may not exceed 180 characters.'
      using errcode = '22023';
  end if;

  insert into public.seeds (
    user_id,
    seed_type_id,
    title,
    subtitle,
    notes,
    cover_url,
    visibility,
    status,
    target_date,
    catalog_item_id,
    catalog_edition_id,
    inspired_by_seed_id
  ) values (
    auth.uid(),
    v_item.seed_type_id,
    v_title,
    v_item.creator_name,
    nullif(btrim(p_note), ''),
    v_item.cover_url,
    p_visibility,
    'active',
    p_target_date,
    v_item.id,
    p_catalog_edition_id,
    p_inspired_by_seed_id
  ) returning id into v_seed_id;

  return v_seed_id;
end;
$$;

create or replace function public.suggest_seed_catalog_item(
  p_seed_type_id uuid,
  p_item_kind text,
  p_canonical_title text,
  p_creator_name text default null,
  p_original_title text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_language_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_title text := btrim(coalesce(p_canonical_title, ''));
  v_creator text := nullif(btrim(p_creator_name), '');
  v_normalized_title text;
  v_normalized_creator text;
  v_catalog_item_id uuid;
  v_match_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to suggest a Seed subject.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.seed_types seed_type
    where seed_type.id = p_seed_type_id and seed_type.is_active
  ) then
    raise exception 'Select an active Seed Type.' using errcode = '23503';
  end if;

  if p_item_kind not in (
    'book', 'movie', 'series', 'game', 'album', 'podcast', 'course',
    'place', 'restaurant', 'recipe', 'skill', 'challenge', 'generic'
  ) then
    raise exception 'Unsupported catalogue item kind.' using errcode = '22023';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 240 then
    raise exception 'Subject title must be between 1 and 240 characters.'
      using errcode = '22023';
  end if;

  v_normalized_title := public.normalize_seed_catalog_text(v_title);
  v_normalized_creator := public.normalize_seed_catalog_text(v_creator);

  if v_creator is not null then
    select item.id into v_catalog_item_id
    from public.seed_catalog_items item
    where item.seed_type_id = p_seed_type_id
      and item.status in ('active', 'pending')
      and item.normalized_title = v_normalized_title
      and item.normalized_creator = v_normalized_creator
    order by case item.status when 'active' then 0 else 1 end, item.created_at
    limit 1;
  else
    select count(*)::integer
    into v_match_count
    from public.seed_catalog_items item
    where item.seed_type_id = p_seed_type_id
      and item.status in ('active', 'pending')
      and item.normalized_title = v_normalized_title;

    if coalesce(v_match_count, 0) = 1 then
      select item.id
      into v_catalog_item_id
      from public.seed_catalog_items item
      where item.seed_type_id = p_seed_type_id
        and item.status in ('active', 'pending')
        and item.normalized_title = v_normalized_title
      limit 1;
    else
      v_catalog_item_id := null;
    end if;
  end if;

  if v_catalog_item_id is not null then
    insert into public.seed_catalog_aliases (
      catalog_item_id,
      alias,
      language_code,
      source,
      is_primary
    ) values (
      v_catalog_item_id,
      v_title,
      p_language_code,
      'user',
      false
    ) on conflict (catalog_item_id, normalized_alias) do nothing;

    return v_catalog_item_id;
  end if;

  insert into public.seed_catalog_items (
    seed_type_id,
    item_kind,
    canonical_title,
    original_title,
    creator_name,
    release_year,
    cover_url,
    language_code,
    metadata,
    status,
    created_by
  ) values (
    p_seed_type_id,
    p_item_kind,
    v_title,
    p_original_title,
    v_creator,
    p_release_year,
    p_cover_url,
    p_language_code,
    coalesce(p_metadata, '{}'::jsonb),
    'pending',
    auth.uid()
  ) returning id into v_catalog_item_id;

  return v_catalog_item_id;
end;
$$;

drop policy if exists seed_catalog_items_visible_select on public.seed_catalog_items;
create policy seed_catalog_items_visible_select
on public.seed_catalog_items for select
to anon, authenticated
using (
  status = 'active'
  or (status = 'pending' and created_by = auth.uid())
  or (auth.uid() is not null and public.is_admin())
);

drop policy if exists seed_catalog_aliases_visible_select on public.seed_catalog_aliases;
create policy seed_catalog_aliases_visible_select
on public.seed_catalog_aliases for select
to anon, authenticated
using (
  exists (
    select 1
    from public.seed_catalog_items item
    where item.id = seed_catalog_aliases.catalog_item_id
      and (
        item.status = 'active'
        or (item.status = 'pending' and item.created_by = auth.uid())
        or (auth.uid() is not null and public.is_admin())
      )
  )
);

drop policy if exists seed_catalog_editions_visible_select on public.seed_catalog_editions;
create policy seed_catalog_editions_visible_select
on public.seed_catalog_editions for select
to anon, authenticated
using (
  exists (
    select 1
    from public.seed_catalog_items item
    where item.id = seed_catalog_editions.catalog_item_id
      and (
        item.status = 'active'
        or (item.status = 'pending' and item.created_by = auth.uid())
        or (auth.uid() is not null and public.is_admin())
      )
  )
);

commit;
