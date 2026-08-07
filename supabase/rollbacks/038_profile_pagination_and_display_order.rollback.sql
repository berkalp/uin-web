begin;

drop function if exists public.get_visible_profile_display_order(uuid);
drop function if exists public.set_my_profile_display_order(text, uuid[]);
drop table if exists public.profile_display_orders;

commit;
