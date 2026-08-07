begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create table if not exists public.profile_connection_visibility (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  followers_count_visibility text
    not null
    default 'public',

  following_count_visibility text
    not null
    default 'public',

  friends_count_visibility text
    not null
    default 'public',

  mutual_friends_visibility text
    not null
    default 'public',

  updated_at timestamptz
    not null
    default now(),

  constraint profile_connection_visibility_followers_check
    check (
      followers_count_visibility in (
        'public',
        'friends',
        'private'
      )
    ),

  constraint profile_connection_visibility_following_check
    check (
      following_count_visibility in (
        'public',
        'friends',
        'private'
      )
    ),

  constraint profile_connection_visibility_friends_check
    check (
      friends_count_visibility in (
        'public',
        'friends',
        'private'
      )
    ),

  constraint profile_connection_visibility_mutual_check
    check (
      mutual_friends_visibility in (
        'public',
        'friends',
        'private'
      )
    )
);

create table if not exists public.profile_family_visibility (
  owner_user_id uuid
    not null
    references public.profiles(id)
    on delete cascade,

  family_key text
    not null,

  visibility text
    not null
    default 'private',

  updated_at timestamptz
    not null
    default now(),

  primary key (
    owner_user_id,
    family_key
  ),

  constraint profile_family_visibility_key_check
    check (
      family_key ~
        '^(child|relationship):[0-9a-fA-F-]{36}$'
    ),

  constraint profile_family_visibility_value_check
    check (
      visibility in (
        'public',
        'friends',
        'private'
      )
    )
);

create index if not exists
  profile_family_visibility_owner_idx
on public.profile_family_visibility (
  owner_user_id
);

alter table
  public.profile_connection_visibility
enable row level security;

alter table
  public.profile_family_visibility
enable row level security;

drop policy if exists
  profile_connection_visibility_owner_select
on public.profile_connection_visibility;

create policy
  profile_connection_visibility_owner_select
on public.profile_connection_visibility
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists
  profile_family_visibility_owner_select
on public.profile_family_visibility;

create policy
  profile_family_visibility_owner_select
on public.profile_family_visibility
for select
to authenticated
using (
  owner_user_id = auth.uid()
);

-- Preserve the visibility choices that already existed in the family subsystem.
insert into public.profile_family_visibility (
  owner_user_id,
  family_key,
  visibility,
  updated_at
)
select
  guardian.guardian_user_id,
  'child:' ||
    guardian.child_user_id::text,
  case
    when guardian.show_child_on_profile
      then 'public'
    else 'private'
  end,
  now()
from public.profile_guardians guardian
where
  guardian.status = 'accepted'
on conflict (
  owner_user_id,
  family_key
)
do nothing;

insert into public.profile_family_visibility (
  owner_user_id,
  family_key,
  visibility,
  updated_at
)
select
  relationship.requester_user_id,
  'relationship:' ||
    relationship.id::text,
  case
    when relationship.requester_public
      then 'public'
    else 'private'
  end,
  now()
from public.profile_relationships relationship
where
  relationship.status = 'accepted'
on conflict (
  owner_user_id,
  family_key
)
do nothing;

insert into public.profile_family_visibility (
  owner_user_id,
  family_key,
  visibility,
  updated_at
)
select
  relationship.target_user_id,
  'relationship:' ||
    relationship.id::text,
  case
    when relationship.target_public
      then 'public'
    else 'private'
  end,
  now()
from public.profile_relationships relationship
where
  relationship.status = 'accepted'
on conflict (
  owner_user_id,
  family_key
)
do nothing;

create or replace function
  public.profile_visibility_allows(
    p_profile_user_id uuid,
    p_visibility text,
    p_viewer_user_id uuid
  )
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if
    p_viewer_user_id =
      p_profile_user_id
  then
    return true;
  end if;

  if
    coalesce(
      p_visibility,
      'private'
    ) = 'public'
  then
    return true;
  end if;

  if
    p_viewer_user_id is null
    or coalesce(
      p_visibility,
      'private'
    ) = 'private'
  then
    return false;
  end if;

  return public.are_users_friends(
    p_profile_user_id,
    p_viewer_user_id
  );
end;
$$;

create or replace function
  public.profile_most_restrictive_visibility(
    p_first text,
    p_second text
  )
