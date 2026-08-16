begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- ============================================================
-- PLAN PUBLIC PRESENTATION EDITING
--
-- A forming/planned Plan may continue to refine its public-facing
-- description, related links/videos and the visibility of its meeting point.
--
-- Privacy rule:
-- - meeting_point may be public by explicit host/co-host choice.
-- - address_text, coordinates, map_url and Street View remain member-only.
-- ============================================================

alter table public.plans
  add column if not exists meeting_point_visibility text not null default 'members';

alter table public.plans
  drop constraint if exists plans_meeting_point_visibility_check;

alter table public.plans
  add constraint plans_meeting_point_visibility_check
  check (meeting_point_visibility in ('members', 'public'));

comment on column public.plans.meeting_point_visibility is
  'Controls whether the meeting point name may be shown to viewers who can already view the Plan. Exact address, coordinates and map metadata remain member-only.';

-- Existing Intent links support a controlled Video resource type.
alter table public.intent_links
  drop constraint if exists intent_links_type_check;

alter table public.intent_links
  add constraint intent_links_type_check
  check (
    link_type in (
      'official_event',
      'ticket',
      'organizer',
      'venue',
      'reference',
      'video',
      'other'
    )
  );

create or replace function public.normalize_intent_links_json(
  p_links jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $function$
declare
  v_item jsonb;
  v_type text;
  v_label text;
  v_url text;
  v_result jsonb := '[]'::jsonb;
  v_seen_urls text[] := array[]::text[];
  v_index integer := 0;
begin
  if p_links is null then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_links) <> 'array' then
    raise exception 'Related links must be a JSON array.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_links) > 5 then
    raise exception 'An Intent can have at most 5 related links.'
      using errcode = '22023';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_links)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each related link must be an object.'
        using errcode = '22023';
    end if;

    v_type := lower(
      btrim(
        coalesce(
          v_item ->> 'link_type',
          ''
        )
      )
    );

    v_label := nullif(
      btrim(
        coalesce(
          v_item ->> 'label',
          ''
        )
      ),
      ''
    );

    v_url := btrim(
      coalesce(
        v_item ->> 'url',
        ''
      )
    );

    if v_type not in (
      'official_event',
      'ticket',
      'organizer',
      'venue',
      'reference',
      'video',
      'other'
    ) then
      raise exception 'Unsupported related link type.'
        using errcode = '22023';
    end if;

    if v_url = ''
       or v_url !~* '^https://[^[:space:]]+$'
    then
      raise exception 'Related links must use a valid HTTPS URL.'
        using errcode = '22023';
    end if;

    if char_length(v_url) > 2048 then
      raise exception 'Related link URL cannot exceed 2048 characters.'
        using errcode = '22023';
    end if;

    if v_label is not null
       and char_length(v_label) > 80
    then
      raise exception 'Related link label cannot exceed 80 characters.'
        using errcode = '22023';
    end if;

    if v_type = 'other'
       and v_label is null
    then
      raise exception 'A custom label is required for an Other link.'
        using errcode = '22023';
    end if;

    if lower(v_url) = any(v_seen_urls) then
      raise exception 'The same related link cannot be added twice.'
        using errcode = '22023';
    end if;

    v_seen_urls := array_append(v_seen_urls, lower(v_url));

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'link_type', v_type,
        'label', v_label,
        'url', v_url,
        'sort_order', v_index
      )
    );

    v_index := v_index + 1;
  end loop;

  return v_result;
end;
$function$;

create or replace function public.get_my_plan_public_content(
  p_plan_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_source_intent_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select plan.*
  into v_plan
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
    );

  if v_plan.id is null then
    raise exception 'Plan not found or access denied.'
      using errcode = 'P0002';
  end if;

  select link.intent_id
  into v_source_intent_id
  from public.plan_intents link
  join public.intents intent
    on intent.id = link.intent_id
  where link.plan_id = p_plan_id
    and link.status = 'active'
  order by
    case
      when link.relationship = 'host_source' then 0
      when intent.user_id = v_plan.host_user_id then 1
      else 2
    end,
    link.id
  limit 1;

  return jsonb_build_object(
    'plan_id', v_plan.id,
    'plan_status', v_plan.status,
    'description', v_plan.notes,
    'meeting_point', v_plan.meeting_point,
    'meeting_point_visibility', v_plan.meeting_point_visibility,
    'activity_location_name', v_plan.activity_location_name,
    'activity_location_visibility', v_plan.activity_location_visibility,
    'source_intent_id', v_source_intent_id,
    'links',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', intent_link.id,
              'link_type', intent_link.link_type,
              'label', intent_link.label,
              'url', intent_link.url,
              'sort_order', intent_link.sort_order
            )
            order by intent_link.sort_order, intent_link.created_at, intent_link.id
          )
          from public.intent_links intent_link
          where intent_link.intent_id = v_source_intent_id
        ),
        '[]'::jsonb
      )
  );
end;
$function$;

