begin;
do $test$
declare
 v_owner uuid; v_source record; v_details jsonb; v_id uuid; v_retry uuid; v_count bigint;
begin
 select user_id into v_owner from public.admin_users where not public.is_managed_minor_user(user_id) order by user_id limit 1;
 if v_owner is null then raise exception 'Test owner unavailable'; end if;
 select i.* into v_source from public.intents i
 where i.user_id=v_owner and i.canonical_target_id is not null and i.sport_id is null
   and i.activity_id is not null and i.location_id is not null
   and public.uin_target_has_active_library_card_v144(i.canonical_target_id)
 order by i.created_at desc limit 1;
 if v_source.id is null then raise exception 'Test source unavailable'; end if;
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 v_details:=jsonb_build_object(
 'p_creation_request_id','rollback-creation-test-'||gen_random_uuid()::text,
 'p_start_date','2031-02-13','p_end_date','2031-02-14','p_people','anyone',
 'p_location_id',v_source.location_id,'p_activity_id',v_source.activity_id,'p_sport_id',null,
 'p_budget',null,'p_recurrence','one-time','p_visibility','invite_only','p_notes','Rollback-only idempotency test',
 'p_intent_type','Short-term Intent','p_max_participants',2,'p_community_ids','[]'::jsonb,
 'p_participant_eligibility','everyone','p_join_message_mode','none','p_join_message_prompt',null,
 'p_professional_requirement','none','p_professional_role_id',null);
 select count(*) into v_count from public.intents;
 v_id:=public.create_my_card_event_v72(v_source.canonical_target_id,v_details,'{}'::uuid[]);
 set constraints all immediate;
 v_retry:=public.create_my_card_event_v72(v_source.canonical_target_id,v_details,'{}'::uuid[]);
 if v_id<>v_retry then raise exception 'Retry created another row'; end if;
 begin
  perform public.create_my_card_event_v72(v_source.canonical_target_id,v_details||'{"p_creation_request_id":"another-attempt","p_budget":100}'::jsonb,'{}'::uuid[]);
  raise exception 'Duplicate accepted';
 exception when unique_violation then null;
 end;
 if (select count(*) from public.intents)<>v_count+1 then raise exception 'Unexpected row count';end if;
 if (select count(*) from public.card_event_creation_receipts where intent_id=v_id)<>1 then raise exception 'Receipt missing';end if;
 if has_table_privilege('authenticated','public.card_event_creation_receipts','select')
 or has_function_privilege('authenticated','public.begin_card_event_creation(uuid,jsonb,uuid[])','execute') then raise exception 'Internal data exposed';end if;
end;
$test$;
rollback;
select 'PASS: real creation RPC, same-request retry, changed-budget duplicate rejection, deferred constraints and privileges; all test writes rolled back' result;
