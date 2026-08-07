begin;

-- ============================================================
-- 1. BADGE DEFINITIONS
-- ============================================================

create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon_key text not null default 'star',
  icon_url text,
  tone text not null default 'green',
  scope_type text not null default 'global',
  category_id uuid references public.activity_categories(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  award_mode text not null default 'manual',
  criteria_role text not null default 'combined',
  minimum_activity_count integer,
  minimum_attendance_rate numeric,
  minimum_feedback_count integer,
  minimum_would_join_again_rate numeric,
  dimension_key text,
  minimum_dimension_score numeric,
  minimum_dimension_responses integer,
  minimum_overall_score numeric,
  minimum_confidence text,
  is_public boolean not null default true,
  allow_managed_minor boolean not null default false,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint badge_definitions_slug_check check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 2 and 80
  ),

  constraint badge_definitions_name_check check (
    char_length(btrim(name)) between 2 and 80
  ),

  constraint badge_definitions_description_check check (
    char_length(description) <= 500
  ),

  constraint badge_definitions_icon_key_check check (
    icon_key in (
      'star',
      'shield',
      'trophy',
      'medal',
      'crown',
      'sparkles',
      'heart',
      'handshake',
      'compass',
      'people',
      'flame',
      'leaf',
      'ball',
      'flag',
      'check',
      'lightning'
    )
  ),

  constraint badge_definitions_icon_url_check check (
    icon_url is null
    or icon_url ~* '^https?://'
  ),

  constraint badge_definitions_tone_check check (
    tone in (
      'green',
      'blue',
      'purple',
      'amber',
      'red',
      'teal',
      'gray'
    )
  ),

  constraint badge_definitions_scope_check check (
    scope_type in (
      'global',
      'category',
      'activity'
    )
  ),

  constraint badge_definitions_scope_reference_check check (
    (
      scope_type = 'global'
      and category_id is null
      and activity_id is null
    )
    or (
      scope_type = 'category'
      and category_id is not null
      and activity_id is null
    )
    or (
      scope_type = 'activity'
      and category_id is not null
      and activity_id is not null
    )
  ),

  constraint badge_definitions_award_mode_check check (
    award_mode in (
      'manual',
      'automatic',
      'both'
    )
  ),

  constraint badge_definitions_criteria_role_check check (
    criteria_role in (
      'combined',
      'host',
      'participant'
    )
  ),

  constraint badge_definitions_minimum_activity_count_check check (
    minimum_activity_count is null
    or minimum_activity_count >= 0
  ),

  constraint badge_definitions_minimum_attendance_rate_check check (
    minimum_attendance_rate is null
    or minimum_attendance_rate between 0 and 100
  ),

  constraint badge_definitions_minimum_feedback_count_check check (
    minimum_feedback_count is null
    or minimum_feedback_count >= 0
  ),

  constraint badge_definitions_minimum_would_join_again_rate_check check (
    minimum_would_join_again_rate is null
    or minimum_would_join_again_rate between 0 and 100
  ),

  constraint badge_definitions_minimum_dimension_score_check check (
    minimum_dimension_score is null
    or minimum_dimension_score between 0 and 100
  ),

  constraint badge_definitions_minimum_dimension_responses_check check (
    minimum_dimension_responses is null
    or minimum_dimension_responses >= 0
  ),

  constraint badge_definitions_dimension_pair_check check (
    dimension_key is not null
    or (
      minimum_dimension_score is null
      and minimum_dimension_responses is null
    )
  ),

  constraint badge_definitions_minimum_overall_score_check check (
    minimum_overall_score is null
    or minimum_overall_score between 0 and 100
  ),

  constraint badge_definitions_minimum_confidence_check check (
    minimum_confidence is null
    or minimum_confidence in (
      'low',
      'medium',
      'high'
    )
  )
);

create index if not exists badge_definitions_scope_idx
  on public.badge_definitions (
    scope_type,
    category_id,
    activity_id,
    criteria_role
  );

create index if not exists badge_definitions_active_idx
  on public.badge_definitions (
    is_active,
    award_mode,
    sort_order
  );

-- ============================================================
-- 2. USER BADGE ASSIGNMENTS + AUDIT EVENTS
-- ============================================================

create table if not exists public.user_badge_assignments (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badge_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  status text not null default 'active',
  is_admin_override boolean not null default false,
  award_note text,
  revoke_reason text,
  awarded_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_badge_assignments_source_check check (
    source in (
      'manual',
      'automatic'
    )
  ),

  constraint user_badge_assignments_status_check check (
    status in (
      'active',
      'revoked'
    )
  ),

  constraint user_badge_assignments_state_check check (
    (
      status = 'active'
      and revoked_at is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
    )
  ),

  constraint user_badge_assignments_award_note_check check (
    award_note is null
    or char_length(award_note) <= 500
  ),

  constraint user_badge_assignments_revoke_reason_check check (
    revoke_reason is null
    or char_length(revoke_reason) <= 500
  ),

  constraint user_badge_assignments_unique unique (
    badge_id,
    user_id,
    source
  )
);

