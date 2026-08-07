begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- PLAN-SPECIFIC SHARED TITLE
-- ============================================================

alter table public.plans
  add column if not exists
    shared_title text;

alter table public.plans
  drop constraint if exists
    plans_shared_title_length_check;

alter table public.plans
  add constraint
    plans_shared_title_length_check
  check (
    shared_title is null
    or (
      char_length(
        btrim(
          shared_title
        )
      ) between 1 and 120
    )
  ) not valid;

alter table public.plans
  validate constraint
    plans_shared_title_length_check;

-- ============================================================
-- EXPERIENCE RECORDS
-- ============================================================

create table if not exists
  public.experiences (
    id uuid primary key
      default gen_random_uuid(),
    plan_id uuid not null unique
      references public.plans(id)
      on delete cascade,
    title text not null,
    story text,
    visibility text not null
      default 'participants',
    cover_media_id uuid,
    created_by_user_id uuid not null
      references public.profiles(id)
      on delete restrict,
    completed_at timestamptz,
    created_at timestamptz not null
      default now(),
    updated_at timestamptz not null
      default now(),
    constraint experiences_title_length_check
      check (
        char_length(
          btrim(
            title
          )
        ) between 1 and 120
      ),
    constraint experiences_story_length_check
      check (
        story is null
        or char_length(story) <= 2000
      ),
    constraint experiences_visibility_check
      check (
        visibility in (
          'participants',
          'friends',
          'public'
        )
      )
  );

create table if not exists
  public.experience_media (
    id uuid primary key
      default gen_random_uuid(),
    experience_id uuid not null
      references public.experiences(id)
      on delete cascade,
    uploader_user_id uuid not null
      references public.profiles(id)
      on delete restrict,
    media_type text not null,
    provider text,
    storage_path text,
    external_url text,
    label text,
    caption text,
    visibility text not null
      default 'participants',
    moderation_status text not null
      default 'active',
    created_at timestamptz not null
      default now(),
    updated_at timestamptz not null
      default now(),
    constraint experience_media_type_check
      check (
        media_type in (
          'photo',
          'external_album',
          'external_video',
          'external_post'
        )
      ),
    constraint experience_media_provider_check
      check (
        provider is null
        or provider in (
          'google_photos',
          'instagram',
          'youtube',
          'vimeo',
          'other'
        )
      ),
    constraint experience_media_visibility_check
      check (
        visibility in (
          'participants',
          'friends',
          'public'
        )
      ),
    constraint experience_media_status_check
      check (
        moderation_status in (
          'active',
          'removed'
        )
      ),
    constraint experience_media_caption_length_check
      check (
        caption is null
        or char_length(caption) <= 240
      ),
    constraint experience_media_label_length_check
      check (
        label is null
        or char_length(label) <= 100
      ),
    constraint experience_media_https_check
      check (
        external_url is null
        or external_url ~* '^https://[^[:space:]]+$'
      ),
    constraint experience_media_shape_check
      check (
        (
          media_type = 'photo'
          and storage_path is not null
          and external_url is null
        )
        or (
          media_type <> 'photo'
          and storage_path is null
          and external_url is not null
        )
      )
  );

create table if not exists
  public.experience_media_tags (
    id uuid primary key
      default gen_random_uuid(),
    media_id uuid not null
      references public.experience_media(id)
      on delete cascade,
    tagged_user_id uuid not null
      references public.profiles(id)
      on delete cascade,
    tagged_by_user_id uuid not null
      references public.profiles(id)
      on delete cascade,
    status text not null
      default 'pending',
    responded_at timestamptz,
    created_at timestamptz not null
      default now(),
    updated_at timestamptz not null
      default now(),
    constraint experience_media_tags_status_check
      check (
        status in (
          'pending',
          'approved',
          'declined',
          'removed'
        )
      ),
    constraint experience_media_tags_unique
      unique (
        media_id,
        tagged_user_id
      )
  );

alter table public.experiences
  drop constraint if exists
    experiences_cover_media_id_fkey;

alter table public.experiences
  add constraint
    experiences_cover_media_id_fkey
  foreign key (
    cover_media_id
  )
  references public.experience_media(id)
  on delete set null;

