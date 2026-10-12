begin;
do $test$
declare viewer uuid; duplicate jsonb; added jsonb;
begin
select id into viewer from public.profiles where id not in (select user_id from public.admin_users) limit 1;
perform set_config('request.jwt.claim.sub',viewer::text,true);
duplicate:=public.find_uin_duplicate_v73('The Mentalist','series','');
if duplicate is null then
select to_jsonb(r) into added from public.add_verified_seed_catalog_item_v42((select id from seed_types where slug='watch'),'series','The Mentalist',null,null,'tvmaze','116','https://www.tvmaze.com/shows/116/the-mentalist','{"content_type_id":"series"}'::jsonb) r;
assert added->>'catalog_item_id' is not null,'TVmaze import failed';
end if;
duplicate:=public.find_uin_duplicate_v73('The Mentalist','series','');
assert duplicate->>'catalogItemId' is not null,'Indexed duplicate check did not return the existing catalogue identity';
end;$test$;
rollback;
