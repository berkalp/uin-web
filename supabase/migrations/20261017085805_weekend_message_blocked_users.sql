do $$
declare v_definition text;
begin
  v_definition:=pg_get_functiondef('uin_private.dispatch_uin_weekend_messages(timestamptz)'::regprocedure);
  if position('where p.id<>v_sender' in v_definition)=0 then raise exception 'Unexpected dispatcher definition'; end if;
  execute replace(v_definition,'where p.id<>v_sender','where p.id<>v_sender and not public.users_are_blocked(v_sender,p.id)');
  v_definition:=pg_get_functiondef('uin_private.notify_team_support_message()'::regprocedure);
  execute replace(v_definition,'if new.sender_id not in',
    'if public.users_are_blocked(v_channel.sender_user_id,v_channel.recipient_user_id) then return new; end if; if new.sender_id not in');
  v_definition:=pg_get_functiondef('public.direct_conversation_user_can_send(uuid,uuid)'::regprocedure);
  execute replace(v_definition,'select * into v_access',
    'if exists(select 1 from uin_private.team_support_conversations c where c.conversation_id=p_conversation_id and public.users_are_blocked(c.sender_user_id,c.recipient_user_id)) then return false; end if; select * into v_access');
end; $$;