create index if not exists
  experiences_plan_id_idx
on public.experiences (
  plan_id
);

create index if not exists
  experience_media_experience_id_idx
on public.experience_media (
  experience_id,
  created_at
);

create index if not exists
  experience_media_storage_path_idx
on public.experience_media (
  storage_path
)
where storage_path is not null;

create index if not exists
  experience_media_tags_user_idx
on public.experience_media_tags (
  tagged_user_id,
  status
);

-- ============================================================
-- GENERIC UPDATED_AT
-- ============================================================

create or replace function
  public.set_experience_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at :=
    now();

  return new;
end;
$$;

drop trigger if exists
  set_experience_updated_at_trigger
on public.experiences;

create trigger
  set_experience_updated_at_trigger
before update
on public.experiences
for each row
execute function
  public.set_experience_updated_at();

drop trigger if exists
  set_experience_media_updated_at_trigger
on public.experience_media;

create trigger
  set_experience_media_updated_at_trigger
before update
on public.experience_media
for each row
execute function
  public.set_experience_updated_at();

drop trigger if exists
  set_experience_media_tag_updated_at_trigger
on public.experience_media_tags;

create trigger
  set_experience_media_tag_updated_at_trigger
before update
on public.experience_media_tags
for each row
execute function
  public.set_experience_updated_at();

-- ============================================================
-- ACCESS HELPERS
-- ============================================================

create or replace function
  public.is_experience_manager(
    p_experience_id uuid,
    p_user_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.experiences experience
      join public.plans plan
        on plan.id =
          experience.plan_id
      where
        experience.id =
          p_experience_id
        and (
          plan.host_user_id =
            p_user_id
          or exists (
            select 1
            from public.plan_members member
            where
              member.plan_id =
                plan.id
              and member.user_id =
                p_user_id
              and member.status =
                'active'
              and member.role =
                'co_host'
          )
        )
    );
$$;

create or replace function
  public.is_experience_participant(
    p_experience_id uuid,
    p_user_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.experiences experience
      join public.plans plan
        on plan.id =
          experience.plan_id
      where
        experience.id =
          p_experience_id
        and (
          plan.host_user_id =
            p_user_id
          or exists (
            select 1
            from public.plan_members member
            where
              member.plan_id =
                plan.id
              and member.user_id =
                p_user_id
              and member.status =
                'active'
              and (
                member.role in (
                  'host',
                  'co_host'
                )
                or member.attendance_status =
                  'attended'
              )
          )
        )
    );
$$;

create or replace function
  public.can_user_contribute_to_experience(
    p_experience_id uuid,
    p_user_id uuid
      default auth.uid()
  )
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and not public.reputation_is_managed_minor(
      p_user_id
    )
    and exists (
      select 1
      from public.experiences experience
      join public.plans plan
        on plan.id =
          experience.plan_id
      where
        experience.id =
          p_experience_id
        and plan.status =
          'completed'
        and (
          plan.host_user_id =
            p_user_id
          or exists (
            select 1
            from public.plan_members member
            where
              member.plan_id =
                plan.id
              and member.user_id =
                p_user_id
              and member.status =
                'active'
              and (
                member.role =
                  'co_host'
                or member.attendance_status =
                  'attended'
              )
          )
        )
    );
$$;

