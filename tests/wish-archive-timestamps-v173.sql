-- Exercise the failing Star Trek transition against live records, then roll everything back.
begin;
create temp table wish_seed_before_v173 as select id, to_jsonb(s) as row from public.seeds s where canonical_target_id in (select canonical_target_id from public.seeds where title='Star Trek' and status='active');
create temp table wish_intent_before_v173 as select id,to_jsonb(i) as row from public.canonical_personal_intents_v38 i where target_id in (select (row->>'canonical_target_id')::uuid from wish_seed_before_v173);
do $$
declare wish public.seeds%rowtype; before_completed jsonb; stamp timestamptz; rejected boolean:=false;
begin
 select s.* into wish from public.seeds s where title='Star Trek' and status='active' and coalesce((select relationship_status from public.seed_personal_state_v15 where seed_id=s.id and user_id=s.user_id),'want') in ('want','in_progress') limit 1;
 assert wish.id is not null,'Star Trek regression fixture missing';
 assert has_function_privilege('authenticated','public.archive_my_common_wish_v73(uuid)','execute'),'Authenticated caller cannot cancel';
 assert not has_function_privilege('anon','public.archive_my_common_wish_v73(uuid)','execute'),'Anonymous cancellation must be denied';
 perform set_config('request.jwt.claim.sub',wish.user_id::text,true);
 perform public.archive_my_common_wish_v73(wish.canonical_target_id);
 assert (select status='archived' and archived_at is not null and completed_at is null from public.seeds where id=wish.id),'Wish lifecycle is inconsistent';
 assert not exists(select 1 from public.canonical_personal_intents_v38 where target_id=wish.canonical_target_id and user_id=wish.user_id and status='active'),'Personal wish remained active';
 assert not exists(select 1 from public.seeds s join wish_seed_before_v173 b using(id) where (s.user_id<>wish.user_id or b.row->>'status'='completed') and to_jsonb(s)<>b.row),'Another user or an experience was modified';
 assert not exists(select 1 from public.canonical_personal_intents_v38 i join wish_intent_before_v173 b using(id) where i.user_id<>wish.user_id and to_jsonb(i)<>b.row),'Another user intent was modified';
 select archived_at into stamp from public.seeds where id=wish.id;
 perform public.archive_my_common_wish_v73(wish.canonical_target_id);
 assert (select archived_at=stamp from public.seeds where id=wish.id),'Repeated cancellation changed archive history';
 -- A completed experience for the same card must survive the same cancellation RPC.
 update public.seeds set status='completed',completed_at=now(),archived_at=null where id=wish.id;
 select to_jsonb(s) into before_completed from public.seeds s where id=wish.id;
 perform public.archive_my_common_wish_v73(wish.canonical_target_id);
 assert (select to_jsonb(s)=before_completed from public.seeds s where id=wish.id),'Completed experience was lost';
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.archive_my_common_wish_v73(wish.canonical_target_id);exception when insufficient_privilege then rejected:=true;end;
 assert rejected,'Unauthenticated cancellation was accepted';
end;
$$;
rollback;
