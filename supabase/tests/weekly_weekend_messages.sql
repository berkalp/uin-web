-- Run in a SQL session as postgres. Everything, including webhook queue entries,
-- is rolled back; no test messages reach users or devices.
begin;
do $$
declare n int; n2 int; initial_notifications int; initial_reads jsonb;
  sender uuid; recipient uuid; conv uuid; reply_id uuid;
begin
  select count(*) into initial_notifications from public.notifications;
  select jsonb_agg(to_jsonb(r) order by conversation_id,user_id) into initial_reads from public.direct_conversation_reads r;
  if uin_private.dispatch_uin_weekend_messages('2099-10-17 08:59:00+00')<>0 then raise exception 'Early send'; end if;
  -- 17 October 2099 is a Saturday; this far-future week has no real deliveries.
  if uin_private.dispatch_uin_weekend_messages('2099-10-18 09:00:00+00')<>0 then raise exception 'Wrong weekday'; end if;
  n:=uin_private.dispatch_uin_weekend_messages('2099-10-17 09:00:00+00');
  if n<1 then raise exception 'No eligible recipients in fixture'; end if;
  n2:=uin_private.dispatch_uin_weekend_messages('2099-10-17 09:01:00+00');
  if n2<>0 then raise exception 'Duplicate weekly send'; end if;
  if (select count(*) from public.notifications)<>initial_notifications+n then raise exception 'Duplicate push'; end if;
  if exists(select 1 from public.notifications where notification_type='uin_weekend_message' and action_url not like '/messages/%') then raise exception 'Broken web/native chat link'; end if;
  if (select jsonb_agg(to_jsonb(r) order by conversation_id,user_id) from public.direct_conversation_reads r) is distinct from initial_reads then raise exception 'Automatic send changed read state'; end if;
  select sender_user_id into sender from public.uin_welcome_settings where settings_key='default';
  select user_id,conversation_id into recipient,conv from uin_private.weekend_message_deliveries where week_start=date '2099-10-12' limit 1;
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  if not public.direct_conversation_user_can_send(conv,recipient) then raise exception 'Cannot reply'; end if;
  perform public.save_my_uin_weekend_preference(false);
  if public.get_my_uin_weekend_preference() then raise exception 'Preference not saved'; end if;
  n2:=uin_private.dispatch_uin_weekend_messages('2099-10-24 09:00:00+00');
  if n2<>n-1 then raise exception 'Opt-out not respected'; end if;
  if not public.direct_conversation_user_can_send(conv,recipient) then raise exception 'Opt-out blocked replies'; end if;
  insert into public.direct_messages(conversation_id,sender_id,body) values(conv,recipient,'ROLLBACK TEST ONLY') returning id into reply_id;
  if not exists(select 1 from public.notifications where user_id=sender and source_key='uin-team-message:'||reply_id) then raise exception 'Missing reply notification'; end if;
  update public.direct_conversation_access set revoked_at=now() where conversation_id=conv and user_id=recipient;
  if public.direct_conversation_user_can_send(conv,recipient) then raise exception 'Revocation bypassed'; end if;
  perform public.save_my_uin_weekend_preference(true);
  if uin_private.dispatch_uin_weekend_messages('2099-10-31 09:00:00+00')<>n-1 then raise exception 'Revoked conversation received campaign'; end if;
  if has_function_privilege('authenticated','uin_private.dispatch_uin_weekend_messages(timestamptz)','execute') then raise exception 'User can broadcast'; end if;
  if has_function_privilege('anon','public.save_my_uin_weekend_preference(boolean)','execute') then raise exception 'Anonymous preference access'; end if;
  if has_table_privilege('authenticated','uin_private.weekend_message_deliveries','select') then raise exception 'Private ledger exposed'; end if;
end; $$;
set constraints all immediate;
rollback;
select 'PASS: schedule, dedup, opt-out, reply notification, revocation, read-state preservation, private permissions; rollback completed' as result;
