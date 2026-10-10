begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, pg_temp;

create or replace function public.get_my_uin_card_notifications_v169(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  with filtered as materialized (
    select
      notification.id,
      notification.notification_type,
      notification.entity_type,
      notification.entity_id,
      notification.title,
      notification.body,
      notification.action_url,
      notification.read_at,
      notification.created_at
    from public.notifications notification
    where notification.user_id = v_user_id
      and notification.notification_type in (
        'uin_card_new_intent',
        'uin_card_new_experience',
        'uin_card_new_event'
      )
  ), summary as (
    select
      count(*)::bigint as total_count,
      count(*) filter (where filtered.read_at is null)::bigint as unread_count
    from filtered
  ), page as (
    select
      filtered.id,
      filtered.created_at,
      jsonb_build_object(
        'id', filtered.id,
        'notification_type', filtered.notification_type,
        'entity_type', filtered.entity_type,
        'entity_id', filtered.entity_id,
        'title', filtered.title,
        'body', filtered.body,
        'action_url', filtered.action_url,
        'is_read', (filtered.read_at is not null),
        'read_at', filtered.read_at,
        'created_at', filtered.created_at
      ) as payload
    from filtered
    order by filtered.created_at desc, filtered.id desc
    limit v_limit
  ), page_payload as (
    select coalesce(
      jsonb_agg(page.payload order by page.created_at desc, page.id desc),
      '[]'::jsonb
    ) as items
    from page
  )
  select jsonb_build_object(
    'items', page_payload.items,
    'total_count', summary.total_count,
    'unread_count', summary.unread_count,
    'limit', v_limit
  )
  into v_result
  from summary
  cross join page_payload;

  return v_result;
end;
$$;

create or replace function public.mark_my_notification_read(p_notification_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.notifications notification
  set read_at = coalesce(notification.read_at, now())
  where notification.id::text = p_notification_id
    and notification.user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.get_my_uin_card_notifications_v169(integer) from public, anon;
revoke all on function public.mark_my_notification_read(text) from public, anon;

grant execute on function public.get_my_uin_card_notifications_v169(integer) to authenticated;
grant execute on function public.mark_my_notification_read(text) to authenticated;

comment on function public.get_my_uin_card_notifications_v169(integer) is
  'Returns the authenticated user''s latest UIN card notifications and exact total/unread counts from one statement.';

commit;