create or replace function public.update_my_plan_public_content(
  p_plan_id uuid,
  p_description text,
  p_meeting_point_visibility text,
  p_links jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_source_intent_id uuid;
  v_description text;
  v_visibility text;
  v_links jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  select plan.*
  into v_plan
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

  if v_plan.id is null then
    raise exception 'Plan not found or access denied.'
      using errcode = 'P0002';
  end if;

  if v_plan.status not in ('forming', 'planned') then
    raise exception 'Only a forming or planned Activity can edit its public presentation.'
      using errcode = '22023';
  end if;

  v_description := nullif(btrim(coalesce(p_description, '')), '');

  if v_description is not null
     and char_length(v_description) > 5000
  then
    raise exception 'Description may contain at most 5000 characters.'
      using errcode = '22023';
  end if;

  v_visibility := lower(
    btrim(
      coalesce(
        p_meeting_point_visibility,
        'members'
      )
    )
  );

  if v_visibility not in ('members', 'public') then
    raise exception 'Unsupported meeting point visibility.'
      using errcode = '22023';
  end if;

  v_links := public.normalize_intent_links_json(p_links);

  select link.intent_id
  into v_source_intent_id
  from public.plan_intents link
  join public.intents intent
    on intent.id = link.intent_id
  where link.plan_id = p_plan_id
    and link.status = 'active'
  order by
    case
      when link.relationship = 'host_source' then 0
      when intent.user_id = v_plan.host_user_id then 1
      else 2
    end,
    link.id
  limit 1;

  if v_source_intent_id is null then
    raise exception 'This Plan has no active source Intent.'
      using errcode = 'P0002';
  end if;

  update public.plans
  set
    notes = v_description,
    meeting_point_visibility = v_visibility,
    updated_at = now()
  where id = p_plan_id;

  -- Keep the source Intent presentation coherent with the Plan after formation.
  update public.intents
  set
    notes = v_description,
    updated_at = now()
  where id = v_source_intent_id;

  delete from public.intent_links
  where intent_id = v_source_intent_id;

  insert into public.intent_links (
    intent_id,
    link_type,
    label,
    url,
    sort_order,
    created_at,
    updated_at
  )
  select
    v_source_intent_id,
    link ->> 'link_type',
    link ->> 'label',
    link ->> 'url',
    (link ->> 'sort_order')::smallint,
    now(),
    now()
  from jsonb_array_elements(v_links) link;

  return jsonb_build_object(
    'ok', true,
    'plan_id', p_plan_id,
    'source_intent_id', v_source_intent_id,
    'description', v_description,
    'meeting_point_visibility', v_visibility,
    'links', v_links
  );
end;
$function$;

create or replace function public.get_visible_plan_public_content(
  p_plan_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_viewer_user_id uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_source_intent_id uuid;
  v_can_view_private boolean := false;
begin
  select plan.*
  into v_plan
  from public.plans plan
  where plan.id = p_plan_id;

  if v_plan.id is null then
    return null;
  end if;

  select link.intent_id
  into v_source_intent_id
  from public.plan_intents link
  join public.intents intent
    on intent.id = link.intent_id
  where link.plan_id = p_plan_id
    and link.status = 'active'
  order by
    case
      when link.relationship = 'host_source' then 0
      when intent.user_id = v_plan.host_user_id then 1
      else 2
    end,
    link.id
  limit 1;

  if v_source_intent_id is null
     or not public.can_user_view_intent_activity(
       v_source_intent_id,
       v_viewer_user_id
     )
  then
    return null;
  end if;

  v_can_view_private :=
    v_viewer_user_id is not null
    and (
      v_plan.host_user_id = v_viewer_user_id
      or exists (
        select 1
        from public.plan_members member
        where member.plan_id = p_plan_id
          and member.user_id = v_viewer_user_id
          and member.status = 'active'
      )
    );

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'description', v_plan.notes,
    'meeting_point',
      case
        when v_can_view_private
          or v_plan.meeting_point_visibility = 'public'
        then nullif(btrim(v_plan.meeting_point), '')
        else null
      end,
    'meeting_point_is_public',
      v_plan.meeting_point_visibility = 'public',
    'activity_location_name',
      case
        when v_can_view_private
          or v_plan.activity_location_visibility = 'public'
        then nullif(btrim(v_plan.activity_location_name), '')
        else null
      end
  );
end;
$function$;

revoke all on function public.get_my_plan_public_content(uuid)
from public, anon;

revoke all on function public.update_my_plan_public_content(
  uuid, text, text, jsonb
)
from public, anon;

revoke all on function public.get_visible_plan_public_content(uuid)
from public;

grant execute on function public.get_my_plan_public_content(uuid)
to authenticated;

grant execute on function public.update_my_plan_public_content(
  uuid, text, text, jsonb
)
to authenticated;

grant execute on function public.get_visible_plan_public_content(uuid)
to anon, authenticated;

comment on function public.get_my_plan_public_content(uuid)
is
  'Returns editable public-facing Plan presentation data to the Primary Host or active Co-host.';

comment on function public.update_my_plan_public_content(uuid, text, text, jsonb)
is
  'Updates the forming/planned Activity description, source Intent links/videos and meeting-point-name visibility. Exact meeting address/map/coordinates remain private.';

comment on function public.get_visible_plan_public_content(uuid)
is
  'Returns only visibility-safe public Plan presentation. A public meeting point exposes its name only, never address, map URL or coordinates.';

notify pgrst, 'reload schema';

commit;
