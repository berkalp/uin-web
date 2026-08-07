begin;

create table if not exists public.reputation_questions (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  category_id uuid references public.activity_categories(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  dimension text not null,
  response_type text not null default 'scale_5',
  applies_to_role text not null default 'both',
  is_required boolean not null default true,
  public_summary_eligible boolean not null default true,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  current_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reputation_questions_scope_check check (
    (scope_type = 'global' and category_id is null and activity_id is null)
    or (scope_type = 'category' and category_id is not null and activity_id is null)
    or (scope_type = 'activity' and activity_id is not null)
  ),
  constraint reputation_questions_scope_value_check check (
    scope_type in ('global', 'category', 'activity')
  ),
  constraint reputation_questions_dimension_check check (
    dimension ~ '^[a-z0-9_]{2,40}$'
  ),
  constraint reputation_questions_response_type_check check (
    response_type in ('yes_no', 'scale_5')
  ),
  constraint reputation_questions_role_check check (
    applies_to_role in ('both', 'host', 'participant')
  ),
  constraint reputation_questions_sort_order_check check (
    sort_order between 0 and 10000
  )
);

create index if not exists reputation_questions_active_scope_idx
  on public.reputation_questions (
    is_active,
    scope_type,
    category_id,
    activity_id,
    sort_order
  );

create unique index if not exists reputation_questions_context_dimension_key
  on public.reputation_questions (
    scope_type,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dimension
  );

create table if not exists public.reputation_question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.reputation_questions(id) on delete cascade,
  version_no integer not null,
  prompt text not null,
  weight numeric not null default 1,
  positive_direction boolean not null default true,
  options jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reputation_question_versions_unique unique (
    question_id,
    version_no
  ),
  constraint reputation_question_versions_prompt_check check (
    char_length(btrim(prompt)) between 5 and 300
  ),
  constraint reputation_question_versions_weight_check check (
    weight > 0 and weight <= 10
  ),
  constraint reputation_question_versions_options_check check (
    jsonb_typeof(options) = 'object'
  )
);

create table if not exists public.reputation_feedback_windows (
  plan_id uuid primary key references public.plans(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  reason text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint reputation_feedback_windows_range_check check (
    closes_at > opened_at
  ),
  constraint reputation_feedback_windows_reason_check check (
    reason in ('initial_rollout', 'manual_extension')
  )
);

create table if not exists public.activity_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete restrict,
  category_id uuid not null references public.activity_categories(id) on delete restrict,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  from_role text not null,
  to_role text not null,
  would_join_again boolean not null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  reveal_at timestamptz not null,
  revealed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  constraint activity_feedback_unique_pair unique (
    plan_id,
    from_user_id,
    to_user_id
  ),
  constraint activity_feedback_not_self check (
    from_user_id <> to_user_id
  ),
  constraint activity_feedback_role_check check (
    from_role in ('host', 'participant')
    and to_role in ('host', 'participant')
  ),
  constraint activity_feedback_status_check check (
    status in ('submitted', 'revealed', 'void')
  )
);

create index if not exists activity_feedback_target_idx
  on public.activity_feedback (
    to_user_id,
    activity_id,
    category_id,
    status,
    reveal_at
  );

create table if not exists public.activity_feedback_answers (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.activity_feedback(id) on delete cascade,
  question_id uuid not null references public.reputation_questions(id) on delete restrict,
  question_version_id uuid not null references public.reputation_question_versions(id) on delete restrict,
  dimension text not null,
  prompt_snapshot text not null,
  response_type text not null,
  numeric_value numeric,
  boolean_value boolean,
  normalized_score numeric not null,
  weight_snapshot numeric not null,
  public_summary_eligible boolean not null,
  created_at timestamptz not null default now(),
  constraint activity_feedback_answers_unique_question unique (
    feedback_id,
    question_id
  ),
  constraint activity_feedback_answers_score_check check (
    normalized_score between 0 and 1
  ),
  constraint activity_feedback_answers_weight_check check (
    weight_snapshot > 0 and weight_snapshot <= 10
  ),
  constraint activity_feedback_answers_response_check check (
    response_type in ('yes_no', 'scale_5')
  )
);

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  category_id uuid references public.activity_categories(id) on delete set null,
  role text not null default 'participant',
  event_type text not null,
  source_user_id uuid references public.profiles(id) on delete set null,
  score_value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reputation_events_role_check check (
    role in ('host', 'participant')
  ),
  constraint reputation_events_metadata_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists reputation_events_user_context_idx
  on public.reputation_events (
    user_id,
    category_id,
    activity_id,
    created_at desc
  );

create table if not exists public.reputation_context_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  context_key text not null,
  context_type text not null,
  category_id uuid references public.activity_categories(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  role text not null,
  activity_count integer not null default 0,
  attendance_observation_count integer not null default 0,
  attended_count integer not null default 0,
  no_show_count integer not null default 0,
  late_cancel_count integer not null default 0,
  feedback_count integer not null default 0,
  would_join_again_count integer not null default 0,
  attendance_rate numeric,
  would_join_again_rate numeric,
  dimension_scores jsonb not null default '{}'::jsonb,
  overall_score numeric,
  reputation_level text not null default 'new',
  confidence_level text not null default 'low',
  algorithm_version integer not null default 1,
  calculated_at timestamptz not null default now(),
  constraint reputation_context_summaries_unique unique (
    user_id,
    context_key,
    role
  ),
  constraint reputation_context_summaries_type_check check (
    context_type in ('global', 'category', 'activity')
  ),
  constraint reputation_context_summaries_role_check check (
    role in ('combined', 'host', 'participant')
  ),
  constraint reputation_context_summaries_level_check check (
    reputation_level in (
      'new',
      'developing',
      'reliable',
      'highly_reliable',
      'mixed'
    )
  ),
  constraint reputation_context_summaries_confidence_check check (
    confidence_level in ('low', 'medium', 'high')
  )
);

alter table public.reputation_questions enable row level security;
alter table public.reputation_question_versions enable row level security;
alter table public.reputation_feedback_windows enable row level security;
alter table public.activity_feedback enable row level security;
alter table public.activity_feedback_answers enable row level security;
alter table public.reputation_events enable row level security;
alter table public.reputation_context_summaries enable row level security;

create or replace function public.reputation_is_managed_minor(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.profile_age_records age_record
    where age_record.user_id = p_user_id
      and age_record.account_type = 'managed_minor'
      and age_record.adult_transition_completed_at is null
  );
$function$;

