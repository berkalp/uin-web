-- Display only a supplied experience date/year. Completion timestamps are not visit dates.
-- CREATE OR REPLACE preserves the existing visibility rules, owner and grants.
CREATE OR REPLACE FUNCTION public.get_uin_card_people_v81(p_target_id uuid, p_group text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with candidates as materialized (
    select projection.*,
      row_number() over(
        partition by projection.user_id
        order by
          case projection.source_kind
            when 'seed' then 0
            when 'personal' then 1
            else 2
          end,
          projection.target_date desc nulls last,
          projection.source_id
      ) rn
    from public.get_uin_card_people_projection_v143(array[p_target_id]) projection
    where projection.relationship_status=case when p_group='experience' then 'completed' else 'want' end
  ), selected as materialized (
    select candidates.*,target.title source_target_title
    from candidates
    join public.canonical_targets target on target.id=candidates.source_target_id
    where candidates.rn=1
  )
  select jsonb_build_object(
    'kind','personal',
    'id',selected.source_id,
    'user_id',selected.user_id,
    'full_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
    'username',profile.username,
    'avatar_url',profile.avatar_url,
    'seed_id',case when selected.source_kind='seed' then selected.source_id end,
    'source_kind',selected.source_kind,
    'source_id',selected.source_id,
    'source_target_id',selected.source_target_id,
    'source_target_title',selected.source_target_title,
    'target_date',selected.target_date,
    'start_date',case when selected.source_kind='personal' then personal.start_date else seed.target_date end,
    'end_date',case when selected.source_kind='personal' then personal.end_date else seed.target_date end,
    'timing_precision',case when selected.source_kind='personal' then personal.timing_precision else 'day' end,
    'date_options',case when selected.source_kind='personal' then personal.date_options else '[]'::jsonb end,
    'notes',case when selected.source_kind='personal' then personal.notes end,
    'visibility',case when selected.source_kind='personal' then personal.visibility else seed.visibility end,
    'location_id',location.id,
    'location',nullif(concat_ws(', ',nullif(location.district,''),nullif(location.city,''),nullif(location.country_name,'')) ,''),
    'location_scope',location.scope,
    'latitude',location.latitude,
    'longitude',location.longitude,
    'rating',case when selected.source_kind='seed' then personal_state.rating end,
    'experience_precision',case when selected.source_kind='seed' then coalesce(personal_state.experience_precision,case when personal_state.experience_date is not null then 'exact' when personal_state.experience_year is not null then 'year' end,seed.completed_date_precision,'unknown') end,
    'experience_date',case when selected.source_kind='seed' and coalesce(personal_state.experience_precision,case when personal_state.experience_date is not null then 'exact' when personal_state.experience_year is not null then 'year' end,seed.completed_date_precision,'unknown')='exact' then coalesce(personal_state.experience_date,case when seed.completed_date_precision='exact' then seed.completed_at::date end) end,
    'experience_year',case when selected.source_kind='seed' and coalesce(personal_state.experience_precision,case when personal_state.experience_date is not null then 'exact' when personal_state.experience_year is not null then 'year' end,seed.completed_date_precision,'unknown')='year' then coalesce(personal_state.experience_year,seed.completed_year) end,
    'experience_text',case when selected.source_kind='seed' then reflection.body end,
    'comment_count',case when selected.source_kind='seed' then (
      select count(*) from public.seed_experience_comments comment
      where comment.seed_id=seed.id and comment.deleted_at is null
    ) else 0 end,
    'total_count',count(*) over()
  )
  from selected
  join public.profiles profile on profile.id=selected.user_id
  left join public.seeds seed on seed.id=selected.source_id and selected.source_kind='seed'
  left join public.canonical_personal_intents_v38 personal
    on personal.id=selected.source_id and selected.source_kind='personal'
  left join public.locations location on location.id=personal.location_id
  left join public.seed_personal_state_v15 personal_state
    on personal_state.seed_id=seed.id and personal_state.user_id=selected.user_id
  left join lateral (
    select journal.body
    from public.seed_journal_entries journal
    where journal.seed_id=seed.id
      and journal.entry_kind='reflection'
      and public.seed_is_visible_to_viewer(selected.user_id,journal.visibility,auth.uid())
    order by journal.occurred_on desc,journal.created_at desc
    limit 1
  ) reflection on true
  order by case when selected.user_id=auth.uid() then 0 else 1 end,
    selected.target_date nulls last,selected.user_id
  limit greatest(1,least(coalesce(p_limit,50),100))
  offset greatest(coalesce(p_offset,0),0);
$function$
;
