begin;

create table if not exists public.plan_needs (
  id uuid primary key default gen_random_uuid(),

  plan_id uuid not null
    references public.plans(id)
    on delete cascade,

  need text not null,
  quantity integer not null default 1,
  importance text not null default 'required',

  created_by uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plan_needs_need_length
  check (
    char_length(btrim(need)) between 1 and 160
  ),

  constraint plan_needs_quantity_range
  check (
    quantity between 1 and 100000
  ),

  constraint plan_needs_importance_check
  check (
    importance in ('required', 'optional')
  )
);

create index if not exists plan_needs_plan_order_idx
on public.plan_needs (
  plan_id,
  importance,
  created_at,
  id
);


create table if not exists public.plan_need_contributions (
  need_id uuid not null
    references public.plan_needs(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (
    need_id,
    user_id
  ),

  constraint plan_need_contributions_quantity_range
  check (
    quantity between 1 and 100000
  )
);

create index if not exists plan_need_contributions_user_idx
on public.plan_need_contributions (
  user_id,
  need_id
);


create or replace function public.set_plan_need_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;


drop trigger if exists set_plan_needs_updated_at
on public.plan_needs;

create trigger set_plan_needs_updated_at
before update
on public.plan_needs
for each row
execute function public.set_plan_need_updated_at();


drop trigger if exists set_plan_need_contributions_updated_at
on public.plan_need_contributions;

create trigger set_plan_need_contributions_updated_at
before update
on public.plan_need_contributions
for each row
execute function public.set_plan_need_updated_at();


create or replace function public.can_view_plan_needs(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.plans plan
      where
        plan.id = p_plan_id
        and (
          plan.host_user_id = auth.uid()
          or exists (
            select 1
            from public.plan_members member
            where
              member.plan_id = plan.id
              and member.user_id = auth.uid()
              and member.status = 'active'
          )
        )
    );
$function$;


create or replace function public.can_manage_plan_needs(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.plans plan
      where
        plan.id = p_plan_id
        and (
          plan.host_user_id = auth.uid()
          or exists (
            select 1
            from public.plan_members member
            where
              member.plan_id = plan.id
              and member.user_id = auth.uid()
              and member.status = 'active'
              and member.role = 'co_host'
          )
        )
    );
$function$;


create or replace function public.lock_plan_need_manager(
  p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_host_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select plan.host_user_id
  into v_host_user_id
  from public.plans plan
  where plan.id = p_plan_id
  for share;

  if not found then
    raise exception
      'Plan not found.'
      using errcode = 'P0002';
  end if;

  if v_host_user_id = v_user_id then
    return;
  end if;

  perform 1
  from public.plan_members member
  where
    member.plan_id = p_plan_id
    and member.user_id = v_user_id
    and member.status = 'active'
    and member.role = 'co_host'
  for share;

  if not found then
    raise exception
      'Only the Host or a Co-host can manage Plan needs.'
      using errcode = '42501';
  end if;
end;
$function$;


create or replace function public.lock_plan_need_member(
  p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_host_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select plan.host_user_id
  into v_host_user_id
  from public.plans plan
  where plan.id = p_plan_id
  for share;

  if not found then
    raise exception
      'Plan not found.'
      using errcode = 'P0002';
  end if;

  if v_host_user_id = v_user_id then
    return;
  end if;

  perform 1
  from public.plan_members member
  where
    member.plan_id = p_plan_id
    and member.user_id = v_user_id
    and member.status = 'active'
  for share;

  if not found then
    raise exception
      'Only active Plan members can contribute.'
      using errcode = '42501';
  end if;
end;
$function$;


create or replace function public.is_plan_needs_editable(
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
    where
      plan.id = p_plan_id
      and plan.status in ('forming', 'planned')
      and plan.expired_at is null
      and (
        plan.status <> 'forming'
        or plan.window_end >= current_date
      )
      and (
        plan.status <> 'planned'
        or plan.scheduled_end is null
        or plan.scheduled_end > now()
      )
  );
$function$;


create or replace function public.can_contribute_plan_needs(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    public.is_plan_needs_editable(p_plan_id)
    and public.can_view_plan_needs(
      p_plan_id
    );
$function$;


alter table public.plan_needs
  enable row level security;

alter table public.plan_need_contributions
  enable row level security;


drop policy if exists plan_needs_member_select
on public.plan_needs;

create policy plan_needs_member_select
on public.plan_needs
for select
to authenticated
using (
  public.can_view_plan_needs(
    plan_id
  )
);


drop policy if exists plan_need_contributions_member_select
on public.plan_need_contributions;

create policy plan_need_contributions_member_select
on public.plan_need_contributions
for select
to authenticated
using (
  exists (
    select 1
    from public.plan_needs need_row
    where
      need_row.id = public.plan_need_contributions.need_id
      and public.can_view_plan_needs(
        need_row.plan_id
      )
  )
);


create or replace function public.get_plan_needs(
  p_plan_id uuid
)
returns table (
  need_id uuid,
  plan_id uuid,
  need text,
  quantity integer,
  importance text,
  contributed_quantity integer,
  remaining_quantity integer,
  contributor_count integer,
  is_fulfilled boolean,
  viewer_quantity integer,
  can_manage boolean,
  contributors jsonb,
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

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.can_view_plan_needs(
    p_plan_id
  ) then
    raise exception
      'You are not allowed to view this Plan.'
      using errcode = '42501';
  end if;

  return query
  select
    need_row.id,
    need_row.plan_id,
    need_row.need,
    need_row.quantity,
    need_row.importance,
    aggregate_row.contributed_quantity,
    greatest(
      need_row.quantity -
        aggregate_row.contributed_quantity,
      0
    )::integer,
    aggregate_row.contributor_count,
    (
      aggregate_row.contributed_quantity >=
        need_row.quantity
    )::boolean,
    coalesce(
      viewer_row.quantity,
      0
    )::integer,
    public.can_manage_plan_needs(
      need_row.plan_id
    )::boolean,
    coalesce(
      contributor_row.contributors,
      '[]'::jsonb
    ),
    need_row.created_at,
    need_row.updated_at
  from public.plan_needs need_row

  left join lateral (
    select
      coalesce(
        sum(contribution.quantity),
        0
      )::integer
        as contributed_quantity,
      count(*)::integer
        as contributor_count
    from public.plan_need_contributions contribution
    where contribution.need_id = need_row.id
  ) aggregate_row
    on true

  left join lateral (
    select contribution.quantity
    from public.plan_need_contributions contribution
    where
      contribution.need_id = need_row.id
      and contribution.user_id = v_user_id
    limit 1
  ) viewer_row
    on true

  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'user_id', contribution.user_id,
        'full_name', profile.full_name,
        'username', profile.username,
        'avatar_url', profile.avatar_url,
        'quantity', contribution.quantity
      )
      order by
        coalesce(
          profile.full_name,
          profile.username,
          'UIN member'
        ),
        contribution.created_at,
        contribution.user_id
    ) as contributors
    from public.plan_need_contributions contribution
    left join public.profiles profile
      on profile.id = contribution.user_id
    where contribution.need_id = need_row.id
  ) contributor_row
    on true

  where need_row.plan_id = p_plan_id
  order by
    case
      when need_row.importance = 'required'
        then 0
      else 1
    end,
    need_row.created_at,
    need_row.id;
end;
$function$;


create or replace function public.create_plan_need(
  p_plan_id uuid,
  p_need text,
  p_quantity integer default null,
  p_importance text default 'required'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_need text;
  v_quantity integer;
  v_importance text;
  v_need_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  v_need := btrim(
    coalesce(p_need, '')
  );

  v_quantity := coalesce(
    p_quantity,
    1
  );

  v_importance := lower(
    btrim(
      coalesce(
        p_importance,
        'required'
      )
    )
  );

  if char_length(v_need) not between 1 and 160 then
    raise exception
      'Need must be between 1 and 160 characters.'
      using errcode = '22023';
  end if;

  if v_quantity not between 1 and 100000 then
    raise exception
      'Quantity must be a whole number between 1 and 100000.'
      using errcode = '22023';
  end if;

  if v_importance not in ('required', 'optional') then
    raise exception
      'Need importance must be Required or Optional.'
      using errcode = '22023';
  end if;

  perform public.lock_plan_need_manager(
    p_plan_id
  );

  if not public.is_plan_needs_editable(
    p_plan_id
  ) then
    raise exception
      'Plan needs can only be changed while the Plan is active.'
      using errcode = '55000';
  end if;

  insert into public.plan_needs (
    plan_id,
    need,
    quantity,
    importance,
    created_by
  )
  values (
    p_plan_id,
    v_need,
    v_quantity,
    v_importance,
    v_user_id
  )
  returning id
  into v_need_id;

  return v_need_id;
end;
$function$;


create or replace function public.update_plan_need(
  p_need_id uuid,
  p_need text,
  p_quantity integer default null,
  p_importance text default 'required'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_current_quantity integer;
  v_need text;
  v_quantity integer;
  v_importance text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  select need_row.plan_id
  into v_plan_id
  from public.plan_needs need_row
  where need_row.id = p_need_id;

  if v_plan_id is null then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  perform public.lock_plan_need_manager(
    v_plan_id
  );

  select need_row.quantity
  into v_current_quantity
  from public.plan_needs need_row
  where
    need_row.id = p_need_id
    and need_row.plan_id = v_plan_id
  for update;

  if not found then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_plan_needs_editable(
    v_plan_id
  ) then
    raise exception
      'Plan needs can only be changed while the Plan is active.'
      using errcode = '55000';
  end if;

  v_need := btrim(
    coalesce(p_need, '')
  );

  v_quantity := coalesce(
    p_quantity,
    1
  );

  v_importance := lower(
    btrim(
      coalesce(
        p_importance,
        'required'
      )
    )
  );

  if char_length(v_need) not between 1 and 160 then
    raise exception
      'Need must be between 1 and 160 characters.'
      using errcode = '22023';
  end if;

  if v_quantity not between 1 and 100000 then
    raise exception
      'Quantity must be a whole number between 1 and 100000.'
      using errcode = '22023';
  end if;

  if v_importance not in ('required', 'optional') then
    raise exception
      'Need importance must be Required or Optional.'
      using errcode = '22023';
  end if;

  if
    v_quantity <> v_current_quantity
    and exists (
      select 1
      from public.plan_need_contributions contribution
      where contribution.need_id = p_need_id
    )
  then
    raise exception
      'Quantity cannot be changed after contributions begin.'
      using errcode = '55000';
  end if;

  update public.plan_needs
  set
    need = v_need,
    quantity = v_quantity,
    importance = v_importance
  where id = p_need_id;
end;
$function$;


create or replace function public.delete_plan_need(
  p_need_id uuid
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

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  select need_row.plan_id
  into v_plan_id
  from public.plan_needs need_row
  where need_row.id = p_need_id;

  if v_plan_id is null then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  perform public.lock_plan_need_manager(
    v_plan_id
  );

  perform 1
  from public.plan_needs need_row
  where
    need_row.id = p_need_id
    and need_row.plan_id = v_plan_id
  for update;

  if not found then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_plan_needs_editable(
    v_plan_id
  ) then
    raise exception
      'Plan needs can only be changed while the Plan is active.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.plan_need_contributions contribution
    where contribution.need_id = p_need_id
  ) then
    raise exception
      'This Need cannot be deleted while contributions exist.'
      using errcode = '55000';
  end if;

  delete from public.plan_needs
  where id = p_need_id;
end;
$function$;


create or replace function public.set_my_plan_need_contribution(
  p_need_id uuid,
  p_quantity integer default 1
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_target_quantity integer;
  v_other_quantity integer;
  v_remaining_quantity integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  if
    p_quantity is null
    or p_quantity not between 1 and 100000
  then
    raise exception
      'Contribution quantity must be a whole number between 1 and 100000.'
      using errcode = '22023';
  end if;

  select need_row.plan_id
  into v_plan_id
  from public.plan_needs need_row
  where need_row.id = p_need_id;

  if v_plan_id is null then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  perform public.lock_plan_need_member(
    v_plan_id
  );

  select need_row.quantity
  into v_target_quantity
  from public.plan_needs need_row
  where
    need_row.id = p_need_id
    and need_row.plan_id = v_plan_id
  for update;

  if not found then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_plan_needs_editable(
    v_plan_id
  ) then
    raise exception
      'Your contribution cannot be changed in the current Plan state.'
      using errcode = '55000';
  end if;

  select coalesce(
    sum(contribution.quantity),
    0
  )::integer
  into v_other_quantity
  from public.plan_need_contributions contribution
  where
    contribution.need_id = p_need_id
    and contribution.user_id <> v_user_id;

  v_remaining_quantity := greatest(
    v_target_quantity -
      v_other_quantity,
    0
  );

  if p_quantity > v_remaining_quantity then
    raise exception
      'Only % item(s) remain.',
      v_remaining_quantity
      using errcode = '22023';
  end if;

  insert into public.plan_need_contributions (
    need_id,
    user_id,
    quantity
  )
  values (
    p_need_id,
    v_user_id,
    p_quantity
  )
  on conflict (
    need_id,
    user_id
  )
  do update
  set
    quantity = excluded.quantity,
    updated_at = now();
end;
$function$;


create or replace function public.withdraw_my_plan_need_contribution(
  p_need_id uuid
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

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  select need_row.plan_id
  into v_plan_id
  from public.plan_needs need_row
  where need_row.id = p_need_id;

  if v_plan_id is null then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  perform public.lock_plan_need_member(
    v_plan_id
  );

  perform 1
  from public.plan_needs need_row
  where
    need_row.id = p_need_id
    and need_row.plan_id = v_plan_id
  for update;

  if not found then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_plan_needs_editable(
    v_plan_id
  ) then
    raise exception
      'Your contribution cannot be changed in the current Plan state.'
      using errcode = '55000';
  end if;

  delete from public.plan_need_contributions
  where
    need_id = p_need_id
    and user_id = v_user_id;
end;
$function$;


create or replace function public.cleanup_plan_need_contributions_for_member()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan_id uuid;
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_plan_id := old.plan_id;
    v_user_id := old.user_id;
  else
    if
      old.status is not distinct from new.status
      or new.status = 'active'
    then
      return new;
    end if;

    v_plan_id := new.plan_id;
    v_user_id := new.user_id;
  end if;

  delete from public.plan_need_contributions contribution
  using public.plan_needs need_row
  where
    contribution.need_id = need_row.id
    and need_row.plan_id = v_plan_id
    and contribution.user_id = v_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;


drop trigger if exists cleanup_plan_need_contributions_on_member_change
on public.plan_members;

create trigger cleanup_plan_need_contributions_on_member_change
after update of status or delete
on public.plan_members
for each row
execute function public.cleanup_plan_need_contributions_for_member();


revoke all
on public.plan_needs
from anon;

revoke all
on public.plan_need_contributions
from anon;

revoke insert, update, delete
on public.plan_needs
from authenticated;

revoke insert, update, delete
on public.plan_need_contributions
from authenticated;

grant select
on public.plan_needs
to authenticated;

grant select
on public.plan_need_contributions
to authenticated;


revoke all
on function public.set_plan_need_updated_at()
from public;

revoke all
on function public.cleanup_plan_need_contributions_for_member()
from public;

revoke all
on function public.can_view_plan_needs(uuid)
from public;

revoke all
on function public.can_manage_plan_needs(uuid)
from public;

revoke all
on function public.lock_plan_need_manager(uuid)
from public;

revoke all
on function public.lock_plan_need_member(uuid)
from public;

revoke all
on function public.is_plan_needs_editable(uuid)
from public;

revoke all
on function public.can_contribute_plan_needs(uuid)
from public;

grant execute
on function public.can_view_plan_needs(uuid)
to authenticated;


revoke all
on function public.get_plan_needs(uuid)
from public;

revoke all
on function public.create_plan_need(uuid, text, integer, text)
from public;

revoke all
on function public.update_plan_need(uuid, text, integer, text)
from public;

revoke all
on function public.delete_plan_need(uuid)
from public;

revoke all
on function public.set_my_plan_need_contribution(uuid, integer)
from public;

revoke all
on function public.withdraw_my_plan_need_contribution(uuid)
from public;


grant execute
on function public.get_plan_needs(uuid)
to authenticated;

grant execute
on function public.create_plan_need(uuid, text, integer, text)
to authenticated;

grant execute
on function public.update_plan_need(uuid, text, integer, text)
to authenticated;

grant execute
on function public.delete_plan_need(uuid)
to authenticated;

grant execute
on function public.set_my_plan_need_contribution(uuid, integer)
to authenticated;

grant execute
on function public.withdraw_my_plan_need_contribution(uuid)
to authenticated;


-- Register the new UI copy in the dynamic language catalogue when that
-- optional system is installed. This block is safe on installations that
-- do not have the language tables yet.
do $language_seed$
begin
  if
    to_regclass('public.translation_keys') is not null
    and to_regclass('public.translation_values') is not null
    and to_regclass('public.app_locales') is not null
  then
    insert into public.translation_keys (
      key,
      namespace,
      default_text,
      description,
      source_revision,
      is_active
    )
    select
      source_row.key,
      'plan-needs',
      source_row.default_text,
      'Plan Needs feature',
      1,
      true
    from (
      values
        ('source.plan-needs.plan-needs', 'Plan Needs'),
        ('source.plan-needs.what-should-we-bring', 'What should we bring?'),
        ('source.plan-needs.description', 'Coordinate what members will bring. This is not a payment or donation system.'),
        ('source.plan-needs.suggestions', 'Participants can suggest additions in the conversation. The Host or a Co-host decides what is added.'),
        ('source.plan-needs.add-need', 'Add Need'),
        ('source.plan-needs.need', 'Need'),
        ('source.plan-needs.quantity', 'Quantity'),
        ('source.plan-needs.quantity-default', 'Optional. Defaults to 1.'),
        ('source.plan-needs.required', 'Required'),
        ('source.plan-needs.optional', 'Optional'),
        ('source.plan-needs.save-need', 'Save Need'),
        ('source.plan-needs.no-required', 'No required needs yet.'),
        ('source.plan-needs.no-optional', 'No optional needs yet.'),
        ('source.plan-needs.ill-bring-this', 'I’ll bring this'),
        ('source.plan-needs.update-contribution', 'Update contribution'),
        ('source.plan-needs.withdraw', 'Withdraw'),
        ('source.plan-needs.withdrawing', 'Withdrawing...'),
        ('source.plan-needs.covered', 'Covered'),
        ('source.plan-needs.fulfilled', 'Fulfilled'),
        ('source.plan-needs.who-is-bringing', 'Who is bringing this'),
        ('source.plan-needs.you-are-bringing', 'You are bringing {1}'),
        ('source.plan-needs.quantity-you-will-bring', 'Quantity you will bring'),
        ('source.plan-needs.available-to-you', '{1} available to you, including your current contribution.'),
        ('source.plan-needs.read-only', 'This list is read-only in the current Plan state.'),
        ('source.plan-needs.loading', 'Loading Plan needs...'),
        ('source.plan-needs.preserved', 'Contributions are preserved as part of the completed Plan record.'),
        ('source.plan-needs.quantity-locked', 'Quantity cannot be changed after contributions begin.'),
        ('source.plan-needs.added', 'Need added to the Plan.'),
        ('source.plan-needs.updated', 'Need updated.'),
        ('source.plan-needs.deleted', 'Need deleted.'),
        ('source.plan-needs.contribution-saved', 'Your contribution was saved.'),
        ('source.plan-needs.contribution-withdrawn', 'Your contribution was withdrawn.'),
        ('source.plan-needs.delete-confirm', 'Delete this Need?'),
        ('source.plan-needs.delete-warning', 'This action cannot be undone.'),
        ('source.plan-needs.delete-need', 'Delete Need'),
        ('source.plan-needs.deleting', 'Deleting...'),
        ('source.plan-needs.delete-blocked', 'A Need with contributions cannot be deleted.'),
        ('source.plan-needs.placeholder', 'Water, football, Bluetooth speaker...'),
        ('source.plan-needs.quantity-validation', 'Quantity must be a whole number between 1 and 100000.'),
        ('source.plan-needs.contribution-validation', 'Enter a whole number between 1 and {1}.'),
        ('source.plan-needs.load-error', 'Plan needs could not be loaded.'),
        ('source.plan-needs.required-error', 'Need is required.'),
        ('source.plan-needs.create-error', 'The Need could not be created.'),
        ('source.plan-needs.update-error', 'The Need could not be updated.'),
        ('source.plan-needs.delete-error', 'The Need could not be deleted.'),
        ('source.plan-needs.contribution-minimum', 'Contribution quantity must be at least 1.'),
        ('source.plan-needs.contribution-save-error', 'Your contribution could not be saved.'),
        ('source.plan-needs.contribution-withdraw-error', 'Your contribution could not be withdrawn.'),
        ('source.plan-needs.name-range', 'Need must be between 1 and 160 characters.'),
        ('source.plan-needs.importance-error', 'Need importance must be Required or Optional.'),
        ('source.plan-needs.manager-error', 'Only the Host or a Co-host can manage Plan needs.'),
        ('source.plan-needs.active-error', 'Plan needs can only be changed while the Plan is active.'),
        ('source.plan-needs.not-found', 'Need not found.'),
        ('source.plan-needs.delete-contribution-error', 'This Need cannot be deleted while contributions exist.'),
        ('source.plan-needs.contribution-range', 'Contribution quantity must be a whole number between 1 and 100000.'),
        ('source.plan-needs.member-error', 'Only active Plan members can contribute.'),
        ('source.plan-needs.contribution-state-error', 'Your contribution cannot be changed in the current Plan state.'),
        ('source.plan-needs.remaining-error', 'Only {1} item(s) remain.'),
        ('source.plan-needs.view-error', 'You are not allowed to view this Plan.')
    ) as source_row(
      key,
      default_text
    )
    on conflict (key)
    do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision =
        case
          when public.translation_keys.default_text
            is distinct from excluded.default_text
            then public.translation_keys.source_revision + 1
          else public.translation_keys.source_revision
        end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    insert into public.translation_values (
      translation_key_id,
      locale_code,
      value,
      source_revision,
      updated_by
    )
    select
      translation_key.id,
      'tr',
      translation_row.translated_text,
      translation_key.source_revision,
      null
    from (
      values
        ('Plan Needs', 'Plan İhtiyaçları'),
        ('What should we bring?', 'Neler getirelim?'),
        ('Coordinate what members will bring. This is not a payment or donation system.', 'Kimin ne getireceğini birlikte organize edin. Bu bir ödeme veya bağış sistemi değildir.'),
        ('Participants can suggest additions in the conversation. The Host or a Co-host decides what is added.', 'Katılımcılar ihtiyaç önerilerini konuşmada paylaşabilir. Listeye neyin ekleneceğine Host veya Co-host karar verir.'),
        ('Add Need', 'İhtiyaç Ekle'),
        ('Need', 'İhtiyaç'),
        ('Quantity', 'Adet'),
        ('Optional. Defaults to 1.', 'Opsiyonel. Boş bırakılırsa 1 kabul edilir.'),
        ('Required', 'Gerekli'),
        ('Optional', 'İsteğe Bağlı'),
        ('Save Need', 'İhtiyacı Kaydet'),
        ('No required needs yet.', 'Henüz gerekli bir ihtiyaç eklenmedi.'),
        ('No optional needs yet.', 'Henüz isteğe bağlı bir ihtiyaç eklenmedi.'),
        ('I’ll bring this', 'Bunu ben getiririm'),
        ('Update contribution', 'Katkımı Güncelle'),
        ('Withdraw', 'Katkımı Geri Çek'),
        ('Withdrawing...', 'Geri çekiliyor...'),
        ('Covered', 'Karşılandı'),
        ('Fulfilled', 'Tamamlandı'),
        ('Who is bringing this', 'Kim getiriyor?'),
        ('You are bringing {1}', '{1} adet getiriyorsun'),
        ('Quantity you will bring', 'Getireceğin adet'),
        ('{1} available to you, including your current contribution.', 'Mevcut katkın dahil en fazla {1} adet seçebilirsin.'),
        ('This list is read-only in the current Plan state.', 'Bu liste Planın mevcut durumunda yalnızca görüntülenebilir.'),
        ('Loading Plan needs...', 'Plan ihtiyaçları yükleniyor...'),
        ('Contributions are preserved as part of the completed Plan record.', 'Katkılar tamamlanan Plan kaydının bir parçası olarak korunur.'),
        ('Quantity cannot be changed after contributions begin.', 'Katkı başladıktan sonra adet değiştirilemez.'),
        ('Need added to the Plan.', 'İhtiyaç Plana eklendi.'),
        ('Need updated.', 'İhtiyaç güncellendi.'),
        ('Need deleted.', 'İhtiyaç silindi.'),
        ('Your contribution was saved.', 'Katkın kaydedildi.'),
        ('Your contribution was withdrawn.', 'Katkın geri çekildi.'),
        ('Delete this Need?', 'Bu ihtiyaç silinsin mi?'),
        ('This action cannot be undone.', 'Bu işlem geri alınamaz.'),
        ('Delete Need', 'İhtiyacı Sil'),
        ('Deleting...', 'Siliniyor...'),
        ('A Need with contributions cannot be deleted.', 'Katkı bulunan bir ihtiyaç silinemez.'),
        ('Water, football, Bluetooth speaker...', 'Su, futbol topu, Bluetooth hoparlör...'),
        ('Quantity must be a whole number between 1 and 100000.', 'Adet 1 ile 100000 arasında bir tam sayı olmalıdır.'),
        ('Enter a whole number between 1 and {1}.', '1 ile {1} arasında bir tam sayı gir.'),
        ('Plan needs could not be loaded.', 'Plan ihtiyaçları yüklenemedi.'),
        ('Need is required.', 'İhtiyaç adı zorunludur.'),
        ('The Need could not be created.', 'İhtiyaç oluşturulamadı.'),
        ('The Need could not be updated.', 'İhtiyaç güncellenemedi.'),
        ('The Need could not be deleted.', 'İhtiyaç silinemedi.'),
        ('Contribution quantity must be at least 1.', 'Katkı adedi en az 1 olmalıdır.'),
        ('Your contribution could not be saved.', 'Katkın kaydedilemedi.'),
        ('Your contribution could not be withdrawn.', 'Katkın geri çekilemedi.'),
        ('Need must be between 1 and 160 characters.', 'İhtiyaç adı 1 ile 160 karakter arasında olmalıdır.'),
        ('Need importance must be Required or Optional.', 'İhtiyaç Gerekli veya İsteğe Bağlı olmalıdır.'),
        ('Only the Host or a Co-host can manage Plan needs.', 'Plan ihtiyaçlarını yalnızca Host veya Co-host yönetebilir.'),
        ('Plan needs can only be changed while the Plan is active.', 'Plan ihtiyaçları yalnızca Plan aktifken değiştirilebilir.'),
        ('Need not found.', 'İhtiyaç bulunamadı.'),
        ('This Need cannot be deleted while contributions exist.', 'Katkı bulunan bir ihtiyaç silinemez.'),
        ('Contribution quantity must be a whole number between 1 and 100000.', 'Katkı adedi 1 ile 100000 arasında bir tam sayı olmalıdır.'),
        ('Only active Plan members can contribute.', 'Yalnızca aktif Plan üyeleri katkı sağlayabilir.'),
        ('Your contribution cannot be changed in the current Plan state.', 'Planın mevcut durumunda katkın değiştirilemez.'),
        ('Only {1} item(s) remain.', 'Yalnızca {1} adet kaldı.'),
        ('You are not allowed to view this Plan.', 'Bu Planı görüntüleme yetkin yok.'),
        ('Close', 'Kapat'),
        ('Cancel', 'Vazgeç'),
        ('Edit', 'Düzenle'),
        ('Delete', 'Sil'),
        ('Saving...', 'Kaydediliyor...')
    ) as translation_row(
      default_text,
      translated_text
    )
    join public.translation_keys translation_key
      on translation_key.default_text = translation_row.default_text
    where exists (
      select 1
      from public.app_locales locale
      where locale.code = 'tr'
    )
    on conflict (
      translation_key_id,
      locale_code
    )
    do update
    set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
    where nullif(
      btrim(
        public.translation_values.value
      ),
      ''
    ) is null;
  end if;
end;
$language_seed$;

commit;

notify pgrst, 'reload schema';

select
  to_regclass('public.plan_needs') is not null
    as plan_needs_ready,
  to_regclass('public.plan_need_contributions') is not null
    as contributions_ready,
  to_regprocedure('public.get_plan_needs(uuid)') is not null
    as plan_needs_rpc_ready;
