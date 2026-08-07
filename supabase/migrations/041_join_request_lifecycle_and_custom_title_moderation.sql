begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- CUSTOM ACTIVITY TITLE MODERATION
-- ============================================================

alter table public.plan_private_titles
  add column if not exists moderation_status text not null default 'active',
  add column if not exists held_title text,
  add column if not exists moderation_reported_at timestamptz;

alter table public.plan_private_titles
  drop constraint if exists plan_private_titles_moderation_status_check;

alter table public.plan_private_titles
  add constraint plan_private_titles_moderation_status_check
  check (moderation_status in ('active', 'under_review'));

alter table public.plan_private_titles
  drop constraint if exists plan_private_titles_held_title_length_check;

alter table public.plan_private_titles
  add constraint plan_private_titles_held_title_length_check
  check (
    held_title is null
    or char_length(btrim(held_title)) between 1 and 120
  );

create table if not exists public.plan_title_reports (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  reported_by_user_id uuid not null references public.profiles(id) on delete restrict,
  custom_title_snapshot text not null,
  canonical_title_snapshot text not null,
  reason text not null,
  details text,
  status text not null default 'pending',
  resolved_by_user_id uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint plan_title_reports_reason_check
    check (reason in (
      'offensive_abusive',
      'hate_harassment',
      'sexual_content',
      'spam_advertising',
      'misleading',
      'other'
    )),
  constraint plan_title_reports_status_check
    check (status in ('pending', 'dismissed', 'removed')),
  constraint plan_title_reports_title_length_check
    check (char_length(btrim(custom_title_snapshot)) between 1 and 120),
  constraint plan_title_reports_details_length_check
    check (details is null or char_length(details) <= 1000),
  constraint plan_title_reports_resolution_note_length_check
    check (resolution_note is null or char_length(resolution_note) <= 1000)
);

create unique index if not exists plan_title_reports_one_pending_per_plan_idx
  on public.plan_title_reports(plan_id)
  where status = 'pending';

create index if not exists plan_title_reports_created_at_idx
  on public.plan_title_reports(created_at desc);

alter table public.plan_title_reports enable row level security;
revoke all on public.plan_title_reports from anon, authenticated;

comment on table public.plan_title_reports is
  'Reports against user-authored Shared Activity titles. A pending report immediately falls public display back to the canonical Activity title without changing the Activity lifecycle or reputation.';

comment on column public.plan_private_titles.held_title is
  'The reported custom title preserved for moderation while the visible title temporarily falls back to the canonical Activity name.';

-- The existing write RPC is replaced so a pending moderation review cannot be
-- bypassed by immediately entering a new custom title.
create or replace function public.update_shared_activity_title(
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
  v_moderation_status text;
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

  select title_row.moderation_status
  into v_moderation_status
  from public.plan_private_titles title_row
  where title_row.plan_id = p_plan_id
  for update;

  if coalesce(v_moderation_status, 'active') = 'under_review' then
    raise exception 'This custom Activity title is under review. The original Activity name is shown until moderation is complete.'
      using errcode = '55000';
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
      updated_at,
      moderation_status,
      held_title,
      moderation_reported_at
    ) values (
      p_plan_id,
      v_title,
      v_visibility,
      v_user_id,
      now(),
      now(),
      'active',
      null,
      null
    )
    on conflict (plan_id)
    do update set
      title = excluded.title,
      visibility = excluded.visibility,
      updated_at = now(),
      moderation_status = 'active',
      held_title = null,
      moderation_reported_at = null;
  end if;

  update public.experiences
  set title = v_canonical_title,
      updated_at = now()
  where plan_id = p_plan_id;

  return v_title;
end;
$$;