returns text
language sql
immutable
set search_path = public
as $$
  select
    case
      when
        coalesce(
          p_first,
          'private'
        ) = 'private'
        or coalesce(
          p_second,
          'private'
        ) = 'private'
        then 'private'

      when
        p_first = 'friends'
        or p_second = 'friends'
        then 'friends'

      else 'public'
    end;
$$;

create or replace function
  public.get_profile_connection_summary(
    p_profile_user_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid :=
    auth.uid();

  v_followers_visibility text :=
    'public';

  v_following_visibility text :=
    'public';

  v_friends_visibility text :=
    'public';

  v_mutual_visibility text :=
    'public';

  v_followers_count bigint;
  v_following_count bigint;
  v_friends_count bigint;

  v_mutual_count bigint :=
    0;

  v_mutual_friends jsonb :=
    '[]'::jsonb;
begin
  if not exists (
    select 1
    from public.profiles profile
    where
      profile.id =
        p_profile_user_id
  ) then
    return null;
  end if;

  select
    settings.followers_count_visibility,
    settings.following_count_visibility,
    settings.friends_count_visibility,
    settings.mutual_friends_visibility
  into
    v_followers_visibility,
    v_following_visibility,
    v_friends_visibility,
    v_mutual_visibility
  from public.profile_connection_visibility settings
  where
    settings.user_id =
      p_profile_user_id;

  v_followers_visibility :=
    coalesce(
      v_followers_visibility,
      'public'
    );

  v_following_visibility :=
    coalesce(
      v_following_visibility,
      'public'
    );

  v_friends_visibility :=
    coalesce(
      v_friends_visibility,
      'public'
    );

  v_mutual_visibility :=
    coalesce(
      v_mutual_visibility,
      'public'
    );

  if public.profile_visibility_allows(
    p_profile_user_id,
    v_followers_visibility,
    v_viewer_user_id
  ) then
    select
      count(
        distinct
        follow_record.follower_user_id
      )
    into
      v_followers_count
    from public.profile_follows follow_record
    where
      follow_record.followed_user_id =
        p_profile_user_id;
  end if;

  if public.profile_visibility_allows(
    p_profile_user_id,
    v_following_visibility,
    v_viewer_user_id
  ) then
    select
      count(
        distinct
        follow_record.followed_user_id
      )
    into
      v_following_count
    from public.profile_follows follow_record
    where
      follow_record.follower_user_id =
        p_profile_user_id;
  end if;

  if public.profile_visibility_allows(
    p_profile_user_id,
    v_friends_visibility,
    v_viewer_user_id
  ) then
    select
      count(
        distinct
        case
          when
            friendship.requester_user_id =
              p_profile_user_id
            then
              friendship.addressee_user_id
          else
              friendship.requester_user_id
        end
      )
    into
      v_friends_count
    from public.friendships friendship
    where
      friendship.status =
        'accepted'

      and (
        friendship.requester_user_id =
          p_profile_user_id

        or friendship.addressee_user_id =
          p_profile_user_id
      );
  end if;

  if
    v_viewer_user_id is not null

    and v_viewer_user_id <>
      p_profile_user_id

    and public.profile_visibility_allows(
      p_profile_user_id,
      v_mutual_visibility,
      v_viewer_user_id
    )
  then
    with profile_friends as (
      select
        case
          when
            friendship.requester_user_id =
              p_profile_user_id
            then
              friendship.addressee_user_id
          else
              friendship.requester_user_id
        end as friend_user_id
      from public.friendships friendship
      where
        friendship.status =
          'accepted'

        and (
          friendship.requester_user_id =
            p_profile_user_id

          or friendship.addressee_user_id =
            p_profile_user_id
        )
    ),

    viewer_friends as (
      select
        case
          when
            friendship.requester_user_id =
              v_viewer_user_id
            then
              friendship.addressee_user_id
          else
              friendship.requester_user_id
        end as friend_user_id
      from public.friendships friendship
      where
        friendship.status =
          'accepted'

        and (
          friendship.requester_user_id =
            v_viewer_user_id

          or friendship.addressee_user_id =
            v_viewer_user_id
        )
    ),

    mutual as (
      select distinct
        profile_friends.friend_user_id
      from profile_friends
      join viewer_friends
        using (
          friend_user_id
        )
      where
        profile_friends.friend_user_id not in (
          p_profile_user_id,
          v_viewer_user_id
        )
    )

    select
      count(*)
    into
      v_mutual_count
    from mutual;

    with profile_friends as (
      select
        case
          when
            friendship.requester_user_id =
              p_profile_user_id
            then
              friendship.addressee_user_id
          else
              friendship.requester_user_id
        end as friend_user_id
      from public.friendships friendship
      where
        friendship.status =
          'accepted'

        and (
          friendship.requester_user_id =
            p_profile_user_id

          or friendship.addressee_user_id =
            p_profile_user_id
        )
    ),

    viewer_friends as (
      select
        case
          when
            friendship.requester_user_id =
              v_viewer_user_id
            then
              friendship.addressee_user_id
          else
              friendship.requester_user_id
        end as friend_user_id
      from public.friendships friendship
      where
        friendship.status =
          'accepted'

        and (
          friendship.requester_user_id =
            v_viewer_user_id

          or friendship.addressee_user_id =
            v_viewer_user_id
        )
    ),

    mutual as (
      select distinct
        profile_friends.friend_user_id
      from profile_friends
      join viewer_friends
        using (
          friend_user_id
        )
      where
        profile_friends.friend_user_id not in (
          p_profile_user_id,
          v_viewer_user_id
        )
    )

    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id',
              profile.id,

            'full_name',
              profile.full_name,

            'username',
              profile.username,

            'avatar_url',
              profile.avatar_url
          )
          order by
            coalesce(
              profile.full_name,
              profile.username
            ),
            profile.username
        ),
        '[]'::jsonb
      )
    into
      v_mutual_friends
    from (
      select
        mutual.friend_user_id
      from mutual
      limit 3
    ) limited_mutual
    join public.profiles profile
      on profile.id =
        limited_mutual.friend_user_id;
  end if;

  return jsonb_build_object(
    'followers_count',
      v_followers_count,

    'following_count',
      v_following_count,

    'friends_count',
      v_friends_count,

    'mutual_friends_count',
      v_mutual_count,

    'mutual_friends',
      v_mutual_friends
  );
