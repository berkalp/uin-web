
begin;

-- ============================================================
-- UIN COMMUNITY CONTEXT
--
-- Community is a curated context taxonomy for Intents.
-- It is not an account, membership system, organization or posting identity.
-- People still create Intents. Communities only clarify context and discovery.
-- ============================================================

create or replace function public.normalize_community_name(
  p_value text
)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    lower(
      btrim(
        coalesce(
          p_value,
          ''
        )
      )
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  normalized_name text not null,
  slug text not null unique,
  description text null,

  icon_key text not null default 'people',
  icon_url text null,

  category_id uuid not null
    references public.activity_categories(id)
    on delete restrict,

  status text not null default 'active',

  created_by_admin_id uuid not null
    references auth.users(id)
    on delete restrict,

  updated_by_admin_id uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint communities_name_length_check
    check (
      char_length(
        btrim(name)
      ) between 2 and 100
    ),

  constraint communities_slug_check
    check (
      slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),

  constraint communities_description_length_check
    check (
      description is null
      or char_length(description) <= 1200
    ),

  constraint communities_icon_key_check
    check (
      icon_key in (
        'people',
        'football',
        'music',
        'family',
        'travel',
        'book',
        'gaming',
        'technology',
        'art',
        'nature',
        'local',
        'star',
        'flag'
      )
    ),

  constraint communities_icon_url_check
    check (
      icon_url is null
      or icon_url ~* '^https://'
    ),

  constraint communities_status_check
    check (
      status in (
        'active',
        'inactive',
        'archived'
      )
    )
);

create unique index if not exists
  communities_category_normalized_name_unique
on public.communities (
  category_id,
  normalized_name
);

create index if not exists
  communities_active_category_idx
on public.communities (
  category_id,
  name
)
where status = 'active';

create table if not exists public.community_aliases (
  id uuid primary key default gen_random_uuid(),

  community_id uuid not null
    references public.communities(id)
    on delete cascade,

  alias text not null,
  normalized_alias text not null,

  created_by_admin_id uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null default now(),

  constraint community_aliases_alias_length_check
    check (
      char_length(
        btrim(alias)
      ) between 2 and 100
    )
);

create unique index if not exists
  community_aliases_normalized_unique
on public.community_aliases (
  normalized_alias
);

create index if not exists
  community_aliases_community_idx
on public.community_aliases (
  community_id
);

create table if not exists public.community_suggestions (
  id uuid primary key default gen_random_uuid(),

  suggested_name text not null,
  normalized_name text not null,
  description text null,

  category_id uuid not null
    references public.activity_categories(id)
    on delete restrict,

  suggested_by_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status text not null default 'pending',

  reviewed_by_admin_id uuid null
    references auth.users(id)
    on delete set null,

  linked_community_id uuid null
    references public.communities(id)
    on delete set null,

  review_note text null,

  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint community_suggestions_name_length_check
    check (
      char_length(
        btrim(suggested_name)
      ) between 2 and 100
    ),

  constraint community_suggestions_description_length_check
    check (
      description is null
      or char_length(description) <= 1200
    ),

  constraint community_suggestions_status_check
    check (
      status in (
        'pending',
        'approved_new',
        'merged_existing',
        'rejected'
      )
    ),

  constraint community_suggestions_review_note_length_check
    check (
      review_note is null
      or char_length(review_note) <= 2000
    )
);

create unique index if not exists
  community_suggestions_user_pending_unique
on public.community_suggestions (
  suggested_by_user_id,
  category_id,
  normalized_name
)
where status = 'pending';

create index if not exists
  community_suggestions_status_created_idx
on public.community_suggestions (
  status,
  created_at desc
);

alter table public.intents
  add column if not exists community_id uuid
    references public.communities(id)
    on delete set null;

create index if not exists
  intents_community_discovery_idx
on public.intents (
  community_id,
  status,
  end_date
)
where community_id is not null;

alter table public.intent_drafts
  add column if not exists community_id uuid
    references public.communities(id)
    on delete set null;

create index if not exists
  intent_drafts_community_idx
on public.intent_drafts (
  community_id
)
where community_id is not null;

-- ============================================================
-- NORMALIZATION + VALIDATION
-- ============================================================

create or replace function public.prepare_community_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name :=
    regexp_replace(
      btrim(new.name),
      '[[:space:]]+',
      ' ',
      'g'
    );

  new.normalized_name :=
    public.normalize_community_name(
      new.name
    );

  new.slug :=
    lower(
      btrim(new.slug)
    );

  new.description :=
    nullif(
      btrim(
        coalesce(
          new.description,
          ''
        )
      ),
      ''
    );

  new.icon_url :=
    nullif(
      btrim(
        coalesce(
          new.icon_url,
          ''
        )
      ),
      ''
    );

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  prepare_community_record_trigger
on public.communities;

create trigger
  prepare_community_record_trigger
before insert or update
on public.communities
for each row
execute function public.prepare_community_record();

create or replace function public.prepare_community_suggestion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.suggested_name :=
    regexp_replace(
      btrim(new.suggested_name),
      '[[:space:]]+',
      ' ',
      'g'
    );

  new.normalized_name :=
    public.normalize_community_name(
      new.suggested_name
    );

  new.description :=
    nullif(
      btrim(
        coalesce(
          new.description,
          ''
        )
      ),
      ''
    );

  new.review_note :=
    nullif(
      btrim(
        coalesce(
          new.review_note,
          ''
        )
      ),
      ''
    );

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  prepare_community_suggestion_trigger
on public.community_suggestions;

create trigger
  prepare_community_suggestion_trigger
before insert or update
on public.community_suggestions
for each row
execute function public.prepare_community_suggestion();

create or replace function public.validate_intent_community_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_activity_category_id uuid;
  v_community_category_id uuid;
  v_community_status text;
  v_requires_active boolean;
begin
  if new.community_id is null then
    return new;
  end if;

  select activity.category_id
  into v_activity_category_id
  from public.activities activity
  where activity.id = new.activity_id;

  if v_activity_category_id is null then
    raise exception
      'The Intent Activity could not be resolved.'
      using errcode = 'P0002';
  end if;

  select
    community.category_id,
    community.status
  into
    v_community_category_id,
    v_community_status
  from public.communities community
  where community.id = new.community_id;

  if v_community_category_id is null then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;

  if v_community_category_id <>
     v_activity_category_id
  then
    raise exception
      'The selected Community does not belong to the Intent Activity category.'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    v_requires_active := true;
  else
    v_requires_active :=
      old.community_id is distinct from new.community_id;
  end if;

  if v_requires_active
     and v_community_status <> 'active'
  then
    raise exception
      'The selected Community is not currently available.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists
  validate_intent_community_context_trigger
on public.intents;

create trigger
  validate_intent_community_context_trigger
before insert or update of
  activity_id,
  community_id
on public.intents
for each row
execute function public.validate_intent_community_context();

create or replace function public.validate_intent_draft_community_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_id uuid;
  v_community_status text;
  v_requires_active boolean;
begin
  if new.community_id is null then
    return new;
  end if;

  if new.activity_id is not null then
    select activity.category_id
    into v_category_id
    from public.activities activity
    where activity.id = new.activity_id;
  elsif new.activity_suggestion_id is not null then
    select suggestion.requested_category_id
    into v_category_id
    from public.activity_catalog_suggestions suggestion
    where suggestion.id = new.activity_suggestion_id;
  end if;

  if v_category_id is null then
    raise exception
      'The draft Activity category could not be resolved.'
      using errcode = '22023';
  end if;

  select community.status
  into v_community_status
  from public.communities community
  where community.id = new.community_id
    and community.category_id = v_category_id;

  if v_community_status is null then
    raise exception
      'The selected Community does not belong to the draft Activity category.'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    v_requires_active := true;
  else
    v_requires_active :=
      old.community_id is distinct from new.community_id;
  end if;

  if v_requires_active
     and v_community_status <> 'active'
  then
    raise exception
      'The selected Community is not currently available.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists
  validate_intent_draft_community_context_trigger
