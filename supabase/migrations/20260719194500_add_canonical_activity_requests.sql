begin;

-- ============================================================
-- 1. CANONICAL CATALOGUE LIFECYCLE
-- ============================================================

alter table public.activity_categories
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.activities
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.activity_catalog_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_by_user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  proposed_activity_name text not null,
  proposed_category_name text,
  description text not null,
  status text not null default 'pending',
  canonical_activity_id uuid
    references public.activities(id)
    on delete set null,
  canonical_category_id uuid
    references public.activity_categories(id)
    on delete set null,
  reviewed_by uuid
    references public.profiles(id)
    on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activity_catalog_suggestions_name_check
    check (
      char_length(btrim(proposed_activity_name))
        between 2 and 120
    ),

  constraint activity_catalog_suggestions_category_check
    check (
      proposed_category_name is null
      or char_length(btrim(proposed_category_name))
        between 2 and 120
    ),

  constraint activity_catalog_suggestions_description_check
    check (
      char_length(btrim(description))
        between 10 and 2000
    ),

  constraint activity_catalog_suggestions_status_check
    check (
      status in (
        'pending',
        'mapped_existing',
        'approved_new',
        'rejected'
      )
    ),

  constraint activity_catalog_suggestions_review_note_check
    check (
      review_note is null
      or char_length(review_note) <= 2000
    )
);

