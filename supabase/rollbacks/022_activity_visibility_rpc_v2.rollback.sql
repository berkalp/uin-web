begin;

drop function if exists public.set_activity_visibility_v2(uuid, text);

notify pgrst, 'reload schema';

commit;
