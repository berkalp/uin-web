begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Seed ownership model
-- ---------------------------------------------------------------------------
-- library: a user's instance of a moderated shared Seed Library subject.
-- private: free-form personal thought. It is always owner-only and never
-- appears on a profile, in Library search, or in social reaction surfaces.

alter table public.seeds
  add column if not exists seed_scope text not null default 'private',
  add column if not exists private_origin_title text,
  add column if not exists library_visibility_before_review text;

update public.seeds
set seed_scope = case when catalog_item_id is null then 'private' else 'library' end;

update public.seeds
set visibility = 'only_me'
where seed_scope = 'private';

alter table public.seeds
  drop constraint if exists seeds_seed_scope_check;
alter table public.seeds
  add constraint seeds_seed_scope_check check (seed_scope in ('library', 'private'));

comment on column public.seeds.seed_scope is
  'library for a personal instance linked to a moderated Seed Library subject; private for free-form owner-only thoughts.';

comment on column public.seeds.private_origin_title is
  'Owner-only snapshot of a Private Seed title captured before it was connected to a shared Library subject.';

comment on column public.seeds.library_visibility_before_review is
  'Temporary visibility backup used while a linked shared Library subject is under moderation review.';

create or replace function public.enforce_seed_scope_and_privacy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_catalog_status text;
begin
  if new.catalog_item_id is null then
    new.seed_scope := 'private';
    new.visibility := 'only_me';
    new.catalog_edition_id := null;
    return new;
  end if;

  new.seed_scope := 'library';

  select item.status
  into v_catalog_status
  from public.seed_catalog_items item
  where item.id = new.catalog_item_id;

  -- A suggestion may be used immediately by its creator, but it stays private
  -- until the Library subject is approved.
  if v_catalog_status is distinct from 'active' then
    new.visibility := 'only_me';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_seed_scope_and_privacy_trigger on public.seeds;
create trigger enforce_seed_scope_and_privacy_trigger
before insert or update of catalog_item_id, catalog_edition_id, seed_scope, visibility
on public.seeds
for each row execute function public.enforce_seed_scope_and_privacy();

-- Keep the catalogue identity trigger from allowing pending subjects to leak
-- through a manually changed visibility.
create or replace function public.validate_seed_catalogue_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item public.seed_catalog_items%rowtype;
  v_edition_item_id uuid;
begin
  if new.catalog_item_id is null then
    if new.catalog_edition_id is not null then
      raise exception 'A Seed edition requires a catalogue item.' using errcode = '23514';
    end if;
    new.seed_scope := 'private';
    new.visibility := 'only_me';
    return new;
  end if;

  select item.* into v_item
  from public.seed_catalog_items item
  where item.id = new.catalog_item_id
    and (
      item.status = 'active'
      or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin()))
    );

  if v_item.id is null then
    raise exception 'The selected Seed Library subject is unavailable.' using errcode = '23503';
  end if;

  if new.catalog_edition_id is not null then
    select edition.catalog_item_id into v_edition_item_id
    from public.seed_catalog_editions edition
    where edition.id = new.catalog_edition_id;

    if v_edition_item_id is distinct from new.catalog_item_id then
      raise exception 'The selected edition belongs to another Library subject.' using errcode = '23514';
    end if;
  end if;

  new.seed_scope := 'library';
  new.seed_type_id := v_item.seed_type_id;
  new.title := v_item.canonical_title;
  new.subtitle := v_item.creator_name;
  new.cover_url := v_item.cover_url;

  if v_item.status <> 'active' then
    new.visibility := 'only_me';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner Seed readers with explicit scope
-- ---------------------------------------------------------------------------

drop function if exists public.get_my_seed_v2(uuid);
drop function if exists public.get_my_seeds_v2(text);

