begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';
set local search_path = public, extensions;

-- Shared catalogue identity belongs to the Library, not to each personal Seed.
-- Personal fields (notes, target date, visibility, links and journal) remain editable.
create or replace function public.validate_seed_catalogue_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item public.seed_catalog_items%rowtype;
  v_edition_item_id uuid;
begin
  if new.catalog_item_id is null then
    if new.catalog_edition_id is not null then
      raise exception 'A Seed edition requires a catalogue item.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select item.*
  into v_item
  from public.seed_catalog_items item
  where item.id = new.catalog_item_id
    and item.status in ('active', 'pending');

  if v_item.id is null then
    raise exception 'The selected Seed catalogue item is unavailable.'
      using errcode = '23503';
  end if;

  if new.catalog_edition_id is not null then
    select edition.catalog_item_id
    into v_edition_item_id
    from public.seed_catalog_editions edition
    where edition.id = new.catalog_edition_id;

    if v_edition_item_id is distinct from new.catalog_item_id then
      raise exception 'The selected edition belongs to another catalogue item.'
        using errcode = '23514';
    end if;
  end if;

  -- Canonical identity is always inherited from the shared Library subject.
  new.seed_type_id := v_item.seed_type_id;
  new.title := v_item.canonical_title;
  new.subtitle := v_item.creator_name;
  new.cover_url := v_item.cover_url;

  return new;
end;
$$;

drop trigger if exists validate_seed_catalogue_link_trigger on public.seeds;
create trigger validate_seed_catalogue_link_trigger
before insert or update of
  seed_type_id,
  catalog_item_id,
  catalog_edition_id,
  title,
  subtitle,
  cover_url
on public.seeds
for each row execute function public.validate_seed_catalogue_link();

-- Catalogue edits propagate to every personal instance without touching
-- personal notes, links, visibility, target dates or journals.
create or replace function public.sync_seed_catalogue_identity_to_instances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.seeds seed
  set
    seed_type_id = new.seed_type_id,
    title = new.canonical_title,
    subtitle = new.creator_name,
    cover_url = new.cover_url,
    updated_at = now()
  where seed.catalog_item_id = new.id;

  return new;
end;
$$;

drop trigger if exists sync_seed_catalogue_identity_to_instances_trigger
  on public.seed_catalog_items;
create trigger sync_seed_catalogue_identity_to_instances_trigger
after update of seed_type_id, canonical_title, creator_name, cover_url
on public.seed_catalog_items
for each row execute function public.sync_seed_catalogue_identity_to_instances();

-- Repair catalogue-linked Seeds created before identity ownership was enforced.
update public.seeds seed
set
  seed_type_id = item.seed_type_id,
  title = item.canonical_title,
  subtitle = item.creator_name,
  cover_url = item.cover_url,
  updated_at = now()
from public.seed_catalog_items item
where seed.catalog_item_id = item.id
  and (
    seed.seed_type_id is distinct from item.seed_type_id
    or seed.title is distinct from item.canonical_title
    or seed.subtitle is distinct from item.creator_name
    or seed.cover_url is distinct from item.cover_url
  );

-- Editing a Library Seed updates only the personal layer. Identity arguments
-- are accepted for API compatibility but ignored for catalogue-linked Seeds.
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
declare
  v_seed public.seeds%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to edit a Seed.';
  end if;

  if p_visibility not in ('only_me', 'friends', 'everyone') then
    raise exception 'Invalid Seed visibility.';
  end if;

  select seed.*
  into v_seed
  from public.seeds seed
  where seed.id = p_seed_id
    and seed.user_id = auth.uid();

  if v_seed.id is null then
    raise exception 'Seed not found or cannot be edited.';
  end if;

  if v_seed.catalog_item_id is not null then
    update public.seeds seed
    set
      notes = nullif(btrim(p_notes), ''),
      visibility = p_visibility,
      target_date = p_target_date,
      updated_at = now()
    where seed.id = p_seed_id
      and seed.user_id = auth.uid();
  else
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
  end if;

  perform public.replace_my_seed_links(p_seed_id, p_links);
  return p_seed_id;
end;
$$;

-- Small owner-only context used by the edit screen to distinguish a shared
-- Library Seed from a free-form personal Seed.
create or replace function public.get_my_seed_catalog_identity(p_seed_id uuid)
returns table(
  catalog_item_id uuid,
  item_kind text,
  canonical_title text,
  creator_name text,
  release_year integer,
  cover_url text,
  catalogue_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    item.id,
    item.item_kind,
    item.canonical_title,
    item.creator_name,
    item.release_year,
    item.cover_url,
    item.status
  from public.seeds seed
  join public.seed_catalog_items item
    on item.id = seed.catalog_item_id
  where seed.id = p_seed_id
    and seed.user_id = auth.uid()
  limit 1;
$$;

-- Admin owns canonical title, creator/year and cover. The sync trigger updates
-- all linked personal Seeds after this function changes the subject.
create or replace function public.admin_update_seed_catalog_item(
  p_catalog_item_id uuid,
  p_canonical_title text,
  p_creator_name text default null,
  p_original_title text default null,
  p_release_year integer default null,
  p_cover_url text default null,
  p_language_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_canonical_title, ''));
  v_creator text := nullif(btrim(p_creator_name), '');
  v_original_title text := nullif(btrim(p_original_title), '');
  v_cover_url text := public.normalize_seed_url(p_cover_url);
  v_language_code text := nullif(lower(btrim(p_language_code)), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 240 then
    raise exception 'Canonical title must be between 1 and 240 characters.';
  end if;

  if v_creator is not null and char_length(v_creator) > 240 then
    raise exception 'Creator name may not exceed 240 characters.';
  end if;

  if p_release_year is not null and (p_release_year < 1 or p_release_year > 3000) then
    raise exception 'Release year is invalid.';
  end if;

  update public.seed_catalog_items item
  set
    canonical_title = v_title,
    creator_name = v_creator,
    original_title = v_original_title,
    release_year = p_release_year,
    cover_url = v_cover_url,
    language_code = v_language_code,
    updated_at = now()
  where item.id = p_catalog_item_id
    and item.status in ('active', 'pending');

  if not found then
    raise exception 'Catalogue subject not found or cannot be edited.';
  end if;

  return p_catalog_item_id;
end;
$$;

grant execute on function public.get_my_seed_catalog_identity(uuid)
  to authenticated;
grant execute on function public.admin_update_seed_catalog_item(
  uuid, text, text, text, integer, text, text
) to authenticated;

commit;