on public.intent_drafts;

create trigger
  validate_intent_draft_community_context_trigger
before insert or update of
  activity_id,
  activity_suggestion_id,
  community_id
on public.intent_drafts
for each row
execute function public.validate_intent_draft_community_context();

-- ============================================================
-- RLS
-- ============================================================

alter table public.communities
  enable row level security;

alter table public.community_aliases
  enable row level security;

alter table public.community_suggestions
  enable row level security;

drop policy if exists
  active_communities_are_visible
on public.communities;

create policy
  active_communities_are_visible
on public.communities
for select
to public
using (
  status = 'active'
);

drop policy if exists
  users_view_own_community_suggestions
on public.community_suggestions;

create policy
  users_view_own_community_suggestions
on public.community_suggestions
for select
to authenticated
using (
  suggested_by_user_id = auth.uid()
);

revoke insert, update, delete
on public.communities
from anon, authenticated;

revoke all
on public.community_aliases
from anon, authenticated;

revoke insert, update, delete
on public.community_suggestions
from anon, authenticated;

grant select
on public.communities
to anon, authenticated;

grant select
on public.community_suggestions
to authenticated;

-- ============================================================
-- USER COMMUNITY CATALOGUE + SUGGESTIONS
-- ============================================================

create or replace function public.get_active_communities(
  p_category_id uuid default null
)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  category_id uuid,
  category_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    community.id,
    community.name,
    community.slug,
    community.description,
    community.icon_key,
    community.icon_url,
    community.category_id,
    category.name
  from public.communities community
  join public.activity_categories category
    on category.id = community.category_id
  where community.status = 'active'
    and category.is_active = true
    and (
      p_category_id is null
      or community.category_id = p_category_id
    )
  order by
    category.name,
    community.name,
    community.id;
$$;

create or replace function public.get_community_by_slug(
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',
    community.id,
    'name',
    community.name,
    'slug',
    community.slug,
    'description',
    community.description,
    'icon_key',
    community.icon_key,
    'icon_url',
    community.icon_url,
    'category_id',
    community.category_id,
    'category_name',
    category.name
  )
  from public.communities community
  join public.activity_categories category
    on category.id = community.category_id
  where community.slug =
    lower(
      btrim(
        coalesce(
          p_slug,
          ''
        )
      )
    )
    and community.status = 'active'
  limit 1;
$$;

create or replace function public.submit_community_suggestion(
  p_suggested_name text,
  p_description text,
  p_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
  v_normalized_name text;
  v_description text;
  v_existing_name text;
  v_existing_pending_id uuid;
  v_suggestion_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'intent_creation'
  );

  v_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_suggested_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  v_normalized_name :=
    public.normalize_community_name(
      v_name
    );

  v_description :=
    nullif(
      btrim(
        coalesce(
          p_description,
          ''
        )
      ),
      ''
    );

  if char_length(v_name) not between 2 and 100 then
    raise exception
      'Community name must contain between 2 and 100 characters.'
      using errcode = '22023';
  end if;

  if v_description is not null
     and char_length(v_description) > 1200
  then
    raise exception
      'Community description cannot exceed 1200 characters.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.activity_categories category
    where category.id = p_category_id
      and category.is_active = true
  ) then
    raise exception
      'Select an active Activity category.'
      using errcode = '22023';
  end if;

  select community.name
  into v_existing_name
  from public.communities community
  where community.category_id = p_category_id
    and community.status = 'active'
    and (
      community.normalized_name =
        v_normalized_name
      or exists (
        select 1
        from public.community_aliases alias
        where alias.community_id = community.id
          and alias.normalized_alias =
            v_normalized_name
      )
    )
  limit 1;

  if v_existing_name is not null then
    raise exception
      'This Community already exists as "%". Select it instead.',
      v_existing_name
      using errcode = '22023';
  end if;

  select suggestion.id
  into v_existing_pending_id
  from public.community_suggestions suggestion
  where suggestion.suggested_by_user_id = v_user_id
    and suggestion.category_id = p_category_id
    and suggestion.normalized_name = v_normalized_name
    and suggestion.status = 'pending'
  order by suggestion.created_at desc
  limit 1;

  if v_existing_pending_id is not null then
    return v_existing_pending_id;
  end if;

  if (
    select count(*)
    from public.community_suggestions suggestion
    where suggestion.suggested_by_user_id = v_user_id
      and suggestion.status = 'pending'
  ) >= 5
  then
    raise exception
      'You can have at most 5 Community suggestions awaiting review.'
      using errcode = '22023';
  end if;

  insert into public.community_suggestions (
    suggested_name,
    normalized_name,
    description,
    category_id,
    suggested_by_user_id,
    status
  )
  values (
    v_name,
    v_normalized_name,
    v_description,
    p_category_id,
    v_user_id,
    'pending'
  )
  returning id
  into v_suggestion_id;

  return v_suggestion_id;
end;
$$;

create or replace function public.get_my_community_suggestions()
returns table (
  suggestion_id uuid,
  suggested_name text,
  description text,
  category_id uuid,
  category_name text,
  suggestion_status text,
  linked_community_id uuid,
  linked_community_name text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select
    suggestion.id,
    suggestion.suggested_name,
    suggestion.description,
    suggestion.category_id,
    category.name,
    suggestion.status,
    suggestion.linked_community_id,
    community.name,
    suggestion.review_note,
    suggestion.created_at,
    suggestion.reviewed_at
  from public.community_suggestions suggestion
  join public.activity_categories category
    on category.id = suggestion.category_id
  left join public.communities community
    on community.id = suggestion.linked_community_id
  where suggestion.suggested_by_user_id = auth.uid()
  order by suggestion.created_at desc;
end;
$$;

-- ============================================================
-- ADMIN MANAGEMENT
-- ============================================================

create or replace function public.get_admin_pending_community_suggestion_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  return (
    select count(*)
    from public.community_suggestions suggestion
    where suggestion.status = 'pending'
  );
end;
$$;

create or replace function public.get_admin_community_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            category.id,
            'name',
            category.name,
            'is_active',
            category.is_active
          )
          order by category.name
        )
        from public.activity_categories category
      ),
      '[]'::jsonb
    ),

    'communities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            community.id,
            'name',
            community.name,
            'slug',
            community.slug,
            'description',
            community.description,
            'icon_key',
            community.icon_key,
            'icon_url',
            community.icon_url,
            'category_id',
            community.category_id,
            'category_name',
            category.name,
            'status',
            community.status,
            'intent_count',
            (
              select count(*)
              from public.intents intent
              where intent.community_id = community.id
            ),
            'created_at',
            community.created_at,
            'updated_at',
            community.updated_at
          )
          order by
            case community.status
              when 'active' then 0
              when 'inactive' then 1
              else 2
            end,
            category.name,
            community.name
        )
        from public.communities community
        join public.activity_categories category
          on category.id = community.category_id
      ),
      '[]'::jsonb
    ),

    'suggestions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            suggestion.id,
            'suggested_name',
            suggestion.suggested_name,
            'description',
            suggestion.description,
            'category_id',
            suggestion.category_id,
            'category_name',
            category.name,
            'status',
            suggestion.status,
            'suggested_by_user_id',
            suggestion.suggested_by_user_id,
            'suggested_by_name',
            coalesce(
              profile.full_name,
              profile.username,
              'UIN member'
            ),
            'suggested_by_username',
            profile.username,
            'suggested_by_email',
            profile.email,
            'linked_community_id',
            suggestion.linked_community_id,
            'linked_community_name',
            linked_community.name,
            'review_note',
            suggestion.review_note,
            'created_at',
            suggestion.created_at,
            'reviewed_at',
            suggestion.reviewed_at
          )
          order by
            case suggestion.status
              when 'pending' then 0
              else 1
            end,
            suggestion.created_at desc
        )
        from public.community_suggestions suggestion
        join public.activity_categories category
          on category.id = suggestion.category_id
        join public.profiles profile
          on profile.id = suggestion.suggested_by_user_id
        left join public.communities linked_community
          on linked_community.id = suggestion.linked_community_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.admin_create_community(
  p_name text,
  p_slug text,
  p_description text,
  p_icon_key text,
  p_icon_url text,
  p_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community_id uuid;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.activity_categories category
    where category.id = p_category_id
  ) then
    raise exception
      'Activity category not found.'
      using errcode = 'P0002';
  end if;

  insert into public.communities (
    name,
    normalized_name,
    slug,
    description,
    icon_key,
    icon_url,
    category_id,
    status,
    created_by_admin_id,
    updated_by_admin_id
  )
  values (
    p_name,
    public.normalize_community_name(p_name),
    p_slug,
    p_description,
    coalesce(
      nullif(
        lower(
          btrim(
            coalesce(
              p_icon_key,
              ''
            )
          )
        ),
        ''
      ),
      'people'
    ),
    p_icon_url,
    p_category_id,
    'active',
    auth.uid(),
    auth.uid()
  )
  returning id
  into v_community_id;

  return v_community_id;
