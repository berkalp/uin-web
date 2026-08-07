begin;

-- ============================================================
-- PLAN TOOLKIT: CHECKLIST + PRIVATE FILE ARCHIVE
-- ============================================================

create table if not exists public.plan_toolkit_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null,
  description text null,
  importance text not null default 'required',
  status text not null default 'todo',
  due_at timestamptz null,
  requires_host_approval boolean not null default false,
  allow_volunteers boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  completed_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plan_toolkit_tasks_title_length
    check (char_length(btrim(title)) between 1 and 180),
  constraint plan_toolkit_tasks_description_length
    check (description is null or char_length(description) <= 2000),
  constraint plan_toolkit_tasks_importance_check
    check (importance in ('required', 'optional')),
  constraint plan_toolkit_tasks_status_check
    check (status in ('todo', 'in_progress', 'awaiting_approval', 'done'))
);

create index if not exists plan_toolkit_tasks_plan_order_idx
on public.plan_toolkit_tasks (
  plan_id,
  status,
  due_at,
  created_at,
  id
);

create table if not exists public.plan_toolkit_task_assignees (
  task_id uuid not null references public.plan_toolkit_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid null references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists plan_toolkit_task_assignees_user_idx
on public.plan_toolkit_task_assignees (user_id, task_id);

create table if not exists public.plan_toolkit_files (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  task_id uuid null references public.plan_toolkit_tasks(id) on delete set null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  kind text not null,
  storage_path text null,
  external_url text null,
  file_name text not null,
  mime_type text null,
  file_size bigint null,
  category text not null default 'other',
  description text null,
  visibility text not null default 'plan_members',
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plan_toolkit_files_kind_check
    check (kind in ('file', 'link')),
  constraint plan_toolkit_files_category_check
    check (category in ('tickets', 'reservations', 'routes', 'documents', 'receipts', 'other')),
  constraint plan_toolkit_files_visibility_check
    check (visibility in ('plan_members', 'hosts_only', 'selected', 'only_me')),
  constraint plan_toolkit_files_name_length
    check (char_length(btrim(file_name)) between 1 and 240),
  constraint plan_toolkit_files_description_length
    check (description is null or char_length(description) <= 1200),
  constraint plan_toolkit_files_size_check
    check (file_size is null or file_size between 0 and 52428800),
  constraint plan_toolkit_files_source_check
    check (
      (kind = 'file' and storage_path is not null and external_url is null)
      or
      (kind = 'link' and external_url is not null and storage_path is null)
    )
);

create unique index if not exists plan_toolkit_files_storage_path_uidx
on public.plan_toolkit_files (storage_path)
where storage_path is not null;

create index if not exists plan_toolkit_files_plan_order_idx
on public.plan_toolkit_files (plan_id, kind, category, created_at desc, id);

create index if not exists plan_toolkit_files_task_idx
on public.plan_toolkit_files (task_id, created_at desc)
where task_id is not null;

create table if not exists public.plan_toolkit_file_recipients (
  file_id uuid not null references public.plan_toolkit_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (file_id, user_id)
);

create index if not exists plan_toolkit_file_recipients_user_idx
on public.plan_toolkit_file_recipients (user_id, file_id);

create or replace function public.set_plan_toolkit_updated_at_v1()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists set_plan_toolkit_tasks_updated_at
on public.plan_toolkit_tasks;

create trigger set_plan_toolkit_tasks_updated_at
before update on public.plan_toolkit_tasks
for each row execute function public.set_plan_toolkit_updated_at_v1();

drop trigger if exists set_plan_toolkit_files_updated_at
on public.plan_toolkit_files;

create trigger set_plan_toolkit_files_updated_at
before update on public.plan_toolkit_files
for each row execute function public.set_plan_toolkit_updated_at_v1();

-- ============================================================
-- ACCESS HELPERS
-- ============================================================

create or replace function public.is_plan_toolkit_member_for_user_v1(
  p_plan_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.plans plan
      where plan.id = p_plan_id
        and (
          plan.host_user_id = p_user_id
          or exists (
            select 1
            from public.plan_members member
            where member.plan_id = plan.id
              and member.user_id = p_user_id
              and member.status = 'active'
          )
        )
    );
$function$;

create or replace function public.is_plan_toolkit_member_v1(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_plan_toolkit_member_for_user_v1(p_plan_id, auth.uid());
$function$;

create or replace function public.is_plan_toolkit_manager_for_user_v1(
  p_plan_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.plans plan
      where plan.id = p_plan_id
        and (
          plan.host_user_id = p_user_id
          or exists (
            select 1
            from public.plan_members member
            where member.plan_id = plan.id
              and member.user_id = p_user_id
              and member.status = 'active'
              and member.role = 'co_host'
          )
        )
    );
$function$;

create or replace function public.is_plan_toolkit_manager_v1(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_plan_toolkit_manager_for_user_v1(p_plan_id, auth.uid());
$function$;

create or replace function public.is_plan_toolkit_editable_v1(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.plans plan
    where plan.id = p_plan_id
      and plan.status in ('forming', 'planned')
      and plan.expired_at is null
      and (
        plan.status <> 'forming'
        or plan.window_end is null
        or plan.window_end >= current_date
      )
      and (
        plan.status <> 'planned'
        or plan.scheduled_end is null
        or plan.scheduled_end > now()
      )
  );
$function$;

create or replace function public.can_view_plan_toolkit_file_for_user_v1(
  p_file_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.plan_toolkit_files file_row
    where file_row.id = p_file_id
      and p_user_id is not null
      and (
        (file_row.visibility = 'only_me' and file_row.uploaded_by = p_user_id)
        or
        (file_row.visibility = 'hosts_only' and public.is_plan_toolkit_manager_for_user_v1(file_row.plan_id, p_user_id))
        or
        (file_row.visibility = 'plan_members' and public.is_plan_toolkit_member_for_user_v1(file_row.plan_id, p_user_id))
        or
        (
          file_row.visibility = 'selected'
          and (
            file_row.uploaded_by = p_user_id
            or public.is_plan_toolkit_manager_for_user_v1(file_row.plan_id, p_user_id)
            or exists (
              select 1
              from public.plan_toolkit_file_recipients recipient
              where recipient.file_id = file_row.id
                and recipient.user_id = p_user_id
            )
          )
        )
      )
  );
$function$;

create or replace function public.can_view_plan_toolkit_file_v1(
  p_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.can_view_plan_toolkit_file_for_user_v1(p_file_id, auth.uid());
$function$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.plan_toolkit_tasks enable row level security;
alter table public.plan_toolkit_task_assignees enable row level security;
alter table public.plan_toolkit_files enable row level security;
alter table public.plan_toolkit_file_recipients enable row level security;

drop policy if exists plan_toolkit_tasks_member_select on public.plan_toolkit_tasks;
create policy plan_toolkit_tasks_member_select
on public.plan_toolkit_tasks
for select to authenticated
using (public.is_plan_toolkit_member_v1(plan_id));

drop policy if exists plan_toolkit_task_assignees_member_select on public.plan_toolkit_task_assignees;
create policy plan_toolkit_task_assignees_member_select
on public.plan_toolkit_task_assignees
for select to authenticated
using (
  exists (
    select 1
    from public.plan_toolkit_tasks task_row
    where task_row.id = public.plan_toolkit_task_assignees.task_id
      and public.is_plan_toolkit_member_v1(task_row.plan_id)
  )
);

drop policy if exists plan_toolkit_files_visible_select on public.plan_toolkit_files;
create policy plan_toolkit_files_visible_select
on public.plan_toolkit_files
for select to authenticated
using (public.can_view_plan_toolkit_file_v1(id));

drop policy if exists plan_toolkit_file_recipients_visible_select on public.plan_toolkit_file_recipients;
create policy plan_toolkit_file_recipients_visible_select
on public.plan_toolkit_file_recipients
for select to authenticated
using (public.can_view_plan_toolkit_file_v1(file_id));

-- ============================================================
-- TASK RPCS
-- ============================================================

create or replace function public.get_plan_toolkit_tasks_v1(
  p_plan_id uuid
)
returns table (
  task_id uuid,
  plan_id uuid,
  title text,
  description text,
  importance text,
  status text,
  due_at timestamptz,
  requires_host_approval boolean,
  allow_volunteers boolean,
  created_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  can_manage boolean,
  viewer_is_assigned boolean,
  can_claim boolean,
  assignees jsonb,
  attachment_count integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_can_manage boolean;
begin
  v_user_id := auth.uid();

  if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_user_id) then
    raise exception 'You are not allowed to view this Plan Toolkit.' using errcode = '42501';
  end if;

  v_can_manage := public.is_plan_toolkit_manager_for_user_v1(p_plan_id, v_user_id);

  return query
  select
    task_row.id,
    task_row.plan_id,
    task_row.title,
    task_row.description,
    task_row.importance,
    task_row.status,
    task_row.due_at,
    task_row.requires_host_approval,
    task_row.allow_volunteers,
    task_row.created_by,
    task_row.completed_by,
    task_row.completed_at,
    task_row.approved_by,
    task_row.approved_at,
    task_row.created_at,
    task_row.updated_at,
    v_can_manage,
    exists (
      select 1
      from public.plan_toolkit_task_assignees assignment
      where assignment.task_id = task_row.id
        and assignment.user_id = v_user_id
    ),
    (
      not v_can_manage
      and task_row.allow_volunteers
      and task_row.status <> 'done'
      and not exists (
        select 1
        from public.plan_toolkit_task_assignees assignment
        where assignment.task_id = task_row.id
      )
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', assignment.user_id,
            'full_name', profile.full_name,
            'username', profile.username,
            'avatar_url', profile.avatar_url,
            'role', member.role
          )
          order by coalesce(profile.full_name, profile.username, 'UIN member'), assignment.assigned_at
        )
        from public.plan_toolkit_task_assignees assignment
        left join public.profiles profile on profile.id = assignment.user_id
        left join public.plan_members member
          on member.plan_id = task_row.plan_id
         and member.user_id = assignment.user_id
         and member.status = 'active'
        where assignment.task_id = task_row.id
      ),
      '[]'::jsonb
    ),
    (
      select count(*)::integer
      from public.plan_toolkit_files file_row
      where file_row.task_id = task_row.id
        and public.can_view_plan_toolkit_file_for_user_v1(file_row.id, v_user_id)
    )
  from public.plan_toolkit_tasks task_row
  where task_row.plan_id = p_plan_id
  order by
    case task_row.status
      when 'awaiting_approval' then 0
      when 'in_progress' then 1
      when 'todo' then 2
      else 3
    end,
    task_row.due_at nulls last,
    task_row.created_at,
    task_row.id;
end;
$function$;

create or replace function public.create_plan_toolkit_task_v1(
  p_plan_id uuid,
  p_title text,
  p_description text default null,
  p_importance text default 'required',
  p_due_at timestamptz default null,
  p_requires_host_approval boolean default false,
  p_allow_volunteers boolean default false,
  p_assignee_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_task_id uuid;
  v_title text;
  v_description text;
  v_importance text;
  v_assignee_id uuid;
begin
  v_user_id := auth.uid();
  v_title := btrim(coalesce(p_title, ''));
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  v_importance := lower(btrim(coalesce(p_importance, 'required')));

  if not public.is_plan_toolkit_manager_for_user_v1(p_plan_id, v_user_id) then
    raise exception 'Only the Host or a Co-host can create checklist tasks.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(p_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  if char_length(v_title) not between 1 and 180 then
    raise exception 'Task title must contain between 1 and 180 characters.' using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Task description is too long.' using errcode = '22023';
  end if;

  if v_importance not in ('required', 'optional') then
    raise exception 'Invalid task importance.' using errcode = '22023';
  end if;

  insert into public.plan_toolkit_tasks (
    plan_id, title, description, importance, due_at,
    requires_host_approval, allow_volunteers, created_by
  ) values (
    p_plan_id, v_title, v_description, v_importance, p_due_at,
    coalesce(p_requires_host_approval, false), coalesce(p_allow_volunteers, false), v_user_id
  ) returning id into v_task_id;

  for v_assignee_id in
    select distinct unnest(coalesce(p_assignee_ids, '{}'::uuid[]))
  loop
    if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_assignee_id) then
      raise exception 'Every assignee must be an active Plan member.' using errcode = '22023';
    end if;

    insert into public.plan_toolkit_task_assignees (task_id, user_id, assigned_by)
    values (v_task_id, v_assignee_id, v_user_id)
    on conflict do nothing;
  end loop;

  return v_task_id;
end;
$function$;

create or replace function public.update_plan_toolkit_task_v1(
  p_task_id uuid,
  p_title text,
  p_description text default null,
  p_importance text default 'required',
  p_due_at timestamptz default null,
  p_requires_host_approval boolean default false,
  p_allow_volunteers boolean default false,
  p_assignee_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_title text;
  v_description text;
  v_importance text;
  v_assignee_id uuid;
begin
  v_user_id := auth.uid();

  select task_row.plan_id into v_plan_id
  from public.plan_toolkit_tasks task_row
  where task_row.id = p_task_id
  for update;

  if v_plan_id is null then
    raise exception 'Checklist task not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_manager_for_user_v1(v_plan_id, v_user_id) then
    raise exception 'Only the Host or a Co-host can edit checklist tasks.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  v_importance := lower(btrim(coalesce(p_importance, 'required')));

  if char_length(v_title) not between 1 and 180 then
    raise exception 'Task title must contain between 1 and 180 characters.' using errcode = '22023';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Task description is too long.' using errcode = '22023';
  end if;

  if v_importance not in ('required', 'optional') then
    raise exception 'Invalid task importance.' using errcode = '22023';
  end if;

  update public.plan_toolkit_tasks
  set title = v_title,
      description = v_description,
      importance = v_importance,
      due_at = p_due_at,
      requires_host_approval = coalesce(p_requires_host_approval, false),
      allow_volunteers = coalesce(p_allow_volunteers, false)
  where id = p_task_id;

  delete from public.plan_toolkit_task_assignees
  where task_id = p_task_id;

  for v_assignee_id in
    select distinct unnest(coalesce(p_assignee_ids, '{}'::uuid[]))
  loop
    if not public.is_plan_toolkit_member_for_user_v1(v_plan_id, v_assignee_id) then
      raise exception 'Every assignee must be an active Plan member.' using errcode = '22023';
    end if;

    insert into public.plan_toolkit_task_assignees (task_id, user_id, assigned_by)
    values (p_task_id, v_assignee_id, v_user_id)
    on conflict do nothing;
  end loop;
end;
$function$;

create or replace function public.delete_plan_toolkit_task_v1(
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
begin
  v_user_id := auth.uid();

  select task_row.plan_id into v_plan_id
  from public.plan_toolkit_tasks task_row
  where task_row.id = p_task_id
  for update;

  if v_plan_id is null then
    raise exception 'Checklist task not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_manager_for_user_v1(v_plan_id, v_user_id) then
    raise exception 'Only the Host or a Co-host can delete checklist tasks.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  delete from public.plan_toolkit_tasks where id = p_task_id;
end;
$function$;

create or replace function public.claim_plan_toolkit_task_v1(
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_allow_volunteers boolean;
  v_status text;
begin
  v_user_id := auth.uid();

  select task_row.plan_id, task_row.allow_volunteers, task_row.status
  into v_plan_id, v_allow_volunteers, v_status
  from public.plan_toolkit_tasks task_row
  where task_row.id = p_task_id
  for update;

  if v_plan_id is null then
    raise exception 'Checklist task not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_member_for_user_v1(v_plan_id, v_user_id) then
    raise exception 'Only active Plan members can claim tasks.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  if not v_allow_volunteers or v_status = 'done' then
    raise exception 'This task is not open for volunteers.' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.plan_toolkit_task_assignees assignment
    where assignment.task_id = p_task_id
  ) then
    raise exception 'This task has already been assigned.' using errcode = '23505';
  end if;

  insert into public.plan_toolkit_task_assignees (task_id, user_id, assigned_by)
  values (p_task_id, v_user_id, v_user_id);
end;
$function$;

create or replace function public.unclaim_plan_toolkit_task_v1(
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_status text;
begin
  v_user_id := auth.uid();

  select task_row.plan_id, task_row.status
  into v_plan_id, v_status
  from public.plan_toolkit_tasks task_row
  where task_row.id = p_task_id
  for update;

  if v_plan_id is null then
    raise exception 'Checklist task not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  if v_status not in ('todo', 'in_progress') then
    raise exception 'This task can no longer be released.' using errcode = '55000';
  end if;

  delete from public.plan_toolkit_task_assignees
  where task_id = p_task_id and user_id = v_user_id;

  if not found then
    raise exception 'You are not assigned to this task.' using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.set_plan_toolkit_task_status_v1(
  p_task_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_current_status text;
  v_requires_approval boolean;
  v_is_manager boolean;
  v_is_assigned boolean;
  v_requested_status text;
  v_final_status text;
begin
  v_user_id := auth.uid();
  v_requested_status := lower(btrim(coalesce(p_status, '')));

  if v_requested_status not in ('todo', 'in_progress', 'done') then
    raise exception 'Invalid task status.' using errcode = '22023';
  end if;

  select task_row.plan_id, task_row.status, task_row.requires_host_approval
  into v_plan_id, v_current_status, v_requires_approval
  from public.plan_toolkit_tasks task_row
  where task_row.id = p_task_id
  for update;

  if v_plan_id is null then
    raise exception 'Checklist task not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  v_is_manager := public.is_plan_toolkit_manager_for_user_v1(v_plan_id, v_user_id);
  v_is_assigned := exists (
    select 1 from public.plan_toolkit_task_assignees assignment
    where assignment.task_id = p_task_id and assignment.user_id = v_user_id
  );

  if not v_is_manager and not v_is_assigned then
    raise exception 'Only an assignee, Host or Co-host can update this task.' using errcode = '42501';
  end if;

  if not v_is_manager and v_current_status in ('awaiting_approval', 'done') then
    raise exception 'Only the Host or a Co-host can reopen or review this task.' using errcode = '42501';
  end if;

  if v_requested_status = 'done' and v_requires_approval and not v_is_manager then
    v_final_status := 'awaiting_approval';
  else
    v_final_status := v_requested_status;
  end if;

  update public.plan_toolkit_tasks
  set status = v_final_status,
      completed_by = case when v_final_status = 'done' then v_user_id else null end,
      completed_at = case when v_final_status = 'done' then now() else null end,
      approved_by = case when v_final_status = 'done' and v_is_manager then v_user_id else null end,
      approved_at = case when v_final_status = 'done' and v_is_manager then now() else null end
  where id = p_task_id;

  return v_final_status;
end;
$function$;

create or replace function public.review_plan_toolkit_task_v1(
  p_task_id uuid,
  p_approve boolean
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_status text;
  v_final_status text;
begin
  v_user_id := auth.uid();

  select task_row.plan_id, task_row.status
  into v_plan_id, v_status
  from public.plan_toolkit_tasks task_row
  where task_row.id = p_task_id
  for update;

  if v_plan_id is null then
    raise exception 'Checklist task not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_manager_for_user_v1(v_plan_id, v_user_id) then
    raise exception 'Only the Host or a Co-host can review this task.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  if v_status <> 'awaiting_approval' then
    raise exception 'This task is not waiting for approval.' using errcode = '55000';
  end if;

  v_final_status := case when coalesce(p_approve, false) then 'done' else 'in_progress' end;

  update public.plan_toolkit_tasks
  set status = v_final_status,
      completed_by = case when v_final_status = 'done' then v_user_id else null end,
      completed_at = case when v_final_status = 'done' then now() else null end,
      approved_by = case when v_final_status = 'done' then v_user_id else null end,
      approved_at = case when v_final_status = 'done' then now() else null end
  where id = p_task_id;

  return v_final_status;
end;
$function$;

-- ============================================================
-- FILE RPCS
-- ============================================================

create or replace function public.get_plan_toolkit_files_v1(
  p_plan_id uuid
)
returns table (
  file_id uuid,
  plan_id uuid,
  task_id uuid,
  task_title text,
  uploaded_by uuid,
  uploader_full_name text,
  uploader_username text,
  uploader_avatar_url text,
  kind text,
  storage_path text,
  external_url text,
  file_name text,
  mime_type text,
  file_size bigint,
  category text,
  description text,
  visibility text,
  sensitive boolean,
  recipients jsonb,
  can_delete boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_user_id) then
    raise exception 'You are not allowed to view this Plan Toolkit.' using errcode = '42501';
  end if;

  return query
  select
    file_row.id,
    file_row.plan_id,
    file_row.task_id,
    task_row.title,
    file_row.uploaded_by,
    uploader.full_name,
    uploader.username,
    uploader.avatar_url,
    file_row.kind,
    file_row.storage_path,
    file_row.external_url,
    file_row.file_name,
    file_row.mime_type,
    file_row.file_size,
    file_row.category,
    file_row.description,
    file_row.visibility,
    file_row.sensitive,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', recipient.user_id,
            'full_name', profile.full_name,
            'username', profile.username,
            'avatar_url', profile.avatar_url
          )
          order by coalesce(profile.full_name, profile.username, 'UIN member')
        )
        from public.plan_toolkit_file_recipients recipient
        left join public.profiles profile on profile.id = recipient.user_id
        where recipient.file_id = file_row.id
      ),
      '[]'::jsonb
    ),
    (
      public.is_plan_toolkit_editable_v1(file_row.plan_id)
      and (
        file_row.uploaded_by = v_user_id
        or public.is_plan_toolkit_manager_for_user_v1(file_row.plan_id, v_user_id)
      )
    ),
    file_row.created_at,
    file_row.updated_at
  from public.plan_toolkit_files file_row
  left join public.plan_toolkit_tasks task_row on task_row.id = file_row.task_id
  left join public.profiles uploader on uploader.id = file_row.uploaded_by
  where file_row.plan_id = p_plan_id
    and public.can_view_plan_toolkit_file_for_user_v1(file_row.id, v_user_id)
  order by file_row.created_at desc, file_row.id desc;
end;
$function$;

create or replace function public.register_plan_toolkit_file_v1(
  p_plan_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_category text default 'other',
  p_description text default null,
  p_visibility text default 'plan_members',
  p_sensitive boolean default false,
  p_task_id uuid default null,
  p_recipient_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_file_id uuid;
  v_storage_path text;
  v_file_name text;
  v_category text;
  v_visibility text;
  v_description text;
  v_recipient_id uuid;
begin
  v_user_id := auth.uid();

  if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_user_id) then
    raise exception 'Only active Plan members can add files.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(p_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  v_storage_path := btrim(coalesce(p_storage_path, ''));
  v_file_name := btrim(coalesce(p_file_name, ''));
  v_category := lower(btrim(coalesce(p_category, 'other')));
  v_visibility := lower(btrim(coalesce(p_visibility, 'plan_members')));
  v_description := nullif(btrim(coalesce(p_description, '')), '');

  if v_storage_path = '' or v_storage_path not like p_plan_id::text || '/' || v_user_id::text || '/%' then
    raise exception 'Invalid Plan file storage path.' using errcode = '22023';
  end if;

  if char_length(v_file_name) not between 1 and 240 then
    raise exception 'File name must contain between 1 and 240 characters.' using errcode = '22023';
  end if;

  if p_file_size is not null and (p_file_size < 0 or p_file_size > 52428800) then
    raise exception 'Files must be 50 MB or smaller.' using errcode = '22023';
  end if;

  if v_category not in ('tickets', 'reservations', 'routes', 'documents', 'receipts', 'other') then
    raise exception 'Invalid file category.' using errcode = '22023';
  end if;

  if v_visibility not in ('plan_members', 'hosts_only', 'selected', 'only_me') then
    raise exception 'Invalid file visibility.' using errcode = '22023';
  end if;

  if p_task_id is not null and not exists (
    select 1 from public.plan_toolkit_tasks task_row
    where task_row.id = p_task_id and task_row.plan_id = p_plan_id
  ) then
    raise exception 'The selected checklist task does not belong to this Plan.' using errcode = '22023';
  end if;

  if v_visibility = 'selected' and cardinality(coalesce(p_recipient_ids, '{}'::uuid[])) = 0 then
    raise exception 'Choose at least one member for selected visibility.' using errcode = '22023';
  end if;

  insert into public.plan_toolkit_files (
    plan_id, task_id, uploaded_by, kind, storage_path,
    file_name, mime_type, file_size, category, description,
    visibility, sensitive
  ) values (
    p_plan_id, p_task_id, v_user_id, 'file', v_storage_path,
    v_file_name, nullif(btrim(coalesce(p_mime_type, '')), ''), p_file_size,
    v_category, v_description, v_visibility, coalesce(p_sensitive, false)
  ) returning id into v_file_id;

  if v_visibility = 'selected' then
    for v_recipient_id in
      select distinct unnest(coalesce(p_recipient_ids, '{}'::uuid[]))
    loop
      if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_recipient_id) then
        raise exception 'Every selected recipient must be an active Plan member.' using errcode = '22023';
      end if;

      insert into public.plan_toolkit_file_recipients (file_id, user_id, added_by)
      values (v_file_id, v_recipient_id, v_user_id)
      on conflict do nothing;
    end loop;
  end if;

  return v_file_id;
end;
$function$;

create or replace function public.create_plan_toolkit_link_v1(
  p_plan_id uuid,
  p_external_url text,
  p_file_name text,
  p_category text default 'other',
  p_description text default null,
  p_visibility text default 'plan_members',
  p_sensitive boolean default false,
  p_task_id uuid default null,
  p_recipient_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_file_id uuid;
  v_url text;
  v_file_name text;
  v_category text;
  v_visibility text;
  v_description text;
  v_recipient_id uuid;
begin
  v_user_id := auth.uid();

  if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_user_id) then
    raise exception 'Only active Plan members can add links.' using errcode = '42501';
  end if;

  if not public.is_plan_toolkit_editable_v1(p_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  v_url := btrim(coalesce(p_external_url, ''));
  v_file_name := btrim(coalesce(p_file_name, ''));
  v_category := lower(btrim(coalesce(p_category, 'other')));
  v_visibility := lower(btrim(coalesce(p_visibility, 'plan_members')));
  v_description := nullif(btrim(coalesce(p_description, '')), '');

  if v_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Use a valid HTTPS link.' using errcode = '22023';
  end if;

  if char_length(v_file_name) not between 1 and 240 then
    raise exception 'Link name must contain between 1 and 240 characters.' using errcode = '22023';
  end if;

  if v_category not in ('tickets', 'reservations', 'routes', 'documents', 'receipts', 'other') then
    raise exception 'Invalid link category.' using errcode = '22023';
  end if;

  if v_visibility not in ('plan_members', 'hosts_only', 'selected', 'only_me') then
    raise exception 'Invalid link visibility.' using errcode = '22023';
  end if;

  if p_task_id is not null and not exists (
    select 1 from public.plan_toolkit_tasks task_row
    where task_row.id = p_task_id and task_row.plan_id = p_plan_id
  ) then
    raise exception 'The selected checklist task does not belong to this Plan.' using errcode = '22023';
  end if;

  if v_visibility = 'selected' and cardinality(coalesce(p_recipient_ids, '{}'::uuid[])) = 0 then
    raise exception 'Choose at least one member for selected visibility.' using errcode = '22023';
  end if;

  insert into public.plan_toolkit_files (
    plan_id, task_id, uploaded_by, kind, external_url,
    file_name, category, description, visibility, sensitive
  ) values (
    p_plan_id, p_task_id, v_user_id, 'link', v_url,
    v_file_name, v_category, v_description, v_visibility, coalesce(p_sensitive, false)
  ) returning id into v_file_id;

  if v_visibility = 'selected' then
    for v_recipient_id in
      select distinct unnest(coalesce(p_recipient_ids, '{}'::uuid[]))
    loop
      if not public.is_plan_toolkit_member_for_user_v1(p_plan_id, v_recipient_id) then
        raise exception 'Every selected recipient must be an active Plan member.' using errcode = '22023';
      end if;

      insert into public.plan_toolkit_file_recipients (file_id, user_id, added_by)
      values (v_file_id, v_recipient_id, v_user_id)
      on conflict do nothing;
    end loop;
  end if;

  return v_file_id;
end;
$function$;

create or replace function public.delete_plan_toolkit_file_v1(
  p_file_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_uploaded_by uuid;
begin
  v_user_id := auth.uid();

  select file_row.plan_id, file_row.uploaded_by
  into v_plan_id, v_uploaded_by
  from public.plan_toolkit_files file_row
  where file_row.id = p_file_id
  for update;

  if v_plan_id is null then
    raise exception 'Plan file not found.' using errcode = 'P0002';
  end if;

  if not public.is_plan_toolkit_editable_v1(v_plan_id) then
    raise exception 'This Plan Toolkit is read-only.' using errcode = '55000';
  end if;

  if v_uploaded_by is distinct from v_user_id and not public.is_plan_toolkit_manager_for_user_v1(v_plan_id, v_user_id) then
    raise exception 'Only the uploader, Host or Co-host can remove this file.' using errcode = '42501';
  end if;

  delete from public.plan_toolkit_files where id = p_file_id;
end;
$function$;

-- ============================================================
-- PRIVATE STORAGE BUCKET
-- ============================================================

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'plan-files',
  'plan-files',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Plan members can upload toolkit files" on storage.objects;
create policy "Plan members can upload toolkit files"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'plan-files'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[2] = auth.uid()::text
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.is_plan_toolkit_member_v1((storage.foldername(name))[1]::uuid)
       and public.is_plan_toolkit_editable_v1((storage.foldername(name))[1]::uuid)
    else false
  end
);

drop policy if exists "Visible Plan toolkit files can be read" on storage.objects;
create policy "Visible Plan toolkit files can be read"
on storage.objects
for select to authenticated
using (
  bucket_id = 'plan-files'
  and exists (
    select 1
    from public.plan_toolkit_files file_row
    where file_row.storage_path = storage.objects.name
      and public.can_view_plan_toolkit_file_v1(file_row.id)
  )
);

drop policy if exists "Plan toolkit file owners can remove objects" on storage.objects;
create policy "Plan toolkit file owners can remove objects"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'plan-files'
  and exists (
    select 1
    from public.plan_toolkit_files file_row
    where file_row.storage_path = storage.objects.name
      and public.is_plan_toolkit_editable_v1(file_row.plan_id)
      and (
        file_row.uploaded_by = auth.uid()
        or public.is_plan_toolkit_manager_v1(file_row.plan_id)
      )
  )
);

-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all on table public.plan_toolkit_tasks from anon, authenticated;
revoke all on table public.plan_toolkit_task_assignees from anon, authenticated;
revoke all on table public.plan_toolkit_files from anon, authenticated;
revoke all on table public.plan_toolkit_file_recipients from anon, authenticated;

grant select on table public.plan_toolkit_tasks to authenticated;
grant select on table public.plan_toolkit_task_assignees to authenticated;
grant select on table public.plan_toolkit_files to authenticated;
grant select on table public.plan_toolkit_file_recipients to authenticated;

revoke all on function public.is_plan_toolkit_member_for_user_v1(uuid, uuid) from public;
revoke all on function public.is_plan_toolkit_member_v1(uuid) from public;
revoke all on function public.is_plan_toolkit_manager_for_user_v1(uuid, uuid) from public;
revoke all on function public.is_plan_toolkit_manager_v1(uuid) from public;
revoke all on function public.is_plan_toolkit_editable_v1(uuid) from public;
revoke all on function public.can_view_plan_toolkit_file_for_user_v1(uuid, uuid) from public;
revoke all on function public.can_view_plan_toolkit_file_v1(uuid) from public;
revoke all on function public.get_plan_toolkit_tasks_v1(uuid) from public;
revoke all on function public.create_plan_toolkit_task_v1(uuid, text, text, text, timestamptz, boolean, boolean, uuid[]) from public;
revoke all on function public.update_plan_toolkit_task_v1(uuid, text, text, text, timestamptz, boolean, boolean, uuid[]) from public;
revoke all on function public.delete_plan_toolkit_task_v1(uuid) from public;
revoke all on function public.claim_plan_toolkit_task_v1(uuid) from public;
revoke all on function public.unclaim_plan_toolkit_task_v1(uuid) from public;
revoke all on function public.set_plan_toolkit_task_status_v1(uuid, text) from public;
revoke all on function public.review_plan_toolkit_task_v1(uuid, boolean) from public;
revoke all on function public.get_plan_toolkit_files_v1(uuid) from public;
revoke all on function public.register_plan_toolkit_file_v1(uuid, text, text, text, bigint, text, text, text, boolean, uuid, uuid[]) from public;
revoke all on function public.create_plan_toolkit_link_v1(uuid, text, text, text, text, text, boolean, uuid, uuid[]) from public;
revoke all on function public.delete_plan_toolkit_file_v1(uuid) from public;

grant execute on function public.is_plan_toolkit_member_v1(uuid) to authenticated;
grant execute on function public.is_plan_toolkit_manager_v1(uuid) to authenticated;
grant execute on function public.is_plan_toolkit_editable_v1(uuid) to authenticated;
grant execute on function public.can_view_plan_toolkit_file_v1(uuid) to authenticated;
grant execute on function public.get_plan_toolkit_tasks_v1(uuid) to authenticated;
grant execute on function public.create_plan_toolkit_task_v1(uuid, text, text, text, timestamptz, boolean, boolean, uuid[]) to authenticated;
grant execute on function public.update_plan_toolkit_task_v1(uuid, text, text, text, timestamptz, boolean, boolean, uuid[]) to authenticated;
grant execute on function public.delete_plan_toolkit_task_v1(uuid) to authenticated;
grant execute on function public.claim_plan_toolkit_task_v1(uuid) to authenticated;
grant execute on function public.unclaim_plan_toolkit_task_v1(uuid) to authenticated;
grant execute on function public.set_plan_toolkit_task_status_v1(uuid, text) to authenticated;
grant execute on function public.review_plan_toolkit_task_v1(uuid, boolean) to authenticated;
grant execute on function public.get_plan_toolkit_files_v1(uuid) to authenticated;
grant execute on function public.register_plan_toolkit_file_v1(uuid, text, text, text, bigint, text, text, text, boolean, uuid, uuid[]) to authenticated;
grant execute on function public.create_plan_toolkit_link_v1(uuid, text, text, text, text, text, boolean, uuid, uuid[]) to authenticated;
grant execute on function public.delete_plan_toolkit_file_v1(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