create or replace function public.get_my_seeds_v2(p_status text default null)
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
  seed_scope text,
  private_origin_title text,
  catalogue_status text,
  status text,
  target_date date,
  completed_at timestamptz,
  origin text,
  completed_date_precision text,
  completed_year integer,
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
    seed.seed_scope,
    seed.private_origin_title,
    catalog_item.status,
    seed.status,
    seed.target_date,
    seed.completed_at,
    seed.origin,
    seed.completed_date_precision,
    seed.completed_year,
    seed.archived_at,
    seed.created_at,
    seed.updated_at,
    coalesce(link_bundle.links, '[]'::jsonb),
    coalesce(intent_count.total, 0)::bigint,
    coalesce(journal_count.total, 0)::bigint,
    reflection.key_takeaway
  from public.seeds seed
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  left join public.seed_catalog_items catalog_item on catalog_item.id = seed.catalog_item_id
  left join lateral (
    select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', link.id,
        'url', link.url,
        'label', link.label,
        'description', link.metadata ->> 'description',
        'kind', coalesce(link.metadata ->> 'kind', link.provider, 'resource'),
        'sort_order', link.sort_order
      )) order by link.sort_order, link.created_at, link.id
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
    where entry.seed_id = seed.id and entry.entry_kind = 'reflection'
    order by entry.updated_at desc, entry.id desc
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
  seed_scope text,
  private_origin_title text,
  catalogue_status text,
  status text,
  target_date date,
  completed_at timestamptz,
  origin text,
  completed_date_precision text,
  completed_year integer,
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
  select * from public.get_my_seeds_v2(null)
  where seed_id = p_seed_id
  limit 1;
$$;

-- Private Seeds never appear in profile Seed panels, even to the owner looking
-- at their own public profile.
create or replace function public.get_visible_profile_seeds_v2(
  p_profile_user_id uuid,
  p_limit integer default 16
)
returns table(
  seed_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed.title,
    seed.subtitle,
    seed.cover_url,
    seed.visibility,
    seed.status,
    seed.target_date,
    seed.completed_at,
    coalesce(intent_count.total, 0)::bigint,
    coalesce(journal_count.total, 0)::bigint,
    reflection.key_takeaway,
    seed.updated_at
  from public.seeds seed
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  join public.seed_catalog_items catalog_item
    on catalog_item.id = seed.catalog_item_id and catalog_item.status = 'active'
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    join public.intents intent on intent.id = seed_intent.intent_id
    where seed_intent.seed_id = seed.id
      and public.can_user_view_intent_activity(intent.id, auth.uid())
  ) intent_count on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
  ) journal_count on true
  left join lateral (
    select entry.key_takeaway
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and entry.entry_kind = 'reflection'
      and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
    order by entry.updated_at desc, entry.id desc
    limit 1
  ) reflection on true
  where seed.user_id = p_profile_user_id
    and seed.seed_scope = 'library'
    and seed.status in ('active', 'completed')
    and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
  order by case seed.status when 'active' then 0 else 1 end,
    seed.updated_at desc, seed.id
  limit greatest(1, least(coalesce(p_limit, 16), 40));
$$;

-- Add scope to the Seed detail payload and make private access explicit.
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
  select seed.* into v_seed from public.seeds seed where seed.id = p_seed_id;

  if v_seed.id is null then return null; end if;
  if v_seed.seed_scope = 'private' and v_seed.user_id is distinct from auth.uid() then return null; end if;
  if v_seed.seed_scope = 'library'
     and v_seed.user_id is distinct from auth.uid()
     and not exists (
       select 1 from public.seed_catalog_items item
       where item.id = v_seed.catalog_item_id and item.status = 'active'
     ) then return null; end if;
  if v_seed.status = 'archived' and v_seed.user_id is distinct from auth.uid() then return null; end if;
  if not public.seed_is_visible_to_viewer(v_seed.user_id, v_seed.visibility, auth.uid()) then return null; end if;

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
      'seed_scope', seed.seed_scope,
      'private_origin_title', case when seed.user_id = auth.uid() then seed.private_origin_title else null end,
      'status', seed.status,
      'target_date', seed.target_date,
      'completed_at', seed.completed_at,
      'origin', seed.origin,
      'completed_date_precision', seed.completed_date_precision,
      'completed_year', seed.completed_year,
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
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', link.id,
        'url', link.url,
        'label', link.label,
        'description', link.metadata ->> 'description',
        'kind', coalesce(link.metadata ->> 'kind', link.provider, 'resource'),
        'sort_order', link.sort_order
      )) order by link.sort_order, link.created_at, link.id)
      from public.seed_links link where link.seed_id = seed.id
    ), '[]'::jsonb),
    'journal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entry.id,
        'entry_kind', entry.entry_kind,
        'body', entry.body,
        'key_takeaway', entry.key_takeaway,
        'attachments', entry.attachments,
        'visibility', entry.visibility,
        'occurred_on', entry.occurred_on,
        'created_at', entry.created_at,
        'updated_at', entry.updated_at
      ) order by entry.occurred_on desc, entry.created_at desc, entry.id desc)
      from public.seed_journal_entries entry
      where entry.seed_id = seed.id
        and (seed.user_id = auth.uid() or public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid()))
    ), '[]'::jsonb),
    'intents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'intent_id', intent.id,
        'activity_name', activity.name,
        'status', intent.status,
        'relationship', seed_intent.relationship,
        'created_at', seed_intent.created_at
      ) order by seed_intent.created_at desc, seed_intent.id desc)
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
  v_status text;
  v_created_by uuid;
