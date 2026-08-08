-- Preserve and expose the provenance of a Shared Plan / Activity without
-- bypassing Intent visibility.  The total source count is historical; source
-- details are revealed only when the viewer may see that source Intent.

create or replace function public.get_visible_plan_origins(
  p_plan_id uuid
)
returns table (
  plan_id uuid,
  source_count bigint,
  source_intent_id uuid,
  source_activity_name text,
  source_owner_user_id uuid,
  source_owner_full_name text,
  source_owner_username text,
  source_owner_avatar_url text,
  source_relationship text,
  source_member_role text,
  viewer_is_owner boolean,
  source_is_visible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_plan_id is null then
    return;
  end if;

  -- Reuse the Activity visibility boundary.  If the Activity / Plan cannot be
  -- viewed, its origin graph cannot be viewed either.
  if public.get_activity_detail_page(p_plan_id) is null then
    return;
  end if;

  return query
  with source_candidates as (
    select
      link.intent_id,
      link.relationship::text as relationship,
      0 as priority
    from public.plan_intents link
    where
      link.plan_id = p_plan_id
      and link.relationship in ('host_source', 'participant_source')

    union all

    select
      request.own_intent_id,
      'participant_source'::text,
      1 as priority
    from public.intent_requests request
    where
      request.plan_id = p_plan_id
      and request.status = 'accepted'
      and request.own_intent_id is not null

    union all

    select
      request.target_intent_id,
      'host_source'::text,
      1 as priority
    from public.intent_requests request
    where
      request.plan_id = p_plan_id
      and request.status = 'accepted'
      and request.target_intent_id is not null
  ),
  sources as (
    select distinct on (candidate.intent_id)
      candidate.intent_id,
      candidate.relationship
    from source_candidates candidate
    where candidate.intent_id is not null
    order by candidate.intent_id, candidate.priority
  ),
  source_details as (
    select
      source.intent_id,
      source.relationship,
      intent.user_id as owner_user_id,
      activity.name as activity_name,
      profile.full_name,
      profile.username,
      profile.avatar_url,
      case
        when intent.user_id = plan.host_user_id then 'host'
        else coalesce(member.role::text, 'participant')
      end as member_role,
      (auth.uid() is not null and auth.uid() = intent.user_id) as is_owner,
      (
        (auth.uid() is not null and auth.uid() = intent.user_id)
        or public.can_user_view_intent_activity(intent.id, auth.uid())
      ) as can_view_source
    from sources source
    join public.intents intent
      on intent.id = source.intent_id
    join public.plans plan
      on plan.id = p_plan_id
    left join public.activities activity
      on activity.id = intent.activity_id
    left join public.profiles profile
      on profile.id = intent.user_id
    left join public.plan_members member
      on member.plan_id = p_plan_id
      and member.user_id = intent.user_id
      and member.status = 'active'
  )
  select
    p_plan_id as plan_id,
    count(*) over ()::bigint as source_count,
    case when detail.can_view_source then detail.intent_id else null end as source_intent_id,
    case when detail.can_view_source then detail.activity_name else null end as source_activity_name,
    case when detail.can_view_source then detail.owner_user_id else null end as source_owner_user_id,
    case when detail.can_view_source then detail.full_name else null end as source_owner_full_name,
    case when detail.can_view_source then detail.username else null end as source_owner_username,
    case when detail.can_view_source then detail.avatar_url else null end as source_owner_avatar_url,
    detail.relationship as source_relationship,
    case when detail.can_view_source then detail.member_role else null end as source_member_role,
    detail.is_owner as viewer_is_owner,
    detail.can_view_source as source_is_visible
  from source_details detail
  order by
    detail.is_owner desc,
    case detail.member_role when 'host' then 0 when 'co_host' then 1 else 2 end,
    detail.activity_name nulls last,
    detail.intent_id;
end;
$$;

revoke all
on function public.get_visible_plan_origins(uuid)
from public;

grant execute
on function public.get_visible_plan_origins(uuid)
to anon, authenticated;

comment on function public.get_visible_plan_origins(uuid)
is
  'Returns historical source Intent provenance for a visible Plan. Hidden source Intents contribute to the count but their identity and title remain hidden.';
