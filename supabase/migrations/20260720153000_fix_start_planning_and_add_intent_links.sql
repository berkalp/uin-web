begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

alter table public.plans
  alter column visibility
  set default 'private';

create table if not exists public.intent_links (
  id uuid primary key
    default gen_random_uuid(),
  intent_id uuid not null
    references public.intents(id)
    on delete cascade,
  link_type text not null,
  label text,
  url text not null,
  sort_order smallint not null
    default 0,
  created_at timestamptz not null
    default now(),
  updated_at timestamptz not null
    default now(),
  constraint intent_links_type_check
    check (
      link_type in (
        'official_event',
        'ticket',
        'organizer',
        'venue',
        'reference',
        'other'
      )
    ),
  constraint intent_links_label_length_check
    check (
      label is null
      or char_length(label) <= 80
    ),
  constraint intent_links_other_label_check
    check (
      link_type <> 'other'
      or (
        label is not null
        and btrim(label) <> ''
      )
    ),
  constraint intent_links_https_check
    check (
      url ~* '^https://[^[:space:]]+$'
    ),
  constraint intent_links_url_length_check
    check (
      char_length(url) <= 2048
    ),
  constraint intent_links_sort_order_check
    check (
      sort_order between 0 and 4
    )
);

create unique index if not exists
  intent_links_intent_sort_unique
on public.intent_links (
  intent_id,
  sort_order
);

create unique index if not exists
  intent_links_intent_url_unique
on public.intent_links (
  intent_id,
  lower(url)
);

create index if not exists
  intent_links_intent_id_idx
on public.intent_links (
  intent_id
);

create or replace function
  public.set_intent_link_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at :=
    now();

  return new;
end;
$$;

drop trigger if exists
  set_intent_link_updated_at_trigger
on public.intent_links;

create trigger
  set_intent_link_updated_at_trigger
before update
on public.intent_links
for each row
execute function
  public.set_intent_link_updated_at();

alter table public.intent_links
  enable row level security;

grant select
on public.intent_links
to anon, authenticated;

grant insert, update, delete
on public.intent_links
to authenticated;

drop policy if exists
  "Visible Intent links can be read"
on public.intent_links;

create policy
  "Visible Intent links can be read"
on public.intent_links
for select
to anon, authenticated
using (
  public.can_user_view_intent_activity(
    intent_id,
    auth.uid()
  )
);

drop policy if exists
  "Intent owners can insert links"
on public.intent_links;

create policy
  "Intent owners can insert links"
on public.intent_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.intents intent
    where
      intent.id =
        intent_links.intent_id
      and intent.user_id =
        auth.uid()
  )
);

drop policy if exists
  "Intent owners can update links"
on public.intent_links;

create policy
  "Intent owners can update links"
on public.intent_links
for update
to authenticated
using (
  exists (
    select 1
    from public.intents intent
    where
      intent.id =
        intent_links.intent_id
      and intent.user_id =
        auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.intents intent
    where
      intent.id =
        intent_links.intent_id
      and intent.user_id =
        auth.uid()
  )
);

drop policy if exists
  "Intent owners can delete links"
on public.intent_links;

create policy
  "Intent owners can delete links"
on public.intent_links
for delete
to authenticated
using (
  exists (
    select 1
    from public.intents intent
    where
      intent.id =
        intent_links.intent_id
      and intent.user_id =
        auth.uid()
  )
);

create or replace function
  public.normalize_intent_links_json(
    p_links jsonb
  )
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_item jsonb;
  v_type text;
  v_label text;
  v_url text;
  v_result jsonb :=
    '[]'::jsonb;
  v_seen_urls text[] :=
    array[]::text[];
  v_index integer :=
    0;
