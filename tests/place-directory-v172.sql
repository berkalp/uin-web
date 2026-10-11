-- Read-only regression checks against the installed read model.
do $$
declare first_page jsonb;next_page jsonb;filtered jsonb;expected bigint;root uuid;children jsonb;summary jsonb;
begin
 select count(*) into expected from uin_place_directory_v172 where country_code='US';
 first_page:=get_uin_place_directory_v172('US',null,null,'population_desc',100,0);
 next_page:=get_uin_place_directory_v172('US',null,null,'population_desc',100,100);
 assert (first_page->>'total')::bigint=expected and expected>100,'City totals were truncated';
 assert jsonb_array_length(first_page->'nodes')=100 and jsonb_array_length(next_page->'nodes')=100,'Paging lost cities';
 assert not exists(select 1 from jsonb_array_elements(first_page->'nodes') a join jsonb_array_elements(next_page->'nodes') b on a->>'target_id'=b->>'target_id'),'Pages overlap';
 filtered:=get_uin_place_directory_v172('US','CA',null,'population_desc',100,0);
 assert not exists(select 1 from jsonb_array_elements(filtered->'nodes') n where n->>'region_code'<>'CA'),'State filter mixed cities';
 filtered:=get_uin_place_directory_v172('US',null,'Opa-locka','population_desc',100,0);
 assert (filtered->>'total')::int>0,'City outside the old top 100 is missing';
 root:=(filtered->'nodes'->0->>'target_id')::uuid;
 assert exists(select 1 from get_uin_place_level_v123('US',root,null,null,500,0) where target_id=root),'Selected global city is missing';
 for root in select canonical_target_id from uin_place_nodes_v123 where scope='city' and city in ('Ankara','Eskişehir','İstanbul') loop
  children:=get_uin_place_children_v172(root,100,0);
  select s into summary from get_uin_card_summary_v107(array[root]) s;
  assert (children->>'total')::int=(summary->>'child_count')::int,'Badge and linked list disagree';
  assert jsonb_array_length(children->'nodes')=(children->>'total')::int,'Linked records were dropped';
 end loop;
 select canonical_target_id into root from uin_place_nodes_v123 where scope='city' and city='Ankara';
 assert exists(select 1 from jsonb_array_elements(get_uin_place_children_v172(root,100,0)->'nodes') n where n->>'title'='Anıtkabir'),'Anitkabir is disconnected';
end;
$$;
explain (analyze,timing off) select get_uin_place_directory_v172('US',null,null,'population_desc',100,0);
