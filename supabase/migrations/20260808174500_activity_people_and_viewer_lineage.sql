-- Activity cards need one consistent, visibility-safe people model and a
-- viewer-specific Intent -> Activity provenance hint.  Keep both behind RPCs
-- so Discover/Community cards do not bypass the existing activity visibility
-- boundary with direct table reads.

create or replace function public.get_visible_activity_people_batch(
  p_resource_ids uuid[]
)
returns table (
  resource_id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    resource.resource_id,
    person.user_id,
    person.full_name,
    person.username,
    person.avatar_url,
    person.role
  from (
    select distinct unnest(coalesce(p_resource_ids, '{}'::uuid[])) as resource_id
  ) resource
  cross join lateral public.get_visible_activity_people(resource.resource_id) person;
$$;

revoke all
on function public.get_visible_activity_people_batch(uuid[])
from public;

grant execute
on function public.get_visible_activity_people_batch(uuid[])
to anon, authenticated;

comment on function public.get_visible_activity_people_batch(uuid[])
is
  'Batch wrapper around get_visible_activity_people. Returns active host, co-hosts and participants only for resources the viewer may see.';


create or replace function public.get_my_visible_plan_lineage(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  source_count bigint,
  source_intent_id uuid,
  source_activity_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_source_count bigint;
  v_source_intent_id uuid;
  v_source_activity_name text;
begin
  if auth.uid() is null then
    return;
  end if;

  for v_plan_id in
    select distinct requested_plan_id
    from unnest(coalesce(p_plan_ids, '{}'::uuid[])) as requested(requested_plan_id)
    where requested_plan_id is not null
  loop
    -- Reuse the public Activity detail boundary. If this returns null, the
    -- viewer must not receive provenance for the Plan either.
    if public.get_activity_detail_page(v_plan_id) is null then
      continue;
    end if;

    select count(distinct source.intent_id)
    into v_source_count
    from (
      select link.intent_id
      from public.plan_intents link
      where
        link.plan_id = v_plan_id
        and link.status = 'active'

      union all

      select request.own_intent_id
      from public.intent_requests request
      where
        request.plan_id = v_plan_id
        and request.status = 'accepted'

      union all

      select request.target_intent_id
      from public.intent_requests request
      where
        request.plan_id = v_plan_id
        and request.status = 'accepted'
    ) source;

    select candidate.intent_id
    into v_source_intent_id
    from (
      select
        link.intent_id,
        0 as priority
      from public.plan_intents link
      join public.intents intent
        on intent.id = link.intent_id
      where
        link.plan_id = v_plan_id
        and link.status = 'active'
        and intent.user_id = auth.uid()

      union all

      select
        case
          when request.requester_id = auth.uid() then request.own_intent_id
          when request.receiver_id = auth.uid() then request.target_intent_id
          else null
        end as intent_id,
        1 as priority
      from public.intent_requests request
      where
        request.plan_id = v_plan_id
        and request.status = 'accepted'
        and (
          request.requester_id = auth.uid()
          or request.receiver_id = auth.uid()
        )
    ) candidate
    where candidate.intent_id is not null
    order by candidate.priority, candidate.intent_id
    limit 1;

    v_source_activity_name := null;

    if v_source_intent_id is not null then
      select activity.name
      into v_source_activity_name
      from public.intents intent
      left join public.activities activity
        on activity.id = intent.activity_id
      where intent.id = v_source_intent_id;
    end if;

    plan_id := v_plan_id;
    source_count := coalesce(v_source_count, 0);
    source_intent_id := v_source_intent_id;
    source_activity_name := v_source_activity_name;
    return next;

    v_source_intent_id := null;
    v_source_activity_name := null;
  end loop;
end;
$$;

revoke all
on function public.get_my_visible_plan_lineage(uuid[])
from public;

grant execute
on function public.get_my_visible_plan_lineage(uuid[])
to authenticated;

comment on function public.get_my_visible_plan_lineage(uuid[])
is
  'Returns viewer-specific Intent -> Activity provenance for visible Plans, plus the total number of source Intents. Other users source Intent titles are never exposed.';
