-- Execute with the migration inside BEGIN/ROLLBACK. All invitations, scores and personal records roll back.
do $$
declare owner_id uuid:='cbf3108c-058b-4271-ae5e-500c0bccaa7e'; friend_id uuid:='38150458-cd9b-48d4-9719-2fb049be61cb';
 third_id uuid:='40f34b94-494a-491b-9684-362f33125320'; item public.seed_catalog_items%rowtype; seed uuid; g uuid; copy uuid; ctx jsonb; result jsonb; rejected boolean; wrong uuid; i int;
begin
 select * into item from public.seed_catalog_items where canonical_title='Gibi' and status='active' limit 1;
 if item.id is null then raise exception 'Gibi fixture missing';end if;
 select id into wrong from public.activities where name='Concert' limit 1;
 if not public.are_users_friends(owner_id,friend_id) then insert into public.friendships(requester_user_id,addressee_user_id,status) values(owner_id,friend_id,'accepted');end if;
 for i in 1..2 loop
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  insert into public.seeds(user_id,seed_type_id,title,status,visibility,completed_at,origin,catalog_item_id,canonical_target_id,completed_date_precision)
  values(owner_id,item.seed_type_id,item.canonical_title,'completed','everyone',now(),'retrospective',item.id,item.canonical_target_id,'unknown') returning id into seed;
  perform public.save_my_seed_v17_state(seed,'completed','unknown',null,null,null,9);
  result:=public.shared_experience_action('options',jsonb_build_object('seedId',seed));ctx:=result->'context';
  if ctx->>'key'<>'series:watch' or ctx->>'question'<>'Kiminle izledin?' or jsonb_array_length(result->'activities')<>1 then raise exception 'Wrong series context: %',result;end if;
  rejected:=false;
  begin perform public.shared_experience_action('save',jsonb_build_object('seedId',seed,'activityId',wrong,'friends',jsonb_build_array(jsonb_build_object('id',friend_id,'score',10))));exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Unrelated activity was accepted';end if;
  result:=public.shared_experience_action('save',jsonb_build_object('seedId',seed,'friends',jsonb_build_array(jsonb_build_object('id',friend_id,'score',case when i=1 then 10 else 8 end))));g:=(result->>'id')::uuid;
  if (select count(*) from uin_private.shared_experiences where source_seed_id=seed)<>1 then raise exception 'Duplicate shared record';end if;
  if (select seed_id from uin_private.shared_experience_members where experience_id=g and user_id=friend_id) is not null then raise exception 'Personal experience created without consent';end if;
  if (select context->>'key' from uin_private.shared_experiences where id=g)<>'series:watch' then raise exception 'Context snapshot missing';end if;
  perform set_config('request.jwt.claim.sub',third_id::text,true);rejected:=false;
  begin perform public.shared_experience_action('detail',jsonb_build_object('id',g));exception when insufficient_privilege then rejected:=true;end;
  if not rejected then raise exception 'Unrelated person accessed invitation';end if;
  perform set_config('request.jwt.claim.sub',friend_id::text,true);
  result:=public.shared_experience_action('detail',jsonb_build_object('id',g));
  if result->>'ownerRating'<>'9' or result->'context'->>'peerRole'<>'Dizi izleyicisi' then raise exception 'Invitation context/rating missing';end if;
  if uin_private.shared_score_released(g,owner_id,friend_id) then raise exception 'Unconfirmed peer score released';end if;
  rejected:=false;begin perform public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',true,'rating',11));exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Invalid experience rating accepted';end if;
  result:=public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',true,'rating',7,'note','Kendi izleme yorumum'));copy:=(result->>'seedId')::uuid;
  if (select rating from public.seed_personal_state_v15 where seed_id=copy)<>7 then raise exception 'Own rating was not saved independently';end if;
  if public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',true,'rating',8))->>'seedId'<>copy::text then raise exception 'Acceptance retry duplicated record';end if;
  if (select rating from public.seed_personal_state_v15 where seed_id=copy)<>7 then raise exception 'Retry modified own rating';end if;
  if (select canonical_target_id from public.seeds where id=copy)<>item.canonical_target_id then raise exception 'Canonical identity lost';end if;
  perform public.shared_experience_action('rate',jsonb_build_object('id',g,'targetId',owner_id,'score',10));
  if not uin_private.shared_score_released(g,owner_id,friend_id) then raise exception 'Mutual score did not release';end if;
 end loop;
 result:=public.shared_experience_action('reputation',jsonb_build_object('userId',friend_id));
 if not exists(select 1 from jsonb_array_elements(result)x where x->>'activityId'='series:watch' and x->>'activity'='Dizi izleyicisi' and (x->>'score')::numeric=9 and (x->>'people')::int=1 and (x->>'experiences')::int=2) then raise exception 'Per-person contextual reputation is wrong: %',result;end if;
 perform public.shared_experience_action('respond',jsonb_build_object('id',g,'accept',false));
 if uin_private.shared_score_released(g,owner_id,friend_id) or not exists(select 1 from public.seeds where id=copy) then raise exception 'Withdrawal did not preserve personal history/remove score';end if;
 if has_function_privilege('anon','public.shared_experience_action(text,jsonb)','EXECUTE') or has_table_privilege('authenticated','uin_private.shared_experience_scores','SELECT') then raise exception 'Private scores exposed';end if;
 perform set_config('request.jwt.claim.sub','',true);rejected:=false;begin perform public.shared_experience_action('list');exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Unauthenticated API access';end if;
end $$;
select 'Context binding, consent, own rating, reciprocal peer rating, identity, idempotency and per-person averages passed' as result;
