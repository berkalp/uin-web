begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create table if not exists public.seed_journal_entries (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_kind text not null default 'update',
  body text,
  key_takeaway text,
  attachments jsonb not null default '[]'::jsonb,
  visibility text not null default 'only_me',
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_journal_entries_kind_check check (entry_kind in ('update', 'reflection')),
  constraint seed_journal_entries_body_check check (body is null or char_length(body) <= 6000),
  constraint seed_journal_entries_takeaway_check check (key_takeaway is null or char_length(key_takeaway) <= 1000),
  constraint seed_journal_entries_visibility_check check (visibility in ('only_me', 'friends', 'everyone')),
  constraint seed_journal_entries_attachments_array_check check (jsonb_typeof(attachments) = 'array'),
  constraint seed_journal_entries_content_check check (
    nullif(btrim(coalesce(body, '')), '') is not null
    or nullif(btrim(coalesce(key_takeaway, '')), '') is not null
    or jsonb_array_length(attachments) > 0
  )
);

create unique index if not exists seed_journal_one_reflection_idx
  on public.seed_journal_entries(seed_id)
  where entry_kind = 'reflection';

create index if not exists seed_journal_seed_date_idx
  on public.seed_journal_entries(seed_id, occurred_on desc, created_at desc);

create table if not exists public.seed_reactions (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  visibility text not null default 'only_me',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seed_reactions_type_check check (reaction_type in ('save', 'water')),
  constraint seed_reactions_visibility_check check (visibility in ('only_me', 'friends', 'everyone')),
  constraint seed_reactions_save_private_check check (
    reaction_type <> 'save' or visibility = 'only_me'
  ),
  constraint seed_reactions_unique unique (seed_id, user_id, reaction_type)
);

create index if not exists seed_reactions_seed_type_idx
  on public.seed_reactions(seed_id, reaction_type, updated_at desc);
create index if not exists seed_reactions_user_type_idx
  on public.seed_reactions(user_id, reaction_type, updated_at desc);

comment on table public.seed_journal_entries is
  'Owner-authored progress notes and one completion reflection for a Seed. Attachments are external links only.';
comment on table public.seed_reactions is
  'Private Save and social Water reactions for visible Seeds.';

drop trigger if exists touch_seed_journal_entries_updated_at_trigger on public.seed_journal_entries;
create trigger touch_seed_journal_entries_updated_at_trigger
before update on public.seed_journal_entries
for each row execute function public.touch_seed_catalogue_updated_at();

drop trigger if exists touch_seed_reactions_updated_at_trigger on public.seed_reactions;
create trigger touch_seed_reactions_updated_at_trigger
before update on public.seed_reactions
for each row execute function public.touch_seed_catalogue_updated_at();

create or replace function public.normalize_seed_link_collection(p_links jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_url text;
  v_label text;
  v_description text;
  v_kind text;
  v_count integer := 0;
begin
  if jsonb_typeof(v_links) <> 'array' then
    raise exception 'Seed links must be an array.' using errcode = '22023';
  end if;

  if jsonb_array_length(v_links) > 20 then
    raise exception 'A Seed may contain at most 20 links.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_links)
  loop
    v_url := public.normalize_seed_url(v_item ->> 'url');

    if v_url is null then
      continue;
    end if;

    v_kind := lower(coalesce(nullif(btrim(v_item ->> 'kind'), ''), 'resource'));
    if v_kind not in ('resource', 'image', 'video') then
      raise exception 'Seed link type must be resource, image or video.' using errcode = '22023';
    end if;

    v_label := nullif(btrim(v_item ->> 'label'), '');
    v_description := nullif(btrim(v_item ->> 'description'), '');

    if v_label is not null and char_length(v_label) > 100 then
      raise exception 'Seed link labels may not exceed 100 characters.' using errcode = '22023';
    end if;

    if v_description is not null and char_length(v_description) > 500 then
      raise exception 'Seed link descriptions may not exceed 500 characters.' using errcode = '22023';
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'url', v_url,
          'label', v_label,
          'description', v_description,
          'kind', v_kind,
          'sort_order', v_count
        )
      )
    );

    v_count := v_count + 1;
  end loop;

  return v_result;
end;
$$;

