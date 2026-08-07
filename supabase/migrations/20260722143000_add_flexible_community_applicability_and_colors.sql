begin;

-- ============================================================
-- FLEXIBLE COMMUNITY APPLICABILITY + BRAND ACCENT
--
-- Community remains a curated Intent context. It may now apply to:
-- - every Activity
-- - one or more Activity categories
-- - one or more exact Activities
-- - categories and exact Activities together
-- ============================================================

alter table public.communities
  add column if not exists scope_type text not null default 'restricted',
  add column if not exists accent_color text not null default '#4F46E5';

alter table public.communities
  alter column category_id drop not null;

alter table public.communities
  drop constraint if exists communities_scope_type_check;

alter table public.communities
  add constraint communities_scope_type_check
  check (
    scope_type in (
      'global',
      'restricted'
    )
  );

alter table public.communities
  drop constraint if exists communities_accent_color_check;

alter table public.communities
  add constraint communities_accent_color_check
  check (
    accent_color ~ '^#[0-9A-Fa-f]{6}$'
  );

create table if not exists public.community_category_scopes (
  community_id uuid not null
    references public.communities(id)
    on delete cascade,

  category_id uuid not null
    references public.activity_categories(id)
    on delete cascade,

  created_by_admin_id uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  primary key (
    community_id,
    category_id
  )
);

create table if not exists public.community_activity_scopes (
  community_id uuid not null
    references public.communities(id)
    on delete cascade,

  activity_id uuid not null
    references public.activities(id)
    on delete cascade,

  created_by_admin_id uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  primary key (
    community_id,
    activity_id
  )
);

create index if not exists
  community_category_scopes_category_idx
on public.community_category_scopes (
  category_id,
  community_id
);

create index if not exists
  community_activity_scopes_activity_idx
on public.community_activity_scopes (
  activity_id,
  community_id
);

insert into public.community_category_scopes (
  community_id,
  category_id,
  created_by_admin_id
)
select
  community.id,
  community.category_id,
  community.created_by_admin_id
from public.communities community
where community.category_id is not null
on conflict (
  community_id,
  category_id
)
do nothing;

alter table public.community_category_scopes
  enable row level security;

alter table public.community_activity_scopes
  enable row level security;

drop policy if exists
  active_community_category_scopes_are_visible
on public.community_category_scopes;

create policy
  active_community_category_scopes_are_visible
on public.community_category_scopes
for select
to public
using (
  exists (
    select 1
    from public.communities community
    where community.id = community_category_scopes.community_id
      and community.status = 'active'
  )
);

drop policy if exists
  active_community_activity_scopes_are_visible
on public.community_activity_scopes;

create policy
  active_community_activity_scopes_are_visible
on public.community_activity_scopes
for select
to public
using (
  exists (
    select 1
    from public.communities community
    where community.id = community_activity_scopes.community_id
      and community.status = 'active'
  )
);

revoke insert, update, delete
on public.community_category_scopes
from anon, authenticated;

revoke insert, update, delete
on public.community_activity_scopes
from anon, authenticated;

grant select
on public.community_category_scopes
  to anon, authenticated;

grant select
on public.community_activity_scopes
  to anon, authenticated;

-- ============================================================
-- NORMALIZATION
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

  new.scope_type :=
    lower(
      btrim(
        coalesce(
          new.scope_type,
          'restricted'
        )
      )
    );

  new.accent_color :=
    upper(
      btrim(
        coalesce(
          new.accent_color,
          '#4F46E5'
        )
      )
    );

  new.updated_at := now();

  return new;
end;
$$;

-- ============================================================
-- APPLICABILITY HELPERS
-- ============================================================

create or replace function public.community_applies_to_activity(
  p_community_id uuid,
  p_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities community
    join public.activities activity
      on activity.id = p_activity_id
    where community.id = p_community_id
      and (
        community.scope_type = 'global'

        or exists (
          select 1
          from public.community_activity_scopes activity_scope
          where activity_scope.community_id = community.id
            and activity_scope.activity_id = activity.id
        )

        or exists (
          select 1
          from public.community_category_scopes category_scope
          where category_scope.community_id = community.id
            and category_scope.category_id = activity.category_id
        )
      )
  );
