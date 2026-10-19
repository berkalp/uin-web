-- Reuse the rating projection's existing canonical closure for experience likes.
-- This avoids walking the same hierarchy twice for every card read. All existing
-- rating rules, visibility checks, signatures and permissions are preserved.
CREATE OR REPLACE FUNCTION public.get_uin_card_ratings_v85(p_target_ids uuid[])
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
SET jit TO 'off'
AS $function$
  with requested as materialized (
    select distinct id
    from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)
  ), closure as materialized (
    select tree.requested_id id,tree.target_id
    from public.get_uin_card_closure_v143(
      coalesce((select array_agg(id) from requested),array[]::uuid[]),true
    ) tree
    group by tree.requested_id,tree.target_id
  ), likes as materialized (
    select closure.id,count(*)::bigint total
    from closure
    join public.seeds s on s.canonical_target_id=closure.target_id
    join public.seed_experience_likes l on l.seed_id=s.id
    where public.seed_experience_is_visible_to_viewer(s.id,(select auth.uid()))
      and (coalesce(s.seed_scope,'library')<>'private' or s.user_id=(select auth.uid()))
      and not exists(select 1 from public.seed_catalog_items ci where ci.id=s.catalog_item_id and ci.status='rejected')
    group by closure.id
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
    'experience_like_count',coalesce((select total from likes where likes.id=requested.id),0),
    'average_rating',round(avg(ranked.rating) filter(where rn=1),1),
    'rating_count',count(*) filter(where rn=1),
    'viewer_rating',max(ranked.rating)
      filter(where rn=1 and ranked.user_id=(select auth.uid()))
  )
  from requested left join ranked on ranked.id=requested.id
  group by requested.id;
$function$
;

create or replace function public.get_uin_card_social_v87(p_target_ids uuid[])
returns setof jsonb language sql stable security definer
set search_path to 'public','pg_temp' set jit=off as $function$
  with requested as(select distinct value target_id from unnest(coalesce(p_target_ids,array[]::uuid[])) value),
  followers as(
    select ci.canonical_target_id target_id,count(distinct pref.user_id)::integer follower_count
    from public.uin_card_notification_preferences_v31 pref
    join public.seed_catalog_items ci on ci.id=pref.catalog_item_id
    where pref.is_following and ci.canonical_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
    group by ci.canonical_target_id
  ), ratings as(
    select value from public.get_uin_card_ratings_v85(p_target_ids) value
  ), relations as(
    select target_id,count(*)::integer related_count from(
      select source_target_id target_id from public.uin_card_relations_v87 where source_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
      union all
      select related_target_id target_id from public.uin_card_relations_v87 where related_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
    ) r group by target_id
  )
  select jsonb_build_object(
    'target_id',requested.target_id,
    'follower_count',coalesce(followers.follower_count,0),
    'average_rating',(ratings.value->>'average_rating')::numeric,
    'rating_count',coalesce((ratings.value->>'rating_count')::integer,0),
    'viewer_rating',(ratings.value->>'viewer_rating')::numeric,
    'related_count',coalesce(relations.related_count,0),
    'experience_like_count',coalesce((ratings.value->>'experience_like_count')::bigint,0)
  )
  from requested
  left join followers using(target_id)
  left join ratings on ratings.value->>'target_id'=requested.target_id::text
  left join relations using(target_id);
$function$;
notify pgrst,'reload schema';
