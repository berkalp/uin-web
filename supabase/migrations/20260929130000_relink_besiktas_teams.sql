begin;

do $$
declare
  visible_root constant uuid := '13d7d3bd-dd3b-423b-b128-23531c41e7f8';
  legacy_root constant uuid := '24138b00-f159-42a3-9d41-00a92ef1084d';
  football_team constant uuid := '700d9315-b2f3-47e5-91f2-2c6db0281ddc';
  basketball_team constant uuid := 'b01962b1-2ee1-4e45-b814-b0c10963fd15';
  legacy_teams jsonb;
  linked_count integer;
begin
  if not exists(select 1 from public.canonical_targets where id=visible_root) then
    raise exception 'Visible Besiktas root is missing';
  end if;
  if not exists(select 1 from public.canonical_targets where id=legacy_root) then
    raise exception 'Legacy Besiktas root is missing';
  end if;
  if (select count(*) from public.canonical_targets where id in (football_team,basketball_team)) <> 2 then
    raise exception 'Besiktas team cards are missing';
  end if;

  select coalesce(editorial_metadata->'club_profile'->'teams','[]'::jsonb)
  into legacy_teams
  from public.canonical_targets
  where id=legacy_root;

  update public.canonical_targets
  set editorial_metadata=(coalesce(editorial_metadata,'{}'::jsonb)-'admin_hidden'-'admin_hidden_at')
      ||jsonb_build_object(
        'club_hierarchy',
        coalesce(editorial_metadata->'club_hierarchy','{}'::jsonb)
        ||jsonb_build_object('parent_target_id',visible_root::text)
      ),
      updated_at=now()
  where id in (football_team,basketball_team);

  update public.canonical_targets
  set editorial_metadata=(coalesce(editorial_metadata,'{}'::jsonb)-'admin_hidden'-'admin_hidden_at')
      ||jsonb_build_object(
        'club_profile',
        coalesce(editorial_metadata->'club_profile','{}'::jsonb)
        ||jsonb_build_object('teams',legacy_teams)
      ),
      updated_at=now()
  where id=visible_root;

  select count(*) into linked_count
  from public.canonical_targets
  where id in (football_team,basketball_team)
    and editorial_metadata->'club_hierarchy'->>'parent_target_id'=visible_root::text
    and coalesce(editorial_metadata->>'admin_hidden','false')<>'true';
  if linked_count <> 2 then
    raise exception 'Besiktas teams could not be relinked';
  end if;
end;
$$;

notify pgrst,'reload schema';
commit;