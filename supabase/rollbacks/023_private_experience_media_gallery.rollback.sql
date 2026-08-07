begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- Restore pre-migration visibility and cover selections where the original
-- rows still exist. Media created after migration remains participant-private.
update public.experience_media media
set visibility = backup.visibility,
    updated_at = now()
from public.uin_migration_023_media_backup backup
where backup.media_id = media.id;

update public.experiences experience
set cover_media_id = case
      when backup.cover_media_id is null then null
      when exists (
        select 1 from public.experience_media media
        where media.id = backup.cover_media_id
      ) then backup.cover_media_id
      else null
    end,
    updated_at = now()
from public.uin_migration_023_cover_backup backup
where backup.experience_id = experience.id;

-- Stop the consent-state trigger before restoring the legacy tag functions.
drop trigger if exists recalculate_experience_media_after_tag_change_trigger
on public.experience_media_tags;

-- Restore the legacy entry points used by the pre-023 application.
create or replace function
  public.can_user_view_experience_media(
    p_media_id uuid,
    p_user_id uuid
      default auth.uid()
  )
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_experience_id uuid;
  v_visibility text;
  v_host_user_id uuid;
  v_experience_visibility text;
begin
  select
    media.experience_id,
    media.visibility,
    plan.host_user_id,
    experience.visibility
  into
    v_experience_id,
    v_visibility,
    v_host_user_id,
    v_experience_visibility
  from public.experience_media media
  join public.experiences experience
    on experience.id =
      media.experience_id
  join public.plans plan
    on plan.id =
      experience.plan_id
  where
    media.id =
      p_media_id
    and media.moderation_status =
      'active';

  if v_experience_id is null then
    return false;
  end if;

  if public.is_experience_participant(
    v_experience_id,
    p_user_id
  ) then
    return true;
  end if;

  if not public.can_user_view_experience(
    v_experience_id,
    p_user_id
  ) then
    return false;
  end if;

  if
    v_visibility =
      'public'
    and v_experience_visibility =
      'public'
  then
    return true;
  end if;

  if
    v_visibility =
      'friends'
    and v_experience_visibility in (
      'friends',
      'public'
    )
    and p_user_id is not null
  then
    return public.are_users_friends(
      v_host_user_id,
      p_user_id
    );
  end if;

  return false;
end;
$$;

