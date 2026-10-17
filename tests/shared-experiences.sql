-- Run inside BEGIN/ROLLBACK. No test invitations or personal records are committed.
do $$
declare a uuid:='cbf3108c-058b-4271-ae5e-500c0bccaa7e'; b uuid:='38150458-cd9b-48d4-9719-2fb049be61cb'; c uuid:='40f34b94-494a-491b-9684-362f33125320';
 activity uuid; seed uuid; seed_type uuid; g uuid; copy uuid; result jsonb; payload jsonb; request uuid:=gen_random_uuid(); i int; denied boolean;
begin
 select id into activity from public.activities where lower(name)='concert' limit 1;
 select id into seed_type from public.seed_types where is_active order by sort_order limit 1;
 if activity is null or seed_type is null then raise exception 'Fixture catalogue missing'; end if;
 -- Friends are prerequisite, not an authority supplied by the client.
 if not public.are_users_friends(a,b) then insert into public.friendships(requester_user_id,addressee_user_id,status) values(a,b,'accepted'); end if;
 if not public.are_users_friends(c,b) then insert into public.friendships(requester_user_id,addressee_user_id,status) values(c,b,'accepted'); end if;
 for i in 1..6 loop
  perform set_config('request.jwt.claim.sub',case when i=6 then c::text else a::text end,true);
  insert into public.seeds(user_id,seed_type_id,title,visibility,status,completed_at,origin,seed_scope)
   values(auth.uid(),seed_type,'Ortak deneyim test kaydı','everyone','completed',now(),'retrospective','private') returning id into seed;
  perform public.save_my_seed_v17_state(seed,'completed','unknown',null,null,null,7);
  payload:=jsonb_build_object('seedId',seed,'activityId',activity,'friends',jsonb_build_array(jsonb_build_object('id',b,'score',case when i=6 then 4 else 10 end)));
  result:=public.shared_experience_action('save',payload);g:=(result->>'id')::uuid;
  if public.shared_experience_action('save',payload)->>'id'<>g::text then raise exception 'Retry duplicated the experience'; end if;
  if (select count(*) from uin_private.shared_experience_members where experience_id=g)<>2 then raise exception 'Duplicate member'; end if;
  if exists(select 1 from uin_private.shared_experience_members where experience_id=g and user_id=b and seed_id is not null) then raise exception 'Unaccepted invitation created a personal record'; end if;
  if uin_private.shared_score_released(g,auth.uid(),b) then raise exception 'Pending score released'; end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  result:=public.shared_experience_action('detail',jsonb_build_object('id',g));
  if result::text like '%"score": 10%' then raise exception 'Received score leaked before consent'; end if;
  result:=public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',true));copy:=(result->>'seedId')::uuid;
  if public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',true))->>'seedId'<>copy::text then raise exception 'Acceptance retry duplicated own experience'; end if;
  if (select rating from public.seed_personal_state_v15 where seed_id=copy) is not null then raise exception 'Sender rating copied'; end if;
  if (select notes from public.seeds where id=copy) is not null then raise exception 'Sender note copied'; end if;
  if uin_private.shared_score_released(g,case when i=6 then c else a end,b) then raise exception 'Unilateral score published too soon'; end if;
  if i=1 then
   update uin_private.shared_experience_members set accepted_at=now()-interval '8 days' where experience_id=g;
   if not uin_private.shared_score_released(g,a,b) then raise exception 'Seven-day release missing';end if;
   update uin_private.shared_experience_members set accepted_at=now() where experience_id=g;
  end if;
  perform public.shared_experience_action('rate',jsonb_build_object('id',g,'targetId',case when i=6 then c else a end,'score',8));
  if not uin_private.shared_score_released(g,case when i=6 then c else a end,b) then raise exception 'Mutual scores not released'; end if;
 end loop;
 result:=public.shared_experience_action('reputation',jsonb_build_object('userId',b));
 if (result->0->>'score')::numeric<>7 or (result->0->>'people')::int<>2 or (result->0->>'experiences')::int<>6 then raise exception 'Repeated reviewer not weighted equally: %',result; end if;
 -- Receiving a score never allows a user to alter it.
 perform public.shared_experience_action('rate',jsonb_build_object('id',g,'targetId',c,'score',1));
 if (select score from uin_private.shared_experience_scores where experience_id=g and reviewer_id=b and target_id=c)<>8 then raise exception 'Sealed score changed'; end if;
 denied:=false;begin perform public.shared_experience_action('rate',jsonb_build_object('id',g,'targetId',b,'score',10));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Self-rating allowed';end if;
 denied:=false;begin perform public.shared_experience_action('rate',jsonb_build_object('id',g,'targetId',c,'score',11));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Out-of-range score allowed';end if;
 result:=public.shared_experience_action('repeat',jsonb_build_object('id',g,'requestId',request));
 if result<>public.shared_experience_action('repeat',jsonb_build_object('id',g,'requestId',request)) then raise exception 'Repeat request duplicated';end if;
 perform public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',false));
 if uin_private.shared_score_released(g,c,b) then raise exception 'Withdrawn consent still counted';end if;
 if not exists(select 1 from public.seeds where id=copy) then raise exception 'Withdrawing consent deleted history';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 denied:=false;begin perform public.shared_experience_action('detail',jsonb_build_object('id',g));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unrelated user accessed experience';end if;
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;begin perform public.shared_experience_action('list');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unauthenticated access allowed';end if;
 if has_table_privilege('authenticated','uin_private.shared_experience_scores','SELECT') or has_function_privilege('anon','public.shared_experience_action(text,jsonb)','EXECUTE') then raise exception 'Scores or API exposed';end if;
