begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

create schema if not exists extensions;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- A shared subject/work catalogue sits above personal Seed instances.
-- One catalogue item can therefore have many personal Seeds without producing
-- ten nearly identical search results.
create table if not exists public.seed_catalog_items (
  id uuid primary key default gen_random_uuid(),
  seed_type_id uuid not null references public.seed_types(id) on delete restrict,
  item_kind text not null default 'generic',
  canonical_title text not null,
  original_title text,
  creator_name text,
  release_year integer,
  cover_url text,
  language_code text,
  external_source text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  normalized_title text not null default '',
  normalized_creator text not null default '',
  status text not null default 'active',
  merged_into_id uuid references public.seed_catalog_items(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_catalog_items_kind_check check (
    item_kind in (
      'book', 'movie', 'series', 'game', 'album', 'podcast', 'course',
      'place', 'restaurant', 'recipe', 'skill', 'challenge', 'generic'
    )
  ),
  constraint seed_catalog_items_title_check check (
    char_length(btrim(canonical_title)) between 1 and 240
  ),
  constraint seed_catalog_items_creator_check check (
    creator_name is null or char_length(btrim(creator_name)) between 1 and 240
  ),
  constraint seed_catalog_items_year_check check (
    release_year is null or release_year between 1 and 3000
  ),
  constraint seed_catalog_items_cover_check check (
    cover_url is null or char_length(btrim(cover_url)) <= 2000
  ),
  constraint seed_catalog_items_status_check check (
    status in ('active', 'pending', 'merged', 'rejected')
  ),
  constraint seed_catalog_items_merge_check check (
    (status = 'merged' and merged_into_id is not null)
    or (status <> 'merged' and merged_into_id is null)
  ),
  constraint seed_catalog_items_external_unique unique (external_source, external_id)
);

create table if not exists public.seed_catalog_aliases (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.seed_catalog_items(id) on delete cascade,
  alias text not null,
  normalized_alias text not null default '',
  language_code text,
  source text not null default 'manual',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint seed_catalog_aliases_alias_check check (
    char_length(btrim(alias)) between 1 and 240
  ),
  constraint seed_catalog_aliases_source_check check (
    source in ('canonical', 'original', 'translation', 'external', 'manual', 'user')
  ),
  constraint seed_catalog_aliases_unique unique (catalog_item_id, normalized_alias)
);

create table if not exists public.seed_catalog_editions (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.seed_catalog_items(id) on delete cascade,
  edition_label text,
  isbn text,
  publisher text,
  translator text,
  language_code text,
  publication_year integer,
  format text,
  external_source text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_catalog_editions_year_check check (
    publication_year is null or publication_year between 1 and 3000
  ),
  constraint seed_catalog_editions_isbn_unique unique (isbn),
  constraint seed_catalog_editions_external_unique unique (external_source, external_id)
);

alter table public.seeds
  add column if not exists catalog_item_id uuid
    references public.seed_catalog_items(id) on delete set null,
  add column if not exists catalog_edition_id uuid
    references public.seed_catalog_editions(id) on delete set null,
  add column if not exists inspired_by_seed_id uuid
    references public.seeds(id) on delete set null,
  add column if not exists experience_comment_policy text not null default 'same_seed';

alter table public.seeds
  drop constraint if exists seeds_experience_comment_policy_check;
alter table public.seeds
  add constraint seeds_experience_comment_policy_check check (
    experience_comment_policy in ('everyone', 'friends', 'same_seed', 'off')
  );

alter table public.seed_reactions
  drop constraint if exists seed_reactions_type_check;
alter table public.seed_reactions
  add constraint seed_reactions_type_check check (
    reaction_type in ('save', 'water', 'inspired')
  );

create table if not exists public.seed_experience_comments (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.seed_experience_comments(id) on delete set null,
  comment_kind text not null default 'comment',
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  constraint seed_experience_comments_kind_check check (
    comment_kind in ('comment', 'question')
  ),
  constraint seed_experience_comments_body_check check (
    body is null or char_length(btrim(body)) between 2 and 2000
  ),
  constraint seed_experience_comments_deleted_check check (
    (deleted_at is null and body is not null)
    or (deleted_at is not null and body is null)
  )
);

create index if not exists seed_experience_comments_seed_created_idx
  on public.seed_experience_comments(seed_id, created_at, id);
create index if not exists seed_experience_comments_parent_idx
  on public.seed_experience_comments(parent_comment_id, created_at)
  where parent_comment_id is not null;

comment on table public.seed_catalog_items is
  'Canonical subjects or works shared by many personal Seeds.';
comment on table public.seed_catalog_aliases is
  'Alternate spellings and translated titles that resolve to one catalogue item.';
comment on table public.seed_catalog_editions is
  'Optional editions or releases beneath one canonical work.';
comment on column public.seeds.catalog_item_id is
  'Shared catalogue identity; the Seed itself remains a personal instance.';
comment on column public.seeds.inspired_by_seed_id is
  'Optional lineage when a visible completed Seed inspired this Seed.';
comment on column public.seeds.experience_comment_policy is
  'Controls who may comment or ask a question beneath the completion reflection.';
comment on table public.seed_experience_comments is
  'Comments and questions attached only to visible completed Seed experiences.';

create or replace function public.normalize_seed_catalog_text(p_value text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public, extensions
as $$
declare
  v_value text := lower(unaccent(coalesce(p_value, '')));
  v_fallback text;
begin
  v_fallback := regexp_replace(v_value, '[^[:alnum:]]+', ' ', 'g');
  v_fallback := btrim(regexp_replace(v_fallback, '[[:space:]]+', ' ', 'g'));

  -- Treat ampersands and common conjunctions as separators so that
  -- "Suç & Ceza" and "Suç ve Ceza" normalize to the same identity text.
  v_value := regexp_replace(v_value, '&', ' and ', 'g');
  v_value := regexp_replace(
    v_value,
    '(^|[^[:alnum:]])(ve|and)([^[:alnum:]]|$)',
    ' ',
    'g'
  );
  v_value := regexp_replace(v_value, '[^[:alnum:]]+', ' ', 'g');
  v_value := btrim(regexp_replace(v_value, '[[:space:]]+', ' ', 'g'));

  -- A title consisting only of a conjunction (for example "Ve") is still a
  -- valid title and must not normalize to an empty identity.
  return case when v_value = '' then v_fallback else v_value end;
end;
$$;

create or replace function public.prepare_seed_catalog_item()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.canonical_title := btrim(new.canonical_title);
  new.original_title := nullif(btrim(new.original_title), '');
  new.creator_name := nullif(btrim(new.creator_name), '');
  new.cover_url := public.normalize_seed_url(new.cover_url);
  new.language_code := nullif(lower(btrim(new.language_code)), '');
  new.external_source := nullif(lower(btrim(new.external_source)), '');
  new.external_id := nullif(btrim(new.external_id), '');
  new.normalized_title := public.normalize_seed_catalog_text(new.canonical_title);
  new.normalized_creator := public.normalize_seed_catalog_text(new.creator_name);
  new.updated_at := now();

  if new.normalized_title = '' then
    raise exception 'Catalogue title cannot normalize to an empty value.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_seed_catalog_alias()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.alias := btrim(new.alias);
  new.normalized_alias := public.normalize_seed_catalog_text(new.alias);
  new.language_code := nullif(lower(btrim(new.language_code)), '');

  if new.normalized_alias = '' then
    raise exception 'Catalogue alias cannot normalize to an empty value.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public.sync_seed_catalog_item_aliases()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.seed_catalog_aliases (
    catalog_item_id,
    alias,
    normalized_alias,
    language_code,
    source,
    is_primary
  ) values (
    new.id,
    new.canonical_title,
    public.normalize_seed_catalog_text(new.canonical_title),
    new.language_code,
    'canonical',
    true
  )
  on conflict (catalog_item_id, normalized_alias)
  do update set
    alias = excluded.alias,
    language_code = coalesce(excluded.language_code, public.seed_catalog_aliases.language_code),
    is_primary = true;

  if new.original_title is not null then
    insert into public.seed_catalog_aliases (
      catalog_item_id,
      alias,
      normalized_alias,
      language_code,
      source,
      is_primary
    ) values (
      new.id,
      new.original_title,
      public.normalize_seed_catalog_text(new.original_title),
      null,
      'original',
      false
    )
    on conflict (catalog_item_id, normalized_alias)
    do update set alias = excluded.alias;
  end if;

  return new;
end;
$$;

create or replace function public.validate_seed_catalogue_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_seed_type_id uuid;
  v_edition_item_id uuid;
begin
  if new.catalog_item_id is null then
    if new.catalog_edition_id is not null then
      raise exception 'A Seed edition requires a catalogue item.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select item.seed_type_id
  into v_seed_type_id
  from public.seed_catalog_items item
  where item.id = new.catalog_item_id
    and item.status in ('active', 'pending');

  if v_seed_type_id is null then
    raise exception 'The selected Seed catalogue item is unavailable.'
      using errcode = '23503';
  end if;

  if new.seed_type_id <> v_seed_type_id then
    raise exception 'Seed Type must match the selected catalogue item.'
      using errcode = '23514';
  end if;

  if new.catalog_edition_id is not null then
    select edition.catalog_item_id
    into v_edition_item_id
    from public.seed_catalog_editions edition
    where edition.id = new.catalog_edition_id;

    if v_edition_item_id is distinct from new.catalog_item_id then
      raise exception 'The selected edition belongs to another catalogue item.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.touch_seed_catalog_edition_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_seed_catalog_item_trigger on public.seed_catalog_items;
create trigger prepare_seed_catalog_item_trigger
before insert or update on public.seed_catalog_items
for each row execute function public.prepare_seed_catalog_item();

drop trigger if exists sync_seed_catalog_item_aliases_trigger on public.seed_catalog_items;
create trigger sync_seed_catalog_item_aliases_trigger
after insert or update of canonical_title, original_title, language_code
on public.seed_catalog_items
for each row execute function public.sync_seed_catalog_item_aliases();

drop trigger if exists prepare_seed_catalog_alias_trigger on public.seed_catalog_aliases;
create trigger prepare_seed_catalog_alias_trigger
before insert or update on public.seed_catalog_aliases
for each row execute function public.prepare_seed_catalog_alias();

drop trigger if exists touch_seed_catalog_editions_updated_at_trigger on public.seed_catalog_editions;
create trigger touch_seed_catalog_editions_updated_at_trigger
before update on public.seed_catalog_editions
for each row execute function public.touch_seed_catalog_edition_updated_at();

drop trigger if exists validate_seed_catalogue_link_trigger on public.seeds;
create trigger validate_seed_catalogue_link_trigger
before insert or update of seed_type_id, catalog_item_id, catalog_edition_id
on public.seeds
for each row execute function public.validate_seed_catalogue_link();

create index if not exists seed_catalog_items_type_status_idx
  on public.seed_catalog_items(seed_type_id, status, updated_at desc);
create index if not exists seed_catalog_items_normalized_title_trgm_idx
  on public.seed_catalog_items
  using gin (normalized_title gin_trgm_ops);
create index if not exists seed_catalog_aliases_normalized_trgm_idx
  on public.seed_catalog_aliases
  using gin (normalized_alias gin_trgm_ops);
create index if not exists seed_catalog_aliases_item_idx
  on public.seed_catalog_aliases(catalog_item_id, is_primary desc, created_at);
create index if not exists seed_catalog_editions_item_idx
  on public.seed_catalog_editions(catalog_item_id, publication_year, id);
create index if not exists seeds_catalog_item_status_idx
  on public.seeds(catalog_item_id, status, updated_at desc)
  where catalog_item_id is not null;
create unique index if not exists seeds_one_active_catalog_item_per_user_idx
  on public.seeds(user_id, catalog_item_id)
  where catalog_item_id is not null and status = 'active';
create index if not exists seeds_inspired_by_seed_idx
  on public.seeds(inspired_by_seed_id, created_at desc)
  where inspired_by_seed_id is not null;

create or replace function public.seed_experience_is_visible_to_viewer(
  p_seed_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_viewer_user_id is distinct from auth.uid()
      and not (auth.uid() is not null and public.is_admin())
      then false
    else exists (
      select 1
      from public.seeds seed
      where seed.id = p_seed_id
      and seed.status = 'completed'
      and public.seed_is_visible_to_viewer(
        seed.user_id,
        seed.visibility,
        p_viewer_user_id
      )
      and exists (
        select 1
        from public.seed_journal_entries entry
        where entry.seed_id = seed.id
          and entry.entry_kind = 'reflection'
          and public.seed_is_visible_to_viewer(
            seed.user_id,
            entry.visibility,
            p_viewer_user_id
          )
      )
    )
  end;
$$;

create or replace function public.can_comment_on_seed_experience(
  p_seed_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_viewer_user_id is distinct from auth.uid()
      and not (auth.uid() is not null and public.is_admin())
      then false
    else coalesce((
      select case
      when p_viewer_user_id is null then false
      when seed.user_id = p_viewer_user_id then true
      when not public.seed_experience_is_visible_to_viewer(
        seed.id,
        p_viewer_user_id
      ) then false
      when seed.experience_comment_policy = 'everyone' then true
      when seed.experience_comment_policy = 'friends' then
        public.users_are_accepted_friends(seed.user_id, p_viewer_user_id)
      when seed.experience_comment_policy = 'same_seed' then
        seed.catalog_item_id is not null
        and exists (
          select 1
          from public.seeds viewer_seed
          where viewer_seed.user_id = p_viewer_user_id
            and viewer_seed.catalog_item_id = seed.catalog_item_id
            and viewer_seed.status in ('active', 'completed')
        )
      else false
    end
      from public.seeds seed
      where seed.id = p_seed_id
    ), false)
  end;
$$;

create or replace function public.set_my_seed_experience_comment_policy(
  p_seed_id uuid,
  p_policy text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update Seed discussion settings.'
      using errcode = '42501';
  end if;

  if p_policy not in ('everyone', 'friends', 'same_seed', 'off') then
    raise exception 'Unsupported Seed experience comment policy.'
      using errcode = '22023';
  end if;

  update public.seeds seed
  set experience_comment_policy = p_policy,
      updated_at = now()
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  if not found then
    raise exception 'Seed not found or cannot be edited.' using errcode = 'P0002';
  end if;

  return p_policy;
end;
$$;

create or replace function public.get_seed_experience_engagement_context(
  p_seed_ids uuid[]
)
returns table(
  seed_id uuid,
  inspired_count bigint,
  viewer_saved boolean,
  viewer_inspired boolean,
  comment_count bigint,
  viewer_can_comment boolean,
  comment_policy text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    (
      select count(*)::bigint
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.reaction_type = 'inspired'
    ),
    exists (
      select 1
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.user_id = auth.uid()
        and reaction.reaction_type = 'save'
    ),
    exists (
      select 1
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.user_id = auth.uid()
        and reaction.reaction_type = 'inspired'
    ),
    (
      select count(*)::bigint
      from public.seed_experience_comments comment_record
      where comment_record.seed_id = seed.id
        and comment_record.deleted_at is null
    ),
    public.can_comment_on_seed_experience(seed.id, auth.uid()),
    seed.experience_comment_policy
  from public.seeds seed
  where seed.id = any(coalesce(p_seed_ids, '{}'::uuid[]))
    and public.seed_experience_is_visible_to_viewer(seed.id, auth.uid());
$$;

create or replace function public.set_my_seed_experience_reaction(
  p_seed_id uuid,
  p_reaction_type text,
  p_active boolean
)
returns table(
  seed_id uuid,
  inspired_count bigint,
  viewer_saved boolean,
  viewer_inspired boolean,
  comment_count bigint,
  viewer_can_comment boolean,
  comment_policy text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_visibility text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to react to an Experience.'
      using errcode = '42501';
  end if;

  if p_reaction_type not in ('save', 'inspired') then
    raise exception 'Unsupported Experience reaction.' using errcode = '22023';
  end if;

  select seed.user_id
  into v_owner_user_id
  from public.seeds seed
  where seed.id = p_seed_id;

  if v_owner_user_id is null
     or not public.seed_experience_is_visible_to_viewer(p_seed_id, auth.uid()) then
    raise exception 'This completed Seed Experience is unavailable.'
      using errcode = '42501';
  end if;

  if v_owner_user_id = auth.uid() then
    raise exception 'You cannot react to your own Experience.'
      using errcode = '22023';
  end if;

  if not coalesce(p_active, false) then
    delete from public.seed_reactions reaction
    where reaction.seed_id = p_seed_id
      and reaction.user_id = auth.uid()
      and reaction.reaction_type = p_reaction_type;

    return query
    select *
    from public.get_seed_experience_engagement_context(array[p_seed_id]);
    return;
  end if;

  v_visibility := case
    when p_reaction_type = 'save' then 'only_me'
    else 'everyone'
  end;

  insert into public.seed_reactions (
    seed_id, user_id, reaction_type, visibility
  ) values (
    p_seed_id, auth.uid(), p_reaction_type, v_visibility
  )
  on conflict on constraint seed_reactions_unique
  do update set
    visibility = excluded.visibility,
    updated_at = now();

  return query
  select *
  from public.get_seed_experience_engagement_context(array[p_seed_id]);
end;
$$;

create or replace function public.add_seed_experience_comment(
  p_seed_id uuid,
  p_body text,
  p_comment_kind text default 'comment',
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment_id uuid;
  v_body text := nullif(btrim(p_body), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to comment on an Experience.'
      using errcode = '42501';
  end if;

  if p_comment_kind not in ('comment', 'question') then
    raise exception 'Unsupported Seed Experience message type.'
      using errcode = '22023';
  end if;

  if v_body is null or char_length(v_body) < 2 or char_length(v_body) > 2000 then
    raise exception 'Comments must be between 2 and 2000 characters.'
      using errcode = '22023';
  end if;

  if not public.can_comment_on_seed_experience(p_seed_id, auth.uid()) then
    raise exception 'You cannot comment on this Seed Experience.'
      using errcode = '42501';
  end if;

  if p_parent_comment_id is not null and not exists (
    select 1
    from public.seed_experience_comments parent_comment
    where parent_comment.id = p_parent_comment_id
      and parent_comment.seed_id = p_seed_id
  ) then
    raise exception 'The reply target does not belong to this Experience.'
      using errcode = '23514';
  end if;

  insert into public.seed_experience_comments (
    seed_id,
    user_id,
    parent_comment_id,
    comment_kind,
    body
  ) values (
    p_seed_id,
    auth.uid(),
    p_parent_comment_id,
    p_comment_kind,
    v_body
  ) returning id into v_comment_id;

  return v_comment_id;
end;
$$;

create or replace function public.delete_my_seed_experience_comment(
  p_comment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to remove a comment.'
      using errcode = '42501';
  end if;

  update public.seed_experience_comments comment_record
  set
    body = null,
    deleted_at = now(),
    deleted_by = auth.uid(),
    updated_at = now()
  from public.seeds seed
  where comment_record.id = p_comment_id
    and seed.id = comment_record.seed_id
    and comment_record.deleted_at is null
    and (
      comment_record.user_id = auth.uid()
      or seed.user_id = auth.uid()
      or public.is_admin()
    );

  return found;
end;
$$;

create or replace function public.get_seed_experience_comments(
  p_seed_id uuid,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table(
  comment_id uuid,
  parent_comment_id uuid,
  comment_kind text,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  is_experience_owner boolean,
  is_viewer_comment boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    comment_record.id,
    comment_record.parent_comment_id,
    comment_record.comment_kind,
    comment_record.body,
    comment_record.created_at,
    comment_record.updated_at,
    comment_record.deleted_at,
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    profile.id = seed.user_id,
    profile.id = auth.uid()
  from public.seed_experience_comments comment_record
  join public.seeds seed on seed.id = comment_record.seed_id
  join public.profiles profile on profile.id = comment_record.user_id
  where comment_record.seed_id = p_seed_id
    and public.seed_experience_is_visible_to_viewer(seed.id, auth.uid())
  order by comment_record.created_at, comment_record.id
  limit greatest(1, least(coalesce(p_limit, 40), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop trigger if exists touch_seed_experience_comments_updated_at_trigger
  on public.seed_experience_comments;
create trigger touch_seed_experience_comments_updated_at_trigger
before update on public.seed_experience_comments
for each row execute function public.touch_seed_catalogue_updated_at();

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
        and auth.uid() is not null
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
      or (item.status = 'pending' and auth.uid() is not null)
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
      or (item.status = 'pending' and auth.uid() is not null)
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
      and item.status in ('active', 'pending')
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
      and item.status in ('active', 'pending')
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
        and item.status in ('active', 'pending')
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

create or replace function public.admin_upsert_seed_catalog_item(
  p_catalog_item_id uuid,
  p_seed_type_id uuid,
  p_item_kind text,
  p_canonical_title text,
  p_original_title text default null,
  p_creator_name text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_language_code text default null,
  p_external_source text default null,
  p_external_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_catalog_item_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if p_status not in ('active', 'pending', 'rejected') then
    raise exception 'Use the merge operation for merged catalogue items.'
      using errcode = '22023';
  end if;

  if p_catalog_item_id is null then
    insert into public.seed_catalog_items (
      seed_type_id, item_kind, canonical_title, original_title, creator_name,
      release_year, cover_url, language_code, external_source, external_id,
      metadata, status, created_by, reviewed_by, reviewed_at
    ) values (
      p_seed_type_id, p_item_kind, p_canonical_title, p_original_title,
      p_creator_name, p_release_year, p_cover_url, p_language_code,
      p_external_source, p_external_id, coalesce(p_metadata, '{}'::jsonb),
      p_status, auth.uid(), auth.uid(), now()
    ) returning id into v_catalog_item_id;
  else
    update public.seed_catalog_items item
    set
      seed_type_id = p_seed_type_id,
      item_kind = p_item_kind,
      canonical_title = p_canonical_title,
      original_title = p_original_title,
      creator_name = p_creator_name,
      release_year = p_release_year,
      cover_url = p_cover_url,
      language_code = p_language_code,
      external_source = p_external_source,
      external_id = p_external_id,
      metadata = coalesce(p_metadata, '{}'::jsonb),
      status = p_status,
      merged_into_id = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where item.id = p_catalog_item_id
    returning item.id into v_catalog_item_id;

    if v_catalog_item_id is null then
      raise exception 'Seed catalogue item not found.' using errcode = 'P0002';
    end if;
  end if;

  return v_catalog_item_id;
end;
$$;

create or replace function public.admin_merge_seed_catalog_items(
  p_source_catalog_item_id uuid,
  p_target_catalog_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if p_source_catalog_item_id = p_target_catalog_item_id then
    raise exception 'Source and target catalogue items must differ.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.seed_catalog_items item
    where item.id = p_target_catalog_item_id and item.status = 'active'
  ) then
    raise exception 'Target catalogue item must be active.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.seed_catalog_items item
    where item.id = p_source_catalog_item_id and item.status <> 'merged'
  ) then
    raise exception 'Source catalogue item not found or already merged.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.seed_catalog_items source_item
    join public.seed_catalog_items target_item
      on target_item.id = p_target_catalog_item_id
    where source_item.id = p_source_catalog_item_id
      and source_item.seed_type_id <> target_item.seed_type_id
  ) then
    raise exception 'Duplicate subjects must belong to the same Seed Type.'
      using errcode = '23514';
  end if;

  insert into public.seed_catalog_aliases (
    catalog_item_id, alias, language_code, source, is_primary
  )
  select
    p_target_catalog_item_id,
    alias.alias,
    alias.language_code,
    case when alias.source = 'canonical' then 'manual' else alias.source end,
    false
  from public.seed_catalog_aliases alias
  where alias.catalog_item_id = p_source_catalog_item_id
  on conflict (catalog_item_id, normalized_alias) do nothing;

  update public.seed_catalog_editions edition
  set catalog_item_id = p_target_catalog_item_id
  where edition.catalog_item_id = p_source_catalog_item_id;

  -- A user may already have an active Seed for both duplicate subjects. Keep
  -- the target active Seed and archive the duplicate before relinking it.
  update public.seeds source_seed
  set
    status = 'archived',
    archived_at = coalesce(source_seed.archived_at, now()),
    updated_at = now()
  where source_seed.catalog_item_id = p_source_catalog_item_id
    and source_seed.status = 'active'
    and exists (
      select 1
      from public.seeds target_seed
      where target_seed.user_id = source_seed.user_id
        and target_seed.catalog_item_id = p_target_catalog_item_id
        and target_seed.status = 'active'
    );

  update public.seeds seed
  set catalog_item_id = p_target_catalog_item_id,
      updated_at = now()
  where seed.catalog_item_id = p_source_catalog_item_id;

  update public.seed_catalog_items item
  set
    status = 'merged',
    merged_into_id = p_target_catalog_item_id,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where item.id = p_source_catalog_item_id;

  return p_target_catalog_item_id;
end;
$$;

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
          select 1
          from public.seed_catalog_aliases alias
          where alias.catalog_item_id = item.id
            and alias.normalized_alias like '%' || v_query || '%'
        )
      )
    order by
      case item.status when 'pending' then 0 when 'active' then 1 else 2 end,
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
      'created_by', case
        when creator.id is null then null
        else jsonb_build_object(
          'user_id', creator.id,
          'full_name', creator.full_name,
          'username', creator.username
        )
      end,
      'personal_seed_count', (
        select count(*)::bigint
        from public.seeds seed
        where seed.catalog_item_id = item.id
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
      ), '[]'::jsonb)
    )
    order by
      case item.status when 'pending' then 0 when 'active' then 1 else 2 end,
      item.created_at desc,
      item.id desc
  ), '[]'::jsonb)
  into v_result
  from selected_items selected
  join public.seed_catalog_items item on item.id = selected.id
  join public.seed_types seed_type on seed_type.id = item.seed_type_id
  left join public.profiles creator on creator.id = item.created_by;

  return v_result;
end;
$$;

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
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if v_action = 'approve' then
    update public.seed_catalog_items item
    set
      status = 'active',
      merged_into_id = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where item.id = p_catalog_item_id
      and item.status in ('pending', 'rejected')
    returning item.id into v_result_id;

    if v_result_id is null then
      raise exception 'Catalogue suggestion not found or already reviewed.'
        using errcode = 'P0002';
    end if;

    return v_result_id;
  end if;

  if v_action = 'merge' then
    if p_target_catalog_item_id is null then
      raise exception 'Select an active target subject before merging.'
        using errcode = '22023';
    end if;

    return public.admin_merge_seed_catalog_items(
      p_catalog_item_id,
      p_target_catalog_item_id
    );
  end if;

  if v_action = 'reject' then
    -- A rejected suggestion must not destroy the user’s personal Seed. It is
    -- detached from the shared catalogue and remains a normal custom Seed.
    update public.seeds seed
    set
      catalog_edition_id = null,
      catalog_item_id = null,
      inspired_by_seed_id = null,
      updated_at = now()
    where seed.catalog_item_id = p_catalog_item_id;

    update public.seed_catalog_items item
    set
      status = 'rejected',
      merged_into_id = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where item.id = p_catalog_item_id
      and item.status <> 'merged'
    returning item.id into v_result_id;

    if v_result_id is null then
      raise exception 'Catalogue suggestion not found or already merged.'
        using errcode = 'P0002';
    end if;

    return v_result_id;
  end if;

  raise exception 'Unsupported catalogue review action.' using errcode = '22023';
end;
$$;

alter table public.seed_catalog_items enable row level security;
alter table public.seed_catalog_aliases enable row level security;
alter table public.seed_catalog_editions enable row level security;
alter table public.seed_experience_comments enable row level security;

drop policy if exists seed_experience_comments_visible_select
  on public.seed_experience_comments;
create policy seed_experience_comments_visible_select
on public.seed_experience_comments for select
to anon, authenticated
using (
  public.seed_experience_is_visible_to_viewer(
    seed_experience_comments.seed_id,
    auth.uid()
  )
);

drop policy if exists seed_catalog_items_visible_select on public.seed_catalog_items;
create policy seed_catalog_items_visible_select
on public.seed_catalog_items for select
to anon, authenticated
using (
  status = 'active'
  or (status = 'pending' and auth.uid() is not null)
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
        or (item.status = 'pending' and auth.uid() is not null)
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
        or (item.status = 'pending' and auth.uid() is not null)
        or (auth.uid() is not null and public.is_admin())
      )
  )
);

revoke all on table public.seed_catalog_items from public, anon, authenticated;
revoke all on table public.seed_catalog_aliases from public, anon, authenticated;
revoke all on table public.seed_catalog_editions from public, anon, authenticated;
revoke all on table public.seed_experience_comments from public, anon, authenticated;

grant select on table public.seed_catalog_items to anon, authenticated;
grant select on table public.seed_catalog_aliases to anon, authenticated;
grant select on table public.seed_catalog_editions to anon, authenticated;
grant select on table public.seed_experience_comments to anon, authenticated;

revoke all on function public.seed_experience_is_visible_to_viewer(uuid, uuid) from public;
revoke all on function public.can_comment_on_seed_experience(uuid, uuid) from public;
revoke all on function public.set_my_seed_experience_comment_policy(uuid, text) from public;
revoke all on function public.get_seed_experience_engagement_context(uuid[]) from public;
revoke all on function public.set_my_seed_experience_reaction(uuid, text, boolean) from public;
revoke all on function public.add_seed_experience_comment(uuid, text, text, uuid) from public;
revoke all on function public.delete_my_seed_experience_comment(uuid) from public;
revoke all on function public.get_seed_experience_comments(uuid, integer, integer) from public;
revoke all on function public.normalize_seed_catalog_text(text) from public;
revoke all on function public.search_seed_catalog(uuid, text, integer) from public;
revoke all on function public.get_seed_catalog_detail(uuid) from public;
revoke all on function public.plant_seed_from_catalog(uuid, text, text, date, text, uuid, uuid) from public;
revoke all on function public.suggest_seed_catalog_item(uuid, text, text, text, text, integer, text, text, jsonb) from public;
revoke all on function public.admin_upsert_seed_catalog_item(uuid, uuid, text, text, text, text, integer, text, text, text, text, jsonb, text) from public;
revoke all on function public.admin_merge_seed_catalog_items(uuid, uuid) from public;
revoke all on function public.get_admin_seed_catalog_items(text, text, integer) from public;
revoke all on function public.admin_review_seed_catalog_item(uuid, text, uuid) from public;

grant execute on function public.seed_experience_is_visible_to_viewer(uuid, uuid) to anon, authenticated;
grant execute on function public.can_comment_on_seed_experience(uuid, uuid) to anon, authenticated;
grant execute on function public.set_my_seed_experience_comment_policy(uuid, text) to authenticated;
grant execute on function public.get_seed_experience_engagement_context(uuid[]) to anon, authenticated;
grant execute on function public.set_my_seed_experience_reaction(uuid, text, boolean) to authenticated;
grant execute on function public.add_seed_experience_comment(uuid, text, text, uuid) to authenticated;
grant execute on function public.delete_my_seed_experience_comment(uuid) to authenticated;
grant execute on function public.get_seed_experience_comments(uuid, integer, integer) to anon, authenticated;
grant execute on function public.normalize_seed_catalog_text(text) to anon, authenticated;
grant execute on function public.search_seed_catalog(uuid, text, integer) to anon, authenticated;
grant execute on function public.get_seed_catalog_detail(uuid) to anon, authenticated;
grant execute on function public.plant_seed_from_catalog(uuid, text, text, date, text, uuid, uuid) to authenticated;
grant execute on function public.suggest_seed_catalog_item(uuid, text, text, text, text, integer, text, text, jsonb) to authenticated;
grant execute on function public.admin_upsert_seed_catalog_item(uuid, uuid, text, text, text, text, integer, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.admin_merge_seed_catalog_items(uuid, uuid) to authenticated;
grant execute on function public.get_admin_seed_catalog_items(text, text, integer) to authenticated;
grant execute on function public.admin_review_seed_catalog_item(uuid, text, uuid) to authenticated;

-- Demonstration catalogue entry. All aliases resolve to the same work.
do $$
declare
  v_read_type_id uuid;
  v_item_id uuid;
begin
  select seed_type.id into v_read_type_id
  from public.seed_types seed_type
  where seed_type.slug = 'read'
  limit 1;

  if v_read_type_id is null then
    return;
  end if;

  select item.id into v_item_id
  from public.seed_catalog_items item
  where item.seed_type_id = v_read_type_id
    and item.normalized_title = public.normalize_seed_catalog_text('Suç ve Ceza')
    and item.normalized_creator = public.normalize_seed_catalog_text('Fyodor Dostoyevski')
    and item.status in ('active', 'pending')
  order by case item.status when 'active' then 0 else 1 end
  limit 1;

  if v_item_id is null then
    insert into public.seed_catalog_items (
      seed_type_id,
      item_kind,
      canonical_title,
      original_title,
      creator_name,
      release_year,
      language_code,
      metadata,
      status
    ) values (
      v_read_type_id,
      'book',
      'Suç ve Ceza',
      'Преступление и наказание',
      'Fyodor Dostoyevski',
      1866,
      'tr',
      jsonb_build_object(
        'work_type', 'novel',
        'canonical_work_key', 'crime-and-punishment'
      ),
      'active'
    ) returning id into v_item_id;
  else
    update public.seed_catalog_items
    set status = 'active', merged_into_id = null
    where id = v_item_id;
  end if;

  insert into public.seed_catalog_aliases (
    catalog_item_id, alias, language_code, source, is_primary
  ) values
    (v_item_id, 'Suç & Ceza', 'tr', 'translation', false),
    (v_item_id, 'Suc ve Ceza', 'tr', 'translation', false),
    (v_item_id, 'Crime and Punishment', 'en', 'translation', false),
    (v_item_id, 'Преступление и наказание', 'ru', 'original', false)
  on conflict (catalog_item_id, normalized_alias) do nothing;
end;
$$;

-- Register interface strings when the dynamic language catalogue is installed.
do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null
     and to_regclass('public.app_locales') is not null then
    insert into public.translation_keys (
      key, namespace, default_text, description, source_revision, is_active
    )
    select source_row.key, 'seed-catalogue', source_row.default_text,
      'Shared Seed subject catalogue and search', 1, true
    from (
      values
        ('source.seed-catalogue.title', 'Seed Library'),
        ('source.seed-catalogue.search', 'Search Seeds'),
        ('source.seed-catalogue.subjects', 'Subjects'),
        ('source.seed-catalogue.plant-this', 'Plant this Seed'),
        ('source.seed-catalogue.already-planted', 'Already planted'),
        ('source.seed-catalogue.experiences', 'Experiences'),
        ('source.seed-catalogue.inspired', 'Inspired'),
        ('source.seed-catalogue.save-experience', 'Save Experience'),
        ('source.seed-catalogue.comment', 'Comment'),
        ('source.seed-catalogue.question', 'Question'),
        ('source.seed-catalogue.same-seed-comments', 'People with the same Seed'),
        ('source.seed-catalogue.comments-off', 'Comments off'),
        ('source.seed-catalogue.no-results', 'No matching subject was found.'),
        ('source.seed-catalogue.suggest-and-plant', 'Add to catalogue and plant')
    ) as source_row(key, default_text)
    on conflict (key) do update set
      namespace = excluded.namespace,
      default_text = excluded.default_text,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      is_active = true,
      updated_at = now();

    insert into public.translation_values (
      translation_key_id, locale_code, value, source_revision, updated_by
    )
    select translation_key.id, 'tr', translation_row.value,
      translation_key.source_revision, null
    from (
      values
        ('source.seed-catalogue.title', 'Tohum Kütüphanesi'),
        ('source.seed-catalogue.search', 'Tohum Ara'),
        ('source.seed-catalogue.subjects', 'Konular'),
        ('source.seed-catalogue.plant-this', 'Bu Tohumu Ek'),
        ('source.seed-catalogue.already-planted', 'Zaten ektin'),
        ('source.seed-catalogue.experiences', 'Deneyimler'),
        ('source.seed-catalogue.inspired', 'İlham verdi'),
        ('source.seed-catalogue.save-experience', 'Deneyimi kaydet'),
        ('source.seed-catalogue.comment', 'Yorum'),
        ('source.seed-catalogue.question', 'Soru'),
        ('source.seed-catalogue.same-seed-comments', 'Aynı tohumu ekenler'),
        ('source.seed-catalogue.comments-off', 'Yorumlar kapalı'),
        ('source.seed-catalogue.no-results', 'Eşleşen bir konu bulunamadı.'),
        ('source.seed-catalogue.suggest-and-plant', 'Kataloğa ekle ve ek')
    ) as translation_row(key, value)
    join public.translation_keys translation_key
      on translation_key.key = translation_row.key
    where exists (
      select 1 from public.app_locales locale where locale.code = 'tr'
    )
    on conflict (translation_key_id, locale_code) do update set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_at = now()
    where nullif(btrim(public.translation_values.value), '') is null
       or public.translation_values.source_revision < excluded.source_revision;
  end if;
end;
$$;

commit;
