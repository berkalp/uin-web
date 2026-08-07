begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

alter table public.locations
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists scope text,
  add column if not exists source_key text,
  add column if not exists province_external_id integer,
  add column if not exists external_id integer;

update public.locations
set
  country_code = coalesce(country_code, 'TR'),
  country_name = coalesce(country_name, 'Türkiye'),
  city = case
    when city = 'Istanbul' then 'İstanbul'
    else city
  end,
  scope = coalesce(scope, 'district');

alter table public.locations
  alter column country_code set default 'TR',
  alter column country_name set default 'Türkiye',
  alter column scope set default 'district',
  alter column country_code set not null,
  alter column country_name set not null,
  alter column scope set not null,
  alter column city drop not null,
  alter column district drop not null;

alter table public.locations
  drop constraint if exists locations_city_district_key;

drop index if exists public.locations_city_district_key;
drop index if exists public.locations_normalized_city_idx;
drop index if exists public.locations_normalized_district_idx;

alter table public.locations
  drop constraint if exists locations_scope_value_check;

alter table public.locations
  add constraint locations_scope_value_check
  check (scope in ('country', 'city', 'district'));

alter table public.locations
  drop constraint if exists locations_scope_shape_check;

alter table public.locations
  add constraint locations_scope_shape_check
  check (
    (scope = 'country' and city is null and district is null)
    or
    (scope = 'city' and city is not null and district is null)
    or
    (scope = 'district' and city is not null and district is not null)
  );

create unique index if not exists
  locations_scope_identity_key
on public.locations (
  country_code,
  scope,
  coalesce(city, ''),
  coalesce(district, '')
);

create unique index if not exists
  locations_source_key_key
on public.locations (source_key)
where source_key is not null;

create index if not exists
  locations_country_city_scope_idx
on public.locations (
  country_code,
  city,
  scope,
  district
);

create index if not exists
  locations_normalized_city_idx
on public.locations (
  public.normalize_activity_catalogue_name(
    coalesce(city, '')
  )
);

create index if not exists
  locations_normalized_district_idx
on public.locations (
  public.normalize_activity_catalogue_name(
    coalesce(district, '')
  )
);

insert into public.locations (
  country_code,
  country_name,
  city,
  district,
  scope,
  source_key
)
values
  ('TR', 'Türkiye', null, null, 'country', 'TR'),
  ('TR', 'Türkiye', 'İstanbul', null, 'city', 'TR:34')
on conflict do nothing;

create or replace function public.locations_overlap(
  p_left_location_id uuid,
  p_right_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        left_location.country_code = right_location.country_code
        and (
          left_location.scope = 'country'
          or right_location.scope = 'country'
          or (
            left_location.city = right_location.city
            and (
              left_location.scope = 'city'
              or right_location.scope = 'city'
              or left_location.district = right_location.district
            )
          )
        )
      from public.locations left_location
      join public.locations right_location
        on right_location.id = p_right_location_id
      where left_location.id = p_left_location_id
    ),
    false
  );
$$;

create or replace function public.get_intent_discovery_filters()
returns jsonb
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

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  return jsonb_build_object(
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', category.id,
            'name', category.name
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
            'id', activity.id,
            'category_id', activity.category_id,
            'name', activity.name,
            'category_name', category.name
          )
          order by category.name, activity.name
        )
        from public.activities activity
        join public.activity_categories category
          on category.id = activity.category_id
        where activity.is_active = true
          and category.is_active = true
      ),
      '[]'::jsonb
    ),
    'locations',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', location.id,
            'country_code', location.country_code,
            'country_name', location.country_name,
            'city', location.city,
            'district', location.district,
            'scope', location.scope
          )
          order by
            location.country_name,
            location.city nulls first,
            case location.scope
              when 'country' then 0
              when 'city' then 1
              else 2
            end,
            location.district nulls first
        )
        from public.locations location
      ),
      '[]'::jsonb
    )
  );
end;
$$;

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
$function$


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
$function$


grant execute on function public.locations_overlap(uuid, uuid) to authenticated;
grant execute on function public.get_intent_discovery_filters() to authenticated;
grant execute on function public.get_my_active_matches() to authenticated;
grant execute on function public.search_visible_intents(
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
) to authenticated;

commit;