create or replace function public.report_shared_activity_title(
  p_plan_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := lower(nullif(btrim(coalesce(p_reason, '')), ''));
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_title text;
  v_visibility text;
  v_canonical_title text;
  v_report_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if v_reason is null or v_reason not in (
    'offensive_abusive',
    'hate_harassment',
    'sexual_content',
    'spam_advertising',
    'misleading',
    'other'
  ) then
    raise exception 'Choose a valid report reason.' using errcode = '22023';
  end if;

  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'Report details may contain at most 1000 characters.' using errcode = '22023';
  end if;

  select
    title_row.title,
    title_row.visibility,
    title_row.moderation_status,
    coalesce(activity.name, nullif(btrim(plan.title), ''), 'UIN Activity')
  into
    v_title,
    v_visibility,
    v_status,
    v_canonical_title
  from public.plan_private_titles title_row
  join public.plans plan on plan.id = title_row.plan_id
  left join public.activities activity on activity.id = plan.activity_id
  where title_row.plan_id = p_plan_id
  for update of title_row;

  if v_title is null then
    raise exception 'There is no custom Activity title to report.' using errcode = 'P0002';
  end if;

  if not public.can_user_view_plan_presentation(
    p_plan_id,
    v_visibility,
    v_user_id
  ) then
    raise exception 'You cannot report a title you cannot view.' using errcode = '42501';
  end if;

  if coalesce(v_status, 'active') = 'under_review' then
    select report.id
    into v_report_id
    from public.plan_title_reports report
    where report.plan_id = p_plan_id
      and report.status = 'pending'
    order by report.created_at desc
    limit 1;

    if v_report_id is not null then
      return v_report_id;
    end if;
  end if;

  if btrim(v_title) = btrim(v_canonical_title) then
    raise exception 'The original Activity title cannot be reported as a custom title.' using errcode = '22023';
  end if;

  insert into public.plan_title_reports (
    plan_id,
    reported_by_user_id,
    custom_title_snapshot,
    canonical_title_snapshot,
    reason,
    details,
    status,
    created_at
  ) values (
    p_plan_id,
    v_user_id,
    v_title,
    v_canonical_title,
    v_reason,
    v_details,
    'pending',
    now()
  )
  returning id into v_report_id;

  -- Immediate safety fallback: preserve the reported title privately, but make
  -- every existing presentation path resolve to the canonical Activity title.
  update public.plan_private_titles
  set held_title = v_title,
      title = v_canonical_title,
      moderation_status = 'under_review',
      moderation_reported_at = now(),
      updated_at = now()
  where plan_id = p_plan_id;

  return v_report_id;
end;
$$;

create or replace function public.get_plan_title_moderation_state(
  p_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  moderation_status text,
  moderation_reported_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    title_row.plan_id,
    title_row.moderation_status,
    title_row.moderation_reported_at
  from public.plan_private_titles title_row
  where auth.uid() is not null
    and title_row.plan_id = any(coalesce(p_plan_ids, array[]::uuid[]))
    and public.can_user_view_plan_base(title_row.plan_id, auth.uid());
$$;

create or replace function public.get_admin_plan_title_reports(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  report_id uuid,
  plan_id uuid,
  plan_status text,
  custom_title_snapshot text,
  canonical_title_snapshot text,
  reason text,
  details text,
  report_status text,
  reporter_user_id uuid,
  reporter_full_name text,
  reporter_username text,
  reporter_avatar_url text,
  host_user_id uuid,
  host_full_name text,
  host_username text,
  host_avatar_url text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select public.get_admin_role()::text into v_role;
  if coalesce(v_role, '') not in ('owner', 'admin', 'moderator', 'support') then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('pending', 'dismissed', 'removed') then
    raise exception 'Unsupported report status.' using errcode = '22023';
  end if;

  return query
  select
    report.id,
    report.plan_id,
    plan.status,
    report.custom_title_snapshot,
    report.canonical_title_snapshot,
    report.reason,
    report.details,
    report.status,
    reporter.id,
    reporter.full_name,
    reporter.username,
    reporter.avatar_url,
    host_profile.id,
    host_profile.full_name,
    host_profile.username,
    host_profile.avatar_url,
    report.created_at,
    report.resolved_at,
    report.resolution_note,
    count(*) over()
  from public.plan_title_reports report
  join public.plans plan on plan.id = report.plan_id
  left join public.profiles reporter on reporter.id = report.reported_by_user_id
  left join public.profiles host_profile on host_profile.id = plan.host_user_id
  where v_status is null or report.status = v_status
  order by
    case when report.status = 'pending' then 0 else 1 end,
    report.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.resolve_admin_plan_title_report(
  p_report_id uuid,
  p_decision text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_decision text := lower(nullif(btrim(coalesce(p_decision, '')), ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_report public.plan_title_reports%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select public.get_admin_role()::text into v_role;
  if coalesce(v_role, '') not in ('owner', 'admin', 'moderator') then
    raise exception 'Moderator access is required.' using errcode = '42501';
  end if;

  if v_decision not in ('restore', 'remove') then
    raise exception 'Decision must be restore or remove.' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Resolution note may contain at most 1000 characters.' using errcode = '22023';
  end if;

  select *
  into v_report
  from public.plan_title_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Title report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'pending' then
    raise exception 'This title report has already been resolved.' using errcode = '55000';
  end if;

  if v_decision = 'restore' then
    update public.plan_private_titles
    set title = coalesce(held_title, v_report.custom_title_snapshot),
        held_title = null,
        moderation_status = 'active',
        moderation_reported_at = null,
        updated_at = now()
    where plan_id = v_report.plan_id;

    update public.plan_title_reports
    set status = 'dismissed',
        resolved_by_user_id = v_user_id,
        resolution_note = v_note,
        resolved_at = now()
    where id = p_report_id;
  else
    delete from public.plan_private_titles
    where plan_id = v_report.plan_id;

    update public.plan_title_reports
    set status = 'removed',
        resolved_by_user_id = v_user_id,
        resolution_note = v_note,
        resolved_at = now()
    where id = p_report_id;
  end if;

  return true;
end;
$$;

revoke all on function public.update_shared_activity_title(uuid, text, text) from public;
revoke all on function public.report_shared_activity_title(uuid, text, text) from public;
revoke all on function public.get_plan_title_moderation_state(uuid[]) from public;
revoke all on function public.get_admin_plan_title_reports(text, integer, integer) from public;
revoke all on function public.resolve_admin_plan_title_report(uuid, text, text) from public;

grant execute on function public.update_shared_activity_title(uuid, text, text) to authenticated;
grant execute on function public.report_shared_activity_title(uuid, text, text) to authenticated;
grant execute on function public.get_plan_title_moderation_state(uuid[]) to authenticated;
grant execute on function public.get_admin_plan_title_reports(text, integer, integer) to authenticated;
grant execute on function public.resolve_admin_plan_title_report(uuid, text, text) to authenticated;

commit;