end $$;
select 'Shared experience consent, idempotency, sealed scores, equal-person averages and authorization passed' as result;

do $$
declare target uuid; reviewer uuid; activity uuid; st uuid; sender_seed uuid; own_seed uuid; g uuid; n int:=0; result jsonb;
begin
 select p.id into target from public.profiles p where not public.reputation_is_managed_minor(p.id)
 and (select count(*) from public.profiles other where other.id<>p.id and not public.reputation_is_managed_minor(other.id) and not public.users_are_blocked(p.id,other.id))>=10 limit 1;
 if target is null then raise exception 'Ten-person fixture requires 11 unblocked adult accounts';end if;
 select id into activity from public.activities where lower(name)='concert' limit 1;
 select id into st from public.seed_types where is_active order by sort_order limit 1;
 for reviewer in select id from public.profiles where id<>target and not public.reputation_is_managed_minor(id) and not public.users_are_blocked(target,id) limit 10 loop
  insert into public.seeds(user_id,seed_type_id,title,visibility,status,completed_at,origin,seed_scope) values(reviewer,st,'Konser rozet testi','everyone','completed',now(),'retrospective','private') returning id into sender_seed;
  insert into public.seeds(user_id,seed_type_id,title,visibility,status,completed_at,origin,seed_scope) values(target,st,'Konser rozet testi','everyone','completed',now(),'retrospective','private') returning id into own_seed;
  insert into uin_private.shared_experiences(source_seed_id,owner_id,activity_id,title,date_precision) values(sender_seed,reviewer,activity,'Konser','unknown') returning id into g;
  insert into uin_private.shared_experience_members values(g,reviewer,sender_seed,'accepted',now()-interval '8 days'),(g,target,own_seed,'accepted',now()-interval '8 days');
  insert into uin_private.shared_experience_scores(experience_id,reviewer_id,target_id,score) values(g,reviewer,target,10);
  n:=n+1;
 end loop;
 perform set_config('request.jwt.claim.sub',target::text,true);
 result:=public.shared_experience_action('reputation',jsonb_build_object('userId',target));
 if n<>10 or (result->0->>'people')::int<>10 or result->0->>'badge'<>'Sevilen deneyim arkadaşı' then raise exception 'Ten unique reviewers failed: %',result;end if;
end $$;
select 'ten distinct people earn the contextual badge without multiplying repeat reviewers' as result;

do $$
declare actor uuid:='cbf3108c-058b-4271-ae5e-500c0bccaa7e'; friend uuid:='38150458-cd9b-48d4-9719-2fb049be61cb';
 item uuid; activity uuid; payload jsonb; first_result jsonb; second_result jsonb; original_count int; rejected boolean:=false;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select id into item from public.seed_catalog_items where status='active' limit 1;
 select id into activity from public.activities where lower(name)='concert' limit 1;
 payload:=jsonb_build_object('requestId',gen_random_uuid(),'catalogItemId',item,'activityId',activity,'precision','exact','date',current_date-3,'reflection','Yalnızca yazara ait not','friends',jsonb_build_array(jsonb_build_object('id',friend,'score',9)));
 first_result:=public.shared_experience_action('past',payload);
 if first_result<>public.shared_experience_action('past',payload) then raise exception 'Past experience retry duplicated';end if;
 second_result:=public.shared_experience_action('past',payload||jsonb_build_object('requestId',gen_random_uuid(),'date',current_date-1));
 if first_result->>'seedId'=second_result->>'seedId' or first_result->>'id'=second_result->>'id' then raise exception 'Distinct outings reused history';end if;
 if (select occurred_on from uin_private.shared_experiences where id=(first_result->>'id')::uuid)<>current_date-3 then raise exception 'Occurrence date lost';end if;
 perform set_config('request.jwt.claim.sub',friend::text,true);
 perform public.shared_experience_action('respond',jsonb_build_object('id',first_result->>'id','accept',false));
 if exists(select 1 from uin_private.shared_experience_members where experience_id=(first_result->>'id')::uuid and user_id=friend and seed_id is not null) then raise exception 'Declined invitation created personal history';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select count(*) into original_count from public.seeds where user_id=actor;
 begin
  perform public.shared_experience_action('past',payload||jsonb_build_object('requestId',gen_random_uuid(),'friends',jsonb_build_array(jsonb_build_object('id',actor,'score',10))));
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected or (select count(*) from public.seeds where user_id=actor)<>original_count then raise exception 'Invalid companion left a partial experience';end if;
end $$;
select 'Past experiences retain separate dates, retry safely and roll back invalid submissions' as result;