begin
  if p_links is null then
    return
      '[]'::jsonb;
  end if;

  if jsonb_typeof(
    p_links
  ) <> 'array' then
    raise exception
      'Related links must be a JSON array.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(
    p_links
  ) > 5 then
    raise exception
      'An Intent can have at most 5 related links.'
      using errcode = '22023';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(
      p_links
    )
  loop
    if jsonb_typeof(
      v_item
    ) <> 'object' then
      raise exception
        'Each related link must be an object.'
        using errcode = '22023';
    end if;

    v_type :=
      lower(
        btrim(
          coalesce(
            v_item ->> 'link_type',
            ''
          )
        )
      );

    v_label :=
      nullif(
        btrim(
          coalesce(
            v_item ->> 'label',
            ''
          )
        ),
        ''
      );

    v_url :=
      btrim(
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
      'other'
    ) then
      raise exception
        'Unsupported related link type.'
        using errcode = '22023';
    end if;

    if
      v_url = ''
      or v_url !~* '^https://[^[:space:]]+$'
    then
      raise exception
        'Related links must use a valid HTTPS URL.'
        using errcode = '22023';
    end if;

    if char_length(
      v_url
    ) > 2048 then
      raise exception
        'Related link URL cannot exceed 2048 characters.'
        using errcode = '22023';
    end if;

    if
      v_label is not null
      and char_length(
        v_label
      ) > 80
    then
      raise exception
        'Related link label cannot exceed 80 characters.'
        using errcode = '22023';
    end if;

    if
      v_type = 'other'
      and v_label is null
    then
      raise exception
        'A custom label is required for an Other link.'
        using errcode = '22023';
    end if;

    if lower(
      v_url
    ) = any(
      v_seen_urls
    ) then
      raise exception
        'The same related link cannot be added twice.'
        using errcode = '22023';
    end if;

    v_seen_urls :=
      array_append(
        v_seen_urls,
        lower(v_url)
      );

    v_result :=
      v_result ||
      jsonb_build_array(
        jsonb_build_object(
          'link_type',
            v_type,
          'label',
            v_label,
          'url',
            v_url,
          'sort_order',
            v_index
        )
      );

    v_index :=
      v_index + 1;
  end loop;

  return v_result;
end;
$$;

create or replace function
  public.save_my_intent_links(
    p_intent_id uuid,
    p_links jsonb
  )
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_links jsonb;
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
    'account_access'
  );

  if not exists (
    select 1
    from public.intents intent
    where
      intent.id =
        p_intent_id
      and intent.user_id =
        v_user_id
  ) then
    raise exception
      'Intent not found or access denied.'
      using errcode = 'P0002';
  end if;

  v_links :=
    public.normalize_intent_links_json(
      p_links
    );

  delete from public.intent_links
  where intent_id =
    p_intent_id;

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
    p_intent_id,
    link ->> 'link_type',
    link ->> 'label',
    link ->> 'url',
    (
      link ->> 'sort_order'
    )::smallint,
    now(),
    now()
  from jsonb_array_elements(
    v_links
  ) link;
end;
$$;

alter table public.intent_drafts
  add column if not exists
    related_links jsonb not null
    default '[]'::jsonb;

create or replace function
  public.save_my_intent_draft_links(
    p_draft_id uuid,
    p_links jsonb
  )
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  update public.intent_drafts draft
  set
    related_links =
      public.normalize_intent_links_json(
        p_links
      ),
    updated_at =
      now()
  where
    draft.id =
      p_draft_id
    and draft.user_id =
      v_user_id
    and draft.status <>
      'published';

  if not found then
    raise exception
      'Editable Intent draft not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function
  public.copy_intent_draft_links_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_links jsonb;
begin
  if
    new.published_intent_id is null
    or new.published_intent_id is not distinct from
      old.published_intent_id
  then
    return new;
  end if;

  v_links :=
    public.normalize_intent_links_json(
      new.related_links
    );

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
    new.published_intent_id,
    link ->> 'link_type',
    link ->> 'label',
    link ->> 'url',
    (
      link ->> 'sort_order'
    )::smallint,
    now(),
    now()
  from jsonb_array_elements(
    v_links
  ) link
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists
  copy_intent_draft_links_on_publish_trigger
on public.intent_drafts;

create trigger
  copy_intent_draft_links_on_publish_trigger
after update of published_intent_id
on public.intent_drafts
for each row
execute function
  public.copy_intent_draft_links_on_publish();