$$;

create or replace function public.community_applies_to_category(
  p_community_id uuid,
  p_category_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communities community
    where community.id = p_community_id
      and (
        community.scope_type = 'global'

        or exists (
          select 1
          from public.community_category_scopes category_scope
          where category_scope.community_id = community.id
            and category_scope.category_id = p_category_id
        )
      )
  );
$$;

-- ============================================================
-- INTENT VALIDATION
-- ============================================================

create or replace function public.validate_intent_community_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_community_status text;
  v_requires_active boolean;
begin
  if new.community_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.community_id is not distinct from new.community_id
     and old.activity_id is not distinct from new.activity_id
  then
    return new;
  end if;

  select community.status
  into v_community_status
  from public.communities community
  where community.id = new.community_id;

  if v_community_status is null then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;

  if not public.community_applies_to_activity(
    new.community_id,
    new.activity_id
  ) then
    raise exception
      'The selected Community is not available for this Activity.'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    v_requires_active := true;
  else
    v_requires_active :=
      old.community_id is distinct from new.community_id
      or old.activity_id is distinct from new.activity_id;
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

  if tg_op = 'UPDATE'
     and old.community_id is not distinct from new.community_id
     and old.activity_id is not distinct from new.activity_id
     and old.activity_suggestion_id is not distinct from new.activity_suggestion_id
  then
    return new;
  end if;

  select community.status
  into v_community_status
  from public.communities community
  where community.id = new.community_id;

  if v_community_status is null then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;

  if new.activity_id is not null then
    if not public.community_applies_to_activity(
      new.community_id,
      new.activity_id
    ) then
      raise exception
        'The selected Community is not available for this Activity.'
        using errcode = '22023';
    end if;
  elsif new.activity_suggestion_id is not null then
    select suggestion.requested_category_id
    into v_category_id
    from public.activity_catalog_suggestions suggestion
    where suggestion.id = new.activity_suggestion_id;

    if v_category_id is null then
      raise exception
        'The draft Activity category could not be resolved.'
        using errcode = '22023';
    end if;

    if not public.community_applies_to_category(
      new.community_id,
      v_category_id
    ) then
      raise exception
        'An exact-Activity-only Community cannot be used before the requested Activity exists.'
        using errcode = '22023';
    end if;
  else
    raise exception
      'The draft Activity context could not be resolved.'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    v_requires_active := true;
  else
    v_requires_active :=
      old.community_id is distinct from new.community_id
      or old.activity_id is distinct from new.activity_id
      or old.activity_suggestion_id is distinct from new.activity_suggestion_id;
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

-- ============================================================
-- USER SUGGESTIONS
-- ============================================================

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
  where community.status = 'active'
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
  order by community.name
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

-- ============================================================
-- ACTIVE COMMUNITY CATALOGUE
-- ============================================================

drop function if exists public.get_active_communities(uuid);

drop function if exists public.get_active_communities(uuid, uuid);