create or replace function public.replace_my_seed_links(
  p_seed_id uuid,
  p_links jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_links jsonb;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to edit Seed links.';
  end if;

  if not exists (
    select 1
    from public.seeds seed
    where seed.id = p_seed_id
      and seed.user_id = auth.uid()
  ) then
    raise exception 'Seed not found or cannot be edited.';
  end if;

  v_links := public.normalize_seed_link_collection(p_links);

  delete from public.seed_links link
  where link.seed_id = p_seed_id;

  for v_item in select value from jsonb_array_elements(v_links)
  loop
    insert into public.seed_links (
      seed_id,
      url,
      label,
      provider,
      metadata,
      sort_order
    ) values (
      p_seed_id,
      v_item ->> 'url',
      coalesce(v_item ->> 'label', 'Open link'),
      v_item ->> 'kind',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', v_item ->> 'kind',
          'description', v_item ->> 'description'
        )
      ),
      coalesce((v_item ->> 'sort_order')::integer, 0)
    );
  end loop;
end;
$$;

create or replace function public.create_my_seed_v2(
  p_seed_type_id uuid,
  p_title text,
  p_subtitle text default null,
  p_notes text default null,
  p_cover_url text default null,
  p_visibility text default 'only_me',
  p_target_date date default null,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed_id uuid;
begin
  v_seed_id := public.create_my_seed(
    p_seed_type_id,
    p_title,
    p_subtitle,
    p_notes,
    p_cover_url,
    null,
    null,
    p_visibility,
    p_target_date
  );

  perform public.replace_my_seed_links(v_seed_id, p_links);
  return v_seed_id;
end;
$$;

create or replace function public.update_my_seed_v2(
  p_seed_id uuid,
  p_seed_type_id uuid,
  p_title text,
  p_subtitle text default null,
  p_notes text default null,
  p_cover_url text default null,
  p_visibility text default 'only_me',
  p_target_date date default null,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.update_my_seed(
    p_seed_id,
    p_seed_type_id,
    p_title,
    p_subtitle,
    p_notes,
    p_cover_url,
    null,
    null,
    p_visibility,
    p_target_date
  );

  perform public.replace_my_seed_links(p_seed_id, p_links);
  return p_seed_id;
end;
$$;

create or replace function public.get_my_seeds_v2(
  p_status text default null
)
returns table(
  seed_id uuid,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  notes text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  links jsonb,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed.seed_type_id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed.title,
    seed.subtitle,
    seed.notes,
    seed.cover_url,
    seed.visibility,
    seed.status,
    seed.target_date,
    seed.completed_at,
    seed.archived_at,
    seed.created_at,
    seed.updated_at,
    coalesce(link_bundle.links, '[]'::jsonb),
    coalesce(intent_count.total, 0)::bigint,
    coalesce(journal_count.total, 0)::bigint,
    reflection.key_takeaway
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join lateral (
    select jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', link.id,
          'url', link.url,
          'label', link.label,
          'description', link.metadata ->> 'description',
          'kind', coalesce(link.metadata ->> 'kind', link.provider, 'resource'),
          'sort_order', link.sort_order
        )
      ) order by link.sort_order, link.created_at, link.id
    ) as links
    from public.seed_links link
    where link.seed_id = seed.id
  ) link_bundle on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    where seed_intent.seed_id = seed.id
  ) intent_count on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
  ) journal_count on true
  left join lateral (
    select entry.key_takeaway
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and entry.entry_kind = 'reflection'
    limit 1
  ) reflection on true
  where seed.user_id = auth.uid()
    and (p_status is null or seed.status = p_status)
  order by
    case seed.status when 'active' then 0 when 'completed' then 1 else 2 end,
    seed.updated_at desc,
    seed.id;
$$;

