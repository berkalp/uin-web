begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- EXPERIENCE MEDIA: PRIVATE GALLERY + APPROVED PUBLIC SHOWCASE
-- ============================================================

alter table public.experience_media
  add column if not exists mime_type text,
  add column if not exists original_filename text,
  add column if not exists public_status text not null default 'private',
  add column if not exists public_requested_at timestamptz,
  add column if not exists public_decided_at timestamptz,
  add column if not exists public_requested_by_user_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists public_rejection_locked boolean not null default false;

alter table public.experience_media
  drop constraint if exists experience_media_type_check;

alter table public.experience_media
  add constraint experience_media_type_check
  check (
    media_type in (
      'photo',
      'video',
      'external_photo',
      'external_album',
      'external_video',
      'external_post'
    )
  ) not valid;

alter table public.experience_media
  validate constraint experience_media_type_check;

alter table public.experience_media
  drop constraint if exists experience_media_provider_check;

alter table public.experience_media
  add constraint experience_media_provider_check
  check (
    provider is null
    or provider in (
      'direct',
      'google_photos',
      'instagram',
      'youtube',
      'vimeo',
      'other'
    )
  ) not valid;

alter table public.experience_media
  validate constraint experience_media_provider_check;

alter table public.experience_media
  drop constraint if exists experience_media_shape_check;

alter table public.experience_media
  add constraint experience_media_shape_check
  check (
    (
      media_type in ('photo', 'video')
      and storage_path is not null
      and external_url is null
    )
    or (
      media_type in (
        'external_photo',
        'external_album',
        'external_video',
        'external_post'
      )
      and storage_path is null
      and external_url is not null
    )
  ) not valid;

alter table public.experience_media
  validate constraint experience_media_shape_check;

alter table public.experience_media
  drop constraint if exists experience_media_public_status_check;

alter table public.experience_media
  add constraint experience_media_public_status_check
  check (
    public_status in (
      'private',
      'pending',
      'approved',
      'rejected',
      'suspended'
    )
  ) not valid;

alter table public.experience_media
  validate constraint experience_media_public_status_check;

alter table public.experience_media
  drop constraint if exists experience_media_original_filename_length_check;

alter table public.experience_media
  add constraint experience_media_original_filename_length_check
  check (
    original_filename is null
    or char_length(original_filename) <= 240
  ) not valid;

alter table public.experience_media
  validate constraint experience_media_original_filename_length_check;

-- Preserve the pre-migration presentation state so the supplied rollback can
-- restore it without deleting media uploaded after this migration.
create table if not exists public.uin_migration_023_media_backup (
  media_id uuid primary key,
  visibility text not null
);

create table if not exists public.uin_migration_023_cover_backup (
  experience_id uuid primary key,
  cover_media_id uuid
);

alter table public.uin_migration_023_media_backup enable row level security;
alter table public.uin_migration_023_cover_backup enable row level security;
revoke all on public.uin_migration_023_media_backup from anon, authenticated;
revoke all on public.uin_migration_023_cover_backup from anon, authenticated;

insert into public.uin_migration_023_media_backup (media_id, visibility)
select media.id, media.visibility
from public.experience_media media
on conflict (media_id) do nothing;

insert into public.uin_migration_023_cover_backup (experience_id, cover_media_id)
select experience.id, experience.cover_media_id
from public.experiences experience
on conflict (experience_id) do nothing;

-- Existing gallery items become participant-private. Existing selected covers
-- are migrated into the explicit approval model without publishing other media.
update public.experience_media
set
  visibility = 'participants',
  public_status = 'private',
  public_requested_at = null,
  public_decided_at = null,
  public_requested_by_user_id = null,
  public_rejection_locked = false
where true;

update public.experience_media media
set
  public_requested_at = coalesce(media.updated_at, media.created_at, now()),
  public_requested_by_user_id = media.uploader_user_id,
  public_status = case
    when exists (
      select 1
      from public.experience_media_tags tag
      where tag.media_id = media.id
        and tag.status in ('declined', 'removed')
    ) then 'rejected'
    when exists (
      select 1
      from public.experience_media_tags tag
      where tag.media_id = media.id
        and tag.status = 'pending'
    ) then 'pending'
    else 'approved'
  end,
  public_decided_at = case
    when exists (
      select 1
      from public.experience_media_tags tag
      where tag.media_id = media.id
        and tag.status = 'pending'
    ) then null
    else now()
  end,
  public_rejection_locked = exists (
    select 1
    from public.experience_media_tags tag
    where tag.media_id = media.id
      and tag.status in ('declined', 'removed')
  )
