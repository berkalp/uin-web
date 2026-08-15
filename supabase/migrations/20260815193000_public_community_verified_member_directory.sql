-- Public Community verified-member directory.
-- Uses the existing verified-membership source of truth and exposes only
-- public profile fields. The existing show_on_profile flag remains specific
-- to the profile badge; Community membership itself is visible in this directory.

create or replace function public.get_public_community_verified_members(
  p_community_id uuid,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  member_label text,
  verified_at text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_table regclass;
  v_filter text;
  v_has_status boolean := false;
  v_has_membership_status boolean := false;
  v_has_is_active boolean := false;
  v_has_active boolean := false;
  v_has_revoked_at boolean := false;
  v_has_expires_at boolean := false;
begin
  if p_community_id is null then
    return;
  end if;

  select c.oid::regclass
    into v_membership_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'community_id' and not a.attisdropped
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'member_label' and not a.attisdropped
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'verified_at' and not a.attisdropped
    )
  order by
    case
      when c.relname = 'community_memberships' then 0
      when c.relname like '%community%membership%' then 1
      else 2
    end,
    c.relname
  limit 1;

  if v_membership_table is null then
    return;
  end if;

  select exists (
    select 1 from pg_attribute
    where attrelid = v_membership_table and attname = 'status' and not attisdropped
  ) into v_has_status;

  select exists (
    select 1 from pg_attribute
    where attrelid = v_membership_table and attname = 'membership_status' and not attisdropped
  ) into v_has_membership_status;

  select exists (
    select 1 from pg_attribute
    where attrelid = v_membership_table and attname = 'is_active' and not attisdropped
  ) into v_has_is_active;

  select exists (
    select 1 from pg_attribute
    where attrelid = v_membership_table and attname = 'active' and not attisdropped
  ) into v_has_active;

  select exists (
    select 1 from pg_attribute
    where attrelid = v_membership_table and attname = 'revoked_at' and not attisdropped
  ) into v_has_revoked_at;

  select exists (
    select 1 from pg_attribute
    where attrelid = v_membership_table and attname = 'expires_at' and not attisdropped
  ) into v_has_expires_at;

  v_filter := 'm.community_id = $1 and m.verified_at is not null';

  if v_has_membership_status then
    v_filter := v_filter || ' and m.membership_status::text = ''active''';
  elsif v_has_status then
    v_filter := v_filter || ' and m.status::text = ''active''';
  elsif v_has_is_active then
    v_filter := v_filter || ' and coalesce(m.is_active, false)';
  elsif v_has_active then
    v_filter := v_filter || ' and coalesce(m.active, false)';
  end if;

  if v_has_revoked_at then
    v_filter := v_filter || ' and m.revoked_at is null';
  end if;

  if v_has_expires_at then
    v_filter := v_filter || ' and (m.expires_at is null or m.expires_at > now())';
  end if;

  return query execute format(
    'select
       p.id::uuid as user_id,
       p.full_name::text as full_name,
       p.username::text as username,
       p.avatar_url::text as avatar_url,
       coalesce(nullif(trim(m.member_label::text), ''''), ''Verified member'')::text as member_label,
       m.verified_at::text as verified_at,
       count(*) over()::bigint as total_count
     from %s m
     join public.profiles p on p.id = m.user_id
     where %s
     order by lower(coalesce(p.full_name, p.username, '''')), m.verified_at desc
     limit $2 offset $3',
    v_membership_table,
    v_filter
  )
  using p_community_id, greatest(1, least(coalesce(p_limit, 200), 500)), greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_public_community_verified_member_counts(
  p_community_ids uuid[]
)
returns table (
  community_id uuid,
  verified_member_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    requested.community_id,
    coalesce(directory.total_count, 0)::bigint as verified_member_count
  from unnest(coalesce(p_community_ids, array[]::uuid[])) as requested(community_id)
  left join lateral (
    select member_row.total_count
    from public.get_public_community_verified_members(
      requested.community_id,
      1,
      0
    ) as member_row
    limit 1
  ) as directory on true;
$$;

revoke all on function public.get_public_community_verified_members(uuid, integer, integer) from public;
revoke all on function public.get_public_community_verified_member_counts(uuid[]) from public;

grant execute on function public.get_public_community_verified_members(uuid, integer, integer) to authenticated;
grant execute on function public.get_public_community_verified_member_counts(uuid[]) to authenticated;
