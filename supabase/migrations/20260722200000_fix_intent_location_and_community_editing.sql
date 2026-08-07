begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function
  public.update_my_intent_with_context_and_links(
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
    p_community_id uuid,
    p_links jsonb
  )
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_previous_activity_id uuid;
  v_previous_professional_requirement text;
  v_normalized_people text;
  v_clear_professional boolean;
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
    or p_end_date < p_start_date
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

  v_normalized_people :=
    nullif(
      btrim(
        coalesce(
          p_people,
          ''
        )
      ),
      ''
    );

  if v_normalized_people is null then
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

  select
    intent.activity_id,
    coalesce(
      intent.professional_requirement,
      'none'
    )
  into
    v_previous_activity_id,
    v_previous_professional_requirement
  from public.intents intent
  where
    intent.id =
      p_intent_id
    and intent.user_id =
      v_user_id
  for update;

  if not found then
    raise exception
      'Intent not found or access denied.'
      using errcode = 'P0002';
  end if;

  v_clear_professional :=
    v_previous_activity_id is distinct from
      p_activity_id
    or v_normalized_people <>
      'professionals';

  if
    v_clear_professional
    and v_normalized_people =
      'professionals'
  then
    v_normalized_people :=
      'anyone';
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
      v_normalized_people,
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
    community_id =
      p_community_id,
    professional_requirement =
      case
        when v_clear_professional
          then 'none'
        else intent.professional_requirement
      end,
    professional_role_id =
      case
        when v_clear_professional
          then null
        else intent.professional_role_id
      end,
    professional_preference_updated_at =
      case
        when
          v_clear_professional
          and v_previous_professional_requirement <>
            'none'
          then now()
        else intent.professional_preference_updated_at
      end,
    updated_at =
      now()
  where
    intent.id =
      p_intent_id
    and intent.user_id =
      v_user_id;

  perform public.save_my_intent_links(
    p_intent_id,
    p_links
  );

  return p_intent_id;
end;
$$;

revoke all
on function
  public.update_my_intent_with_context_and_links(
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
    uuid,
    jsonb
  )
from public;

grant execute
on function
  public.update_my_intent_with_context_and_links(
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
    uuid,
    jsonb
  )
to authenticated;

commit;
