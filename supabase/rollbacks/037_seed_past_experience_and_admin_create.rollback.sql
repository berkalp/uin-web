begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

drop function if exists public.get_my_seed_v2(uuid);
drop function if exists public.get_my_seeds_v2(text);

create or replace function public.get_my_seeds_v2(
  p_status text default null
)
returns table(
  seed_id uuid,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  notes text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  links jsonb,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed.seed_type_id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed.title,
    seed.subtitle,
    seed.notes,
    seed.cover_url,
    seed.visibility,
    seed.status,
    seed.target_date,
    seed.completed_at,
    seed.archived_at,
    seed.created_at,
    seed.updated_at,
    coalesce(link_bundle.links, '[]'::jsonb),
    coalesce(intent_count.total, 0)::bigint,
    coalesce(journal_count.total, 0)::bigint,
    reflection.key_takeaway
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join lateral (
    select jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', link.id,
          'url', link.url,
          'label', link.label,
          'description', link.metadata ->> 'description',
          'kind', coalesce(link.metadata ->> 'kind', link.provider, 'resource'),
          'sort_order', link.sort_order
        )
      ) order by link.sort_order, link.created_at, link.id
    ) as links
    from public.seed_links link
    where link.seed_id = seed.id
  ) link_bundle on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    where seed_intent.seed_id = seed.id
  ) intent_count on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
  ) journal_count on true
  left join lateral (
    select entry.key_takeaway
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and entry.entry_kind = 'reflection'
    limit 1
  ) reflection on true
  where seed.user_id = auth.uid()
    and (p_status is null or seed.status = p_status)
  order by
    case seed.status when 'active' then 0 when 'completed' then 1 else 2 end,
    seed.updated_at desc,
    seed.id;
$$;

create or replace function public.get_my_seed_v2(p_seed_id uuid)
returns table(
  seed_id uuid,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  notes text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  links jsonb,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.get_my_seeds_v2(null)
  where seed_id = p_seed_id
  limit 1;
$$;

create or replace function public.get_visible_seed_detail(p_seed_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seed public.seeds%rowtype;
  v_result jsonb;
begin
  select seed.* into v_seed
  from public.seeds seed
  where seed.id = p_seed_id;

  if v_seed.id is null then
    return null;
  end if;

  if v_seed.status = 'archived' and v_seed.user_id <> auth.uid() then
    return null;
  end if;

  if not public.seed_is_visible_to_viewer(v_seed.user_id, v_seed.visibility, auth.uid()) then
    return null;
  end if;

  select jsonb_build_object(
    'seed', jsonb_build_object(
      'seed_id', seed.id,
      'seed_type_id', seed.seed_type_id,
      'seed_type_name', seed_type.name,
      'seed_type_slug', seed_type.slug,
      'seed_type_icon', seed_type.icon,
      'title', seed.title,
      'subtitle', seed.subtitle,
      'notes', seed.notes,
      'cover_url', seed.cover_url,
      'visibility', seed.visibility,
      'status', seed.status,
      'target_date', seed.target_date,
      'completed_at', seed.completed_at,
      'archived_at', seed.archived_at,
      'created_at', seed.created_at,
      'updated_at', seed.updated_at,
      'is_owner', seed.user_id = auth.uid(),
      'owner_user_id', profile.id,
      'owner_full_name', profile.full_name,
      'owner_username', profile.username,
      'owner_avatar_url', profile.avatar_url
    ),
    'links', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', link.id,
            'url', link.url,
            'label', link.label,
            'description', link.metadata ->> 'description',
            'kind', coalesce(link.metadata ->> 'kind', link.provider, 'resource'),
            'sort_order', link.sort_order
          )
        ) order by link.sort_order, link.created_at, link.id
      )
      from public.seed_links link
      where link.seed_id = seed.id
    ), '[]'::jsonb),
    'journal', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', entry.id,
          'entry_kind', entry.entry_kind,
          'body', entry.body,
          'key_takeaway', entry.key_takeaway,
          'attachments', entry.attachments,
          'visibility', entry.visibility,
          'occurred_on', entry.occurred_on,
          'created_at', entry.created_at,
          'updated_at', entry.updated_at
        ) order by entry.occurred_on desc, entry.created_at desc, entry.id desc
      )
      from public.seed_journal_entries entry
      where entry.seed_id = seed.id
        and (
          seed.user_id = auth.uid()
          or public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
        )
    ), '[]'::jsonb),
    'intents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'intent_id', intent.id,
          'activity_name', activity.name,
          'status', intent.status,
          'relationship', seed_intent.relationship,
          'created_at', seed_intent.created_at
        ) order by seed_intent.created_at desc, seed_intent.id desc
      )
      from public.seed_intent_links seed_intent
      join public.intents intent on intent.id = seed_intent.intent_id
      left join public.activities activity on activity.id = intent.activity_id
      where seed_intent.seed_id = seed.id
        and public.can_user_view_intent_activity(intent.id, auth.uid())
    ), '[]'::jsonb)
  ) into v_result
  from public.seeds seed
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  join public.profiles profile on profile.id = seed.user_id
  where seed.id = p_seed_id;

  return v_result;
end;
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
      or (item.status = 'pending' and auth.uid() is not null)
    );

  return v_result;
end;
$$;

create or replace function public.complete_my_seed_with_reflection(
  p_seed_id uuid,
  p_completed_on date default current_date,
  p_reflection text default null,
  p_key_takeaway text default null,
  p_visibility text default 'only_me',
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_content boolean;
  v_attachments jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to complete a Seed.';
  end if;

  update public.seeds seed
  set
    status = 'completed',
    completed_at = (coalesce(p_completed_on, current_date)::timestamp at time zone 'UTC'),
    archived_at = null,
    updated_at = now()
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  if not found then
    raise exception 'Seed not found or cannot be completed.';
  end if;

  v_attachments := public.normalize_seed_journal_attachments(p_attachments);

  v_has_content :=
    nullif(btrim(coalesce(p_reflection, '')), '') is not null
    or nullif(btrim(coalesce(p_key_takeaway, '')), '') is not null
    or jsonb_array_length(v_attachments) > 0;

  if v_has_content then
    perform public.save_my_seed_journal_entry(
      p_seed_id,
      null,
      'reflection',
      p_reflection,
      p_key_takeaway,
      p_visibility,
      coalesce(p_completed_on, current_date),
      v_attachments
    );
  end if;

  return p_seed_id;
end;
$$;

drop function if exists public.complete_my_seed_with_reflection_v2(
  uuid, date, text, integer, text, text, text, jsonb
);
drop function if exists public.add_past_seed_experience_from_catalog(
  uuid, date, text, integer, text, text, text
);
drop function if exists public.admin_create_seed_catalog_item(
  uuid, text, text, text, text, integer, text, text, text[]
);

alter table public.seeds
  drop constraint if exists seeds_origin_check,
  drop constraint if exists seeds_completed_date_precision_check,
  drop constraint if exists seeds_completed_year_check;

alter table public.seeds
  drop column if exists origin,
  drop column if exists completed_date_precision,
  drop column if exists completed_year;

grant execute on function public.get_my_seeds_v2(text) to authenticated;
grant execute on function public.get_my_seed_v2(uuid) to authenticated;
grant execute on function public.get_visible_seed_detail(uuid) to anon, authenticated;
grant execute on function public.get_seed_catalog_detail(uuid) to anon, authenticated;
grant execute on function public.complete_my_seed_with_reflection(
  uuid, date, text, text, text, jsonb
) to authenticated;

commit;
