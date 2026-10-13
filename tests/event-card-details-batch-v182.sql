begin;
set local role anon;
do $$
declare rows_count integer; payload jsonb;
begin
  select count(*),min(detail::text)::jsonb into rows_count,payload
  from public.get_visible_event_card_details_batch_v182(array[
    '434e4a9f-3e42-4c31-87c9-096ec36aa6aa'::uuid,
    '434e4a9f-3e42-4c31-87c9-096ec36aa6aa'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  ]);
  assert rows_count=1,'Duplicate and unavailable IDs must not create cards';
  assert payload=public.get_activity_detail_page('434e4a9f-3e42-4c31-87c9-096ec36aa6aa'::uuid),'Batch must preserve the original visibility reader exactly';
  assert payload->'activity'->>'activity_name'='Festival','Use the real activity name';
  assert payload->'activity'->'meeting_point'='null'::jsonb,'Visitors must not receive private meeting points';
  assert (select count(*)=0 from public.get_visible_event_card_details_batch_v182(array[]::uuid[])),'Empty input must be empty';
end $$;
rollback;