create or replace function public.get_my_seed_v2(p_seed_id uuid)
returns table(
  seed_id uuid,
  seed_type_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  notes text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  links jsonb,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.get_my_seeds_v2(null)
  where seed_id = p_seed_id
  limit 1;
$$;

create or replace function public.get_visible_profile_seeds_v2(
  p_profile_user_id uuid,
  p_limit integer default 16
)
returns table(
  seed_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed.title,
    seed.subtitle,
    seed.cover_url,
    seed.visibility,
    seed.status,
    seed.target_date,
    seed.completed_at,
    coalesce(intent_count.total, 0)::bigint,
    coalesce(journal_count.total, 0)::bigint,
    reflection.key_takeaway,
    seed.updated_at
  from public.seeds seed
  join public.seed_types seed_type
    on seed_type.id = seed.seed_type_id
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    join public.intents intent on intent.id = seed_intent.intent_id
    where seed_intent.seed_id = seed.id
      and public.can_user_view_intent_activity(intent.id, auth.uid())
  ) intent_count on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and (
        seed.user_id = auth.uid()
        or public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
      )
  ) journal_count on true
  left join lateral (
    select entry.key_takeaway
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and entry.entry_kind = 'reflection'
      and (
        seed.user_id = auth.uid()
        or public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
      )
    limit 1
  ) reflection on true
  where seed.user_id = p_profile_user_id
    and seed.status in ('active', 'completed')
    and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
  order by
    case seed.status when 'active' then 0 else 1 end,
    seed.updated_at desc,
    seed.id
  limit greatest(1, least(coalesce(p_limit, 16), 40));
$$;

create or replace function public.get_my_saved_seeds(
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  seed_id uuid,
  seed_type_name text,
  seed_type_slug text,
  seed_type_icon text,
  title text,
  subtitle text,
  cover_url text,
  visibility text,
  status text,
  target_date date,
  completed_at timestamptz,
  grown_intent_count bigint,
  journal_count bigint,
  key_takeaway text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    seed_type.name,
    seed_type.slug,
    seed_type.icon,
    seed.title,
    seed.subtitle,
    seed.cover_url,
    seed.visibility,
    seed.status,
    seed.target_date,
    seed.completed_at,
    coalesce(intent_count.total, 0)::bigint,
    coalesce(journal_count.total, 0)::bigint,
    reflection.key_takeaway,
    seed.updated_at
  from public.seed_reactions reaction
  join public.seeds seed on seed.id = reaction.seed_id
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  left join lateral (
    select count(*)::bigint as total
    from public.seed_intent_links seed_intent
    join public.intents intent on intent.id = seed_intent.intent_id
    where seed_intent.seed_id = seed.id
      and public.can_user_view_intent_activity(intent.id, auth.uid())
  ) intent_count on true
  left join lateral (
    select count(*)::bigint as total
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
  ) journal_count on true
  left join lateral (
    select entry.key_takeaway
    from public.seed_journal_entries entry
    where entry.seed_id = seed.id
      and entry.entry_kind = 'reflection'
      and public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
    limit 1
  ) reflection on true
  where reaction.user_id = auth.uid()
    and reaction.reaction_type = 'save'
    and seed.status in ('active', 'completed')
    and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
  order by reaction.updated_at desc, reaction.id desc
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.normalize_seed_journal_attachments(p_attachments jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items jsonb := coalesce(p_attachments, '[]'::jsonb);
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_url text;
  v_kind text;
  v_label text;
  v_caption text;
  v_position integer := 0;
begin
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Journal attachments must be an array.' using errcode = '22023';
  end if;

  if jsonb_array_length(v_items) > 12 then
    raise exception 'A journal entry may contain at most 12 linked items.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_url := public.normalize_seed_url(v_item ->> 'url');
    if v_url is null then
      continue;
    end if;

    v_kind := lower(coalesce(nullif(btrim(v_item ->> 'kind'), ''), 'link'));
    if v_kind not in ('link', 'image', 'video') then
      raise exception 'Journal link type must be link, image or video.' using errcode = '22023';
    end if;

    v_label := nullif(btrim(v_item ->> 'label'), '');
    v_caption := nullif(btrim(v_item ->> 'caption'), '');

    if v_label is not null and char_length(v_label) > 100 then
      raise exception 'Journal link labels may not exceed 100 characters.' using errcode = '22023';
    end if;

    if v_caption is not null and char_length(v_caption) > 500 then
      raise exception 'Journal captions may not exceed 500 characters.' using errcode = '22023';
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'url', v_url,
          'kind', v_kind,
          'label', v_label,
          'caption', v_caption,
          'sort_order', v_position
        )
      )
    );
    v_position := v_position + 1;
  end loop;

  return v_result;
end;
$$;

