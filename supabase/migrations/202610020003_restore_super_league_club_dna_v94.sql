begin;

-- Eight active 2026-2027 Super League clubs survived as root catalogue cards
-- without their canonical football-team child. Rebuild those children through
-- the existing admin save path so catalogue, hierarchy and profile metadata
-- stay in sync for web and mobile consumers.
do $$
declare
  r record;
  admin_id uuid;
  profile jsonb;
  teams jsonb;
  existing_team jsonb;
  repaired_team jsonb;
  deterministic_team_id text;
begin
  select user_id into admin_id
  from public.admin_users
  where role in ('owner', 'admin')
  order by case role when 'owner' then 0 else 1 end
  limit 1;

  if admin_id is null then
    raise exception 'Kulüp DNA onarımı için yönetici bulunamadı.';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  for r in
    select t.*
    from public.canonical_targets t
    where t.id = any(array[
      '3a6dff57-416c-4e46-8415-7bb2fc69850f'::uuid, -- Eyüpspor
      '7361775f-a6a9-400a-91aa-6b18d1cc8722'::uuid, -- Gaziantep FK
      'cd8f86ef-c5b2-4e8e-bf24-9fe5e0cddab2'::uuid, -- Gençlerbirliği SK
      '2981861a-e1ee-4097-a179-a1fa1f3e8147'::uuid, -- Göztepe A.Ş.
      'a5713cf1-c093-4c22-bc43-8dc475500c4c'::uuid, -- İstanbul Başakşehir FK
      'd11e1841-024d-4966-96fe-40cb426a9321'::uuid, -- Kocaelispor
      '07b129af-aca8-4ac9-b26b-c99bf1994428'::uuid, -- Samsunpor A.Ş.
      'ae525a82-f92d-4a36-a6e4-b36d41b41b2b'::uuid  -- TÜMOSAN Konyaspor
    ])
    order by t.title
  loop
    profile := coalesce(r.editorial_metadata->'club_profile', '{}'::jsonb);
    teams := coalesce(profile->'teams', '[]'::jsonb);

    select value into existing_team
    from jsonb_array_elements(teams)
    where lower(trim(coalesce(value->>'sport', ''))) = 'futbol'
      and lower(trim(coalesce(value->>'division', 'erkek'))) = 'erkek'
    limit 1;

    deterministic_team_id := 'super-league-football-men-' || r.id::text;
    repaired_team := coalesce(existing_team, '{}'::jsonb) || jsonb_build_object(
      'id', coalesce(nullif(existing_team->>'id', ''), deterministic_team_id),
      'name', coalesce(nullif(existing_team->>'name', ''), r.title),
      'sport', 'Futbol',
      'division', 'Erkek',
      'league', 'Trendyol Süper Lig',
      'season', '2026-2027'
    );

    if existing_team is null then
      teams := teams || jsonb_build_array(repaired_team);
    else
      select coalesce(jsonb_agg(
        case
          when value = existing_team then repaired_team
          else value
        end
        order by ordinal
      ), '[]'::jsonb)
      into teams
      from jsonb_array_elements(teams) with ordinality as listed(value, ordinal);
    end if;

    profile := profile || jsonb_build_object('teams', teams);

    perform public.admin_save_club_card_v75(
      r.id,
      r.title,
      r.editorial_metadata->>'content_type_id',
      r.creator_name,
      r.editorial_cover_url,
      r.editorial_metadata->>'description',
      r.editorial_metadata->>'reference_url',
      profile,
      coalesce((r.editorial_metadata->>'cover_position_y')::numeric, 50),
      coalesce(r.editorial_metadata->'club_hierarchy', '{}'::jsonb)
    );
  end loop;

  if (
    select count(distinct parent_target_id)
    from public.get_club_hierarchy_v78()
    where sport = 'Futbol'
      and league = 'Trendyol Süper Lig'
      and division = 'Erkek'
      and season = '2026-2027'
  ) <> 18 then
    raise exception 'Süper Lig DNA onarımı 18 ana kulübe ulaşmadı.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
