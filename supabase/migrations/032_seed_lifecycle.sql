begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create table if not exists public.seed_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  icon text not null default '🌱',
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_types_name_check check (char_length(btrim(name)) between 2 and 80),
  constraint seed_types_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint seed_types_icon_check check (char_length(btrim(icon)) between 1 and 16),
  constraint seed_types_sort_order_check check (sort_order >= 0),
  constraint seed_types_slug_unique unique (slug)
);

create table if not exists public.seed_type_activity_suggestions (
  seed_type_id uuid not null references public.seed_types(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (seed_type_id, activity_id),
  constraint seed_type_activity_suggestions_sort_check check (sort_order >= 0)
);

create table if not exists public.seeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  seed_type_id uuid not null references public.seed_types(id) on delete restrict,
  title text not null,
  subtitle text,
  notes text,
  cover_url text,
  visibility text not null default 'only_me',
  status text not null default 'active',
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seeds_title_check check (char_length(btrim(title)) between 2 and 180),
  constraint seeds_subtitle_check check (subtitle is null or char_length(btrim(subtitle)) between 1 and 180),
  constraint seeds_notes_check check (notes is null or char_length(notes) <= 4000),
  constraint seeds_cover_url_check check (cover_url is null or char_length(btrim(cover_url)) <= 2000),
  constraint seeds_visibility_check check (visibility in ('only_me', 'friends', 'everyone')),
  constraint seeds_status_check check (status in ('active', 'completed', 'archived')),
  constraint seeds_status_timestamps_check check (
    (status = 'active' and completed_at is null and archived_at is null)
    or (status = 'completed' and completed_at is not null and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table if not exists public.seed_links (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  url text not null,
  label text,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_links_url_check check (char_length(btrim(url)) between 8 and 2000),
  constraint seed_links_label_check check (label is null or char_length(btrim(label)) between 1 and 100),
  constraint seed_links_provider_check check (provider is null or char_length(btrim(provider)) between 1 and 80),
  constraint seed_links_sort_order_check check (sort_order >= 0),
  constraint seed_links_seed_sort_unique unique (seed_id, sort_order)
);

create table if not exists public.seed_intent_links (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  intent_id uuid not null references public.intents(id) on delete cascade,
  relationship text not null default 'spawned_from',
  created_at timestamptz not null default now(),
  constraint seed_intent_links_relationship_check check (relationship in ('spawned_from', 'inspired_by')),
  constraint seed_intent_links_unique unique (seed_id, intent_id)
);

create index if not exists seeds_user_status_updated_idx
  on public.seeds(user_id, status, updated_at desc);
create index if not exists seeds_visible_profile_idx
  on public.seeds(user_id, visibility, status, updated_at desc)
  where status = 'active';
create index if not exists seeds_type_status_idx
  on public.seeds(seed_type_id, status);
create index if not exists seed_links_seed_sort_idx
  on public.seed_links(seed_id, sort_order);
create index if not exists seed_intent_links_seed_idx
  on public.seed_intent_links(seed_id, created_at desc);
create index if not exists seed_intent_links_intent_idx
  on public.seed_intent_links(intent_id);

comment on table public.seed_types is
  'Admin-managed stable personal Seed verbs such as Read, Watch and Visit.';
comment on table public.seeds is
  'Personal possibilities that may be completed privately or grow into social Intents.';
comment on table public.seed_intent_links is
  'Preserves lineage from a personal Seed to one or more social Intents.';

create or replace function public.touch_seed_catalogue_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_seed_types_updated_at_trigger on public.seed_types;
create trigger touch_seed_types_updated_at_trigger
before update on public.seed_types
for each row execute function public.touch_seed_catalogue_updated_at();

drop trigger if exists touch_seeds_updated_at_trigger on public.seeds;
create trigger touch_seeds_updated_at_trigger
before update on public.seeds
for each row execute function public.touch_seed_catalogue_updated_at();

drop trigger if exists touch_seed_links_updated_at_trigger on public.seed_links;
create trigger touch_seed_links_updated_at_trigger
before update on public.seed_links
for each row execute function public.touch_seed_catalogue_updated_at();

create or replace function public.seed_is_visible_to_viewer(
  p_owner_user_id uuid,
  p_visibility text,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_owner_user_id is null then false
    when p_viewer_user_id = p_owner_user_id then true
    when p_visibility = 'everyone' then true
    when p_visibility = 'friends' and p_viewer_user_id is not null then
      public.users_are_accepted_friends(p_owner_user_id, p_viewer_user_id)
    else false
  end;
$$;

create or replace function public.normalize_seed_url(p_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_url text := nullif(btrim(p_url), '');
begin
  if v_url is null then
    return null;
  end if;

  if v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'Seed links must start with http:// or https://.';
  end if;

  if char_length(v_url) > 2000 then
    raise exception 'Seed links may not exceed 2000 characters.';
  end if;

  return v_url;
end;
$$;

create or replace function public.get_active_seed_types()
returns table(
  id uuid,
  name text,
  slug text,
  icon text,
  description text,
  sort_order integer,
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
    seed_type.id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed_type.description,
    seed_type.sort_order,
    suggestion.activity_id,
    activity.name,
    category.id,
    category.name
  from public.seed_types seed_type
  left join lateral (
    select mapping.activity_id
    from public.seed_type_activity_suggestions mapping
    join public.activities mapped_activity
      on mapped_activity.id = mapping.activity_id
     and mapped_activity.is_active
    join public.activity_categories mapped_category
      on mapped_category.id = mapped_activity.category_id
     and mapped_category.is_active
    where mapping.seed_type_id = seed_type.id
    order by mapping.sort_order, mapping.created_at, mapping.activity_id
    limit 1
  ) suggestion on true
  left join public.activities activity
    on activity.id = suggestion.activity_id
  left join public.activity_categories category
    on category.id = activity.category_id
  where seed_type.is_active
  order by seed_type.sort_order, lower(seed_type.name), seed_type.id;
$$;

create or replace function public.get_my_seeds(
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
  external_url text,
  external_label text,
  grown_intent_count bigint
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
    primary_link.url,
    primary_link.label,
    coalesce(intent_count.total, 0)::bigint
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join lateral (
    select link.url, link.label
    from public.seed_links link
    where link.seed_id = seed.id
    order by link.sort_order, link.created_at, link.id
    limit 1
  ) primary_link on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    where seed_intent.seed_id = seed.id
  ) intent_count on true
  where seed.user_id = auth.uid()
    and (p_status is null or seed.status = p_status)
  order by
    case seed.status when 'active' then 0 when 'completed' then 1 else 2 end,
    seed.updated_at desc,
    seed.id;
$$;

create or replace function public.get_my_seed(p_seed_id uuid)
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
  external_url text,
  external_label text,
  grown_intent_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.get_my_seeds(null)
  where seed_id = p_seed_id
  limit 1;
$$;

create or replace function public.get_visible_profile_seeds(
  p_profile_user_id uuid,
  p_limit integer default 8
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
  target_date date,
  external_url text,
  external_label text,
  grown_intent_count bigint,
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
    seed.target_date,
    primary_link.url,
    primary_link.label,
    coalesce(intent_count.total, 0)::bigint,
    seed.updated_at
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join lateral (
    select link.url, link.label
    from public.seed_links link
    where link.seed_id = seed.id
    order by link.sort_order, link.created_at, link.id
    limit 1
  ) primary_link on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    join public.intents intent
      on intent.id = seed_intent.intent_id
    where seed_intent.seed_id = seed.id
      and public.can_user_view_intent_activity(intent.id, auth.uid())
  ) intent_count on true
  where seed.user_id = p_profile_user_id
    and seed.status = 'active'
    and public.seed_is_visible_to_viewer(
      seed.user_id,
      seed.visibility,
      auth.uid()
    )
  order by seed.updated_at desc, seed.id
  limit greatest(1, least(coalesce(p_limit, 8), 24));
$$;

create or replace function public.create_my_seed(
  p_seed_type_id uuid,
  p_title text,
  p_subtitle text default null,
  p_notes text default null,
  p_cover_url text default null,
  p_external_url text default null,
  p_external_label text default null,
  p_visibility text default 'only_me',
  p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_subtitle text := nullif(btrim(p_subtitle), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_cover_url text := public.normalize_seed_url(p_cover_url);
  v_external_url text := public.normalize_seed_url(p_external_url);
  v_external_label text := nullif(btrim(p_external_label), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to plant a Seed.';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 180 then
    raise exception 'Seed title must be between 2 and 180 characters.';
  end if;

  if p_visibility not in ('only_me', 'friends', 'everyone') then
    raise exception 'Invalid Seed visibility.';
  end if;

  if not exists (
    select 1
    from public.seed_types seed_type
    where seed_type.id = p_seed_type_id
      and seed_type.is_active
  ) then
    raise exception 'Select an active Seed Type.';
  end if;

  insert into public.seeds (
    user_id,
    seed_type_id,
    title,
    subtitle,
    notes,
    cover_url,
    visibility,
    target_date
  ) values (
    auth.uid(),
    p_seed_type_id,
    v_title,
    v_subtitle,
    v_notes,
    v_cover_url,
    p_visibility,
    p_target_date
  ) returning id into v_seed_id;

  if v_external_url is not null then
    insert into public.seed_links (
      seed_id,
      url,
      label,
      sort_order
    ) values (
      v_seed_id,
      v_external_url,
      coalesce(v_external_label, 'Open link'),
      0
    );
  end if;

  return v_seed_id;
end;
$$;

create or replace function public.update_my_seed(
  p_seed_id uuid,
  p_seed_type_id uuid,
  p_title text,
  p_subtitle text default null,
  p_notes text default null,
  p_cover_url text default null,
  p_external_url text default null,
  p_external_label text default null,
  p_visibility text default 'only_me',
  p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_subtitle text := nullif(btrim(p_subtitle), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_cover_url text := public.normalize_seed_url(p_cover_url);
  v_external_url text := public.normalize_seed_url(p_external_url);
  v_external_label text := nullif(btrim(p_external_label), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to edit a Seed.';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 180 then
    raise exception 'Seed title must be between 2 and 180 characters.';
  end if;

  if p_visibility not in ('only_me', 'friends', 'everyone') then
    raise exception 'Invalid Seed visibility.';
  end if;

  if not exists (
    select 1
    from public.seed_types seed_type
    where seed_type.id = p_seed_type_id
      and seed_type.is_active
  ) then
    raise exception 'Select an active Seed Type.';
  end if;

  update public.seeds seed
  set
    seed_type_id = p_seed_type_id,
    title = v_title,
    subtitle = v_subtitle,
    notes = v_notes,
    cover_url = v_cover_url,
    visibility = p_visibility,
    target_date = p_target_date,
    updated_at = now()
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  if not found then
    raise exception 'Seed not found or cannot be edited.';
  end if;

  delete from public.seed_links link
  where link.seed_id = p_seed_id
    and link.sort_order = 0;

  if v_external_url is not null then
    insert into public.seed_links (
      seed_id,
      url,
      label,
      sort_order
    ) values (
      p_seed_id,
      v_external_url,
      coalesce(v_external_label, 'Open link'),
      0
    );
  end if;

  return p_seed_id;
end;
$$;

create or replace function public.set_my_seed_status(
  p_seed_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update a Seed.';
  end if;

  if p_status not in ('active', 'completed', 'archived') then
    raise exception 'Invalid Seed status.';
  end if;

  update public.seeds seed
  set
    status = p_status,
    completed_at = case when p_status = 'completed' then coalesce(seed.completed_at, now()) else null end,
    archived_at = case when p_status = 'archived' then coalesce(seed.archived_at, now()) else null end,
    updated_at = now()
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  if not found then
    raise exception 'Seed not found or cannot be updated.';
  end if;

  return p_seed_id;
end;
$$;

create or replace function public.delete_my_seed(p_seed_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete a Seed.';
  end if;

  if exists (
    select 1
    from public.seed_intent_links seed_intent
    join public.seeds seed on seed.id = seed_intent.seed_id
    where seed_intent.seed_id = p_seed_id
      and seed.user_id = auth.uid()
  ) then
    raise exception 'A Seed that grew into an Intent must be archived instead of deleted.';
  end if;

  delete from public.seeds seed
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.link_my_seed_to_intent(
  p_seed_id uuid,
  p_intent_id uuid,
  p_relationship text default 'spawned_from'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to grow a Seed.';
  end if;

  if p_relationship not in ('spawned_from', 'inspired_by') then
    raise exception 'Invalid Seed relationship.';
  end if;

  if not exists (
    select 1
    from public.seeds seed
    where seed.id = p_seed_id
      and seed.user_id = auth.uid()
  ) then
    raise exception 'Seed not found.';
  end if;

  if not exists (
    select 1
    from public.intents intent
    where intent.id = p_intent_id
      and intent.user_id = auth.uid()
  ) then
    raise exception 'Intent not found.';
  end if;

  insert into public.seed_intent_links (
    seed_id,
    intent_id,
    relationship
  ) values (
    p_seed_id,
    p_intent_id,
    p_relationship
  )
  on conflict on constraint seed_intent_links_unique
  do update set relationship = excluded.relationship
  returning id into v_link_id;

  return v_link_id;
end;
$$;

create or replace function public.get_my_seed_growth_context(p_seed_id uuid)
returns table(
  seed_id uuid,
  seed_title text,
  seed_notes text,
  seed_external_url text,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_icon text,
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
    suggestion.activity_id,
    activity.name,
    category.id,
    category.name
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join lateral (
    select link.url
    from public.seed_links link
    where link.seed_id = seed.id
    order by link.sort_order, link.created_at, link.id
    limit 1
  ) primary_link on true
  left join lateral (
    select mapping.activity_id
    from public.seed_type_activity_suggestions mapping
    join public.activities mapped_activity
      on mapped_activity.id = mapping.activity_id
     and mapped_activity.is_active
    join public.activity_categories mapped_category
      on mapped_category.id = mapped_activity.category_id
     and mapped_category.is_active
    where mapping.seed_type_id = seed.seed_type_id
    order by mapping.sort_order, mapping.created_at, mapping.activity_id
    limit 1
  ) suggestion on true
  left join public.activities activity
    on activity.id = suggestion.activity_id
  left join public.activity_categories category
    on category.id = activity.category_id
  where seed.id = p_seed_id
    and seed.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.get_admin_seed_types()
returns table(
  id uuid,
  name text,
  slug text,
  icon text,
  description text,
  is_active boolean,
  sort_order integer,
  seed_count bigint,
  suggested_activity_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    seed_type.id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed_type.description,
    seed_type.is_active,
    seed_type.sort_order,
    (
      select count(*)::bigint
      from public.seeds seed
      where seed.seed_type_id = seed_type.id
    ),
    coalesce(
      (
        select array_agg(mapping.activity_id order by mapping.sort_order, mapping.activity_id)
        from public.seed_type_activity_suggestions mapping
        where mapping.seed_type_id = seed_type.id
      ),
      '{}'::uuid[]
    )
  from public.seed_types seed_type
  order by seed_type.sort_order, lower(seed_type.name), seed_type.id;
end;
$$;

create or replace function public.admin_upsert_seed_type(
  p_seed_type_id uuid,
  p_name text,
  p_slug text,
  p_icon text,
  p_description text,
  p_is_active boolean,
  p_sort_order integer,
  p_suggested_activity_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed_type_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_icon text := btrim(coalesce(p_icon, '🌱'));
  v_description text := nullif(btrim(p_description), '');
  v_activity_id uuid;
  v_position integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Seed Type name must be between 2 and 80 characters.';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Seed Type slug may contain lowercase letters, numbers and hyphens only.';
  end if;

  if char_length(v_icon) < 1 or char_length(v_icon) > 16 then
    raise exception 'Seed Type icon is invalid.';
  end if;

  if coalesce(p_sort_order, 0) < 0 then
    raise exception 'Sort order must be zero or greater.';
  end if;

  if p_seed_type_id is null then
    insert into public.seed_types (
      name, slug, icon, description, is_active, sort_order
    ) values (
      v_name, v_slug, v_icon, v_description, coalesce(p_is_active, true), coalesce(p_sort_order, 0)
    ) returning id into v_seed_type_id;
  else
    update public.seed_types seed_type
    set
      name = v_name,
      slug = v_slug,
      icon = v_icon,
      description = v_description,
      is_active = coalesce(p_is_active, true),
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
    where seed_type.id = p_seed_type_id
    returning seed_type.id into v_seed_type_id;

    if v_seed_type_id is null then
      raise exception 'Seed Type not found.';
    end if;
  end if;

  delete from public.seed_type_activity_suggestions mapping
  where mapping.seed_type_id = v_seed_type_id;

  foreach v_activity_id in array coalesce(p_suggested_activity_ids, '{}'::uuid[])
  loop
    if exists (select 1 from public.activities activity where activity.id = v_activity_id) then
      insert into public.seed_type_activity_suggestions (
        seed_type_id, activity_id, sort_order
      ) values (
        v_seed_type_id, v_activity_id, v_position
      ) on conflict do nothing;
      v_position := v_position + 1;
    end if;
  end loop;

  return v_seed_type_id;
end;
$$;

create or replace function public.admin_delete_seed_type(p_seed_type_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  if exists (
    select 1
    from public.seeds seed
    where seed.seed_type_id = p_seed_type_id
  ) then
    raise exception 'This Seed Type is in use. Deactivate it instead.';
  end if;

  delete from public.seed_types seed_type
  where seed_type.id = p_seed_type_id;

  return found;
end;
$$;

alter table public.seed_types enable row level security;
alter table public.seed_type_activity_suggestions enable row level security;
alter table public.seeds enable row level security;
alter table public.seed_links enable row level security;
alter table public.seed_intent_links enable row level security;

drop policy if exists seed_types_public_select on public.seed_types;
create policy seed_types_public_select
on public.seed_types for select
to anon, authenticated
using (is_active);

drop policy if exists seed_type_activity_suggestions_public_select on public.seed_type_activity_suggestions;
create policy seed_type_activity_suggestions_public_select
on public.seed_type_activity_suggestions for select
to anon, authenticated
using (true);

drop policy if exists seeds_visible_select on public.seeds;
create policy seeds_visible_select
on public.seeds for select
to anon, authenticated
using (
  public.seed_is_visible_to_viewer(user_id, visibility, auth.uid())
);

drop policy if exists seeds_owner_insert on public.seeds;
create policy seeds_owner_insert
on public.seeds for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists seeds_owner_update on public.seeds;
create policy seeds_owner_update
on public.seeds for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists seeds_owner_delete on public.seeds;
create policy seeds_owner_delete
on public.seeds for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists seed_links_visible_select on public.seed_links;
create policy seed_links_visible_select
on public.seed_links for select
to anon, authenticated
using (
  exists (
    select 1
    from public.seeds seed
    where seed.id = seed_links.seed_id
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
  )
);

drop policy if exists seed_links_owner_all on public.seed_links;
create policy seed_links_owner_all
on public.seed_links for all
to authenticated
using (
  exists (
    select 1 from public.seeds seed
    where seed.id = seed_links.seed_id
      and seed.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.seeds seed
    where seed.id = seed_links.seed_id
      and seed.user_id = auth.uid()
  )
);

drop policy if exists seed_intent_links_visible_select on public.seed_intent_links;
create policy seed_intent_links_visible_select
on public.seed_intent_links for select
to anon, authenticated
using (
  exists (
    select 1
    from public.seeds seed
    where seed.id = seed_intent_links.seed_id
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
  )
  and public.can_user_view_intent_activity(seed_intent_links.intent_id, auth.uid())
);

drop policy if exists seed_intent_links_owner_all on public.seed_intent_links;
create policy seed_intent_links_owner_all
on public.seed_intent_links for all
to authenticated
using (
  exists (
    select 1 from public.seeds seed
    where seed.id = seed_intent_links.seed_id
      and seed.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.seeds seed
    where seed.id = seed_intent_links.seed_id
      and seed.user_id = auth.uid()
  )
);

revoke all on table public.seed_types from public;
revoke all on table public.seed_type_activity_suggestions from public;
revoke all on table public.seeds from public;
revoke all on table public.seed_links from public;
revoke all on table public.seed_intent_links from public;

grant select on table public.seed_types to anon, authenticated;
grant select on table public.seed_type_activity_suggestions to anon, authenticated;
grant select, insert, update, delete on table public.seeds to authenticated;
grant select on table public.seeds to anon;
grant select, insert, update, delete on table public.seed_links to authenticated;
grant select on table public.seed_links to anon;
grant select, insert, update, delete on table public.seed_intent_links to authenticated;
grant select on table public.seed_intent_links to anon;

revoke all on function public.seed_is_visible_to_viewer(uuid, text, uuid) from public;
revoke all on function public.normalize_seed_url(text) from public;
revoke all on function public.get_active_seed_types() from public;
revoke all on function public.get_my_seeds(text) from public;
revoke all on function public.get_my_seed(uuid) from public;
revoke all on function public.get_visible_profile_seeds(uuid, integer) from public;
revoke all on function public.create_my_seed(uuid, text, text, text, text, text, text, text, date) from public;
revoke all on function public.update_my_seed(uuid, uuid, text, text, text, text, text, text, text, date) from public;
revoke all on function public.set_my_seed_status(uuid, text) from public;
revoke all on function public.delete_my_seed(uuid) from public;
revoke all on function public.link_my_seed_to_intent(uuid, uuid, text) from public;
revoke all on function public.get_my_seed_growth_context(uuid) from public;
revoke all on function public.get_admin_seed_types() from public;
revoke all on function public.admin_upsert_seed_type(uuid, text, text, text, text, boolean, integer, uuid[]) from public;
revoke all on function public.admin_delete_seed_type(uuid) from public;

grant execute on function public.seed_is_visible_to_viewer(uuid, text, uuid) to anon, authenticated;
grant execute on function public.get_active_seed_types() to anon, authenticated;
grant execute on function public.get_my_seeds(text) to authenticated;
grant execute on function public.get_my_seed(uuid) to authenticated;
grant execute on function public.get_visible_profile_seeds(uuid, integer) to anon, authenticated;
grant execute on function public.create_my_seed(uuid, text, text, text, text, text, text, text, date) to authenticated;
grant execute on function public.update_my_seed(uuid, uuid, text, text, text, text, text, text, text, date) to authenticated;
grant execute on function public.set_my_seed_status(uuid, text) to authenticated;
grant execute on function public.delete_my_seed(uuid) to authenticated;
grant execute on function public.link_my_seed_to_intent(uuid, uuid, text) to authenticated;
grant execute on function public.get_my_seed_growth_context(uuid) to authenticated;
grant execute on function public.get_admin_seed_types() to authenticated;
grant execute on function public.admin_upsert_seed_type(uuid, text, text, text, text, boolean, integer, uuid[]) to authenticated;
grant execute on function public.admin_delete_seed_type(uuid) to authenticated;

insert into public.seed_types (name, slug, icon, description, sort_order)
values
  ('Read', 'read', '📚', 'Books, articles and written work you want to read.', 10),
  ('Watch', 'watch', '🎬', 'Films, series, documentaries and videos you want to watch.', 20),
  ('Listen', 'listen', '🎧', 'Music, podcasts and audio you want to hear.', 30),
  ('Visit', 'visit', '📍', 'Places, museums, cities and destinations you want to visit.', 40),
  ('Try', 'try', '🍽️', 'Food, restaurants and experiences you want to try.', 50),
  ('Learn', 'learn', '🎓', 'Skills, courses and subjects you want to learn.', 60),
  ('Play', 'play', '🎮', 'Games and playful experiences you want to try.', 70),
  ('Make', 'make', '🛠️', 'Things you want to build, create or make.', 80),
  ('Explore', 'explore', '🧭', 'Ideas and possibilities you want to explore.', 90),
  ('Practice', 'practice', '🎯', 'Skills and habits you want to practice.', 100)
on conflict (slug) do update
set
  name = excluded.name,
  icon = excluded.icon,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Install initial translations when the dynamic language catalogue exists.
do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null
     and to_regclass('public.app_locales') is not null then
    insert into public.translation_keys (
      key,
      namespace,
      default_text,
      description,
      source_revision,
      is_active
    )
    select
      source_row.key,
      'seeds',
      source_row.default_text,
      'Personal Seed lifecycle and profile presentation',
      1,
      true
    from (
      values
        ('source.seeds.my-seeds', 'My Seeds'),
        ('source.seeds.plant', 'Plant a Seed'),
        ('source.seeds.grow', 'Grow into an Intent'),
        ('source.seeds.current', 'Current Seeds'),
        ('source.seeds.active', 'Active'),
        ('source.seeds.completed', 'Completed'),
        ('source.seeds.archived', 'Archived'),
        ('source.seeds.only-me', 'Only me'),
        ('source.seeds.friends', 'Friends'),
        ('source.seeds.everyone', 'Everyone')
    ) as source_row(key, default_text)
    on conflict (key)
    do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    insert into public.translation_values (
      translation_key_id,
      locale_code,
      value,
      source_revision,
      updated_by
    )
    select
      translation_key.id,
      'tr',
      translation_row.translated_text,
      translation_key.source_revision,
      null
    from (
      values
        ('source.seeds.my-seeds', 'Tohumlarım'),
        ('source.seeds.plant', 'Bir Tohum Ekle'),
        ('source.seeds.grow', 'Intent’e Dönüştür'),
        ('source.seeds.current', 'Güncel Tohumlar'),
        ('source.seeds.active', 'Aktif'),
        ('source.seeds.completed', 'Tamamlandı'),
        ('source.seeds.archived', 'Arşivlendi'),
        ('source.seeds.only-me', 'Yalnızca ben'),
        ('source.seeds.friends', 'Arkadaşlar'),
        ('source.seeds.everyone', 'Herkes')
    ) as translation_row(key, translated_text)
    join public.translation_keys translation_key
      on translation_key.key = translation_row.key
    where exists (
      select 1
      from public.app_locales locale
      where locale.code = 'tr'
    )
    on conflict (translation_key_id, locale_code)
    do update
    set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
    where nullif(btrim(public.translation_values.value), '') is null
       or public.translation_values.source_revision < excluded.source_revision;
  end if;
end;
$$;

commit;