begin
  select item.status, item.created_by
  into v_status, v_created_by
  from public.seed_catalog_items item
  where item.id = p_catalog_item_id;

  if v_status is null then
    return null;
  end if;

  if v_status = 'pending'
     and not (auth.uid() is not null and (v_created_by = auth.uid() or public.is_admin())) then
    return null;
  end if;

  if v_status not in ('active', 'pending') then
    return null;
  end if;

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
    'viewer_active_seed', (
      select jsonb_build_object(
        'seed_id', active_seed.id,
        'status', active_seed.status,
        'title', active_seed.title
      )
      from public.seeds active_seed
      where auth.uid() is not null
        and active_seed.user_id = auth.uid()
        and active_seed.catalog_item_id = item.id
        and active_seed.status = 'active'
      order by active_seed.updated_at desc, active_seed.id desc
      limit 1
    ),
    'viewer_completed_seed', (
      select jsonb_build_object(
        'seed_id', completed_seed.id,
        'status', completed_seed.status,
        'title', completed_seed.title,
        'origin', completed_seed.origin,
        'completed_date_precision', completed_seed.completed_date_precision,
        'completed_year', completed_seed.completed_year
      )
      from public.seeds completed_seed
      where auth.uid() is not null
        and completed_seed.user_id = auth.uid()
        and completed_seed.catalog_item_id = item.id
        and completed_seed.status = 'completed'
      order by completed_seed.updated_at desc, completed_seed.id desc
      limit 1
    ),
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
          'origin', seed.origin,
          'completed_date_precision', seed.completed_date_precision,
          'completed_year', seed.completed_year,
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

-- ---------------------------------------------------------------------------
-- Moderated Seed Library suggestions
-- ---------------------------------------------------------------------------
-- Pending suggestions are visible only to the creator and admins. This lets a
-- user plant immediately without publishing arbitrary text/images into UIN's
-- shared vocabulary before review.

drop function if exists public.search_seed_catalog(uuid, text, integer);
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
  catalogue_status text,
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
    item.status,
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
  join public.seed_types seed_type on seed_type.id = item.seed_type_id and seed_type.is_active
  cross join input
  left join lateral (
    select
      bool_or(alias.normalized_alias = input.normalized_query) as has_exact_alias,
      max(case when input.normalized_query is null then 0 else similarity(alias.normalized_alias, input.normalized_query) end) as best_similarity,
      bool_or(input.normalized_query is not null and alias.normalized_alias like '%' || input.normalized_query || '%') as contains_query
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
            select 1 from public.seed_journal_entries entry
            where entry.seed_id = seed.id
              and entry.entry_kind = 'reflection'
              and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
          )
      )::bigint as experience_count
    from public.seeds seed
    where seed.catalog_item_id = item.id
      and seed.seed_scope = 'library'
      and seed.status in ('active', 'completed')
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
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
      or (item.status = 'pending' and auth.uid() is not null and (item.created_by = auth.uid() or public.is_admin()))
    )
    and (
      input.normalized_query is null
      or item.normalized_title like '%' || input.normalized_query || '%'
      or coalesce(alias_score.contains_query, false)
      or similarity(item.normalized_title, input.normalized_query) >= 0.22
      or coalesce(alias_score.best_similarity, 0) >= 0.22
    )
  order by
    case when item.status = 'pending' then 1 else 0 end,
    case when input.normalized_query is null then coalesce(stats.planted_count, 0) else null end desc,
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
    lower(item.canonical_title), item.id
  limit greatest(1, least(coalesce(p_limit, 24), 60));
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

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_seed_type_id::text || ':' || v_normalized_title || ':' || coalesce(v_normalized_creator, ''),
      0
    )
  );

  if v_creator is not null then
    select item.id into v_catalog_item_id
    from public.seed_catalog_items item
    where item.seed_type_id = p_seed_type_id
      and (item.status = 'active' or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin())))
      and item.normalized_creator = v_normalized_creator
      and (
        item.normalized_title = v_normalized_title
        or exists (
          select 1
          from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias = v_normalized_title
        )
      )
    order by case item.status when 'active' then 0 else 1 end, item.created_at
    limit 1;
  else
    select count(distinct item.id)::integer
    into v_match_count
    from public.seed_catalog_items item
    where item.seed_type_id = p_seed_type_id
      and (item.status = 'active' or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin())))
      and (
        item.normalized_title = v_normalized_title
        or exists (
          select 1
          from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias = v_normalized_title
        )
      );

    if coalesce(v_match_count, 0) = 1 then
      select item.id
      into v_catalog_item_id
      from public.seed_catalog_items item
      where item.seed_type_id = p_seed_type_id
        and (item.status = 'active' or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin())))
        and (
          item.normalized_title = v_normalized_title
          or exists (
            select 1
            from public.seed_catalog_aliases alias
            where alias.catalog_item_id = item.id
              and alias.normalized_alias = v_normalized_title
          )
        )
      order by case item.status when 'active' then 0 else 1 end, item.created_at
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