create table if not exists public.activity_aliases (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null
    references public.activities(id)
    on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language_code text,
  created_from_suggestion_id uuid
    references public.activity_catalog_suggestions(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint activity_aliases_alias_check
    check (
      char_length(btrim(alias))
        between 2 and 120
    ),

  constraint activity_aliases_language_check
    check (
      language_code is null
      or language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'
    ),

  constraint activity_aliases_normalized_key
    unique (normalized_alias)
);

create table if not exists public.intent_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  activity_suggestion_id uuid not null
    references public.activity_catalog_suggestions(id)
    on delete restrict,
  activity_id uuid
    references public.activities(id)
    on delete restrict,
  start_date date not null,
  end_date date not null,
  people text not null,
  location_id uuid not null
    references public.locations(id)
    on delete restrict,
  budget integer,
  recurrence text not null default 'one-time',
  visibility text not null default 'public',
  notes text,
  intent_type text not null,
  max_participants integer,
  timing_mode text not null default 'flexible',
  status text not null default 'awaiting_activity_review',
  published_intent_id uuid
    references public.intents(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint intent_drafts_date_check
    check (end_date >= start_date),

  constraint intent_drafts_budget_check
    check (budget is null or budget >= 0),

  constraint intent_drafts_capacity_check
    check (
      max_participants is null
      or max_participants > 0
    ),

  constraint intent_drafts_visibility_check
    check (
      visibility in (
        'public',
        'friends',
        'except_friends',
        'invite_only',
        'private'
      )
    ),

  constraint intent_drafts_timing_mode_check
    check (
      timing_mode in (
        'flexible',
        'scheduled'
      )
    ),

  constraint intent_drafts_status_check
    check (
      status in (
        'awaiting_activity_review',
        'ready_to_publish',
        'published',
        'rejected',
        'cancelled'
      )
    )
);

create index if not exists
  activity_catalog_suggestions_status_created_idx
on public.activity_catalog_suggestions (
  status,
  created_at desc
);

create index if not exists
  activity_catalog_suggestions_user_idx
on public.activity_catalog_suggestions (
  suggested_by_user_id,
  created_at desc
);

create index if not exists
  activity_aliases_activity_idx
on public.activity_aliases (
  activity_id
);

create index if not exists
  intent_drafts_user_status_idx
on public.intent_drafts (
  user_id,
  status,
  created_at desc
);

create index if not exists
  intent_drafts_suggestion_idx
on public.intent_drafts (
  activity_suggestion_id
);

-- ============================================================
-- 2. ROW-LEVEL SECURITY
-- ============================================================

alter table public.activity_catalog_suggestions
  enable row level security;

alter table public.activity_aliases
  enable row level security;

alter table public.intent_drafts
  enable row level security;

drop policy if exists
  activity_aliases_public_read
on public.activity_aliases;

create policy
  activity_aliases_public_read
on public.activity_aliases
for select
to public
using (true);

drop policy if exists
  users_view_own_activity_suggestions
on public.activity_catalog_suggestions;

create policy
  users_view_own_activity_suggestions
on public.activity_catalog_suggestions
for select
to authenticated
using (
  suggested_by_user_id =
    auth.uid()
);

drop policy if exists
  users_view_own_intent_drafts
on public.intent_drafts;

create policy
  users_view_own_intent_drafts
on public.intent_drafts
for select
to authenticated
using (
  user_id =
    auth.uid()
);

-- ============================================================
-- 3. NORMALIZATION AND UPDATED-AT TRIGGERS
-- ============================================================

create or replace function
  public.normalize_activity_catalogue_name(
    p_value text
  )
returns text
language sql
immutable
set search_path = public
as $$
  select lower(
    regexp_replace(
      btrim(
        coalesce(
          p_value,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function
  public.set_activity_catalogue_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at :=
    now();

  return new;
end;
$$;

drop trigger if exists
  activity_categories_set_updated_at
on public.activity_categories;

create trigger
  activity_categories_set_updated_at
before update
on public.activity_categories
for each row
execute function
  public.set_activity_catalogue_updated_at();

drop trigger if exists
  activities_set_updated_at
on public.activities;

create trigger
  activities_set_updated_at
before update
on public.activities
for each row
execute function
  public.set_activity_catalogue_updated_at();

drop trigger if exists
  activity_catalog_suggestions_set_updated_at
on public.activity_catalog_suggestions;

create trigger
  activity_catalog_suggestions_set_updated_at
before update
on public.activity_catalog_suggestions
for each row
execute function
  public.set_activity_catalogue_updated_at();

drop trigger if exists
  intent_drafts_set_updated_at
on public.intent_drafts;

create trigger
  intent_drafts_set_updated_at
before update
on public.intent_drafts
for each row
execute function
  public.set_activity_catalogue_updated_at();

-- ============================================================
-- 4. USER-FACING CATALOGUE
-- ============================================================

create or replace function
  public.get_activity_picker_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'activities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
              activity.id,
            'name',
              activity.name,
            'category_id',
              category.id,
            'category_name',
              category.name,
            'default_cover_url',
              activity.default_cover_url,
            'category_cover_url',
              category.default_cover_url,
            'aliases',
              coalesce(
                (
                  select jsonb_agg(
                    alias.alias
                    order by alias.alias
                  )
                  from public.activity_aliases alias
                  where alias.activity_id =
                    activity.id
                ),
                '[]'::jsonb
              )
          )
          order by
            category.name,
            activity.name
        )
        from public.activities activity
        join public.activity_categories category
          on category.id =
            activity.category_id
        where
          activity.is_active = true
          and category.is_active = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ============================================================
-- 5. ADMIN CATALOGUE CRUD
-- ============================================================

create or replace function
  public.admin_create_activity_category(
    p_name text,
    p_cover_url text default null
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_cover_url text;
  v_category_id uuid;
begin
  if auth.uid() is null
     or not public.is_admin()
  then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  if char_length(v_name) not between 2 and 120 then
    raise exception
      'Category name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.activity_categories category
    where public.normalize_activity_catalogue_name(
      category.name
    ) =
      public.normalize_activity_catalogue_name(
        v_name
      )
  ) then
    raise exception
      'A category with this name already exists.'
      using errcode = '23505';
  end if;

  v_cover_url :=
    nullif(
      btrim(
        coalesce(
          p_cover_url,
          ''
        )
      ),
      ''
    );

  if v_cover_url is not null
     and v_cover_url !~* '^https?://'
  then
    raise exception
      'Cover URL must use HTTP or HTTPS.'
      using errcode = '22023';
  end if;

  insert into public.activity_categories (
    name,
    default_cover_url,
    is_active,
    created_at,
    updated_at
  )
  values (
    v_name,
    v_cover_url,
    true,
    now(),
    now()
  )
  returning id
  into v_category_id;

  return v_category_id;
end;
$$;

create or replace function
  public.admin_update_activity_category(
    p_category_id uuid,
    p_name text,
    p_is_active boolean
  )
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null
     or not public.is_admin()
  then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  if char_length(v_name) not between 2 and 120 then
    raise exception
      'Category name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.activity_categories category
    where category.id <>
      p_category_id
      and public.normalize_activity_catalogue_name(
        category.name
      ) =
        public.normalize_activity_catalogue_name(
          v_name
        )
  ) then
    raise exception
      'A category with this name already exists.'
      using errcode = '23505';
  end if;

  update public.activity_categories
  set
    name =
      v_name,
    is_active =
      coalesce(
        p_is_active,
        is_active
      )
  where id =
    p_category_id;

  if not found then
    raise exception
      'Activity category not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function
  public.admin_create_catalogue_activity(
    p_category_id uuid,
    p_name text,
    p_cover_url text default null
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_cover_url text;
  v_activity_id uuid;
begin
  if auth.uid() is null
     or not public.is_admin()
  then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.activity_categories category
    where category.id =
      p_category_id
  ) then
    raise exception
      'Activity category not found.'
      using errcode = 'P0002';
  end if;

  v_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  if char_length(v_name) not between 2 and 120 then
    raise exception
      'Activity name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.activities activity
    where activity.category_id =
      p_category_id
      and public.normalize_activity_catalogue_name(
        activity.name
      ) =
        public.normalize_activity_catalogue_name(
          v_name
        )
  ) then
    raise exception
      'This Activity already exists in the selected category.'
      using errcode = '23505';
  end if;

  v_cover_url :=
    nullif(
      btrim(
        coalesce(
          p_cover_url,
          ''
        )
      ),
      ''
    );

  if v_cover_url is not null
     and v_cover_url !~* '^https?://'
  then
    raise exception
      'Cover URL must use HTTP or HTTPS.'
      using errcode = '22023';
  end if;

  insert into public.activities (
    category_id,
    name,
    default_cover_url,
    is_active,
    created_at,
    updated_at
  )
  values (
    p_category_id,
    v_name,
    v_cover_url,
    true,
    now(),
    now()
  )
  returning id
  into v_activity_id;

  return v_activity_id;
end;
$$;

create or replace function
  public.admin_update_catalogue_activity(
    p_activity_id uuid,
    p_category_id uuid,
    p_name text,
    p_is_active boolean
  )
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null
     or not public.is_admin()
  then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.activity_categories category
    where category.id =
      p_category_id
  ) then
    raise exception
      'Activity category not found.'
      using errcode = 'P0002';
  end if;

  v_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  if char_length(v_name) not between 2 and 120 then
    raise exception
      'Activity name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.activities activity
    where activity.id <>
      p_activity_id
      and activity.category_id =
        p_category_id
      and public.normalize_activity_catalogue_name(
        activity.name
      ) =
        public.normalize_activity_catalogue_name(
          v_name
        )
  ) then
    raise exception
      'This Activity already exists in the selected category.'
      using errcode = '23505';
  end if;

  update public.activities
  set
    category_id =
      p_category_id,
    name =
      v_name,
    is_active =
      coalesce(
        p_is_active,
        is_active
      )
  where id =
    p_activity_id;

  if not found then
    raise exception
      'Activity not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function
  public.get_admin_activity_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_admin()
  then
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
              category.is_active,
            'default_cover_url',
              category.default_cover_url,
            'activity_count',
              (
                select count(*)
                from public.activities activity
                where activity.category_id =
                  category.id
              ),
            'active_activity_count',
              (
                select count(*)
                from public.activities activity
                where activity.category_id =
                  category.id
                  and activity.is_active =
                    true
              )
          )
          order by
            category.is_active desc,
            category.name
        )
        from public.activity_categories category
      ),
      '[]'::jsonb
    ),

    'activities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
              activity.id,
            'name',
              activity.name,
            'is_active',
              activity.is_active,
            'category_id',
              category.id,
            'category_name',
              category.name,
            'category_is_active',
              category.is_active,
            'default_cover_url',
              activity.default_cover_url,
            'category_cover_url',
              category.default_cover_url,
            'intent_count',
              (
                select count(*)
                from public.intents intent
                where intent.activity_id =
                  activity.id
              ),
            'plan_count',
              (
                select count(*)
                from public.plans plan
                where plan.activity_id =
                  activity.id
              ),
            'aliases',
              coalesce(
                (
                  select jsonb_agg(
                    alias.alias
                    order by alias.alias
                  )
                  from public.activity_aliases alias
                  where alias.activity_id =
                    activity.id
                ),
                '[]'::jsonb
              )
          )
          order by
            category.name,
            activity.is_active desc,
            activity.name
        )
        from public.activities activity
        join public.activity_categories category
          on category.id =
            activity.category_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ============================================================
