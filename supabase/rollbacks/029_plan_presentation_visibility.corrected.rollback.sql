begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- WARNING: private uploaded custom-cover files are deleted by this rollback.
-- External custom-cover URLs are restored to plans.cover_url.

drop policy if exists plan_presentation_cover_insert on storage.objects;
drop policy if exists plan_presentation_cover_select on storage.objects;
drop policy if exists plan_presentation_cover_delete on storage.objects;

delete from storage.objects
where bucket_id = 'plan-presentation-covers';

delete from storage.buckets
where id = 'plan-presentation-covers';

-- Restoring legacy cover_url values is a migration operation. Temporarily
-- suspend only the historical expired-Forming read-only guard while the values
-- are restored, then immediately enable it again.
do $rollback$
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
    update public.plans plan
    set cover_url = private_cover.external_url
    from public.plan_private_covers private_cover
    where private_cover.plan_id = plan.id
      and private_cover.external_url is not null
      and plan.cover_url is null;
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
$rollback$;

-- Restore the original presentation writer names.
drop function if exists public.update_plan_presentation_details(
  uuid, text, text, text, text, numeric, numeric
);

do $$
begin
  if to_regprocedure(
    'public.update_plan_presentation_details_legacy_029(uuid,text,text,text,text,numeric,numeric)'
  ) is not null
  then
    execute 'alter function public.update_plan_presentation_details_legacy_029(uuid,text,text,text,text,numeric,numeric) rename to update_plan_presentation_details';
  end if;
end;
$$;

drop function if exists public.update_plan_presentation_and_locations(
  uuid, text, text, text, text, text, numeric, numeric,
  text, text, text, text, numeric, numeric, boolean, text
);

do $$
begin
  if to_regprocedure(
    'public.update_plan_presentation_and_locations_legacy_029(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text)'
  ) is not null
  then
    execute 'alter function public.update_plan_presentation_and_locations_legacy_029(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text) rename to update_plan_presentation_and_locations';
  end if;
end;
$$;

-- Restore the legacy two-argument shared-title writer.
drop function if exists public.update_shared_activity_title(uuid, text, text);

