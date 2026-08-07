begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- ============================================================
-- 1. DISCOVERY RETURNS ONE RESOURCE PER SHARED PLAN
-- ============================================================
--
-- Before a Plan exists, an Intent is one discoverable resource.
-- After multiple Intents are linked to the same Plan, the Plan becomes
-- the canonical discoverable resource. Participant-source Intents are
-- therefore not emitted as separate duplicate cards.

drop function if exists public.search_visible_intents(
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
);

create or replace function
  public.search_visible_intents(
    p_query text default null,
    p_category_id uuid default null,
    p_activity_id uuid default null,
    p_location_id uuid default null,
    p_start_date date default null,
    p_end_date date default null,
    p_lifecycle text default 'all',
    p_scope text default 'all',
    p_limit integer default 24,
    p_offset integer default 0
  )
returns table (
  intent_id uuid,
  plan_id uuid,
  plan_status text,
  owner_user_id uuid,
  owner_full_name text,
  owner_username text,
  owner_avatar_url text,
  activity_id uuid,
  activity_name text,
  activity_cover_url text,
  category_id uuid,
  category_name text,
  category_cover_url text,
  location_id uuid,
  city text,
  district text,
  start_date date,
  end_date date,
  timezone text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  people text,
  budget numeric,
  recurrence text,
  visibility text,
  intent_type text,
  intent_status text,
  recruitment_status text,
  matching_status text,
  expired_at timestamptz,
  lifecycle_status text,
  max_participants integer,
  active_participant_count integer,
  viewer_can_request boolean,
  viewer_is_member boolean,
  viewer_invitation_status text,
  viewer_request_status text,
  viewer_request_id uuid,
  created_at timestamptz,
  relevance integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
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

      location.city::text
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
        or location.id = p_location_id
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
      location.city::text as city,
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
      not exists (
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
        or location.id = p_location_id
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
$$;

revoke all
on function public.search_visible_intents(
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

revoke all
on function public.search_visible_intents(
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
from anon;

grant execute
on function public.search_visible_intents(
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

-- ============================================================
-- 2. VISIBILITY-SAFE PEOPLE LIST FOR AN INTENT OR SHARED PLAN
-- ============================================================

create or replace function
  public.get_visible_activity_people(
    p_resource_id uuid
  )
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page jsonb;
  v_plan_id uuid;
  v_intent_id uuid;
begin
  v_page :=
    public.get_activity_detail_page(
      p_resource_id
    );

  if v_page is null then
    return;
  end if;

  begin
    v_plan_id :=
      nullif(
        v_page #>> '{activity,plan_id}',
        ''
      )::uuid;
  exception
    when invalid_text_representation then
      v_plan_id := null;
  end;

  begin
    v_intent_id :=
      nullif(
        v_page #>> '{activity,intent_id}',
        ''
      )::uuid;
  exception
    when invalid_text_representation then
      v_intent_id := null;
  end;

  if v_plan_id is not null then
    return query
    select
      member.user_id::uuid,
      profile.full_name::text,
      profile.username::text,
      profile.avatar_url::text,
      member.role::text
    from public.plan_members member

    left join public.profiles profile
      on profile.id = member.user_id

    where
      member.plan_id = v_plan_id
      and member.status = 'active'

    order by
      case member.role
        when 'host' then 0
        when 'co_host' then 1
        else 2
      end,
      member.joined_at asc,
      member.user_id asc;

    return;
  end if;

  if v_intent_id is not null then
    return query
    select
      person.user_id,
      person.full_name,
      person.username,
      person.avatar_url,
      person.role
    from (
      select
        intent.user_id::uuid as user_id,
        owner_profile.full_name::text as full_name,
        owner_profile.username::text as username,
        owner_profile.avatar_url::text as avatar_url,
        'host'::text as role,
        0::integer as sort_order,
        intent.created_at::timestamptz as joined_at
      from public.intents intent

      left join public.profiles owner_profile
        on owner_profile.id = intent.user_id

      where intent.id = v_intent_id

      union all

      select
        participant.user_id::uuid,
        participant_profile.full_name::text,
        participant_profile.username::text,
        participant_profile.avatar_url::text,
        'participant'::text,
        1::integer,
        participant.joined_at::timestamptz
      from public.intent_participants participant

      left join public.profiles participant_profile
        on participant_profile.id = participant.user_id

      where
        participant.intent_id = v_intent_id
        and participant.status = 'active'
        and participant.user_id <> (
          select intent.user_id
          from public.intents intent
          where intent.id = v_intent_id
        )
    ) person
    order by
      person.sort_order,
      person.joined_at asc,
      person.user_id asc;
  end if;
end;
$$;

revoke all
on function public.get_visible_activity_people(uuid)
from public;

grant execute
on function public.get_visible_activity_people(uuid)
to anon, authenticated;

comment on function public.get_visible_activity_people(uuid)
is
  'Returns only the active host, co-hosts and participants of an Intent or shared Plan after applying the same visibility boundary as get_activity_detail_page.';


-- ============================================================
-- 3. VISIBILITY-SAFE TARGET, SCHEDULE AND OUTCOME TIMELINE
-- ============================================================

create or replace function
  public.get_visible_activity_timeline(
    p_resource_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page jsonb;
  v_plan_id uuid;
  v_intent_id uuid;
  v_result jsonb;
begin
  v_page :=
    public.get_activity_detail_page(
      p_resource_id
    );

  if v_page is null then
    return null;
  end if;

  begin
    v_plan_id :=
      nullif(
        v_page #>> '{activity,plan_id}',
        ''
      )::uuid;
  exception
    when invalid_text_representation then
      v_plan_id := null;
  end;

  begin
    v_intent_id :=
      nullif(
        v_page #>> '{activity,intent_id}',
        ''
      )::uuid;
  exception
    when invalid_text_representation then
      v_intent_id := null;
  end;

  if v_plan_id is not null then
    select
      jsonb_build_object(
        'resource_type', 'plan',
        'status', plan.status,
        'timezone', plan.timezone,
        'target_start', plan.window_start,
        'target_end', plan.window_end,
        'scheduled_start', plan.scheduled_start,
        'scheduled_end', plan.scheduled_end,
        'completed_at', plan.completed_at,
        'cancelled_at', plan.cancelled_at,
        'expired_at', plan.expired_at
      )
    into v_result
    from public.plans plan
    where plan.id = v_plan_id;

    return v_result;
  end if;

  if v_intent_id is not null then
    select
      jsonb_build_object(
        'resource_type', 'intent',
        'status', intent.status,
        'timezone', 'Europe/Istanbul',
        'target_start', intent.start_date,
        'target_end', intent.end_date,
        'scheduled_start', null,
        'scheduled_end', null,
        'completed_at', null,
        'cancelled_at', null,
        'expired_at', intent.expired_at
      )
    into v_result
    from public.intents intent
    where intent.id = v_intent_id;
  end if;

  return v_result;
end;
$$;

revoke all
on function public.get_visible_activity_timeline(uuid)
from public;

grant execute
on function public.get_visible_activity_timeline(uuid)
to anon, authenticated;

comment on function public.get_visible_activity_timeline(uuid)
is
  'Returns target window, confirmed schedule and lifecycle outcome timestamps only after applying the same visibility boundary as get_activity_detail_page.';

notify pgrst, 'reload schema';

commit;