create or replace function public.save_my_seed_journal_entry(
  p_seed_id uuid,
  p_entry_id uuid default null,
  p_entry_kind text default 'update',
  p_body text default null,
  p_key_takeaway text default null,
  p_visibility text default 'only_me',
  p_occurred_on date default current_date,
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_body text := nullif(btrim(p_body), '');
  v_takeaway text := nullif(btrim(p_key_takeaway), '');
  v_attachments jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to update a Seed.';
  end if;

  if p_entry_kind not in ('update', 'reflection') then
    raise exception 'Invalid Seed journal entry type.' using errcode = '22023';
  end if;

  if p_visibility not in ('only_me', 'friends', 'everyone') then
    raise exception 'Invalid Seed journal visibility.' using errcode = '22023';
  end if;

  if char_length(coalesce(v_body, '')) > 6000 then
    raise exception 'Seed journal notes may not exceed 6000 characters.' using errcode = '22023';
  end if;

  if char_length(coalesce(v_takeaway, '')) > 1000 then
    raise exception 'The key takeaway may not exceed 1000 characters.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.seeds seed
    where seed.id = p_seed_id
      and seed.user_id = auth.uid()
      and seed.status <> 'archived'
  ) then
    raise exception 'Seed not found or is archived.';
  end if;

  v_attachments := public.normalize_seed_journal_attachments(p_attachments);

  if v_body is null and v_takeaway is null and jsonb_array_length(v_attachments) = 0 then
    raise exception 'Add a note, takeaway or linked item before saving.' using errcode = '22023';
  end if;

  if p_entry_id is not null then
    update public.seed_journal_entries entry
    set
      entry_kind = p_entry_kind,
      body = v_body,
      key_takeaway = case when p_entry_kind = 'reflection' then v_takeaway else null end,
      attachments = v_attachments,
      visibility = p_visibility,
      occurred_on = coalesce(p_occurred_on, current_date),
      updated_at = now()
    where entry.id = p_entry_id
      and entry.seed_id = p_seed_id
      and entry.user_id = auth.uid()
    returning entry.id into v_entry_id;

    if v_entry_id is null then
      raise exception 'Seed journal entry not found.';
    end if;

    return v_entry_id;
  end if;

  if p_entry_kind = 'reflection' then
    update public.seed_journal_entries entry
    set
      body = v_body,
      key_takeaway = v_takeaway,
      attachments = v_attachments,
      visibility = p_visibility,
      occurred_on = coalesce(p_occurred_on, current_date),
      updated_at = now()
    where entry.seed_id = p_seed_id
      and entry.user_id = auth.uid()
      and entry.entry_kind = 'reflection'
    returning entry.id into v_entry_id;

    if v_entry_id is not null then
      return v_entry_id;
    end if;
  end if;

  insert into public.seed_journal_entries (
    seed_id,
    user_id,
    entry_kind,
    body,
    key_takeaway,
    attachments,
    visibility,
    occurred_on
  ) values (
    p_seed_id,
    auth.uid(),
    p_entry_kind,
    v_body,
    case when p_entry_kind = 'reflection' then v_takeaway else null end,
    v_attachments,
    p_visibility,
    coalesce(p_occurred_on, current_date)
  ) returning id into v_entry_id;

  return v_entry_id;
end;
$$;

