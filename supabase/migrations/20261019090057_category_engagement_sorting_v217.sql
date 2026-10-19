-- Extend the existing card projection with visible experience likes. No records
-- or canonical identities are changed. The helper has no client EXECUTE grant.
create or replace function uin_private.card_experience_likes_v217(p_target_ids uuid[])
returns table(target_id uuid, experience_like_count bigint)
language sql stable security invoker set search_path='' as $fn$
  with tree as materialized (
    select distinct requested_id,target_id
    from public.get_uin_card_closure_v143(coalesce(p_target_ids,array[]::uuid[]),true)
  ), liked_seeds as materialized (
    select s.id,s.canonical_target_id,count(*) n
    from public.seed_experience_likes l join public.seeds s on s.id=l.seed_id
    where s.canonical_target_id in (select tree.target_id from tree)
      and public.seed_experience_is_visible_to_viewer(s.id,(select auth.uid()))
      and (coalesce(s.seed_scope,'library')<>'private' or s.user_id=(select auth.uid()))
      and not exists(select 1 from public.seed_catalog_items ci where ci.id=s.catalog_item_id and ci.status='rejected')
    group by s.id,s.canonical_target_id
  )
  select tree.requested_id,sum(s.n)::bigint
  from tree join liked_seeds s on s.canonical_target_id=tree.target_id
  group by tree.requested_id;
$fn$;
revoke all on function uin_private.card_experience_likes_v217(uuid[]) from public,anon,authenticated;

-- Preserve the existing public function's signature, ownership and grants.
create or replace function public.get_uin_card_social_v87(p_target_ids uuid[])
returns setof jsonb language sql stable security definer
set search_path to 'public','pg_temp' as $function$
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
  ), likes as(
    select * from uin_private.card_experience_likes_v217(p_target_ids)
  )
  select jsonb_build_object(
    'target_id',requested.target_id,
    'follower_count',coalesce(followers.follower_count,0),
    'average_rating',(ratings.value->>'average_rating')::numeric,
    'rating_count',coalesce((ratings.value->>'rating_count')::integer,0),
    'viewer_rating',(ratings.value->>'viewer_rating')::numeric,
    'related_count',coalesce(relations.related_count,0),
    'experience_like_count',coalesce(likes.experience_like_count,0)
  )
  from requested
  left join followers using(target_id)
  left join ratings on ratings.value->>'target_id'=requested.target_id::text
  left join relations using(target_id)
  left join likes using(target_id);
$function$;
notify pgrst,'reload schema';
