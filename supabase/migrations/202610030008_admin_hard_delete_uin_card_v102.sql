begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function public.admin_hard_delete_uin_card_v102(
  p_target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_seed_count integer := 0;
  v_intent_count integer := 0;
  v_personal_count integer := 0;
  v_catalog_count integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode = '42501';
  end if;

  select title into v_title
  from public.canonical_targets
  where id = p_target_id
  for update;

  if v_title is null then
    raise exception 'Kütüphane kartı bulunamadı.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_seed_count
  from public.seeds seed
  where seed.canonical_target_id = p_target_id
     or seed.catalog_item_id in (
       select item.id from public.seed_catalog_items item
       where item.canonical_target_id = p_target_id
     );

  select count(*)::integer into v_intent_count
  from public.intents intent
  where intent.canonical_target_id = p_target_id;

  select count(*)::integer into v_personal_count
  from public.canonical_personal_intents_v38 personal
  where personal.target_id = p_target_id;

  select count(*)::integer into v_catalog_count
  from public.seed_catalog_items item
  where item.canonical_target_id = p_target_id;

  delete from public.intents intent
  where intent.canonical_target_id = p_target_id;

  delete from public.canonical_personal_intents_v38 personal
  where personal.target_id = p_target_id;

  delete from public.seeds seed
  where seed.canonical_target_id = p_target_id
     or seed.catalog_item_id in (
       select item.id from public.seed_catalog_items item
       where item.canonical_target_id = p_target_id
     );

  delete from public.intent_participation_requirements requirement
  where requirement.catalog_item_id in (
    select item.id from public.seed_catalog_items item
    where item.canonical_target_id = p_target_id
  );

  delete from public.intent_match_fixtures_v50 link
  where link.fixture_id in (
    select fixture.id from public.canonical_match_fixtures fixture
    where fixture.target_id = p_target_id
  );

  delete from public.seed_match_experiences experience
  where experience.fixture_id in (
    select fixture.id from public.canonical_match_fixtures fixture
    where fixture.target_id = p_target_id
  );

  delete from public.canonical_match_fixtures fixture
  where fixture.target_id = p_target_id;

  delete from public.uin_together_proposals_v71 proposal
  where proposal.target_id = p_target_id;

  delete from public.seed_catalog_items item
  where item.canonical_target_id = p_target_id;

  delete from public.canonical_targets target
  where target.id = p_target_id;

  return jsonb_build_object(
    'deleted', true,
    'target_id', p_target_id,
    'title', v_title,
    'deleted_seeds', v_seed_count,
    'deleted_intents', v_intent_count,
    'deleted_personal_intents', v_personal_count,
    'deleted_catalog_items', v_catalog_count
  );
end;
$$;

revoke all on function public.admin_hard_delete_uin_card_v102(uuid) from public, anon;
grant execute on function public.admin_hard_delete_uin_card_v102(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;