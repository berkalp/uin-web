begin;

alter table public.intents
  add column if not exists archived_at timestamptz;

create index if not exists intents_owner_archived_idx
  on public.intents (user_id, archived_at desc)
  where archived_at is not null;

create table if not exists public.user_resource_archives (
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  archived_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_type, resource_id),
  constraint user_resource_archives_type_check
    check (resource_type in ('intent', 'plan'))
);

create index if not exists user_resource_archives_resource_idx
  on public.user_resource_archives (resource_type, resource_id);

alter table public.user_resource_archives enable row level security;

drop policy if exists "Users can view own resource archives"
  on public.user_resource_archives;

create policy "Users can view own resource archives"
  on public.user_resource_archives
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go through guarded RPCs only.
drop policy if exists "Users can insert own resource archives"
  on public.user_resource_archives;
drop policy if exists "Users can update own resource archives"
  on public.user_resource_archives;
drop policy if exists "Users can delete own resource archives"
  on public.user_resource_archives;

-- Archived public Intents are no longer directly selectable through the
-- generic public-active policy.
drop policy if exists "Users can view public active intents"
  on public.intents;

create policy "Users can view public active intents"
  on public.intents
  for select
  to public
  using (
    visibility = 'public'
    and status = 'active'
    and archived_at is null
  );