-- 6. USER ACTIVITY REQUEST AND INTENT DRAFT
-- ============================================================

create or replace function
  public.submit_activity_request_draft(
    p_proposed_activity_name text,
    p_proposed_category_name text,
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
    p_timing_mode text default 'flexible'
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_activity_name text;
  v_category_name text;
  v_description text;
  v_people text;
  v_recurrence text;
  v_visibility text;
  v_notes text;
  v_intent_type text;
  v_timing_mode text;
  v_existing_activity_name text;
  v_suggestion_id uuid;
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

  v_category_name :=
    nullif(
      regexp_replace(
        btrim(
          coalesce(
            p_proposed_category_name,
            ''
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      ),
      ''
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

  if char_length(v_activity_name) not between 2 and 120 then
    raise exception
      'Suggested Activity name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if v_category_name is not null
     and char_length(v_category_name) not between 2 and 120
  then
    raise exception
      'Suggested category name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if char_length(v_description) not between 10 and 2000 then
    raise exception
      'Explain the requested Activity in 10 to 2000 characters.'
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
    activity.name
  into
    v_existing_activity_name
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
        public.normalize_activity_catalogue_name(
          v_activity_name
        )
      or exists (
        select 1
        from public.activity_aliases alias
        where alias.activity_id =
          activity.id
          and alias.normalized_alias =
            public.normalize_activity_catalogue_name(
              v_activity_name
            )
      )
    )
  limit 1;

  if v_existing_activity_name is not null then
    raise exception
      'This request already exists in the catalogue as "%". Select that Activity instead.',
      v_existing_activity_name
      using errcode = '22023';
  end if;

  insert into public.activity_catalog_suggestions (
    suggested_by_user_id,
    proposed_activity_name,
    proposed_category_name,
    description,
    status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_activity_name,
    v_category_name,
    v_description,
    'pending',
    now(),
    now()
  )
  returning id
  into v_suggestion_id;

  insert into public.intent_drafts (
    user_id,
    activity_suggestion_id,
    activity_id,
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
    timing_mode,
    status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_suggestion_id,
    null,
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
  public.get_my_intent_drafts()
returns table (
  draft_id uuid,
  draft_status text,
  proposed_activity_name text,
  proposed_category_name text,
  canonical_activity_name text,
  canonical_category_name text,
  review_note text,
  start_date date,
  end_date date,
  city text,
  district text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  return query
  select
    draft.id,
    draft.status,
    suggestion.proposed_activity_name,
    suggestion.proposed_category_name,
    activity.name,
    category.name,
    suggestion.review_note,
    draft.start_date,
    draft.end_date,
    location.city,
    location.district,
    draft.created_at,
    draft.updated_at
  from public.intent_drafts draft
  join public.activity_catalog_suggestions suggestion
    on suggestion.id =
      draft.activity_suggestion_id
  left join public.activities activity
    on activity.id =
      draft.activity_id
  left join public.activity_categories category
    on category.id =
      activity.category_id
  join public.locations location
    on location.id =
      draft.location_id
  where draft.user_id =
    v_user_id
  order by
    case draft.status
      when 'ready_to_publish' then 0
      when 'awaiting_activity_review' then 1
      else 2
    end,
    draft.updated_at desc;
end;
$$;

create or replace function
  public.get_my_intent_draft(
    p_draft_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'draft',
    jsonb_build_object(
      'id',
        draft.id,
      'status',
        draft.status,
      'start_date',
        draft.start_date,
      'end_date',
        draft.end_date,
      'people',
        draft.people,
      'location_id',
        draft.location_id,
      'budget',
        draft.budget,
      'recurrence',
        draft.recurrence,
      'visibility',
        draft.visibility,
      'notes',
        draft.notes,
      'intent_type',
        draft.intent_type,
      'max_participants',
        draft.max_participants,
      'timing_mode',
        draft.timing_mode,
      'published_intent_id',
        draft.published_intent_id,
      'created_at',
        draft.created_at,
      'updated_at',
        draft.updated_at
    ),

    'suggestion',
    jsonb_build_object(
      'id',
        suggestion.id,
      'proposed_activity_name',
        suggestion.proposed_activity_name,
      'proposed_category_name',
        suggestion.proposed_category_name,
      'description',
        suggestion.description,
      'status',
        suggestion.status,
      'review_note',
        suggestion.review_note,
      'reviewed_at',
        suggestion.reviewed_at
    ),

    'canonical_activity',
    case
      when activity.id is null
        then null
      else jsonb_build_object(
        'id',
          activity.id,
        'name',
          activity.name,
        'category_id',
          category.id,
        'category_name',
          category.name
      )
    end,

    'location',
    jsonb_build_object(
      'id',
        location.id,
      'city',
        location.city,
      'district',
        location.district
    )
  )
  into v_result
  from public.intent_drafts draft
  join public.activity_catalog_suggestions suggestion
    on suggestion.id =
      draft.activity_suggestion_id
  left join public.activities activity
    on activity.id =
      draft.activity_id
  left join public.activity_categories category
    on category.id =
      activity.category_id
  join public.locations location
    on location.id =
      draft.location_id
  where
    draft.id =
      p_draft_id
    and draft.user_id =
      v_user_id;

  return v_result;
end;
$$;

create or replace function
  public.update_my_intent_draft(
    p_draft_id uuid,
    p_start_date date,
    p_end_date date,
    p_people text,
    p_location_id uuid,
    p_budget integer,
    p_recurrence text,
    p_visibility text,
    p_notes text,
    p_max_participants integer,
    p_timing_mode text default 'flexible'
  )
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status text;
  v_people text;
  v_recurrence text;
  v_visibility text;
  v_notes text;
  v_timing_mode text;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select draft.status
  into v_status
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

  if v_status not in (
    'awaiting_activity_review',
    'ready_to_publish'
  ) then
    raise exception
      'This Intent draft can no longer be edited.'
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

  if p_max_participants is not null
     and p_max_participants < 1
  then
    raise exception
      'Participant capacity must be at least 1.'
      using errcode = '22023';
  end if;

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

  v_timing_mode :=
    lower(
      btrim(
        coalesce(
          p_timing_mode,
          'flexible'
        )
      )
    );

  if v_people = '' then
    raise exception
      'Participation preference is required.'
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

  if v_timing_mode not in (
    'flexible',
    'scheduled'
  ) then
    raise exception
      'Unsupported timing mode.'
      using errcode = '22023';
  end if;

  update public.intent_drafts
  set
    start_date =
      p_start_date,
    end_date =
      p_end_date,
    people =
      v_people,
    location_id =
      p_location_id,
    budget =
      p_budget,
    recurrence =
      v_recurrence,
    visibility =
      v_visibility,
    notes =
      v_notes,
    max_participants =
      p_max_participants,
    timing_mode =
      v_timing_mode
  where id =
    p_draft_id;
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

-- ============================================================
-- 7. ADMIN SUGGESTION REVIEW
-- ============================================================

create or replace function
  public.get_admin_pending_activity_suggestion_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_admin()
  then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  return (
    select count(*)
    from public.activity_catalog_suggestions suggestion
    where suggestion.status =
      'pending'
  );
end;
$$;

create or replace function
  public.get_admin_activity_suggestions(
    p_status text default null
  )
returns table (
  suggestion_id uuid,
  suggestion_status text,
  proposed_activity_name text,
  proposed_category_name text,
  description text,
  suggested_by_user_id uuid,
  user_full_name text,
  user_username text,
  user_email text,
  draft_id uuid,
  draft_status text,
  start_date date,
  end_date date,
  city text,
  district text,
  people text,
  notes text,
  canonical_activity_id uuid,
  canonical_activity_name text,
  canonical_category_name text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if auth.uid() is null
     or not public.is_admin()
  then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_status :=
    nullif(
      lower(
        btrim(
          coalesce(
            p_status,
            ''
          )
        )
      ),
      ''
    );

  if v_status is not null
     and v_status not in (
       'pending',
       'mapped_existing',
       'approved_new',
       'rejected'
     )
  then
    raise exception
      'Unsupported suggestion status.'
      using errcode = '22023';
  end if;

  return query
  select
    suggestion.id,
    suggestion.status,
    suggestion.proposed_activity_name,
    suggestion.proposed_category_name,
    suggestion.description,
    suggestion.suggested_by_user_id,
    profile.full_name,
    profile.username,
    profile.email,
    draft.id,
    draft.status,
    draft.start_date,
    draft.end_date,
    location.city,
    location.district,
    draft.people,
    draft.notes,
    activity.id,
    activity.name,
    category.name,
    suggestion.review_note,
    suggestion.reviewed_at,
    suggestion.created_at
  from public.activity_catalog_suggestions suggestion
  join public.profiles profile
    on profile.id =
      suggestion.suggested_by_user_id
  left join public.intent_drafts draft
    on draft.activity_suggestion_id =
      suggestion.id
  left join public.locations location
    on location.id =
      draft.location_id
  left join public.activities activity
    on activity.id =
      suggestion.canonical_activity_id
  left join public.activity_categories category
    on category.id =
      suggestion.canonical_category_id
  where
    v_status is null
    or suggestion.status =
      v_status
  order by
    case suggestion.status
      when 'pending' then 0
      else 1
    end,
    suggestion.created_at desc;
end;
$$;

create or replace function
  public.admin_resolve_activity_suggestion(
    p_suggestion_id uuid,
    p_action text,
    p_existing_activity_id uuid default null,
    p_existing_category_id uuid default null,
    p_new_activity_name text default null,
    p_new_category_name text default null,
    p_review_note text default null
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_user_id uuid;
  v_action text;
  v_suggestion public.activity_catalog_suggestions%rowtype;
  v_review_note text;
  v_activity_name text;
  v_category_name text;
  v_canonical_activity_id uuid;
  v_canonical_category_id uuid;
  v_resolution_status text;
  v_canonical_activity_name text;
  v_canonical_category_name text;
  v_alias_activity_id uuid;
  v_draft record;
begin
  v_admin_user_id :=
    auth.uid();

  if v_admin_user_id is null
     or not public.is_admin()
  then
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
    'map_existing',
    'create_activity',
    'create_category_and_activity',
    'reject'
  ) then
    raise exception
      'Unsupported suggestion resolution.'
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

  if v_review_note is not null
     and char_length(v_review_note) > 2000
  then
    raise exception
      'Review note cannot exceed 2000 characters.'
      using errcode = '22023';
  end if;

  select *
  into v_suggestion
  from public.activity_catalog_suggestions suggestion
  where suggestion.id =
    p_suggestion_id
  for update;

  if not found then
    raise exception
      'Activity suggestion not found.'
      using errcode = 'P0002';
  end if;

  if v_suggestion.status <>
    'pending'
  then
    raise exception
      'This Activity suggestion has already been reviewed.'
      using errcode = '22023';
  end if;

  if v_action =
    'reject'
  then
    update public.activity_catalog_suggestions
    set
      status =
        'rejected',
      reviewed_by =
        v_admin_user_id,
      reviewed_at =
        now(),
      review_note =
        v_review_note
    where id =
      p_suggestion_id;

    update public.intent_drafts
    set
      status =
        'rejected'
    where activity_suggestion_id =
      p_suggestion_id
      and status =
        'awaiting_activity_review';

    for v_draft in
      select
        draft.id,
        draft.user_id
      from public.intent_drafts draft
      where draft.activity_suggestion_id =
        p_suggestion_id
    loop
      perform public.create_app_notification(
        v_draft.user_id,
        v_admin_user_id,
        'activity_suggestion_rejected',
        'activity_catalog_suggestion',
        p_suggestion_id,
        'Your Activity request was not added to the catalogue',
        coalesce(
          v_review_note,
          'Review the request and create a new one with more detail if needed.'
        ),
        '/intent-drafts/' ||
          v_draft.id::text,
        'activity_suggestion:' ||
          p_suggestion_id::text ||
          ':rejected:' ||
          v_draft.id::text
      );
    end loop;

    return null;
  end if;

  if v_action =
    'map_existing'
  then
    select
      activity.id,
      activity.category_id
    into
      v_canonical_activity_id,
      v_canonical_category_id
    from public.activities activity
    join public.activity_categories category
      on category.id =
        activity.category_id
    where
      activity.id =
        p_existing_activity_id
      and activity.is_active =
        true
      and category.is_active =
        true;

    if v_canonical_activity_id is null then
      raise exception
        'Select an active canonical Activity.'
        using errcode = '22023';
    end if;

    v_resolution_status :=
      'mapped_existing';
  end if;

  if v_action =
    'create_activity'
  then
    if not exists (
      select 1
      from public.activity_categories category
      where
        category.id =
          p_existing_category_id
        and category.is_active =
          true
    ) then
      raise exception
        'Select an active category.'
        using errcode = '22023';
    end if;

    v_activity_name :=
      regexp_replace(
        btrim(
          coalesce(
            p_new_activity_name,
            ''
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      );

    if char_length(v_activity_name) not between 2 and 120 then
      raise exception
        'New Activity name must contain between 2 and 120 characters.'
        using errcode = '22023';
    end if;

    select activity.id
    into v_canonical_activity_id
    from public.activities activity
    where
      activity.category_id =
        p_existing_category_id
      and public.normalize_activity_catalogue_name(
        activity.name
      ) =
        public.normalize_activity_catalogue_name(
          v_activity_name
        )
    limit 1;

    if v_canonical_activity_id is null then
      insert into public.activities (
        category_id,
        name,
        is_active,
        created_at,
        updated_at
      )
      values (
        p_existing_category_id,
        v_activity_name,
        true,
        now(),
        now()
      )
      returning id
      into v_canonical_activity_id;

      v_resolution_status :=
        'approved_new';
    else
      update public.activities
      set is_active =
        true
      where id =
        v_canonical_activity_id;

      v_resolution_status :=
        'mapped_existing';
    end if;

    v_canonical_category_id :=
      p_existing_category_id;
  end if;

  if v_action =
    'create_category_and_activity'
  then
    v_category_name :=
      regexp_replace(
        btrim(
          coalesce(
            p_new_category_name,
            ''
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      );

    v_activity_name :=
      regexp_replace(
        btrim(
          coalesce(
            p_new_activity_name,
            ''
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      );

    if char_length(v_category_name) not between 2 and 120 then
      raise exception
        'New category name must contain between 2 and 120 characters.'
        using errcode = '22023';
    end if;

    if char_length(v_activity_name) not between 2 and 120 then
      raise exception
        'New Activity name must contain between 2 and 120 characters.'
        using errcode = '22023';
    end if;

    select category.id
    into v_canonical_category_id
    from public.activity_categories category
    where public.normalize_activity_catalogue_name(
      category.name
    ) =
      public.normalize_activity_catalogue_name(
        v_category_name
      )
    limit 1;

    if v_canonical_category_id is null then
      insert into public.activity_categories (
        name,
        is_active,
        created_at,
        updated_at
      )
      values (
        v_category_name,
        true,
        now(),
        now()
      )
      returning id
      into v_canonical_category_id;
    else
      update public.activity_categories
      set is_active =
        true
      where id =
        v_canonical_category_id;
    end if;

    select activity.id
    into v_canonical_activity_id
    from public.activities activity
    where
      activity.category_id =
        v_canonical_category_id
      and public.normalize_activity_catalogue_name(
        activity.name
      ) =
        public.normalize_activity_catalogue_name(
          v_activity_name
        )
    limit 1;

    if v_canonical_activity_id is null then
      insert into public.activities (
        category_id,
        name,
        is_active,
        created_at,
        updated_at
      )
      values (
        v_canonical_category_id,
        v_activity_name,
        true,
        now(),
        now()
      )
      returning id
      into v_canonical_activity_id;

      v_resolution_status :=
        'approved_new';
    else
      update public.activities
      set is_active =
        true
      where id =
        v_canonical_activity_id;

      v_resolution_status :=
        'mapped_existing';
    end if;
  end if;

  select
    activity.name,
    category.name
  into
    v_canonical_activity_name,
    v_canonical_category_name
  from public.activities activity
  join public.activity_categories category
    on category.id =
      activity.category_id
  where activity.id =
    v_canonical_activity_id;

  select alias.activity_id
  into v_alias_activity_id
  from public.activity_aliases alias
  where alias.normalized_alias =
    public.normalize_activity_catalogue_name(
      v_suggestion.proposed_activity_name
    )
  limit 1;

  if v_alias_activity_id is not null
     and v_alias_activity_id <>
       v_canonical_activity_id
  then
    raise exception
      'The proposed name is already an alias for another Activity.'
      using errcode = '23505';
  end if;

  if public.normalize_activity_catalogue_name(
    v_suggestion.proposed_activity_name
  ) <>
    public.normalize_activity_catalogue_name(
      v_canonical_activity_name
    )
  then
    insert into public.activity_aliases (
      activity_id,
      alias,
      normalized_alias,
      created_from_suggestion_id,
      created_at
    )
    values (
      v_canonical_activity_id,
      v_suggestion.proposed_activity_name,
      public.normalize_activity_catalogue_name(
        v_suggestion.proposed_activity_name
      ),
      p_suggestion_id,
      now()
    )
    on conflict (normalized_alias)
    do nothing;
  end if;

  update public.activity_catalog_suggestions
  set
    status =
      v_resolution_status,
    canonical_activity_id =
      v_canonical_activity_id,
    canonical_category_id =
      v_canonical_category_id,
    reviewed_by =
      v_admin_user_id,
    reviewed_at =
      now(),
    review_note =
      v_review_note
  where id =
    p_suggestion_id;

  update public.intent_drafts
  set
    activity_id =
      v_canonical_activity_id,
    status =
      'ready_to_publish'
  where
    activity_suggestion_id =
      p_suggestion_id
    and status =
      'awaiting_activity_review';

  for v_draft in
    select
      draft.id,
      draft.user_id
    from public.intent_drafts draft
    where draft.activity_suggestion_id =
      p_suggestion_id
  loop
    perform public.create_app_notification(
      v_draft.user_id,
      v_admin_user_id,
      'activity_suggestion_resolved',
      'activity_catalog_suggestion',
      p_suggestion_id,
      'Your Activity request was classified as "' ||
        v_canonical_activity_name ||
        '"',
      'Category: ' ||
        v_canonical_category_name ||
        case
          when v_review_note is not null
            then '. ' || v_review_note
          else ''
        end,
      '/intent-drafts/' ||
        v_draft.id::text,
      'activity_suggestion:' ||
        p_suggestion_id::text ||
        ':' ||
        v_resolution_status ||
        ':' ||
        v_draft.id::text
    );
  end loop;

  return v_canonical_activity_id;
end;
$$;

-- ============================================================
-- 8. FUNCTION PERMISSIONS
-- ============================================================

revoke all on function
  public.get_activity_picker_catalogue()
from public;

grant execute on function
  public.get_activity_picker_catalogue()
to anon, authenticated;

revoke all on function
  public.admin_create_activity_category(
    text,
    text
  )
from public;

grant execute on function
  public.admin_create_activity_category(
    text,
    text
  )
to authenticated;

revoke all on function
  public.admin_update_activity_category(
    uuid,
    text,
    boolean
  )
from public;

grant execute on function
  public.admin_update_activity_category(
    uuid,
    text,
    boolean
  )
to authenticated;

revoke all on function
  public.admin_create_catalogue_activity(
    uuid,
    text,
    text
  )
from public;

grant execute on function
  public.admin_create_catalogue_activity(
    uuid,
    text,
    text
  )
to authenticated;

revoke all on function
  public.admin_update_catalogue_activity(
    uuid,
    uuid,
    text,
    boolean
  )
from public;

grant execute on function
  public.admin_update_catalogue_activity(
    uuid,
    uuid,
    text,
    boolean
  )
to authenticated;

revoke all on function
  public.submit_activity_request_draft(
    text,
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
    text
  )
from public;

grant execute on function
  public.submit_activity_request_draft(
    text,
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
    text
  )
to authenticated;

revoke all on function
  public.get_my_intent_drafts()
from public;

grant execute on function
  public.get_my_intent_drafts()
to authenticated;

revoke all on function
  public.get_my_intent_draft(
    uuid
  )
from public;

grant execute on function
  public.get_my_intent_draft(
    uuid
  )
to authenticated;

revoke all on function
  public.update_my_intent_draft(
    uuid,
    date,
    date,
    text,
    uuid,
    integer,
    text,
    text,
    text,
    integer,
    text
  )
from public;

grant execute on function
  public.update_my_intent_draft(
    uuid,
    date,
    date,
    text,
    uuid,
    integer,
    text,
    text,
    text,
    integer,
    text
  )
to authenticated;

revoke all on function
  public.publish_ready_intent_draft(
    uuid
  )
from public;

grant execute on function
  public.publish_ready_intent_draft(
    uuid
  )
to authenticated;

revoke all on function
  public.get_admin_pending_activity_suggestion_count()
from public;

grant execute on function
  public.get_admin_pending_activity_suggestion_count()
to authenticated;

revoke all on function
  public.get_admin_activity_suggestions(
    text
  )
from public;

grant execute on function
  public.get_admin_activity_suggestions(
    text
  )
to authenticated;

revoke all on function
  public.admin_resolve_activity_suggestion(
    uuid,
    text,
    uuid,
    uuid,
    text,
    text,
    text
  )
from public;

grant execute on function
  public.admin_resolve_activity_suggestion(
    uuid,
    text,
    uuid,
    uuid,
    text,
    text,
    text
  )
to authenticated;

commit;