create function public.get_active_communities(
  p_category_id uuid default null,
  p_activity_id uuid default null
)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  community_accent_color text,
  community_scope_type text,
  category_id uuid,
  category_name text,
  category_ids uuid[],
  category_names text[],
  activity_ids uuid[],
  activity_names text[],
  relevance_rank integer
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
    community.accent_color,
    community.scope_type,

    coalesce(
      community.category_id,
      (
        select category_scope.category_id
        from public.community_category_scopes category_scope
        where category_scope.community_id = community.id
        order by category_scope.category_id
        limit 1
      ),
      (
        select activity.category_id
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
        order by activity.category_id
        limit 1
      )
    ),

    case
      when community.scope_type = 'global'
        then 'All Activities'
      else coalesce(
        (
          select string_agg(scope_name.name, ' · ' order by scope_name.name)
          from (
            select distinct category.name
            from public.community_category_scopes category_scope
            join public.activity_categories category
              on category.id = category_scope.category_id
            where category_scope.community_id = community.id

            union

            select distinct category.name
            from public.community_activity_scopes activity_scope
            join public.activities activity
              on activity.id = activity_scope.activity_id
            join public.activity_categories category
              on category.id = activity.category_id
            where activity_scope.community_id = community.id
          ) scope_name
        ),
        'Selected Activities'
      )
    end,

    coalesce(
      (
        select array_agg(scope_category.category_id order by scope_category.category_name)
        from (
          select distinct
            category.id as category_id,
            category.name as category_name
          from public.community_category_scopes category_scope
          join public.activity_categories category
            on category.id = category_scope.category_id
          where category_scope.community_id = community.id

          union

          select distinct
            category.id,
            category.name
          from public.community_activity_scopes activity_scope
          join public.activities activity
            on activity.id = activity_scope.activity_id
          join public.activity_categories category
            on category.id = activity.category_id
          where activity_scope.community_id = community.id
        ) scope_category
      ),
      array[]::uuid[]
    ),

    coalesce(
      (
        select array_agg(scope_category.category_name order by scope_category.category_name)
        from (
          select distinct category.name as category_name
          from public.community_category_scopes category_scope
          join public.activity_categories category
            on category.id = category_scope.category_id
          where category_scope.community_id = community.id

          union

          select distinct category.name
          from public.community_activity_scopes activity_scope
          join public.activities activity
            on activity.id = activity_scope.activity_id
          join public.activity_categories category
            on category.id = activity.category_id
          where activity_scope.community_id = community.id
        ) scope_category
      ),
      array[]::text[]
    ),

    coalesce(
      (
        select array_agg(activity.id order by activity.name)
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
      ),
      array[]::uuid[]
    ),

    coalesce(
      (
        select array_agg(activity.name order by activity.name)
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
      ),
      array[]::text[]
    ),

    case
      when p_activity_id is not null
       and exists (
         select 1
         from public.community_activity_scopes activity_scope
         where activity_scope.community_id = community.id
           and activity_scope.activity_id = p_activity_id
       )
        then 0
      when p_category_id is not null
       and exists (
         select 1
         from public.community_category_scopes category_scope
         where category_scope.community_id = community.id
           and category_scope.category_id = p_category_id
       )
        then 1
      when community.scope_type = 'global'
        then 2
      else 3
    end as relevance_rank

  from public.communities community
  where community.status = 'active'
    and (
      (
        p_category_id is null
        and p_activity_id is null
      )

      or (
        p_activity_id is not null
        and public.community_applies_to_activity(
          community.id,
          p_activity_id
        )
      )

      or (
        p_activity_id is null
        and p_category_id is not null
        and public.community_applies_to_category(
          community.id,
          p_category_id
        )
      )
    )
  order by
    case
      when p_activity_id is not null
       and exists (
         select 1
         from public.community_activity_scopes activity_scope
         where activity_scope.community_id = community.id
           and activity_scope.activity_id = p_activity_id
       )
        then 0
      when p_category_id is not null
       and exists (
         select 1
         from public.community_category_scopes category_scope
         where category_scope.community_id = community.id
           and category_scope.category_id = p_category_id
       )
        then 1
      when community.scope_type = 'global'
        then 2
      else 3
    end,
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
    'accent_color',
    community.accent_color,
    'scope_type',
    community.scope_type,
    'category_id',
    community.category_id,
    'category_ids',
    coalesce(
      (
        select jsonb_agg(scope_category.category_id order by scope_category.category_name)
        from (
          select distinct
            category.id as category_id,
            category.name as category_name
          from public.community_category_scopes category_scope
          join public.activity_categories category
            on category.id = category_scope.category_id
          where category_scope.community_id = community.id

          union

          select distinct
            category.id,
            category.name
          from public.community_activity_scopes activity_scope
          join public.activities activity
            on activity.id = activity_scope.activity_id
          join public.activity_categories category
            on category.id = activity.category_id
          where activity_scope.community_id = community.id
        ) scope_category
      ),
      '[]'::jsonb
    ),
    'category_names',
    coalesce(
      (
        select jsonb_agg(scope_category.category_name order by scope_category.category_name)
        from (
          select distinct category.name as category_name
          from public.community_category_scopes category_scope
          join public.activity_categories category
            on category.id = category_scope.category_id
          where category_scope.community_id = community.id

          union

          select distinct category.name
          from public.community_activity_scopes activity_scope
          join public.activities activity
            on activity.id = activity_scope.activity_id
          join public.activity_categories category
            on category.id = activity.category_id
          where activity_scope.community_id = community.id
        ) scope_category
      ),
      '[]'::jsonb
    ),
    'activity_ids',
    coalesce(
      (
        select jsonb_agg(activity.id order by activity.name)
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
      ),
      '[]'::jsonb
    ),
    'activity_names',
    coalesce(
      (
        select jsonb_agg(activity.name order by activity.name)
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
      ),
      '[]'::jsonb
    ),
    'scope_label',
    case
      when community.scope_type = 'global'
        then 'All Activities'
      else coalesce(
        (
          select string_agg(scope_name.name, ' · ' order by scope_name.name)
          from (
            select distinct category.name
            from public.community_category_scopes category_scope
            join public.activity_categories category
              on category.id = category_scope.category_id
            where category_scope.community_id = community.id

            union

            select distinct category.name
            from public.community_activity_scopes activity_scope
            join public.activities activity
              on activity.id = activity_scope.activity_id
            join public.activity_categories category
              on category.id = activity.category_id
            where activity_scope.community_id = community.id
          ) scope_name
        ),
        'Selected Activities'
      )
    end
  )
  from public.communities community
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

