begin;

-- Owner-only complete connection lists for the Timeline profile center.
-- Public profile visibility rules remain unchanged: this RPC only returns
-- the authenticated user's own followers, following and accepted friends.

create or replace function public.get_my_profile_connections()
returns table (
  connection_type text,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  city text,
  country text,
  connected_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(v_user_id, 'account_access');

  return query
  select
    combined.connection_type,
    combined.user_id,
    combined.full_name,
    combined.username,
    combined.avatar_url,
    combined.city,
    combined.country,
    combined.connected_at
  from (
    select
      'follower'::text as connection_type,
      profile.id as user_id,
      profile.full_name,
      profile.username,
      profile.avatar_url,
      profile.city,
      profile.country,
      follow_record.created_at as connected_at
    from public.profile_follows follow_record
    join public.profiles profile
      on profile.id = follow_record.follower_user_id
    where follow_record.followed_user_id = v_user_id
      and not public.users_are_blocked(v_user_id, profile.id)

    union all

    select
      'following'::text as connection_type,
      profile.id as user_id,
      profile.full_name,
      profile.username,
      profile.avatar_url,
      profile.city,
      profile.country,
      follow_record.created_at as connected_at
    from public.profile_follows follow_record
    join public.profiles profile
      on profile.id = follow_record.followed_user_id
    where follow_record.follower_user_id = v_user_id
      and not public.users_are_blocked(v_user_id, profile.id)

    union all

    select
      'friend'::text as connection_type,
      profile.id as user_id,
      profile.full_name,
      profile.username,
      profile.avatar_url,
      profile.city,
      profile.country,
      coalesce(friendship.responded_at, friendship.created_at) as connected_at
    from public.friendships friendship
    join public.profiles profile
      on profile.id = case
        when friendship.requester_user_id = v_user_id
          then friendship.addressee_user_id
        else friendship.requester_user_id
      end
    where friendship.status = 'accepted'
      and (
        friendship.requester_user_id = v_user_id
        or friendship.addressee_user_id = v_user_id
      )
      and not public.users_are_blocked(v_user_id, profile.id)
  ) combined
  order by
    combined.connected_at desc,
    combined.username nulls last,
    combined.user_id;
end;
$function$;

revoke all
on function public.get_my_profile_connections()
from public;

revoke all
on function public.get_my_profile_connections()
from anon;

grant execute
on function public.get_my_profile_connections()
to authenticated;

commit;