create or replace function
  public.add_experience_photo_media(
    p_experience_id uuid,
    p_storage_path text,
    p_caption text,
    p_visibility text
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_media_id uuid;
  v_experience_visibility text;
  v_storage_path text;
begin
  v_user_id :=
    auth.uid();

  if not public.can_user_contribute_to_experience(
    p_experience_id,
    v_user_id
  ) then
    raise exception
      'Only the Host, Co-host or an attended participant may add Experience media.'
      using errcode = '42501';
  end if;

  select
    experience.visibility
  into
    v_experience_visibility
  from public.experiences experience
  where
    experience.id =
      p_experience_id;

  if
    public.experience_visibility_rank(
      p_visibility
    ) >
    public.experience_visibility_rank(
      v_experience_visibility
    )
  then
    raise exception
      'Media visibility cannot be broader than the Experience visibility.'
      using errcode = '22023';
  end if;

  v_storage_path :=
    btrim(
      coalesce(
        p_storage_path,
        ''
      )
    );

  if
    v_storage_path = ''
    or v_storage_path not like
      p_experience_id::text ||
      '/' ||
      v_user_id::text ||
      '/%'
  then
    raise exception
      'Invalid Experience media storage path.'
      using errcode = '22023';
  end if;

  insert into public.experience_media (
    experience_id,
    uploader_user_id,
    media_type,
    storage_path,
    caption,
    visibility
  )
  values (
    p_experience_id,
    v_user_id,
    'photo',
    v_storage_path,
    nullif(
      btrim(
        coalesce(
          p_caption,
          ''
        )
      ),
      ''
    ),
    p_visibility
  )
  returning
    id
  into
    v_media_id;

  return v_media_id;
end;
$$;

create or replace function
  public.add_experience_external_media(
    p_experience_id uuid,
    p_provider text,
    p_url text,
    p_label text,
    p_caption text,
    p_visibility text
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_media_id uuid;
  v_media_type text;
  v_experience_visibility text;
  v_url text;
begin
  v_user_id :=
    auth.uid();

  if not public.can_user_contribute_to_experience(
    p_experience_id,
    v_user_id
  ) then
    raise exception
      'Only the Host, Co-host or an attended participant may add Experience links.'
      using errcode = '42501';
  end if;

  if p_provider not in (
    'google_photos',
    'instagram',
    'youtube',
    'vimeo',
    'other'
  ) then
    raise exception
      'Unsupported Experience link provider.'
      using errcode = '22023';
  end if;

  v_url :=
    btrim(
      coalesce(
        p_url,
        ''
      )
    );

  if v_url !~* '^https://[^[:space:]]+$' then
    raise exception
      'Use a valid HTTPS link.'
      using errcode = '22023';
  end if;

  select
    experience.visibility
  into
    v_experience_visibility
  from public.experiences experience
  where
    experience.id =
      p_experience_id;

  if
    public.experience_visibility_rank(
      p_visibility
    ) >
    public.experience_visibility_rank(
      v_experience_visibility
    )
  then
    raise exception
      'Link visibility cannot be broader than the Experience visibility.'
      using errcode = '22023';
  end if;

  v_media_type :=
    case
      when p_provider =
        'google_photos'
        then 'external_album'
      when p_provider in (
        'youtube',
        'vimeo'
      )
        then 'external_video'
      else 'external_post'
    end;

  insert into public.experience_media (
    experience_id,
    uploader_user_id,
    media_type,
    provider,
    external_url,
    label,
    caption,
    visibility
  )
  values (
    p_experience_id,
    v_user_id,
    v_media_type,
    p_provider,
    v_url,
    nullif(
      btrim(
        coalesce(
          p_label,
          ''
        )
      ),
      ''
    ),
    nullif(
      btrim(
        coalesce(
          p_caption,
          ''
        )
      ),
      ''
    ),
    p_visibility
  )
  returning
    id
  into
    v_media_id;

  return v_media_id;
end;
$$;

create or replace function
  public.delete_experience_media(
    p_media_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_media public.experience_media%rowtype;
begin
  v_user_id :=
    auth.uid();

  select *
  into
    v_media
  from public.experience_media media
  where
    media.id =
      p_media_id
  for update;

  if not found then
    raise exception
      'Experience media not found.'
      using errcode = 'P0002';
  end if;

  if
    v_user_id is null
    or (
      v_media.uploader_user_id <>
        v_user_id
      and not public.is_experience_manager(
        v_media.experience_id,
        v_user_id
      )
    )
  then
    raise exception
      'You cannot remove this Experience item.'
      using errcode = '42501';
  end if;

  delete from public.experience_media
  where
    id =
      p_media_id;

  return p_media_id;
end;
$$;

create or replace function
  public.set_experience_cover_media(
    p_experience_id uuid,
    p_media_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id :=
    auth.uid();

  if not public.is_experience_manager(
    p_experience_id,
    v_user_id
  ) then
    raise exception
      'Only the Primary Host or an active Co-host may choose the Experience cover.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.experience_media media
    where
      media.id =
        p_media_id
      and media.experience_id =
        p_experience_id
      and media.media_type =
        'photo'
      and media.moderation_status =
        'active'
  ) then
    raise exception
      'Choose an active photo from this Experience.'
      using errcode = '22023';
  end if;

  update public.experiences
  set
    cover_media_id =
      p_media_id,
    updated_at =
      now()
  where
    id =
      p_experience_id;

  return p_media_id;
end;
$$;

create or replace function
  public.tag_experience_media_participant(
    p_media_id uuid,
    p_tagged_user_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_experience_id uuid;
  v_plan_id uuid;
  v_tag_id uuid;
  v_initial_status text;
begin
  v_user_id :=
    auth.uid();

  select
    media.experience_id,
    experience.plan_id
  into
    v_experience_id,
    v_plan_id
  from public.experience_media media
  join public.experiences experience
    on experience.id =
      media.experience_id
  where
    media.id =
      p_media_id
    and media.media_type =
      'photo'
    and media.moderation_status =
      'active';

  if v_experience_id is null then
    raise exception
      'Experience photo not found.'
      using errcode = 'P0002';
  end if;

  if not public.can_user_contribute_to_experience(
    v_experience_id,
    v_user_id
  ) then
    raise exception
      'You cannot tag participants in this Experience.'
      using errcode = '42501';
  end if;

  if public.reputation_is_managed_minor(
    p_tagged_user_id
  ) then
    raise exception
      'Managed minor profiles cannot be tagged in shared Experience media.'
      using errcode = '42501';
  end if;

  if not (
    exists (
      select 1
      from public.plans plan
      where
        plan.id =
          v_plan_id
        and plan.host_user_id =
          p_tagged_user_id
    )
    or exists (
      select 1
      from public.plan_members member
      where
        member.plan_id =
          v_plan_id
        and member.user_id =
          p_tagged_user_id
        and member.status =
          'active'
        and (
          member.role =
            'co_host'
          or member.attendance_status =
            'attended'
        )
    )
  ) then
    raise exception
      'Only attended Activity participants may be tagged.'
      using errcode = '22023';
  end if;

  v_initial_status :=
    case
      when p_tagged_user_id =
        v_user_id
        then 'approved'
      else 'pending'
    end;

  insert into public.experience_media_tags (
    media_id,
    tagged_user_id,
    tagged_by_user_id,
    status,
    responded_at
  )
  values (
    p_media_id,
    p_tagged_user_id,
    v_user_id,
    v_initial_status,
    case
      when v_initial_status =
        'approved'
        then now()
      else null
    end
  )
  on conflict (
    media_id,
    tagged_user_id
  )
  do update
  set
    tagged_by_user_id =
      excluded.tagged_by_user_id,
    status =
      excluded.status,
    responded_at =
      excluded.responded_at,
    updated_at =
      now()
  returning
    id
  into
    v_tag_id;

  return v_tag_id;
end;
$$;

create or replace function
  public.respond_to_experience_media_tag(
    p_tag_id uuid,
    p_status text
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id :=
    auth.uid();

  if p_status not in (
    'approved',
    'declined',
    'removed'
  ) then
    raise exception
      'Unsupported tag response.'
      using errcode = '22023';
  end if;

  update public.experience_media_tags tag
  set
    status =
      p_status,
    responded_at =
      now(),
    updated_at =
      now()
  where
    tag.id =
      p_tag_id
    and tag.tagged_user_id =
      v_user_id;

  if not found then
    raise exception
      'Tag not found or access denied.'
      using errcode = 'P0002';
  end if;

  return p_tag_id;
end;
$$;

-- Disable the new client-facing endpoints. New tables and columns are retained
-- deliberately so uploaded files, comments and consent history are not lost.
revoke all on function public.add_experience_uploaded_media_v2(uuid, text, text, text, text, text) from anon, authenticated;
revoke all on function public.remove_experience_media_v2(uuid) from anon, authenticated;
revoke all on function public.add_experience_external_media_v2(uuid, text, text, text, text, text) from anon, authenticated;
revoke all on function public.request_experience_media_publication(uuid) from anon, authenticated;
revoke all on function public.cancel_experience_media_publication(uuid) from anon, authenticated;
revoke all on function public.set_experience_cover_media_v2(uuid, uuid) from anon, authenticated;
revoke all on function public.report_experience_media_appearance(uuid, text) from anon, authenticated;
revoke all on function public.add_experience_media_comment(uuid, text) from anon, authenticated;
revoke all on function public.delete_experience_media_comment(uuid) from anon, authenticated;
revoke all on function public.get_visible_experience_gallery_v2(uuid) from anon, authenticated;
revoke all on function public.get_visible_public_experience_covers(uuid[]) from anon, authenticated;
revoke all on function public.can_user_view_public_experience_cover(uuid, uuid) from anon, authenticated;

-- Restore legacy execution grants.
grant execute on function public.add_experience_photo_media(uuid, text, text, text) to authenticated;
grant execute on function public.add_experience_external_media(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.delete_experience_media(uuid) to authenticated;
grant execute on function public.set_experience_cover_media(uuid, uuid) to authenticated;
grant execute on function public.tag_experience_media_participant(uuid, uuid) to authenticated;
grant execute on function public.respond_to_experience_media_tag(uuid, text) to authenticated;

-- Keep the backup tables only until restoration succeeds.
drop table if exists public.uin_migration_023_cover_backup;
drop table if exists public.uin_migration_023_media_backup;

notify pgrst, 'reload schema';

commit;
