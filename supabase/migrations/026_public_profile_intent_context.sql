begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function public.resolve_public_community_sport_cover(
  p_community_id uuid,
  p_sport_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cover_url text;
  v_relation_name text;
begin
  if p_community_id is null or p_sport_id is null then
    return null;
  end if;

  foreach v_relation_name in array array[
    'public.community_sports',
    'public.community_sport_links',
    'public.community_sport_catalogue'
  ]
  loop
    if to_regclass(v_relation_name) is null then
      continue;
    end if;

    begin
      execute format(
        'select nullif(btrim(default_cover_url), '''')
           from %s
          where community_id = $1
            and sport_id = $2
            and coalesce(is_active, true) = true
          order by coalesce(sort_order, 100), community_id
          limit 1',
        to_regclass(v_relation_name)
      )
      into v_cover_url
      using p_community_id, p_sport_id;
    exception
      when undefined_column then
        execute format(
          'select nullif(btrim(default_cover_url), '''')
             from %s
            where community_id = $1
              and sport_id = $2
            limit 1',
          to_regclass(v_relation_name)
        )
        into v_cover_url
        using p_community_id, p_sport_id;
    end;

    if v_cover_url is not null then
      return v_cover_url;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.get_public_visible_intent_presentation_context(
  p_intent_ids uuid[]
)
returns table (
  intent_id uuid,
  sport_id uuid,
  sport_name text,
  sport_slug text,
  sport_cover_url text,
  primary_community_id uuid,
  primary_community_name text,
  community_sport_cover_url text,
  context_cover_url text,
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  community_accent_color text,
  community_secondary_color text,
  community_scope_type text,
  category_id uuid,
  community_status text,
  community_position smallint,
  is_primary boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with requested_intents as (
    select distinct requested.intent_id
    from unnest(
      coalesce(
        p_intent_ids,
        array[]::uuid[]
      )
    ) as requested(intent_id)
  ),
  visible_intents as (
    select intent.*
    from requested_intents requested
    join public.intents intent
      on intent.id = requested.intent_id
    where public.can_user_view_intent_activity(
      intent.id,
      auth.uid()
    )
  )
  select
    intent.id as intent_id,
    sport.id as sport_id,
    sport.name as sport_name,
    sport.slug as sport_slug,
    null::text as sport_cover_url,
    primary_community.id as primary_community_id,
    primary_community.name as primary_community_name,
    public.resolve_public_community_sport_cover(
      primary_community.id,
      sport.id
    ) as community_sport_cover_url,
    coalesce(
      public.resolve_public_community_sport_cover(
        primary_community.id,
        sport.id
      ),
      primary_community.cover_image_url
    ) as context_cover_url,
    community.id as community_id,
    community.name as community_name,
    community.slug as community_slug,
    community.description as community_description,
    community.icon_key as community_icon_key,
    community.icon_url as community_icon_url,
    community.accent_color as community_accent_color,
    community.secondary_color as community_secondary_color,
    community.scope_type as community_scope_type,
    community.category_id as category_id,
    community.status as community_status,
    link.position::smallint as community_position,
    coalesce(link.position = 0, false) as is_primary
  from visible_intents intent
  left join public.sports sport
    on sport.id = intent.sport_id
    and sport.is_active = true
  left join lateral (
    select primary_item.*
    from public.intent_communities primary_link
    join public.communities primary_item
      on primary_item.id = primary_link.community_id
    where primary_link.intent_id = intent.id
      and primary_item.status = 'active'
    order by
      primary_link.position,
      primary_item.name
    limit 1
  ) primary_community
    on true
  left join public.intent_communities link
    on link.intent_id = intent.id
  left join public.communities community
    on community.id = link.community_id
    and community.status = 'active'
  order by
    intent.id,
    link.position nulls last,
    community.name nulls last;
$$;

revoke all on function public.resolve_public_community_sport_cover(uuid, uuid)
from public, anon, authenticated;

revoke all on function public.get_public_visible_intent_presentation_context(uuid[])
from public;

grant execute on function public.get_public_visible_intent_presentation_context(uuid[])
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
