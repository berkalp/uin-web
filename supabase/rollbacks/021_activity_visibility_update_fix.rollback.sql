begin;

-- This rollback removes the repaired write RPC. Use only if the previous
-- database-specific definition will be restored separately.
drop function if exists public.update_activity_visibility(uuid, text);

commit;
