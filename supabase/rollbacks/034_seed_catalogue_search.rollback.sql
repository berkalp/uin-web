begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

do $$
begin
  if to_regclass('public.translation_values') is not null
     and to_regclass('public.translation_keys') is not null then
    delete from public.translation_values value
    using public.translation_keys key
    where value.translation_key_id = key.id
      and key.namespace = 'seed-catalogue';

    delete from public.translation_keys
    where namespace = 'seed-catalogue';
  end if;
end;
$$;

drop trigger if exists validate_seed_catalogue_link_trigger on public.seeds;
drop trigger if exists touch_seed_experience_comments_updated_at_trigger on public.seed_experience_comments;
drop trigger if exists touch_seed_catalog_editions_updated_at_trigger on public.seed_catalog_editions;
drop trigger if exists prepare_seed_catalog_alias_trigger on public.seed_catalog_aliases;
drop trigger if exists sync_seed_catalog_item_aliases_trigger on public.seed_catalog_items;
drop trigger if exists prepare_seed_catalog_item_trigger on public.seed_catalog_items;

drop function if exists public.admin_merge_seed_catalog_items(uuid, uuid);
drop function if exists public.admin_review_seed_catalog_item(uuid, text, uuid);
drop function if exists public.get_admin_seed_catalog_items(text, text, integer);
drop function if exists public.get_seed_experience_comments(uuid, integer, integer);
drop function if exists public.delete_my_seed_experience_comment(uuid);
drop function if exists public.add_seed_experience_comment(uuid, text, text, uuid);
drop function if exists public.set_my_seed_experience_reaction(uuid, text, boolean);
drop function if exists public.get_seed_experience_engagement_context(uuid[]);
drop function if exists public.set_my_seed_experience_comment_policy(uuid, text);
drop function if exists public.can_comment_on_seed_experience(uuid, uuid);
drop function if exists public.seed_experience_is_visible_to_viewer(uuid, uuid);
drop function if exists public.admin_upsert_seed_catalog_item(uuid, uuid, text, text, text, text, integer, text, text, text, text, jsonb, text);
drop function if exists public.suggest_seed_catalog_item(uuid, text, text, text, text, integer, text, text, jsonb);
drop function if exists public.plant_seed_from_catalog(uuid, text, text, date, text, uuid, uuid);
drop function if exists public.get_seed_catalog_detail(uuid);
drop function if exists public.search_seed_catalog(uuid, text, integer);
drop function if exists public.validate_seed_catalogue_link();
drop function if exists public.touch_seed_catalog_edition_updated_at();
drop function if exists public.sync_seed_catalog_item_aliases();
drop function if exists public.prepare_seed_catalog_alias();
drop function if exists public.prepare_seed_catalog_item();
drop function if exists public.normalize_seed_catalog_text(text);

delete from public.seed_reactions
where reaction_type = 'inspired';

alter table public.seed_reactions
  drop constraint if exists seed_reactions_type_check;
alter table public.seed_reactions
  add constraint seed_reactions_type_check check (
    reaction_type in ('save', 'water')
  );

drop table if exists public.seed_experience_comments cascade;

alter table public.seeds
  drop constraint if exists seeds_experience_comment_policy_check,
  drop column if exists experience_comment_policy,
  drop column if exists inspired_by_seed_id,
  drop column if exists catalog_edition_id,
  drop column if exists catalog_item_id;

drop table if exists public.seed_catalog_editions cascade;
drop table if exists public.seed_catalog_aliases cascade;
drop table if exists public.seed_catalog_items cascade;

commit;
