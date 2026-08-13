begin;

-- The mobile bell and Notifications screen subscribe to public.notifications.
-- Ensure the table is part of the Supabase Realtime publication.
do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime
      add table public.notifications;
  end if;
end;
$realtime$;

notify pgrst, 'reload schema';

commit;
