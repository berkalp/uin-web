begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- ============================================================
-- UIN CLOSED ROOM READ SETTLEMENT
--
-- Product rule:
-- - Expired / completed / cancelled rooms are history, not active inbox work.
-- - Their old unread markers must never keep the Messages counter alive forever.
-- - History is preserved. Nothing is deleted.
-- ============================================================

create or replace function public.settle_my_closed_room_unreads()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan record;
  v_room_phase text;
  v_processed integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  for v_plan in
    select
      plan.id,
      plan.status::text as status,
      plan.creation_mode,
      plan.planned_at,
      plan.expired_at,
      plan.window_end,
      plan.timezone
    from public.plans plan
    where
      (
        plan.host_user_id = v_user_id
        or exists (
          select 1
          from public.plan_members member
          where member.plan_id = plan.id
            and member.user_id = v_user_id
        )
      )
      and (
        plan.status::text in ('completed', 'cancelled')
        or (
          plan.status::text = 'forming'
          and (
            plan.expired_at is not null
            or plan.window_end <
              (
                now() at time zone
                coalesce(nullif(btrim(plan.timezone), ''), 'UTC')
              )::date
          )
        )
      )
  loop
    v_room_phase :=
      case
        when v_plan.creation_mode = 'scheduled_direct'
          or v_plan.status in ('planned', 'completed')
          or (
            v_plan.status = 'cancelled'
            and v_plan.planned_at is not null
          )
        then 'activity'
        else 'planning'
      end;

    -- Existing RPC owns the actual room-read storage.
    begin
      perform public.mark_plan_room_read(
        v_plan.id,
        v_room_phase
      );
    exception
      when others then
        -- A legacy room may not have a read row yet. Do not block cleanup
        -- of notification transport rows for that reason.
        null;
    end;

    -- Hidden push transport rows must also stop carrying unread state.
    begin
      perform public.mark_my_room_message_transport_read(
        v_plan.id,
        v_room_phase
      );
    exception
      when others then
        null;
    end;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$function$;

revoke all
on function public.settle_my_closed_room_unreads()
from public, anon;

grant execute
on function public.settle_my_closed_room_unreads()
to authenticated;

comment on function public.settle_my_closed_room_unreads()
is
  'Settles unread markers for expired/completed/cancelled Plan rooms without deleting room history. Closed rooms no longer keep active Messages counters alive.';

notify pgrst, 'reload schema';

commit;
