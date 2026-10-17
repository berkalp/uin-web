-- Integration checks run in a rolled-back transaction. No user content is retained.
begin;
do $$
declare
  actor uuid; outsider uuid; event_id uuid; seed_id uuid; wish_id uuid;
  b jsonb; a jsonb; original_owner uuid; audit_before bigint; test_plan record; tested integer:=0;
begin
  select user_id into actor from public.admin_users where role='owner' order by created_at limit 1;
  select id into outsider from public.profiles where not exists(select 1 from public.admin_users where user_id=profiles.id) limit 1;
  select i.id into event_id from public.intents i join public.plan_intents pi on pi.intent_id=i.id
    join public.plans p on p.id=pi.plan_id where i.user_id<>actor and pi.relationship='host_source'
    and pi.status='active' and p.status='forming' order by i.created_at desc limit 1;
  if actor is null or outsider is null or event_id is null then raise exception 'Missing test fixtures'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  b:=public.admin_get_record_v202('event',event_id);
  select count(*) into audit_before from public.admin_audit_logs;
  a:=public.admin_save_record_v202('event',event_id,b->>'revision',jsonb_build_object('notes','Yönetici testi','title','Yönetici başlık testi','cover_url','https://example.com/admin-test.jpg'));
  if a->>'ownerId' is distinct from b->>'ownerId' or a->>'status' is distinct from b->>'status' then raise exception 'Owner or lifecycle changed'; end if;
  if (select notes from public.plans where id=(a->>'planId')::uuid)<>'Yönetici testi' then raise exception 'Linked plan not synchronized'; end if;
  if (select owner_user_id from public.intent_custom_covers where intent_id=event_id)<>(b->>'ownerId')::uuid then raise exception 'Cover ownership changed'; end if;
  if (select count(*) from public.admin_audit_logs)<>audit_before+1 then raise exception 'Missing audit'; end if;
  if (public.get_uin_event_presentation_v86(event_id)->>'displayTitle') not like 'Yönetici başlık testi%' then raise exception 'Title not presented'; end if;
  begin
    perform public.admin_save_record_v202('event',event_id,b->>'revision','{"notes":"stale"}');
    raise exception 'Stale revision was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.admin_save_record_v202('event',event_id,a->>'revision',jsonb_build_object('user_id',actor));
    raise exception 'Owner patch was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_save_record_v202('event',event_id,a->>'revision','{"start_date":"2030-01-02","end_date":"2030-01-01"}');
    raise exception 'Invalid date accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  begin
    perform public.admin_save_record_v202('event',event_id,a->>'revision','{"canonical_target_id":null}');
    set constraints all immediate;
    raise exception 'Missing DNA accepted' using errcode='XX000';
  exception when raise_exception or not_null_violation then null; end;
  if coalesce(current_setting('uin.admin_record_edit',true),'')='on' then raise exception 'Admin context leaked'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.admin_get_record_v202('event',event_id);
    raise exception 'Nonadmin read accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_save_record_v202('event',event_id,a->>'revision','{"notes":"unauthorized"}');
    raise exception 'Nonadmin write accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.admin_get_record_v202('event',event_id);
    raise exception 'Anonymous read accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  for test_plan in select distinct on(status) id,status from public.plans where status in ('planned','completed','cancelled') order by status,id loop
    b:=public.admin_get_record_v202('event',test_plan.id);
    a:=public.admin_save_record_v202('event',test_plan.id,b->>'revision','{"title":"Yönetici arşiv başlığı testi"}');
    if a->>'status'<>test_plan.status then raise exception 'Archive status changed'; end if;
    tested:=tested+1;
  end loop;
  if tested<>3 then raise exception 'Missing lifecycle test cases'; end if;
  select id into seed_id from public.seeds where user_id<>actor order by updated_at desc limit 1;
  b:=public.admin_get_record_v202('seed',seed_id);
  a:=public.admin_save_record_v202('seed',seed_id,b->>'revision','{"notes":"Yönetici niyet testi"}');
  if a->>'ownerId'<>b->>'ownerId' or a->>'status'<>b->>'status' then raise exception 'Seed history changed'; end if;
  select id into wish_id from public.canonical_personal_intents_v38 where user_id<>actor order by updated_at desc limit 1;
  b:=public.admin_get_record_v202('personal',wish_id);
  a:=public.admin_save_record_v202('personal',wish_id,b->>'revision','{"notes":"Yönetici kişisel niyet testi"}');
  if a->>'ownerId'<>b->>'ownerId' or a->>'targetId'<>b->>'targetId' then raise exception 'Personal intent identity changed'; end if;
  -- The public roles must have no access to these SECURITY DEFINER entrypoints.
  if has_function_privilege('anon','public.admin_save_record_v202(text,uuid,text,jsonb)','execute') then raise exception 'Anonymous grant'; end if;
  set constraints all immediate;
end $$;
select 'Admin edit, plan sync, lifecycle locks, audit, revisions, owner preservation and authorization: PASS' result;
rollback;
