begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, pg_temp;

-- Participant lookups stay index-backed as the inbox grows. The two-column OR
-- can use a BitmapOr instead of scanning every collaboration chat.
create index if not exists personal_intent_collaboration_chats_owner_idx
  on public.personal_intent_collaboration_chats (owner_user_id);
create index if not exists personal_intent_collaboration_chats_requester_idx
  on public.personal_intent_collaboration_chats (requester_user_id);

-- Keep the collaboration inbox on one read. The active plan link is unique per
-- intent, so adding the event summary does not add a request per chat.
create or replace function public.get_my_personal_intent_collaboration_chats_v170()
returns table(
  chat_id uuid,
  seed_id uuid,
  canonical_target_id uuid,
  seed_title text,
  other_user_id uuid,
  other_full_name text,
  other_username text,
  other_avatar_url text,
  status text,
  planning_proposed_by uuid,
  viewer_message_count bigint,
  other_message_count bigint,
  unread_count bigint,
  last_message_body text,
  last_message_at timestamptz,
  planning_creator_user_id uuid,
  planning_intent_id uuid,
  plan_id uuid,
  activity_title text,
  activity_status text,
  window_start date,
  window_end date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text,
  activity_location_name text,
  meeting_point text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  cancellation_phase text,
  expired_at timestamptz,
  activity_city text,
  activity_district text,
  viewer_can_open_room boolean,
  event_resolution text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    chat.suggestion_id,
    chat.seed_id,
    coalesce(chat.canonical_target_id, seed.canonical_target_id),
    coalesce(
      nullif(trim(target.title), ''),
      public.uin_seed_display_title_v90(seed.id),
      'Kütüphane konusu'
    )::text,
    case
      when chat.owner_user_id = auth.uid() then chat.requester_user_id
      else chat.owner_user_id
    end,
    coalesce(
      nullif(trim(profile.full_name), ''),
      nullif(trim(profile.username), ''),
      'UIN üyesi'
    )::text,
    profile.username::text,
    profile.avatar_url::text,
    chat.status,
    chat.planning_proposed_by,
    (
      select count(*)
      from public.personal_intent_collaboration_messages message
      where message.suggestion_id = chat.suggestion_id
        and message.sender_user_id = auth.uid()
    ),
    (
      select count(*)
      from public.personal_intent_collaboration_messages message
      where message.suggestion_id = chat.suggestion_id
        and message.sender_user_id <> auth.uid()
    ),
    (
      select count(*)
      from public.personal_intent_collaboration_messages message
      where message.suggestion_id = chat.suggestion_id
        and message.sender_user_id <> auth.uid()
        and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
    ),
    latest.body,
    latest.created_at,
    chat.planning_creator_user_id,
    chat.planning_intent_id,
    plan.id,
    case
      when plan.id is null then null
      else coalesce(
        nullif(trim(plan.shared_title), ''),
        nullif(trim(plan.title), ''),
        nullif(trim(target.title), ''),
        public.uin_seed_display_title_v90(seed.id)
      )
    end::text,
    plan.status::text,
    plan.window_start,
    plan.window_end,
    plan.scheduled_start,
    plan.scheduled_end,
    plan.timezone::text,
    case
      when plan.host_user_id = auth.uid() or exists (
        select 1
        from public.plan_members member_access
        where member_access.plan_id = plan.id
          and member_access.user_id = auth.uid()
          and member_access.status = 'active'
      ) then plan.activity_location_name
      else null
    end::text,
    case
      when plan.host_user_id = auth.uid() or exists (
        select 1
        from public.plan_members member_access
        where member_access.plan_id = plan.id
          and member_access.user_id = auth.uid()
          and member_access.status = 'active'
      )
        then plan.meeting_point
      else null
    end::text,
    plan.cancelled_at,
    plan.completed_at,
    plan.cancellation_phase::text,
    plan.expired_at,
    activity_location.city::text,
    activity_location.district::text,
    (
      plan.id is not null
      and (
        plan.host_user_id = auth.uid()
        or exists (
          select 1
          from public.plan_members member_access
          where member_access.plan_id = plan.id
            and member_access.user_id = auth.uid()
            and member_access.status = 'active'
        )
      )
    ),
    case
      when chat.planning_intent_id is null then 'none'
      when plan.id is null then 'intent_only'
      else 'plan_resolved'
    end::text
  from public.personal_intent_collaboration_chats chat
  left join public.seeds seed
    on seed.id = chat.seed_id
  left join public.canonical_targets target
    on target.id = coalesce(chat.canonical_target_id, seed.canonical_target_id)
  left join public.profiles profile
    on profile.id = case
      when chat.owner_user_id = auth.uid() then chat.requester_user_id
      else chat.owner_user_id
    end
  left join public.personal_intent_collaboration_reads read_state
    on read_state.suggestion_id = chat.suggestion_id
   and read_state.user_id = auth.uid()
  left join lateral (
    select message.body, message.created_at
    from public.personal_intent_collaboration_messages message
    where message.suggestion_id = chat.suggestion_id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join public.plan_intents plan_link
    on plan_link.intent_id = chat.planning_intent_id
   and plan_link.status = 'active'
  left join public.plans plan
    on plan.id = plan_link.plan_id
  left join public.intents planning_intent
    on planning_intent.id = chat.planning_intent_id
  left join public.locations activity_location
    on activity_location.id = coalesce(plan.location_id, planning_intent.location_id)
  where auth.uid() is not null
    and (
      chat.owner_user_id = auth.uid()
      or chat.requester_user_id = auth.uid()
    )
  order by coalesce(latest.created_at, chat.updated_at) desc;
$function$;

-- Return the same hand-off identifiers as v35 together with the verified plan
-- summary. Exact meeting-point data remains available only to room members.
create or replace function public.get_personal_intent_collaboration_plan_v170(
  p_suggestion_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'planning_creator_user_id', chat.planning_creator_user_id,
    'planning_intent_id', chat.planning_intent_id,
    'plan_id', plan.id,
    'activity_title', case
      when plan.id is null then null
      else coalesce(
        nullif(trim(plan.shared_title), ''),
        nullif(trim(plan.title), ''),
        nullif(trim(target.title), ''),
        public.uin_seed_display_title_v90(seed.id)
      )
    end,
    'activity_status', plan.status,
    'window_start', plan.window_start,
    'window_end', plan.window_end,
    'scheduled_start', plan.scheduled_start,
    'scheduled_end', plan.scheduled_end,
    'timezone', plan.timezone,
    'activity_location_name', case
      when plan.host_user_id = auth.uid() or exists (
        select 1
        from public.plan_members member_access
        where member_access.plan_id = plan.id
          and member_access.user_id = auth.uid()
          and member_access.status = 'active'
      ) then plan.activity_location_name
      else null
    end,
    'meeting_point', case
      when plan.host_user_id = auth.uid() or exists (
        select 1
        from public.plan_members member_access
        where member_access.plan_id = plan.id
          and member_access.user_id = auth.uid()
          and member_access.status = 'active'
      )
        then plan.meeting_point
      else null
    end,
    'cancelled_at', plan.cancelled_at,
    'completed_at', plan.completed_at,
    'cancellation_phase', plan.cancellation_phase,
    'expired_at', plan.expired_at,
    'activity_city', activity_location.city,
    'activity_district', activity_location.district,
    'viewer_can_open_room', (
      plan.id is not null
      and (
        plan.host_user_id = auth.uid()
        or exists (
          select 1
          from public.plan_members member_access
          where member_access.plan_id = plan.id
            and member_access.user_id = auth.uid()
            and member_access.status = 'active'
        )
      )
    ),
    'event_resolution', case
      when chat.planning_intent_id is null then 'none'
      when plan.id is null then 'intent_only'
      else 'plan_resolved'
    end
  )
  from public.personal_intent_collaboration_chats chat
  left join public.seeds seed
    on seed.id = chat.seed_id
  left join public.canonical_targets target
    on target.id = coalesce(chat.canonical_target_id, seed.canonical_target_id)
  left join public.plan_intents plan_link
    on plan_link.intent_id = chat.planning_intent_id
   and plan_link.status = 'active'
  left join public.plans plan
    on plan.id = plan_link.plan_id
  left join public.intents planning_intent
    on planning_intent.id = chat.planning_intent_id
  left join public.locations activity_location
    on activity_location.id = coalesce(plan.location_id, planning_intent.location_id)
  where chat.suggestion_id = p_suggestion_id
    and auth.uid() is not null
    and auth.uid() in (chat.owner_user_id, chat.requester_user_id);
$function$;

revoke all on function public.get_my_personal_intent_collaboration_chats_v170()
  from public, anon;
revoke all on function public.get_personal_intent_collaboration_plan_v170(uuid)
  from public, anon;

grant execute on function public.get_my_personal_intent_collaboration_chats_v170()
  to authenticated;
grant execute on function public.get_personal_intent_collaboration_plan_v170(uuid)
  to authenticated;

comment on function public.get_my_personal_intent_collaboration_chats_v170() is
  'Returns collaboration inbox rows and their verified activity summaries in one authenticated read.';
comment on function public.get_personal_intent_collaboration_plan_v170(uuid) is
  'Returns a collaboration chat plan hand-off and privacy-scoped activity summary for chat participants.';

notify pgrst, 'reload schema';

commit;
