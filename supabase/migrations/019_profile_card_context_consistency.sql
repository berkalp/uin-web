begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function public.get_visible_plan_source_intents(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  intent_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid := auth.uid();
begin
  if p_plan_ids is null
     or cardinality(p_plan_ids) = 0 then
    return;
  end if;

  if cardinality(p_plan_ids) > 100 then
    raise exception
      'Too many Plan records requested.'
      using errcode = '22023';
  end if;

  return query
  select
    plan.id,
    source_link.intent_id
  from public.plans plan
  join lateral (
    select linked_intent.intent_id
    from public.plan_intents linked_intent
    where linked_intent.plan_id = plan.id
      and linked_intent.status = 'active'
    order by
      case
        when linked_intent.relationship = 'host_source' then 0
        else 1
      end,
      linked_intent.id
    limit 1
  ) source_link on true
  where plan.id = any(p_plan_ids)
    and (
      plan.host_user_id = v_viewer_user_id
      or exists (
        select 1
        from public.plan_members viewer_member
        where viewer_member.plan_id = plan.id
          and viewer_member.user_id = v_viewer_user_id
          and viewer_member.status = 'active'
      )
      or plan.visibility = 'public'
      or public.can_user_view_intent_activity(
        source_link.intent_id,
        v_viewer_user_id
      )
    );
end;
$$;

revoke all on function public.get_visible_plan_source_intents(uuid[])
from public;

grant execute on function public.get_visible_plan_source_intents(uuid[])
to anon, authenticated;

commit;