-- ============================================================
-- ADMIN CATALOGUE
-- ============================================================

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
            activity.category_id,
            'category_name',
            category.name,
            'is_active',
            activity.is_active
          )
          order by
            category.name,
            activity.name
        )
        from public.activities activity
        join public.activity_categories category
          on category.id = activity.category_id
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
            'accent_color',
            community.accent_color,
            'scope_type',
            community.scope_type,
            'category_id',
            community.category_id,
            'category_ids',
            coalesce(
              (
                select jsonb_agg(category_scope.category_id order by category.name)
                from public.community_category_scopes category_scope
                join public.activity_categories category
                  on category.id = category_scope.category_id
                where category_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'category_names',
            coalesce(
              (
                select jsonb_agg(category.name order by category.name)
                from public.community_category_scopes category_scope
                join public.activity_categories category
                  on category.id = category_scope.category_id
                where category_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'activity_ids',
            coalesce(
              (
                select jsonb_agg(activity_scope.activity_id order by category.name, activity.name)
                from public.community_activity_scopes activity_scope
                join public.activities activity
                  on activity.id = activity_scope.activity_id
                join public.activity_categories category
                  on category.id = activity.category_id
                where activity_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'activity_names',
            coalesce(
              (
                select jsonb_agg(activity.name order by category.name, activity.name)
                from public.community_activity_scopes activity_scope
                join public.activities activity
                  on activity.id = activity_scope.activity_id
                join public.activity_categories category
                  on category.id = activity.category_id
                where activity_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'scope_label',
            case
              when community.scope_type = 'global'
                then 'All Activities'
              else coalesce(
                nullif(
                  concat_ws(
                    ' · ',
                    (
                      select string_agg(category.name, ', ' order by category.name)
                      from public.community_category_scopes category_scope
                      join public.activity_categories category
                        on category.id = category_scope.category_id
                      where category_scope.community_id = community.id
                    ),
                    (
                      select string_agg(activity.name, ', ' order by category.name, activity.name)
                      from public.community_activity_scopes activity_scope
                      join public.activities activity
                        on activity.id = activity_scope.activity_id
                      join public.activity_categories category
                        on category.id = activity.category_id
                      where activity_scope.community_id = community.id
                    )
                  ),
                  ''
                ),
                'No applicability selected'
              )
            end,
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
            community.name
        )
        from public.communities community
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

-- ============================================================
-- ADMIN WRITES
-- ============================================================

drop function if exists public.admin_create_community(
  text,
  text,
  text,
  text,
  text,
  uuid
);

drop function if exists public.admin_create_community(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
);

create function public.admin_create_community(
  p_name text,
  p_slug text,
  p_description text,
  p_icon_key text,
  p_icon_url text,
  p_accent_color text,
  p_scope_type text,
  p_category_ids uuid[] default array[]::uuid[],
  p_activity_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope_type text;
  v_category_ids uuid[];
  v_activity_ids uuid[];
  v_primary_category_id uuid;
  v_community_id uuid;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_scope_type :=
    lower(
      btrim(
        coalesce(
          p_scope_type,
          'restricted'
        )
      )
    );

  if v_scope_type not in (
    'global',
    'restricted'
  ) then
    raise exception
      'Community scope must be global or restricted.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(value order by value),
    array[]::uuid[]
  )
  into v_category_ids
  from (
    select distinct value
    from unnest(
      coalesce(
        p_category_ids,
        array[]::uuid[]
      )
    ) value
  ) distinct_values;

  select coalesce(
    array_agg(value order by value),
    array[]::uuid[]
  )
  into v_activity_ids
  from (
    select distinct value
    from unnest(
      coalesce(
        p_activity_ids,
        array[]::uuid[]
      )
    ) value
  ) distinct_values;

  if exists (
    select 1
    from unnest(v_category_ids) category_id
    left join public.activity_categories category
      on category.id = category_id
    where category.id is null
  ) then
    raise exception
      'One or more Activity categories do not exist.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(v_activity_ids) activity_id
    left join public.activities activity
      on activity.id = activity_id
    where activity.id is null
  ) then
    raise exception
      'One or more Activities do not exist.'
      using errcode = 'P0002';
  end if;

  if v_scope_type = 'restricted'
     and cardinality(v_category_ids) = 0
     and cardinality(v_activity_ids) = 0
  then
    raise exception
      'Select at least one category or exact Activity, or use All Activities.'
      using errcode = '22023';
  end if;

  if v_scope_type = 'global' then
    v_category_ids := array[]::uuid[];
    v_activity_ids := array[]::uuid[];
  end if;

  v_primary_category_id :=
    v_category_ids[1];

  if v_primary_category_id is null
     and cardinality(v_activity_ids) > 0
  then
    select activity.category_id
    into v_primary_category_id
    from public.activities activity
    where activity.id = v_activity_ids[1];
  end if;

  insert into public.communities (
    name,
    normalized_name,
    slug,
    description,
    icon_key,
    icon_url,
    accent_color,
    scope_type,
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
    coalesce(
      nullif(
        upper(
          btrim(
            coalesce(
              p_accent_color,
              ''
            )
          )
        ),
        ''
      ),
      '#4F46E5'
    ),
    v_scope_type,
    v_primary_category_id,
    'active',
    auth.uid(),
    auth.uid()
  )
  returning id
  into v_community_id;

  insert into public.community_category_scopes (
    community_id,
    category_id,
    created_by_admin_id
  )
  select
    v_community_id,
    category_id,
    auth.uid()
  from unnest(v_category_ids) category_id;

  insert into public.community_activity_scopes (
    community_id,
    activity_id,
    created_by_admin_id
  )
  select
    v_community_id,
    activity_id,
    auth.uid()
  from unnest(v_activity_ids) activity_id;

  return v_community_id;
end;
$$;

drop function if exists public.admin_update_community(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid
);

drop function if exists public.admin_update_community(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
);

create function public.admin_update_community(
  p_community_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_icon_key text,
  p_icon_url text,
  p_accent_color text,
  p_scope_type text,
  p_category_ids uuid[] default array[]::uuid[],
  p_activity_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope_type text;
  v_category_ids uuid[];
  v_activity_ids uuid[];
  v_primary_category_id uuid;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.communities community
    where community.id = p_community_id
  ) then
    raise exception
      'Community not found.'
      using errcode = 'P0002';
  end if;

  v_scope_type :=
    lower(
      btrim(
        coalesce(
          p_scope_type,
          'restricted'
        )
      )
    );

  if v_scope_type not in (
    'global',
    'restricted'
  ) then
    raise exception
      'Community scope must be global or restricted.'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(value order by value),
    array[]::uuid[]
  )
  into v_category_ids
  from (
    select distinct value
    from unnest(
      coalesce(
        p_category_ids,
        array[]::uuid[]
      )
    ) value
  ) distinct_values;

  select coalesce(
    array_agg(value order by value),
    array[]::uuid[]
  )
  into v_activity_ids
  from (
    select distinct value
    from unnest(
      coalesce(
        p_activity_ids,
        array[]::uuid[]
      )
    ) value
  ) distinct_values;

  if exists (
    select 1
    from unnest(v_category_ids) category_id
    left join public.activity_categories category
      on category.id = category_id
    where category.id is null
  ) then
    raise exception
      'One or more Activity categories do not exist.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from unnest(v_activity_ids) activity_id
    left join public.activities activity
      on activity.id = activity_id
    where activity.id is null
  ) then
    raise exception
      'One or more Activities do not exist.'
      using errcode = 'P0002';
  end if;

  if v_scope_type = 'restricted'
     and cardinality(v_category_ids) = 0
     and cardinality(v_activity_ids) = 0
  then
    raise exception
      'Select at least one category or exact Activity, or use All Activities.'
      using errcode = '22023';
  end if;

  if v_scope_type = 'global' then
    v_category_ids := array[]::uuid[];
    v_activity_ids := array[]::uuid[];
  end if;

  v_primary_category_id :=
    v_category_ids[1];

  if v_primary_category_id is null
     and cardinality(v_activity_ids) > 0
  then
    select activity.category_id
    into v_primary_category_id
    from public.activities activity
    where activity.id = v_activity_ids[1];
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
    accent_color = coalesce(
      nullif(
        upper(
          btrim(
            coalesce(
              p_accent_color,
              ''
            )
          )
        ),
        ''
      ),
      '#4F46E5'
    ),
    scope_type = v_scope_type,
    category_id = v_primary_category_id,
    updated_by_admin_id = auth.uid(),
    updated_at = now()
  where id = p_community_id;

  delete from public.community_category_scopes
  where community_id = p_community_id;

  delete from public.community_activity_scopes
  where community_id = p_community_id;

  insert into public.community_category_scopes (
    community_id,
    category_id,
    created_by_admin_id
  )
  select
    p_community_id,
    category_id,
    auth.uid()
  from unnest(v_category_ids) category_id;

  insert into public.community_activity_scopes (
    community_id,
    activity_id,
    created_by_admin_id
  )
  select
    p_community_id,
    activity_id,
    auth.uid()
  from unnest(v_activity_ids) activity_id;
end;
$$;

-- ============================================================
-- SUGGESTION REVIEW
-- ============================================================

drop function if exists public.admin_resolve_community_suggestion(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.admin_resolve_community_suggestion(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

create function public.admin_resolve_community_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_existing_community_id uuid default null,
  p_new_name text default null,
  p_new_slug text default null,
  p_description text default null,
  p_icon_key text default 'people',
  p_icon_url text default null,
  p_accent_color text default '#4F46E5',
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
  v_community public.communities%rowtype;
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
    select community.*
    into v_community
    from public.communities community
    where community.id = p_existing_community_id
      and community.status <> 'archived';

    if not found then
      raise exception
        'Select an active or inactive Community to merge into.'
        using errcode = '22023';
    end if;

    v_community_id := v_community.id;

    if v_community.scope_type = 'restricted'
       and not public.community_applies_to_category(
         v_community.id,
         v_suggestion.category_id
       )
    then
      insert into public.community_category_scopes (
        community_id,
        category_id,
        created_by_admin_id
      )
      values (
        v_community.id,
        v_suggestion.category_id,
        auth.uid()
      )
      on conflict (
        community_id,
        category_id
      )
      do nothing;

      update public.communities
      set
        category_id = coalesce(
          category_id,
          v_suggestion.category_id
        ),
        updated_by_admin_id = auth.uid(),
        updated_at = now()
      where id = v_community.id;
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
        p_accent_color,
        'restricted',
        array[
          v_suggestion.category_id
        ]::uuid[],
        array[]::uuid[]
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
-- DISCOVER / PROFILE CONTEXT PAYLOADS
-- ============================================================

drop function if exists public.get_visible_intent_communities(uuid[]);

create function public.get_visible_intent_communities(
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
  community_accent_color text,
  community_scope_type text,
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
    community.accent_color,
    community.scope_type,
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

drop function if exists public.get_my_followed_communities();

create function public.get_my_followed_communities()
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  community_accent_color text,
  community_scope_type text,
  category_id uuid,
  category_name text,
  category_ids uuid[],
  category_names text[],
  activity_ids uuid[],
  activity_names text[],
  followed_at timestamptz
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
    community.id,
    community.name,
    community.slug,
    community.description,
    community.icon_key,
    community.icon_url,
    community.accent_color,
    community.scope_type,
    community.category_id,
    case
      when community.scope_type = 'global'
        then 'All Activities'
      else coalesce(
        (
          select string_agg(scope_name.name, ' · ' order by scope_name.name)
          from (
            select distinct category.name
            from public.community_category_scopes category_scope
            join public.activity_categories category
              on category.id = category_scope.category_id
            where category_scope.community_id = community.id

            union

            select distinct category.name
            from public.community_activity_scopes activity_scope
            join public.activities activity
              on activity.id = activity_scope.activity_id
            join public.activity_categories category
              on category.id = activity.category_id
            where activity_scope.community_id = community.id
          ) scope_name
        ),
        'Selected Activities'
      )
    end,
    coalesce(
      (
        select array_agg(scope_category.category_id order by scope_category.category_name)
        from (
          select distinct
            category.id as category_id,
            category.name as category_name
          from public.community_category_scopes category_scope
          join public.activity_categories category
            on category.id = category_scope.category_id
          where category_scope.community_id = community.id

          union

          select distinct
            category.id,
            category.name
          from public.community_activity_scopes activity_scope
          join public.activities activity
            on activity.id = activity_scope.activity_id
          join public.activity_categories category
            on category.id = activity.category_id
          where activity_scope.community_id = community.id
        ) scope_category
      ),
      array[]::uuid[]
    ),
    coalesce(
      (
        select array_agg(scope_category.category_name order by scope_category.category_name)
        from (
          select distinct category.name as category_name
          from public.community_category_scopes category_scope
          join public.activity_categories category
            on category.id = category_scope.category_id
          where category_scope.community_id = community.id

          union

          select distinct category.name
          from public.community_activity_scopes activity_scope
          join public.activities activity
            on activity.id = activity_scope.activity_id
          join public.activity_categories category
            on category.id = activity.category_id
          where activity_scope.community_id = community.id
        ) scope_category
      ),
      array[]::text[]
    ),
    coalesce(
      (
        select array_agg(activity.id order by activity.name)
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
      ),
      array[]::uuid[]
    ),
    coalesce(
      (
        select array_agg(activity.name order by activity.name)
        from public.community_activity_scopes activity_scope
        join public.activities activity
          on activity.id = activity_scope.activity_id
        where activity_scope.community_id = community.id
      ),
      array[]::text[]
    ),
    follow_record.created_at
  from public.community_follows follow_record
  join public.communities community
    on community.id = follow_record.community_id
  where follow_record.user_id = v_user_id
    and community.status = 'active'
  order by
    follow_record.created_at desc,
    community.name,
    community.id;
end;
$$;

-- ============================================================
-- EXECUTION PERMISSIONS
-- ============================================================

revoke all on function public.community_applies_to_activity(uuid, uuid)
from public;

grant execute on function public.community_applies_to_activity(uuid, uuid)
to authenticated;

revoke all on function public.community_applies_to_category(uuid, uuid)
from public;

grant execute on function public.community_applies_to_category(uuid, uuid)
to authenticated;

revoke all on function public.get_active_communities(uuid, uuid)
from public;

grant execute on function public.get_active_communities(uuid, uuid)
to authenticated;

revoke all on function public.get_community_by_slug(text)
from public;

grant execute on function public.get_community_by_slug(text)
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
  text,
  text,
  uuid[],
  uuid[]
)
from public;

grant execute on function public.admin_create_community(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
)
to authenticated;

revoke all on function public.admin_update_community(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
)
from public;

grant execute on function public.admin_update_community(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[]
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
  text,
  text
)
to authenticated;

revoke all on function public.get_visible_intent_communities(uuid[])
from public;

grant execute on function public.get_visible_intent_communities(uuid[])
to authenticated;

revoke all on function public.get_my_followed_communities()
from public;

grant execute on function public.get_my_followed_communities()
to authenticated;

commit;
