begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

revoke all on function public.set_my_seed_reaction(uuid, text, boolean) from public;
revoke all on function public.get_visible_seed_reaction_context(uuid[]) from public;
revoke all on function public.get_visible_seed_detail(uuid) from public;
revoke all on function public.complete_my_seed_with_reflection(uuid, date, text, text, text, jsonb) from public;
revoke all on function public.delete_my_seed_journal_entry(uuid) from public;
revoke all on function public.save_my_seed_journal_entry(uuid, uuid, text, text, text, text, date, jsonb) from public;
revoke all on function public.normalize_seed_journal_attachments(jsonb) from public;
revoke all on function public.get_visible_profile_seeds_v2(uuid, integer) from public;
revoke all on function public.get_my_saved_seeds(integer, integer) from public;
revoke all on function public.get_my_seed_v2(uuid) from public;
revoke all on function public.get_my_seeds_v2(text) from public;
revoke all on function public.update_my_seed_v2(uuid, uuid, text, text, text, text, text, date, jsonb) from public;
revoke all on function public.create_my_seed_v2(uuid, text, text, text, text, text, date, jsonb) from public;
revoke all on function public.replace_my_seed_links(uuid, jsonb) from public;
revoke all on function public.normalize_seed_link_collection(jsonb) from public;

drop function if exists public.set_my_seed_reaction(uuid, text, boolean);
drop function if exists public.get_visible_seed_reaction_context(uuid[]);
drop function if exists public.get_visible_seed_detail(uuid);
drop function if exists public.complete_my_seed_with_reflection(uuid, date, text, text, text, jsonb);
drop function if exists public.delete_my_seed_journal_entry(uuid);
drop function if exists public.save_my_seed_journal_entry(uuid, uuid, text, text, text, text, date, jsonb);
drop function if exists public.normalize_seed_journal_attachments(jsonb);
drop function if exists public.get_visible_profile_seeds_v2(uuid, integer);
drop function if exists public.get_my_saved_seeds(integer, integer);
drop function if exists public.get_my_seed_v2(uuid);
drop function if exists public.get_my_seeds_v2(text);
drop function if exists public.update_my_seed_v2(uuid, uuid, text, text, text, text, text, date, jsonb);
drop function if exists public.create_my_seed_v2(uuid, text, text, text, text, text, date, jsonb);
drop function if exists public.replace_my_seed_links(uuid, jsonb);
drop function if exists public.normalize_seed_link_collection(jsonb);

drop table if exists public.seed_reactions;
drop table if exists public.seed_journal_entries;

do $$
begin
  if to_regclass('public.app_translation_namespaces') is not null then
    delete from public.app_translation_namespaces where slug = 'seed-journal';
  end if;
end;
$$;

commit;
