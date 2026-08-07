begin;

-- Profile sections can be compact and paginated in the UI, while the owner
-- controls the public order of Seeds, credentials and badges.
create table if not exists public.profile_display_orders (
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  item_type text not null,
  item_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id),
  constraint profile_display_orders_item_type_check check (
    item_type in ('seed', 'credential', 'badge')
  ),
  constraint profile_display_orders_sort_order_check check (
    sort_order >= 0
  )
);

create index if not exists profile_display_orders_lookup_idx
  on public.profile_display_orders(user_id, item_type, sort_order, item_id);

alter table public.profile_display_orders enable row level security;

revoke all on table public.profile_display_orders from public;
revoke all on table public.profile_display_orders from anon;
revoke all on table public.profile_display_orders from authenticated;

create or replace function public.set_my_profile_display_order(
  p_item_type text,
  p_item_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_position integer := 0;
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_item_type not in ('seed', 'credential', 'badge') then
    raise exception 'Unsupported profile item type.' using errcode = '22023';
  end if;

  v_total := coalesce(array_length(p_item_ids, 1), 0);

  if v_total > 200 then
    raise exception 'Too many profile items were supplied.' using errcode = '22023';
  end if;

  if v_total > 0 and (
    select count(*) <> count(distinct supplied.item_id)
    from unnest(p_item_ids) as supplied(item_id)
  ) then
    raise exception 'Profile order contains duplicate items.' using errcode = '22023';
  end if;

  foreach v_item_id in array coalesce(p_item_ids, array[]::uuid[]) loop
    if p_item_type = 'seed' then
      if not exists (
        select 1
        from public.seeds seed
        where seed.id = v_item_id
          and seed.user_id = v_user_id
          and seed.status in ('active', 'completed')
      ) then
        raise exception 'A Seed in this order does not belong to you.' using errcode = '42501';
      end if;
    elsif p_item_type = 'credential' then
      if not exists (
        select 1
        from public.professional_credentials credential
        where credential.id = v_item_id
          and credential.user_id = v_user_id
          and credential.status = 'approved'
          and credential.revoked_at is null
          and (
            credential.expires_at is null
            or credential.expires_at >= current_date
          )
      ) then
        raise exception 'A credential in this order is not an active approved credential.' using errcode = '42501';
      end if;
    else
      if not exists (
        select 1
        from public.user_badge_assignments assignment
        join public.badge_definitions badge
          on badge.id = assignment.badge_id
        where assignment.user_id = v_user_id
          and assignment.badge_id = v_item_id
          and assignment.status = 'active'
          and (
            assignment.expires_at is null
            or assignment.expires_at > now()
          )
          and badge.is_active
          and badge.is_public
      ) then
        raise exception 'A badge in this order is not an active public badge.' using errcode = '42501';
      end if;
    end if;
  end loop;

  delete from public.profile_display_orders ordering
  where ordering.user_id = v_user_id
    and ordering.item_type = p_item_type;

  v_position := 0;
  foreach v_item_id in array coalesce(p_item_ids, array[]::uuid[]) loop
    insert into public.profile_display_orders (
      user_id,
      item_type,
      item_id,
      sort_order,
      updated_at
    ) values (
      v_user_id,
      p_item_type,
      v_item_id,
      v_position,
      now()
    );

    v_position := v_position + 10;
  end loop;

  return true;
end;
$$;

create or replace function public.get_visible_profile_display_order(
  p_profile_user_id uuid
)
returns table(
  item_type text,
  item_id uuid,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ordering.item_type,
    ordering.item_id,
    ordering.sort_order
  from public.profile_display_orders ordering
  where ordering.user_id = p_profile_user_id
    and (
      (
        ordering.item_type = 'seed'
        and exists (
          select 1
          from public.seeds seed
          where seed.id = ordering.item_id
            and seed.user_id = p_profile_user_id
            and seed.status in ('active', 'completed')
            and public.seed_is_visible_to_viewer(
              seed.user_id,
              seed.visibility,
              auth.uid()
            )
        )
      )
      or
      (
        ordering.item_type = 'credential'
        and exists (
          select 1
          from public.professional_credentials credential
          join public.professional_roles role_record
            on role_record.id = credential.professional_role_id
          where credential.id = ordering.item_id
            and credential.user_id = p_profile_user_id
            and credential.status = 'approved'
            and credential.revoked_at is null
            and (
              credential.expires_at is null
              or credential.expires_at >= current_date
            )
            and role_record.is_active = true
            and (
              role_record.requires_identity_verification = false
              or public.is_identity_verified(p_profile_user_id)
            )
            and not public.reputation_is_managed_minor(p_profile_user_id)
        )
      )
      or
      (
        ordering.item_type = 'badge'
        and exists (
          select 1
          from public.user_badge_assignments assignment
          join public.badge_definitions badge
            on badge.id = assignment.badge_id
          where assignment.user_id = p_profile_user_id
            and assignment.badge_id = ordering.item_id
            and assignment.status = 'active'
            and (
              assignment.expires_at is null
              or assignment.expires_at > now()
            )
            and badge.is_active
            and badge.is_public
            and (
              (
                assignment.source = 'manual'
                and badge.award_mode in ('manual', 'both')
              )
              or (
                assignment.source = 'automatic'
                and badge.award_mode in ('automatic', 'both')
              )
            )
            and (
              not public.reputation_is_managed_minor(p_profile_user_id)
              or badge.allow_managed_minor
            )
        )
      )
    )
  order by ordering.item_type, ordering.sort_order, ordering.item_id;
$$;

revoke all on function public.set_my_profile_display_order(text, uuid[]) from public;
revoke all on function public.get_visible_profile_display_order(uuid) from public;

grant execute on function public.set_my_profile_display_order(text, uuid[])
  to authenticated;
grant execute on function public.get_visible_profile_display_order(uuid)
  to anon, authenticated;

commit;