end;
$$;

create or replace function
  public.get_visible_profile_family(
    p_profile_user_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_user_id uuid :=
    auth.uid();

  v_children jsonb :=
    '[]'::jsonb;

  v_relationships jsonb :=
    '[]'::jsonb;
begin
  if not exists (
    select 1
    from public.profiles profile
    where
      profile.id =
        p_profile_user_id
  ) then
    return null;
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'guardian_link_id',
            guardian.id,

          'child_user_id',
            child_profile.id,

          'full_name',
            child_profile.full_name,

          'username',
            child_profile.username,

          'avatar_url',
            child_profile.avatar_url,

          'relationship',
            guardian.relationship,

          'guardian_role',
            guardian.guardian_role
        )
        order by
          child_profile.full_name nulls last,
          child_profile.username
      ),
      '[]'::jsonb
    )
  into
    v_children
  from public.profile_guardians guardian

  join public.profiles child_profile
    on child_profile.id =
      guardian.child_user_id

  left join public.profile_family_visibility visibility
    on visibility.owner_user_id =
      guardian.guardian_user_id

    and visibility.family_key =
      'child:' ||
        guardian.child_user_id::text

  where
    guardian.guardian_user_id =
      p_profile_user_id

    and guardian.status =
      'accepted'

    and public.is_managed_minor_user(
      guardian.child_user_id
    )

    and public.profile_visibility_allows(
      p_profile_user_id,

      coalesce(
        visibility.visibility,

        case
          when
            guardian.show_child_on_profile
            then 'public'
          else 'private'
        end
      ),

      v_viewer_user_id
    );

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'relationship_id',
            relationship.id,

          'relationship_type',
            relationship.relationship_type,

          'other_user_id',
            other_profile.id,

          'other_full_name',
            other_profile.full_name,

          'other_username',
            other_profile.username,

          'other_avatar_url',
            other_profile.avatar_url
        )
        order by
          relationship.responded_at desc nulls last,
          relationship.created_at desc
      ),
      '[]'::jsonb
    )
  into
    v_relationships
  from public.profile_relationships relationship

  join public.profiles other_profile
    on other_profile.id =
      case
        when
          relationship.requester_user_id =
            p_profile_user_id
          then
            relationship.target_user_id
        else
            relationship.requester_user_id
      end

  left join public.profile_family_visibility owner_visibility
    on owner_visibility.owner_user_id =
      p_profile_user_id

    and owner_visibility.family_key =
      'relationship:' ||
        relationship.id::text

  left join public.profile_family_visibility other_visibility
    on other_visibility.owner_user_id =
      case
        when
          relationship.requester_user_id =
            p_profile_user_id
          then
            relationship.target_user_id
        else
            relationship.requester_user_id
      end

    and other_visibility.family_key =
      'relationship:' ||
        relationship.id::text

  where
    relationship.status =
      'accepted'

    and (
      relationship.requester_user_id =
        p_profile_user_id

      or relationship.target_user_id =
        p_profile_user_id
    )

    and public.profile_visibility_allows(
      p_profile_user_id,

      public.profile_most_restrictive_visibility(
        coalesce(
          owner_visibility.visibility,

          case
            when
              relationship.requester_user_id =
                p_profile_user_id
              then
                case
                  when relationship.requester_public
                    then 'public'
                  else 'private'
                end
            else
                case
                  when relationship.target_public
                    then 'public'
                  else 'private'
                end
          end
        ),

        coalesce(
          other_visibility.visibility,

          case
            when
              relationship.requester_user_id =
                p_profile_user_id
              then
                case
                  when relationship.target_public
                    then 'public'
                  else 'private'
                end
            else
                case
                  when relationship.requester_public
                    then 'public'
                  else 'private'
                end
          end
        )
      ),

      v_viewer_user_id
    );

  return jsonb_build_object(
    'children',
      v_children,

    'relationships',
      v_relationships
  );
