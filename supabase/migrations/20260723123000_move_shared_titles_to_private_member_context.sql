begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

create table if not exists public.plan_private_titles (
  plan_id uuid primary key references public.plans(id) on delete cascade,
  title text not null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_private_titles_length_check
    check (char_length(btrim(title)) between 1 and 120)
);

alter table public.plan_private_titles enable row level security;
revoke all on public.plan_private_titles from anon, authenticated;

insert into public.plan_private_titles (
  plan_id,
  title,
  created_by_user_id,
  created_at,
  updated_at
)
select
  plan.id,
  btrim(plan.shared_title),
  plan.host_user_id,
  now(),
  now()
from public.plans plan
where plan.shared_title is not null
  and btrim(plan.shared_title) <> ''
on conflict (plan_id)
do update
set
  title = excluded.title,
  updated_at = now();

update public.experiences experience
set
  title = private_title.title,
  updated_at = now()
from public.plan_private_titles private_title
where experience.plan_id = private_title.plan_id;

update public.plans
set shared_title = null
where shared_title is not null;

alter table public.plans
  drop constraint if exists plans_shared_title_private_only_check;

alter table public.plans
  add constraint plans_shared_title_private_only_check
  check (shared_title is null) not valid;

alter table public.plans
  validate constraint plans_shared_title_private_only_check;

create or replace function public.set_private_plan_title_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_private_plan_title_updated_at_trigger
on public.plan_private_titles;

create trigger set_private_plan_title_updated_at_trigger
before update on public.plan_private_titles
for each row
execute function public.set_private_plan_title_updated_at();

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
  v_user_id uuid;
  v_title text;
  v_plan_status text;
  v_canonical_title text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_title := nullif(btrim(coalesce(p_shared_title, '')), '');

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
    )
    values (
      p_plan_id,
      v_title,
      v_user_id,
      now(),
      now()
    )
    on conflict (plan_id)
    do update
    set title = excluded.title,
        updated_at = now();
  end if;

  update public.experiences
  set
    title = coalesce(v_title, v_canonical_title),
    updated_at = now()
  where plan_id = p_plan_id;

  return v_title;
end;
$$;

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

  if not public.is_experience_manager(p_experience_id, v_user_id) then
    raise exception
      'Only the Primary Host or an active Co-host may edit this Experience.'
      using errcode = '42501';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  v_story := nullif(btrim(coalesce(p_story, '')), '');

  if v_title is null then
    raise exception 'A shared Experience title is required.'
      using errcode = '22023';
  end if;

  if char_length(v_title) > 120 then
    raise exception 'The shared title may contain at most 120 characters.'
      using errcode = '22023';
  end if;

  if v_story is not null and char_length(v_story) > 2000 then
    raise exception 'The Experience story may contain at most 2000 characters.'
      using errcode = '22023';
  end if;

  if p_visibility not in ('participants', 'friends', 'public') then
    raise exception 'Unsupported Experience visibility.'
      using errcode = '22023';
  end if;

  update public.experiences
  set
    title = v_title,
    story = v_story,
    visibility = p_visibility,
    updated_at = now()
  where id = p_experience_id
  returning plan_id into v_plan_id;

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
  set title = excluded.title,
      updated_at = now();

  return p_experience_id;
end;
$$;

create or replace function public.sync_completed_plan_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_private_title text;
begin
  if new.status = 'completed' then
    select private_title.title
    into v_private_title
    from public.plan_private_titles private_title
    where private_title.plan_id = new.id;

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
        v_private_title,
        nullif(btrim(new.title), ''),
        'Shared Experience'
      ),
      'participants',
      new.host_user_id,
      new.completed_at
    )
    on conflict (plan_id)
    do update
    set
      title = coalesce(
        v_private_title,
        public.experiences.title,
        nullif(btrim(new.title), ''),
        'Shared Experience'
      ),
      completed_at = coalesce(
        new.completed_at,
        public.experiences.completed_at
      ),
      updated_at = now();
  end if;

  return new;
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
  v_user_id uuid;
  v_is_member boolean;
  v_private_title text;
  v_activity_name text;
begin
  v_bundle := public.get_visible_experience_by_plan(p_plan_id);

  if v_bundle is null then
    return null;
  end if;

  v_user_id := auth.uid();

  select
    coalesce(
      activity.name,
      nullif(btrim(plan.title), ''),
      'UIN Activity'
    ),
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

  v_bundle := jsonb_set(
    v_bundle,
    '{shared_title}',
    'null'::jsonb,
    true
  );

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

revoke all
on function public.get_visible_experience_by_plan(uuid)
from public, anon, authenticated;

revoke all
on function public.get_visible_experience_by_plan_safe(uuid)
from public;

grant execute
on function public.get_visible_experience_by_plan_safe(uuid)
to anon, authenticated;

revoke all
on function public.get_private_shared_activity_title(uuid)
from public;

grant execute
on function public.get_private_shared_activity_title(uuid)
to authenticated;

revoke all
on function public.get_my_private_plan_titles(uuid[])
from public;

grant execute
on function public.get_my_private_plan_titles(uuid[])
to authenticated;

commit;
