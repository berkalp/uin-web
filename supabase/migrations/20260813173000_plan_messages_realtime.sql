begin;

-- Keep web Planning / Activity Room conversations live without requiring
-- manual refresh. Mobile already consumes the same plan_messages rows.
do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication (supabase_realtime) was not found.';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'plan_messages'
  ) then
    alter publication supabase_realtime
      add table public.plan_messages;
  end if;
end;
$$;

commit;