-- Restrict planting pending subjects to the person who suggested them (or admin).
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
  v_inspired_seed public.seeds%rowtype;
  v_effective_visibility text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to plant a Seed.' using errcode = '42501'; end if;
  if p_visibility not in ('only_me', 'friends', 'everyone') then raise exception 'Invalid Seed visibility.' using errcode = '22023'; end if;

  select item.* into v_item
  from public.seed_catalog_items item
  where item.id = p_catalog_item_id
    and (
      item.status = 'active'
      or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin()))
    );

  if v_item.id is null then raise exception 'Seed Library subject not found or unavailable.' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || v_item.id::text, 0));

  select seed.id into v_seed_id
  from public.seeds seed
  where seed.user_id = auth.uid() and seed.catalog_item_id = v_item.id and seed.status = 'active'
  order by seed.created_at desc, seed.id desc limit 1;
  if v_seed_id is not null then return v_seed_id; end if;

  if p_catalog_edition_id is not null and not exists (
    select 1 from public.seed_catalog_editions edition
    where edition.id = p_catalog_edition_id and edition.catalog_item_id = v_item.id
  ) then raise exception 'The selected edition does not belong to this subject.' using errcode = '23514'; end if;

  if p_inspired_by_seed_id is not null then
    select seed.* into v_inspired_seed
    from public.seeds seed
    where seed.id = p_inspired_by_seed_id
      and seed.status = 'completed'
      and seed.catalog_item_id = v_item.id
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid());
    if v_inspired_seed.id is null then raise exception 'The inspiring Seed is unavailable or belongs to another subject.' using errcode = '23514'; end if;
  end if;

  v_effective_visibility := case when v_item.status = 'active' then p_visibility else 'only_me' end;

  insert into public.seeds(
    user_id, seed_type_id, title, subtitle, notes, cover_url, visibility,
    seed_scope, status, target_date, catalog_item_id, catalog_edition_id, inspired_by_seed_id
  ) values (
    auth.uid(), v_item.seed_type_id, v_item.canonical_title, v_item.creator_name,
    nullif(btrim(p_note), ''), v_item.cover_url, v_effective_visibility,
    'library', 'active', p_target_date, v_item.id, p_catalog_edition_id, p_inspired_by_seed_id
  ) returning id into v_seed_id;

  return v_seed_id;
end;
$$;

