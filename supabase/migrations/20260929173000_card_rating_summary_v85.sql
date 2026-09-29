begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

create or replace function public.get_uin_card_ratings_v85(p_target_ids uuid[])
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested as (
    select distinct value as requested_id
    from unnest(coalesce(p_target_ids, array[]::uuid[])) value
  ), closure as materialized (
    select requested.requested_id, descendants.target_id
    from requested
    cross join lateral public.get_uin_card_descendants_v81(requested.requested_id, true) descendants
  ), ranked as materialized (
    select closure.requested_id, visible.user_id, state.rating,
      row_number() over (
        partition by closure.requested_id, visible.user_id
        order by seed.updated_at desc nulls last, visible.source_id
      ) as rn
    from closure
    join public.visible_common_target_people_v38() visible on visible.target_id = closure.target_id
    join public.seed_personal_state_v15 state
      on visible.source_kind = 'seed'
      and state.seed_id = visible.source_id
      and state.user_id = visible.user_id
    join public.seeds seed on seed.id = visible.source_id
    where visible.relationship_status = 'completed'
      and state.rating between 1 and 10
  )
  select jsonb_build_object(
    'target_id', requested.requested_id,
    'average_rating', round(avg(ranked.rating) filter (where ranked.rn = 1), 1),
    'rating_count', count(*) filter (where ranked.rn = 1),
    'viewer_rating', max(ranked.rating) filter (where ranked.rn = 1 and ranked.user_id = auth.uid())
  )
  from requested
  left join ranked on ranked.requested_id = requested.requested_id
  group by requested.requested_id;
$$;

revoke all on function public.get_uin_card_ratings_v85(uuid[]) from public;
grant execute on function public.get_uin_card_ratings_v85(uuid[]) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