create or replace function
  public.can_user_view_experience(
    p_experience_id uuid,
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
  v_visibility text;
  v_host_user_id uuid;
begin
  select
    experience.visibility,
    plan.host_user_id
  into
    v_visibility,
    v_host_user_id
  from public.experiences experience
  join public.plans plan
    on plan.id =
      experience.plan_id
  where
    experience.id =
      p_experience_id;

  if v_host_user_id is null then
    return false;
  end if;

  if public.is_experience_participant(
    p_experience_id,
    p_user_id
  ) then
    return true;
  end if;

  if v_visibility =
    'public'
  then
    return true;
  end if;

  if
    v_visibility =
      'friends'
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

-- ============================================================
-- EXPERIENCE CREATION AND TITLE SYNC
-- ============================================================

create or replace function
  public.sync_completed_plan_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status =
    'completed'
  then
    insert into public.experiences (
      plan_id,
      title,
      visibility,
      created_by_user_id,
      completed_at
    )
    values (
      new.id,
      coalesce(
        nullif(
          btrim(
            new.shared_title
          ),
          ''
        ),
        nullif(
          btrim(
            new.title
          ),
          ''
        ),
        'Shared Experience'
      ),
      'participants',
      new.host_user_id,
      new.completed_at
    )
    on conflict (
      plan_id
    )
    do update
    set
      title =
        coalesce(
          nullif(
            btrim(
              new.shared_title
            ),
            ''
          ),
          public.experiences.title
        ),
      completed_at =
        coalesce(
          new.completed_at,
          public.experiences.completed_at
        ),
      updated_at =
        now();
  end if;

  return new;
end;
$$;

drop trigger if exists
  sync_completed_plan_experience_trigger
on public.plans;

create trigger
  sync_completed_plan_experience_trigger
after insert or update of
  status,
  completed_at,
  shared_title
on public.plans
for each row
execute function
  public.sync_completed_plan_experience();

insert into public.experiences (
  plan_id,
  title,
  visibility,
  created_by_user_id,
  completed_at
)
select
  plan.id,
  coalesce(
    nullif(
      btrim(
        plan.shared_title
      ),
      ''
    ),
    nullif(
      btrim(
        plan.title
      ),
      ''
    ),
    'Shared Experience'
  ),
  'participants',
  plan.host_user_id,
  plan.completed_at
from public.plans plan
where
  plan.status =
    'completed'
on conflict (
  plan_id
)
do nothing;

create or replace function
  public.update_shared_activity_title(
    p_plan_id uuid,
    p_shared_title text
  )
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_title text;
  v_plan_status text;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  v_title :=
    nullif(
      btrim(
        coalesce(
          p_shared_title,
          ''
        )
      ),
      ''
    );

  if
    v_title is not null
    and char_length(
      v_title
    ) > 120
  then
    raise exception
      'The shared title may contain at most 120 characters.'
      using errcode = '22023';
  end if;

  select
    plan.status
  into
    v_plan_status
  from public.plans plan
  where
    plan.id =
      p_plan_id
    and (
      plan.host_user_id =
        v_user_id
      or exists (
        select 1
        from public.plan_members member
        where
          member.plan_id =
            plan.id
          and member.user_id =
            v_user_id
          and member.status =
            'active'
          and member.role =
            'co_host'
      )
    )
  for update;

  if v_plan_status is null then
    raise exception
      'Plan not found or access denied.'
      using errcode = 'P0002';
  end if;

  if v_plan_status =
    'cancelled'
  then
    raise exception
      'A cancelled Plan cannot be renamed.'
      using errcode = '22023';
  end if;

  update public.plans
  set
    shared_title =
      v_title,
    updated_at =
      now()
  where
    id =
      p_plan_id;

  update public.experiences
  set
    title =
      coalesce(
        v_title,
        (
          select
            plan.title
          from public.plans plan
          where
            plan.id =
              p_plan_id
        ),
        'Shared Experience'
      ),
    updated_at =
      now()
  where
    plan_id =
      p_plan_id;

  return v_title;
end;
$$;

-- ============================================================
-- EXPERIENCE QUERY
-- ============================================================

create or replace function
  public.get_visible_experience_by_plan(
    p_plan_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan public.plans%rowtype;
  v_experience public.experiences%rowtype;
  v_is_manager boolean;
  v_is_participant boolean;
  v_can_view_plan boolean;
  v_can_view_experience boolean;
  v_source_intent_id uuid;
  v_activity_name text;
begin
  v_user_id :=
    auth.uid();

  select *
  into
    v_plan
  from public.plans plan
  where
    plan.id =
      p_plan_id;

  if not found then
    return null;
  end if;

  select
    plan_intent.intent_id
  into
    v_source_intent_id
  from public.plan_intents plan_intent
  where
    plan_intent.plan_id =
      p_plan_id
    and plan_intent.relationship =
      'host_source'
    and plan_intent.status =
      'active'
  limit 1;

  v_is_manager :=
    v_user_id is not null
    and (
      v_plan.host_user_id =
        v_user_id
      or exists (
        select 1
        from public.plan_members member
        where
          member.plan_id =
            p_plan_id
          and member.user_id =
            v_user_id
          and member.status =
            'active'
          and member.role =
            'co_host'
      )
    );

  v_is_participant :=
    v_user_id is not null
    and (
      v_plan.host_user_id =
        v_user_id
      or exists (
        select 1
        from public.plan_members member
        where
          member.plan_id =
            p_plan_id
          and member.user_id =
            v_user_id
          and member.status =
            'active'
      )
    );

  v_can_view_plan :=
    v_is_participant
    or v_plan.visibility =
      'public'
    or (
      v_plan.visibility =
        'friends'
      and v_user_id is not null
      and public.are_users_friends(
        v_plan.host_user_id,
        v_user_id
      )
    )
    or (
      v_source_intent_id is not null
      and public.can_user_view_intent_activity(
        v_source_intent_id,
        v_user_id
      )
    );

  if not v_can_view_plan then
    return null;
  end if;

  select *
  into
    v_experience
  from public.experiences experience
  where
    experience.plan_id =
      p_plan_id;

  select
    activity.name
  into
    v_activity_name
  from public.activities activity
  where
    activity.id =
      v_plan.activity_id;

  if v_experience.id is null then
    return jsonb_build_object(
      'shared_title',
        case
          when v_is_participant
            then v_plan.shared_title
          else null
        end,
      'canonical_activity_name',
        v_activity_name,
      'experience',
        null,
      'media',
        '[]'::jsonb,
      'tag_candidates',
        '[]'::jsonb
    );
  end if;

  v_can_view_experience :=
    public.can_user_view_experience(
      v_experience.id,
      v_user_id
    );

  if not v_can_view_experience then
    return jsonb_build_object(
      'shared_title',
        null,
      'canonical_activity_name',
        v_activity_name,
      'experience',
        null,
      'media',
        '[]'::jsonb,
      'tag_candidates',
        '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'shared_title',
      v_experience.title,
    'canonical_activity_name',
      v_activity_name,
    'experience',
      jsonb_build_object(
        'id',
          v_experience.id,
        'plan_id',
          v_experience.plan_id,
        'title',
          v_experience.title,
        'story',
          v_experience.story,
        'visibility',
          v_experience.visibility,
        'cover_media_id',
          v_experience.cover_media_id,
        'completed_at',
          v_experience.completed_at,
        'can_manage',
          v_is_manager,
        'can_contribute',
          public.can_user_contribute_to_experience(
            v_experience.id,
            v_user_id
          )
      ),
    'media',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                  media.id,
                'media_type',
                  media.media_type,
                'provider',
                  media.provider,
                'storage_path',
                  media.storage_path,
                'external_url',
                  media.external_url,
                'label',
                  media.label,
                'caption',
                  media.caption,
                'visibility',
                  media.visibility,
                'uploader_user_id',
                  media.uploader_user_id,
                'uploader_name',
                  uploader.full_name,
                'uploader_username',
                  uploader.username,
                'uploader_avatar_url',
                  uploader.avatar_url,
                'created_at',
                  media.created_at,
                'is_cover',
                  media.id =
                    v_experience.cover_media_id,
                'can_delete',
                  v_user_id is not null
                  and (
                    media.uploader_user_id =
                      v_user_id
                    or v_is_manager
                  ),
                'tags',
                  coalesce(
                    (
                      select
                        jsonb_agg(
                          jsonb_build_object(
                            'id',
                              tag.id,
                            'tagged_user_id',
                              tag.tagged_user_id,
                            'full_name',
                              tagged_profile.full_name,
                            'username',
                              tagged_profile.username,
                            'avatar_url',
                              tagged_profile.avatar_url,
                            'status',
                              tag.status,
                            'is_current_viewer',
                              tag.tagged_user_id =
                                v_user_id
                          )
                          order by
                            tagged_profile.full_name,
                            tag.created_at
                        )
                      from public.experience_media_tags tag
                      join public.profiles tagged_profile
                        on tagged_profile.id =
                          tag.tagged_user_id
                      where
                        tag.media_id =
                          media.id
                        and (
                          tag.status =
                            'approved'
                          or tag.tagged_user_id =
                            v_user_id
                          or v_is_manager
                          or media.uploader_user_id =
                            v_user_id
                        )
                        and tag.status <>
                          'removed'
                    ),
                    '[]'::jsonb
                  )
              )
              order by
                case
                  when media.id =
                    v_experience.cover_media_id
                    then 0
                  else 1
                end,
                media.created_at desc,
                media.id
            )
          from public.experience_media media
          join public.profiles uploader
            on uploader.id =
              media.uploader_user_id
          where
            media.experience_id =
              v_experience.id
            and media.moderation_status =
              'active'
            and public.can_user_view_experience_media(
              media.id,
              v_user_id
            )
        ),
        '[]'::jsonb
      ),
    'tag_candidates',
      case
        when public.can_user_contribute_to_experience(
          v_experience.id,
          v_user_id
        )
        then
          coalesce(
            (
              select
                jsonb_agg(
                  jsonb_build_object(
                    'user_id',
                      candidate.user_id,
                    'full_name',
                      candidate.full_name,
                    'username',
                      candidate.username,
                    'avatar_url',
                      candidate.avatar_url,
                    'role',
                      candidate.role
                  )
                  order by
                    case
                      when candidate.role =
                        'host'
                        then 0
                      when candidate.role =
                        'co_host'
                        then 1
                      else 2
                    end,
                    candidate.full_name,
                    candidate.user_id
                )
              from (
                select
                  v_plan.host_user_id as user_id,
                  host_profile.full_name,
                  host_profile.username,
                  host_profile.avatar_url,
                  'host'::text as role
                from public.profiles host_profile
                where
                  host_profile.id =
                    v_plan.host_user_id
                  and not public.reputation_is_managed_minor(
                    host_profile.id
                  )

                union all

                select
                  member.user_id,
                  member_profile.full_name,
                  member_profile.username,
                  member_profile.avatar_url,
                  member.role
                from public.plan_members member
                join public.profiles member_profile
                  on member_profile.id =
                    member.user_id
                where
                  member.plan_id =
                    p_plan_id
                  and member.status =
                    'active'
                  and member.user_id <>
                    v_plan.host_user_id
                  and (
                    member.role =
                      'co_host'
                    or member.attendance_status =
                      'attended'
                  )
                  and not public.reputation_is_managed_minor(
                    member.user_id
                  )
              ) candidate
            ),
            '[]'::jsonb
          )
        else
          '[]'::jsonb
      end
  );