-- A private Seed can later be connected to an existing Library subject. Its
-- notes, links, journal and lineage are retained while canonical identity is
-- inherited from the Library.
create or replace function public.connect_my_private_seed_to_catalog(
  p_seed_id uuid,
  p_catalog_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.seed_catalog_items%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;

  if not exists (
    select 1 from public.seeds seed
    where seed.id = p_seed_id and seed.user_id = auth.uid() and seed.seed_scope = 'private'
  ) then raise exception 'Private Seed not found.' using errcode = 'P0002'; end if;

  select item.* into v_item
  from public.seed_catalog_items item
  where item.id = p_catalog_item_id
    and (
      item.status = 'active'
      or (item.status = 'pending' and (item.created_by = auth.uid() or public.is_admin()))
    );
  if v_item.id is null then raise exception 'Library subject unavailable.' using errcode = 'P0002'; end if;

  if exists (
    select 1 from public.seeds other_seed
    where other_seed.user_id = auth.uid()
      and other_seed.catalog_item_id = v_item.id
      and other_seed.status = 'active'
      and other_seed.id <> p_seed_id
  ) then raise exception 'You already have an active Seed for this Library subject.' using errcode = '23505'; end if;

  update public.seeds seed
  set private_origin_title = coalesce(seed.private_origin_title, seed.title),
      catalog_item_id = v_item.id, catalog_edition_id = null,
      seed_scope = 'library', visibility = 'only_me', updated_at = now()
  where seed.id = p_seed_id and seed.user_id = auth.uid();

  return p_seed_id;
end;
$$;

create or replace function public.suggest_and_connect_my_private_seed(
  p_seed_id uuid,
  p_seed_type_id uuid,
  p_item_kind text,
  p_canonical_title text,
  p_creator_name text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_reference_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_catalog_item_id uuid;
  v_metadata jsonb := '{}'::jsonb;
begin
  if not exists (
    select 1 from public.seeds seed
    where seed.id = p_seed_id and seed.user_id = auth.uid() and seed.seed_scope = 'private'
  ) then raise exception 'Private Seed not found.' using errcode = 'P0002'; end if;

  if nullif(btrim(p_reference_url), '') is not null then
    v_metadata := jsonb_build_object('reference_url', public.normalize_seed_url(p_reference_url));
  end if;

  v_catalog_item_id := public.suggest_seed_catalog_item(
    p_seed_type_id, p_item_kind, p_canonical_title, p_creator_name,
    null, p_release_year, p_cover_url, null, v_metadata
  );

  perform public.connect_my_private_seed_to_catalog(p_seed_id, v_catalog_item_id);
  return v_catalog_item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed Library subject reports
-- ---------------------------------------------------------------------------
-- User suggestions are private while pending. If an already-active canonical
-- subject is later reported, it disappears from public Library/profile surfaces
-- immediately while the report is reviewed. Personal Seed history is retained.

alter table public.seed_catalog_items
  drop constraint if exists seed_catalog_items_status_check;
alter table public.seed_catalog_items
  add constraint seed_catalog_items_status_check check (
    status in ('active', 'pending', 'under_review', 'merged', 'rejected')
  );

create table if not exists public.seed_catalog_reports (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.seed_catalog_items(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint seed_catalog_reports_reason_check check (
    reason in ('offensive', 'hate_harassment', 'sexual', 'spam', 'misleading', 'other')
  ),
  constraint seed_catalog_reports_details_check check (
    details is null or char_length(btrim(details)) between 1 and 1000
  ),
  constraint seed_catalog_reports_status_check check (status in ('open', 'resolved'))
);

create unique index if not exists seed_catalog_reports_one_open_per_reporter_idx
  on public.seed_catalog_reports(catalog_item_id, reporter_id)
  where status = 'open';
create index if not exists seed_catalog_reports_open_idx
  on public.seed_catalog_reports(status, created_at desc);

alter table public.seed_catalog_reports enable row level security;
drop policy if exists seed_catalog_reports_admin_select on public.seed_catalog_reports;
create policy seed_catalog_reports_admin_select on public.seed_catalog_reports
for select using (public.is_admin() or reporter_id = auth.uid());

create or replace function public.report_seed_catalog_item(
  p_catalog_item_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_details text := nullif(btrim(p_details), '');
  v_report_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to report a Seed Library subject.' using errcode = '42501';
  end if;
  if v_reason not in ('offensive', 'hate_harassment', 'sexual', 'spam', 'misleading', 'other') then
    raise exception 'Select a valid report reason.' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'Report details are too long.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('seed-catalog-report:' || p_catalog_item_id::text, 0));

  if not exists (
    select 1 from public.seed_catalog_items item
    where item.id = p_catalog_item_id and item.status in ('active', 'under_review')
  ) then
    raise exception 'This Library subject cannot be reported.' using errcode = 'P0002';
  end if;

  insert into public.seed_catalog_reports(catalog_item_id, reporter_id, reason, details)
  values (p_catalog_item_id, auth.uid(), v_reason, v_details)
  on conflict (catalog_item_id, reporter_id) where status = 'open'
  do update set reason = excluded.reason, details = excluded.details, created_at = now()
  returning id into v_report_id;

  update public.seeds seed
  set library_visibility_before_review = coalesce(seed.library_visibility_before_review, seed.visibility),
      visibility = 'only_me',
      updated_at = now()
  where seed.catalog_item_id = p_catalog_item_id;

  update public.seed_catalog_items item
  set status = 'under_review', reviewed_by = null, reviewed_at = null
  where item.id = p_catalog_item_id and item.status = 'active';

  return v_report_id;
end;
$$;

-- Admins may correct a reported canonical subject before restoring it.
create or replace function public.admin_update_seed_catalog_item(
  p_catalog_item_id uuid,
  p_canonical_title text,
  p_creator_name text default null,
  p_original_title text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_language_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_canonical_title, ''));
  v_creator text := nullif(btrim(p_creator_name), '');
  v_original_title text := nullif(btrim(p_original_title), '');
  v_cover_url text := public.normalize_seed_url(p_cover_url);
  v_language_code text := nullif(lower(btrim(p_language_code)), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 240 then
    raise exception 'Canonical title must be between 1 and 240 characters.';
  end if;
  if v_creator is not null and char_length(v_creator) > 240 then
    raise exception 'Creator name may not exceed 240 characters.';
  end if;
  if p_release_year is not null and (p_release_year < 1 or p_release_year > 3000) then
    raise exception 'Release year is invalid.';
  end if;

  update public.seed_catalog_items item
  set canonical_title = v_title,
      creator_name = v_creator,
      original_title = v_original_title,
      release_year = p_release_year,
      cover_url = v_cover_url,
      language_code = v_language_code,
      updated_at = now()
  where item.id = p_catalog_item_id
    and item.status in ('active', 'pending', 'under_review');

  if not found then raise exception 'Catalogue subject not found or cannot be edited.'; end if;
  return p_catalog_item_id;
end;
$$;

-- Extend the admin feed with report context.
create or replace function public.get_admin_seed_catalog_items(
  p_status text default 'pending',
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_query text := nullif(public.normalize_seed_catalog_text(p_query), '');
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  with selected_items as (
    select item.id
    from public.seed_catalog_items item
    where (p_status is null or p_status = '' or item.status = p_status)
      and (
        v_query is null
        or item.normalized_title like '%' || v_query || '%'
        or item.normalized_creator like '%' || v_query || '%'
        or exists (
          select 1 from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias like '%' || v_query || '%'
        )
      )
    order by
      case item.status when 'under_review' then 0 when 'pending' then 1 when 'active' then 2 else 3 end,
      item.created_at desc,
      item.id desc
    limit greatest(1, least(coalesce(p_limit, 100), 300))
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'catalog_item_id', item.id,
      'seed_type_id', item.seed_type_id,
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
      'status', item.status,
      'metadata', item.metadata,
      'created_at', item.created_at,
      'created_by', case when creator.id is null then null else jsonb_build_object(
        'user_id', creator.id, 'full_name', creator.full_name, 'username', creator.username
      ) end,
      'personal_seed_count', (select count(*)::bigint from public.seeds seed where seed.catalog_item_id = item.id),
      'report_count', (select count(*)::bigint from public.seed_catalog_reports report where report.catalog_item_id = item.id and report.status = 'open'),
      'latest_report', (
        select jsonb_build_object(
          'report_id', report.id,
          'reason', report.reason,
          'details', report.details,
          'created_at', report.created_at,
          'reporter', jsonb_build_object(
            'user_id', reporter.id,
            'full_name', reporter.full_name,
            'username', reporter.username
          )
        )
        from public.seed_catalog_reports report
        left join public.profiles reporter on reporter.id = report.reporter_id
        where report.catalog_item_id = item.id and report.status = 'open'
        order by report.created_at desc, report.id desc
        limit 1
      ),
      'aliases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', alias.id, 'alias', alias.alias, 'language_code', alias.language_code,
          'source', alias.source, 'is_primary', alias.is_primary
        ) order by alias.is_primary desc, lower(alias.alias), alias.id)
        from public.seed_catalog_aliases alias
        where alias.catalog_item_id = item.id
      ), '[]'::jsonb)
    ) order by
      case item.status when 'under_review' then 0 when 'pending' then 1 when 'active' then 2 else 3 end,
      item.created_at desc, item.id desc
  ), '[]'::jsonb)
  into v_result
  from selected_items selected
  join public.seed_catalog_items item on item.id = selected.id
  join public.seed_types seed_type on seed_type.id = item.seed_type_id
  left join public.profiles creator on creator.id = item.created_by;

  return v_result;
