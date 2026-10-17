-- /messages/:id is shared by the web route and the native push router.
do $$
declare v_function regprocedure;
begin
  foreach v_function in array array[
    'uin_private.notify_team_support_message()'::regprocedure,
    'uin_private.dispatch_uin_weekend_messages(timestamptz)'::regprocedure
  ] loop
    execute replace(pg_get_functiondef(v_function), '''/direct-message/''', '''/messages/''');
  end loop;
end; $$;
