-- Read-only integration check; no user records are created or changed.
begin;
set local role anon;
do $test$
declare ids uuid[]; total integer; complete boolean; matches boolean;
begin
  select array_agg(canonical_target_id) into ids from (
    select distinct canonical_target_id from public.seed_catalog_items
    where item_kind='series' and status='active' limit 500
  ) sample;
  select count(*),bool_and(row?'experience_like_count' and (row->>'experience_like_count')::bigint>=0)
  into total,complete from public.get_uin_card_social_v87(ids||ids) row;
  if total<>cardinality(ids) or not complete then raise exception 'Incomplete or duplicated category metrics'; end if;
  if exists(select 1 from public.get_uin_card_social_v87(array[]::uuid[])) then raise exception 'Empty request returned cards'; end if;
  with ranked as (select value from jsonb_array_elements(public.get_uin_ranked_placements_v216('likes')) value),
  counts as (select row from public.get_uin_card_social_v87(array(select (value->>'canonical_target_id')::uuid from ranked)) row)
  select bool_and((counts.row->>'experience_like_count')::bigint=(ranked.value->>'sort_value')::bigint)
  into matches from ranked join counts on counts.row->>'target_id'=ranked.value->>'canonical_target_id';
  if not matches then raise exception 'Category likes disagree with the full feed'; end if;
  if has_function_privilege('anon','uin_private.card_experience_likes_v217(uuid[])','execute')
    or has_function_privilege('authenticated','uin_private.card_experience_likes_v217(uuid[])','execute')
    then raise exception 'Private helper is exposed'; end if;
end;
$test$;
rollback;