end;
$$;

-- ============================================================
-- EXPERIENCE WRITES
-- ============================================================

create or replace function
  public.experience_visibility_rank(
    p_visibility text
  )
returns integer
language sql
immutable
set search_path = public
as $$
  select
    case p_visibility
      when 'participants'
        then 0
      when 'friends'
        then 1
      when 'public'
        then 2
      else -1
    end;
$$;

create or replace function
  public.update_experience_details(
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
  v_user_id :=
    auth.uid();

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

  if char_length(
    v_title
  ) > 120 then
    raise exception
      'The shared title may contain at most 120 characters.'
      using errcode = '22023';
  end if;

  if
    v_story is not null
    and char_length(
      v_story
    ) > 2000
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

  update public.experiences
  set
    title =
      v_title,
    story =
      v_story,
    visibility =
      p_visibility,
    updated_at =
      now()
  where
    id =
      p_experience_id
  returning
    plan_id
  into
    v_plan_id;

  update public.plans
  set
    shared_title =
      v_title,
    updated_at =
      now()
  where
    id =
      v_plan_id;

  return p_experience_id;
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

-- ============================================================
-- PRIVATE STORAGE
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
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id)
do update
set
  public =
    excluded.public,
  file_size_limit =
    excluded.file_size_limit,
  allowed_mime_types =
    excluded.allowed_mime_types;

