-- 024_friend_only_intent_invitations.rollback.sql

begin;

-- Restore the previous app entry point before removing the friend-only wrapper.
grant execute on function public.create_intent_invitation(uuid, uuid, text) to authenticated;

drop function if exists public.create_friend_intent_invitation(uuid, uuid, text);
drop function if exists public.get_invitable_friends_for_intent(uuid, text);
drop function if exists public.users_are_accepted_friends(uuid, uuid);
drop function if exists public.current_user_can_manage_intent_invitations(uuid);

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;

commit;
