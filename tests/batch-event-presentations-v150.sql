-- Run after 202610090002_batch_event_presentations_v150.sql.
-- Read-only semantic and latency audit for the mobile event-presentation batch.
do $audit$
declare
  v_ids uuid[];
  v_mismatches integer;
  v_duplicates integer;
  v_started_at timestamptz;
  v_elapsed_ms numeric;
begin
  select coalesce(array_agg(sample.id order by sample.updated_at desc,sample.id),array[]::uuid[])
  into v_ids
  from (
    select intent.id,intent.updated_at
    from public.intents intent
    order by intent.updated_at desc,intent.id
    limit 60
  ) sample;

  with expected as materialized (
    select requested.id resource_id,
      public.get_uin_event_presentation_v86(requested.id) presentation
    from unnest(v_ids) requested(id)
  ), actual as materialized (
    select batch.resource_id,batch.presentation
    from public.get_uin_event_presentations_v150(v_ids) batch
  )
  select count(*)
  into v_mismatches
  from expected
  full join actual using(resource_id)
  where expected.presentation is distinct from actual.presentation;

  if v_mismatches<>0 then
    raise exception 'v150 batch differs from v86 for % requested resources.',v_mismatches;
  end if;

  select count(*)-count(distinct batch.resource_id)
  into v_duplicates
  from public.get_uin_event_presentations_v150(v_ids||v_ids) batch;

  if v_duplicates<>0 then
    raise exception 'v150 returned % duplicate resources.',v_duplicates;
  end if;

  v_started_at:=clock_timestamp();
  perform count(*) from public.get_uin_event_presentations_v150(v_ids);
  v_elapsed_ms:=extract(epoch from clock_timestamp()-v_started_at)*1000;

  if v_elapsed_ms>5000 then
    raise exception 'v150 batch exceeded the 5 second startup budget: % ms.',round(v_elapsed_ms,1);
  end if;

  raise notice 'v150 batch audit passed for % resources in % ms.',cardinality(v_ids),round(v_elapsed_ms,1);
end;
$audit$;
