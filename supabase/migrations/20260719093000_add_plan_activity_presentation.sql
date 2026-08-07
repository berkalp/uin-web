begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Plan presentation and exact-location metadata.
alter table public.plans
  add column if not exists cover_url text,
  add column if not exists address_text text,
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6),
  add column if not exists map_url text,
  add column if not exists street_view_url text;

-- Retire the direct-Activity creation value while preserving the column
-- for compatibility with existing application queries.
update public.plans
set creation_mode = 'matched'
where creation_mode is distinct from 'matched';

alter table public.plans
  alter column creation_mode set default 'matched';

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select constraint_row.conname
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'plans'
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%creation_mode%'
  loop
    execute format(
      'alter table public.plans drop constraint %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.plans
  add constraint plans_creation_mode_matched_check
  check (creation_mode = 'matched')
  not valid;

alter table public.plans
  validate constraint plans_creation_mode_matched_check;

alter table public.plans
  drop constraint if exists plans_cover_url_http_check,
  drop constraint if exists plans_map_url_http_check,
  drop constraint if exists plans_street_view_url_http_check,
  drop constraint if exists plans_coordinates_pair_check,
  drop constraint if exists plans_latitude_range_check,
  drop constraint if exists plans_longitude_range_check;

alter table public.plans
  add constraint plans_cover_url_http_check
  check (
    cover_url is null
    or cover_url ~* '^https?://'
  ) not valid,
  add constraint plans_map_url_http_check
  check (
    map_url is null
    or map_url ~* '^https?://'
  ) not valid,
  add constraint plans_street_view_url_http_check
  check (
    street_view_url is null
    or street_view_url ~* '^https?://'
  ) not valid,
  add constraint plans_coordinates_pair_check
  check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ) not valid,
  add constraint plans_latitude_range_check
  check (
    latitude is null
    or latitude between -90 and 90
  ) not valid,
  add constraint plans_longitude_range_check
  check (
    longitude is null
    or longitude between -180 and 180
  ) not valid;

alter table public.plans
  validate constraint plans_cover_url_http_check,
  validate constraint plans_map_url_http_check,
  validate constraint plans_street_view_url_http_check,
  validate constraint plans_coordinates_pair_check,
  validate constraint plans_latitude_range_check,
  validate constraint plans_longitude_range_check;

create or replace function public.update_plan_presentation_details(
  p_plan_id uuid,
  p_cover_url text default null,
  p_address_text text default null,
  p_map_url text default null,
  p_street_view_url text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan public.plans%rowtype;
  v_cover_url text;
  v_address_text text;
  v_map_url text;
  v_street_view_url text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception
      'Plan not found.'
      using errcode = 'P0002';
  end if;

  if v_plan.status <> 'forming' then
    raise exception
      'Presentation details can only be edited while the Plan is forming.'
      using errcode = '22023';
  end if;

  if v_plan.expired_at is not null then
    raise exception
      'This Plan has expired.'
      using errcode = '22023';
  end if;

  if v_plan.host_user_id <> v_user_id
     and not exists (
       select 1
       from public.plan_members member
       where member.plan_id = p_plan_id
         and member.user_id = v_user_id
         and member.role = 'co_host'
         and member.status = 'active'
     )
  then
    raise exception
      'Only the Primary Host or an active Co-host may edit these details.'
      using errcode = '42501';
  end if;

  v_cover_url := nullif(btrim(p_cover_url), '');
  v_address_text := nullif(btrim(p_address_text), '');
  v_map_url := nullif(btrim(p_map_url), '');
  v_street_view_url := nullif(btrim(p_street_view_url), '');

  if v_cover_url is not null
     and (
       length(v_cover_url) > 2000
       or v_cover_url !~* '^https?://'
     )
  then
    raise exception
      'Cover URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if v_address_text is not null
     and length(v_address_text) > 1000
  then
    raise exception
      'Address must be 1000 characters or fewer.'
      using errcode = '22023';
  end if;

  if v_map_url is not null
     and (
       length(v_map_url) > 2000
       or v_map_url !~* '^https?://'
     )
  then
    raise exception
      'Map URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if v_street_view_url is not null
     and (
       length(v_street_view_url) > 2000
       or v_street_view_url !~* '^https?://'
     )
  then
    raise exception
      'Street View URL must be a valid HTTP or HTTPS URL.'
      using errcode = '22023';
  end if;

  if (p_latitude is null) <> (p_longitude is null) then
    raise exception
      'Latitude and longitude must be supplied together.'
      using errcode = '22023';
  end if;

  if p_latitude is not null
     and p_latitude not between -90 and 90
  then
    raise exception
      'Latitude must be between -90 and 90.'
      using errcode = '22023';
  end if;

  if p_longitude is not null
     and p_longitude not between -180 and 180
  then
    raise exception
      'Longitude must be between -180 and 180.'
      using errcode = '22023';
  end if;

  update public.plans
  set
    cover_url = v_cover_url,
    address_text = v_address_text,
    map_url = v_map_url,
    street_view_url = v_street_view_url,
    latitude = p_latitude,
    longitude = p_longitude,
    updated_at = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'cover_url', v_cover_url,
    'address_text', v_address_text,
    'map_url', v_map_url,
    'street_view_url', v_street_view_url,
    'latitude', p_latitude,
    'longitude', p_longitude
  );