create or replace function public.can_user_view_intent_activity(
  p_intent_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_owner_user_id uuid;
  v_visibility text;
  v_archived_at timestamptz;
begin
  select
    intent.user_id,
    intent.visibility,
    intent.archived_at
  into
    v_owner_user_id,
    v_visibility,
    v_archived_at
  from public.intents intent
  where intent.id = p_intent_id
  limit 1;

  if v_owner_user_id is null or v_archived_at is not null then
    return false;
  end if;

  if p_viewer_user_id = v_owner_user_id then
    return true;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'friends' then
    return p_viewer_user_id is not null
      and public.are_users_friends(v_owner_user_id, p_viewer_user_id);
  end if;

  if v_visibility = 'except_friends' then
    return p_viewer_user_id is null
      or not public.are_users_friends(v_owner_user_id, p_viewer_user_id);
  end if;

  if v_visibility = 'invite_only' then
    return p_viewer_user_id is not null
      and public.is_user_invited_to_intent(p_intent_id, p_viewer_user_id);
  end if;

  return false;
end;
$function$;

create or replace function public.can_user_request_join_intent(
  p_intent_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_owner_user_id uuid;
  v_visibility text;
  v_status text;
  v_recruitment_status text;
  v_end_date date;
  v_expired_at timestamptz;
  v_archived_at timestamptz;
begin
  if p_viewer_user_id is null then
    return false;
  end if;

  select
    intent.user_id,
    intent.visibility,
    intent.status,
    intent.recruitment_status,
    intent.end_date,
    intent.expired_at,
    intent.archived_at
  into
    v_owner_user_id,
    v_visibility,
    v_status,
    v_recruitment_status,
    v_end_date,
    v_expired_at,
    v_archived_at
  from public.intents intent
  where intent.id = p_intent_id
  limit 1;

  if
    v_owner_user_id is null
    or p_viewer_user_id = v_owner_user_id
    or v_status <> 'active'
    or v_recruitment_status <> 'open'
    or v_end_date < current_date
    or v_expired_at is not null
    or v_archived_at is not null
  then
    return false;
  end if;

  if exists (
    select 1
    from public.intent_participants participant
    where participant.intent_id = p_intent_id
      and participant.user_id = p_viewer_user_id
      and participant.status = 'active'
  ) then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'friends' then
    return public.are_users_friends(v_owner_user_id, p_viewer_user_id);
  end if;

  if v_visibility = 'except_friends' then
    return not public.are_users_friends(v_owner_user_id, p_viewer_user_id);
  end if;

  return false;
end;
$function$;

create or replace function public.archive_my_resource(
  p_resource_type text,
  p_resource_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_type text;
  v_owner_id uuid;
  v_status text;
  v_expired_at timestamptz;
  v_end_date date;
  v_matching_status text;
  v_recruitment_status text;
  v_plan_status text;
  v_plan_window_end date;
  v_scheduled_end timestamptz;
begin
  v_user_id := auth.uid();
  v_type := lower(btrim(coalesce(p_resource_type, '')));

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_type not in ('intent', 'plan') then
    raise exception 'Unsupported archive resource type.' using errcode = '22023';
  end if;

  if v_type = 'intent' then
    select
      intent.user_id,
      intent.status,
      intent.expired_at,
      intent.end_date,
      intent.matching_status,
      intent.recruitment_status
    into
      v_owner_id,
      v_status,
      v_expired_at,
      v_end_date,
      v_matching_status,
      v_recruitment_status
    from public.intents intent
    where intent.id = p_resource_id
    for update;

    if v_owner_id is null then
      raise exception 'Intent not found.' using errcode = 'P0002';
    end if;

    if v_owner_id <> v_user_id then
      raise exception 'You can archive only your own Intent.' using errcode = '42501';
    end if;

    if exists (
      select 1
      from public.plan_intents plan_intent
      where plan_intent.intent_id = p_resource_id
        and plan_intent.status = 'active'
    ) then
      raise exception 'This Intent belongs to a Shared Activity. Archive the Shared Activity instead.' using errcode = '22023';
    end if;

    if
      v_status = 'active'
      and v_expired_at is null
      and v_end_date >= current_date
      and v_matching_status not in ('closed', 'matched')
      and v_recruitment_status <> 'closed'
    then
      raise exception 'Close or cancel this active Intent before archiving it.' using errcode = '22023';
    end if;

    update public.intents
    set archived_at = now(), updated_at = now()
    where id = p_resource_id;

    return jsonb_build_object(
      'resource_type', 'intent',
      'resource_id', p_resource_id,
      'archived', true,
      'scope', 'global'
    );
  end if;

  select
    plan.status,
    plan.window_end,
    plan.scheduled_end
  into
    v_plan_status,
    v_plan_window_end,
    v_scheduled_end
  from public.plans plan
  where plan.id = p_resource_id
  limit 1;

  if v_plan_status is null then
    raise exception 'Shared Activity not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.plans plan
    where plan.id = p_resource_id
      and (
        plan.host_user_id = v_user_id
        or exists (
          select 1
          from public.plan_members member
          where member.plan_id = plan.id
            and member.user_id = v_user_id
            and member.status = 'active'
        )
      )
  ) then
    raise exception 'You are not a member of this Shared Activity.' using errcode = '42501';
  end if;

  if not (
    v_plan_status in ('completed', 'cancelled')
    or (v_plan_status = 'forming' and v_plan_window_end < current_date)
    or (
      v_plan_status = 'planned'
      and v_scheduled_end is not null
      and v_scheduled_end < now() - interval '24 hours'
    )
  ) then
    raise exception 'Active Shared Activities cannot be archived yet.' using errcode = '22023';
  end if;

  insert into public.user_resource_archives (
    user_id,
    resource_type,
    resource_id,
    archived_at,
    updated_at
  )
  values (
    v_user_id,
    'plan',
    p_resource_id,
    now(),
    now()
  )
  on conflict (user_id, resource_type, resource_id)
  do update set
    archived_at = excluded.archived_at,
    updated_at = now();

  return jsonb_build_object(
    'resource_type', 'plan',
    'resource_id', p_resource_id,
    'archived', true,
    'scope', 'personal'
  );
end;
$function$;

create or replace function public.restore_my_archived_resource(
  p_resource_type text,
  p_resource_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_type text;
begin
  v_user_id := auth.uid();
  v_type := lower(btrim(coalesce(p_resource_type, '')));

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_type = 'intent' then
    update public.intents
    set archived_at = null, updated_at = now()
    where id = p_resource_id
      and user_id = v_user_id
      and archived_at is not null;

    if not found then
      raise exception 'Archived Intent not found.' using errcode = 'P0002';
    end if;

    return;
  end if;

  if v_type = 'plan' then
    delete from public.user_resource_archives
    where user_id = v_user_id
      and resource_type = 'plan'
      and resource_id = p_resource_id;

    if not found then
      raise exception 'Archived Shared Activity not found.' using errcode = 'P0002';
    end if;

    return;
  end if;

  raise exception 'Unsupported archive resource type.' using errcode = '22023';
end;
$function$;

create or replace function public.delete_my_archived_intent(
  p_intent_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_owner_id uuid;
  v_archived_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select intent.user_id, intent.archived_at
  into v_owner_id, v_archived_at
  from public.intents intent
  where intent.id = p_intent_id
  for update;

  if v_owner_id is null then
    raise exception 'Intent not found.' using errcode = 'P0002';
  end if;

  if v_owner_id <> v_user_id then
    raise exception 'You can delete only your own Intent.' using errcode = '42501';
  end if;

  if v_archived_at is null then
    raise exception 'Archive the Intent before deleting it permanently.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.plan_intents plan_intent
    where plan_intent.intent_id = p_intent_id
  ) then
    raise exception 'This Intent is connected to a Shared Activity and cannot be deleted.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.intent_participants participant
    where participant.intent_id = p_intent_id
      and participant.user_id <> v_user_id
  ) then
    raise exception 'This Intent has participant history and cannot be deleted.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.intent_join_requests request_record
    where request_record.intent_id = p_intent_id
  ) then
    raise exception 'This Intent has join request history and cannot be deleted.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.intent_invitations invitation
    where invitation.intent_id = p_intent_id
  ) then
    raise exception 'This Intent has invitation history and cannot be deleted.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.intent_requests request_record
    where request_record.target_intent_id = p_intent_id
      or request_record.own_intent_id = p_intent_id
  ) then
    raise exception 'This Intent has Match request history and cannot be deleted.' using errcode = '23503';
  end if;

  delete from public.intent_match_ignores ignore_record
  where ignore_record.own_intent_id = p_intent_id
     or ignore_record.target_intent_id = p_intent_id;

  begin
    delete from public.intents
    where id = p_intent_id
      and user_id = v_user_id;
  exception
    when foreign_key_violation then
      raise exception 'This Intent has dependent history and cannot be deleted. Keep it archived instead.' using errcode = '23503';
  end;
