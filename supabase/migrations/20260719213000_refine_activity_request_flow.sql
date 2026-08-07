begin;

-- ============================================================
-- 1. REQUEST CLASSIFICATION AND DEDUPLICATION DATA
-- ============================================================

alter table public.activity_catalog_suggestions
  add column if not exists requested_category_id uuid
    references public.activity_categories(id)
    on delete restrict,
  add column if not exists normalized_activity_name text;

alter table public.intent_drafts
  add column if not exists request_description text;

update public.activity_catalog_suggestions suggestion
set
  normalized_activity_name =
    public.normalize_activity_catalogue_name(
      suggestion.proposed_activity_name
    )
where suggestion.normalized_activity_name is null;

update public.activity_catalog_suggestions suggestion
set
  requested_category_id =
    category.id,
  proposed_category_name =
    category.name
from public.activity_categories category
where
  suggestion.requested_category_id is null
  and suggestion.proposed_category_name is not null
  and public.normalize_activity_catalogue_name(
    category.name
  ) =
    public.normalize_activity_catalogue_name(
      suggestion.proposed_category_name
    );

update public.intent_drafts draft
set request_description =
  suggestion.description
from public.activity_catalog_suggestions suggestion
where
  suggestion.id =
    draft.activity_suggestion_id
  and draft.request_description is null;

alter table public.intent_drafts
  drop constraint if exists
    intent_drafts_request_description_check;

alter table public.intent_drafts
  add constraint
    intent_drafts_request_description_check
  check (
    request_description is null
    or char_length(
      btrim(request_description)
    ) between 30 and 2000
  ) not valid;

alter table public.intent_drafts
  validate constraint
    intent_drafts_request_description_check;

create or replace function
  public.set_activity_suggestion_normalized_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.normalized_activity_name :=
    public.normalize_activity_catalogue_name(
      new.proposed_activity_name
    );

  return new;
end;
$$;

drop trigger if exists
  activity_catalog_suggestions_normalize_name
on public.activity_catalog_suggestions;

create trigger
  activity_catalog_suggestions_normalize_name
before insert or update of proposed_activity_name
on public.activity_catalog_suggestions
for each row
execute function
  public.set_activity_suggestion_normalized_name();

-- Merge any existing pending duplicates that already have a known category.
with ranked_suggestions as (
  select
    suggestion.id,
    first_value(suggestion.id) over (
      partition by
        suggestion.requested_category_id,
        suggestion.normalized_activity_name
      order by
        suggestion.created_at,
        suggestion.id
    ) as primary_suggestion_id,
    row_number() over (
      partition by
        suggestion.requested_category_id,
        suggestion.normalized_activity_name
      order by
        suggestion.created_at,
        suggestion.id
    ) as duplicate_rank
  from public.activity_catalog_suggestions suggestion
  where
    suggestion.status = 'pending'
    and suggestion.requested_category_id is not null
    and suggestion.normalized_activity_name is not null
), duplicate_suggestions as (
  select
    id as duplicate_suggestion_id,
    primary_suggestion_id
  from ranked_suggestions
  where duplicate_rank > 1
)
update public.intent_drafts draft
set activity_suggestion_id =
  duplicate.primary_suggestion_id
from duplicate_suggestions duplicate
where draft.activity_suggestion_id =
  duplicate.duplicate_suggestion_id;

with ranked_suggestions as (
  select
    suggestion.id,
    row_number() over (
      partition by
        suggestion.requested_category_id,
        suggestion.normalized_activity_name
      order by
        suggestion.created_at,
        suggestion.id
    ) as duplicate_rank
  from public.activity_catalog_suggestions suggestion
  where
    suggestion.status = 'pending'
    and suggestion.requested_category_id is not null
    and suggestion.normalized_activity_name is not null
)
delete from public.activity_catalog_suggestions suggestion
using ranked_suggestions ranked
where
  suggestion.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists
  activity_catalog_suggestions_pending_category_name_key
on public.activity_catalog_suggestions (
  requested_category_id,
  normalized_activity_name
)
where
  status = 'pending'
  and requested_category_id is not null
  and normalized_activity_name is not null;

create index if not exists
  activity_catalog_suggestions_requested_category_idx
on public.activity_catalog_suggestions (
  requested_category_id,
  status,
  created_at desc
);