end;
$$;

create or replace function public.admin_update_community(
  p_community_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_icon_key text,
  p_icon_url text,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.activity_categories category
    where category.id = p_category_id
  ) then
    raise exception
      'Activity category not found.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.intents intent
    join public.activities activity
      on activity.id = intent.activity_id
    where intent.community_id = p_community_id
      and activity.category_id <> p_category_id
  ) then
    raise exception
      'This Community already has Intents in another Activity category and cannot be moved.'
      using errcode = '22023';
  end if;

  update public.communities
  set
    name = p_name,
    normalized_name =
      public.normalize_community_name(
        p_name
      ),
    slug = p_slug,
    description = p_description,
    icon_key = p_icon_key,
    icon_url = p_icon_url,
    category_id = p_category_id,
    updated_by_admin_id = auth.uid(),
    updated_at = now()
  where id = p_community_id;

  if not found then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_community_status(
  p_community_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_status :=
    lower(
      btrim(
        coalesce(
          p_status,
          ''
        )
      )
    );

  if v_status not in (
    'active',
    'inactive',
    'archived'
  ) then
    raise exception
      'Unsupported Community status.'
      using errcode = '22023';
  end if;

  update public.communities
  set
    status = v_status,
    updated_by_admin_id = auth.uid(),
    updated_at = now()
  where id = p_community_id;

  if not found then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_resolve_community_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_existing_community_id uuid default null,
  p_new_name text default null,
  p_new_slug text default null,
  p_description text default null,
  p_icon_key text default 'people',
  p_icon_url text default null,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_suggestion public.community_suggestions%rowtype;
  v_community_id uuid;
  v_name text;
  v_slug text;
  v_description text;
  v_review_note text;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_action :=
    lower(
      btrim(
        coalesce(
          p_action,
          ''
        )
      )
    );

  if v_action not in (
    'approve_new',
    'merge_existing',
    'reject'
  ) then
    raise exception
      'Unsupported Community suggestion action.'
      using errcode = '22023';
  end if;

  select *
  into v_suggestion
  from public.community_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      'Community suggestion not found.'
      using errcode = 'P0002';
  end if;

  if v_suggestion.status <> 'pending' then
    raise exception
      'This Community suggestion has already been reviewed.'
      using errcode = '22023';
  end if;

  v_review_note :=
    nullif(
      btrim(
        coalesce(
          p_review_note,
          ''
        )
      ),
      ''
    );

  if v_action = 'merge_existing' then
    select community.id
    into v_community_id
    from public.communities community
    where community.id = p_existing_community_id
      and community.category_id = v_suggestion.category_id;

    if v_community_id is null then
      raise exception
        'Select an existing Community from the same Activity category.'
        using errcode = '22023';
    end if;

    insert into public.community_aliases (
      community_id,
      alias,
      normalized_alias,
      created_by_admin_id
    )
    values (
      v_community_id,
      v_suggestion.suggested_name,
      v_suggestion.normalized_name,
      auth.uid()
    )
    on conflict (
      normalized_alias
    )
    do nothing;

    update public.community_suggestions
    set
      status = 'merged_existing',
      linked_community_id = v_community_id,
      reviewed_by_admin_id = auth.uid(),
      review_note = v_review_note,
      reviewed_at = now(),
      updated_at = now()
    where id = p_suggestion_id;

    return v_community_id;
  end if;

  if v_action = 'approve_new' then
    v_name :=
      coalesce(
        nullif(
          btrim(
            coalesce(
              p_new_name,
              ''
            )
          ),
          ''
        ),
        v_suggestion.suggested_name
      );

    v_slug :=
      lower(
        btrim(
          coalesce(
            p_new_slug,
            ''
          )
        )
      );

    v_description :=
      coalesce(
        nullif(
          btrim(
            coalesce(
              p_description,
              ''
            )
          ),
          ''
        ),
        v_suggestion.description
      );

    if v_slug = '' then
      raise exception
        'A slug is required for the approved Community.'
        using errcode = '22023';
    end if;

    v_community_id :=
      public.admin_create_community(
        v_name,
        v_slug,
        v_description,
        p_icon_key,
        p_icon_url,
        v_suggestion.category_id
      );

    if public.normalize_community_name(
      v_name
    ) <> v_suggestion.normalized_name
    then
      insert into public.community_aliases (
        community_id,
        alias,
        normalized_alias,
        created_by_admin_id
      )
      values (
        v_community_id,
        v_suggestion.suggested_name,
        v_suggestion.normalized_name,
        auth.uid()
      )
      on conflict (
        normalized_alias
      )
      do nothing;
    end if;

    update public.community_suggestions
    set
      status = 'approved_new',
      linked_community_id = v_community_id,
      reviewed_by_admin_id = auth.uid(),
      review_note = v_review_note,
      reviewed_at = now(),
      updated_at = now()
    where id = p_suggestion_id;

    return v_community_id;
  end if;

  update public.community_suggestions
  set
    status = 'rejected',
    linked_community_id = null,
    reviewed_by_admin_id = auth.uid(),
    review_note = v_review_note,
    reviewed_at = now(),
    updated_at = now()
  where id = p_suggestion_id;

  return null;
end;
$$;

-- ============================================================
-- VISIBLE CONTEXT + DISCOVERY
-- ============================================================

create or replace function public.get_visible_intent_communities(
  p_intent_ids uuid[]
)
returns table (
  intent_id uuid,
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  category_id uuid,
  community_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select
    intent.id,
    community.id,
    community.name,
    community.slug,
    community.description,
    community.icon_key,
    community.icon_url,
    community.category_id,
    community.status
  from public.intents intent
  join public.communities community
    on community.id = intent.community_id
  where intent.id = any(
    coalesce(
      p_intent_ids,
      array[]::uuid[]
    )
  )
    and community.status = 'active'
    and public.can_user_view_intent_activity(
      intent.id,
      v_user_id
    );
end;
$$;

CREATE OR REPLACE FUNCTION public.search_visible_intents_by_community(p_community_id uuid, p_query text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_activity_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_lifecycle text DEFAULT 'all'::text, p_scope text DEFAULT 'all'::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS TABLE(intent_id uuid, plan_id uuid, plan_status text, owner_user_id uuid, owner_full_name text, owner_username text, owner_avatar_url text, activity_id uuid, activity_name text, activity_cover_url text, category_id uuid, category_name text, category_cover_url text, location_id uuid, city text, district text, start_date date, end_date date, timezone text, scheduled_start timestamp with time zone, scheduled_end timestamp with time zone, completed_at timestamp with time zone, cancelled_at timestamp with time zone, people text, budget numeric, recurrence text, visibility text, intent_type text, intent_status text, recruitment_status text, matching_status text, expired_at timestamp with time zone, lifecycle_status text, max_participants integer, active_participant_count integer, viewer_can_request boolean, viewer_is_member boolean, viewer_invitation_status text, viewer_request_status text, viewer_request_id uuid, created_at timestamp with time zone, relevance integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_query text;
  v_lifecycle text;
  v_scope text;
  v_limit integer;
  v_offset integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  if not exists (
    select 1
    from public.communities community
    where community.id = p_community_id
      and community.status = 'active'
  ) then
    raise exception
      'Community not found or inactive.'
      using errcode = 'P0002';
  end if;

  if
    p_start_date is not null
    and p_end_date is not null
    and p_end_date < p_start_date
  then
    raise exception
      'Search end date cannot be earlier than the start date.'
      using errcode = '22023';
  end if;

  v_query :=
    nullif(
      public.normalize_activity_catalogue_name(
        p_query
      ),
      ''
    );

  v_lifecycle :=
    lower(
      btrim(
        coalesce(
          p_lifecycle,
          'all'
        )
      )
    );

  if v_lifecycle not in (
    'all',
    'current',
    'open',
    'future',
    'forming',
    'planned',
    'closed',
    'completed',
    'cancelled',
    'expired',
    'history'
  ) then
    raise exception
      'Unsupported Intent lifecycle filter.'
      using errcode = '22023';
  end if;

  v_scope :=
    lower(
      btrim(
        coalesce(
          p_scope,
          'all'
        )
      )
    );

  if v_scope not in (
    'all',
    'mine',
    'friends',
    'others'
  ) then
    raise exception
      'Unsupported Intent ownership filter.'
      using errcode = '22023';
  end if;

  v_limit :=
    least(
      greatest(
        coalesce(
          p_limit,
          24
        ),
        1
      ),
      60
    );

  v_offset :=
    greatest(
      coalesce(
        p_offset,
        0
      ),
      0
    );

  return query
  with plan_resources as (
    select
      host_intent.id::uuid
        as intent_id,

      plan.id::uuid
        as plan_id,

      plan.status::text
        as plan_status,

      plan.host_user_id::uuid
        as owner_user_id,

      owner_profile.full_name::text
        as owner_full_name,

      owner_profile.username::text
        as owner_username,

      owner_profile.avatar_url::text
        as owner_avatar_url,

      activity.id::uuid
        as activity_id,

      activity.name::text
        as activity_name,

      activity.default_cover_url::text
        as activity_cover_url,

      category.id::uuid
        as category_id,

      category.name::text
        as category_name,

      category.default_cover_url::text
        as category_cover_url,

      location.id::uuid
        as location_id,

      coalesce(
        location.city,
        location.country_name
      )::text
        as city,

      location.district::text
        as district,

      plan.window_start::date
        as start_date,

      plan.window_end::date
        as end_date,

      plan.timezone::text
        as timezone,

      plan.scheduled_start::timestamptz
        as scheduled_start,

      plan.scheduled_end::timestamptz
        as scheduled_end,

      plan.completed_at::timestamptz
        as completed_at,

      plan.cancelled_at::timestamptz
        as cancelled_at,

      host_intent.people::text
        as people,

      coalesce(
        plan.target_budget,
        host_intent.budget,
        plan.budget
      )::numeric
        as budget,

      host_intent.recurrence::text
        as recurrence,

      coalesce(
        host_intent.visibility,
        plan.visibility
      )::text
        as visibility,

      host_intent.intent_type::text
        as intent_type,

      host_intent.status::text
        as intent_status,

      plan.recruitment_status::text
        as recruitment_status,

      host_intent.matching_status::text
        as matching_status,

      coalesce(
        plan.expired_at,
        host_intent.expired_at
      )::timestamptz
        as expired_at,

      (
        case
          when plan.status =
            'completed'
            then 'completed'

          when plan.status =
            'cancelled'
            then 'cancelled'

          when
            plan.status =
              'forming'

            and (
              plan.expired_at is not null
              or plan.window_end < current_date
            )
            then 'expired'

          when plan.status =
            'forming'
            then 'forming'

          when
            plan.status =
              'planned'
            and (
              plan.expired_at is not null
              or (
                plan.scheduled_end is not null
                and plan.scheduled_end <=
                  now() - interval '24 hours'
              )
              or (
                plan.scheduled_end is null
                and plan.window_end <
                  current_date
              )
            )
            then 'expired'

          when plan.status =
            'planned'
            then 'planned'

          else 'closed'
        end
      )::text
        as lifecycle_status,

      coalesce(
        plan.max_participants,
        host_intent.max_participants
      )::integer
        as max_participants,

      (
        select count(*)::integer
        from public.plan_members member
        where
          member.plan_id = plan.id
          and member.role = 'participant'
          and member.status = 'active'
      )::integer
        as active_participant_count,

      (
        plan.status = 'forming'
        and public.can_user_request_join_intent(
          host_intent.id,
          v_user_id
        )
      )::boolean
        as viewer_can_request,

      (
        plan.host_user_id = v_user_id
        or exists (
          select 1
          from public.plan_members member
          where
            member.plan_id = plan.id
            and member.user_id = v_user_id
            and member.status = 'active'
        )
      )::boolean
        as viewer_is_member,

      viewer_invitation.invitation_status::text
        as viewer_invitation_status,

      viewer_request.request_status::text
        as viewer_request_status,

      viewer_request.request_id::uuid
        as viewer_request_id,

      plan.created_at::timestamptz
        as created_at,

      (
        case
          when v_query is null then 0

          when public.normalize_activity_catalogue_name(
            activity.name
          ) = v_query then 100

          when alias_search.exact_alias then 95

          when public.normalize_activity_catalogue_name(
            activity.name
          ) like v_query || '%' then 90

          when alias_search.prefix_alias then 85

          when public.normalize_activity_catalogue_name(
            activity.name
          ) like '%' || v_query || '%' then 80

          when alias_search.contains_alias then 75

          when public.normalize_activity_catalogue_name(
            category.name
          ) like '%' || v_query || '%' then 60

          when public.normalize_activity_catalogue_name(
            location.district
          ) like '%' || v_query || '%' then 55

          when public.normalize_activity_catalogue_name(
            location.city
          ) like '%' || v_query || '%' then 50

          else 0
        end
      )::integer
        as relevance

    from public.plans plan

    join lateral (
      select source_intent.*
      from public.plan_intents plan_intent

      join public.intents source_intent
        on source_intent.id =
          plan_intent.intent_id

      where
        plan_intent.plan_id = plan.id
        and plan_intent.status = 'active'

      order by
        case
          when plan_intent.relationship =
            'host_source'
            then 0

          when source_intent.user_id =
            plan.host_user_id
            then 1

          else 2
        end,
        plan_intent.created_at asc,
        source_intent.id asc

      limit 1
    ) host_intent
      on true

    join public.activities activity
      on activity.id = plan.activity_id

    join public.activity_categories category
      on category.id = activity.category_id

    join public.locations location
      on location.id = plan.location_id

    left join public.profiles owner_profile
      on owner_profile.id = plan.host_user_id

    left join lateral (
      select
        coalesce(
          bool_or(
            alias.normalized_alias = v_query
          ),
          false
        )::boolean as exact_alias,

        coalesce(
          bool_or(
            alias.normalized_alias like v_query || '%'
          ),
          false
        )::boolean as prefix_alias,

        coalesce(
          bool_or(
            alias.normalized_alias like '%' || v_query || '%'
          ),
          false
        )::boolean as contains_alias

      from public.activity_aliases alias
      where
        alias.activity_id = activity.id
        and v_query is not null
    ) alias_search
      on true

    left join lateral (
      select
        (
          case
            when invitation.status = 'pending'
              and invitation.expires_at <= now()
              then 'expired'
            else invitation.status
          end
        )::text as invitation_status

      from public.intent_invitations invitation
      where
        invitation.intent_id = host_intent.id
        and invitation.invited_user_id = v_user_id

      order by invitation.created_at desc
      limit 1
    ) viewer_invitation
      on true

    left join lateral (
      select
        request.id::uuid as request_id,
        request.status::text as request_status

      from public.intent_join_requests request
      where
        request.intent_id = host_intent.id
        and request.requester_user_id = v_user_id

      order by request.created_at desc
      limit 1
    ) viewer_request
      on true

    where
      host_intent.community_id =
        p_community_id

      and (
        plan.host_user_id = v_user_id

        or exists (
          select 1
          from public.plan_members member
          where
            member.plan_id = plan.id
            and member.user_id = v_user_id
            and member.status = 'active'
        )

        or public.can_user_view_intent_activity(
          host_intent.id,
          v_user_id
        )
      )

      and (
        v_scope = 'all'

        or (
          v_scope = 'mine'
          and plan.host_user_id = v_user_id
        )

        or (
          v_scope = 'friends'
          and plan.host_user_id <> v_user_id
          and coalesce(
            public.are_users_friends(
              plan.host_user_id,
              v_user_id
            ),
            false
          )
        )

        or (
          v_scope = 'others'
          and plan.host_user_id <> v_user_id
        )
      )

      and (
        p_category_id is null
        or category.id = p_category_id
      )

      and (
        p_activity_id is null
        or activity.id = p_activity_id
      )

      and (
        p_location_id is null
        or public.locations_overlap(
          location.id,
          p_location_id
        )
      )

      and (
        p_start_date is null
        or (
          case
            when plan.status in ('planned', 'completed')
              and plan.scheduled_end is not null
              then (plan.scheduled_end at time zone plan.timezone)::date
            else plan.window_end
          end
        ) >= p_start_date
      )

      and (
        p_end_date is null
        or (
          case
            when plan.status in ('planned', 'completed')
              and plan.scheduled_start is not null
              then (plan.scheduled_start at time zone plan.timezone)::date
            else plan.window_start
          end
        ) <= p_end_date
      )

      and (
        v_query is null

        or public.normalize_activity_catalogue_name(
          activity.name
        ) like '%' || v_query || '%'

        or alias_search.contains_alias

        or public.normalize_activity_catalogue_name(
          category.name
        ) like '%' || v_query || '%'

        or public.normalize_activity_catalogue_name(
          location.district
        ) like '%' || v_query || '%'

        or public.normalize_activity_catalogue_name(
          location.city
        ) like '%' || v_query || '%'
      )
  ),

  unlinked_intent_resources as (
    select
      intent.id::uuid as intent_id,
      null::uuid as plan_id,
      null::text as plan_status,
      intent.user_id::uuid as owner_user_id,
      owner_profile.full_name::text as owner_full_name,
      owner_profile.username::text as owner_username,
      owner_profile.avatar_url::text as owner_avatar_url,
      activity.id::uuid as activity_id,
      activity.name::text as activity_name,
      activity.default_cover_url::text as activity_cover_url,
      category.id::uuid as category_id,
      category.name::text as category_name,
      category.default_cover_url::text as category_cover_url,
      location.id::uuid as location_id,
      coalesce(
        location.city,
        location.country_name
      )::text
        as city,
      location.district::text as district,
      intent.start_date::date as start_date,
      intent.end_date::date as end_date,
      'Europe/Istanbul'::text as timezone,
      null::timestamptz as scheduled_start,
      null::timestamptz as scheduled_end,
      null::timestamptz as completed_at,
      null::timestamptz as cancelled_at,
      intent.people::text as people,
      intent.budget::numeric as budget,
      intent.recurrence::text as recurrence,
      intent.visibility::text as visibility,
      intent.intent_type::text as intent_type,
      intent.status::text as intent_status,
      intent.recruitment_status::text as recruitment_status,
      intent.matching_status::text as matching_status,
      intent.expired_at::timestamptz as expired_at,

      (
        case
          when intent.status = 'completed' then 'completed'
          when intent.status = 'cancelled' then 'cancelled'

          when
            intent.expired_at is not null
            or (
              intent.status = 'active'
              and intent.end_date < current_date
            )
            then 'expired'

          when intent.status = 'planned' then 'planned'

          when
            intent.status = 'active'
            and (
              intent.recruitment_status = 'closed'
              or intent.matching_status in (
                'paused',
                'matched',
                'closed'
              )
            )
            then 'closed'

          when
            intent.status = 'active'
            and intent.start_date > current_date
            then 'future'

          else 'open'
        end
      )::text as lifecycle_status,

      intent.max_participants::integer as max_participants,

      (
        select count(*)::integer
        from public.intent_participants participant
        where
          participant.intent_id = intent.id
          and participant.status = 'active'
          and participant.user_id <> intent.user_id
      )::integer as active_participant_count,

      public.can_user_request_join_intent(
        intent.id,
        v_user_id
      )::boolean as viewer_can_request,

      (
        intent.user_id = v_user_id
        or exists (
          select 1
          from public.intent_participants participant
          where
            participant.intent_id = intent.id
            and participant.user_id = v_user_id
            and participant.status = 'active'
        )
      )::boolean as viewer_is_member,

      viewer_invitation.invitation_status::text
        as viewer_invitation_status,

      viewer_request.request_status::text
        as viewer_request_status,

      viewer_request.request_id::uuid
        as viewer_request_id,

      intent.created_at::timestamptz
        as created_at,

      (
        case
          when v_query is null then 0
          when public.normalize_activity_catalogue_name(activity.name) = v_query then 100
          when alias_search.exact_alias then 95
          when public.normalize_activity_catalogue_name(activity.name) like v_query || '%' then 90
          when alias_search.prefix_alias then 85
          when public.normalize_activity_catalogue_name(activity.name) like '%' || v_query || '%' then 80
          when alias_search.contains_alias then 75
          when public.normalize_activity_catalogue_name(category.name) like '%' || v_query || '%' then 60
          when public.normalize_activity_catalogue_name(location.district) like '%' || v_query || '%' then 55
          when public.normalize_activity_catalogue_name(location.city) like '%' || v_query || '%' then 50
          when public.normalize_activity_catalogue_name(location.country_name) like '%' || v_query || '%' then 45
          else 0
        end
      )::integer as relevance

    from public.intents intent

    join public.activities activity
      on activity.id = intent.activity_id

    join public.activity_categories category
      on category.id = activity.category_id

    join public.locations location
      on location.id = intent.location_id

    left join public.profiles owner_profile
      on owner_profile.id = intent.user_id

    left join lateral (
      select
        coalesce(bool_or(alias.normalized_alias = v_query), false)::boolean as exact_alias,
        coalesce(bool_or(alias.normalized_alias like v_query || '%'), false)::boolean as prefix_alias,
        coalesce(bool_or(alias.normalized_alias like '%' || v_query || '%'), false)::boolean as contains_alias
      from public.activity_aliases alias
      where
        alias.activity_id = activity.id
        and v_query is not null
    ) alias_search
      on true

    left join lateral (
      select
        (
          case
            when invitation.status = 'pending'
              and invitation.expires_at <= now()
              then 'expired'
            else invitation.status
          end
        )::text as invitation_status
      from public.intent_invitations invitation
      where
        invitation.intent_id = intent.id
        and invitation.invited_user_id = v_user_id
      order by invitation.created_at desc
      limit 1
    ) viewer_invitation
      on true

    left join lateral (
      select
        request.id::uuid as request_id,
        request.status::text as request_status
      from public.intent_join_requests request
      where
        request.intent_id = intent.id
        and request.requester_user_id = v_user_id
      order by request.created_at desc
      limit 1
    ) viewer_request
      on true

    where
      intent.community_id =
        p_community_id

      and not exists (
        select 1
        from public.plan_intents plan_intent
        where
          plan_intent.intent_id = intent.id
          and plan_intent.status = 'active'
      )

      and (
        intent.user_id = v_user_id

        or exists (
          select 1
          from public.intent_participants participant
          where
            participant.intent_id = intent.id
            and participant.user_id = v_user_id
            and participant.status = 'active'
        )

        or public.can_user_view_intent_activity(
          intent.id,
          v_user_id
        )
      )

      and (
        v_scope = 'all'

        or (
          v_scope = 'mine'
          and intent.user_id = v_user_id
        )

        or (
          v_scope = 'friends'
          and intent.user_id <> v_user_id
          and coalesce(
            public.are_users_friends(
              intent.user_id,
              v_user_id
            ),
            false
          )
        )

        or (
          v_scope = 'others'
          and intent.user_id <> v_user_id
        )
      )

      and (
        p_category_id is null
        or category.id = p_category_id
      )

      and (
        p_activity_id is null
        or activity.id = p_activity_id
      )

      and (
        p_location_id is null
        or public.locations_overlap(
          location.id,
          p_location_id
        )
      )

      and (
        p_start_date is null
        or intent.end_date >= p_start_date
      )

      and (
        p_end_date is null
        or intent.start_date <= p_end_date
      )

      and (
        v_query is null
        or public.normalize_activity_catalogue_name(activity.name) like '%' || v_query || '%'
        or alias_search.contains_alias
        or public.normalize_activity_catalogue_name(category.name) like '%' || v_query || '%'
        or public.normalize_activity_catalogue_name(location.district) like '%' || v_query || '%'
        or public.normalize_activity_catalogue_name(location.city) like '%' || v_query || '%'
        or public.normalize_activity_catalogue_name(location.country_name) like '%' || v_query || '%'
      )
  ),

  base_resources as (
    select * from plan_resources
    union all
    select * from unlinked_intent_resources
  ),

  filtered_resources as (
    select base_resources.*
    from base_resources
    where
      v_lifecycle = 'all'
      or (
        v_lifecycle = 'current'
        and base_resources.lifecycle_status in (
          'forming',
          'open',
          'future'
        )
      )
      or base_resources.lifecycle_status = v_lifecycle
      or (
        v_lifecycle = 'history'
        and base_resources.lifecycle_status in (
          'completed',
          'cancelled',
          'expired'
        )
      )
  ),

  counted_resources as (
    select
      filtered_resources.*,
      count(*) over()::bigint as total_count
    from filtered_resources
  )

  select
    counted_resources.intent_id,
    counted_resources.plan_id,
    counted_resources.plan_status,
    counted_resources.owner_user_id,
    counted_resources.owner_full_name,
    counted_resources.owner_username,
    counted_resources.owner_avatar_url,
    counted_resources.activity_id,
    counted_resources.activity_name,
    counted_resources.activity_cover_url,
    counted_resources.category_id,
    counted_resources.category_name,
    counted_resources.category_cover_url,
    counted_resources.location_id,
    counted_resources.city,
    counted_resources.district,
    counted_resources.start_date,
    counted_resources.end_date,
    counted_resources.timezone,
    counted_resources.scheduled_start,
    counted_resources.scheduled_end,
    counted_resources.completed_at,
    counted_resources.cancelled_at,
    counted_resources.people,
    counted_resources.budget,
    counted_resources.recurrence,
    counted_resources.visibility,
    counted_resources.intent_type,
    counted_resources.intent_status,
    counted_resources.recruitment_status,
    counted_resources.matching_status,
    counted_resources.expired_at,
    counted_resources.lifecycle_status,
    counted_resources.max_participants,
    counted_resources.active_participant_count,
    counted_resources.viewer_can_request,
    counted_resources.viewer_is_member,
    counted_resources.viewer_invitation_status,
    counted_resources.viewer_request_status,
    counted_resources.viewer_request_id,
    counted_resources.created_at,
    counted_resources.relevance,
    counted_resources.total_count

  from counted_resources

  order by
    case
      when v_lifecycle = 'current'
        and counted_resources.lifecycle_status = 'forming'
        then 0
      when v_lifecycle = 'current'
        then 1
      else 0
    end asc,

    case
      when
        v_lifecycle = 'current'
        and v_query is null
        and p_category_id is null
        and p_activity_id is null
        and p_location_id is null
        and p_start_date is null
        and p_end_date is null
      then md5(
        coalesce(
          counted_resources.plan_id::text,
          counted_resources.intent_id::text
        )
        || ':'
        || v_user_id::text
        || ':'
        || current_date::text
      )
      else null
    end asc nulls last,

    counted_resources.relevance desc,

    case
      when counted_resources.lifecycle_status in (
        'open',
        'future',
        'forming',
        'planned'
      ) then 0
      when counted_resources.lifecycle_status = 'closed' then 1
      when counted_resources.lifecycle_status = 'completed' then 2
      when counted_resources.lifecycle_status = 'cancelled' then 3
      else 4
    end asc,

    (
      counted_resources.owner_user_id = v_user_id
    ) desc,

    case
      when counted_resources.start_date >= current_date
        then counted_resources.start_date
      else null
    end asc nulls last,

    counted_resources.created_at desc,
    counted_resources.plan_id desc nulls last,
    counted_resources.intent_id desc

  limit v_limit
  offset v_offset;
end;
$function$;

-- ============================================================
-- ACTIVITY REQUEST DRAFTS + MATCH ENGINE
-- ============================================================

create or replace function
  public.submit_activity_request_draft(
    p_selected_category_id uuid,
    p_proposed_activity_name text,
    p_description text,
    p_start_date date,
    p_end_date date,
    p_people text,
    p_location_id uuid,
    p_budget integer,
    p_recurrence text,
    p_visibility text,
    p_notes text,
    p_intent_type text,
    p_max_participants integer,
    p_community_id uuid,
    p_timing_mode text default 'flexible'
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_category_name text;
  v_activity_name text;
  v_normalized_activity_name text;
  v_description text;
  v_people text;
  v_recurrence text;
  v_visibility text;
  v_notes text;
  v_intent_type text;
  v_timing_mode text;
  v_existing_activity_name text;
  v_existing_activity_category text;
  v_suggestion_id uuid;
  v_existing_draft_id uuid;
  v_open_draft_count integer;
  v_recent_new_suggestion_count integer;
  v_draft_id uuid;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'intent_creation'
  );

  select category.name
  into v_category_name
  from public.activity_categories category
  where
    category.id =
      p_selected_category_id
    and category.is_active = true;

  if v_category_name is null then
    raise exception
      'Select an active Activity category.'
      using errcode = '22023';
  end if;

  if p_community_id is not null
     and not exists (
       select 1
       from public.communities community
       where community.id = p_community_id
         and community.category_id = p_selected_category_id
         and community.status = 'active'
     )
  then
    raise exception
      'Select an active Community that belongs to the chosen Activity category.'
      using errcode = '22023';
  end if;

  v_activity_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_proposed_activity_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  v_normalized_activity_name :=
    public.normalize_activity_catalogue_name(
      v_activity_name
    );

  v_description :=
    btrim(
      coalesce(
        p_description,
        ''
      )
    );

  v_people :=
    btrim(
      coalesce(
        p_people,
        ''
      )
    );

  v_recurrence :=
    btrim(
      coalesce(
        p_recurrence,
        ''
      )
    );

  v_visibility :=
    lower(
      btrim(
        coalesce(
          p_visibility,
          ''
        )
      )
    );

  v_notes :=
    nullif(
      btrim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    );

  v_intent_type :=
    btrim(
      coalesce(
        p_intent_type,
        ''
      )
    );

  v_timing_mode :=
    lower(
      btrim(
        coalesce(
          p_timing_mode,
          'flexible'
        )
      )
    );

  if char_length(v_activity_name) not between 3 and 120 then
    raise exception
      'Suggested Activity name must contain between 3 and 120 characters.'
      using errcode = '22023';
  end if;

  if char_length(v_description) not between 30 and 2000 then
    raise exception
      'Explain the requested Activity in 30 to 2000 characters.'
      using errcode = '22023';
  end if;

  if p_start_date is null
     or p_end_date is null
     or p_end_date < p_start_date
  then
    raise exception
      'A valid Intent date range is required.'
      using errcode = '22023';
  end if;

  if v_people = '' then
    raise exception
      'Participation preference is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.locations location
    where location.id =
      p_location_id
  ) then
    raise exception
      'Location not found.'
      using errcode = 'P0002';
  end if;

  if p_budget is not null
     and p_budget < 0
  then
    raise exception
      'Budget cannot be negative.'
      using errcode = '22023';
  end if;

  if v_recurrence not in (
    'one-time',
    'daily',
    'weekly',
    'monthly'
  ) then
    raise exception
      'Unsupported recurrence.'
      using errcode = '22023';
  end if;

  if v_visibility not in (
    'public',
    'friends',
    'except_friends',
    'invite_only',
    'private'
  ) then
    raise exception
      'Unsupported visibility.'
      using errcode = '22023';
  end if;

  if v_intent_type = '' then
    raise exception
      'Intent type is required.'
      using errcode = '22023';
  end if;

  if p_max_participants is not null
     and p_max_participants < 1
  then
    raise exception
      'Participant capacity must be at least 1.'
      using errcode = '22023';
  end if;

  if v_timing_mode not in (
    'flexible',
    'scheduled'
  ) then
    raise exception
      'Unsupported timing mode.'
      using errcode = '22023';
  end if;

  select
    activity.name,
    category.name
  into
    v_existing_activity_name,
    v_existing_activity_category
  from public.activities activity
  join public.activity_categories category
    on category.id =
      activity.category_id
  where
    activity.is_active = true
    and category.is_active = true
    and (
      public.normalize_activity_catalogue_name(
        activity.name
      ) =
        v_normalized_activity_name
      or exists (
        select 1
        from public.activity_aliases alias
        where
          alias.activity_id =
            activity.id
          and alias.normalized_alias =
            v_normalized_activity_name
      )
    )
  limit 1;

  if v_existing_activity_name is not null then
    raise exception
      'This Activity already exists as "%" under "%". Select that canonical Activity instead.',
      v_existing_activity_name,
      v_existing_activity_category
      using errcode = '22023';
  end if;

  -- Serialize requests for the same category/name so concurrent users attach
  -- to one pending administrator item.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_selected_category_id::text ||
      ':' ||
      v_normalized_activity_name,
      0
    )
  );

  select suggestion.id
  into v_suggestion_id
  from public.activity_catalog_suggestions suggestion
  where
    suggestion.status = 'pending'
    and suggestion.requested_category_id =
      p_selected_category_id
    and suggestion.normalized_activity_name =
      v_normalized_activity_name
  order by suggestion.created_at
  limit 1;

  if v_suggestion_id is not null then
    select draft.id
    into v_existing_draft_id
    from public.intent_drafts draft
    where
      draft.user_id =
        v_user_id
      and draft.activity_suggestion_id =
        v_suggestion_id
      and draft.status =
        'awaiting_activity_review'
    order by draft.created_at desc
    limit 1;

    if v_existing_draft_id is not null then
      return v_existing_draft_id;
    end if;
  end if;

  select count(*)::integer
  into v_open_draft_count
  from public.intent_drafts draft
  where
    draft.user_id =
      v_user_id
    and draft.status =
      'awaiting_activity_review';

  if v_open_draft_count >= 3 then
    raise exception
      'You can have at most 3 Activity requests awaiting review.'
      using errcode = '22023';
  end if;

  if v_suggestion_id is null then
    select count(*)::integer
    into v_recent_new_suggestion_count
    from public.activity_catalog_suggestions suggestion
    where
      suggestion.suggested_by_user_id =
        v_user_id
      and suggestion.created_at >=
        now() - interval '30 days';

    if v_recent_new_suggestion_count >= 5 then
      raise exception
        'You can start at most 5 new Activity requests in 30 days.'
        using errcode = '22023';
    end if;

    insert into public.activity_catalog_suggestions (
      suggested_by_user_id,
      proposed_activity_name,
      proposed_category_name,
      requested_category_id,
      normalized_activity_name,
      description,
      status,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      v_activity_name,
      v_category_name,
      p_selected_category_id,
      v_normalized_activity_name,
      v_description,
      'pending',
      now(),
      now()
    )
    returning id
    into v_suggestion_id;
  end if;

  insert into public.intent_drafts (
    user_id,
    activity_suggestion_id,
    activity_id,
    request_description,
    start_date,
    end_date,
    people,
    location_id,
    budget,
    recurrence,
    visibility,
    notes,
    intent_type,
    max_participants,
    community_id,
    timing_mode,
    status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_suggestion_id,
    null,
    v_description,
    p_start_date,
    p_end_date,
    v_people,
    p_location_id,
    p_budget,
    v_recurrence,
    v_visibility,
    v_notes,
    v_intent_type,
    p_max_participants,
    p_community_id,
    v_timing_mode,
    'awaiting_activity_review',
    now(),
    now()
  )
  returning id
  into v_draft_id;

  return v_draft_id;
end;
$$;

create or replace function
  public.publish_ready_intent_draft(
    p_draft_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_draft public.intent_drafts%rowtype;
  v_activity_is_active boolean;
  v_category_is_active boolean;
  v_intent_id uuid;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'intent_creation'
  );

  select *
  into v_draft
  from public.intent_drafts draft
  where
    draft.id =
      p_draft_id
    and draft.user_id =
      v_user_id
  for update;

  if not found then
    raise exception
      'Intent draft not found.'
      using errcode = 'P0002';
  end if;

  if v_draft.status <>
    'ready_to_publish'
  then
    raise exception
      'This Intent draft is not ready to publish.'
      using errcode = '22023';
  end if;

  if v_draft.activity_id is null then
    raise exception
      'Canonical Activity has not been assigned.'
      using errcode = '22023';
  end if;

  select
    activity.is_active,
    category.is_active
  into
    v_activity_is_active,
    v_category_is_active
  from public.activities activity
  join public.activity_categories category
    on category.id =
      activity.category_id
  where activity.id =
    v_draft.activity_id;

  if not coalesce(
    v_activity_is_active,
    false
  )
  or not coalesce(
    v_category_is_active,
    false
  ) then
    raise exception
      'The assigned Activity is not currently available.'
      using errcode = '22023';
  end if;

  if v_draft.end_date <
    current_date
  then
    raise exception
      'The Intent date range has already ended. Update the draft before publishing.'
      using errcode = '22023';
  end if;

  insert into public.intents (
    user_id,
    start_date,
    end_date,
    people,
    location_id,
    activity_id,
    budget,
    recurrence,
    visibility,
    notes,
    intent_type,
    status,
    max_participants,
    recruitment_status,
    matching_status,
    timing_mode,
    community_id,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_draft.start_date,
    v_draft.end_date,
    v_draft.people,
    v_draft.location_id,
    v_draft.activity_id,
    v_draft.budget,
    v_draft.recurrence,
    v_draft.visibility,
    v_draft.notes,
    v_draft.intent_type,
    'active',
    v_draft.max_participants,
    'open',
    'open',
    v_draft.timing_mode,
    v_draft.community_id,
    now(),
    now()
  )
  returning id
  into v_intent_id;

  update public.intent_drafts
  set
    status =
      'published',
    published_intent_id =
      v_intent_id
  where id =
    p_draft_id;

  return v_intent_id;
end;
$$;

create or replace function public.get_my_active_matches()
returns table(
  own_intent_id uuid,
  own_start_date date,
  own_end_date date,
  target_intent_id uuid,
  target_user_id uuid,
  target_full_name text,
  target_username text,
  target_avatar_url text,
  activity_name text,
  category_name text,
  city text,
  district text,
  target_start_date date,
  target_end_date date,
  target_people text,
  target_budget numeric,
  target_recurrence text,
  target_visibility text,
  target_notes text,
  target_max_participants integer,
  target_created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    own_intent.id,
    own_intent.start_date,
    own_intent.end_date,
    target_intent.id,
    target_intent.user_id,
    target_profile.full_name,
    target_profile.username,
    target_profile.avatar_url,
    activity.name,
    category.name,
    coalesce(location.city, location.country_name),
    location.district,
    target_intent.start_date,
    target_intent.end_date,
    target_intent.people,
    target_intent.budget,
    target_intent.recurrence,
    target_intent.visibility,
    target_intent.notes,
    target_intent.max_participants,
    target_intent.created_at
  from public.intents own_intent
  join public.intents target_intent
    on target_intent.user_id <> own_intent.user_id
    and target_intent.activity_id = own_intent.activity_id
    and target_intent.community_id
      is not distinct from own_intent.community_id
    and public.locations_overlap(
      target_intent.location_id,
      own_intent.location_id
    )
    and target_intent.start_date <= own_intent.end_date
    and own_intent.start_date <= target_intent.end_date
  join public.activities activity
    on activity.id = target_intent.activity_id
  join public.activity_categories category
    on category.id = activity.category_id
  join public.locations location
    on location.id = target_intent.location_id
  join public.profiles target_profile
    on target_profile.id = target_intent.user_id
  where own_intent.user_id = auth.uid()
    and own_intent.status = 'active'
    and own_intent.recruitment_status = 'open'
    and own_intent.matching_status = 'open'
    and own_intent.end_date >= current_date
    and own_intent.expired_at is null
    and own_intent.archived_at is null
    and target_intent.status = 'active'
    and target_intent.recruitment_status = 'open'
    and target_intent.matching_status = 'open'
    and target_intent.end_date >= current_date
    and target_intent.expired_at is null
    and target_intent.archived_at is null
    and public.can_user_view_intent_activity(
      target_intent.id,
      auth.uid()
    )
    and public.user_satisfies_intent_professional_requirement(
      own_intent.id,
      target_intent.user_id
    )
    and public.user_satisfies_intent_professional_requirement(
      target_intent.id,
      auth.uid()
    )
    and not exists (
      select 1
      from public.intent_match_ignores ignored_match
      where ignored_match.user_id = auth.uid()
        and ignored_match.own_intent_id = own_intent.id
        and ignored_match.target_intent_id = target_intent.id
    )
    and not exists (
      select 1
      from public.intent_requests request
      where (
        request.own_intent_id = own_intent.id
        and request.target_intent_id = target_intent.id
      )
      or (
        request.own_intent_id = target_intent.id
        and request.target_intent_id = own_intent.id
      )
    )
    and not exists (
      select 1
      from public.plan_intents own_link
      join public.plan_intents target_link
        on target_link.plan_id = own_link.plan_id
      where own_link.intent_id = own_intent.id
        and target_link.intent_id = target_intent.id
        and own_link.status = 'active'
        and target_link.status = 'active'
    )
  order by
    case
      when own_intent.professional_requirement = 'preferred'
        and public.user_matches_intent_professional_preference(
          own_intent.id,
          target_intent.user_id
        )
        then 0
      when target_intent.professional_requirement = 'preferred'
        and public.user_matches_intent_professional_preference(
          target_intent.id,
          auth.uid()
        )
        then 1
      else 2
    end,
    greatest(
      own_intent.start_date,
      target_intent.start_date
    ),
    target_intent.created_at desc,
    target_intent.id;
$function$;


-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all on function public.get_active_communities(uuid)
from public;

grant execute on function public.get_active_communities(uuid)
to authenticated;

revoke all on function public.get_community_by_slug(text)
from public;

grant execute on function public.get_community_by_slug(text)
to authenticated;

revoke all on function public.submit_community_suggestion(
  text,
  text,
  uuid
)
from public;

grant execute on function public.submit_community_suggestion(
  text,
  text,
  uuid
)
to authenticated;

revoke all on function public.get_my_community_suggestions()
from public;

grant execute on function public.get_my_community_suggestions()
to authenticated;

revoke all on function public.get_admin_pending_community_suggestion_count()
from public;

grant execute on function public.get_admin_pending_community_suggestion_count()
to authenticated;

revoke all on function public.get_admin_community_catalogue()
from public;

grant execute on function public.get_admin_community_catalogue()
to authenticated;

revoke all on function public.admin_create_community(
  text,
  text,
  text,
  text,
  text,
  uuid
)
from public;

grant execute on function public.admin_create_community(
  text,
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;

revoke all on function public.admin_update_community(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid
)
from public;

grant execute on function public.admin_update_community(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;

revoke all on function public.admin_set_community_status(
  uuid,
  text
)
from public;

grant execute on function public.admin_set_community_status(
  uuid,
  text
)
to authenticated;

revoke all on function public.admin_resolve_community_suggestion(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute on function public.admin_resolve_community_suggestion(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

revoke all on function public.get_visible_intent_communities(uuid[])
from public;

grant execute on function public.get_visible_intent_communities(uuid[])
to authenticated;

revoke all on function public.search_visible_intents_by_community(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  date,
  date,
  text,
  text,
  integer,
  integer
)
from public;

grant execute on function public.search_visible_intents_by_community(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  date,
  date,
  text,
  text,
  integer,
  integer
)
to authenticated;

revoke all on function public.submit_activity_request_draft(
  uuid,
  text,
  text,
  date,
  date,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  integer,
  uuid,
  text
)
from public;

grant execute on function public.submit_activity_request_draft(
  uuid,
  text,
  text,
  date,
  date,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  integer,
  uuid,
  text
)
to authenticated;

commit;