end;
$$;

create or replace function
  public.get_my_profile_connections_family_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_connection_visibility jsonb;
  v_family jsonb;
  v_family_visibility jsonb;
begin
  if
    v_user_id is null
  then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    jsonb_build_object(
      'followers_count_visibility',
        coalesce(
          settings.followers_count_visibility,
          'public'
        ),

      'following_count_visibility',
        coalesce(
          settings.following_count_visibility,
          'public'
        ),

      'friends_count_visibility',
        coalesce(
          settings.friends_count_visibility,
          'public'
        ),

      'mutual_friends_visibility',
        coalesce(
          settings.mutual_friends_visibility,
          'public'
        )
    )
  into
    v_connection_visibility
  from (
    select 1
  ) seed
  left join public.profile_connection_visibility settings
    on settings.user_id =
      v_user_id;

  select
    jsonb_build_object(
      'children',
        coalesce(
          (
            select
              jsonb_agg(
                jsonb_build_object(
                  'guardian_link_id',
                    guardian.id,

                  'child_user_id',
                    child_profile.id,

                  'full_name',
                    child_profile.full_name,

                  'username',
                    child_profile.username,

                  'avatar_url',
                    child_profile.avatar_url,

                  'relationship',
                    guardian.relationship,

                  'guardian_role',
                    guardian.guardian_role
                )
                order by
                  child_profile.full_name nulls last,
                  child_profile.username
              )
            from public.profile_guardians guardian
            join public.profiles child_profile
              on child_profile.id =
                guardian.child_user_id
            where
              guardian.guardian_user_id =
                v_user_id

              and guardian.status =
                'accepted'

              and public.is_managed_minor_user(
                guardian.child_user_id
              )
          ),
          '[]'::jsonb
        ),

      'relationships',
        coalesce(
          (
            select
              jsonb_agg(
                jsonb_build_object(
                  'relationship_id',
                    relationship.id,

                  'relationship_type',
                    relationship.relationship_type,

                  'other_user_id',
                    other_profile.id,

                  'other_full_name',
                    other_profile.full_name,

                  'other_username',
                    other_profile.username,

                  'other_avatar_url',
                    other_profile.avatar_url
                )
                order by
                  relationship.responded_at desc nulls last,
                  relationship.created_at desc
              )
            from public.profile_relationships relationship
            join public.profiles other_profile
              on other_profile.id =
                case
                  when
                    relationship.requester_user_id =
                      v_user_id
                    then
                      relationship.target_user_id
                  else
                      relationship.requester_user_id
                end
            where
              relationship.status =
                'accepted'

              and (
                relationship.requester_user_id =
                  v_user_id

                or relationship.target_user_id =
                  v_user_id
              )
          ),
          '[]'::jsonb
        )
    )
  into
    v_family;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'family_key',
            family_choice.family_key,

          'visibility',
            family_choice.visibility
        )
        order by
          family_choice.family_key
      ),
      '[]'::jsonb
    )
  into
    v_family_visibility
  from (
    select
      'child:' ||
        guardian.child_user_id::text
        as family_key,

      coalesce(
        visibility.visibility,

        case
          when
            guardian.show_child_on_profile
            then 'public'
          else 'private'
        end
      ) as visibility
    from public.profile_guardians guardian
    left join public.profile_family_visibility visibility
      on visibility.owner_user_id =
        guardian.guardian_user_id

      and visibility.family_key =
        'child:' ||
          guardian.child_user_id::text
    where
      guardian.guardian_user_id =
        v_user_id

      and guardian.status =
        'accepted'

      and public.is_managed_minor_user(
        guardian.child_user_id
      )

    union all

    select
      'relationship:' ||
        relationship.id::text
        as family_key,

      coalesce(
        visibility.visibility,

        case
          when
            relationship.requester_user_id =
              v_user_id
            then
              case
                when relationship.requester_public
                  then 'public'
                else 'private'
              end
          else
              case
                when relationship.target_public
                  then 'public'
                else 'private'
              end
        end
      ) as visibility
    from public.profile_relationships relationship
    left join public.profile_family_visibility visibility
      on visibility.owner_user_id =
        v_user_id

      and visibility.family_key =
        'relationship:' ||
          relationship.id::text
    where
      relationship.status =
        'accepted'

      and (
        relationship.requester_user_id =
          v_user_id

        or relationship.target_user_id =
          v_user_id
      )
  ) family_choice;

  return jsonb_build_object(
    'connection_visibility',
      v_connection_visibility,

    'family',
      v_family,

    'family_visibility',
      v_family_visibility
  );