-- ============================================================
-- 2. PICKER CATALOGUE: EXPLICIT CATEGORIES + ACTIVITIES
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
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
              category.id,
            'name',
              category.name
          )
          order by category.name
        )
        from public.activity_categories category
        where category.is_active = true
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
-- 3. REFINED USER REQUEST FLOW
-- ============================================================

-- Remove the earlier free-category signature. Requests must now start from a
-- selected canonical category.
drop function if exists
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
  );

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

-- ============================================================
-- 4. GROUPED ADMIN REQUEST QUEUE
-- ============================================================

drop function if exists
  public.get_admin_activity_suggestions(
    text
  );

create function
  public.get_admin_activity_suggestions(
    p_status text default null
  )
returns table (
  suggestion_id uuid,
  suggestion_status text,
  proposed_activity_name text,
  requested_category_id uuid,
  requested_category_name text,
  description text,
  supporter_count bigint,
  draft_count bigint,
  request_examples jsonb,
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
    suggestion.requested_category_id,
    coalesce(
      requested_category.name,
      suggestion.proposed_category_name
    ),
    suggestion.description,
    coalesce(
      request_stats.supporter_count,
      0
    ),
    coalesce(
      request_stats.draft_count,
      0
    ),
    coalesce(
      request_examples.examples,
      '[]'::jsonb
    ),
    suggestion.suggested_by_user_id,
    profile.full_name,
    profile.username,
    profile.email,
    representative_draft.id,
    representative_draft.status,
    representative_draft.start_date,
    representative_draft.end_date,
    representative_location.city,
    representative_location.district,
    representative_draft.people,
    representative_draft.notes,
    canonical_activity.id,
    canonical_activity.name,
    canonical_category.name,
    suggestion.review_note,
    suggestion.reviewed_at,
    suggestion.created_at
  from public.activity_catalog_suggestions suggestion
  join public.profiles profile
    on profile.id =
      suggestion.suggested_by_user_id
  left join public.activity_categories requested_category
    on requested_category.id =
      suggestion.requested_category_id
  left join lateral (
    select
      count(*)::bigint as draft_count,
      count(
        distinct draft.user_id
      )::bigint as supporter_count
    from public.intent_drafts draft
    where draft.activity_suggestion_id =
      suggestion.id
  ) request_stats
    on true
  left join lateral (
    select draft.*
    from public.intent_drafts draft
    where draft.activity_suggestion_id =
      suggestion.id
    order by draft.created_at
    limit 1
  ) representative_draft
    on true
  left join public.locations representative_location
    on representative_location.id =
      representative_draft.location_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'draft_id',
          example.draft_id,
        'user_id',
          example.user_id,
        'user_name',
          example.user_name,
        'user_username',
          example.user_username,
        'request_description',
          example.request_description,
        'notes',
          example.notes,
        'start_date',
          example.start_date,
        'end_date',
          example.end_date,
        'city',
          example.city,
        'district',
          example.district,
        'created_at',
          example.created_at
      )
      order by example.created_at
    ) as examples
    from (
      select
        draft.id as draft_id,
        draft.user_id,
        coalesce(
          draft_profile.full_name,
          draft_profile.username,
          'UIN member'
        ) as user_name,
        draft_profile.username as user_username,
        coalesce(
          draft.request_description,
          suggestion.description
        ) as request_description,
        draft.notes,
        draft.start_date,
        draft.end_date,
        draft_location.city,
        draft_location.district,
        draft.created_at
      from public.intent_drafts draft
      left join public.profiles draft_profile
        on draft_profile.id =
          draft.user_id
      left join public.locations draft_location
        on draft_location.id =
          draft.location_id
      where draft.activity_suggestion_id =
        suggestion.id
      order by draft.created_at
      limit 5
    ) example
  ) request_examples
    on true
  left join public.activities canonical_activity
    on canonical_activity.id =
      suggestion.canonical_activity_id
  left join public.activity_categories canonical_category
    on canonical_category.id =
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
    request_stats.supporter_count desc,
    suggestion.created_at desc;
end;
$$;

-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

revoke all on function
  public.submit_activity_request_draft(
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
    text
  )
from public;

grant execute on function
  public.submit_activity_request_draft(
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
    text
  )
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

commit;