end;
$$;

-- Existing admin actions now also resolve reports. Approve restores a reported
-- subject, reject removes it from the shared Library while personal instances
-- fall back to owner-only Private Seeds, and merge preserves lineage.
create or replace function public.admin_review_seed_catalog_item(
  p_catalog_item_id uuid,
  p_action text,
  p_target_catalog_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_result_id uuid;
  v_source_seed_ids uuid[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if v_action = 'approve' then
    update public.seed_catalog_items item
    set status = 'active', merged_into_id = null, reviewed_by = auth.uid(), reviewed_at = now()
    where item.id = p_catalog_item_id and item.status in ('pending', 'rejected', 'under_review')
    returning item.id into v_result_id;
    if v_result_id is null then raise exception 'Catalogue subject not found or already active.' using errcode = 'P0002'; end if;

    update public.seeds seed
    set visibility = coalesce(seed.library_visibility_before_review, seed.visibility),
        library_visibility_before_review = null,
        updated_at = now()
    where seed.catalog_item_id = p_catalog_item_id;

    update public.seed_catalog_reports report
    set status = 'resolved', resolution = 'restored', resolved_by = auth.uid(), resolved_at = now()
    where report.catalog_item_id = p_catalog_item_id and report.status = 'open';
    return v_result_id;
  end if;

  if v_action = 'merge' then
    if p_target_catalog_item_id is null then raise exception 'Select an active target subject before merging.' using errcode = '22023'; end if;
    select array_agg(seed.id) into v_source_seed_ids
    from public.seeds seed where seed.catalog_item_id = p_catalog_item_id;
    v_result_id := public.admin_merge_seed_catalog_items(p_catalog_item_id, p_target_catalog_item_id);
    if v_source_seed_ids is not null then
      update public.seeds seed
      set visibility = coalesce(seed.library_visibility_before_review, seed.visibility),
          library_visibility_before_review = null,
          updated_at = now()
      where seed.id = any(v_source_seed_ids);
    end if;
    update public.seed_catalog_reports report
    set status = 'resolved', resolution = 'merged', resolved_by = auth.uid(), resolved_at = now()
    where report.catalog_item_id = p_catalog_item_id and report.status = 'open';
    return v_result_id;
  end if;

  if v_action = 'reject' then
    update public.seeds seed
    set catalog_edition_id = null, catalog_item_id = null, inspired_by_seed_id = null,
        library_visibility_before_review = null, updated_at = now()
    where seed.catalog_item_id = p_catalog_item_id;

    update public.seed_catalog_items item
    set status = 'rejected', merged_into_id = null, reviewed_by = auth.uid(), reviewed_at = now()
    where item.id = p_catalog_item_id and item.status <> 'merged'
    returning item.id into v_result_id;
    if v_result_id is null then raise exception 'Catalogue subject not found or already merged.' using errcode = 'P0002'; end if;

    update public.seed_catalog_reports report
    set status = 'resolved', resolution = 'removed', resolved_by = auth.uid(), resolved_at = now()
    where report.catalog_item_id = p_catalog_item_id and report.status = 'open';
    return v_result_id;
  end if;

  raise exception 'Unsupported catalogue review action.' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Intent DNA: many Seeds <-> many Intents
-- ---------------------------------------------------------------------------
-- The underlying seed_intent_links table was already many-to-many. These RPCs
-- make that graph explicit in the product and preserve private Seed text.

drop function if exists public.get_my_seed_growth_context(uuid);
create or replace function public.get_my_seed_growth_context(p_seed_id uuid)
returns table(
  seed_id uuid,
  seed_title text,
  seed_notes text,
  seed_external_url text,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_icon text,
  seed_scope text,
  catalog_item_id uuid,
  suggested_activity_id uuid,
  suggested_activity_name text,
  suggested_category_id uuid,
  suggested_category_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed.title,
    seed.notes,
    primary_link.url,
    seed_type.id,
    seed_type.name,
    seed_type.icon,
    seed.seed_scope,
    seed.catalog_item_id,
    suggestion.activity_id,
    activity.name,
    category.id,
    category.name
  from public.seeds seed
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  left join lateral (
    select link.url from public.seed_links link
    where link.seed_id = seed.id
    order by link.sort_order, link.created_at, link.id limit 1
  ) primary_link on true
  left join lateral (
    select mapping.activity_id
    from public.seed_type_activity_suggestions mapping
    join public.activities mapped_activity on mapped_activity.id = mapping.activity_id and mapped_activity.is_active
    where mapping.seed_type_id = seed.seed_type_id
    order by mapping.sort_order, mapping.created_at, mapping.activity_id limit 1
  ) suggestion on true
  left join public.activities activity on activity.id = suggestion.activity_id
  left join public.activity_categories category on category.id = activity.category_id
  where seed.id = p_seed_id and seed.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.get_my_seed_growth_candidates(p_primary_seed_id uuid default null)
returns table(
  seed_id uuid,
  seed_title text,
  seed_type_name text,
  seed_type_icon text,
  seed_scope text,
  catalog_item_id uuid,
  is_primary boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select seed.id, seed.title, seed_type.name, seed_type.icon, seed.seed_scope,
    seed.catalog_item_id, seed.id = p_primary_seed_id
  from public.seeds seed
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  where seed.user_id = auth.uid()
    and seed.status = 'active'
  order by (seed.id = p_primary_seed_id) desc, seed.updated_at desc, seed.id
  limit 24;
$$;

create or replace function public.get_visible_intent_seed_origins(p_intent_id uuid)
returns table(
  seed_id uuid,
  seed_type_name text,
  seed_type_icon text,
  seed_scope text,
  display_title text,
  cover_url text,
  relationship text,
  viewer_is_owner boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed_type.name,
    seed_type.icon,
    seed.seed_scope,
    case
      when seed.seed_scope = 'private' and seed.user_id is distinct from auth.uid() then 'Private Seed'
      when seed.seed_scope = 'library' and catalog_item.status is distinct from 'active' and seed.user_id is distinct from auth.uid() then 'Seed subject under review'
      else seed.title
    end,
    case
      when seed.seed_scope = 'private' and seed.user_id is distinct from auth.uid() then null
      when seed.seed_scope = 'library' and catalog_item.status is distinct from 'active' and seed.user_id is distinct from auth.uid() then null
      else seed.cover_url
    end,
    seed_intent.relationship,
    seed.user_id = auth.uid()
  from public.seed_intent_links seed_intent
  join public.seeds seed on seed.id = seed_intent.seed_id
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  left join public.seed_catalog_items catalog_item on catalog_item.id = seed.catalog_item_id
  where seed_intent.intent_id = p_intent_id
    and public.can_user_view_intent_activity(p_intent_id, auth.uid())
  order by seed_intent.created_at, seed_intent.id;
$$;

-- Pending Library suggestions are private to the suggester and admins at the
-- table-policy level as well as through RPCs.
drop policy if exists seed_catalog_items_visible_select on public.seed_catalog_items;
create policy seed_catalog_items_visible_select
on public.seed_catalog_items for select
to anon, authenticated
using (
  status = 'active'
  or (status = 'pending' and auth.uid() is not null and created_by = auth.uid())
  or (auth.uid() is not null and public.is_admin())
);

drop policy if exists seed_catalog_aliases_visible_select on public.seed_catalog_aliases;
create policy seed_catalog_aliases_visible_select
on public.seed_catalog_aliases for select
to anon, authenticated
using (
  exists (
    select 1 from public.seed_catalog_items item
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
    select 1 from public.seed_catalog_items item
    where item.id = seed_catalog_editions.catalog_item_id
      and (
        item.status = 'active'
        or (item.status = 'pending' and item.created_by = auth.uid())
        or (auth.uid() is not null and public.is_admin())
      )
  )
);

-- Grants
revoke all on table public.seed_catalog_reports from public;
revoke all on function public.report_seed_catalog_item(uuid, text, text) from public;
revoke all on function public.get_my_seeds_v2(text) from public;
revoke all on function public.get_my_seed_v2(uuid) from public;
revoke all on function public.connect_my_private_seed_to_catalog(uuid, uuid) from public;
revoke all on function public.suggest_and_connect_my_private_seed(uuid, uuid, text, text, text, integer, text, text) from public;
revoke all on function public.get_my_seed_growth_context(uuid) from public;
revoke all on function public.get_my_seed_growth_candidates(uuid) from public;
revoke all on function public.get_visible_intent_seed_origins(uuid) from public;

grant select on table public.seed_catalog_reports to authenticated;
grant execute on function public.report_seed_catalog_item(uuid, text, text) to authenticated;
grant execute on function public.get_my_seeds_v2(text) to authenticated;
grant execute on function public.get_my_seed_v2(uuid) to authenticated;
grant execute on function public.get_visible_profile_seeds_v2(uuid, integer) to anon, authenticated;
grant execute on function public.get_visible_seed_detail(uuid) to anon, authenticated;
grant execute on function public.search_seed_catalog(uuid, text, integer) to anon, authenticated;
grant execute on function public.plant_seed_from_catalog(uuid, text, text, date, text, uuid, uuid) to authenticated;
grant execute on function public.connect_my_private_seed_to_catalog(uuid, uuid) to authenticated;
grant execute on function public.suggest_and_connect_my_private_seed(uuid, uuid, text, text, text, integer, text, text) to authenticated;
grant execute on function public.get_my_seed_growth_context(uuid) to authenticated;
grant execute on function public.get_my_seed_growth_candidates(uuid) to authenticated;
grant execute on function public.get_visible_intent_seed_origins(uuid) to anon, authenticated;

commit;
