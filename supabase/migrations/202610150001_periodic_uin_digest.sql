begin;
set local lock_timeout='5s';
create table public.uin_digest_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true
);
alter table public.uin_digest_preferences enable row level security;
revoke all on public.uin_digest_preferences from anon,authenticated;
create table uin_private.digest_delivery_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_sent_at timestamptz, last_checked_at timestamptz, fingerprint text
);
alter table uin_private.digest_delivery_state enable row level security;
revoke all on uin_private.digest_delivery_state from public,anon,authenticated;
create or replace function public.get_my_uin_digest_preference() returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
 return coalesce((select enabled from public.uin_digest_preferences where user_id=auth.uid()),true);
end $$;
create or replace function public.save_my_uin_digest_preference(p_enabled boolean) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Bildirim tercihi gerekli.'; end if;
 insert into public.uin_digest_preferences(user_id,enabled) values(auth.uid(),p_enabled)
 on conflict(user_id) do update set enabled=excluded.enabled;
 return p_enabled;
end $$;
revoke all on function public.get_my_uin_digest_preference(),public.save_my_uin_digest_preference(boolean) from public,anon;
grant execute on function public.get_my_uin_digest_preference(),public.save_my_uin_digest_preference(boolean) to authenticated;

-- Only the scheduler can choose a viewer. Existing visibility readers remain authoritative.
create or replace function uin_private.digest_snapshot(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare old_sub text:=current_setting('request.jwt.claim.sub',true); result jsonb;
 v_wishes bigint;v_done bigint;v_friends bigint;v_shared bigint;v_plans bigint;v_unread bigint;v_latest timestamptz;v_body text;
begin
 perform set_config('request.jwt.claim.sub',p_user_id::text,true);
 with friends as materialized(select other_user_id from public.get_my_friendships() where friendship_status='accepted'),
 people as materialized(
 select public.resolve_uin_card_target_v129(p.target_id) target_id,p.user_id,p.relationship_status
 from public.visible_common_target_people_v38() p
 where p.source_kind in ('seed','personal')
 and (p.user_id=p_user_id or p.user_id in(select other_user_id from friends))
 and (p.relationship_status='completed' or p.target_date is null or p.target_date >= (now() at time zone 'Europe/Istanbul')::date)
 ), own_wishes as(select distinct target_id from people where user_id=p_user_id and relationship_status<>'completed')
 select (select count(*) from own_wishes),
 count(distinct target_id) filter(where user_id=p_user_id and relationship_status='completed'),
 count(distinct target_id) filter(where user_id<>p_user_id and relationship_status<>'completed'),
 count(distinct target_id) filter(where user_id<>p_user_id and relationship_status<>'completed' and target_id in(select target_id from own_wishes))
 into v_wishes,v_done,v_friends,v_shared from people;
 select count(distinct resource_id) into v_plans from public.get_my_uin_active_plan_topics_v153()
 where start_date between (now() at time zone 'Europe/Istanbul')::date and (now() at time zone 'Europe/Istanbul')::date+3;
 select count(*),max(created_at) into v_unread,v_latest from public.notifications
 where user_id=p_user_id and read_at is null and notification_type<>'uin_periodic_digest'
 and created_at>=now()-interval '3 days' and notification_type not like '%room_message%';
 v_body:=concat_ws(' ',case when v_unread>0 then v_unread||' yeni okunmamÄ±ÅŸ bildirimin var.' end,
 case when v_shared>0 then 'ArkadaÅŸlarÄ±nla '||v_shared||' ortak niyetin var.' end,
 case when v_plans>0 then 'Ã–nÃ¼mÃ¼zdeki 3 gÃ¼nde '||v_plans||' planÄ±n var.' end,
 'Senin UINâ€™in: '||v_wishes||' niyet Â· '||v_done||' deneyim.',
 case when v_friends>0 then 'ArkadaÅŸlarÄ±nÄ±n '||v_friends||' farklÄ± niyet kartÄ± var.' end,
 'Birlikte yeni bir ÅŸey yapmaya ne dersin? ğŸŒ¿');
 result:=jsonb_build_object('body',v_body,'wishes',v_wishes,'experiences',v_done,'friend_cards',v_friends,'shared',v_shared,'plans',v_plans,'unread',v_unread,
 'meaningful',v_unread+v_shared+v_plans+v_wishes+v_done+v_friends>0,
 'fingerprint',md5(v_body||coalesce(v_latest::text,'')));
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);raise;
end $$;
revoke all on function uin_private.digest_snapshot(uuid) from public,anon,authenticated;

create or replace function uin_private.dispatch_uin_digests(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient record; snapshot jsonb; sent integer:=0; checked integer:=0; failed integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('uin-periodic-digest')) then return jsonb_build_object('busy',true);end if;
 insert into uin_private.digest_delivery_state(user_id) select id from public.profiles on conflict do nothing;
 for recipient in
 select s.* from uin_private.digest_delivery_state s
 join public.profiles p on p.id=s.user_id join auth.users u on u.id=s.user_id
 left join public.uin_digest_preferences pref on pref.user_id=s.user_id
 where coalesce(pref.enabled,true) and p.username is not null
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
 and coalesce(s.last_sent_at,p.created_at)<=now()-interval '3 days'
 and (s.last_checked_at is null or s.last_checked_at<=now()-interval '23 hours')
 order by s.last_checked_at nulls first,s.user_id
 limit greatest(1,least(coalesce(p_limit,20),100)) for update of s skip locked
 loop
  begin
   snapshot:=uin_private.digest_snapshot(recipient.user_id);
   update uin_private.digest_delivery_state set last_checked_at=now() where user_id=recipient.user_id;
   checked:=checked+1;
   if (snapshot->>'meaningful')::boolean and snapshot->>'fingerprint' is distinct from recipient.fingerprint then
    perform public.create_app_notification(recipient.user_id,null,'uin_periodic_digest','uin_digest',null,
     'UINâ€™de senin iÃ§in neler var? ğŸŒ¿',snapshot->>'body','/ideas','uin-digest:'||(now() at time zone 'Europe/Istanbul')::date::text);
    update uin_private.digest_delivery_state set last_sent_at=now(),fingerprint=snapshot->>'fingerprint' where user_id=recipient.user_id;
    sent:=sent+1;
   end if;
  exception when others then
   failed:=failed+1;
   raise warning 'UIN digest failed for %, SQLSTATE %',recipient.user_id,SQLSTATE;
  end;
 end loop;
 return jsonb_build_object('checked',checked,'sent',sent,'failed',failed);
end $$;
revoke all on function uin_private.dispatch_uin_digests(integer) from public,anon,authenticated;
-- Scheduling is activated separately after client compatibility and rollback tests.
commit;

create or replace function public.get_my_uin_card_notifications_v20261015(
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
        'uin_card_new_event',
        'uin_periodic_digest'
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
revoke all on function public.get_my_uin_card_notifications_v20261015(integer) from public,anon;
grant execute on function public.get_my_uin_card_notifications_v20261015(integer) to authenticated;
