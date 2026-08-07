begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- COMMUNITY DISCOVERY METRICS
--
-- /communities is a Community catalogue. Date filtering belongs to the
-- Community detail feed, not to the catalogue itself. These functions add
-- follower/lifecycle metrics, safe cover resolution and an anonymised recent
-- planning-style signal without exposing exact private Activity counts.
-- ============================================================

-- Kept compatible with migration 026. Re-declaring it makes this migration
-- resilient when applied to a database whose migration files were imported
-- in separate batches.
create or replace function public.resolve_public_community_sport_cover(
  p_community_id uuid,
  p_sport_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cover_url text;
  v_relation_name text;
begin
  if p_community_id is null or p_sport_id is null then
    return null;
  end if;

  foreach v_relation_name in array array[
    'public.community_sports',
    'public.community_sport_links',
    'public.community_sport_catalogue'
  ]
  loop
    if to_regclass(v_relation_name) is null then
      continue;
    end if;

    begin
      execute format(
        'select nullif(btrim(default_cover_url), '''')
           from %s
          where community_id = $1
            and sport_id = $2
            and coalesce(is_active, true) = true
          order by coalesce(sort_order, 100), community_id
          limit 1',
        to_regclass(v_relation_name)
      )
      into v_cover_url
      using p_community_id, p_sport_id;
    exception
      when undefined_column then
        execute format(
          'select nullif(btrim(default_cover_url), '''')
             from %s
            where community_id = $1
              and sport_id = $2
            limit 1',
          to_regclass(v_relation_name)
        )
        into v_cover_url
        using p_community_id, p_sport_id;
    end;

    if v_cover_url is not null then
      return v_cover_url;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.get_community_discovery_metrics_internal(
  p_user_id uuid
)
returns table (
  community_id uuid,
  follower_count bigint,
  open_intent_count bigint,
  planning_activity_count bigint,
  completed_experience_count bigint,
  planning_style text,
  fallback_cover_image_url text,
  recent_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with plan_resources as (
    select distinct
      community_link.community_id,
      'plan:' || plan.id::text as resource_key,
      intent.id as intent_id,
      plan.id as plan_id,
      coalesce(plan.activity_id, intent.activity_id) as activity_id,
      intent.sport_id,
      coalesce(plan.location_id, intent.location_id) as location_id,
      intent.participant_eligibility,
      coalesce(plan.visibility, intent.visibility) as visibility,
      plan.status as lifecycle_status,
      plan.expired_at,
      coalesce(
        plan.completed_at,
        plan.cancelled_at,
        plan.created_at,
        intent.updated_at,
        intent.created_at
      ) as activity_at,
      public.can_user_view_intent_activity(
        intent.id,
        p_user_id
      ) as viewer_can_view
    from public.intent_communities community_link
    join public.intents intent
      on intent.id = community_link.intent_id
    join public.plan_intents plan_link
      on plan_link.intent_id = intent.id
      and plan_link.status = 'active'
    join public.plans plan
      on plan.id = plan_link.plan_id
  ),
  unplanned_resources as (
    select distinct
      community_link.community_id,
      'intent:' || intent.id::text as resource_key,
      intent.id as intent_id,
      null::uuid as plan_id,
      intent.activity_id,
      intent.sport_id,
      intent.location_id,
      intent.participant_eligibility,
      intent.visibility,
      case
        when intent.status = 'completed' then 'completed'
        when intent.status = 'cancelled' then 'cancelled'
        else 'open'
      end as lifecycle_status,
      intent.expired_at,
      coalesce(intent.updated_at, intent.created_at) as activity_at,
      public.can_user_view_intent_activity(
        intent.id,
        p_user_id
      ) as viewer_can_view
    from public.intent_communities community_link
    join public.intents intent
      on intent.id = community_link.intent_id
    where not exists (
      select 1
      from public.plan_intents active_plan_link
      where active_plan_link.intent_id = intent.id
        and active_plan_link.status = 'active'
    )
  ),
  resources as (
    select * from plan_resources
    union all
    select * from unplanned_resources
  ),
  follower_counts as (
    select
      follow_record.community_id,
      count(*)::bigint as follower_count
    from public.community_follows follow_record
    group by follow_record.community_id
  ),
  visible_counts as (
    select
      resource.community_id,
      count(distinct resource.resource_key) filter (
        where resource.viewer_can_view
          and resource.plan_id is null
          and resource.lifecycle_status = 'open'
          and resource.expired_at is null
          and exists (
            select 1
            from public.intents current_intent
            where current_intent.id = resource.intent_id
              and current_intent.status = 'active'
              and current_intent.end_date >= current_date
          )
      )::bigint as open_intent_count,
      count(distinct resource.resource_key) filter (
        where resource.viewer_can_view
          and resource.plan_id is not null
          and resource.lifecycle_status in ('forming', 'planned')
          and resource.expired_at is null
      )::bigint as planning_activity_count,
      count(distinct resource.resource_key) filter (
        where resource.viewer_can_view
          and resource.lifecycle_status = 'completed'
      )::bigint as completed_experience_count,
      max(resource.activity_at) filter (
        where resource.viewer_can_view
      ) as recent_activity_at
    from resources resource
    group by resource.community_id
  ),
  style_counts as (
    select
      resource.community_id,
      count(distinct resource.resource_key)::numeric as sample_count,
      count(distinct resource.resource_key) filter (
        where resource.visibility in ('public', 'except_friends')
      )::numeric as public_count,
      count(distinct resource.resource_key) filter (
        where resource.visibility = 'friends'
      )::numeric as friends_count,
      count(distinct resource.resource_key) filter (
        where resource.visibility in ('invite_only', 'private')
      )::numeric as invite_count
    from resources resource
    where resource.activity_at >= now() - interval '90 days'
    group by resource.community_id
  ),
  cover_candidates as (
    select distinct on (resource.community_id)
      resource.community_id,
      coalesce(
        public.resolve_public_community_sport_cover(
          resource.community_id,
          resource.sport_id
        ),
        activity.default_cover_url,
        category.default_cover_url
      ) as fallback_cover_image_url
    from resources resource
    left join public.activities activity
      on activity.id = resource.activity_id
    left join public.activity_categories category
      on category.id = activity.category_id
    where resource.viewer_can_view
      and coalesce(
        public.resolve_public_community_sport_cover(
          resource.community_id,
          resource.sport_id
        ),
        activity.default_cover_url,
        category.default_cover_url
      ) is not null
    order by
      resource.community_id,
      case resource.lifecycle_status
        when 'forming' then 0
        when 'planned' then 1
        when 'open' then 2
        when 'completed' then 3
        else 4
      end,
      resource.activity_at desc nulls last,
      resource.resource_key
  )
  select
    community.id as community_id,
    coalesce(followers.follower_count, 0)::bigint,
    coalesce(counts.open_intent_count, 0)::bigint,
    coalesce(counts.planning_activity_count, 0)::bigint,
    coalesce(counts.completed_experience_count, 0)::bigint,
    case
      when coalesce(style.sample_count, 0) < 5 then 'not_enough_data'
      when style.public_count / nullif(style.sample_count, 0) >= 0.60
        then 'mostly_public'
      when style.invite_count / nullif(style.sample_count, 0) >= 0.60
        then 'mostly_invite_only'
      when (style.friends_count + style.invite_count) /
        nullif(style.sample_count, 0) >= 0.60
        then 'mostly_private'
      else 'mixed'
    end as planning_style,
    candidate.fallback_cover_image_url,
    counts.recent_activity_at
  from public.communities community
  left join follower_counts followers
    on followers.community_id = community.id
  left join visible_counts counts
    on counts.community_id = community.id
  left join style_counts style
    on style.community_id = community.id
  left join cover_candidates candidate
    on candidate.community_id = community.id
  where community.status = 'active';
$$;

revoke all on function public.get_community_discovery_metrics_internal(uuid)
from public, anon, authenticated;

create or replace function public.search_communities_v2(
  p_query text default null,
  p_category_id uuid default null,
  p_activity_id uuid default null,
  p_location_id uuid default null,
  p_eligibility text default null,
  p_following_only boolean default false,
  p_require_intent_match boolean default false,
  p_sort text default 'most_followed',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  community_accent_color text,
  community_secondary_color text,
  community_cover_image_url text,
  community_scope_type text,
  category_id uuid,
  category_name text,
  category_ids uuid[],
  category_names text[],
  activity_ids uuid[],
  activity_names text[],
  is_following boolean,
  follower_count bigint,
  open_intent_count bigint,
  planning_activity_count bigint,
  completed_experience_count bigint,
  planning_style text,
  matching_intent_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text;
  v_eligibility text;
  v_sort text;
  v_limit integer;
  v_offset integer;
begin
  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  v_query := nullif(
    public.normalize_activity_catalogue_name(p_query),
    ''
  );

  v_eligibility := lower(
    btrim(coalesce(p_eligibility, 'all'))
  );

  if v_eligibility not in (
    'eligible',
    'everyone',
    'women_only',
    'men_only',
    'all'
  ) then
    raise exception
      'Unsupported participant eligibility filter.'
      using errcode = '22023';
  end if;

  v_sort := lower(btrim(coalesce(p_sort, 'most_followed')));

  if v_sort not in (
    'most_followed',
    'most_active',
    'most_experiences',
    'recently_active',
    'az'
  ) then
    raise exception
      'Unsupported Community sort.'
      using errcode = '22023';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  with metrics as (
    select *
    from public.get_community_discovery_metrics_internal(v_user_id)
  ),
  current_resources as (
    select distinct
      community_link.community_id,
      case
        when plan.id is not null then 'plan:' || plan.id::text
        else 'intent:' || intent.id::text
      end as resource_key,
      intent.id as intent_id,
      plan.id as plan_id,
      coalesce(plan.activity_id, intent.activity_id) as activity_id,
      coalesce(plan.location_id, intent.location_id) as location_id,
      intent.participant_eligibility,
      sport.name as sport_name,
      case
        when plan.id is not null then
          public.user_is_eligible_for_plan_intents(plan.id, v_user_id)
        else
          public.user_is_eligible_for_intent(intent.id, v_user_id)
      end as viewer_is_eligible
    from public.intent_communities community_link
    join public.intents intent
      on intent.id = community_link.intent_id
    left join lateral (
      select selected_plan.*
      from public.plan_intents plan_link
      join public.plans selected_plan
        on selected_plan.id = plan_link.plan_id
      where plan_link.intent_id = intent.id
        and plan_link.status = 'active'
        and selected_plan.status in ('forming', 'planned')
        and selected_plan.expired_at is null
      order by
        case selected_plan.status
          when 'forming' then 0
          else 1
        end,
        selected_plan.created_at desc,
        selected_plan.id
      limit 1
    ) plan on true
    left join public.sports sport
      on sport.id = intent.sport_id
    where public.can_user_view_intent_activity(intent.id, v_user_id)
      and (
        plan.id is not null
        or (
          intent.status = 'active'
          and intent.expired_at is null
          and intent.end_date >= current_date
          and not exists (
            select 1
            from public.plan_intents active_plan_link
            where active_plan_link.intent_id = intent.id
              and active_plan_link.status = 'active'
          )
        )
      )
  ),
  matching_counts as (
    select
      resource.community_id,
      count(distinct resource.resource_key)::bigint as matching_intent_count
    from current_resources resource
    where
      (
        p_location_id is null
        or public.locations_overlap(resource.location_id, p_location_id)
      )
      and (
        v_eligibility = 'all'
        or (v_eligibility = 'eligible' and resource.viewer_is_eligible)
        or resource.participant_eligibility = v_eligibility
      )
    group by resource.community_id
  ),
  catalogue as (
    select
      active_community.community_id,
      active_community.community_name,
      active_community.community_slug,
      active_community.community_description,
      active_community.community_icon_key,
      active_community.community_icon_url,
      active_community.community_accent_color,
      active_community.community_secondary_color,
      coalesce(
        community.cover_image_url,
        metric.fallback_cover_image_url
      ) as community_cover_image_url,
      active_community.community_scope_type,
      active_community.category_id,
      active_community.category_name,
      active_community.category_ids,
      active_community.category_names,
      active_community.activity_ids,
      active_community.activity_names,
      exists (
        select 1
        from public.community_follows follow_record
        where follow_record.user_id = v_user_id
          and follow_record.community_id = active_community.community_id
      ) as is_following,
      coalesce(metric.follower_count, 0)::bigint as follower_count,
      coalesce(metric.open_intent_count, 0)::bigint as open_intent_count,
      coalesce(metric.planning_activity_count, 0)::bigint as planning_activity_count,
      coalesce(metric.completed_experience_count, 0)::bigint as completed_experience_count,
      coalesce(metric.planning_style, 'not_enough_data') as planning_style,
      coalesce(match_count.matching_intent_count, 0)::bigint as matching_intent_count,
      metric.recent_activity_at
    from public.get_active_communities(null::uuid, null::uuid) active_community
    join public.communities community
      on community.id = active_community.community_id
    left join metrics metric
      on metric.community_id = active_community.community_id
    left join matching_counts match_count
      on match_count.community_id = active_community.community_id
  ),
  filtered as (
    select catalogue.*
    from catalogue
    where
      (not coalesce(p_following_only, false) or catalogue.is_following)
      and (
        p_category_id is null
        or catalogue.community_scope_type = 'global'
        or p_category_id = any(coalesce(catalogue.category_ids, array[]::uuid[]))
      )
      and (
        p_activity_id is null
        or catalogue.community_scope_type = 'global'
        or p_activity_id = any(coalesce(catalogue.activity_ids, array[]::uuid[]))
        or exists (
          select 1
          from public.activities selected_activity
          where selected_activity.id = p_activity_id
            and selected_activity.category_id = any(
              coalesce(catalogue.category_ids, array[]::uuid[])
            )
        )
      )
      and (
        v_query is null
        or public.normalize_activity_catalogue_name(catalogue.community_name)
          like '%' || v_query || '%'
        or public.normalize_activity_catalogue_name(catalogue.community_description)
          like '%' || v_query || '%'
        or exists (
          select 1
          from unnest(coalesce(catalogue.category_names, array[]::text[])) item(value)
          where public.normalize_activity_catalogue_name(item.value)
            like '%' || v_query || '%'
        )
        or exists (
          select 1
          from unnest(coalesce(catalogue.activity_names, array[]::text[])) item(value)
          where public.normalize_activity_catalogue_name(item.value)
            like '%' || v_query || '%'
        )
        or exists (
          select 1
          from public.community_aliases alias
          where alias.community_id = catalogue.community_id
            and alias.normalized_alias like '%' || v_query || '%'
        )
        or exists (
          select 1
          from current_resources resource
          where resource.community_id = catalogue.community_id
            and public.normalize_activity_catalogue_name(resource.sport_name)
              like '%' || v_query || '%'
        )
      )
      and (
        not coalesce(p_require_intent_match, false)
        or catalogue.matching_intent_count > 0
      )
  ),
  counted as (
    select
      filtered.*,
      count(*) over()::bigint as result_total_count
    from filtered
  )
  select
    counted.community_id,
    counted.community_name,
    counted.community_slug,
    counted.community_description,
    counted.community_icon_key,
    counted.community_icon_url,
    counted.community_accent_color,
    counted.community_secondary_color,
    counted.community_cover_image_url,
    counted.community_scope_type,
    counted.category_id,
    counted.category_name,
    counted.category_ids,
    counted.category_names,
    counted.activity_ids,
    counted.activity_names,
    counted.is_following,
    counted.follower_count,
    counted.open_intent_count,
    counted.planning_activity_count,
    counted.completed_experience_count,
    counted.planning_style,
    counted.matching_intent_count,
    counted.result_total_count
  from counted
  order by
    case when v_sort = 'most_followed' then counted.follower_count end desc nulls last,
    case when v_sort = 'most_followed' then
      counted.open_intent_count + counted.planning_activity_count
    end desc nulls last,
    case when v_sort = 'most_active' then
      counted.open_intent_count + counted.planning_activity_count
    end desc nulls last,
    case when v_sort = 'most_active' then counted.follower_count end desc nulls last,
    case when v_sort = 'most_experiences' then counted.completed_experience_count end desc nulls last,
    case when v_sort = 'most_experiences' then counted.follower_count end desc nulls last,
    case when v_sort = 'recently_active' then counted.recent_activity_at end desc nulls last,
    case when v_sort = 'recently_active' then counted.follower_count end desc nulls last,
    counted.community_name asc,
    counted.community_id
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_communities_v2(
  text,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  text,
  integer,
  integer
)
from public;

grant execute on function public.search_communities_v2(
  text,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  text,
  integer,
  integer
)
to authenticated;

create or replace function public.get_community_discovery_metrics(
  p_community_id uuid
)
returns table (
  follower_count bigint,
  open_intent_count bigint,
  planning_activity_count bigint,
  completed_experience_count bigint,
  planning_style text,
  resolved_cover_image_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  return query
  select
    metric.follower_count,
    metric.open_intent_count,
    metric.planning_activity_count,
    metric.completed_experience_count,
    metric.planning_style,
    coalesce(
      community.cover_image_url,
      metric.fallback_cover_image_url
    ) as resolved_cover_image_url
  from public.communities community
  join public.get_community_discovery_metrics_internal(v_user_id) metric
    on metric.community_id = community.id
  where community.id = p_community_id
    and community.status = 'active'
  limit 1;
end;
$$;

revoke all on function public.get_community_discovery_metrics(uuid)
from public;

grant execute on function public.get_community_discovery_metrics(uuid)
to authenticated;

notify pgrst, 'reload schema';

commit;