create or replace function
  public.submit_activity_request_draft_with_links(
    p_selected_category_id uuid,
    p_proposed_activity_name text,
    p_description text,
    p_start_date date,
    p_end_date date,
    p_people text,
    p_location_id uuid,
    p_budget integer,
    p_recurrence text,
    p_visibility text,
    p_notes text,
    p_intent_type text,
    p_max_participants integer,
    p_timing_mode text,
    p_related_links jsonb
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
begin
  v_draft_id :=
    public.submit_activity_request_draft(
      p_selected_category_id,
      p_proposed_activity_name,
      p_description,
      p_start_date,
      p_end_date,
      p_people,
      p_location_id,
      p_budget,
      p_recurrence,
      p_visibility,
      p_notes,
      p_intent_type,
      p_max_participants,
      p_timing_mode
    );

  perform public.save_my_intent_draft_links(
    v_draft_id,
    p_related_links
  );

  return v_draft_id;
end;
$$;

create or replace function
  public.create_intent_with_links(
    p_start_date date,
    p_end_date date,
    p_people text,
    p_location_id uuid,
    p_activity_id uuid,
    p_budget numeric,
    p_recurrence text,
    p_visibility text,
    p_notes text,
    p_intent_type text,
    p_max_participants integer,
    p_links jsonb
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_intent_id uuid;
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
    'account_access'
  );

  if
    p_start_date is null
    or p_end_date is null
    or p_end_date <
      p_start_date
  then
    raise exception
      'Enter a valid Intent date range.'
      using errcode = '22023';
  end if;

  if p_end_date <
    current_date
  then
    raise exception
      'The Intent date range has already ended.'
      using errcode = '22023';
  end if;

  if p_visibility not in (
    'public',
    'friends',
    'except_friends',
    'invite_only',
    'private'
  ) then
    raise exception
      'Unsupported Intent visibility.'
      using errcode = '22023';
  end if;

  if
    p_budget is not null
    and p_budget < 0
  then
    raise exception
      'Budget cannot be negative.'
      using errcode = '22023';
  end if;

  if
    p_max_participants is not null
    and p_max_participants < 1
  then
    raise exception
      'Participant capacity must be at least 1.'
      using errcode = '22023';
  end if;

  if nullif(
    btrim(
      coalesce(
        p_people,
        ''
      )
    ),
    ''
  ) is null then
    raise exception
      'Participation preference is required.'
      using errcode = '22023';
  end if;

  if nullif(
    btrim(
      coalesce(
        p_recurrence,
        ''
      )
    ),
    ''
  ) is null then
    raise exception
      'Recurrence is required.'
      using errcode = '22023';
  end if;

  if nullif(
    btrim(
      coalesce(
        p_intent_type,
        ''
      )
    ),
    ''
  ) is null then
    raise exception
      'Intent type is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.activities activity
    join public.activity_categories category
      on category.id =
        activity.category_id
    where
      activity.id =
        p_activity_id
      and activity.is_active
      and category.is_active
  ) then
    raise exception
      'The selected Activity is not available.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.locations location
    where location.id =
      p_location_id
  ) then
    raise exception
      'The selected location is not available.'
      using errcode = '22023';
  end if;

  insert into public.intents (
    user_id,
    start_date,
    end_date,
    people,
    location_id,
    activity_id,
    budget,
    recurrence,
    visibility,
    notes,
    intent_type,
    status,
    max_participants,
    recruitment_status,
    matching_status,
    timing_mode,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_start_date,
    p_end_date,
    btrim(p_people),
    p_location_id,
    p_activity_id,
    p_budget,
    btrim(p_recurrence),
    p_visibility,
    nullif(
      btrim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    ),
    btrim(p_intent_type),
    'active',
    p_max_participants,
    'open',
    'open',
    'flexible',
    now(),
    now()
  )
  returning id
  into v_intent_id;

  perform public.save_my_intent_links(
    v_intent_id,
    p_links
  );

  return v_intent_id;
end;
$$;