create or replace function public.delete_my_seed_journal_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to edit a Seed.';
  end if;

  delete from public.seed_journal_entries entry
  where entry.id = p_entry_id
    and entry.user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.complete_my_seed_with_reflection(
  p_seed_id uuid,
  p_completed_on date default current_date,
  p_reflection text default null,
  p_key_takeaway text default null,
  p_visibility text default 'only_me',
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_content boolean;
  v_attachments jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to complete a Seed.';
  end if;

  update public.seeds seed
  set
    status = 'completed',
    completed_at = (coalesce(p_completed_on, current_date)::timestamp at time zone 'UTC'),
    archived_at = null,
    updated_at = now()
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  if not found then
    raise exception 'Seed not found or cannot be completed.';
  end if;

  v_attachments := public.normalize_seed_journal_attachments(p_attachments);

  v_has_content :=
    nullif(btrim(coalesce(p_reflection, '')), '') is not null
    or nullif(btrim(coalesce(p_key_takeaway, '')), '') is not null
    or jsonb_array_length(v_attachments) > 0;

  if v_has_content then
    perform public.save_my_seed_journal_entry(
      p_seed_id,
      null,
      'reflection',
      p_reflection,
      p_key_takeaway,
      p_visibility,
      coalesce(p_completed_on, current_date),
      v_attachments
    );
  end if;

  return p_seed_id;
end;
$$;

create or replace function public.get_visible_seed_detail(p_seed_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seed public.seeds%rowtype;
  v_result jsonb;
begin
  select seed.* into v_seed
  from public.seeds seed
  where seed.id = p_seed_id;

  if v_seed.id is null then
    return null;
  end if;

  if v_seed.status = 'archived' and v_seed.user_id <> auth.uid() then
    return null;
  end if;

  if not public.seed_is_visible_to_viewer(v_seed.user_id, v_seed.visibility, auth.uid()) then
    return null;
  end if;

  select jsonb_build_object(
    'seed', jsonb_build_object(
      'seed_id', seed.id,
      'seed_type_id', seed.seed_type_id,
      'seed_type_name', seed_type.name,
      'seed_type_slug', seed_type.slug,
      'seed_type_icon', seed_type.icon,
      'title', seed.title,
      'subtitle', seed.subtitle,
      'notes', seed.notes,
      'cover_url', seed.cover_url,
      'visibility', seed.visibility,
      'status', seed.status,
      'target_date', seed.target_date,
      'completed_at', seed.completed_at,
      'archived_at', seed.archived_at,
      'created_at', seed.created_at,
      'updated_at', seed.updated_at,
      'is_owner', seed.user_id = auth.uid(),
      'owner_user_id', profile.id,
      'owner_full_name', profile.full_name,
      'owner_username', profile.username,
      'owner_avatar_url', profile.avatar_url
    ),
    'links', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', link.id,
            'url', link.url,
            'label', link.label,
            'description', link.metadata ->> 'description',
            'kind', coalesce(link.metadata ->> 'kind', link.provider, 'resource'),
            'sort_order', link.sort_order
          )
        ) order by link.sort_order, link.created_at, link.id
      )
      from public.seed_links link
      where link.seed_id = seed.id
    ), '[]'::jsonb),
    'journal', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', entry.id,
          'entry_kind', entry.entry_kind,
          'body', entry.body,
          'key_takeaway', entry.key_takeaway,
          'attachments', entry.attachments,
          'visibility', entry.visibility,
          'occurred_on', entry.occurred_on,
          'created_at', entry.created_at,
          'updated_at', entry.updated_at
        ) order by entry.occurred_on desc, entry.created_at desc, entry.id desc
      )
      from public.seed_journal_entries entry
      where entry.seed_id = seed.id
        and (
          seed.user_id = auth.uid()
          or public.seed_is_visible_to_viewer(seed.user_id, entry.visibility, auth.uid())
        )
    ), '[]'::jsonb),
    'intents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'intent_id', intent.id,
          'activity_name', activity.name,
          'status', intent.status,
          'relationship', seed_intent.relationship,
          'created_at', seed_intent.created_at
        ) order by seed_intent.created_at desc, seed_intent.id desc
      )
      from public.seed_intent_links seed_intent
      join public.intents intent on intent.id = seed_intent.intent_id
      left join public.activities activity on activity.id = intent.activity_id
      where seed_intent.seed_id = seed.id
        and public.can_user_view_intent_activity(intent.id, auth.uid())
    ), '[]'::jsonb)
  ) into v_result
  from public.seeds seed
  join public.seed_types seed_type on seed_type.id = seed.seed_type_id
  join public.profiles profile on profile.id = seed.user_id
  where seed.id = p_seed_id;

  return v_result;
end;
$$;

