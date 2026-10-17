-- Preserve the existing webhook URL and authentication headers without exposing
-- them in a migration or result. A cold Edge invocation can exceed one second.
do $$
declare v_definition text; v_updated text;
begin
  select pg_get_triggerdef(oid) into v_definition from pg_trigger
  where tgrelid='public.notifications'::regclass and tgname='uin-push-notifications';
  if v_definition is null then raise exception 'Push webhook is not configured'; end if;
  v_updated:=regexp_replace(v_definition, ', ''[0-9]+''\)$', ', ''10000'')');
  if v_updated=v_definition then raise exception 'Unexpected push webhook timeout argument'; end if;
  execute 'drop trigger "uin-push-notifications" on public.notifications';
  execute v_updated;
end; $$;
