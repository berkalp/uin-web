begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Remove translations installed by this migration without touching other namespaces.
do $$
begin
  if to_regclass('public.translation_values') is not null
     and to_regclass('public.translation_keys') is not null then
    delete from public.translation_values translation_value
    using public.translation_keys translation_key
    where translation_value.translation_key_id = translation_key.id
      and translation_key.namespace = 'seeds';

    delete from public.translation_keys translation_key
    where translation_key.namespace = 'seeds';
  end if;
end;
$$;

drop function if exists public.admin_delete_seed_type(uuid);
drop function if exists public.admin_upsert_seed_type(uuid, text, text, text, text, boolean, integer, uuid[]);
drop function if exists public.get_admin_seed_types();
drop function if exists public.get_my_seed_growth_context(uuid);
drop function if exists public.link_my_seed_to_intent(uuid, uuid, text);
drop function if exists public.delete_my_seed(uuid);
drop function if exists public.set_my_seed_status(uuid, text);
drop function if exists public.update_my_seed(uuid, uuid, text, text, text, text, text, text, text, date);
drop function if exists public.create_my_seed(uuid, text, text, text, text, text, text, text, date);
drop function if exists public.get_visible_profile_seeds(uuid, integer);
drop function if exists public.get_my_seed(uuid);
drop function if exists public.get_my_seeds(text);
drop function if exists public.get_active_seed_types();
drop function if exists public.normalize_seed_url(text);
drop function if exists public.seed_is_visible_to_viewer(uuid, text, uuid);

drop table if exists public.seed_intent_links cascade;
drop table if exists public.seed_links cascade;
drop table if exists public.seeds cascade;
drop table if exists public.seed_type_activity_suggestions cascade;
drop table if exists public.seed_types cascade;

drop function if exists public.touch_seed_catalogue_updated_at();

commit;
