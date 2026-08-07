begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  platform text not null,
  label text,
  url text not null,
  visibility text not null default 'public',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_links_platform_check
    check (
      platform in (
        'instagram',
        'facebook',
        'x',
        'bluesky',
        'linkedin',
        'tiktok',
        'youtube',
        'github',
        'website'
      )
    ),

  constraint profile_links_visibility_check
    check (
      visibility in (
        'public',
        'friends',
        'private'
      )
    ),

  constraint profile_links_label_length_check
    check (
      label is null
      or char_length(label) <= 40
    ),

  constraint profile_links_url_length_check
    check (
      char_length(url) between 1 and 2048
    ),

  constraint profile_links_sort_order_check
    check (
      sort_order between 0 and 99
    )
);

create index if not exists
  profile_links_user_sort_idx
on public.profile_links (
  user_id,
  sort_order,
  created_at
);

create table if not exists public.profile_embeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,
  provider text not null,
  resource_type text not null,
  resource_id text not null,
  source_url text not null,
  visibility text not null default 'public',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_embeds_provider_check
    check (
      provider in (
        'spotify',
        'youtube'
      )
    ),

  constraint profile_embeds_visibility_check
    check (
      visibility in (
        'public',
        'friends',
        'private'
      )
    ),

  constraint profile_embeds_resource_type_check
    check (
      (
        provider = 'spotify'
        and resource_type in (
          'track',
          'album',
          'playlist',
          'episode',
          'show'
        )
      )
      or (
        provider = 'youtube'
        and resource_type = 'video'
      )
    ),

  constraint profile_embeds_resource_id_length_check
    check (
      char_length(resource_id) between 1 and 200
    ),

  constraint profile_embeds_source_url_length_check
    check (
      char_length(source_url) between 1 and 2048
    ),

  constraint profile_embeds_user_provider_unique
    unique (
      user_id,
      provider
    )
);

create index if not exists
  profile_embeds_user_idx
on public.profile_embeds (
  user_id,
  provider
);

alter table public.profile_links
  enable row level security;

alter table public.profile_embeds
  enable row level security;

drop policy if exists
  "Profile owners can read links"
on public.profile_links;

create policy
  "Profile owners can read links"
on public.profile_links
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can insert links"
on public.profile_links;

create policy
  "Profile owners can insert links"
on public.profile_links
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can update links"
on public.profile_links;

create policy
  "Profile owners can update links"
on public.profile_links
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can delete links"
on public.profile_links;

create policy
  "Profile owners can delete links"
on public.profile_links
for delete
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can read embeds"
on public.profile_embeds;

create policy
  "Profile owners can read embeds"
on public.profile_embeds
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can insert embeds"
on public.profile_embeds;

create policy
  "Profile owners can insert embeds"
on public.profile_embeds
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can update embeds"
on public.profile_embeds;

create policy
  "Profile owners can update embeds"
on public.profile_embeds
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Profile owners can delete embeds"
on public.profile_embeds;

create policy
  "Profile owners can delete embeds"
on public.profile_embeds
for delete
to authenticated
using (
  auth.uid() = user_id
);