end;
$$;

create or replace function
  public.save_my_profile_connections_family(
    p_settings jsonb,
    p_items jsonb
  )
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_followers text;
  v_following text;
  v_friends text;
  v_mutual text;

  v_allowed_keys text[] :=
    array[]::text[];

  v_submitted_keys text[] :=
    array[]::text[];

  v_item jsonb;
  v_key text;
  v_visibility text;
  v_entity_id uuid;
begin
  if
    v_user_id is null
  then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if
    p_settings is null
    or jsonb_typeof(
      p_settings
    ) <> 'object'
  then
    raise exception
      'Connection visibility payload must be an object.'
      using errcode = '22023';
  end if;

  if
    p_items is null
    or jsonb_typeof(
      p_items
    ) <> 'array'
  then
    raise exception
      'Family visibility payload must be an array.'
      using errcode = '22023';
  end if;

  v_followers :=
    coalesce(
      nullif(
        btrim(
          p_settings ->>
            'followers_count_visibility'
        ),
        ''
      ),
      'public'
    );

  v_following :=
    coalesce(
      nullif(
        btrim(
          p_settings ->>
            'following_count_visibility'
        ),
        ''
      ),
      'public'
    );

  v_friends :=
    coalesce(
      nullif(
        btrim(
          p_settings ->>
            'friends_count_visibility'
        ),
        ''
      ),
      'public'
    );

  v_mutual :=
    coalesce(
      nullif(
        btrim(
          p_settings ->>
            'mutual_friends_visibility'
        ),
        ''
      ),
      'public'
    );

  if
    v_followers not in (
      'public',
      'friends',
      'private'
    )

    or v_following not in (
      'public',
      'friends',
      'private'
    )

    or v_friends not in (
      'public',
      'friends',
      'private'
    )

    or v_mutual not in (
      'public',
      'friends',
      'private'
    )
  then
    raise exception
      'Invalid profile visibility.'
      using errcode = '22023';
  end if;

  insert into public.profile_connection_visibility (
    user_id,
    followers_count_visibility,
    following_count_visibility,
    friends_count_visibility,
    mutual_friends_visibility,
    updated_at
  )
  values (
    v_user_id,
    v_followers,
    v_following,
    v_friends,
    v_mutual,
    now()
  )
  on conflict (
    user_id
  )
  do update
  set
    followers_count_visibility =
      excluded.followers_count_visibility,

    following_count_visibility =
      excluded.following_count_visibility,

    friends_count_visibility =
      excluded.friends_count_visibility,

    mutual_friends_visibility =
      excluded.mutual_friends_visibility,

    updated_at =
      now();

  select
    coalesce(
      array_agg(
        allowed.family_key
      ),
      array[]::text[]
    )
  into
    v_allowed_keys
  from (
    select
      'child:' ||
        guardian.child_user_id::text
        as family_key
    from public.profile_guardians guardian
    where
      guardian.guardian_user_id =
        v_user_id

      and guardian.status =
        'accepted'

      and public.is_managed_minor_user(
        guardian.child_user_id
      )

    union all

    select
      'relationship:' ||
        relationship.id::text
        as family_key
    from public.profile_relationships relationship
    where
      relationship.status =
        'accepted'

      and (
        relationship.requester_user_id =
          v_user_id

        or relationship.target_user_id =
          v_user_id
      )
  ) allowed;

  for v_item in
    select value
    from jsonb_array_elements(
      p_items
    )
  loop
    v_key :=
      nullif(
        btrim(
          v_item ->>
            'family_key'
        ),
        ''
      );

    v_visibility :=
      nullif(
        btrim(
          v_item ->>
            'visibility'
        ),
        ''
      );

    if
      v_key is null
      or not (
        v_key =
          any(
            v_allowed_keys
          )
      )
    then
      raise exception
        'Unknown family relationship.'
        using errcode = '22023';
    end if;

    if
      v_visibility not in (
        'public',
        'friends',
        'private'
      )
    then
      raise exception
        'Invalid family visibility.'
        using errcode = '22023';
    end if;

    v_submitted_keys :=
      array_append(
        v_submitted_keys,
        v_key
      );

    insert into public.profile_family_visibility (
      owner_user_id,
      family_key,
      visibility,
      updated_at
    )
    values (
      v_user_id,
      v_key,
      v_visibility,
      now()
    )
    on conflict (
      owner_user_id,
      family_key
    )
    do update
    set
      visibility =
        excluded.visibility,

      updated_at =
        now();

    if
      v_key like
        'child:%'
    then
      v_entity_id :=
        substring(
          v_key
          from 7
        )::uuid;

      update public.profile_guardians
      set
        show_child_on_profile =
          (
            v_visibility =
              'public'
          ),

        updated_at =
          now()
      where
        guardian_user_id =
          v_user_id

        and child_user_id =
          v_entity_id

        and status =
          'accepted';

    else
      v_entity_id :=
        substring(
          v_key
          from 14
        )::uuid;

      update public.profile_relationships
      set
        requester_public =
          case
            when
              requester_user_id =
                v_user_id
              then
                v_visibility =
                  'public'
            else
                requester_public
          end,

        target_public =
          case
            when
              target_user_id =
                v_user_id
              then
                v_visibility =
                  'public'
            else
                target_public
          end,

        updated_at =
          now()
      where
        id =
          v_entity_id

        and status =
          'accepted'

        and (
          requester_user_id =
            v_user_id

          or target_user_id =
            v_user_id
        );
    end if;
  end loop;

  delete from public.profile_family_visibility visibility
  where
    visibility.owner_user_id =
      v_user_id

    and not (
      visibility.family_key =
        any(
          v_submitted_keys
        )
    );
end;
$$;

revoke all
on table
  public.profile_connection_visibility
from public, anon, authenticated;

revoke all
on table
  public.profile_family_visibility
from public, anon, authenticated;

revoke all
on function
  public.profile_visibility_allows(
    uuid,
    text,
    uuid
  )
from public, anon, authenticated;

revoke all
on function
  public.profile_most_restrictive_visibility(
    text,
    text
  )
from public, anon, authenticated;

revoke all
on function
  public.get_profile_connection_summary(
    uuid
  )
from public;

grant execute
on function
  public.get_profile_connection_summary(
    uuid
  )
to anon, authenticated;

revoke all
on function
  public.get_visible_profile_family(
    uuid
  )
from public;

grant execute
on function
  public.get_visible_profile_family(
    uuid
  )
to anon, authenticated;

revoke all
on function
  public.get_my_profile_connections_family_settings()
from public, anon;

grant execute
on function
  public.get_my_profile_connections_family_settings()
to authenticated;

revoke all
on function
  public.save_my_profile_connections_family(
    jsonb,
    jsonb
  )
from public, anon;

grant execute
on function
  public.save_my_profile_connections_family(
    jsonb,
    jsonb
  )
to authenticated;

commit;
