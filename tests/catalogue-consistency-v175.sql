begin;
set local statement_timeout='3min';
do $test$
declare actor uuid; stranger uuid; target uuid:='760cac36-6d89-4321-afc4-4967d902db4e'; city uuid:='8dd157cd-9d2b-42e0-bca8-f5123fa98fc9'; first_rating jsonb; second_rating jsonb; summary jsonb; catalogue jsonb; suggestion uuid; count_before integer; count_after integer; reviewer uuid;
begin
select user_id into actor from public.seeds where canonical_target_id=target and status='completed' limit 1;
select id into stranger from public.profiles where id<>actor and id not in(select user_id from public.admin_users) limit 1;
assert actor is not null and stranger is not null,'Existing regression actors required';
select r into first_rating from public.get_uin_card_ratings_v85(array[target]) r;
perform set_config('request.jwt.claim.sub',stranger::text,true);
select r into second_rating from public.get_uin_card_ratings_v85(array[target]) r;
assert first_rating->>'average_rating'=second_rating->>'average_rating','Ratings vary by viewer';
assert (first_rating->>'rating_count')::int=1 and (first_rating->>'average_rating')::numeric=10,'Black Rabbit rating incorrect';
-- A private rating must affect only the anonymous aggregate, and never expose the review.
update public.seeds set visibility='only_me' where canonical_target_id=target and user_id=actor;
select r into second_rating from public.get_uin_card_ratings_v85(array[target]) r;
assert first_rating->>'average_rating'=second_rating->>'average_rating' and first_rating->>'rating_count'=second_rating->>'rating_count','Private visibility removed aggregate rating';
assert not exists(select 1 from public.get_uin_card_people_v81(target,'experience',50,0) r where r->>'user_id'=actor::text),'Private review leaked';
-- Check all currently relevant person targets using the exact same card and list sources.
for target in select distinct canonical_target_id from public.seeds where canonical_target_id is not null and status in ('active','completed') loop
 select r into summary from public.get_uin_card_summary_v129(array[target]) r;
 select r into catalogue from public.get_uin_catalogue_for_targets_v123(array[target]) r;
 if catalogue is null then continue;end if;
 assert summary->>'done'=catalogue->>'experience_people_count','Grid/detail completed count mismatch '||target::text;
 assert summary->>'wanting'=catalogue->>'intent_people_count','Grid/detail wish count mismatch';
 assert (summary->>'done')::int=(select count(distinct r->>'user_id') from public.get_uin_card_people_v81(target,'experience',10000,0) r),'Completed count/person list mismatch';
end loop;
select (r->>'done')::int into count_before from public.get_uin_card_summary_v129(array[city]) r;
-- Convert a second existing user to a completed city visitor, then verify all surfaces.
update public.seeds set status='completed',completed_at=now(),archived_at=null where id=(select id from public.seeds where canonical_target_id=city and status='archived' limit 1);
select (r->>'done')::int into count_after from public.get_uin_card_summary_v129(array[city]) r;
assert count_after>=count_before,'Completing a visit reduced city total';
select r into catalogue from public.get_uin_catalogue_for_targets_v123(array[city]) r;
assert (catalogue->>'experience_people_count')::int=count_after,'Updated city grid/detail diverged';
assert not has_function_privilege('anon','public.get_uin_friend_card_scores_v175(uuid[])','execute'),'Anonymous friend projection accessible';
perform public.get_uin_friend_card_scores_v175(array[city]);
suggestion:=public.suggest_seed_catalog_item((select id from public.seed_types where slug='try'),'generic','UIN v175 rollback hobi önerisi',null,null,null,null,'tr','{"content_type_id":"hobby"}'::jsonb);
assert exists(select 1 from public.seed_catalog_items where id=suggestion and status='pending'),'Hobby suggestion missing';
assert exists(select 1 from public.notifications where entity_id=suggestion and notification_type='catalogue_suggestion_submitted'),'Admin notification missing';
select user_id into reviewer from public.admin_users limit 1;
perform set_config('request.jwt.claim.sub',reviewer::text,true);
perform public.admin_review_seed_catalog_item(suggestion,'approve',null);
assert exists(select 1 from public.notifications where entity_id=suggestion and user_id=stranger and notification_type='catalogue_suggestion_reviewed'),'Requester review notification missing';
assert exists(select 1 from public.seed_catalog_items where canonical_title='Gümüş Takı Tasarımı' and status='active'),'Silver jewelry hobby absent';
end;$test$;
rollback;
