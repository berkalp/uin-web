begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- Every lateral latest-placement lookup remains ordered exactly as before.
-- The existing category index starts with content_type_id and cannot serve
-- these target-id lookups, especially in the large global-place catalogue.
create index if not exists seed_catalog_active_target_latest_v178_idx
on public.seed_catalog_items(canonical_target_id,updated_at desc,id)
where status='active';

-- Preserve the installed definitions, security mode, grants, hierarchy rules
-- and visibility predicates. Viewer identity and admin status are constant
-- within one statement; uncorrelated scalar subqueries allow InitPlans instead
-- of repeating the same checks for every catalogue or recursive child row.
do $patch$
declare fn record; definition text;
begin
  for fn in
    select oid from pg_proc
    where pronamespace='public'::regnamespace
      and proname in (
        'get_uin_card_closure_v143',
        'get_uin_catalogue_for_targets_v123',
        'get_uin_card_people_projection_v143',
        'get_uin_cover_positions_v62'
      )
  loop
    definition:=pg_get_functiondef(fn.oid);
    if position('(select public.is_admin())' in lower(definition))=0 then
      definition:=replace(definition,'public.is_admin()','(select public.is_admin())');
    end if;
    if position('(select auth.uid())' in lower(definition))=0 then
      definition:=replace(definition,'auth.uid()','(select auth.uid())');
    end if;
    execute definition;
  end loop;
end;
$patch$;

-- v175 walked the card closure separately for every requested rating target.
-- One batch walk preserves requested ids, aliases, hidden-child handling and
-- the one-rating-per-person ranking, while avoiding N recursive RPC calls.
create or replace function public.get_uin_card_ratings_v85(p_target_ids uuid[])
returns setof jsonb language sql stable security definer
set search_path=public,pg_temp as $fn$
  with requested as materialized (
    select distinct id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  ), closure as materialized (
    select tree.requested_id id,tree.target_id
    from public.get_uin_card_closure_v143(
      coalesce((select array_agg(id) from requested),array[]::uuid[]),true
    ) tree
    group by tree.requested_id,tree.target_id
  ), ranked as materialized (
    select closure.id,s.user_id,ps.rating,
      row_number() over(partition by closure.id,s.user_id
        order by s.updated_at desc nulls last,s.id) rn
    from closure
    join public.seeds s on s.canonical_target_id=closure.target_id
    join public.seed_personal_state_v15 ps
      on ps.seed_id=s.id and ps.user_id=s.user_id
    where s.status in ('active','completed')
      and (s.status='completed' or ps.relationship_status='completed')
      and ps.rating between 1 and 10
      and not exists(select 1 from public.seed_catalog_items ci
        where ci.id=s.catalog_item_id and ci.status='rejected')
  )
  select jsonb_build_object(
    'target_id',requested.id,
    'average_rating',round(avg(ranked.rating) filter(where rn=1),1),
    'rating_count',count(*) filter(where rn=1),
    'viewer_rating',max(ranked.rating)
      filter(where rn=1 and ranked.user_id=(select auth.uid()))
  )
  from requested left join ranked on ranked.id=requested.id
  group by requested.id;
$fn$;
revoke all on function public.get_uin_card_ratings_v85(uuid[]) from public;
grant execute on function public.get_uin_card_ratings_v85(uuid[]) to anon,authenticated;

analyze public.seed_catalog_items;
notify pgrst,'reload schema';
commit;