create or replace function
  public.update_my_intent_with_links(
    p_intent_id uuid,
    p_activity_id uuid,
    p_location_id uuid,
    p_start_date date,
    p_end_date date,
    p_people text,
    p_recurrence text,
    p_visibility text,
    p_budget numeric,
    p_max_participants integer,
    p_notes text,
    p_links jsonb
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
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
    'account_access'
  );

  if
    p_start_date is null
    or p_end_date is null
    or p_end_date <
      p_start_date
  then
    raise exception
      'Enter a valid Intent date range.'
      using errcode = '22023';
  end if;

  if p_visibility not in (
    'public',
    'friends',
    'except_friends',
    'invite_only',
    'private'
  ) then
    raise exception
      'Unsupported Intent visibility.'
      using errcode = '22023';
  end if;

  if
    p_budget is not null
    and p_budget < 0
  then
    raise exception
      'Budget cannot be negative.'
      using errcode = '22023';
  end if;

  if
    p_max_participants is not null
    and p_max_participants < 1
  then
    raise exception
      'Participant capacity must be at least 1.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.activities activity
    join public.activity_categories category
      on category.id =
        activity.category_id
    where
      activity.id =
        p_activity_id
      and activity.is_active
      and category.is_active
  ) then
    raise exception
      'The selected Activity is not available.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.locations location
    where location.id =
      p_location_id
  ) then
    raise exception
      'The selected location is not available.'
      using errcode = '22023';
  end if;

  update public.intents intent
  set
    activity_id =
      p_activity_id,
    location_id =
      p_location_id,
    start_date =
      p_start_date,
    end_date =
      p_end_date,
    people =
      btrim(p_people),
    recurrence =
      btrim(p_recurrence),
    visibility =
      p_visibility,
    budget =
      p_budget,
    max_participants =
      p_max_participants,
    notes =
      nullif(
        btrim(
          coalesce(
            p_notes,
            ''
          )
        ),
        ''
      ),
    updated_at =
      now()
  where
    intent.id =
      p_intent_id
    and intent.user_id =
      v_user_id;

  if not found then
    raise exception
      'Intent not found or access denied.'
      using errcode = 'P0002';
  end if;

  perform public.save_my_intent_links(
    p_intent_id,
    p_links
  );

  return p_intent_id;
end;
$$;

create or replace function
  public.get_visible_intent_links(
    p_intent_ids uuid[]
  )