create or replace function public.get_visible_seed_reaction_context(p_seed_ids uuid[])
returns table(
  seed_id uuid,
  save_count bigint,
  water_count bigint,
  viewer_saved boolean,
  viewer_watered boolean,
  friend_water_count bigint,
  friend_water_preview jsonb,
  viewer_can_react boolean,
  reaction_disabled_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seed.id,
    (
      select count(*)::bigint
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.reaction_type = 'save'
    ) as save_count,
    (
      select count(*)::bigint
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.reaction_type = 'water'
    ) as water_count,
    exists (
      select 1
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.user_id = auth.uid()
        and reaction.reaction_type = 'save'
    ) as viewer_saved,
    exists (
      select 1
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.user_id = auth.uid()
        and reaction.reaction_type = 'water'
    ) as viewer_watered,
    case when auth.uid() is null then 0 else (
      select count(*)::bigint
      from public.seed_reactions reaction
      where reaction.seed_id = seed.id
        and reaction.reaction_type = 'water'
        and reaction.user_id <> auth.uid()
        and reaction.visibility in ('friends', 'everyone')
        and public.users_are_accepted_friends(reaction.user_id, auth.uid())
    ) end as friend_water_count,
    case when auth.uid() is null then '[]'::jsonb else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', preview.user_id,
          'full_name', preview.full_name,
          'username', preview.username,
          'avatar_url', preview.avatar_url
        ) order by preview.updated_at desc
      )
      from (
        select
          profile.id as user_id,
          profile.full_name,
          profile.username,
          profile.avatar_url,
          reaction.updated_at
        from public.seed_reactions reaction
        join public.profiles profile on profile.id = reaction.user_id
        where reaction.seed_id = seed.id
          and reaction.reaction_type = 'water'
          and reaction.user_id <> auth.uid()
          and reaction.visibility in ('friends', 'everyone')
          and public.users_are_accepted_friends(reaction.user_id, auth.uid())
        order by reaction.updated_at desc
        limit 3
      ) preview
    ), '[]'::jsonb) end as friend_water_preview,
    (
      auth.uid() is not null
      and seed.user_id <> auth.uid()
      and seed.status in ('active', 'completed')
    ) as viewer_can_react,
    case
      when auth.uid() is null then 'Sign in to Save or Water this Seed.'
      when seed.user_id = auth.uid() then 'You cannot react to your own Seed.'
      when seed.status = 'archived' then 'This Seed is archived.'
      else null
    end::text as reaction_disabled_reason
  from public.seeds seed
  where seed.id = any(coalesce(p_seed_ids, '{}'::uuid[]))
    and (
      (seed.status in ('active', 'completed') and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid()))
      or seed.user_id = auth.uid()
    );
$$;

create or replace function public.set_my_seed_reaction(
  p_seed_id uuid,
  p_reaction_type text,
  p_active boolean
)
returns table(
  seed_id uuid,
  save_count bigint,
  water_count bigint,
  viewer_saved boolean,
  viewer_watered boolean,
  friend_water_count bigint,
  friend_water_preview jsonb,
  viewer_can_react boolean,
  reaction_disabled_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed public.seeds%rowtype;
  v_visibility text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to react to a Seed.';
  end if;

  if p_reaction_type not in ('save', 'water') then
    raise exception 'Unsupported Seed reaction.' using errcode = '22023';
  end if;

  if not coalesce(p_active, false) then
    delete from public.seed_reactions reaction
    where reaction.seed_id = p_seed_id
      and reaction.user_id = auth.uid()
      and reaction.reaction_type = p_reaction_type;

    return query
    select * from public.get_visible_seed_reaction_context(array[p_seed_id]);
    return;
  end if;

  select seed.* into v_seed
  from public.seeds seed
  where seed.id = p_seed_id;

  if v_seed.id is null
    or v_seed.status not in ('active', 'completed')
    or not public.seed_is_visible_to_viewer(v_seed.user_id, v_seed.visibility, auth.uid())
  then
    raise exception 'This Seed is not available for reactions.';
  end if;

  if v_seed.user_id = auth.uid() then
    raise exception 'You cannot react to your own Seed.' using errcode = '22023';
  end if;

  v_visibility := case when p_reaction_type = 'save' then 'only_me' else 'friends' end;

  insert into public.seed_reactions (
    seed_id,
    user_id,
    reaction_type,
    visibility
  ) values (
    p_seed_id,
    auth.uid(),
    p_reaction_type,
    v_visibility
  )
  on conflict on constraint seed_reactions_unique
  do update set
    visibility = excluded.visibility,
    updated_at = now();

  return query
  select * from public.get_visible_seed_reaction_context(array[p_seed_id]);
end;
$$;

alter table public.seed_journal_entries enable row level security;
alter table public.seed_reactions enable row level security;

drop policy if exists seed_journal_visible_select on public.seed_journal_entries;
create policy seed_journal_visible_select
on public.seed_journal_entries for select
to anon, authenticated
using (
  exists (
    select 1
    from public.seeds seed
    where seed.id = seed_journal_entries.seed_id
      and public.seed_is_visible_to_viewer(seed.user_id, seed.visibility, auth.uid())
      and (
        seed.user_id = auth.uid()
        or public.seed_is_visible_to_viewer(seed.user_id, seed_journal_entries.visibility, auth.uid())
      )
  )
);

drop policy if exists seed_journal_owner_all on public.seed_journal_entries;
create policy seed_journal_owner_all
on public.seed_journal_entries for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.seeds seed
    where seed.id = seed_journal_entries.seed_id
      and seed.user_id = auth.uid()
  )
);

