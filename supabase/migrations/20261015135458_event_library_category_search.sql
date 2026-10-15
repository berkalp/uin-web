-- Additive search endpoint: retain the existing authorization, ownership,
-- lifecycle and ordering rules, applying Library membership before pagination.
do $migration$
declare
  definition text;
  original_signature text := 'public.search_visible_intents(p_query text DEFAULT NULL::text';
  count_marker text := E'  counted_resources as (\n    select\n      filtered_resources.*,\n      count(*) over()::bigint as total_count\n    from filtered_resources\n  )';
begin
  select pg_get_functiondef('public.search_visible_intents(text,uuid,uuid,uuid,uuid,date,date,text,text,integer,integer)'::regprocedure) into definition;
  if position(original_signature in definition)=0 or position(count_marker in definition)=0 then
    raise exception 'Search definition changed; review category insertion before applying.';
  end if;
  definition := replace(definition, original_signature, 'public.search_visible_intents_by_library_category_v185(p_query text DEFAULT NULL::text');
  definition := replace(definition, 'p_offset integer DEFAULT 0)', 'p_offset integer DEFAULT 0, p_library_category text DEFAULT NULL::text)');
  definition := replace(definition, ' SET search_path TO ''public''', E' SET search_path TO ''public''\n SET jit TO ''off''');
  definition := replace(definition, count_marker, $category$
  category_presentations as materialized (
    select p.resource_id, p.presentation
    from public.get_uin_event_presentations_v150(
      array(select coalesce(f.plan_id,f.intent_id) from filtered_resources f
            where nullif(btrim(p_library_category),'') is not null)
    ) p
  ),
  category_sources as materialized (
    select distinct p.resource_id, source.target_id::uuid as target_id
    from category_presentations p
    cross join lateral (
      select p.presentation #>> '{mainTarget,targetId}' as target_id
      union select p.presentation #>> '{primaryDna,targetId}'
      union select card->>'targetId' from jsonb_array_elements(coalesce(p.presentation->'dnaCards','[]'::jsonb)) card
    ) source
    where source.target_id is not null
  ),
  category_memberships as materialized (
    select member->>'target_id' as target_id, member->'content_type_ids' as categories
    from jsonb_array_elements(public.get_uin_card_content_types_v177(
      array(select distinct target_id from category_sources)
    )) member
  ),
  library_filtered_resources as (
    select f.* from filtered_resources f
    where nullif(btrim(p_library_category),'') is null or exists (
      select 1 from category_sources source join category_memberships member
        on member.target_id=source.target_id::text
      where source.resource_id=coalesce(f.plan_id,f.intent_id)
        and member.categories ? p_library_category
    )
  ),
  counted_resources as (
    select library_filtered_resources.*, count(*) over()::bigint as total_count
    from library_filtered_resources
  )
$category$);
  execute definition;
end;
$migration$;

revoke all on function public.search_visible_intents_by_library_category_v185(text,uuid,uuid,uuid,uuid,date,date,text,text,integer,integer,text) from public, anon;
grant execute on function public.search_visible_intents_by_library_category_v185(text,uuid,uuid,uuid,uuid,date,date,text,text,integer,integer,text) to authenticated;