end;
$function$;

revoke all
on function public.update_plan_presentation_details(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric
)
from public;

grant execute
on function public.update_plan_presentation_details(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric
)
to authenticated;

comment on function public.update_plan_presentation_details(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric
)
is
  'Updates cover and exact-location presentation metadata for a forming Plan. Access is limited to the Primary Host and active Co-hosts.';

CREATE OR REPLACE FUNCTION public.get_activity_detail_page(p_resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_viewer_user_id uuid;
  v_plan_id uuid;
  v_intent_id uuid;
  v_owner_user_id uuid;
  v_visibility text;
  v_is_owner boolean;
  v_is_member boolean;
  v_can_view_exact_location boolean;
  v_viewer_role text;
  v_can_view boolean;
  v_can_request boolean;
  v_invitation_status text;
  v_request_status text;
  v_request_id uuid;
  v_result jsonb;
begin
  v_viewer_user_id :=
    auth.uid();


  select
    plan.id
  into
    v_plan_id
  from public.plans plan
  where
    plan.id =
      p_resource_id;


  if v_plan_id is null then
    select
      intent.id
    into
      v_intent_id
    from public.intents intent
    where
      intent.id =
        p_resource_id;

    if v_intent_id is null then
      return null;
    end if;


    select
      linked_plan.id
    into
      v_plan_id
    from public.plan_intents plan_intent

    join public.plans linked_plan
      on linked_plan.id =
        plan_intent.plan_id

    where
      plan_intent.intent_id =
        v_intent_id

      and plan_intent.status =
        'active'

    order by
      case
        when plan_intent.relationship =
          'host_source'
          then 0
        else 1
      end,

      linked_plan.created_at desc

    limit 1;
  end if;


  if v_plan_id is not null then
    select
      canonical_intent.intent_id
    into
      v_intent_id
    from (
      select
        plan_intent.intent_id
      from public.plan_intents plan_intent

      join public.intents source_intent
        on source_intent.id =
          plan_intent.intent_id

      join public.plans plan
        on plan.id =
          plan_intent.plan_id

      where
        plan_intent.plan_id =
          v_plan_id

        and plan_intent.status =
          'active'

      order by
        case
          when plan_intent.relationship =
            'host_source'
            then 0
          when source_intent.user_id =
            plan.host_user_id
            then 1
          else 2
        end,

        plan_intent.intent_id

      limit 1
    ) canonical_intent;


    select
      plan.host_user_id,
      coalesce(
        source_intent.visibility,
        plan.visibility
      )
    into
      v_owner_user_id,
      v_visibility
    from public.plans plan

    left join public.intents source_intent
      on source_intent.id =
        v_intent_id

    where
      plan.id =
        v_plan_id;


    v_is_owner :=
      v_viewer_user_id is not null

      and v_viewer_user_id =
        v_owner_user_id;


    v_is_member :=
      v_is_owner

      or (
        v_viewer_user_id is not null

        and exists (
          select 1
          from public.plan_members member
          where
            member.plan_id =
              v_plan_id

            and member.user_id =
              v_viewer_user_id

            and member.status =
              'active'
        )
      );


    v_can_view_exact_location :=
      v_is_member;


    if v_is_owner then
      v_viewer_role :=
        'host';
    elsif v_viewer_user_id is not null then
      select
        member.role
      into
        v_viewer_role
      from public.plan_members member
      where
        member.plan_id =
          v_plan_id

        and member.user_id =
          v_viewer_user_id

        and member.status =
          'active'

      limit 1;
    end if;


    v_can_view :=
      v_is_member

      or (
        v_intent_id is not null

        and public.can_user_view_intent_activity(
          v_intent_id,
          v_viewer_user_id
        )
      )

      or (
        v_intent_id is null

        and v_visibility =
          'public'
      );
  else
    select
      intent.user_id,
      intent.visibility
    into
      v_owner_user_id,
      v_visibility
    from public.intents intent
    where
      intent.id =
        v_intent_id;


    v_is_owner :=
      v_viewer_user_id is not null

      and v_viewer_user_id =
        v_owner_user_id;


    v_is_member :=
      v_is_owner

      or (
        v_viewer_user_id is not null

        and exists (
          select 1
          from public.intent_participants participant
          where
            participant.intent_id =
              v_intent_id

            and participant.user_id =
              v_viewer_user_id

            and participant.status =
              'active'
        )
      );


    v_can_view_exact_location :=
      false;


    v_viewer_role :=
      case
        when v_is_owner
          then 'host'
        when v_is_member
          then 'participant'
        else null
      end;


    v_can_view :=
      v_is_member

      or public.can_user_view_intent_activity(
        v_intent_id,
        v_viewer_user_id
      );
  end if;


  if not coalesce(
    v_can_view,
    false
  ) then
    return null;
  end if;


  if
    v_viewer_user_id is not null

    and v_intent_id is not null
  then
    v_can_request :=
      public.can_user_request_join_intent(
        v_intent_id,
        v_viewer_user_id
      );


    select
      invitation.status
    into
      v_invitation_status
    from public.intent_invitations invitation
    where
      invitation.intent_id =
        v_intent_id

      and invitation.invited_user_id =
        v_viewer_user_id

    order by
      invitation.created_at desc

    limit 1;


    select
      request.status,
      request.id
    into
      v_request_status,
      v_request_id
    from public.intent_join_requests request
    where
      request.intent_id =
        v_intent_id

      and request.requester_user_id =
        v_viewer_user_id

    order by
      request.created_at desc

    limit 1;
  else
    v_can_request :=
      false;
  end if;


  if v_plan_id is not null then
    select
      jsonb_build_object(
        'resource_type',
        'plan',

        'viewer',
        jsonb_build_object(
          'is_authenticated',
          v_viewer_user_id is not null,

          'is_owner',
          v_is_owner,

          'is_member',
          v_is_member,

          'can_view_exact_location',
          coalesce(
            v_can_view_exact_location,
            false
          ),

          'role',
          v_viewer_role,

          'can_request',
          coalesce(
            v_can_request,
            false
          ),

          'invitation_status',
          v_invitation_status,

          'join_request_status',
          v_request_status,

          'join_request_id',
          v_request_id
        ),

        'activity',
        jsonb_build_object(
          'resource_id',
          plan.id,

          'intent_id',
          source_intent.id,

          'plan_id',
          plan.id,

          'title',
          coalesce(
            nullif(
              btrim(
                plan.title
              ),
              ''
            ),
            activity.name
          ),

          'activity_name',
          activity.name,

          'category_name',
          category.name,

          'description',
          coalesce(
            nullif(
              btrim(
                source_intent.notes
              ),
              ''
            ),
            nullif(
              btrim(
                plan.notes
              ),
              ''
            )
          ),

          'status',
          plan.status,

          'visibility',
          coalesce(
            source_intent.visibility,
            plan.visibility
          ),

          'recruitment_status',
          coalesce(
            plan.recruitment_status,
            source_intent.recruitment_status
          ),

          'city',
          location.city,

          'district',
          location.district,

          'window_start',
          plan.window_start,

          'window_end',
          plan.window_end,

          'scheduled_start',
          plan.scheduled_start,

          'scheduled_end',
          plan.scheduled_end,

          'timezone',
          plan.timezone,

          'meeting_point',
          case
            when v_can_view_exact_location
              then plan.meeting_point
            else null
          end,

          'address_text',
          case
            when v_can_view_exact_location
              then plan.address_text
            else null
          end,

          'latitude',
          case
            when v_can_view_exact_location
              then plan.latitude
            else null
          end,

          'longitude',
          case
            when v_can_view_exact_location
              then plan.longitude
            else null
          end,

          'map_url',
          case
            when v_can_view_exact_location
              then plan.map_url
            else null
          end,

          'street_view_url',
          case
            when v_can_view_exact_location
              then plan.street_view_url
            else null
          end,

          'cover_url',
          plan.cover_url,

          'member_count',
          (
            select
              count(*)
            from public.plan_members member
            where
              member.plan_id =
                plan.id

              and member.status =
                'active'
          ),

          'participant_count',
          (
            select
              count(*)
            from public.plan_members member
            where
              member.plan_id =
                plan.id

              and member.status =
                'active'

              and member.user_id <>
                plan.host_user_id
          ),

          'max_participants',
          coalesce(
            plan.max_participants,
            source_intent.max_participants
          ),

          'budget',
          source_intent.budget,

          'target_budget',
          case
            when v_is_member
              then plan.target_budget
            else null
          end,

          'committed_budget',
          case
            when v_is_member then (
              select
                coalesce(
                  sum(member.budget_commitment)
                    filter (
                      where member.status = 'active'
                    ),
                  0
                )
              from public.plan_members member
              where member.plan_id = plan.id
            )
            else null
          end,

          'remaining_budget',
          case
            when v_is_member
              and plan.target_budget is not null
            then greatest(
              plan.target_budget - (
                select
                  coalesce(
                    sum(member.budget_commitment)
                      filter (
                        where member.status = 'active'
                      ),
                    0
                  )
                from public.plan_members member
                where member.plan_id = plan.id
              ),
              0
            )
            else null
          end,

          'budget_progress_percent',
          case
            when v_is_member
              and plan.target_budget is not null
              and plan.target_budget > 0
            then round(
              (
                (
                  select
                    coalesce(
                      sum(member.budget_commitment)
                        filter (
                          where member.status = 'active'
                        ),
                      0
                    )
                  from public.plan_members member
                  where member.plan_id = plan.id
                ) / plan.target_budget
              ) * 100,
              1
            )
            else null
          end,

          'completed_at',
          plan.completed_at,

          'host_user_id',
          host_profile.id,

          'host_full_name',
          host_profile.full_name,

          'host_username',
          host_profile.username,

          'host_avatar_url',
          host_profile.avatar_url,

          'viewer_attendance_status',
          (
            select
              member.attendance_status
            from public.plan_members member
            where
              member.plan_id =
                plan.id

              and member.user_id =
                v_viewer_user_id

            limit 1
          )
        )
      )
    into
      v_result
    from public.plans plan

    join public.activities activity
      on activity.id =
        plan.activity_id

    join public.activity_categories category
      on category.id =
        activity.category_id

    left join public.locations location
      on location.id =
        plan.location_id

    left join public.intents source_intent
      on source_intent.id =
        v_intent_id

    left join public.profiles host_profile
      on host_profile.id =
        plan.host_user_id

    where
      plan.id =
        v_plan_id;
  else
    select
      jsonb_build_object(
        'resource_type',
        'intent',

        'viewer',
        jsonb_build_object(
          'is_authenticated',
          v_viewer_user_id is not null,

          'is_owner',
          v_is_owner,

          'is_member',
          v_is_member,

          'can_view_exact_location',
          coalesce(
            v_can_view_exact_location,
            false
          ),

          'role',
          v_viewer_role,

          'can_request',
          coalesce(
            v_can_request,
            false
          ),

          'invitation_status',
          v_invitation_status,

          'join_request_status',
          v_request_status,

          'join_request_id',
          v_request_id
        ),

        'activity',
        jsonb_build_object(
          'resource_id',
          intent.id,

          'intent_id',
          intent.id,

          'plan_id',
          null,

          'title',
          activity.name,

          'activity_name',
          activity.name,

          'category_name',
          category.name,

          'description',
          nullif(
            btrim(
              intent.notes
            ),
            ''
          ),

          'status',
          intent.status,

          'visibility',
          intent.visibility,

          'recruitment_status',
          intent.recruitment_status,

          'city',
          location.city,

          'district',
          location.district,

          'window_start',
          intent.start_date,

          'window_end',
          intent.end_date,

          'scheduled_start',
          null,

          'scheduled_end',
          null,

          'timezone',
          'Europe/Istanbul',

          'meeting_point',
          null,

          'address_text',
          null,

          'latitude',
          null,

          'longitude',
          null,

          'map_url',
          null,

          'street_view_url',
          null,

          'cover_url',
          null,

          'member_count',
          1 + (
            select
              count(*)
            from public.intent_participants participant
            where
              participant.intent_id =
                intent.id

              and participant.status =
                'active'

              and participant.user_id <>
                intent.user_id
          ),

          'participant_count',
          (
            select
              count(*)
            from public.intent_participants participant
            where
              participant.intent_id =
                intent.id

              and participant.status =
                'active'

              and participant.user_id <>
                intent.user_id
          ),

          'max_participants',
          intent.max_participants,

          'budget',
          intent.budget,

          'target_budget',
          null,

          'committed_budget',
          null,

          'remaining_budget',
          null,

          'budget_progress_percent',
          null,

          'completed_at',
          null,

          'host_user_id',
          host_profile.id,

          'host_full_name',
          host_profile.full_name,

          'host_username',
          host_profile.username,

          'host_avatar_url',
          host_profile.avatar_url,

          'viewer_attendance_status',
          null
        )
      )
    into
      v_result
    from public.intents intent

    join public.activities activity
      on activity.id =
        intent.activity_id

    join public.activity_categories category
      on category.id =
        activity.category_id

    join public.locations location
      on location.id =
        intent.location_id

    left join public.profiles host_profile
      on host_profile.id =
        intent.user_id

    where
      intent.id =
        v_intent_id;
  end if;


  return v_result;
end;
$function$
;

comment on function public.get_activity_detail_page(uuid)
is
  'Returns visibility-safe Intent or Plan activity details. Exact meeting data and budget commitments are disclosed only to active Plan members.';

notify pgrst, 'reload schema';

commit;