drop policy if exists seed_reactions_visible_select on public.seed_reactions;
create policy seed_reactions_visible_select
on public.seed_reactions for select
to authenticated
using (
  user_id = auth.uid()
  or (
    reaction_type = 'water'
    and (
      visibility = 'everyone'
      or (visibility = 'friends' and public.users_are_accepted_friends(user_id, auth.uid()))
    )
  )
);

drop policy if exists seed_reactions_owner_insert on public.seed_reactions;
create policy seed_reactions_owner_insert
on public.seed_reactions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists seed_reactions_owner_update on public.seed_reactions;
create policy seed_reactions_owner_update
on public.seed_reactions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists seed_reactions_owner_delete on public.seed_reactions;
create policy seed_reactions_owner_delete
on public.seed_reactions for delete
to authenticated
using (user_id = auth.uid());

revoke all on table public.seed_journal_entries from public, anon, authenticated;
revoke all on table public.seed_reactions from public, anon, authenticated;

revoke all on function public.normalize_seed_link_collection(jsonb) from public;
revoke all on function public.replace_my_seed_links(uuid, jsonb) from public;
revoke all on function public.create_my_seed_v2(uuid, text, text, text, text, text, date, jsonb) from public;
revoke all on function public.update_my_seed_v2(uuid, uuid, text, text, text, text, text, date, jsonb) from public;
revoke all on function public.get_my_seeds_v2(text) from public;
revoke all on function public.get_my_seed_v2(uuid) from public;
revoke all on function public.get_visible_profile_seeds_v2(uuid, integer) from public;
revoke all on function public.get_my_saved_seeds(integer, integer) from public;
revoke all on function public.normalize_seed_journal_attachments(jsonb) from public;
revoke all on function public.save_my_seed_journal_entry(uuid, uuid, text, text, text, text, date, jsonb) from public;
revoke all on function public.delete_my_seed_journal_entry(uuid) from public;
revoke all on function public.complete_my_seed_with_reflection(uuid, date, text, text, text, jsonb) from public;
revoke all on function public.get_visible_seed_detail(uuid) from public;
revoke all on function public.get_visible_seed_reaction_context(uuid[]) from public;
revoke all on function public.set_my_seed_reaction(uuid, text, boolean) from public;

grant execute on function public.create_my_seed_v2(uuid, text, text, text, text, text, date, jsonb) to authenticated;
grant execute on function public.update_my_seed_v2(uuid, uuid, text, text, text, text, text, date, jsonb) to authenticated;
grant execute on function public.get_my_seeds_v2(text) to authenticated;
grant execute on function public.get_my_seed_v2(uuid) to authenticated;
grant execute on function public.get_visible_profile_seeds_v2(uuid, integer) to anon, authenticated;
grant execute on function public.get_my_saved_seeds(integer, integer) to authenticated;
grant execute on function public.save_my_seed_journal_entry(uuid, uuid, text, text, text, text, date, jsonb) to authenticated;
grant execute on function public.delete_my_seed_journal_entry(uuid) to authenticated;
grant execute on function public.complete_my_seed_with_reflection(uuid, date, text, text, text, jsonb) to authenticated;
grant execute on function public.get_visible_seed_detail(uuid) to anon, authenticated;
grant execute on function public.get_visible_seed_reaction_context(uuid[]) to anon, authenticated;
grant execute on function public.set_my_seed_reaction(uuid, text, boolean) to authenticated;

-- Keep the dynamic language catalogue aware of the new Seed vocabulary when the
-- translation tables exist. This block is deliberately optional for older databases.
do $$
begin
  if to_regclass('public.app_translation_namespaces') is not null
    and to_regclass('public.app_translation_keys') is not null
    and to_regclass('public.app_translation_values') is not null
    and to_regclass('public.app_languages') is not null
  then
    insert into public.app_translation_namespaces (slug, name, description)
    values (
      'seed-journal',
      'Seed Journal',
      'Seed detail, journal, linked media and Water reaction labels.'
    )
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description;
  end if;
end;
$$;

commit;
