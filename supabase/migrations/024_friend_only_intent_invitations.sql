-- 024_friend_only_intent_invitations.sql
-- Keeps the invitation picker centered via UI portal and restricts direct Intent invitations
-- to accepted friends of the host/co-host who sends the invitation.

begin;

create or replace function public.current_user_can_manage_intent_invitations(
  p_intent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.intents intent
      where intent.id = p_intent_id
        and (
          intent.user_id = auth.uid()
          or exists (
            select 1
            from public.plan_intents link
            join public.plans plan
              on plan.id = link.plan_id
            where link.intent_id = intent.id
              and link.status = 'active'
              and (
                plan.host_user_id = auth.uid()
                or exists (
                  select 1
                  from public.plan_members member
                  where member.plan_id = plan.id
                    and member.user_id = auth.uid()
                    and member.status = 'active'
                    and member.role in ('host', 'co_host')
                )
              )
          )
        )
    );
$$;

create or replace function public.users_are_accepted_friends(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_first_user_id is not null
    and p_second_user_id is not null
    and p_first_user_id <> p_second_user_id
    and exists (
      select 1
      from public.friendships friendship
      where friendship.status = 'accepted'
        and (
          (
            friendship.requester_user_id = p_first_user_id
            and friendship.addressee_user_id = p_second_user_id
          )
          or (
            friendship.requester_user_id = p_second_user_id
            and friendship.addressee_user_id = p_first_user_id
          )
        )
    );
$$;

create or replace function public.get_invitable_friends_for_intent(
  p_intent_id uuid,
  p_query text default null
)
returns table(
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  city text,
  country text,
  invitation_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.current_user_can_manage_intent_invitations(p_intent_id) then
    raise exception 'You cannot manage invitations for this Intent.';
  end if;

  return query
  with accepted_friend_ids as (
    select distinct
      case
        when friendship.requester_user_id = auth.uid()
          then friendship.addressee_user_id
        else friendship.requester_user_id
      end as friend_user_id
    from public.friendships friendship
    where friendship.status = 'accepted'
      and (
        friendship.requester_user_id = auth.uid()
        or friendship.addressee_user_id = auth.uid()
      )
  )
  select
    profile.id::uuid as user_id,
    profile.full_name::text as full_name,
    profile.username::text as username,
    profile.avatar_url::text as avatar_url,
    profile.city::text as city,
    profile.country::text as country,
    latest_invitation.invitation_status::text as invitation_status
  from accepted_friend_ids accepted_friend
  join public.profiles profile
    on profile.id = accepted_friend.friend_user_id
  left join lateral (
    select
      case
        when invitation.status = 'pending'
          and invitation.expires_at is not null
          and invitation.expires_at <= now()
          then 'expired'
        else invitation.status::text
      end as invitation_status
    from public.intent_invitations invitation
    where invitation.intent_id = p_intent_id
      and invitation.invited_user_id = profile.id
    order by invitation.created_at desc
    limit 1
  ) latest_invitation
    on true
  where public.user_is_eligible_for_intent(
    p_intent_id,
    profile.id
  )
    and (
      v_query is null
      or coalesce(profile.full_name, '') ilike '%' || v_query || '%'
      or coalesce(profile.username, '') ilike '%' || v_query || '%'
      or coalesce(profile.city, '') ilike '%' || v_query || '%'
      or coalesce(profile.country, '') ilike '%' || v_query || '%'
    )
  order by
    case
      when latest_invitation.invitation_status in ('pending', 'accepted')
        then 1
      else 0
    end,
    lower(coalesce(profile.full_name, profile.username, '')),
    profile.id
  limit 200;
end;
$$;

create or replace function public.create_friend_intent_invitation(
  p_intent_id uuid,
  p_invited_user_id uuid,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.current_user_can_manage_intent_invitations(p_intent_id) then
    raise exception 'You cannot manage invitations for this Intent.';
  end if;

  if not public.users_are_accepted_friends(
    auth.uid(),
    p_invited_user_id
  ) then
    raise exception 'Intent invitations can only be sent to accepted friends.';
  end if;

  if not public.user_is_eligible_for_intent(
    p_intent_id,
    p_invited_user_id
  ) then
    raise exception 'This friend does not match the Intent participant eligibility rule.';
  end if;

  perform public.create_intent_invitation(
    p_intent_id,
    p_invited_user_id,
    nullif(trim(coalesce(p_message, '')), '')
  );
end;
$$;

comment on function public.get_invitable_friends_for_intent(uuid, text) is
  'Returns accepted friends the current host/co-host may invite to an Intent, including the latest invitation state.';
comment on function public.create_friend_intent_invitation(uuid, uuid, text) is
  'Creates an Intent invitation only when the invited user is an accepted friend of the current host/co-host and satisfies participation eligibility.';

revoke all on function public.current_user_can_manage_intent_invitations(uuid) from public;
revoke all on function public.users_are_accepted_friends(uuid, uuid) from public;
revoke all on function public.get_invitable_friends_for_intent(uuid, text) from public;
revoke all on function public.create_friend_intent_invitation(uuid, uuid, text) from public;

grant execute on function public.current_user_can_manage_intent_invitations(uuid) to authenticated;
grant execute on function public.users_are_accepted_friends(uuid, uuid) to authenticated;
grant execute on function public.get_invitable_friends_for_intent(uuid, text) to authenticated;
grant execute on function public.create_friend_intent_invitation(uuid, uuid, text) to authenticated;

-- The old unrestricted RPC is no longer callable by app users. The new security-definer
-- wrapper above remains able to call it as the function owner after checking friendship.
revoke all on function public.create_intent_invitation(uuid, uuid, text) from public;
revoke execute on function public.create_intent_invitation(uuid, uuid, text) from authenticated;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;

commit;