where exists (
  select 1
  from public.experiences experience
  where experience.cover_media_id = media.id
);

create index if not exists experience_media_public_status_idx
on public.experience_media (
  experience_id,
  public_status,
  created_at desc
)
where moderation_status = 'active';

-- ============================================================
-- PARTICIPANT-ONLY COMMENTS AND APPEARANCE REPORTS
-- ============================================================

create table if not exists public.experience_media_comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null
    references public.experience_media(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  body text not null,
  moderation_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experience_media_comments_body_check
    check (char_length(btrim(body)) between 1 and 1000),
  constraint experience_media_comments_status_check
    check (moderation_status in ('active', 'deleted'))
);

create index if not exists experience_media_comments_media_idx
on public.experience_media_comments (
  media_id,
  created_at,
  id
)
where moderation_status = 'active';

create table if not exists public.experience_media_appearance_reports (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null
    references public.experience_media(id) on delete cascade,
  reported_by_user_id uuid not null
    references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint experience_media_appearance_reports_note_check
    check (note is null or char_length(note) <= 500),
  constraint experience_media_appearance_reports_status_check
    check (status in ('active', 'resolved', 'dismissed')),
  constraint experience_media_appearance_reports_unique
    unique (media_id, reported_by_user_id)
);

create index if not exists experience_media_appearance_reports_active_idx
on public.experience_media_appearance_reports (
  media_id,
  status
);

alter table public.experience_media_comments enable row level security;
alter table public.experience_media_appearance_reports enable row level security;

revoke all on public.experience_media_comments from anon, authenticated;
revoke all on public.experience_media_appearance_reports from anon, authenticated;

-- ============================================================
-- UPDATED_AT
-- ============================================================

create or replace function public.set_experience_media_comment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_experience_media_comment_updated_at_trigger
on public.experience_media_comments;

create trigger set_experience_media_comment_updated_at_trigger
before update on public.experience_media_comments
for each row
execute function public.set_experience_media_comment_updated_at();

-- ============================================================
-- PUBLICATION CONSENT STATE
-- ============================================================

