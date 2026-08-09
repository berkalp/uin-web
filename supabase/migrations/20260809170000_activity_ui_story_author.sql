begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- EXPERIENCE STORY AUTHORSHIP
--
-- Keep one shared Activity story, but record who last wrote/updated it so the
-- Memory UI can show an actual byline instead of an anonymous block of text.
-- ============================================================

alter table public.experiences
  add column if not exists story_updated_by_user_id uuid
    references public.profiles(id)
    on delete set null,
  add column if not exists story_updated_at timestamptz;

update public.experiences
set
  story_updated_by_user_id = coalesce(
    story_updated_by_user_id,
    created_by_user_id
  ),
  story_updated_at = coalesce(
    story_updated_at,
    updated_at,
    completed_at,
    created_at
  )
where story is not null
  and btrim(story) <> ''
  and (
    story_updated_by_user_id is null
    or story_updated_at is null
  );

create or replace function public.update_experience_details(
  p_experience_id uuid,
  p_title text,
  p_story text,
  p_visibility text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_title text;
  v_story text;
begin
  v_user_id := auth.uid();

  if not public.is_experience_manager(
    p_experience_id,
    v_user_id
  ) then
    raise exception
      'Only the Primary Host or an active Co-host may edit this Experience.'
      using errcode = '42501';
  end if;

  v_title :=
    nullif(
      btrim(
        coalesce(
          p_title,
          ''
        )
      ),
      ''
    );

  v_story :=
    nullif(
      btrim(
        coalesce(
          p_story,
          ''
        )
      ),
      ''
    );

  if v_title is null then
    raise exception
      'A shared Experience title is required.'
      using errcode = '22023';
  end if;

  if char_length(v_title) > 120 then
    raise exception
      'The shared title may contain at most 120 characters.'
      using errcode = '22023';
  end if;

  if v_story is not null
     and char_length(v_story) > 2000
  then
    raise exception
      'The Experience story may contain at most 2000 characters.'
      using errcode = '22023';
  end if;

  if p_visibility not in (
    'participants',
    'friends',
    'public'
  ) then
    raise exception
      'Unsupported Experience visibility.'
      using errcode = '22023';
  end if;

  update public.experiences experience
  set
    title = v_title,
    story_updated_by_user_id =
      case
        when experience.story
          is distinct from v_story
        then v_user_id
        else experience.story_updated_by_user_id
      end,
    story_updated_at =
      case
        when experience.story
          is distinct from v_story
        then now()
        else experience.story_updated_at
      end,
    story = v_story,
    visibility = p_visibility,
    updated_at = now()
  where experience.id = p_experience_id
  returning experience.plan_id
  into v_plan_id;

  insert into public.plan_private_titles (
    plan_id,
    title,
    created_by_user_id,
    created_at,
    updated_at
  )
  values (
    v_plan_id,
    v_title,
    v_user_id,
    now(),
    now()
  )
  on conflict (plan_id)
  do update
  set
    title = excluded.title,
    updated_at = now();

  return p_experience_id;
end;
$$;

-- v2 remains untouched for compatibility. v3 adds only story-byline metadata
-- to the already-authorized bundle returned by v2.
create or replace function public.get_visible_experience_gallery_v3(
  p_plan_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bundle jsonb;
  v_experience_id uuid;
  v_story_author_user_id uuid;
  v_story_author_name text;
  v_story_author_username text;
  v_story_author_avatar_url text;
  v_story_updated_at timestamptz;
begin
  v_bundle :=
    public.get_visible_experience_gallery_v2(
      p_plan_id
    );

  if v_bundle is null
     or jsonb_typeof(
       v_bundle -> 'experience'
     ) <> 'object'
  then
    return v_bundle;
  end if;

  begin
    v_experience_id :=
      nullif(
        v_bundle #>> '{experience,id}',
        ''
      )::uuid;
  exception
    when others then
      v_experience_id := null;
  end;

  if v_experience_id is null then
    return v_bundle;
  end if;

  select
    coalesce(
      experience.story_updated_by_user_id,
      experience.created_by_user_id
    ),
    profile.full_name,
    profile.username,
    profile.avatar_url,
    coalesce(
      experience.story_updated_at,
      experience.updated_at,
      experience.completed_at,
      experience.created_at
    )
  into
    v_story_author_user_id,
    v_story_author_name,
    v_story_author_username,
    v_story_author_avatar_url,
    v_story_updated_at
  from public.experiences experience
  left join public.profiles profile
    on profile.id = coalesce(
      experience.story_updated_by_user_id,
      experience.created_by_user_id
    )
  where experience.id = v_experience_id;

  v_bundle := jsonb_set(
    v_bundle,
    '{experience,story_author_user_id}',
    case
      when v_story_author_user_id is null
      then 'null'::jsonb
      else to_jsonb(
        v_story_author_user_id::text
      )
    end,
    true
  );

  v_bundle := jsonb_set(
    v_bundle,
    '{experience,story_author_name}',
    case
      when v_story_author_name is null
      then 'null'::jsonb
      else to_jsonb(
        v_story_author_name
      )
    end,
    true
  );

  v_bundle := jsonb_set(
    v_bundle,
    '{experience,story_author_username}',
    case
      when v_story_author_username is null
      then 'null'::jsonb
      else to_jsonb(
        v_story_author_username
      )
    end,
    true
  );

  v_bundle := jsonb_set(
    v_bundle,
    '{experience,story_author_avatar_url}',
    case
      when v_story_author_avatar_url is null
      then 'null'::jsonb
      else to_jsonb(
        v_story_author_avatar_url
      )
    end,
    true
  );

  v_bundle := jsonb_set(
    v_bundle,
    '{experience,story_updated_at}',
    case
      when v_story_updated_at is null
      then 'null'::jsonb
      else to_jsonb(
        v_story_updated_at
      )
    end,
    true
  );

  return v_bundle;
end;
$$;

revoke all
on function public.get_visible_experience_gallery_v3(uuid)
from public;

grant execute
on function public.get_visible_experience_gallery_v3(uuid)
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
