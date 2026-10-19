begin;
do $test$
declare v_category text; page jsonb; merged jsonb; offset_value integer; expected integer; actual integer; unique_count integer;
begin
 foreach v_category in array array['series','movie','book','game','board_game','artist'] loop
  merged:='[]'::jsonb;offset_value:=0;
  loop
   page:=public.get_uin_type_placements_v177(v_category,200,offset_value);
   merged:=merged||page;
   exit when jsonb_array_length(page)<200;
   offset_value:=offset_value+200;
  end loop;
  select count(*) into expected from public.uin_card_content_types_v177 m
   join public.uin_content_types t on t.id=m.content_type_id and t.active
   join public.canonical_targets c on c.id=m.target_id
   where m.content_type_id=v_category
    and ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
    and exists(select 1 from public.seed_catalog_items i where i.canonical_target_id=m.target_id and i.status='active');
  select count(*),count(distinct value->>'canonical_target_id') into actual,unique_count from jsonb_array_elements(merged);
  if actual<>expected or actual<>unique_count then raise exception 'Missing or duplicate placements in %',v_category; end if;
  if (public.get_uin_type_placements_v177(v_category,1,0)->0) is distinct from (merged->0)
   or (public.get_uin_type_placements_v177(v_category,1,200)->0) is distinct from (merged->200)
   then raise exception 'Pagination order changed in %',v_category; end if;
 end loop;
 if public.get_uin_type_placements_v177('nonexistent_category',200,0)<>'[]'::jsonb
 then raise exception 'Unknown category returned rows'; end if;
end;
$test$;
rollback;