create index if not exists user_badge_assignments_user_idx
  on public.user_badge_assignments (
    user_id,
    status,
    expires_at
  );

create index if not exists user_badge_assignments_badge_idx
  on public.user_badge_assignments (
    badge_id,
    status
  );

create table if not exists public.badge_assignment_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.user_badge_assignments(id) on delete set null,
  badge_id uuid not null references public.badge_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint badge_assignment_events_type_check check (
    event_type in (
      'manual_awarded',
      'manual_reactivated',
      'manual_revoked',
      'automatic_awarded',
      'automatic_reactivated',
      'automatic_revoked',
      'automatic_suppressed',
      'automatic_override_removed'
    )
  )
);

create index if not exists badge_assignment_events_user_idx
  on public.badge_assignment_events (
    user_id,
    created_at desc
  );

create index if not exists badge_assignment_events_badge_idx
  on public.badge_assignment_events (
    badge_id,
    created_at desc
  );

alter table public.badge_definitions enable row level security;
alter table public.user_badge_assignments enable row level security;
alter table public.badge_assignment_events enable row level security;

revoke all on table public.badge_definitions from anon, authenticated;
revoke all on table public.user_badge_assignments from anon, authenticated;
revoke all on table public.badge_assignment_events from anon, authenticated;

-- ============================================================
-- 3. HELPERS
-- ============================================================

create or replace function public.badge_confidence_rank(
  p_confidence text
)
returns integer
language sql
immutable
set search_path = public
as $function$
  select case lower(coalesce(p_confidence, ''))
    when 'high' then 3
    when 'medium' then 2
    when 'low' then 1
    else 0
  end;
$function$;

create or replace function public.refresh_automatic_badges_for_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_badge public.badge_definitions%rowtype;
  v_summary public.reputation_context_summaries%rowtype;
  v_assignment public.user_badge_assignments%rowtype;
  v_assignment_id uuid;
  v_matches boolean;
  v_is_minor boolean;
  v_dimension_score numeric;
  v_dimension_responses integer;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
  ) then
    return;
  end if;

  v_is_minor := public.reputation_is_managed_minor(
    p_user_id
  );

  for v_badge in
    select badge.*
    from public.badge_definitions badge
    where badge.is_active
      and badge.award_mode in (
        'automatic',
        'both'
      )
    order by badge.sort_order, badge.created_at
  loop
    select summary.*
    into v_summary
    from public.reputation_context_summaries summary
    where summary.user_id = p_user_id
      and summary.role = v_badge.criteria_role
      and (
        (
          v_badge.scope_type = 'global'
          and summary.context_type = 'global'
        )
        or (
          v_badge.scope_type = 'category'
          and summary.context_type = 'category'
          and summary.category_id = v_badge.category_id
        )
        or (
          v_badge.scope_type = 'activity'
          and summary.context_type = 'activity'
          and summary.activity_id = v_badge.activity_id
        )
      )
    order by summary.calculated_at desc
    limit 1;

    v_matches := found;
    v_dimension_score := null;
    v_dimension_responses := null;

    if v_matches and v_badge.dimension_key is not null then
      begin
        v_dimension_score := nullif(
          v_summary.dimension_scores
            -> v_badge.dimension_key
            ->> 'score',
          ''
        )::numeric;

        v_dimension_responses := nullif(
          v_summary.dimension_scores
            -> v_badge.dimension_key
            ->> 'responses',
          ''
        )::integer;
      exception
        when others then
          v_dimension_score := null;
          v_dimension_responses := null;
      end;
    end if;

    v_matches :=
      v_matches
      and (
        not v_is_minor
        or v_badge.allow_managed_minor
      )
      and (
        v_badge.minimum_activity_count is null
        or v_summary.activity_count >= v_badge.minimum_activity_count
      )
      and (
        v_badge.minimum_attendance_rate is null
        or v_summary.attendance_rate >= v_badge.minimum_attendance_rate
      )
      and (
        v_badge.minimum_feedback_count is null
        or v_summary.feedback_count >= v_badge.minimum_feedback_count
      )
      and (
        v_badge.minimum_would_join_again_rate is null
        or v_summary.would_join_again_rate >= v_badge.minimum_would_join_again_rate
      )
      and (
        v_badge.minimum_overall_score is null
        or v_summary.overall_score >= v_badge.minimum_overall_score
      )
      and (
        v_badge.minimum_confidence is null
        or public.badge_confidence_rank(v_summary.confidence_level)
          >= public.badge_confidence_rank(v_badge.minimum_confidence)
      )
      and (
        v_badge.dimension_key is null
        or (
          v_dimension_score is not null
          and v_dimension_responses is not null
          and (
            v_badge.minimum_dimension_score is null
            or v_dimension_score >= v_badge.minimum_dimension_score
          )
          and (
            v_badge.minimum_dimension_responses is null
            or v_dimension_responses >= v_badge.minimum_dimension_responses
          )
        )
      );

    select assignment.*
    into v_assignment
    from public.user_badge_assignments assignment
    where assignment.badge_id = v_badge.id
      and assignment.user_id = p_user_id
      and assignment.source = 'automatic'
    for update;

    if v_matches then
      if found then
        if v_assignment.status = 'revoked'
          and v_assignment.is_admin_override
        then
          continue;
        end if;

        if v_assignment.status = 'revoked' then
          update public.user_badge_assignments
          set
            status = 'active',
            is_admin_override = false,
            revoke_reason = null,
            revoked_by = null,
            revoked_at = null,
            expires_at = null,
            awarded_at = now(),
            updated_at = now()
          where id = v_assignment.id;

          insert into public.badge_assignment_events (
            assignment_id,
            badge_id,
            user_id,
            event_type,
            actor_user_id,
            metadata
          )
          values (
            v_assignment.id,
            v_badge.id,
            p_user_id,
            'automatic_reactivated',
            null,
            jsonb_build_object(
              'context_type', v_badge.scope_type,
              'criteria_role', v_badge.criteria_role
            )
          );
        end if;
      else
        insert into public.user_badge_assignments (
          badge_id,
          user_id,
          source,
          status,
          is_admin_override,
          awarded_at,
          updated_at
        )
        values (
          v_badge.id,
          p_user_id,
          'automatic',
          'active',
          false,
          now(),
          now()
        )
        returning id into v_assignment_id;

        insert into public.badge_assignment_events (
          assignment_id,
          badge_id,
          user_id,
          event_type,
          actor_user_id,
          metadata
        )
        values (
          v_assignment_id,
          v_badge.id,
          p_user_id,
          'automatic_awarded',
          null,
          jsonb_build_object(
            'context_type', v_badge.scope_type,
            'criteria_role', v_badge.criteria_role
          )
        );
      end if;
    elsif found
      and v_assignment.status = 'active'
    then
      update public.user_badge_assignments
      set
        status = 'revoked',
        is_admin_override = false,
        revoke_reason = 'Automatic criteria are no longer satisfied.',
        revoked_at = now(),
        revoked_by = null,
        updated_at = now()
      where id = v_assignment.id;

      insert into public.badge_assignment_events (
        assignment_id,
        badge_id,
        user_id,
        event_type,
        actor_user_id,
        metadata
      )
      values (
        v_assignment.id,
        v_badge.id,
        p_user_id,
        'automatic_revoked',
        null,
        jsonb_build_object(
          'reason', 'criteria_no_longer_satisfied'
        )
      );
    end if;
  end loop;
