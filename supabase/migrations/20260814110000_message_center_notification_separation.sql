begin;

-- ============================================================
-- UIN MESSAGE CENTER / NOTIFICATION FEED SEPARATION
--
-- Room-message notification rows remain in public.notifications because the
-- native push webhook consumes them. They are transport records, not Bell-feed
-- items. The web UI therefore gets dedicated update-feed RPCs that exclude
-- Planning / Activity Room messages.
-- ============================================================

create or replace function public.get_my_unread_update_notification_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::bigint
  from public.notifications notification
  where notification.user_id = auth.uid()
    and coalesce(notification.is_read, false) = false
    and lower(coalesce(notification.notification_type, '')) not like '%room_message%';
$$;

revoke all on function public.get_my_unread_update_notification_count()
from public, anon;
grant execute on function public.get_my_unread_update_notification_count()
to authenticated;

create or replace function public.get_my_update_notifications_page(
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint := 0;
  v_unread bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select
    count(*)::bigint,
    count(*) filter (where coalesce(notification.is_read, false) = false)::bigint
  into v_total, v_unread
  from public.notifications notification
  where notification.user_id = v_user_id
    and lower(coalesce(notification.notification_type, '')) not like '%room_message%';

  select coalesce(
    jsonb_agg(item.payload order by item.created_at desc, item.notification_id desc),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      notification.id as notification_id,
      notification.created_at,
      jsonb_build_object(
        'notification_id', notification.id,
        'notification_type', notification.notification_type,
        'entity_type', notification.entity_type,
        'entity_id', notification.entity_id,
        'title', notification.title,
        'body', notification.body,
        'action_url', notification.action_url,
        'is_read', coalesce(notification.is_read, false),
        'read_at', notification.read_at,
        'created_at', notification.created_at,
        'actor_user_id', notification.actor_user_id,
        'actor_full_name', actor.full_name,
        'actor_username', actor.username,
        'actor_avatar_url', actor.avatar_url
      ) as payload
    from public.notifications notification
    left join public.profiles actor
      on actor.id = notification.actor_user_id
    where notification.user_id = v_user_id
      and lower(coalesce(notification.notification_type, '')) not like '%room_message%'
    order by notification.created_at desc, notification.id desc
    limit v_limit
    offset v_offset
  ) item;

  return jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'unread_count', v_unread,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

revoke all on function public.get_my_update_notifications_page(integer, integer)
from public, anon;
grant execute on function public.get_my_update_notifications_page(integer, integer)
to authenticated;

create or replace function public.mark_my_room_message_transport_read(
  p_plan_id uuid,
  p_room_phase text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_notification_type text;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_plan_id is null then
    raise exception 'Plan id is required.' using errcode = '22023';
  end if;

  if p_room_phase = 'planning' then
    v_notification_type := 'planning_room_message';
  elsif p_room_phase = 'activity' then
    v_notification_type := 'activity_room_message';
  else
    raise exception 'Unsupported room phase.' using errcode = '22023';
  end if;

  update public.notifications notification
  set
    is_read = true,
    read_at = coalesce(notification.read_at, now())
  where notification.user_id = v_user_id
    and notification.entity_type = 'plan'
    and notification.entity_id = p_plan_id
    and notification.notification_type = v_notification_type
    and coalesce(notification.is_read, false) = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_my_room_message_transport_read(uuid, text)
from public, anon;
grant execute on function public.mark_my_room_message_transport_read(uuid, text)
to authenticated;

comment on function public.get_my_unread_update_notification_count()
is 'Bell count for meaningful update notifications. Room-message transport rows are excluded.';

comment on function public.get_my_update_notifications_page(integer, integer)
is 'Paginated update-notification feed. Planning/Activity Room message transport rows are excluded.';

comment on function public.mark_my_room_message_transport_read(uuid, text)
is 'Marks hidden room-message notification transport rows read when the corresponding room is opened.';

commit;