create or replace function
  public.get_my_profile_presence()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
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

  return jsonb_build_object(
    'links',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', link.id,
            'platform', link.platform,
            'label', link.label,
            'url', link.url,
            'visibility', link.visibility,
            'sort_order', link.sort_order
          )
          order by
            link.sort_order,
            link.created_at,
            link.id
        )
        from public.profile_links link
        where
          link.user_id = v_user_id
          and link.is_active
      ),
      '[]'::jsonb
    ),

    'embeds',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', embed.id,
            'provider', embed.provider,
            'resource_type', embed.resource_type,
            'resource_id', embed.resource_id,
            'source_url', embed.source_url,
            'visibility', embed.visibility
          )
          order by
            case
              when embed.provider = 'spotify' then 0
              else 1
            end,
            embed.created_at,
            embed.id
        )
        from public.profile_embeds embed
        where
          embed.user_id = v_user_id
          and embed.is_active
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function
  public.get_public_profile_presence(
    p_profile_user_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid;
  v_is_owner boolean;
  v_is_friend boolean;
begin
  if p_profile_user_id is null then
    return jsonb_build_object(
      'links', '[]'::jsonb,
      'embeds', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_user_id
  ) then
    return null;
  end if;

  v_viewer_user_id := auth.uid();
  v_is_owner :=
    v_viewer_user_id = p_profile_user_id;

  v_is_friend :=
    v_viewer_user_id is not null
    and not v_is_owner
    and coalesce(
      public.are_users_friends(
        p_profile_user_id,
        v_viewer_user_id
      ),
      false
    );

  return jsonb_build_object(
    'links',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', link.id,
            'platform', link.platform,
            'label', link.label,
            'url', link.url,
            'visibility', link.visibility,
            'sort_order', link.sort_order
          )
          order by
            link.sort_order,
            link.created_at,
            link.id
        )
        from public.profile_links link
        where
          link.user_id = p_profile_user_id
          and link.is_active
          and (
            v_is_owner
            or link.visibility = 'public'
            or (
              link.visibility = 'friends'
              and v_is_friend
            )
          )
      ),
      '[]'::jsonb
    ),

    'embeds',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', embed.id,
            'provider', embed.provider,
            'resource_type', embed.resource_type,
            'resource_id', embed.resource_id,
            'source_url', embed.source_url,
            'visibility', embed.visibility
          )
          order by
            case
              when embed.provider = 'spotify' then 0
              else 1
            end,
            embed.created_at,
            embed.id
        )
        from public.profile_embeds embed
        where
          embed.user_id = p_profile_user_id
          and embed.is_active
          and (
            v_is_owner
            or embed.visibility = 'public'
            or (
              embed.visibility = 'friends'
              and v_is_friend
            )
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function
  public.save_my_profile_presence(
    p_links jsonb default '[]'::jsonb,
    p_spotify_url text default null,
    p_spotify_visibility text default 'public',
    p_youtube_url text default null,
    p_youtube_visibility text default 'public'
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_link jsonb;
  v_platform text;
  v_label text;
  v_url text;
  v_visibility text;
  v_sort_order integer;
  v_match text[];
  v_resource_type text;
  v_resource_id text;
  v_spotify_url text;
  v_youtube_url text;
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

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception
      'Profile links must be supplied as an array.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_links, '[]'::jsonb)) > 10 then
    raise exception
      'A profile may contain at most 10 social links.'
      using errcode = '22023';
  end if;

  delete from public.profile_links
  where user_id = v_user_id;

  v_sort_order := 0;

  for v_link in
    select value
    from jsonb_array_elements(
      coalesce(p_links, '[]'::jsonb)
    )
  loop
    v_platform :=
      lower(
        btrim(
          coalesce(
            v_link ->> 'platform',
            ''
          )
        )
      );

    v_label :=
      nullif(
        btrim(
          coalesce(
            v_link ->> 'label',
            ''
          )
        ),
        ''
      );

    v_url :=
      nullif(
        btrim(
          coalesce(
            v_link ->> 'url',
            ''
          )
        ),
        ''
      );

    v_visibility :=
      lower(
        btrim(
          coalesce(
            v_link ->> 'visibility',
            'public'
          )
        )
      );

    if v_url is null then
      continue;
    end if;

    if v_platform not in (
      'instagram',
      'facebook',
      'x',
      'bluesky',
      'linkedin',
      'tiktok',
      'youtube',
      'github',
      'website'
    ) then
      raise exception
        'Unsupported social platform.'
        using errcode = '22023';
    end if;

    if v_visibility not in (
      'public',
      'friends',
      'private'
    ) then
      raise exception
        'Unsupported profile link visibility.'
        using errcode = '22023';
    end if;

    if char_length(v_url) > 2048 then
      raise exception
        'A profile link is too long.'
        using errcode = '22023';
    end if;

    if v_label is not null
       and char_length(v_label) > 40 then
      raise exception
        'A profile link label cannot exceed 40 characters.'
        using errcode = '22023';
    end if;

    if v_url !~* '^https?://' then
      raise exception
        'Profile links must use HTTP or HTTPS.'
        using errcode = '22023';
    end if;

    if
      v_platform = 'instagram'
      and v_url !~* '^https://(www\.)?instagram\.com/'
    then
      raise exception 'Instagram links must use instagram.com.';
    elsif
      v_platform = 'facebook'
      and v_url !~* '^https://(www\.)?(facebook|fb)\.com/'
    then
      raise exception 'Facebook links must use facebook.com or fb.com.';
    elsif
      v_platform = 'x'
      and v_url !~* '^https://(www\.)?(x|twitter)\.com/'
    then
      raise exception 'X links must use x.com or twitter.com.';
    elsif
      v_platform = 'bluesky'
      and v_url !~* '^https://(www\.)?bsky\.app/profile/'
    then
      raise exception 'Bluesky links must use bsky.app/profile/.';
    elsif
      v_platform = 'linkedin'
      and v_url !~* '^https://([a-z]{2,3}\.)?linkedin\.com/'
    then
      raise exception 'LinkedIn links must use linkedin.com.';
    elsif
      v_platform = 'tiktok'
      and v_url !~* '^https://(www\.)?tiktok\.com/'
    then
      raise exception 'TikTok links must use tiktok.com.';
    elsif
      v_platform = 'youtube'
      and v_url !~* '^https://(www\.)?(youtube\.com|youtu\.be)/'
    then
      raise exception 'YouTube links must use youtube.com or youtu.be.';
    elsif
      v_platform = 'github'
      and v_url !~* '^https://(www\.)?github\.com/'
    then
      raise exception 'GitHub links must use github.com.';
    end if;

    insert into public.profile_links (
      user_id,
      platform,
      label,
      url,
      visibility,
      sort_order
    ) values (
      v_user_id,
      v_platform,
      v_label,
      v_url,
      v_visibility,
      v_sort_order
    );

    v_sort_order := v_sort_order + 1;
  end loop;

  delete from public.profile_embeds
  where user_id = v_user_id;

  v_spotify_url :=
    nullif(
      btrim(
        coalesce(
          p_spotify_url,
          ''
        )
      ),
      ''
    );

  if v_spotify_url is not null then
    if lower(btrim(coalesce(p_spotify_visibility, 'public'))) not in (
      'public',
      'friends',
      'private'
    ) then
      raise exception
        'Unsupported Spotify visibility.'
        using errcode = '22023';
    end if;

    v_match := regexp_match(
      v_spotify_url,
      '^https://open\.spotify\.com/(track|album|playlist|episode|show)/([A-Za-z0-9]+)([/?].*)?$',
      'i'
    );

    if v_match is null then
      raise exception
        'Enter a Spotify track, album, playlist, episode, or show URL.'
        using errcode = '22023';
    end if;

    v_resource_type := lower(v_match[1]);
    v_resource_id := v_match[2];

    insert into public.profile_embeds (
      user_id,
      provider,
      resource_type,
      resource_id,
      source_url,
      visibility
    ) values (
      v_user_id,
      'spotify',
      v_resource_type,
      v_resource_id,
      v_spotify_url,
      lower(btrim(coalesce(p_spotify_visibility, 'public')))
    );
  end if;

  v_youtube_url :=
    nullif(
      btrim(
        coalesce(
          p_youtube_url,
          ''
        )
      ),
      ''
    );

  if v_youtube_url is not null then
    if lower(btrim(coalesce(p_youtube_visibility, 'public'))) not in (
      'public',
      'friends',
      'private'
    ) then
      raise exception
        'Unsupported YouTube visibility.'
        using errcode = '22023';
    end if;

    v_match := regexp_match(
      v_youtube_url,
      '[?&]v=([A-Za-z0-9_-]{6,})',
      'i'
    );

    if v_match is null then
      v_match := regexp_match(
        v_youtube_url,
        '^https://youtu\.be/([A-Za-z0-9_-]{6,})([/?].*)?$',
        'i'
      );
    end if;

    if v_match is null then
      v_match := regexp_match(
        v_youtube_url,
        '^https://(www\.)?youtube\.com/shorts/([A-Za-z0-9_-]{6,})([/?].*)?$',
        'i'
      );

      if v_match is not null then
        v_resource_id := v_match[2];
      end if;
    else
      v_resource_id := v_match[1];
    end if;

    if v_match is null then
      v_match := regexp_match(
        v_youtube_url,
        '^https://(www\.)?youtube\.com/embed/([A-Za-z0-9_-]{6,})([/?].*)?$',
        'i'
      );

      if v_match is not null then
        v_resource_id := v_match[2];
      end if;
    end if;

    if v_match is null then
      raise exception
        'Enter a valid YouTube video URL.'
        using errcode = '22023';
    end if;

    if v_resource_id is null then
      v_resource_id := v_match[array_length(v_match, 1)];
    end if;

    insert into public.profile_embeds (
      user_id,
      provider,
      resource_type,
      resource_id,
      source_url,
      visibility
    ) values (
      v_user_id,
      'youtube',
      'video',
      v_resource_id,
      v_youtube_url,
      lower(btrim(coalesce(p_youtube_visibility, 'public')))
    );
  end if;

  return public.get_my_profile_presence();
end;
$$;

create or replace function
  public.get_visible_plan_card_metadata(
    p_plan_ids uuid[]
  )
returns table (
  plan_id uuid,
  cover_url text,
  host_user_id uuid,
  host_full_name text,
  host_username text,
  host_avatar_url text,
  plan_visibility text,
  recruitment_status text,
  viewer_is_member boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid;
begin
  if p_plan_ids is null
     or cardinality(p_plan_ids) = 0 then
    return;
  end if;

  if cardinality(p_plan_ids) > 100 then
    raise exception
      'Too many Plan records requested.'
      using errcode = '22023';
  end if;

  v_viewer_user_id := auth.uid();

  return query
  select
    plan.id,
    plan.cover_url,
    plan.host_user_id,
    host_profile.full_name,
    host_profile.username,
    host_profile.avatar_url,
    plan.visibility,
    plan.recruitment_status,
    (
      plan.host_user_id = v_viewer_user_id
      or exists (
        select 1
        from public.plan_members current_viewer_member
        where
          current_viewer_member.plan_id = plan.id
          and current_viewer_member.user_id = v_viewer_user_id
          and current_viewer_member.status = 'active'
      )
    )
  from public.plans plan

  left join public.profiles host_profile
    on host_profile.id = plan.host_user_id

  where
    plan.id = any(p_plan_ids)

    and (
      plan.host_user_id = v_viewer_user_id

      or exists (
        select 1
        from public.plan_members viewer_member
        where
          viewer_member.plan_id = plan.id
          and viewer_member.user_id = v_viewer_user_id
          and viewer_member.status = 'active'
      )

      or plan.visibility = 'public'

      or exists (
        select 1
        from public.plan_intents linked_intent
        where
          linked_intent.plan_id = plan.id
          and linked_intent.status = 'active'
          and public.can_user_view_intent_activity(
            linked_intent.intent_id,
            v_viewer_user_id
          )
      )
    );
end;
$$;

revoke all on function
  public.get_my_profile_presence()
from public, anon;

grant execute on function
  public.get_my_profile_presence()
to authenticated;

revoke all on function
  public.get_public_profile_presence(uuid)
from public;

grant execute on function
  public.get_public_profile_presence(uuid)
to anon, authenticated;

revoke all on function
  public.save_my_profile_presence(
    jsonb,
    text,
    text,
    text,
    text
  )
from public, anon;

grant execute on function
  public.save_my_profile_presence(
    jsonb,
    text,
    text,
    text,
    text
  )
to authenticated;

revoke all on function
  public.get_visible_plan_card_metadata(uuid[])
from public;

grant execute on function
  public.get_visible_plan_card_metadata(uuid[])
to anon, authenticated;

commit;