end;
$function$;

-- ============================================================
-- 4. PUBLIC PROFILE PROJECTION
-- ============================================================

create or replace function public.get_public_profile_badges(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_is_minor boolean;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
  ) then
    return '[]'::jsonb;
  end if;

  perform public.refresh_automatic_badges_for_user(
    p_user_id
  );

  v_is_minor := public.reputation_is_managed_minor(
    p_user_id
  );

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', projected.badge_id,
          'slug', projected.slug,
          'name', projected.name,
          'description', projected.description,
          'icon_key', projected.icon_key,
          'icon_url', projected.icon_url,
          'tone', projected.tone,
          'scope_type', projected.scope_type,
          'category_id', projected.category_id,
          'category_name', projected.category_name,
          'activity_id', projected.activity_id,
          'activity_name', projected.activity_name,
          'award_source', projected.source,
          'awarded_at', projected.awarded_at
        )
        order by
          projected.sort_order,
          projected.awarded_at desc,
          projected.name
      )
      from (
        select distinct on (badge.id)
          badge.id as badge_id,
          badge.slug,
          badge.name,
          badge.description,
          badge.icon_key,
          badge.icon_url,
          badge.tone,
          badge.scope_type,
          badge.category_id,
          category.name as category_name,
          badge.activity_id,
          activity.name as activity_name,
          assignment.source,
          assignment.awarded_at,
          badge.sort_order
        from public.user_badge_assignments assignment
        join public.badge_definitions badge
          on badge.id = assignment.badge_id
        left join public.activity_categories category
          on category.id = badge.category_id
        left join public.activities activity
          on activity.id = badge.activity_id
        where assignment.user_id = p_user_id
          and assignment.status = 'active'
          and (
            assignment.expires_at is null
            or assignment.expires_at > now()
          )
          and badge.is_active
          and badge.is_public
          and (
            (
              assignment.source = 'manual'
              and badge.award_mode in ('manual', 'both')
            )
            or (
              assignment.source = 'automatic'
              and badge.award_mode in ('automatic', 'both')
            )
          )
          and (
            not v_is_minor
            or badge.allow_managed_minor
          )
        order by
          badge.id,
          case assignment.source
            when 'manual' then 0
            else 1
          end,
          assignment.awarded_at desc
      ) projected
    ),
    '[]'::jsonb
  );
