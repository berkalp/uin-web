begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- PRESENTATION VISIBILITY
-- ============================================================

alter table public.plan_private_titles
  add column if not exists visibility text not null default 'participants';

alter table public.plan_private_titles
  drop constraint if exists plan_private_titles_visibility_check;

alter table public.plan_private_titles
  add constraint plan_private_titles_visibility_check
  check (visibility in ('participants', 'friends', 'everyone', 'only_me'));

update public.plan_private_titles
set visibility = 'participants'
where visibility is null
   or visibility not in ('participants', 'friends', 'everyone', 'only_me');

comment on column public.plan_private_titles.visibility is
  'Audience for the custom Shared Activity title. The canonical Activity name is used when hidden.';

create table if not exists public.plan_private_covers (
  plan_id uuid primary key
    references public.plans(id)
    on delete cascade,
  external_url text,
  storage_path text,
  visibility text not null default 'participants',
  created_by_user_id uuid not null
    references public.profiles(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_private_covers_source_check
    check (
      (external_url is not null and storage_path is null)
      or (external_url is null and storage_path is not null)
    ),
  constraint plan_private_covers_external_url_check
    check (
      external_url is null
      or (
        char_length(external_url) <= 2000
        and external_url ~* '^https?://'
      )
    ),
  constraint plan_private_covers_storage_path_check
    check (
      storage_path is null
      or storage_path like plan_id::text || '/%'
    ),
  constraint plan_private_covers_visibility_check
    check (visibility in ('participants', 'friends', 'everyone', 'only_me'))
);

alter table public.plan_private_covers enable row level security;

comment on table public.plan_private_covers is
  'Custom Plan and Activity cover presentation stored outside the generally visible plans row.';
comment on column public.plan_private_covers.external_url is
  'External HTTP(S) image. UIN controls display, but the source host remains public.';
comment on column public.plan_private_covers.storage_path is
  'Private plan-presentation-covers Storage object path.';

create or replace function public.set_private_plan_cover_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_private_plan_cover_updated_at_trigger
on public.plan_private_covers;

create trigger set_private_plan_cover_updated_at_trigger
before update on public.plan_private_covers
for each row
execute function public.set_private_plan_cover_updated_at();

-- Existing custom covers were previously kept in plans.cover_url. Move them
-- into the protected presentation table and remove the column value so older
-- public RPCs and direct Plan reads cannot leak the URL.
--
-- Some historical expired Forming Plans are guarded by the
-- protect_expired_forming_plan_update() trigger. This is a one-time privacy
-- backfill, not a user edit, so only that specific guard trigger is suspended
-- while the legacy cover_url column is cleared. Every other plans trigger stays
-- active. The trigger is restored even when the backfill raises an exception.
do $migration$
declare
  v_guard_triggers text[];
  v_trigger_name text;
begin
  select coalesce(array_agg(trigger_row.tgname::text order by trigger_row.tgname::text), array[]::text[])
  into v_guard_triggers
  from pg_trigger trigger_row
  join pg_proc trigger_function
    on trigger_function.oid = trigger_row.tgfoid
  join pg_namespace function_schema
    on function_schema.oid = trigger_function.pronamespace
  where trigger_row.tgrelid = 'public.plans'::regclass
    and not trigger_row.tgisinternal
    and function_schema.nspname = 'public'
    and trigger_function.proname = 'protect_expired_forming_plan_update';

  foreach v_trigger_name in array v_guard_triggers loop
    execute format(
      'alter table public.plans disable trigger %I',
      v_trigger_name
    );
  end loop;

  begin
    insert into public.plan_private_covers (
      plan_id,
      external_url,
      storage_path,
      visibility,
      created_by_user_id,
      created_at,
      updated_at
    )
    select
      plan.id,
      nullif(btrim(plan.cover_url), ''),
      null,
      'participants',
      plan.host_user_id,
      now(),
      now()
    from public.plans plan
    where nullif(btrim(plan.cover_url), '') is not null
    on conflict (plan_id) do nothing;

    update public.plans
    set cover_url = null
    where cover_url is not null;
  exception
    when others then
      foreach v_trigger_name in array v_guard_triggers loop
        execute format(
          'alter table public.plans enable trigger %I',
          v_trigger_name
        );
      end loop;
      raise;
  end;

  foreach v_trigger_name in array v_guard_triggers loop
    execute format(
      'alter table public.plans enable trigger %I',
      v_trigger_name
    );
  end loop;
end;
$migration$;

-- ============================================================
-- ACCESS HELPERS
-- ============================================================

create or replace function public.current_user_can_manage_plan_presentation(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.plans plan
      where plan.id = p_plan_id
        and (
          plan.host_user_id = auth.uid()
          or exists (
            select 1
            from public.plan_members member
            where member.plan_id = plan.id
              and member.user_id = auth.uid()
              and member.status = 'active'
              and member.role = 'co_host'
          )
        )
    );
$$;

create or replace function public.can_user_view_plan_base(
  p_plan_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plans plan
    where plan.id = p_plan_id
      and (
        plan.host_user_id = p_viewer_user_id
        or exists (
          select 1
          from public.plan_members member
          where member.plan_id = plan.id
            and member.user_id = p_viewer_user_id
            and member.status = 'active'
        )
        or exists (
          select 1
          from public.plan_intents plan_link
          where plan_link.plan_id = plan.id
            and plan_link.status = 'active'
            and public.can_user_view_intent_activity(
              plan_link.intent_id,
              p_viewer_user_id
            )
        )
      )
  );
$$;

create or replace function public.can_user_view_plan_presentation(
  p_plan_id uuid,
  p_visibility text,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visibility text := lower(
    coalesce(nullif(btrim(p_visibility), ''), 'participants')
  );
  v_host_user_id uuid;
  v_is_member boolean := false;
begin
  select plan.host_user_id
  into v_host_user_id
  from public.plans plan
  where plan.id = p_plan_id;

  if v_host_user_id is null then
    return false;
  end if;

  if p_viewer_user_id = v_host_user_id then
    return true;
  end if;

  -- The Intent or Activity audience is always the outer privacy boundary.
  if not public.can_user_view_plan_base(p_plan_id, p_viewer_user_id) then
    return false;
  end if;

  v_is_member := p_viewer_user_id is not null and exists (
    select 1
    from public.plan_members member
    where member.plan_id = p_plan_id
      and member.user_id = p_viewer_user_id
      and member.status = 'active'
  );

  case v_visibility
    when 'only_me' then
      return false;
    when 'participants' then
      return v_is_member;
    when 'friends' then
      return v_is_member
        or (
          p_viewer_user_id is not null
          and public.users_are_accepted_friends(
            v_host_user_id,
            p_viewer_user_id
          )
        );
    when 'everyone' then
      return true;
    else
      return false;
  end case;
end;
$$;

-- ============================================================
-- TABLE POLICIES
-- ============================================================

drop policy if exists plan_private_covers_select on public.plan_private_covers;
drop policy if exists plan_private_covers_insert on public.plan_private_covers;
drop policy if exists plan_private_covers_update on public.plan_private_covers;
drop policy if exists plan_private_covers_delete on public.plan_private_covers;

create policy plan_private_covers_select
on public.plan_private_covers
for select
to anon, authenticated
using (
  public.can_user_view_plan_presentation(
    plan_id,
    visibility,
    auth.uid()
  )
);

create policy plan_private_covers_insert
on public.plan_private_covers
for insert
to authenticated
with check (
  public.current_user_can_manage_plan_presentation(plan_id)
);

create policy plan_private_covers_update
on public.plan_private_covers
for update
to authenticated
using (
  public.current_user_can_manage_plan_presentation(plan_id)
)
with check (
  public.current_user_can_manage_plan_presentation(plan_id)
);

create policy plan_private_covers_delete
on public.plan_private_covers
for delete
to authenticated
using (
  public.current_user_can_manage_plan_presentation(plan_id)
);

grant select on public.plan_private_covers to anon, authenticated;
grant insert, update, delete on public.plan_private_covers to authenticated;

-- ============================================================
-- VISIBILITY-SAFE READ PROJECTIONS
-- ============================================================

create or replace function public.get_visible_plan_presentations(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  custom_title text,
  custom_cover_external_url text,
  custom_cover_storage_path text,
  title_visibility text,
  cover_visibility text,
  viewer_can_see_title boolean,
  viewer_can_see_cover boolean,
  experience_cover_storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    plan.id,
    case
      when public.can_user_view_plan_presentation(
        plan.id,
        coalesce(private_title.visibility, 'participants'),
        auth.uid()
      ) then private_title.title
      else null
    end as custom_title,
    case
      when public.can_user_view_plan_presentation(
        plan.id,
        coalesce(private_cover.visibility, 'participants'),
        auth.uid()
      ) then private_cover.external_url
      else null
    end as custom_cover_external_url,
    case
      when public.can_user_view_plan_presentation(
        plan.id,
        coalesce(private_cover.visibility, 'participants'),
        auth.uid()
      ) then private_cover.storage_path
      else null
    end as custom_cover_storage_path,
    coalesce(private_title.visibility, 'participants') as title_visibility,
    coalesce(private_cover.visibility, 'participants') as cover_visibility,
    public.can_user_view_plan_presentation(
      plan.id,
      coalesce(private_title.visibility, 'participants'),
      auth.uid()
    ) as viewer_can_see_title,
    public.can_user_view_plan_presentation(
      plan.id,
      coalesce(private_cover.visibility, 'participants'),
      auth.uid()
    ) as viewer_can_see_cover,
    case
      when plan.host_user_id = auth.uid()
        or exists (
          select 1
          from public.plan_members member
          where member.plan_id = plan.id
            and member.user_id = auth.uid()
            and member.status = 'active'
        )
      then cover_media.storage_path
      else null
    end as experience_cover_storage_path
  from public.plans plan
  left join public.plan_private_titles private_title
    on private_title.plan_id = plan.id
  left join public.plan_private_covers private_cover
    on private_cover.plan_id = plan.id
  left join public.experiences experience
    on experience.plan_id = plan.id
  left join public.experience_media cover_media
    on cover_media.id = experience.cover_media_id
    and cover_media.media_type = 'photo'
    and cover_media.moderation_status = 'active'
  where plan.id = any(coalesce(p_plan_ids, array[]::uuid[]))
    and public.can_user_view_plan_base(plan.id, auth.uid())
  order by plan.id;
$$;

create or replace function public.get_private_shared_activity_title(
  p_plan_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select private_title.title
  from public.plan_private_titles private_title
  where private_title.plan_id = p_plan_id
    and public.can_user_view_plan_presentation(
      private_title.plan_id,
      private_title.visibility,
      auth.uid()
    )
  limit 1;
$$;

create or replace function public.get_my_private_plan_titles(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  title text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    private_title.plan_id,
    private_title.title
  from public.plan_private_titles private_title
  where private_title.plan_id = any(coalesce(p_plan_ids, array[]::uuid[]))
    and public.can_user_view_plan_presentation(
      private_title.plan_id,
      private_title.visibility,
      auth.uid()
    )
  order by private_title.updated_at desc, private_title.plan_id;
$$;

-- Keep the existing RPC name safe for older screens. Private uploaded covers
-- require the new get_visible_plan_presentations RPC so they can be signed.
create or replace function public.get_my_private_plan_presentations(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  private_title text,
  plan_cover_url text,
  experience_cover_storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    presentation.plan_id,
    presentation.custom_title,
    presentation.custom_cover_external_url,
    presentation.experience_cover_storage_path
  from public.get_visible_plan_presentations(p_plan_ids) presentation;
$$;

-- Existing card metadata remains available, but its cover URL is now filtered
-- by the custom-cover audience instead of exposing plans.cover_url.
create or replace function public.get_visible_plan_card_metadata(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  cover_url text,
  host_user_id uuid,
  host_full_name text,
  host_username text,
  host_avatar_url text,
  plan_visibility text,
  recruitment_status text,
  viewer_is_member boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid := auth.uid();
begin
  if p_plan_ids is null or cardinality(p_plan_ids) = 0 then
    return;
  end if;

  if cardinality(p_plan_ids) > 100 then
    raise exception 'Too many Plan records requested.' using errcode = '22023';
  end if;

  return query
  select
    plan.id,
    case
      when private_cover.plan_id is not null
       and public.can_user_view_plan_presentation(
         plan.id,
         private_cover.visibility,
         v_viewer_user_id
       )
      then private_cover.external_url
      else null
    end,
    plan.host_user_id,
    host_profile.full_name,
    host_profile.username,
    host_profile.avatar_url,
    plan.visibility,
    plan.recruitment_status,
    (
      plan.host_user_id = v_viewer_user_id
      or exists (
        select 1
        from public.plan_members current_viewer_member
        where current_viewer_member.plan_id = plan.id
          and current_viewer_member.user_id = v_viewer_user_id
          and current_viewer_member.status = 'active'
      )
    )
  from public.plans plan
  left join public.profiles host_profile
    on host_profile.id = plan.host_user_id
  left join public.plan_private_covers private_cover
    on private_cover.plan_id = plan.id
  where plan.id = any(p_plan_ids)
    and public.can_user_view_plan_base(plan.id, v_viewer_user_id);
end;
$$;

-- ============================================================
-- WRITES
-- ============================================================

drop function if exists public.update_shared_activity_title(uuid, text);

create function public.update_shared_activity_title(
  p_plan_id uuid,
  p_shared_title text,
  p_visibility text default 'participants'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := nullif(btrim(coalesce(p_shared_title, '')), '');
  v_visibility text := lower(
    coalesce(nullif(btrim(p_visibility), ''), 'participants')
  );
  v_plan_status text;
  v_host_user_id uuid;
  v_canonical_title text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_visibility not in ('participants', 'friends', 'everyone', 'only_me') then
    raise exception 'Unsupported title visibility.' using errcode = '22023';
  end if;

  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'The shared title may contain at most 120 characters.'
      using errcode = '22023';
  end if;

  select
    plan.status,
    plan.host_user_id,
    coalesce(activity.name, nullif(btrim(plan.title), ''), 'UIN Activity')
  into
    v_plan_status,
    v_host_user_id,
    v_canonical_title
  from public.plans plan
  left join public.activities activity on activity.id = plan.activity_id
  where plan.id = p_plan_id
    and (
      plan.host_user_id = v_user_id
      or exists (
        select 1
        from public.plan_members member
        where member.plan_id = plan.id
          and member.user_id = v_user_id
          and member.status = 'active'
          and member.role = 'co_host'
      )
    )
  for update of plan;

  if v_plan_status is null then
    raise exception 'Plan not found or access denied.' using errcode = 'P0002';
  end if;

  if v_plan_status = 'cancelled' then
    raise exception 'A cancelled Plan cannot be renamed.' using errcode = '22023';
  end if;

  if v_visibility = 'only_me' and v_user_id <> v_host_user_id then
    raise exception 'Only the Primary Host may use Only me visibility.'
      using errcode = '42501';
  end if;

  if v_title is null then
    delete from public.plan_private_titles where plan_id = p_plan_id;
  else
    insert into public.plan_private_titles (
      plan_id,
      title,
      visibility,
      created_by_user_id,
      created_at,
      updated_at
    ) values (
      p_plan_id,
      v_title,
      v_visibility,
      v_user_id,
      now(),
      now()
    )
    on conflict (plan_id)
    do update set
      title = excluded.title,
      visibility = excluded.visibility,
      updated_at = now();
  end if;

  -- Experience rows keep a canonical title. The custom title is projected at
  -- read time only for viewers allowed by the selected audience.
  update public.experiences
  set title = v_canonical_title,
      updated_at = now()
  where plan_id = p_plan_id;

  return v_title;
end;
$$;

create or replace function public.update_plan_custom_cover(
  p_plan_id uuid,
  p_cover_url text default null,
  p_storage_path text default null,
  p_visibility text default 'participants'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cover_url text := nullif(btrim(coalesce(p_cover_url, '')), '');
  v_storage_path text := nullif(btrim(coalesce(p_storage_path, '')), '');
  v_visibility text := lower(
    coalesce(nullif(btrim(p_visibility), ''), 'participants')
  );
  v_host_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select plan.host_user_id
  into v_host_user_id
  from public.plans plan
  where plan.id = p_plan_id
    and (
      plan.host_user_id = v_user_id
      or exists (
        select 1
        from public.plan_members member
        where member.plan_id = plan.id
          and member.user_id = v_user_id
          and member.status = 'active'
          and member.role = 'co_host'
      )
    )
  for update;

  if v_host_user_id is null then
    raise exception 'Plan not found or access denied.' using errcode = 'P0002';
  end if;

  if v_visibility not in ('participants', 'friends', 'everyone', 'only_me') then
    raise exception 'Unsupported cover visibility.' using errcode = '22023';
  end if;

  if v_visibility = 'only_me' and v_user_id <> v_host_user_id then
    raise exception 'Only the Primary Host may use Only me visibility.'
      using errcode = '42501';
  end if;

  if v_cover_url is not null
     and (char_length(v_cover_url) > 2000 or v_cover_url !~* '^https?://') then
    raise exception 'Cover URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if v_storage_path is not null
     and v_storage_path not like p_plan_id::text || '/%' then
    raise exception 'Invalid private cover path.' using errcode = '22023';
  end if;

  if v_cover_url is not null and v_storage_path is not null then
    raise exception 'Use either an external URL or an uploaded image, not both.'
      using errcode = '22023';
  end if;

  if v_cover_url is null and v_storage_path is null then
    delete from public.plan_private_covers where plan_id = p_plan_id;
  else
    insert into public.plan_private_covers (
      plan_id,
      external_url,
      storage_path,
      visibility,
      created_by_user_id,
      created_at,
      updated_at
    ) values (
      p_plan_id,
      v_cover_url,
      v_storage_path,
      v_visibility,
      v_user_id,
      now(),
      now()
    )
    on conflict (plan_id)
    do update set
      external_url = excluded.external_url,
      storage_path = excluded.storage_path,
      visibility = excluded.visibility,
      updated_at = now();
  end if;

  -- Keep the legacy column empty so direct Plan reads and old public RPCs do
  -- not become a side channel around presentation visibility.
  update public.plans
  set cover_url = null,
      updated_at = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'cover_url', v_cover_url,
    'storage_path', v_storage_path,
    'visibility', v_visibility
  );
end;
$$;

-- Legacy presentation writers are wrapped so an older client cannot write a
-- custom cover back into the generally visible plans.cover_url column.
do $$
begin
  if to_regprocedure(
    'public.update_plan_presentation_details_legacy_029(uuid,text,text,text,text,numeric,numeric)'
  ) is null
  and to_regprocedure(
    'public.update_plan_presentation_details(uuid,text,text,text,text,numeric,numeric)'
  ) is not null
  then
    execute 'alter function public.update_plan_presentation_details(uuid,text,text,text,text,numeric,numeric) rename to update_plan_presentation_details_legacy_029';
  end if;
end;
$$;

create or replace function public.update_plan_presentation_details(
  p_plan_id uuid,
  p_cover_url text default null,
  p_address_text text default null,
  p_map_url text default null,
  p_street_view_url text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.update_plan_presentation_details_legacy_029(
    p_plan_id,
    null,
    p_address_text,
    p_map_url,
    p_street_view_url,
    p_latitude,
    p_longitude
  );

  if nullif(btrim(coalesce(p_cover_url, '')), '') is not null then
    perform public.update_plan_custom_cover(
      p_plan_id,
      p_cover_url,
      null,
      'participants'
    );
  end if;

  update public.plans set cover_url = null where id = p_plan_id;
  return jsonb_set(v_result, '{cover_url}', 'null'::jsonb, true);
end;
$$;

do $$
begin
  if to_regprocedure(
    'public.update_plan_presentation_and_locations_legacy_029(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text)'
  ) is null
  and to_regprocedure(
    'public.update_plan_presentation_and_locations(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text)'
  ) is not null
  then
    execute 'alter function public.update_plan_presentation_and_locations(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text) rename to update_plan_presentation_and_locations_legacy_029';
  end if;
end;
$$;

create or replace function public.update_plan_presentation_and_locations(
  p_plan_id uuid,
  p_cover_url text default null,
  p_meeting_point text default null,
  p_meeting_address_text text default null,
  p_meeting_map_url text default null,
  p_meeting_street_view_url text default null,
  p_meeting_latitude numeric default null,
  p_meeting_longitude numeric default null,
  p_activity_location_name text default null,
  p_activity_address_text text default null,
  p_activity_map_url text default null,
  p_activity_street_view_url text default null,
  p_activity_latitude numeric default null,
  p_activity_longitude numeric default null,
  p_meeting_location_same_as_activity boolean default false,
  p_activity_location_visibility text default 'members'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.update_plan_presentation_and_locations_legacy_029(
    p_plan_id,
    null,
    p_meeting_point,
    p_meeting_address_text,
    p_meeting_map_url,
    p_meeting_street_view_url,
    p_meeting_latitude,
    p_meeting_longitude,
    p_activity_location_name,
    p_activity_address_text,
    p_activity_map_url,
    p_activity_street_view_url,
    p_activity_latitude,
    p_activity_longitude,
    p_meeting_location_same_as_activity,
    p_activity_location_visibility
  );

  if nullif(btrim(coalesce(p_cover_url, '')), '') is not null then
    perform public.update_plan_custom_cover(
      p_plan_id,
      p_cover_url,
      null,
      'participants'
    );
  end if;

  update public.plans set cover_url = null where id = p_plan_id;
  return jsonb_set(v_result, '{cover_url}', 'null'::jsonb, true);
end;
$$;

-- Visibility-aware Experience title projection.
create or replace function public.get_visible_experience_by_plan_safe(
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
  v_private_title text;
  v_title_visibility text;
  v_activity_name text;
begin
  v_bundle := public.get_visible_experience_by_plan(p_plan_id);

  if v_bundle is null then
    return null;
  end if;

  select
    private_title.title,
    coalesce(private_title.visibility, 'participants'),
    coalesce(activity.name, nullif(btrim(plan.title), ''), 'UIN Activity')
  into
    v_private_title,
    v_title_visibility,
    v_activity_name
  from public.plans plan
  left join public.activities activity on activity.id = plan.activity_id
  left join public.plan_private_titles private_title
    on private_title.plan_id = plan.id
  where plan.id = p_plan_id;

  if v_private_title is not null
     and public.can_user_view_plan_presentation(
       p_plan_id,
       v_title_visibility,
       auth.uid()
     )
  then
    v_bundle := jsonb_set(
      v_bundle,
      '{shared_title}',
      to_jsonb(v_private_title),
      true
    );

    if jsonb_typeof(v_bundle -> 'experience') = 'object' then
      v_bundle := jsonb_set(
        v_bundle,
        '{experience,title}',
        to_jsonb(v_private_title),
        true
      );
    end if;
  else
    v_bundle := jsonb_set(v_bundle, '{shared_title}', 'null'::jsonb, true);

    if jsonb_typeof(v_bundle -> 'experience') = 'object' then
      v_bundle := jsonb_set(
        v_bundle,
        '{experience,title}',
        to_jsonb(v_activity_name),
        true
      );
    end if;
  end if;

  return v_bundle;
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
) values (
  'plan-presentation-covers',
  'plan-presentation-covers',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists plan_presentation_cover_insert on storage.objects;
drop policy if exists plan_presentation_cover_select on storage.objects;
drop policy if exists plan_presentation_cover_delete on storage.objects;

create policy plan_presentation_cover_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'plan-presentation-covers'
  and public.current_user_can_manage_plan_presentation(
    (storage.foldername(name))[1]::uuid
  )
);

create policy plan_presentation_cover_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'plan-presentation-covers'
  and exists (
    select 1
    from public.plan_private_covers private_cover
    where private_cover.plan_id::text = (storage.foldername(name))[1]
      and private_cover.storage_path = storage.objects.name
      and public.can_user_view_plan_presentation(
        private_cover.plan_id,
        private_cover.visibility,
        auth.uid()
      )
  )
);

create policy plan_presentation_cover_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'plan-presentation-covers'
  and public.current_user_can_manage_plan_presentation(
    (storage.foldername(name))[1]::uuid
  )
);

-- ============================================================
-- GRANTS
-- ============================================================

revoke all on function public.current_user_can_manage_plan_presentation(uuid) from public;
revoke all on function public.can_user_view_plan_base(uuid, uuid) from public;
revoke all on function public.can_user_view_plan_presentation(uuid, text, uuid) from public;
revoke all on function public.get_visible_plan_presentations(uuid[]) from public;
revoke all on function public.get_private_shared_activity_title(uuid) from public;
revoke all on function public.get_my_private_plan_titles(uuid[]) from public;
revoke all on function public.get_my_private_plan_presentations(uuid[]) from public;
revoke all on function public.get_visible_plan_card_metadata(uuid[]) from public;
revoke all on function public.update_shared_activity_title(uuid, text, text) from public;
revoke all on function public.update_plan_custom_cover(uuid, text, text, text) from public;
revoke all on function public.update_plan_presentation_details(uuid, text, text, text, text, numeric, numeric) from public;
revoke all on function public.update_plan_presentation_and_locations(uuid, text, text, text, text, text, numeric, numeric, text, text, text, text, numeric, numeric, boolean, text) from public;
revoke all on function public.get_visible_experience_by_plan_safe(uuid) from public;

-- Legacy renamed writers are implementation details only.
revoke all on function public.update_plan_presentation_details_legacy_029(uuid, text, text, text, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.update_plan_presentation_and_locations_legacy_029(uuid, text, text, text, text, text, numeric, numeric, text, text, text, text, numeric, numeric, boolean, text) from public, anon, authenticated;

grant execute on function public.current_user_can_manage_plan_presentation(uuid) to authenticated;
grant execute on function public.can_user_view_plan_base(uuid, uuid) to anon, authenticated;
grant execute on function public.can_user_view_plan_presentation(uuid, text, uuid) to anon, authenticated;
grant execute on function public.get_visible_plan_presentations(uuid[]) to anon, authenticated;
grant execute on function public.get_private_shared_activity_title(uuid) to authenticated;
grant execute on function public.get_my_private_plan_titles(uuid[]) to authenticated;
grant execute on function public.get_my_private_plan_presentations(uuid[]) to authenticated;
grant execute on function public.get_visible_plan_card_metadata(uuid[]) to anon, authenticated;
grant execute on function public.update_shared_activity_title(uuid, text, text) to authenticated;
grant execute on function public.update_plan_custom_cover(uuid, text, text, text) to authenticated;
grant execute on function public.update_plan_presentation_details(uuid, text, text, text, text, numeric, numeric) to authenticated;
grant execute on function public.update_plan_presentation_and_locations(uuid, text, text, text, text, text, numeric, numeric, text, text, text, text, numeric, numeric, boolean, text) to authenticated;
grant execute on function public.get_visible_experience_by_plan_safe(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
