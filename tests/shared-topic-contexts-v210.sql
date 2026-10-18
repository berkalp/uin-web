begin;
do $test$
declare owner_id uuid; learner_id uuid; riding uuid; old_card uuid; merged_card uuid; seed_type uuid; wish1 uuid; wish2 uuid; created uuid; before_count bigint; after_count bigint;
begin
 select user_id into owner_id from public.admin_users order by created_at limit 1;
 select id into learner_id from public.profiles where id<>owner_id order by created_at limit 1;
 select id into riding from public.canonical_targets where title='At Biniciliği' and editorial_metadata->>'merged_into_target_id' is null limit 1;
 if riding is null or learner_id is null then raise exception 'Missing fixture';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 wish1:=public.save_my_contextual_personal_intent_v177(riding,p_visibility=>'everyone',p_content_type_id=>'sport');
 if public.get_my_common_personal_intent_v39(riding)->>'content_type_id'<>'sport' then raise exception 'Edit lost purpose';end if;
 perform set_config('request.jwt.claim.sub',learner_id::text,true);
 wish2:=public.save_my_contextual_personal_intent_v177(riding,p_visibility=>'only_me',p_content_type_id=>'writer');
 if not exists(select 1 from public.get_uin_card_people_v81(riding,'intent',100,0) r where r->>'user_id'=learner_id::text and r->'intent_contexts' @> '[{"id":"writer"}]'::jsonb) then raise exception 'Learner cannot see own purpose';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.get_uin_card_intent_contexts_v210(array[riding]) where user_id=learner_id) then raise exception 'Private purpose leaked';end if;
 if not exists(select 1 from public.get_uin_card_intent_contexts_v210(array[riding]) where user_id=owner_id and content_type_id='sport') then raise exception 'Public sports purpose missing';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 select id,(editorial_metadata->>'merged_into_target_id')::uuid into old_card,merged_card from public.canonical_targets where title='Camping' and editorial_metadata->>'merged_into_target_id' is not null;
 wish1:=public.save_my_contextual_personal_intent_v177(old_card,p_content_type_id=>'activity');
 wish2:=public.save_my_contextual_personal_intent_v177(merged_card,p_content_type_id=>'hobby');
 if wish1<>wish2 then raise exception 'Old link duplicated wish';end if;
 select id into seed_type from public.seed_types where slug='try' and is_active limit 1;
 select count(*) into before_count from public.canonical_targets;
 created:=public.admin_create_uin_card_v59(seed_type,'activity','Camping');
 select count(*) into after_count from public.canonical_targets;
 if created<>merged_card or before_count<>after_count then raise exception 'Alias created duplicate topic';end if;
end;$test$;
rollback;
select 'PASS: shared identity, saved purpose, private visibility, old links and duplicate creation' result;