create or replace function public.update_shared_activity_title(
  p_plan_id uuid,
  p_shared_title text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := nullif(btrim(coalesce(p_shared_title, '')), '');
  v_plan_status text;
  v_canonical_title text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'The shared title may contain at most 120 characters.'
      using errcode = '22023';
  end if;

  select
    plan.status,
    coalesce(nullif(btrim(plan.title), ''), activity.name, 'Shared Experience')
  into
    v_plan_status,
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

  if v_title is null then
    delete from public.plan_private_titles where plan_id = p_plan_id;
  else
    insert into public.plan_private_titles (
      plan_id,
      title,
      created_by_user_id,
      created_at,
      updated_at
    ) values (
      p_plan_id,
      v_title,
      v_user_id,
      now(),
      now()
    )
    on conflict (plan_id)
    do update set
      title = excluded.title,
      updated_at = now();
  end if;

  update public.experiences
  set title = coalesce(v_title, v_canonical_title),
      updated_at = now()
  where plan_id = p_plan_id;

  return v_title;
end;
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
  join public.plans plan on plan.id = private_title.plan_id
  where private_title.plan_id = p_plan_id
    and auth.uid() is not null
    and (
      plan.host_user_id = auth.uid()
      or exists (
        select 1
        from public.plan_members member
        where member.plan_id = plan.id
          and member.user_id = auth.uid()
          and member.status = 'active'
      )
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
  join public.plans plan on plan.id = private_title.plan_id
  where auth.uid() is not null
    and private_title.plan_id = any(coalesce(p_plan_ids, array[]::uuid[]))
    and (
      plan.host_user_id = auth.uid()
      or exists (
        select 1
        from public.plan_members member
        where member.plan_id = plan.id
          and member.user_id = auth.uid()
          and member.status = 'active'
      )
    )
  order by private_title.updated_at desc, private_title.plan_id;
$$;

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
    plan.id,
    private_title.title,
    plan.cover_url,
    cover_media.storage_path
  from public.plans plan
  left join public.plan_private_titles private_title
    on private_title.plan_id = plan.id
  left join public.experiences experience
    on experience.plan_id = plan.id
  left join public.experience_media cover_media
    on cover_media.id = experience.cover_media_id
    and cover_media.media_type = 'photo'
    and cover_media.moderation_status = 'active'
  where auth.uid() is not null
    and plan.id = any(coalesce(p_plan_ids, array[]::uuid[]))
    and (
      plan.host_user_id = auth.uid()
      or exists (
        select 1
        from public.plan_members member
        where member.plan_id = plan.id
          and member.user_id = auth.uid()
          and member.status = 'active'
      )
    )
  order by plan.id;
$$;

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
    plan.cover_url,
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
  where plan.id = any(p_plan_ids)
    and (
      plan.host_user_id = v_viewer_user_id
      or exists (
        select 1
        from public.plan_members viewer_member
        where viewer_member.plan_id = plan.id
          and viewer_member.user_id = v_viewer_user_id
          and viewer_member.status = 'active'
      )
      or plan.visibility = 'public'
      or exists (
        select 1
        from public.plan_intents linked_intent
        where linked_intent.plan_id = plan.id
          and linked_intent.status = 'active'
          and public.can_user_view_intent_activity(
            linked_intent.intent_id,
            v_viewer_user_id
          )
      )
    );
end;
$$;

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
  v_user_id uuid := auth.uid();
  v_is_member boolean;
  v_private_title text;
  v_activity_name text;
begin
  v_bundle := public.get_visible_experience_by_plan(p_plan_id);

  if v_bundle is null then
    return null;
  end if;

  select
    coalesce(activity.name, nullif(btrim(plan.title), ''), 'UIN Activity'),
    (
      v_user_id is not null
      and (
        plan.host_user_id = v_user_id
        or exists (
          select 1
          from public.plan_members member
          where member.plan_id = plan.id
            and member.user_id = v_user_id
            and member.status = 'active'
        )
      )
    )
  into
    v_activity_name,
    v_is_member
  from public.plans plan
  left join public.activities activity on activity.id = plan.activity_id
  where plan.id = p_plan_id;

  if v_is_member then
    select private_title.title
    into v_private_title
    from public.plan_private_titles private_title
    where private_title.plan_id = p_plan_id;

    v_bundle := jsonb_set(
      v_bundle,
      '{shared_title}',
      case
        when v_private_title is null then 'null'::jsonb
        else to_jsonb(v_private_title)
      end,
      true
    );

    if v_private_title is not null
       and jsonb_typeof(v_bundle -> 'experience') = 'object'
    then
      v_bundle := jsonb_set(
        v_bundle,
        '{experience,title}',
        to_jsonb(v_private_title),
        true
      );
    end if;

    return v_bundle;
  end if;

  v_bundle := jsonb_set(v_bundle, '{shared_title}', 'null'::jsonb, true);

  if jsonb_typeof(v_bundle -> 'experience') = 'object' then
    v_bundle := jsonb_set(
      v_bundle,
      '{experience,title}',
      to_jsonb(v_activity_name),
      true
    );
  end if;

  return v_bundle;
end;
$$;

-- Remove the new private-cover table and visibility layer.
drop function if exists public.update_plan_custom_cover(uuid, text, text, text);
drop function if exists public.get_visible_plan_presentations(uuid[]);

drop policy if exists plan_private_covers_select on public.plan_private_covers;
drop policy if exists plan_private_covers_insert on public.plan_private_covers;
drop policy if exists plan_private_covers_update on public.plan_private_covers;
drop policy if exists plan_private_covers_delete on public.plan_private_covers;

drop trigger if exists set_private_plan_cover_updated_at_trigger
on public.plan_private_covers;

drop table if exists public.plan_private_covers;
drop function if exists public.set_private_plan_cover_updated_at();

drop function if exists public.can_user_view_plan_presentation(uuid, text, uuid);
drop function if exists public.can_user_view_plan_base(uuid, uuid);
drop function if exists public.current_user_can_manage_plan_presentation(uuid);

alter table public.plan_private_titles
  drop constraint if exists plan_private_titles_visibility_check,
  drop column if exists visibility;

revoke all on function public.update_shared_activity_title(uuid, text) from public;
grant execute on function public.update_shared_activity_title(uuid, text) to authenticated;

revoke all on function public.get_private_shared_activity_title(uuid) from public;
grant execute on function public.get_private_shared_activity_title(uuid) to authenticated;

revoke all on function public.get_my_private_plan_titles(uuid[]) from public;
grant execute on function public.get_my_private_plan_titles(uuid[]) to authenticated;

revoke all on function public.get_my_private_plan_presentations(uuid[]) from public;
grant execute on function public.get_my_private_plan_presentations(uuid[]) to authenticated;

revoke all on function public.get_visible_plan_card_metadata(uuid[]) from public;
grant execute on function public.get_visible_plan_card_metadata(uuid[]) to anon, authenticated;

revoke all on function public.get_visible_experience_by_plan_safe(uuid) from public;
grant execute on function public.get_visible_experience_by_plan_safe(uuid) to anon, authenticated;

-- Restored legacy writer grants.
do $$
begin
  if to_regprocedure(
    'public.update_plan_presentation_details(uuid,text,text,text,text,numeric,numeric)'
  ) is not null then
    execute 'revoke all on function public.update_plan_presentation_details(uuid,text,text,text,text,numeric,numeric) from public';
    execute 'grant execute on function public.update_plan_presentation_details(uuid,text,text,text,text,numeric,numeric) to authenticated';
  end if;

  if to_regprocedure(
    'public.update_plan_presentation_and_locations(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text)'
  ) is not null then
    execute 'revoke all on function public.update_plan_presentation_and_locations(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text) from public';
    execute 'grant execute on function public.update_plan_presentation_and_locations(uuid,text,text,text,text,text,numeric,numeric,text,text,text,text,numeric,numeric,boolean,text) to authenticated';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
