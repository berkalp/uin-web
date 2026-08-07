begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

alter table public.community_suggestions
  add column if not exists activity_id uuid
    references public.activities(id)
    on delete set null;

create index if not exists
  community_suggestions_activity_status_idx
on public.community_suggestions (
  activity_id,
  status,
  created_at desc
);

insert into public.community_activity_scopes (
  community_id,
  activity_id,
  created_by_admin_id
)
select distinct
  intent.community_id,
  intent.activity_id,
  null
from public.intents intent
where
  intent.community_id is not null
  and intent.activity_id is not null
on conflict (
  community_id,
  activity_id
)
do nothing;

drop index if exists
  public.community_suggestions_user_pending_unique;

create unique index
  community_suggestions_user_pending_unique
on public.community_suggestions (
  suggested_by_user_id,
  category_id,
  coalesce(
    activity_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  normalized_name
)
where status = 'pending';


create or replace function
  public.submit_community_suggestion_for_activity(
    p_suggested_name text,
    p_description text,
    p_activity_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_category_id uuid;
  v_name text;
  v_normalized_name text;
  v_description text;
  v_existing_name text;
  v_existing_pending_id uuid;
  v_suggestion_id uuid;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'intent_creation'
  );

  select
    activity.category_id
  into
    v_category_id
  from public.activities activity
  join public.activity_categories category
    on category.id =
      activity.category_id
  where
    activity.id =
      p_activity_id
    and activity.is_active
    and category.is_active;

  if v_category_id is null then
    raise exception
      'Select an active exact Activity.'
      using errcode = '22023';
  end if;

  v_name :=
    regexp_replace(
      btrim(
        coalesce(
          p_suggested_name,
          ''
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    );

  v_normalized_name :=
    public.normalize_community_name(
      v_name
    );

  v_description :=
    nullif(
      btrim(
        coalesce(
          p_description,
          ''
        )
      ),
      ''
    );

  if char_length(v_name) not between 2 and 100 then
    raise exception
      'Community name must contain between 2 and 100 characters.'
      using errcode = '22023';
  end if;

  if
    v_description is not null
    and char_length(
      v_description
    ) > 1200
  then
    raise exception
      'Community description cannot exceed 1200 characters.'
      using errcode = '22023';
  end if;

  select
    community.name
  into
    v_existing_name
  from public.communities community
  where
    community.status =
      'active'
    and exists (
      select 1
      from public.community_activity_scopes activity_scope
      where
        activity_scope.community_id =
          community.id
        and activity_scope.activity_id =
          p_activity_id
    )
    and (
      community.normalized_name =
        v_normalized_name
      or exists (
        select 1
        from public.community_aliases alias
        where
          alias.community_id =
            community.id
          and alias.normalized_alias =
            v_normalized_name
      )
    )
  order by
    community.name
  limit 1;

  if v_existing_name is not null then
    raise exception
      'This Community already exists for the selected Activity as "%". Select it instead.',
      v_existing_name
      using errcode = '22023';
  end if;

  select
    suggestion.id
  into
    v_existing_pending_id
  from public.community_suggestions suggestion
  where
    suggestion.suggested_by_user_id =
      v_user_id
    and suggestion.activity_id =
      p_activity_id
    and suggestion.normalized_name =
      v_normalized_name
    and suggestion.status =
      'pending'
  order by
    suggestion.created_at desc
  limit 1;

  if v_existing_pending_id is not null then
    return
      v_existing_pending_id;
  end if;

  if (
    select count(*)
    from public.community_suggestions suggestion
    where
      suggestion.suggested_by_user_id =
        v_user_id
      and suggestion.status =
        'pending'
  ) >= 5 then
    raise exception
      'You can have at most 5 Community suggestions awaiting review.'
      using errcode = '22023';
  end if;

  insert into public.community_suggestions (
    suggested_name,
    normalized_name,
    description,
    category_id,
    activity_id,
    suggested_by_user_id,
    status
  )
  values (
    v_name,
    v_normalized_name,
    v_description,
    v_category_id,
    p_activity_id,
    v_user_id,
    'pending'
  )
  returning id
  into v_suggestion_id;

  return
    v_suggestion_id;
end;
$$;


create or replace function public.admin_resolve_community_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_existing_community_id uuid default null,
  p_new_name text default null,
  p_new_slug text default null,
  p_description text default null,
  p_icon_key text default 'people',
  p_icon_url text default null,
  p_accent_color text default '#4F46E5',
  p_review_note text default null,
  p_secondary_color text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_suggestion public.community_suggestions%rowtype;
  v_community public.communities%rowtype;
  v_community_id uuid;
  v_name text;
  v_slug text;
  v_description text;
  v_review_note text;
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  v_action :=
    lower(
      btrim(
        coalesce(
          p_action,
          ''
        )
      )
    );

  if v_action not in (
    'approve_new',
    'merge_existing',
    'reject'
  ) then
    raise exception
      'Unsupported Community suggestion action.'
      using errcode = '22023';
  end if;

  select *
  into v_suggestion
  from public.community_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      'Community suggestion not found.'
      using errcode = 'P0002';
  end if;

  if v_suggestion.status <> 'pending' then
    raise exception
      'This Community suggestion has already been reviewed.'
      using errcode = '22023';
  end if;

  v_review_note :=
    nullif(
      btrim(
        coalesce(
          p_review_note,
          ''
        )
      ),
      ''
    );

  if v_action = 'merge_existing' then
    select community.*
    into v_community
    from public.communities community
    where community.id = p_existing_community_id
      and community.status <> 'archived';

    if not found then
      raise exception
        'Select an active or inactive Community to merge into.'
        using errcode = '22023';
    end if;

    v_community_id := v_community.id;

    if v_community.scope_type = 'restricted' then
      if v_suggestion.activity_id is not null then
        insert into public.community_activity_scopes (
          community_id,
          activity_id,
          created_by_admin_id
        )
        values (
          v_community.id,
          v_suggestion.activity_id,
          auth.uid()
        )
        on conflict (
          community_id,
          activity_id
        )
        do nothing;

        update public.communities
        set
          category_id = coalesce(
            category_id,
            v_suggestion.category_id
          ),
          updated_by_admin_id = auth.uid(),
          updated_at = now()
        where id = v_community.id;
      elsif not public.community_applies_to_category(
        v_community.id,
        v_suggestion.category_id
      ) then
        insert into public.community_category_scopes (
          community_id,
          category_id,
          created_by_admin_id
        )
        values (
          v_community.id,
          v_suggestion.category_id,
          auth.uid()
        )
        on conflict (
          community_id,
          category_id
        )
        do nothing;

        update public.communities
        set
          category_id = coalesce(
            category_id,
            v_suggestion.category_id
          ),
          updated_by_admin_id = auth.uid(),
          updated_at = now()
        where id = v_community.id;
      end if;
    end if;

    insert into public.community_aliases (
      community_id,
      alias,
      normalized_alias,
      created_by_admin_id
    )
    values (
      v_community_id,
      v_suggestion.suggested_name,
      v_suggestion.normalized_name,
      auth.uid()
    )
    on conflict (
      normalized_alias
    )
    do nothing;

    update public.community_suggestions
    set
      status = 'merged_existing',
      linked_community_id = v_community_id,
      reviewed_by_admin_id = auth.uid(),
      review_note = v_review_note,
      reviewed_at = now(),
      updated_at = now()
    where id = p_suggestion_id;

    return v_community_id;
  end if;

  if v_action = 'approve_new' then
    v_name :=
      coalesce(
        nullif(
          btrim(
            coalesce(
              p_new_name,
              ''
            )
          ),
          ''
        ),
        v_suggestion.suggested_name
      );

    v_slug :=
      lower(
        btrim(
          coalesce(
            p_new_slug,
            ''
          )
        )
      );

    v_description :=
      coalesce(
        nullif(
          btrim(
            coalesce(
              p_description,
              ''
            )
          ),
          ''
        ),
        v_suggestion.description
      );

    if v_slug = '' then
      raise exception
        'A slug is required for the approved Community.'
        using errcode = '22023';
    end if;

    if v_suggestion.activity_id is not null then
      v_community_id :=
        public.admin_create_community(
          v_name,
          v_slug,
          v_description,
          p_icon_key,
          p_icon_url,
          p_accent_color,
          'restricted',
          array[]::uuid[],
          array[
            v_suggestion.activity_id
          ]::uuid[],
          p_secondary_color
        );
    else
      v_community_id :=
        public.admin_create_community(
          v_name,
          v_slug,
          v_description,
          p_icon_key,
          p_icon_url,
          p_accent_color,
          'restricted',
          array[
            v_suggestion.category_id
          ]::uuid[],
          array[]::uuid[],
          p_secondary_color
        );
    end if;

    if public.normalize_community_name(
      v_name
    ) <> v_suggestion.normalized_name
    then
      insert into public.community_aliases (
        community_id,
        alias,
        normalized_alias,
        created_by_admin_id
      )
      values (
        v_community_id,
        v_suggestion.suggested_name,
        v_suggestion.normalized_name,
        auth.uid()
      )
      on conflict (
        normalized_alias
      )
      do nothing;
    end if;

    update public.community_suggestions
    set
      status = 'approved_new',
      linked_community_id = v_community_id,
      reviewed_by_admin_id = auth.uid(),
      review_note = v_review_note,
      reviewed_at = now(),
      updated_at = now()
    where id = p_suggestion_id;

    return v_community_id;
  end if;

  update public.community_suggestions
  set
    status = 'rejected',
    linked_community_id = null,
    reviewed_by_admin_id = auth.uid(),
    review_note = v_review_note,
    reviewed_at = now(),
    updated_at = now()
  where id = p_suggestion_id;

  return null;
end;
$$;


create or replace function public.get_admin_community_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception
      'Administrator access is required.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            category.id,
            'name',
            category.name,
            'is_active',
            category.is_active
          )
          order by category.name
        )
        from public.activity_categories category
      ),
      '[]'::jsonb
    ),

    'activities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            activity.id,
            'name',
            activity.name,
            'category_id',
            activity.category_id,
            'category_name',
            category.name,
            'is_active',
            activity.is_active
          )
          order by
            category.name,
            activity.name
        )
        from public.activities activity
        join public.activity_categories category
          on category.id = activity.category_id
      ),
      '[]'::jsonb
    ),

    'communities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            community.id,
            'name',
            community.name,
            'slug',
            community.slug,
            'description',
            community.description,
            'icon_key',
            community.icon_key,
            'icon_url',
            community.icon_url,
            'accent_color',
            community.accent_color,
            'secondary_color',
            community.secondary_color,
            'scope_type',
            community.scope_type,
            'category_id',
            community.category_id,
            'category_ids',
            coalesce(
              (
                select jsonb_agg(category_scope.category_id order by category.name)
                from public.community_category_scopes category_scope
                join public.activity_categories category
                  on category.id = category_scope.category_id
                where category_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'category_names',
            coalesce(
              (
                select jsonb_agg(category.name order by category.name)
                from public.community_category_scopes category_scope
                join public.activity_categories category
                  on category.id = category_scope.category_id
                where category_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'activity_ids',
            coalesce(
              (
                select jsonb_agg(activity_scope.activity_id order by category.name, activity.name)
                from public.community_activity_scopes activity_scope
                join public.activities activity
                  on activity.id = activity_scope.activity_id
                join public.activity_categories category
                  on category.id = activity.category_id
                where activity_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'activity_names',
            coalesce(
              (
                select jsonb_agg(activity.name order by category.name, activity.name)
                from public.community_activity_scopes activity_scope
                join public.activities activity
                  on activity.id = activity_scope.activity_id
                join public.activity_categories category
                  on category.id = activity.category_id
                where activity_scope.community_id = community.id
              ),
              '[]'::jsonb
            ),
            'scope_label',
            case
              when community.scope_type = 'global'
                then 'All Activities'
              else coalesce(
                nullif(
                  concat_ws(
                    ' · ',
                    (
                      select string_agg(category.name, ', ' order by category.name)
                      from public.community_category_scopes category_scope
                      join public.activity_categories category
                        on category.id = category_scope.category_id
                      where category_scope.community_id = community.id
                    ),
                    (
                      select string_agg(activity.name, ', ' order by category.name, activity.name)
                      from public.community_activity_scopes activity_scope
                      join public.activities activity
                        on activity.id = activity_scope.activity_id
                      join public.activity_categories category
                        on category.id = activity.category_id
                      where activity_scope.community_id = community.id
                    )
                  ),
                  ''
                ),
                'No applicability selected'
              )
            end,
            'status',
            community.status,
            'intent_count',
            (
              select count(*)
              from public.intents intent
              where intent.community_id = community.id
            ),
            'created_at',
            community.created_at,
            'updated_at',
            community.updated_at
          )
          order by
            case community.status
              when 'active' then 0
              when 'inactive' then 1
              else 2
            end,
            community.name
        )
        from public.communities community
      ),
      '[]'::jsonb
    ),

    'suggestions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            suggestion.id,
            'suggested_name',
            suggestion.suggested_name,
            'description',
            suggestion.description,
            'category_id',
            suggestion.category_id,
            'category_name',
            category.name,
            'activity_id',
            suggestion.activity_id,
            'activity_name',
            activity.name,
            'status',
            suggestion.status,
            'suggested_by_user_id',
            suggestion.suggested_by_user_id,
            'suggested_by_name',
            coalesce(
              profile.full_name,
              profile.username,
              'UIN member'
            ),
            'suggested_by_username',
            profile.username,
            'suggested_by_email',
            profile.email,
            'linked_community_id',
            suggestion.linked_community_id,
            'linked_community_name',
            linked_community.name,
            'review_note',
            suggestion.review_note,
            'created_at',
            suggestion.created_at,
            'reviewed_at',
            suggestion.reviewed_at
          )
          order by
            case suggestion.status
              when 'pending' then 0
              else 1
            end,
            suggestion.created_at desc
        )
        from public.community_suggestions suggestion
        join public.activity_categories category
          on category.id = suggestion.category_id
        left join public.activities activity
          on activity.id = suggestion.activity_id
        join public.profiles profile
          on profile.id = suggestion.suggested_by_user_id
        left join public.communities linked_community
          on linked_community.id = suggestion.linked_community_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;


revoke all
on function
  public.submit_community_suggestion_for_activity(
    text,
    text,
    uuid
  )
from public;

grant execute
on function
  public.submit_community_suggestion_for_activity(
    text,
    text,
    uuid
  )
to authenticated;

commit;