drop policy if exists
  "Experience contributors can upload photos"
on storage.objects;

create policy
  "Experience contributors can upload photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'experience-media'
  and array_length(
    storage.foldername(
      name
    ),
    1
  ) >= 2
  and (
    storage.foldername(
      name
    )
  )[2] =
    auth.uid()::text
  and public.can_user_contribute_to_experience(
    (
      storage.foldername(
        name
      )
    )[1]::uuid,
    auth.uid()
  )
);

drop policy if exists
  "Visible Experience photos can be read"
on storage.objects;

create policy
  "Visible Experience photos can be read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id =
    'experience-media'
  and exists (
    select 1
    from public.experience_media media
    where
      media.storage_path =
        storage.objects.name
      and media.media_type =
        'photo'
      and media.moderation_status =
        'active'
      and public.can_user_view_experience_media(
        media.id,
        auth.uid()
      )
  )
);

drop policy if exists
  "Experience photo owners and managers can delete"
on storage.objects;

create policy
  "Experience photo owners and managers can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'experience-media'
  and exists (
    select 1
    from public.experience_media media
    where
      media.storage_path =
        storage.objects.name
      and (
        media.uploader_user_id =
          auth.uid()
        or public.is_experience_manager(
          media.experience_id,
          auth.uid()
        )
      )
  )
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.experiences
  enable row level security;

