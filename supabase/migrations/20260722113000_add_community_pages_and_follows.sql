begin;

-- ============================================================
-- UIN COMMUNITY PAGES + PRIVATE FOLLOWING
--
-- Following is a private interest signal. It is not membership.
-- Communities remain curated Intent context, not accounts or groups.
-- ============================================================

create table if not exists public.community_follows (
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  community_id uuid not null
    references public.communities(id)
    on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (
    user_id,
    community_id
  )
);

create index if not exists
  community_follows_community_idx
on public.community_follows (
  community_id,
  created_at desc
);

alter table public.community_follows
  enable row level security;

drop policy if exists
  users_view_own_community_follows
on public.community_follows;

create policy
  users_view_own_community_follows
on public.community_follows
for select
to authenticated
using (
  user_id = auth.uid()
);

revoke insert, update, delete
on public.community_follows
from anon, authenticated;

grant select
on public.community_follows
to authenticated;

create or replace function public.follow_community(
  p_community_id uuid
)
returns void
language plpgsql
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

  insert into public.community_follows (
    user_id,
    community_id,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_community_id,
    now(),
    now()
  )
  on conflict (
    user_id,
    community_id
  )
  do update set
    updated_at = now();
end;
$$;

create or replace function public.unfollow_community(
  p_community_id uuid
)
returns void
language plpgsql
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

  delete from public.community_follows follow_record
  where follow_record.user_id = v_user_id
    and follow_record.community_id = p_community_id;
end;
$$;

create or replace function public.is_following_community(
  p_community_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.community_follows follow_record
      where follow_record.user_id = auth.uid()
        and follow_record.community_id = p_community_id
    );
$$;

create or replace function public.get_my_followed_communities()
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  category_id uuid,
  category_name text,
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
    community.category_id,
    category.name,
    follow_record.created_at
  from public.community_follows follow_record
  join public.communities community
    on community.id = follow_record.community_id
  join public.activity_categories category
    on category.id = community.category_id
  where follow_record.user_id = v_user_id
    and community.status = 'active'
    and category.is_active = true
  order by
    follow_record.created_at desc,
    community.name,
    community.id;
end;
$$;

CREATE OR REPLACE FUNCTION public.search_visible_intents_followed_communities(p_query text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_activity_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_lifecycle text DEFAULT 'all'::text, p_scope text DEFAULT 'all'::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
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
      exists (
        select 1
        from public.community_follows followed_community
        where followed_community.user_id = v_user_id
          and followed_community.community_id = host_intent.community_id
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
      exists (
        select 1
        from public.community_follows followed_community
        where followed_community.user_id = v_user_id
          and followed_community.community_id = intent.community_id
      )

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

revoke all on function public.follow_community(uuid)
from public;

grant execute on function public.follow_community(uuid)
to authenticated;

revoke all on function public.unfollow_community(uuid)
from public;

grant execute on function public.unfollow_community(uuid)
to authenticated;

revoke all on function public.is_following_community(uuid)
from public;

grant execute on function public.is_following_community(uuid)
to authenticated;

revoke all on function public.get_my_followed_communities()
from public;

grant execute on function public.get_my_followed_communities()
to authenticated;

revoke all on function public.search_visible_intents_followed_communities(
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

grant execute on function public.search_visible_intents_followed_communities(
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
