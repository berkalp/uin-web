begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Add a friends-only ownership scope to Intent Discovery.
-- Category and Activity filtering remain canonical and server-enforced.

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
  with base_intents as (
    select
      intent.id::uuid
        as intent_id,

      linked_plan.plan_id::uuid
        as plan_id,

      linked_plan.plan_status::text
        as plan_status,

      intent.user_id::uuid
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

      intent.start_date::date
        as start_date,

      intent.end_date::date
        as end_date,

      intent.people::text
        as people,

      intent.budget::numeric
        as budget,

      intent.recurrence::text
        as recurrence,

      intent.visibility::text
        as visibility,

      intent.intent_type::text
        as intent_type,

      intent.status::text
        as intent_status,

      intent.recruitment_status::text
        as recruitment_status,

      intent.matching_status::text
        as matching_status,

      intent.expired_at::timestamptz
        as expired_at,

      (
        case
          when intent.status =
            'completed'
            then 'completed'

          when intent.status =
            'cancelled'
            then 'cancelled'

          when
            intent.expired_at is not null

            or (
              intent.status =
                'active'

              and intent.end_date <
                current_date
            )
            then 'expired'

          when intent.status =
            'planned'
            then 'planned'

          when
            intent.status =
              'active'

            and (
              intent.recruitment_status =
                'closed'

              or intent.matching_status in (
                'paused',
                'matched',
                'closed'
              )
            )
            then 'closed'

          when
            intent.status =
              'active'

            and intent.start_date >
              current_date
            then 'future'

          else 'open'
        end
      )::text
        as lifecycle_status,

      intent.max_participants::integer
        as max_participants,

      (
        select count(*)::integer
        from public.intent_participants participant
        where
          participant.intent_id =
            intent.id

          and participant.status =
            'active'

          and participant.user_id <>
            intent.user_id
      )::integer
        as active_participant_count,

      public.can_user_request_join_intent(
        intent.id,
        v_user_id
      )::boolean
        as viewer_can_request,

      (
        intent.user_id =
          v_user_id

        or exists (
          select 1
          from public.intent_participants participant
          where
            participant.intent_id =
              intent.id

            and participant.user_id =
              v_user_id

            and participant.status =
              'active'
        )

        or (
          linked_plan.plan_id is not null

          and exists (
            select 1
            from public.plan_members member
            where
              member.plan_id =
                linked_plan.plan_id

              and member.user_id =
                v_user_id

              and member.status =
                'active'
          )
        )
      )::boolean
        as viewer_is_member,

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
          when v_query is null then
            0

          when public.normalize_activity_catalogue_name(
            activity.name
          ) = v_query then
            100

          when alias_search.exact_alias then
            95

          when public.normalize_activity_catalogue_name(
            activity.name
          ) like v_query || '%' then
            90

          when alias_search.prefix_alias then
            85

          when public.normalize_activity_catalogue_name(
            activity.name
          ) like '%' || v_query || '%' then
            80

          when alias_search.contains_alias then
            75

          when public.normalize_activity_catalogue_name(
            category.name
          ) like '%' || v_query || '%' then
            60

          when public.normalize_activity_catalogue_name(
            location.district
          ) like '%' || v_query || '%' then
            55

          when public.normalize_activity_catalogue_name(
            location.city
          ) like '%' || v_query || '%' then
            50

          else 0
        end
      )::integer
        as relevance

    from public.intents intent

    join public.activities activity
      on activity.id =
        intent.activity_id

    join public.activity_categories category
      on category.id =
        activity.category_id

    join public.locations location
      on location.id =
        intent.location_id

    left join public.profiles owner_profile
      on owner_profile.id =
        intent.user_id

    left join lateral (
      select
        coalesce(
          bool_or(
            alias.normalized_alias =
              v_query
          ),
          false
        )::boolean
          as exact_alias,

        coalesce(
          bool_or(
            alias.normalized_alias like
              v_query || '%'
          ),
          false
        )::boolean
          as prefix_alias,

        coalesce(
          bool_or(
            alias.normalized_alias like
              '%' || v_query || '%'
          ),
          false
        )::boolean
          as contains_alias

      from public.activity_aliases alias
      where
        alias.activity_id =
          activity.id

        and v_query is not null
    ) alias_search
      on true

    left join lateral (
      select
        plan.id::uuid
          as plan_id,

        plan.status::text
          as plan_status

      from public.plan_intents plan_intent

      join public.plans plan
        on plan.id =
          plan_intent.plan_id

      where
        plan_intent.intent_id =
          intent.id

        and plan_intent.status =
          'active'

      order by
        plan_intent.linked_at desc,
        plan.created_at desc

      limit 1
    ) linked_plan
      on true

    left join lateral (
      select
        (
          case
            when invitation.status =
              'pending'

              and invitation.expires_at <=
                now()
              then 'expired'

            else invitation.status
          end
        )::text
          as invitation_status

      from public.intent_invitations invitation

      where
        invitation.intent_id =
          intent.id

        and invitation.invited_user_id =
          v_user_id

      order by
        invitation.created_at desc

      limit 1
    ) viewer_invitation
      on true

    left join lateral (
      select
        request.id::uuid
          as request_id,

        request.status::text
          as request_status

      from public.intent_join_requests request

      where
        request.intent_id =
          intent.id

        and request.requester_user_id =
          v_user_id

      order by
        request.created_at desc

      limit 1
    ) viewer_request
      on true

    where
      (
        intent.user_id =
          v_user_id

        or intent.visibility =
          'public'

        or (
          intent.visibility =
            'friends'

          and coalesce(
            public.are_users_friends(
              intent.user_id,
              v_user_id
            ),
            false
          )
        )

        or (
          intent.visibility =
            'except_friends'

          and not coalesce(
            public.are_users_friends(
              intent.user_id,
              v_user_id
            ),
            false
          )
        )

        or (
          intent.visibility =
            'invite_only'

          and public.is_user_invited_to_intent(
            intent.id,
            v_user_id
          )
        )
      )

      and (
        v_scope =
          'all'

        or (
          v_scope =
            'mine'

          and intent.user_id =
            v_user_id
        )

        or (
          v_scope =
            'friends'

          and intent.user_id <>
            v_user_id

          and coalesce(
            public.are_users_friends(
              intent.user_id,
              v_user_id
            ),
            false
          )
        )

        or (
          v_scope =
            'others'

          and intent.user_id <>
            v_user_id
        )
      )

      and (
        p_category_id is null
        or category.id =
          p_category_id
      )

      and (
        p_activity_id is null
        or activity.id =
          p_activity_id
      )

      and (
        p_location_id is null
        or location.id =
          p_location_id
      )

      and (
        p_start_date is null
        or intent.end_date >=
          p_start_date
      )

      and (
        p_end_date is null
        or intent.start_date <=
          p_end_date
      )

      and (
        v_query is null

        or public.normalize_activity_catalogue_name(
          activity.name
        ) like
          '%' || v_query || '%'

        or alias_search.contains_alias

        or public.normalize_activity_catalogue_name(
          category.name
        ) like
          '%' || v_query || '%'

        or public.normalize_activity_catalogue_name(
          location.district
        ) like
          '%' || v_query || '%'

        or public.normalize_activity_catalogue_name(
          location.city
        ) like
          '%' || v_query || '%'
      )
  ),

  filtered_intents as (
    select
      base_intents.*
    from base_intents
    where
      v_lifecycle =
        'all'

      or base_intents.lifecycle_status =
        v_lifecycle

      or (
        v_lifecycle =
          'history'

        and base_intents.lifecycle_status in (
          'completed',
          'cancelled',
          'expired'
        )
      )
  ),

  counted_intents as (
    select
      filtered_intents.*,

      count(*) over()::bigint
        as total_count

    from filtered_intents
  )

  select
    counted_intents.intent_id,
    counted_intents.plan_id,
    counted_intents.plan_status,

    counted_intents.owner_user_id,
    counted_intents.owner_full_name,
    counted_intents.owner_username,
    counted_intents.owner_avatar_url,

    counted_intents.activity_id,
    counted_intents.activity_name,
    counted_intents.activity_cover_url,

    counted_intents.category_id,
    counted_intents.category_name,
    counted_intents.category_cover_url,

    counted_intents.location_id,
    counted_intents.city,
    counted_intents.district,

    counted_intents.start_date,
    counted_intents.end_date,

    counted_intents.people,
    counted_intents.budget,
    counted_intents.recurrence,
    counted_intents.visibility,
    counted_intents.intent_type,

    counted_intents.intent_status,
    counted_intents.recruitment_status,
    counted_intents.matching_status,
    counted_intents.expired_at,
    counted_intents.lifecycle_status,

    counted_intents.max_participants,
    counted_intents.active_participant_count,

    counted_intents.viewer_can_request,
    counted_intents.viewer_is_member,
    counted_intents.viewer_invitation_status,
    counted_intents.viewer_request_status,
    counted_intents.viewer_request_id,

    counted_intents.created_at,
    counted_intents.relevance,
    counted_intents.total_count

  from counted_intents

  order by
    counted_intents.relevance desc,

    case
      when counted_intents.lifecycle_status in (
        'open',
        'future',
        'planned'
      ) then 0

      when counted_intents.lifecycle_status =
        'closed'
        then 1

      when counted_intents.lifecycle_status =
        'completed'
        then 2

      when counted_intents.lifecycle_status =
        'cancelled'
        then 3

      else 4
    end asc,

    (
      counted_intents.owner_user_id =
        v_user_id
    ) desc,

    case
      when counted_intents.start_date >=
        current_date
        then counted_intents.start_date
      else null
    end asc nulls last,

    counted_intents.created_at desc,
    counted_intents.intent_id desc

  limit v_limit
  offset v_offset;
end;
$$;

revoke all
on function
  public.search_visible_intents(
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
on function
  public.search_visible_intents(
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
on function
  public.search_visible_intents(
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

commit;