create or replace function public.reputation_plan_role(
  p_plan_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when plan.host_user_id = p_user_id then 'host'
    when member.role = 'co_host' then 'host'
    when member.user_id is not null then 'participant'
    else null
  end
  from public.plans plan
  left join public.plan_members member
    on member.plan_id = plan.id
   and member.user_id = p_user_id
   and member.status = 'active'
  where plan.id = p_plan_id
  limit 1;
$function$;

create or replace function public.reputation_feedback_deadline(
  p_plan_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    (
      select window.closes_at
      from public.reputation_feedback_windows window
      where window.plan_id = p_plan_id
    ),
    coalesce(plan.completed_at, plan.updated_at) + interval '7 days'
  )
  from public.plans plan
  where plan.id = p_plan_id;
$function$;

create or replace function public.reputation_feedback_actor_is_eligible(
  p_plan_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.plans plan
    left join public.plan_members member
      on member.plan_id = plan.id
     and member.user_id = p_user_id
     and member.status = 'active'
    where plan.id = p_plan_id
      and plan.status = 'completed'
      and public.reputation_feedback_deadline(plan.id) >= now()
      and not public.reputation_is_managed_minor(p_user_id)
      and (
        plan.host_user_id = p_user_id
        or member.attendance_status = 'attended'
      )
  );
$function$;

create or replace function public.reputation_feedback_target_is_eligible(
  p_plan_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.plans plan
    left join public.plan_members member
      on member.plan_id = plan.id
     and member.user_id = p_user_id
     and member.status = 'active'
    where plan.id = p_plan_id
      and plan.status = 'completed'
      and not public.reputation_is_managed_minor(p_user_id)
      and (
        plan.host_user_id = p_user_id
        or member.attendance_status = 'attended'
      )
  );
$function$;

create or replace function public.get_admin_reputation_catalogue()
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
    'questions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', question.id,
            'scope_type', question.scope_type,
            'category_id', question.category_id,
            'activity_id', question.activity_id,
            'dimension', question.dimension,
            'response_type', question.response_type,
            'applies_to_role', question.applies_to_role,
            'is_required', question.is_required,
            'public_summary_eligible', question.public_summary_eligible,
            'sort_order', question.sort_order,
            'is_active', question.is_active,
            'current_version', question.current_version,
            'prompt', version.prompt,
            'weight', version.weight,
            'positive_direction', version.positive_direction,
            'options', version.options,
            'created_at', question.created_at,
            'updated_at', question.updated_at
          )
          order by
            case question.scope_type
              when 'global' then 0
              when 'category' then 1
              else 2
            end,
            question.sort_order,
            question.created_at
        )
        from public.reputation_questions question
        join public.reputation_question_versions version
          on version.question_id = question.id
         and version.version_no = question.current_version
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.admin_create_reputation_question(
  p_scope_type text,
  p_category_id uuid,
  p_activity_id uuid,
  p_dimension text,
  p_prompt text,
  p_response_type text default 'scale_5',
  p_applies_to_role text default 'both',
  p_weight numeric default 1,
  p_is_required boolean default true,
  p_public_summary_eligible boolean default true,
  p_sort_order integer default 100,
  p_options jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_question_id uuid;
  v_scope text;
  v_category_id uuid := p_category_id;
  v_activity_id uuid := p_activity_id;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_scope := lower(btrim(coalesce(p_scope_type, '')));

  if v_scope not in ('global', 'category', 'activity') then
    raise exception 'Unsupported reputation question scope.'
      using errcode = '22023';
  end if;

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
  else
    select activity.category_id
    into v_category_id
    from public.activities activity
    where activity.id = v_activity_id;

    if v_category_id is null then
      raise exception 'Activity not found.'
        using errcode = 'P0002';
    end if;
  end if;

  insert into public.reputation_questions (
    scope_type,
    category_id,
    activity_id,
    dimension,
    response_type,
    applies_to_role,
    is_required,
    public_summary_eligible,
    sort_order,
    is_active,
    current_version,
    created_by
  )
  values (
    v_scope,
    v_category_id,
    v_activity_id,
    lower(btrim(p_dimension)),
    lower(btrim(p_response_type)),
    lower(btrim(p_applies_to_role)),
    coalesce(p_is_required, true),
    coalesce(p_public_summary_eligible, true),
    coalesce(p_sort_order, 100),
    true,
    1,
    v_user_id
  )
  returning id into v_question_id;

  insert into public.reputation_question_versions (
    question_id,
    version_no,
    prompt,
    weight,
    positive_direction,
    options,
    created_by
  )
  values (
    v_question_id,
    1,
    btrim(p_prompt),
    coalesce(p_weight, 1),
    true,
    coalesce(p_options, '{}'::jsonb),
    v_user_id
  );

  return v_question_id;
end;
$function$;

create or replace function public.admin_update_reputation_question(
  p_question_id uuid,
  p_scope_type text,
  p_category_id uuid,
  p_activity_id uuid,
  p_dimension text,
  p_prompt text,
  p_response_type text,
  p_applies_to_role text,
  p_weight numeric,
  p_is_required boolean,
  p_public_summary_eligible boolean,
  p_sort_order integer,
  p_options jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_question public.reputation_questions%rowtype;
  v_version public.reputation_question_versions%rowtype;
  v_scope text;
  v_category_id uuid := p_category_id;
  v_activity_id uuid := p_activity_id;
  v_next_version integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  select *
  into v_question
  from public.reputation_questions
  where id = p_question_id
  for update;

  if not found then
    raise exception 'Reputation question not found.'
      using errcode = 'P0002';
  end if;

  select *
  into v_version
  from public.reputation_question_versions
  where question_id = p_question_id
    and version_no = v_question.current_version;

  v_scope := lower(btrim(coalesce(p_scope_type, '')));

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
    raise exception 'Unsupported reputation question scope.'
      using errcode = '22023';
  end if;

  v_next_version := v_question.current_version;

  if
    v_version.prompt is distinct from btrim(p_prompt)
    or v_version.weight is distinct from coalesce(p_weight, 1)
    or v_version.options is distinct from coalesce(p_options, '{}'::jsonb)
    or v_question.scope_type is distinct from v_scope
    or v_question.category_id is distinct from v_category_id
    or v_question.activity_id is distinct from v_activity_id
    or v_question.dimension is distinct from lower(btrim(p_dimension))
    or v_question.response_type is distinct from lower(btrim(p_response_type))
    or v_question.applies_to_role is distinct from lower(btrim(p_applies_to_role))
  then
    v_next_version := v_question.current_version + 1;

    insert into public.reputation_question_versions (
      question_id,
      version_no,
      prompt,
      weight,
      positive_direction,
      options,
      created_by
    )
    values (
      p_question_id,
      v_next_version,
      btrim(p_prompt),
      coalesce(p_weight, 1),
      true,
      coalesce(p_options, '{}'::jsonb),
      v_user_id
    );
  end if;

  update public.reputation_questions
  set
    scope_type = v_scope,
    category_id = v_category_id,
    activity_id = v_activity_id,
    dimension = lower(btrim(p_dimension)),
    response_type = lower(btrim(p_response_type)),
    applies_to_role = lower(btrim(p_applies_to_role)),
    is_required = coalesce(p_is_required, true),
    public_summary_eligible = coalesce(p_public_summary_eligible, true),
    sort_order = coalesce(p_sort_order, 100),
    current_version = v_next_version,
    updated_at = now()
  where id = p_question_id;
end;
$function$;

create or replace function public.admin_set_reputation_question_active(
  p_question_id uuid,
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

  update public.reputation_questions
  set
    is_active = coalesce(p_is_active, false),
    updated_at = now()
  where id = p_question_id;

  if not found then
    raise exception 'Reputation question not found.'
      using errcode = 'P0002';
  end if;
end;
$function$;

create or replace function public.get_reputation_feedback_targets(
  p_plan_id uuid
)
returns table (
  plan_id uuid,
  plan_title text,
  activity_name text,
  completed_at timestamptz,
  feedback_deadline timestamptz,
  target_user_id uuid,
  target_full_name text,
  target_username text,
  target_avatar_url text,
  target_role text,
  existing_feedback_id uuid,
  can_feedback boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.reputation_feedback_actor_is_eligible(
    p_plan_id,
    v_user_id
  ) then
    return;
  end if;

  return query
  with plan_record as (
    select
      plan.*,
      activity.name as canonical_activity_name
    from public.plans plan
    join public.activities activity
      on activity.id = plan.activity_id
    where plan.id = p_plan_id
      and plan.status = 'completed'
  ),
  people as (
    select
      plan.host_user_id as user_id,
      'host'::text as role
    from plan_record plan

    union all

    select
      member.user_id,
      case
        when member.role = 'co_host' then 'host'
        else 'participant'
      end::text as role
    from public.plan_members member
    join plan_record plan
      on plan.id = member.plan_id
    where member.status = 'active'
      and member.user_id <> plan.host_user_id
  )
  select
    plan.id,
    plan.title,
    plan.canonical_activity_name,
    plan.completed_at,
    public.reputation_feedback_deadline(plan.id),
    person.user_id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    person.role,
    feedback.id,
    (
      feedback.id is null
      and person.user_id <> v_user_id
      and public.reputation_feedback_target_is_eligible(
        plan.id,
        person.user_id
      )
      and public.reputation_feedback_deadline(plan.id) >= now()
    )
  from plan_record plan
  join people person on true
  join public.profiles profile
    on profile.id = person.user_id
  left join public.activity_feedback feedback
    on feedback.plan_id = plan.id
   and feedback.from_user_id = v_user_id
   and feedback.to_user_id = person.user_id
   and feedback.status <> 'void'
  where person.user_id <> v_user_id
    and public.reputation_feedback_target_is_eligible(
      plan.id,
      person.user_id
    )
  order by
    case person.role when 'host' then 0 else 1 end,
    profile.full_name nulls last,
    profile.username;
end;
$function$;

create or replace function public.get_reputation_feedback_form(
  p_plan_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_target_role text;
  v_existing_feedback_id uuid;
  v_target_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.reputation_feedback_actor_is_eligible(
    p_plan_id,
    v_user_id
  ) then
    raise exception 'You are not eligible to leave feedback for this Activity.'
      using errcode = '42501';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id
    and status = 'completed';

  if not found then
    raise exception 'Completed Activity not found.'
      using errcode = 'P0002';
  end if;

  v_target_role := public.reputation_plan_role(
    p_plan_id,
    p_target_user_id
  );

  if v_target_role is null
    or p_target_user_id = v_user_id
    or not public.reputation_feedback_target_is_eligible(
      p_plan_id,
      p_target_user_id
    )
  then
    raise exception 'This person cannot be evaluated for this Activity.'
      using errcode = '22023';
  end if;

  select *
  into v_target_profile
  from public.profiles
  where id = p_target_user_id;

  select feedback.id
  into v_existing_feedback_id
  from public.activity_feedback feedback
  where feedback.plan_id = p_plan_id
    and feedback.from_user_id = v_user_id
    and feedback.to_user_id = p_target_user_id
    and feedback.status <> 'void'
  limit 1;

  return jsonb_build_object(
    'plan',
    jsonb_build_object(
      'id', v_plan.id,
      'title', v_plan.title,
      'activity_id', v_plan.activity_id,
      'category_id', (
        select activity.category_id
        from public.activities activity
        where activity.id = v_plan.activity_id
      ),
      'completed_at', v_plan.completed_at,
      'feedback_deadline', public.reputation_feedback_deadline(v_plan.id)
    ),
    'target',
    jsonb_build_object(
      'id', v_target_profile.id,
      'full_name', v_target_profile.full_name,
      'username', v_target_profile.username,
      'avatar_url', v_target_profile.avatar_url,
      'role', v_target_role
    ),
    'existing_feedback_id',
    v_existing_feedback_id,
    'questions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', question.id,
            'version_id', version.id,
            'scope_type', question.scope_type,
            'dimension', question.dimension,
            'prompt', version.prompt,
            'response_type', question.response_type,
            'is_required', question.is_required,
            'weight', version.weight,
            'options', version.options
          )
          order by
            case question.scope_type
              when 'global' then 0
              when 'category' then 1
              else 2
            end,
            question.sort_order,
            question.created_at
        )
        from public.reputation_questions question
        join public.reputation_question_versions version
          on version.question_id = question.id
         and version.version_no = question.current_version
        join public.activities activity
          on activity.id = v_plan.activity_id
        where question.is_active
          and question.applies_to_role in ('both', v_target_role)
          and (
            question.scope_type = 'global'
            or (
              question.scope_type = 'category'
              and question.category_id = activity.category_id
            )
            or (
              question.scope_type = 'activity'
              and question.activity_id = activity.id
            )
          )
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.refresh_reputation_for_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_context record;
  v_role text;
  v_activity_count integer;
  v_attendance_observation_count integer;
  v_attended_count integer;
  v_no_show_count integer;
  v_late_cancel_count integer;
  v_feedback_count integer;
  v_would_join_again_count integer;
  v_attendance_rate numeric;
  v_would_join_again_rate numeric;
  v_dimension_average numeric;
  v_dimension_scores jsonb;
  v_overall_score numeric;
  v_reputation_level text;
  v_confidence_level text;
begin
  update public.activity_feedback
  set
    status = 'revealed',
    revealed_at = coalesce(revealed_at, now())
  where status = 'submitted'
    and reveal_at <= now();

  if public.reputation_is_managed_minor(p_user_id) then
    delete from public.reputation_context_summaries
    where user_id = p_user_id;
    return;
  end if;

  delete from public.reputation_context_summaries
  where user_id = p_user_id;

  for v_context in
    with user_contexts as (
      select distinct
        plan.activity_id,
        activity.category_id
      from public.plans plan
      join public.activities activity
        on activity.id = plan.activity_id
      left join public.plan_members member
        on member.plan_id = plan.id
       and member.user_id = p_user_id
       and member.status = 'active'
      where plan.status = 'completed'
        and (
          plan.host_user_id = p_user_id
          or member.user_id is not null
        )

      union

      select distinct
        event.activity_id,
        event.category_id
      from public.reputation_events event
      where event.user_id = p_user_id
        and event.activity_id is not null
        and event.category_id is not null
    )
    select
      'global'::text as context_type,
      'global'::text as context_key,
      null::uuid as category_id,
      null::uuid as activity_id

    union all

    select distinct
      'category'::text,
      'category:' || user_context.category_id::text,
      user_context.category_id,
      null::uuid
    from user_contexts user_context

    union all

    select distinct
      'activity'::text,
      'activity:' || user_context.activity_id::text,
      user_context.category_id,
      user_context.activity_id
    from user_contexts user_context
  loop
    foreach v_role in array array['combined', 'host', 'participant']
    loop
      select
        count(distinct plan.id)::integer,
        count(*) filter (
          where coalesce(
            member.attendance_status,
            case
              when plan.host_user_id = p_user_id then 'pending'
              else null
            end
          ) in ('attended', 'no_show')
        )::integer,
        count(*) filter (
          where member.attendance_status = 'attended'
        )::integer,
        count(*) filter (
          where member.attendance_status = 'no_show'
        )::integer
      into
        v_activity_count,
        v_attendance_observation_count,
        v_attended_count,
        v_no_show_count
      from public.plans plan
      join public.activities activity
        on activity.id = plan.activity_id
      left join public.plan_members member
        on member.plan_id = plan.id
       and member.user_id = p_user_id
       and member.status = 'active'
      where plan.status = 'completed'
        and (
          plan.host_user_id = p_user_id
          or member.user_id is not null
        )
        and (
          v_context.context_type = 'global'
          or (
            v_context.context_type = 'category'
            and activity.category_id = v_context.category_id
          )
          or (
            v_context.context_type = 'activity'
            and plan.activity_id = v_context.activity_id
          )
        )
        and (
          v_role = 'combined'
          or (
            v_role = 'host'
            and (
              plan.host_user_id = p_user_id
              or member.role = 'co_host'
            )
          )
          or (
            v_role = 'participant'
            and plan.host_user_id <> p_user_id
            and coalesce(member.role, 'participant') <> 'co_host'
          )
        );

      select count(distinct event.plan_id)::integer
      into v_late_cancel_count
      from public.reputation_events event
      where event.user_id = p_user_id
        and event.event_type in (
          'late_cancel',
          'host_cancelled_late'
        )
        and (
          v_context.context_type = 'global'
          or (
            v_context.context_type = 'category'
            and event.category_id = v_context.category_id
          )
          or (
            v_context.context_type = 'activity'
            and event.activity_id = v_context.activity_id
          )
        )
        and (
          v_role = 'combined'
          or event.role = v_role
        );

      select
        count(*)::integer,
        count(*) filter (
          where feedback.would_join_again
        )::integer
      into
        v_feedback_count,
        v_would_join_again_count
      from public.activity_feedback feedback
      where feedback.to_user_id = p_user_id
        and feedback.status <> 'void'
        and coalesce(feedback.revealed_at, feedback.reveal_at) <= now()
        and (
          v_context.context_type = 'global'
          or (
            v_context.context_type = 'category'
            and feedback.category_id = v_context.category_id
          )
          or (
            v_context.context_type = 'activity'
            and feedback.activity_id = v_context.activity_id
          )
        )
        and (
          v_role = 'combined'
          or feedback.to_role = v_role
        );

      select
        coalesce(
          jsonb_object_agg(
            dimension_row.dimension,
            jsonb_build_object(
              'score', dimension_row.score,
              'responses', dimension_row.responses
            )
          ),
          '{}'::jsonb
        ),
        avg(dimension_row.raw_average)
      into
        v_dimension_scores,
        v_dimension_average
      from (
        select
          answer.dimension,
          round(
            100 * sum(
              answer.normalized_score * answer.weight_snapshot
            ) / nullif(sum(answer.weight_snapshot), 0),
            0
          ) as score,
          count(distinct feedback.id)::integer as responses,
          sum(
            answer.normalized_score * answer.weight_snapshot
          ) / nullif(sum(answer.weight_snapshot), 0) as raw_average
        from public.activity_feedback feedback
        join public.activity_feedback_answers answer
          on answer.feedback_id = feedback.id
        where feedback.to_user_id = p_user_id
          and feedback.status <> 'void'
          and coalesce(feedback.revealed_at, feedback.reveal_at) <= now()
          and answer.public_summary_eligible
          and (
            v_context.context_type = 'global'
            or (
              v_context.context_type = 'category'
              and feedback.category_id = v_context.category_id
            )
            or (
              v_context.context_type = 'activity'
              and feedback.activity_id = v_context.activity_id
            )
          )
          and (
            v_role = 'combined'
            or feedback.to_role = v_role
          )
        group by answer.dimension
      ) dimension_row;

      if coalesce(v_activity_count, 0) = 0
        and coalesce(v_feedback_count, 0) = 0
        and coalesce(v_late_cancel_count, 0) = 0
      then
        continue;
      end if;

      v_attendance_rate := round(
        100 * (
          coalesce(v_attended_count, 0) + 2.0
        ) / (
          coalesce(v_attendance_observation_count, 0) + 3.0
        ),
        1
      );

      v_would_join_again_rate := round(
        100 * (
          coalesce(v_would_join_again_count, 0) + 2.0
        ) / (
          coalesce(v_feedback_count, 0) + 3.0
        ),
        1
      );

      v_dimension_average := coalesce(v_dimension_average, 0.75);

      v_overall_score := round(
        greatest(
          0,
          0.50 * v_attendance_rate
          + 0.20 * v_would_join_again_rate
          + 0.30 * (100 * v_dimension_average)
          - least(
              15,
              coalesce(v_late_cancel_count, 0) * 3
            )
        ),
        1
      );

      if coalesce(v_activity_count, 0) < 3
        and coalesce(v_feedback_count, 0) < 3
      then
        v_reputation_level := 'new';
      elsif v_overall_score >= 88 then
        v_reputation_level := 'highly_reliable';
      elsif v_overall_score >= 72 then
        v_reputation_level := 'reliable';
      elsif v_overall_score >= 55 then
        v_reputation_level := 'developing';
      else
        v_reputation_level := 'mixed';
      end if;

      if coalesce(v_activity_count, 0) + coalesce(v_feedback_count, 0) >= 12 then
        v_confidence_level := 'high';
      elsif coalesce(v_activity_count, 0) + coalesce(v_feedback_count, 0) >= 5 then
        v_confidence_level := 'medium';
      else
        v_confidence_level := 'low';
      end if;

      insert into public.reputation_context_summaries (
        user_id,
        context_key,
        context_type,
        category_id,
        activity_id,
        role,
        activity_count,
        attendance_observation_count,
        attended_count,
        no_show_count,
        late_cancel_count,
        feedback_count,
        would_join_again_count,
        attendance_rate,
        would_join_again_rate,
        dimension_scores,
        overall_score,
        reputation_level,
        confidence_level,
        algorithm_version,
        calculated_at
      )
      values (
        p_user_id,
        v_context.context_key,
        v_context.context_type,
        v_context.category_id,
        v_context.activity_id,
        v_role,
        coalesce(v_activity_count, 0),
        coalesce(v_attendance_observation_count, 0),
        coalesce(v_attended_count, 0),
        coalesce(v_no_show_count, 0),
        coalesce(v_late_cancel_count, 0),
        coalesce(v_feedback_count, 0),
        coalesce(v_would_join_again_count, 0),
        v_attendance_rate,
        v_would_join_again_rate,
        coalesce(v_dimension_scores, '{}'::jsonb),
        v_overall_score,
        v_reputation_level,
        v_confidence_level,
        1,
        now()
      );
    end loop;
  end loop;
end;
$function$;

create or replace function public.submit_reputation_feedback(
  p_plan_id uuid,
  p_target_user_id uuid,
  p_would_join_again boolean,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_activity public.activities%rowtype;
  v_from_role text;
  v_to_role text;
  v_feedback_id uuid;
  v_reverse_feedback_id uuid;
  v_question record;
  v_answer jsonb;
  v_numeric numeric;
  v_boolean boolean;
  v_normalized numeric;
  v_reveal_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.reputation_feedback_actor_is_eligible(
    p_plan_id,
    v_user_id
  ) then
    raise exception 'You are not eligible to leave feedback for this Activity.'
      using errcode = '42501';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Feedback answers must be a JSON array.'
      using errcode = '22023';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id
    and status = 'completed'
  for update;

  if not found then
    raise exception 'Completed Activity not found.'
      using errcode = 'P0002';
  end if;

  select *
  into v_activity
  from public.activities
  where id = v_plan.activity_id;

  v_from_role := public.reputation_plan_role(
    p_plan_id,
    v_user_id
  );

  v_to_role := public.reputation_plan_role(
    p_plan_id,
    p_target_user_id
  );

  if v_to_role is null
    or p_target_user_id = v_user_id
    or not public.reputation_feedback_target_is_eligible(
      p_plan_id,
      p_target_user_id
    )
  then
    raise exception 'This person cannot be evaluated for this Activity.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.activity_feedback feedback
    where feedback.plan_id = p_plan_id
      and feedback.from_user_id = v_user_id
      and feedback.to_user_id = p_target_user_id
      and feedback.status <> 'void'
  ) then
    raise exception 'Feedback has already been submitted for this person.'
      using errcode = '23505';
  end if;

  v_reveal_at := public.reputation_feedback_deadline(v_plan.id);

  insert into public.activity_feedback (
    plan_id,
    activity_id,
    category_id,
    from_user_id,
    to_user_id,
    from_role,
    to_role,
    would_join_again,
    status,
    reveal_at
  )
  values (
    p_plan_id,
    v_plan.activity_id,
    v_activity.category_id,
    v_user_id,
    p_target_user_id,
    v_from_role,
    v_to_role,
    coalesce(p_would_join_again, false),
    'submitted',
    v_reveal_at
  )
  returning id into v_feedback_id;

  for v_question in
    select
      question.*,
      version.id as version_id,
      version.prompt,
      version.weight,
      version.options
    from public.reputation_questions question
    join public.reputation_question_versions version
      on version.question_id = question.id
     and version.version_no = question.current_version
    where question.is_active
      and question.applies_to_role in ('both', v_to_role)
      and (
        question.scope_type = 'global'
        or (
          question.scope_type = 'category'
          and question.category_id = v_activity.category_id
        )
        or (
          question.scope_type = 'activity'
          and question.activity_id = v_activity.id
        )
      )
    order by
      case question.scope_type
        when 'global' then 0
        when 'category' then 1
        else 2
      end,
      question.sort_order,
      question.created_at
  loop
    select answer
    into v_answer
    from jsonb_array_elements(p_answers) answer
    where answer ->> 'question_id' = v_question.id::text
    limit 1;

    if v_answer is null then
      if v_question.is_required then
        raise exception 'A required reputation question was not answered.'
          using errcode = '22023';
      end if;

      continue;
    end if;

    if v_question.response_type = 'yes_no' then
      begin
        v_boolean := (v_answer ->> 'value')::boolean;
      exception
        when others then
          raise exception 'A yes/no reputation answer is invalid.'
            using errcode = '22023';
      end;

      v_numeric := null;
      v_normalized := case when v_boolean then 1 else 0 end;
    else
      begin
        v_numeric := (v_answer ->> 'value')::numeric;
      exception
        when others then
          raise exception 'A rating reputation answer is invalid.'
            using errcode = '22023';
      end;

      if v_numeric < 1 or v_numeric > 5 then
        raise exception 'Ratings must be between 1 and 5.'
          using errcode = '22023';
      end if;

      v_boolean := null;
      v_normalized := (v_numeric - 1) / 4;
    end if;

    insert into public.activity_feedback_answers (
      feedback_id,
      question_id,
      question_version_id,
      dimension,
      prompt_snapshot,
      response_type,
      numeric_value,
      boolean_value,
      normalized_score,
      weight_snapshot,
      public_summary_eligible
    )
    values (
      v_feedback_id,
      v_question.id,
      v_question.version_id,
      v_question.dimension,
      v_question.prompt,
      v_question.response_type,
      v_numeric,
      v_boolean,
      v_normalized,
      v_question.weight,
      v_question.public_summary_eligible
    );
  end loop;

  select feedback.id
  into v_reverse_feedback_id
  from public.activity_feedback feedback
  where feedback.plan_id = p_plan_id
    and feedback.from_user_id = p_target_user_id
    and feedback.to_user_id = v_user_id
    and feedback.status = 'submitted'
  limit 1;

  if v_reverse_feedback_id is not null then
    update public.activity_feedback
    set
      status = 'revealed',
      revealed_at = now()
    where id in (
      v_feedback_id,
      v_reverse_feedback_id
    );
  elsif v_reveal_at <= now() then
    update public.activity_feedback
    set
      status = 'revealed',
      revealed_at = now()
    where id = v_feedback_id;
  end if;

  insert into public.reputation_events (
    user_id,
    plan_id,
    activity_id,
    category_id,
    role,
    event_type,
    source_user_id,
    score_value,
    metadata
  )
  values (
    p_target_user_id,
    p_plan_id,
    v_plan.activity_id,
    v_activity.category_id,
    v_to_role,
    'peer_feedback_submitted',
    v_user_id,
    case when p_would_join_again then 1 else 0 end,
    jsonb_build_object(
      'feedback_id', v_feedback_id,
      'revealed_immediately', v_reverse_feedback_id is not null
    )
  );

  perform public.refresh_reputation_for_user(p_target_user_id);

  if v_reverse_feedback_id is not null then
    perform public.refresh_reputation_for_user(v_user_id);
  end if;

  return v_feedback_id;
end;
$function$;

create or replace function public.get_my_pending_reputation_feedback()
returns table (
  plan_id uuid,
  plan_title text,
  activity_name text,
  category_name text,
  completed_at timestamptz,
  feedback_deadline timestamptz,
  target_user_id uuid,
  target_full_name text,
  target_username text,
  target_avatar_url text,
  target_role text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or public.reputation_is_managed_minor(v_user_id)
  then
    return;
  end if;

  return query
  with eligible_plans as (
    select
      plan.*,
      activity.name as canonical_activity_name,
      category.name as canonical_category_name
    from public.plans plan
    join public.activities activity
      on activity.id = plan.activity_id
    join public.activity_categories category
      on category.id = activity.category_id
    left join public.plan_members viewer_member
      on viewer_member.plan_id = plan.id
     and viewer_member.user_id = v_user_id
     and viewer_member.status = 'active'
    where plan.status = 'completed'
      and public.reputation_feedback_deadline(plan.id) >= now()
      and (
        plan.host_user_id = v_user_id
        or viewer_member.attendance_status = 'attended'
      )
  ),
  people as (
    select
      plan.id as plan_id,
      plan.host_user_id as user_id,
      'host'::text as role
    from eligible_plans plan

    union all

    select
      plan.id,
      member.user_id,
      case
        when member.role = 'co_host' then 'host'
        else 'participant'
      end::text
    from eligible_plans plan
    join public.plan_members member
      on member.plan_id = plan.id
    where member.status = 'active'
      and member.user_id <> plan.host_user_id
  )
  select
    plan.id,
    plan.title,
    plan.canonical_activity_name,
    plan.canonical_category_name,
    plan.completed_at,
    public.reputation_feedback_deadline(plan.id),
    person.user_id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    person.role
  from eligible_plans plan
  join people person
    on person.plan_id = plan.id
  join public.profiles profile
    on profile.id = person.user_id
  where person.user_id <> v_user_id
    and not public.reputation_is_managed_minor(person.user_id)
    and not exists (
      select 1
      from public.activity_feedback feedback
      where feedback.plan_id = plan.id
        and feedback.from_user_id = v_user_id
        and feedback.to_user_id = person.user_id
        and feedback.status <> 'void'
    )
  order by
    plan.completed_at desc nulls last,
    plan.id,
    case person.role when 'host' then 0 else 1 end,
    profile.full_name nulls last,
    profile.username;
end;
$function$;

create or replace function public.get_my_pending_reputation_feedback_count()
returns integer
language sql
stable
security definer
set search_path = public
as $function$
  select count(*)::integer
  from public.get_my_pending_reputation_feedback();
$function$;

create or replace function public.reputation_public_dimension_scores(
  p_scores jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $function$
  select coalesce(
    jsonb_object_agg(entry.key, entry.value),
    '{}'::jsonb
  )
  from jsonb_each(
    coalesce(p_scores, '{}'::jsonb)
  ) entry
  where coalesce(
    (entry.value ->> 'responses')::integer,
    0
  ) >= 3;
$function$;

create or replace function public.get_public_reputation_summary(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_is_minor boolean;
  v_participation_count integer;
begin
  v_is_minor := public.reputation_is_managed_minor(p_user_id);

  if v_is_minor then
    select count(distinct plan.id)::integer
    into v_participation_count
    from public.plans plan
    left join public.plan_members member
      on member.plan_id = plan.id
     and member.user_id = p_user_id
    where plan.status = 'completed'
      and (
        plan.host_user_id = p_user_id
        or member.user_id is not null
      );

    return jsonb_build_object(
      'is_managed_minor', true,
      'participation_count', coalesce(v_participation_count, 0),
      'global', null,
      'role_summaries', '[]'::jsonb,
      'contexts', '[]'::jsonb
    );
  end if;

  perform public.refresh_reputation_for_user(p_user_id);

  return jsonb_build_object(
    'is_managed_minor', false,
    'participation_count', coalesce(
      (
        select summary.activity_count
        from public.reputation_context_summaries summary
        where summary.user_id = p_user_id
          and summary.context_key = 'global'
          and summary.role = 'combined'
      ),
      0
    ),
    'global',
    (
      select jsonb_build_object(
        'id', summary.id,
        'user_id', summary.user_id,
        'context_key', summary.context_key,
        'context_type', summary.context_type,
        'category_id', summary.category_id,
        'activity_id', summary.activity_id,
        'role', summary.role,
        'activity_count', summary.activity_count,
        'attendance_observation_count', summary.attendance_observation_count,
        'feedback_count', summary.feedback_count,
        'would_join_again_count', case when summary.feedback_count >= 3 then summary.would_join_again_count else null end,
        'attendance_rate', case when summary.attendance_observation_count >= 3 then summary.attendance_rate else null end,
        'would_join_again_rate', case when summary.feedback_count >= 3 then summary.would_join_again_rate else null end,
        'dimension_scores', public.reputation_public_dimension_scores(summary.dimension_scores),
        'reputation_level', summary.reputation_level,
        'confidence_level', summary.confidence_level,
        'algorithm_version', summary.algorithm_version,
        'calculated_at', summary.calculated_at
      )
      from public.reputation_context_summaries summary
      where summary.user_id = p_user_id
        and summary.context_key = 'global'
        and summary.role = 'combined'
      limit 1
    ),
    'role_summaries',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', summary.id,
            'user_id', summary.user_id,
            'context_key', summary.context_key,
            'context_type', summary.context_type,
            'category_id', summary.category_id,
            'activity_id', summary.activity_id,
            'role', summary.role,
            'activity_count', summary.activity_count,
            'attendance_observation_count', summary.attendance_observation_count,
            'feedback_count', summary.feedback_count,
            'would_join_again_count', case when summary.feedback_count >= 3 then summary.would_join_again_count else null end,
            'attendance_rate', case when summary.attendance_observation_count >= 3 then summary.attendance_rate else null end,
            'would_join_again_rate', case when summary.feedback_count >= 3 then summary.would_join_again_rate else null end,
            'dimension_scores', public.reputation_public_dimension_scores(summary.dimension_scores),
                'reputation_level', summary.reputation_level,
            'confidence_level', summary.confidence_level,
            'algorithm_version', summary.algorithm_version,
            'calculated_at', summary.calculated_at
          )
          order by summary.role
        )
        from public.reputation_context_summaries summary
        where summary.user_id = p_user_id
          and summary.context_key = 'global'
          and summary.role in ('host', 'participant')
      ),
      '[]'::jsonb
    ),
    'contexts',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', summary.id,
            'user_id', summary.user_id,
            'context_key', summary.context_key,
            'context_type', summary.context_type,
            'category_id', summary.category_id,
            'activity_id', summary.activity_id,
            'role', summary.role,
            'activity_count', summary.activity_count,
            'attendance_observation_count', summary.attendance_observation_count,
            'feedback_count', summary.feedback_count,
            'would_join_again_count', case when summary.feedback_count >= 3 then summary.would_join_again_count else null end,
            'attendance_rate', case when summary.attendance_observation_count >= 3 then summary.attendance_rate else null end,
            'would_join_again_rate', case when summary.feedback_count >= 3 then summary.would_join_again_rate else null end,
            'dimension_scores', public.reputation_public_dimension_scores(summary.dimension_scores),
                'reputation_level', summary.reputation_level,
            'confidence_level', summary.confidence_level,
            'algorithm_version', summary.algorithm_version,
            'calculated_at', summary.calculated_at,
            'category_name', category.name,
            'activity_name', activity.name
          )
          order by
            case summary.context_type when 'activity' then 0 else 1 end,
            summary.activity_count desc,
            summary.overall_score desc nulls last
        )
        from public.reputation_context_summaries summary
        left join public.activity_categories category
          on category.id = summary.category_id
        left join public.activities activity
          on activity.id = summary.activity_id
        where summary.user_id = p_user_id
          and summary.role = 'combined'
          and summary.context_type in ('activity', 'category')
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.get_public_reputation_context(
  p_user_id uuid,
  p_activity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_category_id uuid;
  v_summary public.reputation_context_summaries%rowtype;
  v_source text;
begin
  if public.reputation_is_managed_minor(p_user_id) then
    return jsonb_build_object(
      'is_managed_minor', true,
      'source_context', 'minor',
      'summary', null
    );
  end if;

  select activity.category_id
  into v_category_id
  from public.activities activity
  where activity.id = p_activity_id;

  perform public.refresh_reputation_for_user(p_user_id);

  select *
  into v_summary
  from public.reputation_context_summaries summary
  where summary.user_id = p_user_id
    and summary.role = 'combined'
    and summary.context_key = 'activity:' || p_activity_id::text;

  if found then
    v_source := 'activity';
  else
    select *
    into v_summary
    from public.reputation_context_summaries summary
    where summary.user_id = p_user_id
      and summary.role = 'combined'
      and summary.context_key = 'category:' || v_category_id::text;

    if found then
      v_source := 'category';
    else
      select *
      into v_summary
      from public.reputation_context_summaries summary
      where summary.user_id = p_user_id
        and summary.role = 'combined'
        and summary.context_key = 'global';

      v_source := 'global';
    end if;
  end if;

  return jsonb_build_object(
    'is_managed_minor', false,
    'source_context', v_source,
    'summary',
    case
      when v_summary.id is null then null
      else jsonb_build_object(
        'id', v_summary.id,
        'user_id', v_summary.user_id,
        'context_key', v_summary.context_key,
        'context_type', v_summary.context_type,
        'category_id', v_summary.category_id,
        'activity_id', v_summary.activity_id,
        'role', v_summary.role,
        'activity_count', v_summary.activity_count,
        'attendance_observation_count', v_summary.attendance_observation_count,
        'feedback_count', v_summary.feedback_count,
        'would_join_again_count', case when v_summary.feedback_count >= 3 then v_summary.would_join_again_count else null end,
        'attendance_rate', case when v_summary.attendance_observation_count >= 3 then v_summary.attendance_rate else null end,
        'would_join_again_rate', case when v_summary.feedback_count >= 3 then v_summary.would_join_again_rate else null end,
        'dimension_scores', public.reputation_public_dimension_scores(v_summary.dimension_scores),
        'reputation_level', v_summary.reputation_level,
        'confidence_level', v_summary.confidence_level,
        'algorithm_version', v_summary.algorithm_version,
        'calculated_at', v_summary.calculated_at
      )
    end
  );
end;
$function$;

create or replace function public.log_reputation_attendance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_activity_id uuid;
  v_category_id uuid;
  v_role text;
begin
  if old.attendance_status is not distinct from new.attendance_status then
    return new;
  end if;

  select
    plan.activity_id,
    activity.category_id,
    case
      when plan.host_user_id = new.user_id or new.role = 'co_host' then 'host'
      else 'participant'
    end
  into
    v_activity_id,
    v_category_id,
    v_role
  from public.plans plan
  join public.activities activity
    on activity.id = plan.activity_id
  where plan.id = new.plan_id;

  insert into public.reputation_events (
    user_id,
    plan_id,
    activity_id,
    category_id,
    role,
    event_type,
    source_user_id,
    score_value,
    metadata
  )
  values (
    new.user_id,
    new.plan_id,
    v_activity_id,
    v_category_id,
    v_role,
    'attendance_' || new.attendance_status,
    new.attendance_updated_by,
    case
      when new.attendance_status = 'attended' then 1
      when new.attendance_status = 'no_show' then -1
      else 0
    end,
    jsonb_build_object(
      'previous_status', old.attendance_status,
      'new_status', new.attendance_status
    )
  );

  return new;
end;
$function$;

drop trigger if exists plan_members_reputation_attendance_event
  on public.plan_members;

create trigger plan_members_reputation_attendance_event
  after update of attendance_status
  on public.plan_members
  for each row
  execute function public.log_reputation_attendance_event();

create or replace function public.log_reputation_departure_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_plan public.plans%rowtype;
  v_category_id uuid;
  v_role text;
  v_event_type text;
begin
  if old.status <> 'active'
    or new.status not in ('withdrawn', 'removed')
  then
    return new;
  end if;

  select *
  into v_plan
  from public.plans
  where id = new.plan_id;

  if not found then
    return new;
  end if;

  select activity.category_id
  into v_category_id
  from public.activities activity
  where activity.id = v_plan.activity_id;

  v_role := case
    when v_plan.host_user_id = new.user_id or new.role = 'co_host' then 'host'
    else 'participant'
  end;

  v_event_type := case
    when new.status = 'removed' then 'member_removed'
    when v_plan.scheduled_start is not null
      and coalesce(new.departed_at, now()) >= v_plan.scheduled_start - interval '24 hours'
      then 'late_cancel'
    else 'early_cancel'
  end;

  insert into public.reputation_events (
    user_id,
    plan_id,
    activity_id,
    category_id,
    role,
    event_type,
    source_user_id,
    score_value,
    metadata
  )
  values (
    new.user_id,
    new.plan_id,
    v_plan.activity_id,
    v_category_id,
    v_role,
    v_event_type,
    new.actioned_by,
    case when v_event_type = 'late_cancel' then -0.5 else 0 end,
    jsonb_build_object(
      'member_status', new.status,
      'departure_reason', new.departure_reason,
      'scheduled_start', v_plan.scheduled_start,
      'departed_at', new.departed_at
    )
  );

  return new;
end;
$function$;

drop trigger if exists plan_members_reputation_departure_event
  on public.plan_members;

create trigger plan_members_reputation_departure_event
  after update of status
  on public.plan_members
  for each row
  execute function public.log_reputation_departure_event();

create or replace function public.log_reputation_plan_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_category_id uuid;
  v_event_type text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select activity.category_id
  into v_category_id
  from public.activities activity
  where activity.id = new.activity_id;

  if new.status = 'completed' then
    v_event_type := 'host_completed_activity';
  elsif new.status = 'cancelled' then
    v_event_type := case
      when new.scheduled_start is not null
        and coalesce(new.cancelled_at, now()) >= new.scheduled_start - interval '24 hours'
        then 'host_cancelled_late'
      else 'host_cancelled_early'
    end;
  else
    return new;
  end if;

  insert into public.reputation_events (
    user_id,
    plan_id,
    activity_id,
    category_id,
    role,
    event_type,
    source_user_id,
    score_value,
    metadata
  )
  values (
    new.host_user_id,
    new.id,
    new.activity_id,
    v_category_id,
    'host',
    v_event_type,
    coalesce(new.completion_recorded_by, new.cancelled_by),
    case
      when v_event_type = 'host_completed_activity' then 1
      when v_event_type = 'host_cancelled_late' then -0.5
      else 0
    end,
    jsonb_build_object(
      'previous_status', old.status,
      'new_status', new.status,
      'scheduled_start', new.scheduled_start,
      'completed_at', new.completed_at,
      'cancelled_at', new.cancelled_at,
      'cancellation_reason', new.cancellation_reason
    )
  );

  return new;
end;
$function$;

drop trigger if exists plans_reputation_status_event
  on public.plans;

create trigger plans_reputation_status_event
  after update of status
  on public.plans
  for each row
  execute function public.log_reputation_plan_status_event();

insert into public.reputation_feedback_windows (
  plan_id,
  opened_at,
  closes_at,
  reason
)
select
  plan.id,
  now(),
  now() + interval '14 days',
  'initial_rollout'
from public.plans plan
where plan.status = 'completed'
  and coalesce(plan.completed_at, plan.updated_at) >= now() - interval '90 days'
on conflict (plan_id) do nothing;

do $seed$
declare
  v_item jsonb;
  v_question_id uuid;
  v_category_id uuid;
  v_activity_id uuid;
  v_scope text;
begin
  for v_item in
    select value
    from jsonb_array_elements(
      '[
        {
          "scope": "global",
          "dimension": "reliable",
          "prompt": "Was this person reliable throughout the Activity?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.4,
          "sort_order": 10,
          "options": {"low_label": "Not reliable", "high_label": "Very reliable"}
        },
        {
          "scope": "global",
          "dimension": "respectful",
          "prompt": "Was this person respectful toward the other people involved?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.3,
          "sort_order": 20,
          "options": {"low_label": "Not respectful", "high_label": "Very respectful"}
        },
        {
          "scope": "global",
          "dimension": "clear_communication",
          "prompt": "Did this person communicate clearly during planning and the Activity?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1,
          "sort_order": 30,
          "options": {"low_label": "Unclear", "high_label": "Very clear"}
        },
        {
          "scope": "category",
          "category_name": "Sport Activity",
          "dimension": "sportsmanship",
          "prompt": "Did this person show good sportsmanship?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.5,
          "sort_order": 100,
          "options": {"low_label": "Poor sportsmanship", "high_label": "Excellent sportsmanship"}
        },
        {
          "scope": "category",
          "category_name": "Sport Activity",
          "dimension": "safe_play",
          "prompt": "Did this person participate in a safe and responsible way?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.5,
          "sort_order": 110,
          "options": {"low_label": "Unsafe", "high_label": "Very safe"}
        },
        {
          "scope": "category",
          "category_name": "Sport Activity",
          "dimension": "team_oriented",
          "prompt": "Was this person cooperative and team-oriented?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1,
          "sort_order": 120,
          "options": {"low_label": "Not cooperative", "high_label": "Very cooperative"}
        },
        {
          "scope": "category",
          "category_name": "Business Activity",
          "dimension": "prepared",
          "prompt": "Was this person prepared for the Business Activity?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.2,
          "sort_order": 100,
          "options": {"low_label": "Unprepared", "high_label": "Very prepared"}
        },
        {
          "scope": "category",
          "category_name": "Business Activity",
          "dimension": "time_respect",
          "prompt": "Did this person respect the agreed time and commitments?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.3,
          "sort_order": 110,
          "options": {"low_label": "Did not respect time", "high_label": "Fully respected time"}
        },
        {
          "scope": "activity",
          "activity_name": "Basketball",
          "dimension": "intensity_match",
          "prompt": "Did this person match the intensity and style agreed for this Basketball Activity?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.2,
          "sort_order": 200,
          "options": {"low_label": "Did not match", "high_label": "Matched very well"}
        },
        {
          "scope": "activity",
          "activity_name": "Family Picnic",
          "dimension": "family_friendly",
          "prompt": "Was this person considerate and family-friendly during the Family Picnic?",
          "response_type": "scale_5",
          "role": "both",
          "weight": 1.3,
          "sort_order": 200,
          "options": {"low_label": "Not family-friendly", "high_label": "Very family-friendly"}
        }
      ]'::jsonb
    )
  loop
    v_scope := v_item ->> 'scope';
    v_category_id := null;
    v_activity_id := null;

    if v_scope = 'category' then
      select category.id
      into v_category_id
      from public.activity_categories category
      where lower(category.name) = lower(v_item ->> 'category_name')
      limit 1;

      if v_category_id is null then
        continue;
      end if;
    elsif v_scope = 'activity' then
      select
        activity.id,
        activity.category_id
      into
        v_activity_id,
        v_category_id
      from public.activities activity
      where lower(activity.name) = lower(v_item ->> 'activity_name')
      order by activity.created_at
      limit 1;

      if v_activity_id is null then
        continue;
      end if;
    end if;

    if exists (
      select 1
      from public.reputation_questions question
      where question.scope_type = v_scope
        and question.category_id is not distinct from v_category_id
        and question.activity_id is not distinct from v_activity_id
        and question.dimension = v_item ->> 'dimension'
    ) then
      continue;
    end if;

    insert into public.reputation_questions (
      scope_type,
      category_id,
      activity_id,
      dimension,
      response_type,
      applies_to_role,
      is_required,
      public_summary_eligible,
      sort_order,
      is_active,
      current_version
    )
    values (
      v_scope,
      v_category_id,
      v_activity_id,
      v_item ->> 'dimension',
      v_item ->> 'response_type',
      v_item ->> 'role',
      true,
      true,
      (v_item ->> 'sort_order')::integer,
      true,
      1
    )
    returning id into v_question_id;

    insert into public.reputation_question_versions (
      question_id,
      version_no,
      prompt,
      weight,
      positive_direction,
      options
    )
    values (
      v_question_id,
      1,
      v_item ->> 'prompt',
      (v_item ->> 'weight')::numeric,
      true,
      coalesce(v_item -> 'options', '{}'::jsonb)
    );
  end loop;
end;
$seed$;

revoke all on function public.reputation_is_managed_minor(uuid) from public;
revoke all on function public.reputation_plan_role(uuid, uuid) from public;
revoke all on function public.reputation_feedback_deadline(uuid) from public;
revoke all on function public.reputation_feedback_actor_is_eligible(uuid, uuid) from public;
revoke all on function public.reputation_feedback_target_is_eligible(uuid, uuid) from public;
revoke all on function public.refresh_reputation_for_user(uuid) from public;
revoke all on function public.reputation_public_dimension_scores(jsonb) from public;
revoke all on function public.log_reputation_attendance_event() from public;
revoke all on function public.log_reputation_departure_event() from public;
revoke all on function public.log_reputation_plan_status_event() from public;

revoke all on function public.get_admin_reputation_catalogue() from public;
revoke all on function public.admin_create_reputation_question(
  text, uuid, uuid, text, text, text, text, numeric, boolean, boolean, integer, jsonb
) from public;
revoke all on function public.admin_update_reputation_question(
  uuid, text, uuid, uuid, text, text, text, text, numeric, boolean, boolean, integer, jsonb
) from public;
revoke all on function public.admin_set_reputation_question_active(uuid, boolean) from public;
revoke all on function public.get_reputation_feedback_targets(uuid) from public;
revoke all on function public.get_reputation_feedback_form(uuid, uuid) from public;
revoke all on function public.submit_reputation_feedback(uuid, uuid, boolean, jsonb) from public;
revoke all on function public.get_my_pending_reputation_feedback() from public;
revoke all on function public.get_my_pending_reputation_feedback_count() from public;
revoke all on function public.get_public_reputation_summary(uuid) from public;
revoke all on function public.get_public_reputation_context(uuid, uuid) from public;

grant execute on function public.get_admin_reputation_catalogue() to authenticated;
grant execute on function public.admin_create_reputation_question(
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  boolean,
  boolean,
  integer,
  jsonb
) to authenticated;
grant execute on function public.admin_update_reputation_question(
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  boolean,
  boolean,
  integer,
  jsonb
) to authenticated;
grant execute on function public.admin_set_reputation_question_active(uuid, boolean) to authenticated;
grant execute on function public.get_reputation_feedback_targets(uuid) to authenticated;
grant execute on function public.get_reputation_feedback_form(uuid, uuid) to authenticated;
grant execute on function public.submit_reputation_feedback(uuid, uuid, boolean, jsonb) to authenticated;
grant execute on function public.get_my_pending_reputation_feedback() to authenticated;
grant execute on function public.get_my_pending_reputation_feedback_count() to authenticated;
grant execute on function public.get_public_reputation_summary(uuid) to anon, authenticated;
grant execute on function public.get_public_reputation_context(uuid, uuid) to anon, authenticated;

commit;