create or replace function public.recalculate_experience_media_public_status(
  p_media_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media public.experience_media%rowtype;
  v_status text;
begin
  select *
  into v_media
  from public.experience_media media
  where media.id = p_media_id
  for update;

  if not found then
    return null;
  end if;

  if v_media.moderation_status <> 'active' then
    v_status := 'private';
  elsif exists (
    select 1
    from public.experience_media_appearance_reports report
    where report.media_id = p_media_id
      and report.status = 'active'
  ) then
    v_status := 'suspended';
  elsif v_media.public_rejection_locked then
    v_status := 'rejected';
  elsif v_media.public_requested_at is null then
    v_status := 'private';
  elsif exists (
    select 1
    from public.experience_media_tags tag
    where tag.media_id = p_media_id
      and tag.status in ('declined', 'removed')
  ) then
    v_status := 'rejected';
  elsif exists (
    select 1
    from public.experience_media_tags tag
    where tag.media_id = p_media_id
      and tag.status = 'pending'
  ) then
    v_status := 'pending';
  else
    v_status := 'approved';
  end if;

  update public.experience_media
  set
    public_status = v_status,
    public_decided_at = case
      when v_status in ('approved', 'rejected', 'suspended') then now()
      else null
    end,
    public_rejection_locked = case
      when v_status = 'rejected' then true
      else public_rejection_locked
    end,
    updated_at = now()
  where id = p_media_id;

  if v_status <> 'approved' then
    update public.experiences
    set
      cover_media_id = null,
      updated_at = now()
    where cover_media_id = p_media_id;
  end if;

  return v_status;
end;
$$;

create or replace function public.recalculate_experience_media_after_tag_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_id uuid;
begin
  v_media_id := case
    when tg_op = 'DELETE' then old.media_id
    else new.media_id
  end;

  perform public.recalculate_experience_media_public_status(v_media_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists recalculate_experience_media_after_tag_change_trigger
on public.experience_media_tags;

create trigger recalculate_experience_media_after_tag_change_trigger
after insert or update or delete on public.experience_media_tags
for each row
execute function public.recalculate_experience_media_after_tag_change();

-- ============================================================
-- ACCESS RULES
-- ============================================================

create or replace function public.can_user_view_public_experience_cover(
  p_media_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan public.plans%rowtype;
  v_experience_id uuid;
  v_source_intent_id uuid;
begin
  select
    plan,
    experience.id
  into
    v_plan,
    v_experience_id
  from public.experience_media media
  join public.experiences experience on experience.id = media.experience_id
  join public.plans plan on plan.id = experience.plan_id
  where media.id = p_media_id
    and media.moderation_status = 'active'
    and media.public_status = 'approved'
    and experience.cover_media_id = media.id;

  if v_experience_id is null then
    return false;
  end if;

  if public.is_experience_participant(v_experience_id, p_user_id) then
    return true;
  end if;

  if v_plan.visibility = 'public' then
    return true;
  end if;

  if v_plan.visibility = 'friends'
     and p_user_id is not null
     and public.are_users_friends(v_plan.host_user_id, p_user_id)
  then
    return true;
  end if;

  select plan_intent.intent_id
  into v_source_intent_id
  from public.plan_intents plan_intent
  where plan_intent.plan_id = v_plan.id
    and plan_intent.relationship = 'host_source'
    and plan_intent.status = 'active'
  limit 1;

  return v_source_intent_id is not null
    and public.can_user_view_intent_activity(v_source_intent_id, p_user_id);
end;
$$;

create or replace function public.can_user_view_experience_media(
  p_media_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_experience_id uuid;
  v_public_status text;
  v_is_cover boolean;
begin
  select
    media.experience_id,
    media.public_status,
    experience.cover_media_id = media.id
  into
    v_experience_id,
    v_public_status,
    v_is_cover
  from public.experience_media media
  join public.experiences experience on experience.id = media.experience_id
  where media.id = p_media_id
    and media.moderation_status = 'active';

  if v_experience_id is null then
    return false;
  end if;

  if public.is_experience_participant(v_experience_id, p_user_id) then
    return true;
  end if;

  if v_public_status <> 'approved' or not v_is_cover then
    return false;
  end if;

  return public.can_user_view_public_experience_cover(p_media_id, p_user_id);
end;
$$;

-- ============================================================
-- MEDIA CREATION
-- ============================================================

create or replace function public.add_experience_uploaded_media_v2(
  p_experience_id uuid,
  p_storage_path text,
  p_media_type text,
  p_mime_type text,
  p_original_filename text,
  p_caption text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_storage_path text;
  v_media_id uuid;
  v_filename text;
begin
  if not public.can_user_contribute_to_experience(p_experience_id, v_user_id) then
    raise exception 'Only the Host, Co-host or an attended participant may add Activity media.'
      using errcode = '42501';
  end if;

  if p_media_type not in ('photo', 'video') then
    raise exception 'Unsupported uploaded media type.' using errcode = '22023';
  end if;

  if p_media_type = 'photo'
     and coalesce(p_mime_type, '') not in ('image/jpeg', 'image/png', 'image/webp')
  then
    raise exception 'Use JPG, PNG or WebP for photos.' using errcode = '22023';
  end if;

  if p_media_type = 'video'
     and coalesce(p_mime_type, '') not in ('video/mp4', 'video/webm', 'video/quicktime')
  then
    raise exception 'Use MP4, WebM or MOV for videos.' using errcode = '22023';
  end if;

  v_storage_path := btrim(coalesce(p_storage_path, ''));

  if v_storage_path = ''
     or v_storage_path not like p_experience_id::text || '/' || v_user_id::text || '/%'
  then
    raise exception 'Invalid Activity media storage path.' using errcode = '22023';
  end if;

  v_filename := nullif(btrim(coalesce(p_original_filename, '')), '');

  insert into public.experience_media (
    experience_id,
    uploader_user_id,
    media_type,
    storage_path,
    mime_type,
    original_filename,
    caption,
    visibility,
    public_status
  )
  values (
    p_experience_id,
    v_user_id,
    p_media_type,
    v_storage_path,
    p_mime_type,
    v_filename,
    nullif(btrim(coalesce(p_caption, '')), ''),
    'participants',
    'private'
  )
  returning id into v_media_id;

  return v_media_id;
end;
$$;

create or replace function public.add_experience_photo_media(
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
begin
  return public.add_experience_uploaded_media_v2(
    p_experience_id,
    p_storage_path,
    'photo',
    'image/jpeg',
    null,
    p_caption
  );
end;
$$;

create or replace function public.add_experience_external_media_v2(
  p_experience_id uuid,
  p_media_kind text,
  p_provider text,
  p_url text,
  p_label text,
  p_caption text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_media_id uuid;
  v_media_type text;
  v_url text;
begin
  if not public.can_user_contribute_to_experience(p_experience_id, v_user_id) then
    raise exception 'Only Activity participants may add media links.' using errcode = '42501';
  end if;

  if p_media_kind not in ('photo', 'video', 'album', 'post') then
    raise exception 'Unsupported media link type.' using errcode = '22023';
  end if;

  if p_provider not in ('direct', 'google_photos', 'instagram', 'youtube', 'vimeo', 'other') then
    raise exception 'Unsupported media provider.' using errcode = '22023';
  end if;

  v_url := btrim(coalesce(p_url, ''));
  if v_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Use a valid HTTPS link.' using errcode = '22023';
  end if;

  v_media_type := case p_media_kind
    when 'photo' then 'external_photo'
    when 'video' then 'external_video'
    when 'album' then 'external_album'
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
    visibility,
    public_status
  )
  values (
    p_experience_id,
    v_user_id,
    v_media_type,
    p_provider,
    v_url,
    nullif(btrim(coalesce(p_label, '')), ''),
    nullif(btrim(coalesce(p_caption, '')), ''),
    'participants',
    'private'
  )
  returning id into v_media_id;

  return v_media_id;
end;
$$;

create or replace function public.add_experience_external_media(
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
  v_media_kind text;
begin
  v_media_kind := case
    when p_provider = 'google_photos' then 'album'
    when p_provider in ('youtube', 'vimeo') then 'video'
    when p_provider = 'direct' then 'photo'
    else 'post'
  end;

  return public.add_experience_external_media_v2(
    p_experience_id,
    v_media_kind,
    p_provider,
    p_url,
    p_label,
    p_caption
  );
end;
$$;

create or replace function public.remove_experience_media_v2(
  p_media_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_media public.experience_media%rowtype;
begin
  select *
  into v_media
  from public.experience_media media
  where media.id = p_media_id
  for update;

  if not found then
    raise exception 'Activity media not found.' using errcode = 'P0002';
  end if;

  if v_user_id is null
     or (
       v_media.uploader_user_id <> v_user_id
       and not public.is_experience_manager(v_media.experience_id, v_user_id)
     )
  then
    raise exception 'You cannot remove this Activity media.' using errcode = '42501';
  end if;

  update public.experience_media
  set moderation_status = 'removed', updated_at = now()
  where id = p_media_id;

  update public.experiences
  set cover_media_id = null, updated_at = now()
  where cover_media_id = p_media_id;

  return v_media.storage_path;
end;
$$;

create or replace function public.delete_experience_media(
  p_media_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.remove_experience_media_v2(p_media_id);
  return p_media_id;
end;
$$;

-- ============================================================
-- TAGGING, PUBLICATION, COVER AND APPEARANCE CONTROL
-- ============================================================

create or replace function public.tag_experience_media_participant(
  p_media_id uuid,
  p_tagged_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_experience_id uuid;
  v_plan_id uuid;
  v_tag_id uuid;
  v_initial_status text;
begin
  select media.experience_id, experience.plan_id
  into v_experience_id, v_plan_id
  from public.experience_media media
  join public.experiences experience on experience.id = media.experience_id
  where media.id = p_media_id
    and media.media_type in ('photo', 'video', 'external_photo', 'external_video')
    and media.moderation_status = 'active';

  if v_experience_id is null then
    raise exception 'Activity media not found.' using errcode = 'P0002';
  end if;

  if not public.can_user_contribute_to_experience(v_experience_id, v_user_id) then
    raise exception 'You cannot tag participants in this Activity.' using errcode = '42501';
  end if;

  if public.reputation_is_managed_minor(p_tagged_user_id) then
    raise exception 'Managed minor profiles cannot be tagged in shared Activity media.'
      using errcode = '42501';
  end if;

  if not (
    exists (
      select 1 from public.plans plan
      where plan.id = v_plan_id
        and plan.host_user_id = p_tagged_user_id
    )
    or exists (
      select 1 from public.plan_members member
      where member.plan_id = v_plan_id
        and member.user_id = p_tagged_user_id
        and member.status = 'active'
        and (
          member.role = 'co_host'
          or member.attendance_status = 'attended'
        )
    )
  ) then
    raise exception 'Only attended Activity participants may be tagged.' using errcode = '22023';
  end if;

  v_initial_status := case when p_tagged_user_id = v_user_id then 'approved' else 'pending' end;

  insert into public.experience_media_tags as existing_tag (
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
    case when v_initial_status = 'approved' then now() else null end
  )
  on conflict (media_id, tagged_user_id)
  do update set
    tagged_by_user_id = excluded.tagged_by_user_id,
    status = case
      when existing_tag.status in ('declined', 'removed')
        then existing_tag.status
      else excluded.status
    end,
    responded_at = case
      when existing_tag.status in ('declined', 'removed')
        then existing_tag.responded_at
      else excluded.responded_at
    end,
    updated_at = now()
  returning id into v_tag_id;

  perform public.recalculate_experience_media_public_status(p_media_id);
  return v_tag_id;
end;
$$;

create or replace function public.respond_to_experience_media_tag(
  p_tag_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_media_id uuid;
begin
  if p_status not in ('approved', 'declined', 'removed') then
    raise exception 'Unsupported tag response.' using errcode = '22023';
  end if;

  update public.experience_media_tags tag
  set
    status = p_status,
    responded_at = now(),
    updated_at = now()
  where tag.id = p_tag_id
    and tag.tagged_user_id = v_user_id
  returning tag.media_id into v_media_id;

  if v_media_id is null then
    raise exception 'Tag not found or access denied.' using errcode = 'P0002';
  end if;

  if p_status in ('declined', 'removed') then
    update public.experience_media
    set public_rejection_locked = true, updated_at = now()
    where id = v_media_id;
  end if;

  perform public.recalculate_experience_media_public_status(v_media_id);
  return p_tag_id;
end;
$$;

create or replace function public.request_experience_media_publication(
  p_media_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_media public.experience_media%rowtype;
begin
  select * into v_media
  from public.experience_media media
  where media.id = p_media_id
    and media.moderation_status = 'active'
  for update;

  if not found then
    raise exception 'Activity media not found.' using errcode = 'P0002';
  end if;

  if v_user_id is null
     or (
       v_media.uploader_user_id <> v_user_id
       and not public.is_experience_manager(v_media.experience_id, v_user_id)
     )
  then
    raise exception 'Only the uploader or an Activity manager may request public sharing.'
      using errcode = '42501';
  end if;

  if v_media.media_type <> 'photo' then
    raise exception 'Only photos may be approved for use as a public Activity cover.'
      using errcode = '22023';
  end if;

  if v_media.public_rejection_locked then
    raise exception 'A participant declined public sharing. Upload a revised version without that person.'
      using errcode = '42501';
  end if;

  update public.experience_media
  set
    public_requested_at = now(),
    public_requested_by_user_id = v_user_id,
    public_decided_at = null,
    public_status = 'pending',
    updated_at = now()
  where id = p_media_id;

  return public.recalculate_experience_media_public_status(p_media_id);
end;
$$;

create or replace function public.cancel_experience_media_publication(
  p_media_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_media public.experience_media%rowtype;
begin
  select * into v_media
  from public.experience_media media
  where media.id = p_media_id
  for update;

  if not found then
    raise exception 'Activity media not found.' using errcode = 'P0002';
  end if;

  if v_user_id is null
     or (
       v_media.uploader_user_id <> v_user_id
       and not public.is_experience_manager(v_media.experience_id, v_user_id)
     )
  then
    raise exception 'You cannot cancel this public sharing request.' using errcode = '42501';
  end if;

  update public.experience_media
  set
    public_requested_at = null,
    public_requested_by_user_id = null,
    public_decided_at = null,
    public_status = 'private',
    updated_at = now()
  where id = p_media_id;

  update public.experiences
  set cover_media_id = null, updated_at = now()
  where cover_media_id = p_media_id;

  return p_media_id;
end;
$$;

create or replace function public.set_experience_cover_media_v2(
  p_experience_id uuid,
  p_media_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not public.is_experience_manager(p_experience_id, v_user_id) then
    raise exception 'Only the Primary Host or an active Co-host may choose the Activity cover.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.experience_media media
    where media.id = p_media_id
      and media.experience_id = p_experience_id
      and media.media_type = 'photo'
      and media.moderation_status = 'active'
      and media.public_status = 'approved'
  ) then
    raise exception 'The public cover must be an approved photo from this Activity.'
      using errcode = '22023';
  end if;

  update public.experiences
  set cover_media_id = p_media_id, updated_at = now()
  where id = p_experience_id;

  return p_media_id;
end;
$$;

create or replace function public.set_experience_cover_media(
  p_experience_id uuid,
  p_media_id uuid
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.set_experience_cover_media_v2(p_experience_id, p_media_id);
$$;

create or replace function public.report_experience_media_appearance(
  p_media_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_experience_id uuid;
  v_report_id uuid;
begin
  select media.experience_id
  into v_experience_id
  from public.experience_media media
  where media.id = p_media_id
    and media.moderation_status = 'active';

  if v_experience_id is null then
    raise exception 'Activity media not found.' using errcode = 'P0002';
  end if;

  if not public.is_experience_participant(v_experience_id, v_user_id) then
    raise exception 'Only Activity participants may report that they appear in media.'
      using errcode = '42501';
  end if;

  insert into public.experience_media_appearance_reports (
    media_id,
    reported_by_user_id,
    note,
    status,
    resolved_at
  )
  values (
    p_media_id,
    v_user_id,
    nullif(btrim(coalesce(p_note, '')), ''),
    'active',
    null
  )
  on conflict (media_id, reported_by_user_id)
  do update set
    note = excluded.note,
    status = 'active',
    resolved_at = null,
    created_at = now()
  returning id into v_report_id;

  update public.experience_media
  set public_rejection_locked = true, updated_at = now()
  where id = p_media_id;

  perform public.recalculate_experience_media_public_status(p_media_id);
  return v_report_id;
end;
$$;

-- ============================================================
-- PARTICIPANT COMMENTS
-- ============================================================

create or replace function public.add_experience_media_comment(
  p_media_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_experience_id uuid;
  v_comment_id uuid;
  v_body text;
begin
  select media.experience_id
  into v_experience_id
  from public.experience_media media
  where media.id = p_media_id
    and media.moderation_status = 'active';

  if v_experience_id is null then
    raise exception 'Activity media not found.' using errcode = 'P0002';
  end if;

  if not public.is_experience_participant(v_experience_id, v_user_id) then
    raise exception 'Only Activity participants may comment on gallery media.'
      using errcode = '42501';
  end if;

  v_body := nullif(btrim(coalesce(p_body, '')), '');
  if v_body is null or char_length(v_body) > 1000 then
    raise exception 'A comment between 1 and 1000 characters is required.'
      using errcode = '22023';
  end if;

  insert into public.experience_media_comments (media_id, user_id, body)
  values (p_media_id, v_user_id, v_body)
  returning id into v_comment_id;

  return v_comment_id;
end;
$$;

create or replace function public.delete_experience_media_comment(
  p_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment public.experience_media_comments%rowtype;
  v_experience_id uuid;
begin
  select media_comment, media.experience_id
  into v_comment, v_experience_id
  from public.experience_media_comments media_comment
  join public.experience_media media on media.id = media_comment.media_id
  where media_comment.id = p_comment_id
  for update of media_comment;

  if not found then
    raise exception 'Comment not found.' using errcode = 'P0002';
  end if;

  if v_comment.user_id <> v_user_id
     and not public.is_experience_manager(v_experience_id, v_user_id)
  then
    raise exception 'You cannot remove this comment.' using errcode = '42501';
  end if;

  update public.experience_media_comments
  set moderation_status = 'deleted', updated_at = now()
  where id = p_comment_id;

  return p_comment_id;
end;
$$;

-- ============================================================
-- ENRICHED EXPERIENCE BUNDLE
-- ============================================================

create or replace function public.get_visible_experience_gallery_v2(
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
  v_user_id uuid := auth.uid();
  v_experience_id uuid;
  v_is_participant boolean;
  v_is_manager boolean;
  v_media jsonb;
begin
  v_bundle := public.get_visible_experience_by_plan_safe(p_plan_id);

  if v_bundle is null then
    return null;
  end if;

  begin
    v_experience_id := nullif(v_bundle #>> '{experience,id}', '')::uuid;
  exception when others then
    v_experience_id := null;
  end;

  if v_experience_id is null then
    return v_bundle;
  end if;

  v_is_participant := public.is_experience_participant(v_experience_id, v_user_id);
  v_is_manager := public.is_experience_manager(v_experience_id, v_user_id);

  if v_is_participant then
    select coalesce(
      jsonb_agg(
      jsonb_build_object(
        'id', media.id,
        'media_type', media.media_type,
        'provider', media.provider,
        'storage_path', media.storage_path,
        'mime_type', media.mime_type,
        'original_filename', media.original_filename,
        'external_url', media.external_url,
        'label', media.label,
        'caption', media.caption,
        'visibility', 'participants',
        'public_status', media.public_status,
        'public_requested_at', media.public_requested_at,
        'public_rejection_locked', media.public_rejection_locked,
        'uploader_user_id', media.uploader_user_id,
        'uploader_name', uploader.full_name,
        'uploader_username', uploader.username,
        'uploader_avatar_url', uploader.avatar_url,
        'created_at', media.created_at,
        'is_cover', experience.cover_media_id = media.id,
        'can_delete', (
          v_user_id is not null
          and (
            media.uploader_user_id = v_user_id
            or v_is_manager
          )
        ),
        'can_request_public', (
          v_is_participant
          and not media.public_rejection_locked
          and media.media_type = 'photo'
          and (
            media.uploader_user_id = v_user_id
            or v_is_manager
          )
        ),
        'can_set_cover', (
          v_is_manager
          and media.media_type = 'photo'
          and media.public_status = 'approved'
        ),
        'can_comment', v_is_participant,
        'appearance_reported', exists (
          select 1
          from public.experience_media_appearance_reports report
          where report.media_id = media.id
            and report.reported_by_user_id = v_user_id
            and report.status = 'active'
        ),
        'tags', case
          when v_is_participant then coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', tag.id,
                  'tagged_user_id', tag.tagged_user_id,
                  'full_name', tagged_profile.full_name,
                  'username', tagged_profile.username,
                  'avatar_url', tagged_profile.avatar_url,
                  'status', tag.status,
                  'is_current_viewer', tag.tagged_user_id = v_user_id
                )
                order by tagged_profile.full_name nulls last, tagged_profile.username, tag.id
              )
              from public.experience_media_tags tag
              join public.profiles tagged_profile on tagged_profile.id = tag.tagged_user_id
              where tag.media_id = media.id
            ),
            '[]'::jsonb
          )
          else '[]'::jsonb
        end,
        'comments', case
          when v_is_participant then coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', comment.id,
                  'body', comment.body,
                  'user_id', comment.user_id,
                  'full_name', comment_profile.full_name,
                  'username', comment_profile.username,
                  'avatar_url', comment_profile.avatar_url,
                  'created_at', comment.created_at,
                  'can_delete', (
                    comment.user_id = v_user_id
                    or v_is_manager
                  )
                )
                order by comment.created_at, comment.id
              )
              from public.experience_media_comments comment
              join public.profiles comment_profile on comment_profile.id = comment.user_id
              where comment.media_id = media.id
                and comment.moderation_status = 'active'
            ),
            '[]'::jsonb
          )
          else '[]'::jsonb
        end
      )
      order by
        case when experience.cover_media_id = media.id then 0 else 1 end,
        media.created_at desc,
        media.id
    ),
    '[]'::jsonb
  )
  into v_media
  from public.experience_media media
  join public.experiences experience on experience.id = media.experience_id
  join public.profiles uploader on uploader.id = media.uploader_user_id
  where media.experience_id = v_experience_id
    and media.moderation_status = 'active'
      and public.can_user_view_experience_media(media.id, v_user_id);
  else
    v_media := '[]'::jsonb;
  end if;

  v_bundle := jsonb_set(v_bundle, '{media}', v_media, true);
  v_bundle := jsonb_set(
    v_bundle,
    '{experience,viewer_is_participant}',
    to_jsonb(v_is_participant),
    true
  );

  return v_bundle;
end;
$$;

create or replace function public.get_visible_public_experience_covers(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  media_id uuid,
  storage_path text,
  external_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    experience.plan_id,
    media.id,
    media.storage_path,
    media.external_url
  from public.experiences experience
  join public.experience_media media on media.id = experience.cover_media_id
  where experience.plan_id = any(coalesce(p_plan_ids, array[]::uuid[]))
    and media.media_type = 'photo'
    and media.moderation_status = 'active'
    and media.public_status = 'approved'
    and public.can_user_view_public_experience_cover(media.id, auth.uid())
  order by experience.plan_id;
$$;

-- ============================================================
-- PRIVATE STORAGE FOR PHOTOS AND SHORT VIDEOS
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'experience-media',
  'experience-media',
  false,
  157286400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Experience contributors can upload photos" on storage.objects;
drop policy if exists "Experience contributors can upload media" on storage.objects;

create policy "Experience contributors can upload media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'experience-media'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_user_contribute_to_experience(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);

drop policy if exists "Visible Experience photos can be read" on storage.objects;
drop policy if exists "Visible Experience media can be read" on storage.objects;

create policy "Visible Experience media can be read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'experience-media'
  and exists (
    select 1
    from public.experience_media media
    where media.storage_path = storage.objects.name
      and media.media_type in ('photo', 'video')
      and media.moderation_status = 'active'
      and public.can_user_view_experience_media(media.id, auth.uid())
  )
);

-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================

revoke all on function public.recalculate_experience_media_public_status(uuid) from public;
revoke all on function public.can_user_view_public_experience_cover(uuid, uuid) from public;
revoke all on function public.add_experience_uploaded_media_v2(uuid, text, text, text, text, text) from public;
revoke all on function public.remove_experience_media_v2(uuid) from public;
revoke all on function public.add_experience_external_media_v2(uuid, text, text, text, text, text) from public;
revoke all on function public.add_experience_external_media(uuid, text, text, text, text, text) from public;
revoke all on function public.delete_experience_media(uuid) from public;
revoke all on function public.request_experience_media_publication(uuid) from public;
revoke all on function public.cancel_experience_media_publication(uuid) from public;
revoke all on function public.set_experience_cover_media_v2(uuid, uuid) from public;
revoke all on function public.report_experience_media_appearance(uuid, text) from public;
revoke all on function public.add_experience_media_comment(uuid, text) from public;
revoke all on function public.delete_experience_media_comment(uuid) from public;
revoke all on function public.get_visible_experience_gallery_v2(uuid) from public;
revoke all on function public.get_visible_public_experience_covers(uuid[]) from public;

grant execute on function public.can_user_view_public_experience_cover(uuid, uuid) to anon, authenticated;
grant execute on function public.add_experience_uploaded_media_v2(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.remove_experience_media_v2(uuid) to authenticated;
grant execute on function public.add_experience_external_media_v2(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.add_experience_external_media(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.delete_experience_media(uuid) to authenticated;
grant execute on function public.request_experience_media_publication(uuid) to authenticated;
grant execute on function public.cancel_experience_media_publication(uuid) to authenticated;
grant execute on function public.set_experience_cover_media_v2(uuid, uuid) to authenticated;
grant execute on function public.report_experience_media_appearance(uuid, text) to authenticated;
grant execute on function public.add_experience_media_comment(uuid, text) to authenticated;
grant execute on function public.delete_experience_media_comment(uuid) to authenticated;
grant execute on function public.get_visible_experience_gallery_v2(uuid) to anon, authenticated;
grant execute on function public.get_visible_public_experience_covers(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