end;
$function$;

-- ============================================================
-- 5. ADMIN CATALOGUE + DEFINITION MANAGEMENT
-- ============================================================

create or replace function public.get_admin_badge_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', category.id,
            'name', category.name,
            'is_active', category.is_active
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
            'id', activity.id,
            'category_id', activity.category_id,
            'name', activity.name,
            'is_active', activity.is_active
          )
          order by activity.name
        )
        from public.activities activity
      ),
      '[]'::jsonb
    ),

    'badges',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', badge.id,
            'slug', badge.slug,
            'name', badge.name,
            'description', badge.description,
            'icon_key', badge.icon_key,
            'icon_url', badge.icon_url,
            'tone', badge.tone,
            'scope_type', badge.scope_type,
            'category_id', badge.category_id,
            'activity_id', badge.activity_id,
            'award_mode', badge.award_mode,
            'criteria_role', badge.criteria_role,
            'minimum_activity_count', badge.minimum_activity_count,
            'minimum_attendance_rate', badge.minimum_attendance_rate,
            'minimum_feedback_count', badge.minimum_feedback_count,
            'minimum_would_join_again_rate', badge.minimum_would_join_again_rate,
            'dimension_key', badge.dimension_key,
            'minimum_dimension_score', badge.minimum_dimension_score,
            'minimum_dimension_responses', badge.minimum_dimension_responses,
            'minimum_overall_score', badge.minimum_overall_score,
            'minimum_confidence', badge.minimum_confidence,
            'is_public', badge.is_public,
            'allow_managed_minor', badge.allow_managed_minor,
            'sort_order', badge.sort_order,
            'is_active', badge.is_active,
            'active_assignment_count',
              (
                select count(distinct assignment.user_id)
                from public.user_badge_assignments assignment
                where assignment.badge_id = badge.id
                  and assignment.status = 'active'
                  and (
                    assignment.expires_at is null
                    or assignment.expires_at > now()
                  )
              ),
            'manual_assignment_count',
              (
                select count(distinct assignment.user_id)
                from public.user_badge_assignments assignment
                where assignment.badge_id = badge.id
                  and assignment.source = 'manual'
                  and assignment.status = 'active'
                  and (
                    assignment.expires_at is null
                    or assignment.expires_at > now()
                  )
              ),
            'automatic_assignment_count',
              (
                select count(distinct assignment.user_id)
                from public.user_badge_assignments assignment
                where assignment.badge_id = badge.id
                  and assignment.source = 'automatic'
                  and assignment.status = 'active'
                  and (
                    assignment.expires_at is null
                    or assignment.expires_at > now()
                  )
              ),
            'created_at', badge.created_at,
            'updated_at', badge.updated_at
          )
          order by
            badge.sort_order,
            badge.created_at,
            badge.name
        )
        from public.badge_definitions badge
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.admin_create_badge(
  p_slug text,
  p_name text,
  p_description text,
  p_icon_key text,
  p_icon_url text,
  p_tone text,
  p_scope_type text,
  p_category_id uuid,
  p_activity_id uuid,
  p_award_mode text,
  p_criteria_role text,
  p_minimum_activity_count integer,
  p_minimum_attendance_rate numeric,
  p_minimum_feedback_count integer,
  p_minimum_would_join_again_rate numeric,
  p_dimension_key text,
  p_minimum_dimension_score numeric,
  p_minimum_dimension_responses integer,
  p_minimum_overall_score numeric,
  p_minimum_confidence text,
  p_is_public boolean,
  p_allow_managed_minor boolean,
  p_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_scope text;
  v_category_id uuid := p_category_id;
  v_activity_id uuid := p_activity_id;
  v_badge_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_scope := lower(btrim(coalesce(p_scope_type, 'global')));

  if v_scope = 'global' then
    v_category_id := null;
    v_activity_id := null;
  elsif v_scope = 'category' then
    v_activity_id := null;

    if not exists (
      select 1
      from public.activity_categories category
      where category.id = v_category_id
    ) then
      raise exception 'Category not found.'
        using errcode = 'P0002';
    end if;
  elsif v_scope = 'activity' then
    select activity.category_id
    into v_category_id
    from public.activities activity
    where activity.id = v_activity_id;

    if v_category_id is null then
      raise exception 'Activity not found.'
        using errcode = 'P0002';
    end if;
  else
    raise exception 'Unsupported badge scope.'
      using errcode = '22023';
  end if;

  insert into public.badge_definitions (
    slug,
    name,
    description,
    icon_key,
    icon_url,
    tone,
    scope_type,
    category_id,
    activity_id,
    award_mode,
    criteria_role,
    minimum_activity_count,
    minimum_attendance_rate,
    minimum_feedback_count,
    minimum_would_join_again_rate,
    dimension_key,
    minimum_dimension_score,
    minimum_dimension_responses,
    minimum_overall_score,
    minimum_confidence,
    is_public,
    allow_managed_minor,
    sort_order,
    is_active,
    created_by,
    updated_by
  )
  values (
    lower(btrim(p_slug)),
    btrim(p_name),
    coalesce(btrim(p_description), ''),
    lower(btrim(coalesce(p_icon_key, 'star'))),
    nullif(btrim(coalesce(p_icon_url, '')), ''),
    lower(btrim(coalesce(p_tone, 'green'))),
    v_scope,
    v_category_id,
    v_activity_id,
    lower(btrim(coalesce(p_award_mode, 'manual'))),
    lower(btrim(coalesce(p_criteria_role, 'combined'))),
    p_minimum_activity_count,
    p_minimum_attendance_rate,
    p_minimum_feedback_count,
    p_minimum_would_join_again_rate,
    nullif(lower(btrim(coalesce(p_dimension_key, ''))), ''),
    p_minimum_dimension_score,
    p_minimum_dimension_responses,
    p_minimum_overall_score,
    nullif(lower(btrim(coalesce(p_minimum_confidence, ''))), ''),
    coalesce(p_is_public, true),
    coalesce(p_allow_managed_minor, false),
    coalesce(p_sort_order, 100),
    true,
    v_user_id,
    v_user_id
  )
  returning id into v_badge_id;

  return v_badge_id;
end;
$function$;

create or replace function public.admin_update_badge(
  p_badge_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_icon_key text,
  p_icon_url text,
  p_tone text,
  p_scope_type text,
  p_category_id uuid,
  p_activity_id uuid,
  p_award_mode text,
  p_criteria_role text,
  p_minimum_activity_count integer,
  p_minimum_attendance_rate numeric,
  p_minimum_feedback_count integer,
  p_minimum_would_join_again_rate numeric,
  p_dimension_key text,
  p_minimum_dimension_score numeric,
  p_minimum_dimension_responses integer,
  p_minimum_overall_score numeric,
  p_minimum_confidence text,
  p_is_public boolean,
  p_allow_managed_minor boolean,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scope text;
  v_category_id uuid := p_category_id;
  v_activity_id uuid := p_activity_id;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.badge_definitions badge
    where badge.id = p_badge_id
  ) then
    raise exception 'Badge not found.'
      using errcode = 'P0002';
  end if;

  v_scope := lower(btrim(coalesce(p_scope_type, 'global')));

  if v_scope = 'global' then
    v_category_id := null;
    v_activity_id := null;
  elsif v_scope = 'category' then
    v_activity_id := null;

    if not exists (
      select 1
      from public.activity_categories category
      where category.id = v_category_id
    ) then
      raise exception 'Category not found.'
        using errcode = 'P0002';
    end if;
  elsif v_scope = 'activity' then
    select activity.category_id
    into v_category_id
    from public.activities activity
    where activity.id = v_activity_id;

    if v_category_id is null then
      raise exception 'Activity not found.'
        using errcode = 'P0002';
    end if;
  else
    raise exception 'Unsupported badge scope.'
      using errcode = '22023';
  end if;

  update public.badge_definitions
  set
    slug = lower(btrim(p_slug)),
    name = btrim(p_name),
    description = coalesce(btrim(p_description), ''),
    icon_key = lower(btrim(coalesce(p_icon_key, 'star'))),
    icon_url = nullif(btrim(coalesce(p_icon_url, '')), ''),
    tone = lower(btrim(coalesce(p_tone, 'green'))),
    scope_type = v_scope,
    category_id = v_category_id,
    activity_id = v_activity_id,
    award_mode = lower(btrim(coalesce(p_award_mode, 'manual'))),
    criteria_role = lower(btrim(coalesce(p_criteria_role, 'combined'))),
    minimum_activity_count = p_minimum_activity_count,
    minimum_attendance_rate = p_minimum_attendance_rate,
    minimum_feedback_count = p_minimum_feedback_count,
    minimum_would_join_again_rate = p_minimum_would_join_again_rate,
    dimension_key = nullif(lower(btrim(coalesce(p_dimension_key, ''))), ''),
    minimum_dimension_score = p_minimum_dimension_score,
    minimum_dimension_responses = p_minimum_dimension_responses,
    minimum_overall_score = p_minimum_overall_score,
    minimum_confidence = nullif(lower(btrim(coalesce(p_minimum_confidence, ''))), ''),
    is_public = coalesce(p_is_public, true),
    allow_managed_minor = coalesce(p_allow_managed_minor, false),
    sort_order = coalesce(p_sort_order, 100),
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_badge_id;

  if lower(btrim(coalesce(p_award_mode, 'manual'))) = 'manual' then
    insert into public.badge_assignment_events (
      assignment_id,
      badge_id,
      user_id,
      event_type,
      actor_user_id,
      metadata
    )
    select
      assignment.id,
      assignment.badge_id,
      assignment.user_id,
      'automatic_revoked',
      auth.uid(),
      jsonb_build_object(
        'reason', 'badge_award_mode_changed_to_manual'
      )
    from public.user_badge_assignments assignment
    where assignment.badge_id = p_badge_id
      and assignment.source = 'automatic'
      and assignment.status = 'active';

    update public.user_badge_assignments
    set
      status = 'revoked',
      is_admin_override = false,
      revoke_reason = 'Badge award mode changed to manual.',
      revoked_by = auth.uid(),
      revoked_at = now(),
      updated_at = now()
    where badge_id = p_badge_id
      and source = 'automatic'
      and status = 'active';
  end if;
end;
$function$;

create or replace function public.admin_set_badge_active(
  p_badge_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  update public.badge_definitions
  set
    is_active = coalesce(p_is_active, false),
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_badge_id;

  if not found then
    raise exception 'Badge not found.'
      using errcode = 'P0002';
  end if;
end;
$function$;

-- ============================================================
-- 6. ADMIN USER SEARCH + MANUAL AWARDS
-- ============================================================

create or replace function public.admin_search_badge_users(
  p_query text
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  email text,
  avatar_url text,
  active_badge_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_query text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_query := btrim(coalesce(p_query, ''));

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.email,
    profile.avatar_url,
    (
      select count(distinct assignment.badge_id)
      from public.user_badge_assignments assignment
      join public.badge_definitions badge
        on badge.id = assignment.badge_id
      where assignment.user_id = profile.id
        and assignment.status = 'active'
        and badge.is_active
        and (
          assignment.expires_at is null
          or assignment.expires_at > now()
        )
    ) as active_badge_count
  from public.profiles profile
  where profile.username ilike '%' || v_query || '%'
     or coalesce(profile.full_name, '') ilike '%' || v_query || '%'
     or coalesce(profile.email, '') ilike '%' || v_query || '%'
  order by
    case
      when lower(profile.username) = lower(v_query) then 0
      when lower(coalesce(profile.email, '')) = lower(v_query) then 1
      else 2
    end,
    profile.username
  limit 20;
end;
$function$;

create or replace function public.get_admin_user_badge_assignments(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'profile',
    (
      select jsonb_build_object(
        'id', profile.id,
        'full_name', profile.full_name,
        'username', profile.username,
        'email', profile.email,
        'avatar_url', profile.avatar_url
      )
      from public.profiles profile
      where profile.id = p_user_id
    ),

    'assignments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', assignment.id,
            'badge_id', badge.id,
            'badge_name', badge.name,
            'badge_slug', badge.slug,
            'icon_key', badge.icon_key,
            'icon_url', badge.icon_url,
            'tone', badge.tone,
            'source', assignment.source,
            'status', assignment.status,
            'is_admin_override', assignment.is_admin_override,
            'award_note', assignment.award_note,
            'revoke_reason', assignment.revoke_reason,
            'awarded_at', assignment.awarded_at,
            'revoked_at', assignment.revoked_at,
            'expires_at', assignment.expires_at,
            'is_expired',
              assignment.expires_at is not null
              and assignment.expires_at <= now()
          )
          order by
            case assignment.status
              when 'active' then 0
              else 1
            end,
            assignment.awarded_at desc
        )
        from public.user_badge_assignments assignment
        join public.badge_definitions badge
          on badge.id = assignment.badge_id
        where assignment.user_id = p_user_id
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.admin_grant_badge(
  p_badge_id uuid,
  p_user_id uuid,
  p_award_note text default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_assignment public.user_badge_assignments%rowtype;
  v_assignment_id uuid;
  v_event_type text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.badge_definitions badge
    where badge.id = p_badge_id
      and badge.is_active
      and badge.award_mode in ('manual', 'both')
  ) then
    raise exception 'Badge is not active or does not allow manual awards.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_user_id
  ) then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  select assignment.*
  into v_assignment
  from public.user_badge_assignments assignment
  where assignment.badge_id = p_badge_id
    and assignment.user_id = p_user_id
    and assignment.source = 'manual'
  for update;

  if found then
    v_assignment_id := v_assignment.id;
    v_event_type := case
      when v_assignment.status = 'revoked'
        then 'manual_reactivated'
      else 'manual_awarded'
    end;

    update public.user_badge_assignments
    set
      status = 'active',
      is_admin_override = false,
      award_note = nullif(btrim(coalesce(p_award_note, '')), ''),
      revoke_reason = null,
      awarded_by = auth.uid(),
      revoked_by = null,
      awarded_at = now(),
      revoked_at = null,
      expires_at = p_expires_at,
      updated_at = now()
    where id = v_assignment.id;
  else
    v_event_type := 'manual_awarded';

    insert into public.user_badge_assignments (
      badge_id,
      user_id,
      source,
      status,
      is_admin_override,
      award_note,
      awarded_by,
      awarded_at,
      expires_at,
      updated_at
    )
    values (
      p_badge_id,
      p_user_id,
      'manual',
      'active',
      false,
      nullif(btrim(coalesce(p_award_note, '')), ''),
      auth.uid(),
      now(),
      p_expires_at,
      now()
    )
    returning id into v_assignment_id;
  end if;

  insert into public.badge_assignment_events (
    assignment_id,
    badge_id,
    user_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_assignment_id,
    p_badge_id,
    p_user_id,
    v_event_type,
    auth.uid(),
    jsonb_build_object(
      'award_note', nullif(btrim(coalesce(p_award_note, '')), ''),
      'expires_at', p_expires_at
    )
  );

  return v_assignment_id;
end;
$function$;

create or replace function public.admin_revoke_badge_assignment(
  p_assignment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_assignment public.user_badge_assignments%rowtype;
  v_event_type text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  select assignment.*
  into v_assignment
  from public.user_badge_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Badge assignment not found.'
      using errcode = 'P0002';
  end if;

  v_event_type := case
    when v_assignment.source = 'automatic'
      then 'automatic_suppressed'
    else 'manual_revoked'
  end;

  update public.user_badge_assignments
  set
    status = 'revoked',
    is_admin_override = v_assignment.source = 'automatic',
    revoke_reason = nullif(btrim(coalesce(p_reason, '')), ''),
    revoked_by = auth.uid(),
    revoked_at = now(),
    updated_at = now()
  where id = p_assignment_id;

  insert into public.badge_assignment_events (
    assignment_id,
    badge_id,
    user_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_assignment.id,
    v_assignment.badge_id,
    v_assignment.user_id,
    v_event_type,
    auth.uid(),
    jsonb_build_object(
      'reason', nullif(btrim(coalesce(p_reason, '')), '')
    )
  );
end;
$function$;

create or replace function public.admin_restore_badge_assignment(
  p_assignment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_assignment public.user_badge_assignments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  select assignment.*
  into v_assignment
  from public.user_badge_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Badge assignment not found.'
      using errcode = 'P0002';
  end if;

  if v_assignment.source = 'manual' then
    update public.user_badge_assignments
    set
      status = 'active',
      is_admin_override = false,
      revoke_reason = null,
      revoked_by = null,
      revoked_at = null,
      awarded_at = now(),
      updated_at = now()
    where id = p_assignment_id;

    insert into public.badge_assignment_events (
      assignment_id,
      badge_id,
      user_id,
      event_type,
      actor_user_id,
      metadata
    )
    values (
      v_assignment.id,
      v_assignment.badge_id,
      v_assignment.user_id,
      'manual_reactivated',
      auth.uid(),
      '{}'::jsonb
    );
  else
    update public.user_badge_assignments
    set
      is_admin_override = false,
      revoke_reason = null,
      revoked_by = null,
      updated_at = now()
    where id = p_assignment_id;

    insert into public.badge_assignment_events (
      assignment_id,
      badge_id,
      user_id,
      event_type,
      actor_user_id,
      metadata
    )
    values (
      v_assignment.id,
      v_assignment.badge_id,
      v_assignment.user_id,
      'automatic_override_removed',
      auth.uid(),
      '{}'::jsonb
    );

    perform public.refresh_automatic_badges_for_user(
      v_assignment.user_id
    );
  end if;
end;
$function$;

create or replace function public.admin_refresh_user_badges(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  perform public.refresh_reputation_for_user(
    p_user_id
  );

  perform public.refresh_automatic_badges_for_user(
    p_user_id
  );
end;
$function$;

create or replace function public.admin_refresh_all_automatic_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile record;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  for v_profile in
    select profile.id
    from public.profiles profile
    order by profile.created_at, profile.id
  loop
    perform public.refresh_reputation_for_user(
      v_profile.id
    );

    perform public.refresh_automatic_badges_for_user(
      v_profile.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

-- ============================================================
-- 7. DEFAULT BADGES
-- ============================================================

insert into public.badge_definitions (
  slug,
  name,
  description,
  icon_key,
  tone,
  scope_type,
  award_mode,
  criteria_role,
  minimum_activity_count,
  minimum_attendance_rate,
  minimum_feedback_count,
  minimum_would_join_again_rate,
  minimum_confidence,
  is_public,
  allow_managed_minor,
  sort_order
)
values
  (
    'reliable-participant',
    'Reliable Participant',
    'Consistently attends shared Activities and receives strong join-again feedback as a participant.',
    'shield',
    'green',
    'global',
    'automatic',
    'participant',
    5,
    90,
    3,
    80,
    'medium',
    true,
    false,
    20
  ),
  (
    'trusted-host',
    'Trusted Host',
    'Builds a consistent record of completed Activities and positive participant feedback as a host.',
    'crown',
    'purple',
    'global',
    'automatic',
    'host',
    5,
    null,
    3,
    80,
    'medium',
    true,
    false,
    30
  ),
  (
    'founding-member',
    'Founding Member',
    'Recognises a person who helped shape UIN during its founding period.',
    'star',
    'amber',
    'global',
    'manual',
    'combined',
    null,
    null,
    null,
    null,
    null,
    true,
    false,
    10
  )
on conflict (slug) do nothing;

insert into public.badge_definitions (
  slug,
  name,
  description,
  icon_key,
  tone,
  scope_type,
  category_id,
  award_mode,
  criteria_role,
  minimum_activity_count,
  minimum_feedback_count,
  dimension_key,
  minimum_dimension_score,
  minimum_dimension_responses,
  minimum_confidence,
  is_public,
  allow_managed_minor,
  sort_order
)
select
  'good-sport',
  'Good Sport',
  'Recognises strong sportsmanship, safe participation and respect in Sport Activities.',
  'medal',
  'blue',
  'category',
  category.id,
  'automatic',
  'combined',
  5,
  5,
  'sportsmanship',
  85,
  5,
  'medium',
  true,
  false,
  40
from public.activity_categories category
where lower(category.name) = lower('Sport Activity')
on conflict (slug) do nothing;

insert into public.badge_definitions (
  slug,
  name,
  description,
  icon_key,
  tone,
  scope_type,
  category_id,
  activity_id,
  award_mode,
  criteria_role,
  minimum_activity_count,
  minimum_feedback_count,
  dimension_key,
  minimum_dimension_score,
  minimum_dimension_responses,
  minimum_confidence,
  is_public,
  allow_managed_minor,
  sort_order
)
select
  'family-friendly',
  'Family Friendly',
  'Recognises consistently respectful and family-friendly participation in Family Picnic Activities.',
  'heart',
  'teal',
  'activity',
  activity.category_id,
  activity.id,
  'automatic',
  'combined',
  5,
  5,
  'family_friendly',
  85,
  5,
  'medium',
  true,
  false,
  50
from public.activities activity
where lower(activity.name) = lower('Family Picnic')
on conflict (slug) do nothing;

-- ============================================================
-- 8. FUNCTION PERMISSIONS
-- ============================================================

revoke all on function public.badge_confidence_rank(text) from public;
revoke all on function public.refresh_automatic_badges_for_user(uuid) from public;
revoke all on function public.get_public_profile_badges(uuid) from public;
revoke all on function public.get_admin_badge_catalogue() from public;
revoke all on function public.admin_create_badge(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  numeric,
  integer,
  numeric,
  text,
  numeric,
  integer,
  numeric,
  text,
  boolean,
  boolean,
  integer
) from public;
revoke all on function public.admin_update_badge(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  numeric,
  integer,
  numeric,
  text,
  numeric,
  integer,
  numeric,
  text,
  boolean,
  boolean,
  integer
) from public;
revoke all on function public.admin_set_badge_active(uuid, boolean) from public;
revoke all on function public.admin_search_badge_users(text) from public;
revoke all on function public.get_admin_user_badge_assignments(uuid) from public;
revoke all on function public.admin_grant_badge(uuid, uuid, text, timestamptz) from public;
revoke all on function public.admin_revoke_badge_assignment(uuid, text) from public;
revoke all on function public.admin_restore_badge_assignment(uuid) from public;
revoke all on function public.admin_refresh_user_badges(uuid) from public;
revoke all on function public.admin_refresh_all_automatic_badges() from public;

grant execute on function public.get_public_profile_badges(uuid) to anon, authenticated;
grant execute on function public.get_admin_badge_catalogue() to authenticated;
grant execute on function public.admin_create_badge(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  numeric,
  integer,
  numeric,
  text,
  numeric,
  integer,
  numeric,
  text,
  boolean,
  boolean,
  integer
) to authenticated;
grant execute on function public.admin_update_badge(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  numeric,
  integer,
  numeric,
  text,
  numeric,
  integer,
  numeric,
  text,
  boolean,
  boolean,
  integer
) to authenticated;
grant execute on function public.admin_set_badge_active(uuid, boolean) to authenticated;
grant execute on function public.admin_search_badge_users(text) to authenticated;
grant execute on function public.get_admin_user_badge_assignments(uuid) to authenticated;
grant execute on function public.admin_grant_badge(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_revoke_badge_assignment(uuid, text) to authenticated;
grant execute on function public.admin_restore_badge_assignment(uuid) to authenticated;
grant execute on function public.admin_refresh_user_badges(uuid) to authenticated;
grant execute on function public.admin_refresh_all_automatic_badges() to authenticated;

commit;