returns table (
  intent_id uuid,
  link_id uuid,
  link_type text,
  label text,
  url text,
  sort_order smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if
    p_intent_ids is null
    or cardinality(
      p_intent_ids
    ) = 0
  then
    return;
  end if;

  if cardinality(
    p_intent_ids
  ) > 100 then
    raise exception
      'Too many Intent records requested.'
      using errcode = '22023';
  end if;

  return query
  select
    link.intent_id,
    link.id,
    link.link_type,
    link.label,
    link.url,
    link.sort_order
  from public.intent_links link
  where
    link.intent_id =
      any(
        p_intent_ids
      )
    and public.can_user_view_intent_activity(
      link.intent_id,
      auth.uid()
    )
  order by
    link.intent_id,
    link.sort_order,
    link.created_at,
    link.id;
end;
$$;

CREATE OR REPLACE FUNCTION public.start_planning_from_intent(p_intent_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intent public.intents%rowtype;
  v_activity_name text;
  v_existing_plan_id uuid;
  v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  select i.*
  into v_intent
  from public.intents i
  where i.id = p_intent_id
    and i.user_id = auth.uid()
  for update;

  if not found then
    raise exception
      'Intent not found or access denied.';
  end if;

  select a.name
  into v_activity_name
  from public.activities a
  where a.id = v_intent.activity_id;

  if v_activity_name is null then
    raise exception
      'Activity information could not be found.';
  end if;

  select pi.plan_id
  into v_existing_plan_id
  from public.plan_intents pi
  where pi.intent_id = v_intent.id
    and pi.status = 'active'
  limit 1;

  if v_existing_plan_id is not null then
    return v_existing_plan_id;
  end if;

  if v_intent.status <> 'active' then
    raise exception
      'Only active Intents can enter planning.';
  end if;

  if v_intent.matching_status = 'matched' then
    raise exception
      'This Intent is already linked to another Plan.';
  end if;

  insert into public.plans (
    host_user_id,
    title,
    creation_mode,
    recruitment_status,
    activity_id,
    location_id,
    window_start,
    window_end,
    timezone,
    budget,
    target_budget,
    max_participants,
    status,
    visibility,
    notes,
    created_at,
    updated_at
  )
  values (
    auth.uid(),
    v_activity_name,
    'matched',
    v_intent.recruitment_status,
    v_intent.activity_id,
    v_intent.location_id,
    v_intent.start_date,
    v_intent.end_date,
    'Europe/Istanbul',
    v_intent.budget,
    null,
    v_intent.max_participants,
    'forming',
    v_intent.visibility,
    v_intent.notes,
    now(),
    now()
  )
  returning id
  into v_plan_id;

  insert into public.plan_intents (
    plan_id,
    intent_id,
    relationship,
    status,
    linked_at,
    created_at,
    updated_at
  )
  values (
    v_plan_id,
    v_intent.id,
    'host_source',
    'active',
    now(),
    now(),
    now()
  );

  insert into public.plan_members (
    plan_id,
    user_id,
    role,
    status,
    budget_commitment,
    budget_updated_at,
    joined_at,
    created_at,
    updated_at
  )
  values (
    v_plan_id,
    auth.uid(),
    'host',
    'active',
    coalesce(
      v_intent.budget,
      0
    ),
    now(),
    now(),
    now(),
    now()
  );

  return v_plan_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.ensure_plan_for_accepted_request(p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_request record;
  v_plan_id uuid;
  v_existing_plan_id uuid;
begin
  select
    ir.id,
    ir.requester_id,
    ir.receiver_id,
    ir.own_intent_id,
    ir.target_intent_id,
    ir.status,
    ir.plan_id,

    target_intent.user_id as target_owner_id,
    target_intent.activity_id,
    target_intent.location_id,
    target_intent.start_date,
    target_intent.end_date,
    target_intent.budget,
    target_intent.max_participants,
    target_intent.visibility,
    target_intent.notes,

    activity.name as activity_name

  into v_request

  from public.intent_requests ir

  join public.intents target_intent
    on target_intent.id = ir.target_intent_id

  left join public.activities activity
    on activity.id = target_intent.activity_id

  where ir.id = p_request_id

  for update of ir, target_intent;

  if not found then
    raise exception 'Intent request not found.';
  end if;

  if v_request.status <> 'accepted' then
    raise exception 'Only accepted requests can create a Plan.';
  end if;

  if v_request.target_owner_id <> v_request.receiver_id then
    raise exception 'Request receiver does not own the target Intent.';
  end if;

  if v_request.plan_id is not null then
    return v_request.plan_id;
  end if;

  select
    pi.plan_id
  into v_existing_plan_id
  from public.plan_intents pi
  join public.plans p
    on p.id = pi.plan_id
  where pi.intent_id = v_request.target_intent_id
    and pi.relationship = 'host_source'
    and pi.status = 'active'
    and p.status in ('forming', 'planned')
  limit 1;

  if v_existing_plan_id is not null then
    v_plan_id := v_existing_plan_id;
  else
    insert into public.plans (
      host_user_id,
      title,
      activity_id,
      location_id,
      window_start,
      window_end,
      budget,
      max_participants,
      status,
      visibility,
      notes
    )
    values (
      v_request.receiver_id,
      coalesce(
        v_request.activity_name,
        'UIN Activity'
      ),
      v_request.activity_id,
      v_request.location_id,
      v_request.start_date,
      v_request.end_date,
      v_request.budget,
      v_request.max_participants,
      'forming',
      v_request.visibility,
      v_request.notes
    )
    returning id
    into v_plan_id;

    insert into public.plan_intents (
      plan_id,
      intent_id,
      relationship,
      status
    )
    values (
      v_plan_id,
      v_request.target_intent_id,
      'host_source',
      'active'
    );
  end if;

  insert into public.plan_members (
    plan_id,
    user_id,
    role,
    status,
    joined_via_request_id
  )
  values (
    v_plan_id,
    v_request.receiver_id,
    'host',
    'active',
    null
  )
  on conflict (plan_id, user_id)
  do update
  set
    role = 'host',
    status = 'active',
    departed_at = null,
    departure_reason = null,
    actioned_by = null,
    updated_at = now();

  insert into public.plan_members (
    plan_id,
    user_id,
    role,
    status,
    joined_via_request_id
  )
  values (
    v_plan_id,
    v_request.requester_id,
    'participant',
    'active',
    v_request.id
  )
  on conflict (plan_id, user_id)
  do update
  set
    role = 'participant',
    status = 'active',
    joined_via_request_id = excluded.joined_via_request_id,
    departed_at = null,
    departure_reason = null,
    actioned_by = null,
    updated_at = now();

  select
    pi.plan_id
  into v_existing_plan_id
  from public.plan_intents pi
  where pi.intent_id = v_request.own_intent_id
    and pi.status = 'active'
  limit 1;

  if v_existing_plan_id is not null
     and v_existing_plan_id <> v_plan_id then
    raise exception
      'The requester Intent is already linked to another active Plan.';
  end if;

  if v_existing_plan_id is null then
    insert into public.plan_intents (
      plan_id,
      intent_id,
      relationship,
      status
    )
    values (
      v_plan_id,
      v_request.own_intent_id,
      'participant_source',
      'active'
    );
  end if;

  update public.intent_requests
  set
    plan_id = v_plan_id,
    updated_at = now()
  where id = v_request.id;

  update public.intents
  set
    matching_status = 'matched',
    updated_at = now()
  where id = v_request.own_intent_id;

  return v_plan_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.sync_plan_from_host_intent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan_id uuid;
begin
  select plan_id
  into v_plan_id
  from public.plan_intents
  where intent_id = new.id
    and relationship = 'host_source'
    and status = 'active'
  limit 1;

  if v_plan_id is null then
    return new;
  end if;

  update public.plans
  set
    activity_id = new.activity_id,
    location_id = new.location_id,
    window_start = new.start_date,
    window_end = new.end_date,
    budget = new.budget,
    max_participants =
      new.max_participants,
    notes = new.notes,
    visibility = new.visibility,

    status =
      case
        when new.status = 'planned'
          then 'planned'

        when new.status = 'completed'
          then 'completed'

        when new.status = 'cancelled'
          then 'cancelled'

        when new.status = 'active'
             and old.status = 'planned'
          then 'forming'

        else plans.status
      end,

    planned_at =
      case
        when new.status = 'planned'
          then coalesce(
            plans.planned_at,
            new.planned_at,
            now()
          )

        when new.status = 'active'
             and old.status = 'planned'
          then null

        else plans.planned_at
      end,

    completed_at =
      case
        when new.status = 'completed'
          then coalesce(
            plans.completed_at,
            now()
          )

        when new.status in (
          'active',
          'planned'
        )
          then null

        else plans.completed_at
      end,

    cancelled_at =
      case
        when new.status = 'cancelled'
          then coalesce(
            plans.cancelled_at,
            now()
          )

        when new.status in (
          'active',
          'planned',
          'completed'
        )
          then null

        else plans.cancelled_at
      end,

    updated_at = now()

  where id = v_plan_id;

  return new;
end;
$function$;


revoke all
on function
  public.normalize_intent_links_json(
    jsonb
  )
from public;

revoke all
on function
  public.save_my_intent_links(
    uuid,
    jsonb
  )
from public;

revoke all
on function
  public.save_my_intent_draft_links(
    uuid,
    jsonb
  )
from public;

revoke all
on function
  public.submit_activity_request_draft_with_links(
    uuid,
    text,
    text,
    date,
    date,
    text,
    uuid,
    integer,
    text,
    text,
    text,
    text,
    integer,
    text,
    jsonb
  )
from public;

revoke all
on function
  public.create_intent_with_links(
    date,
    date,
    text,
    uuid,
    uuid,
    numeric,
    text,
    text,
    text,
    text,
    integer,
    jsonb
  )
from public;

revoke all
on function
  public.update_my_intent_with_links(
    uuid,
    uuid,
    uuid,
    date,
    date,
    text,
    text,
    text,
    numeric,
    integer,
    text,
    jsonb
  )
from public;

revoke all
on function
  public.get_visible_intent_links(
    uuid[]
  )
from public;

grant execute
on function
  public.save_my_intent_links(
    uuid,
    jsonb
  )
to authenticated;

grant execute
on function
  public.save_my_intent_draft_links(
    uuid,
    jsonb
  )
to authenticated;

grant execute
on function
  public.submit_activity_request_draft_with_links(
    uuid,
    text,
    text,
    date,
    date,
    text,
    uuid,
    integer,
    text,
    text,
    text,
    text,
    integer,
    text,
    jsonb
  )
to authenticated;

grant execute
on function
  public.create_intent_with_links(
    date,
    date,
    text,
    uuid,
    uuid,
    numeric,
    text,
    text,
    text,
    text,
    integer,
    jsonb
  )
to authenticated;

grant execute
on function
  public.update_my_intent_with_links(
    uuid,
    uuid,
    uuid,
    date,
    date,
    text,
    text,
    text,
    numeric,
    integer,
    text,
    jsonb
  )
to authenticated;

grant execute
on function
  public.get_visible_intent_links(
    uuid[]
  )
to anon, authenticated;

commit;
