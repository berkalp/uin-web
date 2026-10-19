-- Run in a transaction; the assertions do not write user records.
set local role anon;
do $test$
declare mode text; batch jsonb; row jsonb; seen uuid[]; last_row jsonb; n integer; prior numeric; score numeric;
begin
 foreach mode in array array['likes','ratingDesc','wanting','done','active'] loop
  seen='{}';last_row=null;prior=null;
  loop
   batch=public.get_uin_ranked_placements_v216(mode,'everyone',null,
     (last_row->>'sort_value')::numeric,(last_row->>'sort_tie')::bigint,
     (last_row->>'last_activity_at')::timestamptz,(last_row->>'canonical_target_id')::uuid);
   n=jsonb_array_length(batch);
   assert n<=21,'page must be bounded';
   for row in select value from jsonb_array_elements(batch) with ordinality e(value,ord) where ord<=20 loop
    assert not ((row->>'canonical_target_id')::uuid=any(seen)),'duplicate card across pages';
    seen=array_append(seen,(row->>'canonical_target_id')::uuid);
    score=(row->>'sort_value')::numeric;
    assert prior is null or score<=prior,'ranking changed order at page boundary';
    prior=score;last_row=row;
   end loop;
   exit when n<=20;
   assert cardinality(seen)<10000,'pagination did not terminate';
  end loop;
  assert cardinality(seen)>20,'test must cover more than the first page';
 end loop;
 assert public.get_uin_ranked_placements_v216('likes','friends')='[]'::jsonb,'anonymous friends scope leaked';
 assert public.get_uin_ranked_placements_v216('likes','me')='[]'::jsonb,'anonymous personal scope leaked';
 assert public.get_uin_ranked_placements_v216('invalid')='[]'::jsonb,'invalid sort accepted';
 assert public.get_uin_ranked_placements_v216('wanting','everyone',array['nonexistent'])='[]'::jsonb,'category filter ignored';
 for row in select value from jsonb_array_elements(public.get_uin_ranked_placements_v216('done','everyone',array['series'])) loop
  assert row->'content_type_ids' ? 'series','wrong category returned';
 end loop;
end;
$test$;
do $test$ begin
 perform set_config('request.jwt.claim.sub',(select user_id::text from public.seeds where status='completed' group by user_id order by count(*) desc limit 1),true);
end; $test$;
set local role authenticated;
do $test$
declare audience text; mode text; batch jsonb; row jsonb; last_row jsonb; expected uuid[]; seen uuid[];
begin
 foreach audience in array array['me','friends'] loop
  expected='{}';last_row=null;
  loop
   batch=public.get_uin_latest_placements_v188((last_row->>'last_activity_at')::timestamptz,(last_row->>'canonical_target_id')::uuid,audience,null);
   for row in select value from jsonb_array_elements(batch) with ordinality e(value,ord) where ord<=20 loop
    expected=array_append(expected,(row->>'canonical_target_id')::uuid);last_row=row;
   end loop;
   exit when jsonb_array_length(batch)<=20;
  end loop;
  foreach mode in array array['likes','ratingDesc','wanting','done','active'] loop
   seen='{}';last_row=null;
   loop
    batch=public.get_uin_ranked_placements_v216(mode,audience,null,(last_row->>'sort_value')::numeric,(last_row->>'sort_tie')::bigint,(last_row->>'last_activity_at')::timestamptz,(last_row->>'canonical_target_id')::uuid);
    for row in select value from jsonb_array_elements(batch) with ordinality e(value,ord) where ord<=20 loop
     assert (row->>'canonical_target_id')::uuid=any(expected),'sort expanded audience visibility';
     seen=array_append(seen,(row->>'canonical_target_id')::uuid);last_row=row;
    end loop;
    exit when jsonb_array_length(batch)<=20;
   end loop;
   assert cardinality(seen)=cardinality(expected),'sort lost scoped cards';
  end loop;
 end loop;
end; $test$;
reset role;
reset role;
-- Existing saved preferences remain compatible; ratings use the card's own projection.
do $test$
declare row jsonb; expected numeric;
begin
 for row in select value from jsonb_array_elements(public.get_uin_ranked_placements_v216('ratingDesc')) loop
  select coalesce((r->>'average_rating')::numeric,0) into expected
    from public.get_uin_card_ratings_v85(array[(row->>'canonical_target_id')::uuid]) r;
  assert expected=(row->>'sort_value')::numeric,'rank and displayed rating disagree';
 end loop;
end;
$test$;