end;
$function$;

create or replace function public.get_my_archived_resource_keys()
returns table(resource_type text, resource_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select 'intent'::text, intent.id
  from public.intents intent
  where intent.user_id = auth.uid()
    and intent.archived_at is not null

  union all

  select archive_record.resource_type, archive_record.resource_id
  from public.user_resource_archives archive_record
  where archive_record.user_id = auth.uid();
$function$;

create or replace function public.get_profile_hidden_resource_keys(
  p_profile_user_id uuid
)
returns table(resource_type text, resource_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select 'intent'::text, intent.id
  from public.intents intent
  where intent.user_id = p_profile_user_id
    and intent.archived_at is not null

  union all

  select 'plan'::text, archive_record.resource_id
  from public.user_resource_archives archive_record
  where archive_record.user_id = p_profile_user_id
    and archive_record.resource_type = 'plan';
$function$;

create or replace function public.get_my_archived_resources()
returns table(
  resource_type text,
  resource_id uuid,
  intent_id uuid,
  plan_id uuid,
  title text,
  activity_name text,
  category_name text,
  activity_cover_url text,
  category_cover_url text,
  country_name text,
  city text,
  district text,
  location_scope text,
  lifecycle_status text,
  target_start date,
  target_end date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  archived_at timestamptz,
  can_delete_permanently boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with archived_intents as (
    select
      'intent'::text as resource_type,
      intent.id as resource_id,
      intent.id as intent_id,
      null::uuid as plan_id,
      activity.name::text as title,
      activity.name::text as activity_name,
      category.name::text as category_name,
      activity.default_cover_url::text as activity_cover_url,
      category.default_cover_url::text as category_cover_url,
      location.country_name::text as country_name,
      location.city::text as city,
      location.district::text as district,
      location.scope::text as location_scope,
      case
        when intent.status = 'completed' then 'completed'
        when intent.status = 'cancelled' then 'cancelled'
        when intent.expired_at is not null or intent.end_date < current_date then 'expired'
        else 'closed'
      end::text as lifecycle_status,
      intent.start_date::date as target_start,
      intent.end_date::date as target_end,
      null::timestamptz as scheduled_start,
      null::timestamptz as scheduled_end,
      intent.archived_at::timestamptz as archived_at,
      (
        not exists (select 1 from public.plan_intents pi where pi.intent_id = intent.id)
        and not exists (select 1 from public.intent_participants ip where ip.intent_id = intent.id and ip.user_id <> intent.user_id)
        and not exists (select 1 from public.intent_join_requests ijr where ijr.intent_id = intent.id)
        and not exists (select 1 from public.intent_invitations ii where ii.intent_id = intent.id)
        and not exists (
          select 1 from public.intent_requests ir
          where ir.target_intent_id = intent.id or ir.own_intent_id = intent.id
        )
      )::boolean as can_delete_permanently
    from public.intents intent
    join public.activities activity on activity.id = intent.activity_id
    join public.activity_categories category on category.id = activity.category_id
    join public.locations location on location.id = intent.location_id
    where intent.user_id = auth.uid()
      and intent.archived_at is not null
  ),
  archived_plans as (
    select
      'plan'::text as resource_type,
      plan.id as resource_id,
      source_intent.id as intent_id,
      plan.id as plan_id,
      coalesce(nullif(btrim(plan.title), ''), activity.name)::text as title,
      activity.name::text as activity_name,
      category.name::text as category_name,
      coalesce(plan.cover_url, activity.default_cover_url)::text as activity_cover_url,
      category.default_cover_url::text as category_cover_url,
      location.country_name::text as country_name,
      location.city::text as city,
      location.district::text as district,
      location.scope::text as location_scope,
      case
        when plan.status = 'completed' then 'completed'
        when plan.status = 'cancelled' then 'cancelled'
        when plan.status = 'forming' and plan.window_end < current_date then 'expired'
        when plan.status = 'planned' and plan.scheduled_end < now() - interval '24 hours' then 'expired'
        else plan.status
      end::text as lifecycle_status,
      plan.window_start::date as target_start,
      plan.window_end::date as target_end,
      plan.scheduled_start::timestamptz as scheduled_start,
      plan.scheduled_end::timestamptz as scheduled_end,
      archive_record.archived_at::timestamptz as archived_at,
      false::boolean as can_delete_permanently
    from public.user_resource_archives archive_record
    join public.plans plan
      on plan.id = archive_record.resource_id
     and archive_record.resource_type = 'plan'
    join public.activities activity on activity.id = plan.activity_id
    join public.activity_categories category on category.id = activity.category_id
    join public.locations location on location.id = plan.location_id
    left join lateral (
      select intent.*
      from public.plan_intents pi
      join public.intents intent on intent.id = pi.intent_id
      where pi.plan_id = plan.id and pi.status = 'active'
      order by case when pi.relationship = 'host_source' then 0 else 1 end, pi.created_at
      limit 1
    ) source_intent on true
    where archive_record.user_id = auth.uid()
  )
  select * from archived_intents
  union all
  select * from archived_plans
  order by archived_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_active_matches()
 RETURNS TABLE(own_intent_id uuid, own_start_date date, own_end_date date, target_intent_id uuid, target_user_id uuid, target_full_name text, target_username text, target_avatar_url text, activity_name text, category_name text, city text, district text, target_start_date date, target_end_date date, target_people text, target_budget numeric, target_recurrence text, target_visibility text, target_notes text, target_max_participants integer, target_created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    on target_intent.user_id <>
      own_intent.user_id

    and target_intent.activity_id =
      own_intent.activity_id

    and public.locations_overlap(
      target_intent.location_id,
      own_intent.location_id
    )

    and target_intent.start_date <=
      own_intent.end_date

    and own_intent.start_date <=
      target_intent.end_date

  join public.activities activity
    on activity.id =
      target_intent.activity_id

  join public.activity_categories category
    on category.id =
      activity.category_id

  join public.locations location
    on location.id =
      target_intent.location_id

  join public.profiles target_profile
    on target_profile.id =
      target_intent.user_id

  where
    own_intent.user_id =
      auth.uid()

    and own_intent.status =
      'active'

    and own_intent.recruitment_status =
      'open'

    and own_intent.matching_status =
      'open'

    and own_intent.end_date >=
      current_date

    and own_intent.expired_at
      is null

    and own_intent.archived_at
      is null

    and target_intent.status =
      'active'

    and target_intent.recruitment_status =
      'open'

    and target_intent.matching_status =
      'open'

    and target_intent.end_date >=
      current_date

    and target_intent.expired_at
      is null

    and target_intent.archived_at
      is null

    and public.can_user_view_intent_activity(
      target_intent.id,
      auth.uid()
    )

    and not exists (
      select 1
      from public.intent_match_ignores ignored_match
      where
        ignored_match.user_id =
          auth.uid()

        and ignored_match.own_intent_id =
          own_intent.id

        and ignored_match.target_intent_id =
          target_intent.id
    )

    and not exists (
      select 1
      from public.intent_requests request
      where
        (
          request.own_intent_id =
            own_intent.id

          and request.target_intent_id =
            target_intent.id
        )

        or (
          request.own_intent_id =
            target_intent.id

          and request.target_intent_id =
            own_intent.id
        )
    )

    and not exists (
      select 1
      from public.plan_intents own_link

      join public.plan_intents target_link
        on target_link.plan_id =
          own_link.plan_id

      where
        own_link.intent_id =
          own_intent.id

        and target_link.intent_id =
          target_intent.id

        and own_link.status =
          'active'

        and target_link.status =
          'active'
    )

  order by
    greatest(
      own_intent.start_date,
      target_intent.start_date
    ),

    target_intent.created_at desc,

    target_intent.id;
$function$;


CREATE OR REPLACE FUNCTION public.search_visible_intents(p_query text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_activity_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_lifecycle text DEFAULT 'all'::text, p_scope text DEFAULT 'all'::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
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
      not exists (
        select 1
        from public.user_resource_archives archive_record
        where
          archive_record.user_id = v_user_id
          and archive_record.resource_type = 'plan'
          and archive_record.resource_id = plan.id
      )

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
      intent.archived_at is null

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


revoke all on function public.archive_my_resource(text, uuid) from public;
grant execute on function public.archive_my_resource(text, uuid) to authenticated;
revoke all on function public.restore_my_archived_resource(text, uuid) from public;
grant execute on function public.restore_my_archived_resource(text, uuid) to authenticated;
revoke all on function public.delete_my_archived_intent(uuid) from public;
grant execute on function public.delete_my_archived_intent(uuid) to authenticated;
revoke all on function public.get_my_archived_resource_keys() from public;
grant execute on function public.get_my_archived_resource_keys() to authenticated;
revoke all on function public.get_profile_hidden_resource_keys(uuid) from public;
grant execute on function public.get_profile_hidden_resource_keys(uuid) to anon, authenticated;
revoke all on function public.get_my_archived_resources() from public;
grant execute on function public.get_my_archived_resources() to authenticated;

commit;
