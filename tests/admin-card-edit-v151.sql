begin;
do $$
declare
  admin_id uuid;
  read_seed_type uuid;
  first_id uuid:=gen_random_uuid();
  second_id uuid:=gen_random_uuid();
  first_target uuid;
  second_target uuid;
  distinct_first uuid:=gen_random_uuid();
begin
  select user_id into admin_id from public.admin_users order by user_id limit 1;
  select id into read_seed_type from public.seed_types where is_active and slug~*'(read|oku|book)' order by id limit 1;
  if admin_id is null or read_seed_type is null then raise exception 'Admin or read seed type fixture missing.';end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);

  insert into public.seed_catalog_items(id,seed_type_id,item_kind,canonical_title,creator_name,metadata,status,created_by)
  values(first_id,read_seed_type,'book','Rollback same target edit v151','Regression Author','{"content_type_id":"book"}', 'active',admin_id);
  insert into public.seed_catalog_items(id,seed_type_id,item_kind,canonical_title,creator_name,metadata,status,created_by)
  values(second_id,read_seed_type,'book','Rollback same target edit v151','Regression Author','{"content_type_id":"book"}', 'active',admin_id);
  select canonical_target_id into first_target from public.seed_catalog_items where id=first_id;
  select canonical_target_id into second_target from public.seed_catalog_items where id=second_id;
  if first_target is null or first_target is distinct from second_target then raise exception 'Same work did not resolve to one canonical target.';end if;

  update public.seed_catalog_items set cover_url='https://example.com/updated.jpg' where id=second_id;

  insert into public.seed_catalog_items(id,seed_type_id,item_kind,canonical_title,metadata,status,created_by)
  values(distinct_first,read_seed_type,'activity','Rollback distinct target collision v151','{"content_type_id":"activity"}','active',admin_id);
  begin
    insert into public.seed_catalog_items(seed_type_id,item_kind,canonical_title,metadata,status,created_by)
    values(read_seed_type,'activity','Rollback distinct target collision v151','{"content_type_id":"activity"}','active',admin_id);
    raise exception 'Distinct duplicate unexpectedly accepted.';
  exception when unique_violation then null;
  end;
end;
$$;
rollback;
select 'Same canonical card placements can be edited; distinct duplicate cards remain blocked.' as result;