alter table public.experience_media
  enable row level security;

alter table public.experience_media_tags
  enable row level security;

revoke all
on public.experiences
from anon, authenticated;

revoke all
on public.experience_media
from anon, authenticated;

revoke all
on public.experience_media_tags
from anon, authenticated;

-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================

revoke all
on function
  public.is_experience_manager(
    uuid,
    uuid
  )
from public;

revoke all
on function
  public.is_experience_participant(
    uuid,
    uuid
  )
from public;

revoke all
on function
  public.can_user_contribute_to_experience(
    uuid,
    uuid
  )
from public;

revoke all
on function
  public.can_user_view_experience(
    uuid,
    uuid
  )
from public;

revoke all
on function
  public.can_user_view_experience_media(
    uuid,
    uuid
  )
from public;

grant execute
on function
  public.can_user_contribute_to_experience(
    uuid,
    uuid
  )
to authenticated;

grant execute
on function
  public.can_user_view_experience(
    uuid,
    uuid
  )
to anon, authenticated;

grant execute
on function
  public.can_user_view_experience_media(
    uuid,
    uuid
  )
to anon, authenticated;

revoke all
on function
  public.get_visible_experience_by_plan(
    uuid
  )
from public;

grant execute
on function
  public.get_visible_experience_by_plan(
    uuid
  )
to anon, authenticated;

revoke all
on function
  public.update_shared_activity_title(
    uuid,
    text
  )
from public;

grant execute
on function
  public.update_shared_activity_title(
    uuid,
    text
  )
to authenticated;

revoke all
on function
  public.update_experience_details(
    uuid,
    text,
    text,
    text
  )
from public;

grant execute
on function
  public.update_experience_details(
    uuid,
    text,
    text,
    text
  )
to authenticated;

revoke all
on function
  public.add_experience_photo_media(
    uuid,
    text,
    text,
    text
  )
from public;

grant execute
on function
  public.add_experience_photo_media(
    uuid,
    text,
    text,
    text
  )
to authenticated;

revoke all
on function
  public.add_experience_external_media(
    uuid,
    text,
    text,
    text,
    text,
    text
  )
from public;

grant execute
on function
  public.add_experience_external_media(
    uuid,
    text,
    text,
    text,
    text,
    text
  )
to authenticated;

revoke all
on function
  public.delete_experience_media(
    uuid
  )
from public;

grant execute
on function
  public.delete_experience_media(
    uuid
  )
to authenticated;

revoke all
on function
  public.set_experience_cover_media(
    uuid,
    uuid
  )
from public;

grant execute
on function
  public.set_experience_cover_media(
    uuid,
    uuid
  )
to authenticated;

revoke all
on function
  public.tag_experience_media_participant(
    uuid,
    uuid
  )
from public;

grant execute
on function
  public.tag_experience_media_participant(
    uuid,
    uuid
  )
to authenticated;

revoke all
on function
  public.respond_to_experience_media_tag(
    uuid,
    text
  )
from public;

grant execute
on function
  public.respond_to_experience_media_tag(
    uuid,
    text
  )
to authenticated;

commit;
