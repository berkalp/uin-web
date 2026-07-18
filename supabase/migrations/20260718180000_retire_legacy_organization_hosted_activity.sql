-- UIN
-- Retire legacy Organization and standalone Hosted Activity subsystem
-- Generated from the audited Supabase schema on 2026-07-18.
-- Revision 2: Storage buckets are deleted separately through the Storage API.
--
-- This migration:
--   1. verifies the audited legacy row counts
--   2. archives legacy data and schema definitions as one private JSON snapshot
--   3. rewrites generic RPCs so they no longer depend on Organization tables
--   4. removes legacy notifications
--   5. removes legacy Storage policies and empty buckets
--   6. removes legacy triggers, routines, policies and tables without CASCADE
--
-- Canonical lifecycle:
--   Person → Intent → Match / Request / Invitation → Plan → Activity → Experience

begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

select pg_advisory_xact_lock(
  hashtext('uin-retire-legacy-organization-hosted-activity')
);

-- ============================================================
-- 1. PRECONDITION CHECKS
-- ============================================================

do $$
declare
  v_external_fk_count integer;
begin
  if to_regclass('public.organizations') is null
    or to_regclass('public.organization_members') is null
    or to_regclass('public.organization_invitations') is null
    or to_regclass('public.hosted_activities') is null
    or to_regclass('public.hosted_activity_participants') is null
    or to_regclass('public.hosted_activity_registrations') is null
    or to_regclass('public.hosted_activity_reports') is null
  then
    raise exception
      'Legacy schema does not match the audited state. Run the audit again before migration.'
      using errcode = 'P0001';
  end if;

  if (select count(*) from public.organizations) <> 1
    or (select count(*) from public.organization_members) <> 2
    or (select count(*) from public.organization_invitations) <> 1
    or (select count(*) from public.hosted_activities) <> 1
    or (select count(*) from public.hosted_activity_participants) <> 1
    or (select count(*) from public.hosted_activity_registrations) <> 0
    or (select count(*) from public.hosted_activity_reports) <> 0
  then
    raise exception
      'Legacy row counts changed after the audit. Run the audit again before migration.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from storage.objects storage_object
    where storage_object.bucket_id in (
      'organization-media',
      'hosted-activity-covers'
    )
  ) then
    raise exception
      'Legacy Storage buckets are no longer empty. Export their files before migration.'
      using errcode = 'P0001';
  end if;

  with legacy_tables as (
    select relation.oid
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'organizations',
        'organization_members',
        'organization_invitations',
        'hosted_activities',
        'hosted_activity_participants',
        'hosted_activity_registrations',
        'hosted_activity_reports'
      )
  )
  select count(*)
  into v_external_fk_count
  from pg_constraint constraint_record
  where constraint_record.contype = 'f'
    and constraint_record.confrelid in (
      select oid from legacy_tables
    )
    and constraint_record.conrelid not in (
      select oid from legacy_tables
    );

  if v_external_fk_count > 0 then
    raise exception
      'A non-legacy table now references a legacy table. Run the audit again before migration.'
      using errcode = 'P0001';
  end if;
end
$$;

-- ============================================================
-- 2. PRIVATE RETIREMENT SNAPSHOT
-- ============================================================

create schema if not exists uin_archive;

revoke all on schema uin_archive from public;
revoke all on schema uin_archive from anon;
revoke all on schema uin_archive from authenticated;

create table if not exists uin_archive.retirement_snapshots (
  migration_key text primary key,
  captured_at timestamp with time zone not null default now(),
  payload jsonb not null
);

revoke all on table uin_archive.retirement_snapshots from public;
revoke all on table uin_archive.retirement_snapshots from anon;
revoke all on table uin_archive.retirement_snapshots from authenticated;

insert into uin_archive.retirement_snapshots (
  migration_key,
  payload
)
select
  '20260718_retire_organization_hosted_activity',
  jsonb_build_object(
    'captured_at',
      now(),

    'organizations',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.organizations record_row
        ),
        '[]'::jsonb
      ),

    'organization_members',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.organization_members record_row
        ),
        '[]'::jsonb
      ),

    'organization_invitations',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.organization_invitations record_row
        ),
        '[]'::jsonb
      ),

    'hosted_activities',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.hosted_activities record_row
        ),
        '[]'::jsonb
      ),

    'hosted_activity_participants',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.hosted_activity_participants record_row
        ),
        '[]'::jsonb
      ),

    'hosted_activity_registrations',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.hosted_activity_registrations record_row
        ),
        '[]'::jsonb
      ),

    'hosted_activity_reports',
      coalesce(
        (
          select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
          from public.hosted_activity_reports record_row
        ),
        '[]'::jsonb
      ),

    'legacy_notifications',
      coalesce(
        (
          select jsonb_agg(to_jsonb(notification_record) order by notification_record.created_at)
          from public.notifications notification_record
          where
            coalesce(notification_record.entity_type, '') ilike any (
              array[
                '%organization%',
                '%hosted_activity%',
                '%hosted-activity%'
              ]
            )
            or coalesce(notification_record.notification_type, '') ilike any (
              array[
                '%organization%',
                '%hosted_activity%',
                '%hosted-activity%'
              ]
            )
            or coalesce(notification_record.source_key, '') ilike any (
              array[
                '%organization%',
                '%hosted_activity%',
                '%hosted-activity%'
              ]
            )
        ),
        '[]'::jsonb
      ),

    'legacy_routines',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'schema_name', namespace.nspname,
              'routine_name', procedure_record.proname,
              'arguments', pg_get_function_identity_arguments(procedure_record.oid),
              'definition', pg_get_functiondef(procedure_record.oid)
            )
            order by
              procedure_record.proname,
              pg_get_function_identity_arguments(procedure_record.oid)
          )
          from pg_proc procedure_record
          join pg_namespace namespace
            on namespace.oid = procedure_record.pronamespace
          where namespace.nspname = 'public'
            and (
              procedure_record.proname ilike '%organization%'
              or procedure_record.proname ilike '%hosted_activity%'
            )
        ),
        '[]'::jsonb
      ),

    'legacy_policies',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(policy_record)
            order by
              policy_record.schemaname,
              policy_record.tablename,
              policy_record.policyname
          )
          from pg_policies policy_record
          where
            (
              policy_record.schemaname = 'public'
              and policy_record.tablename in (
                'organizations',
                'organization_members',
                'organization_invitations',
                'hosted_activities',
                'hosted_activity_participants',
                'hosted_activity_registrations',
                'hosted_activity_reports'
              )
            )
            or (
              policy_record.schemaname = 'storage'
              and policy_record.tablename = 'objects'
              and (
                policy_record.policyname ilike '%organization%'
                or policy_record.policyname ilike '%hosted_activity%'
                or coalesce(policy_record.qual, '') ilike '%organization%'
                or coalesce(policy_record.qual, '') ilike '%hosted_activity%'
                or coalesce(policy_record.qual, '') ilike '%hosted-activity%'
                or coalesce(policy_record.with_check, '') ilike '%organization%'
                or coalesce(policy_record.with_check, '') ilike '%hosted_activity%'
                or coalesce(policy_record.with_check, '') ilike '%hosted-activity%'
              )
            )
        ),
        '[]'::jsonb
      ),

    'legacy_triggers',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'schema_name', namespace.nspname,
              'table_name', relation.relname,
              'trigger_name', trigger_record.tgname,
              'definition', pg_get_triggerdef(trigger_record.oid, true)
            )
            order by
              namespace.nspname,
              relation.relname,
              trigger_record.tgname
          )
          from pg_trigger trigger_record
          join pg_class relation
            on relation.oid = trigger_record.tgrelid
          join pg_namespace namespace
            on namespace.oid = relation.relnamespace
          where not trigger_record.tgisinternal
            and namespace.nspname = 'public'
            and relation.relname in (
              'organizations',
              'organization_members',
              'organization_invitations',
              'hosted_activities',
              'hosted_activity_participants',
              'hosted_activity_registrations',
              'hosted_activity_reports'
            )
        ),
        '[]'::jsonb
      )
  )
on conflict (migration_key) do nothing;

-- ============================================================
-- 3. REWRITE GENERIC RPCS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_profile_page(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_viewer_user_id uuid;
  v_profile_user_id uuid;
  v_is_owner boolean;
  v_is_following boolean;
  v_result jsonb;
begin
  v_viewer_user_id :=
    auth.uid();

  select
    profile.id
  into
    v_profile_user_id
  from public.profiles profile
  where
    lower(profile.username) =
      lower(
        btrim(
          p_username
        )
      )
  limit 1;

  if v_profile_user_id is null then
    return null;
  end if;

  v_is_owner :=
    v_viewer_user_id =
      v_profile_user_id;

  v_is_following :=
    v_viewer_user_id is not null
    and exists (
      select 1
      from public.profile_follows follow_record
      where
        follow_record.follower_user_id =
          v_viewer_user_id

        and follow_record.followed_user_id =
          v_profile_user_id
    );

  select
    jsonb_build_object(
      'viewer',
      jsonb_build_object(
        'is_authenticated',
        v_viewer_user_id is not null,

        'is_owner',
        v_is_owner,

        'is_following',
        v_is_following
      ),

      'profile',
      jsonb_build_object(
        'id',
        profile.id,

        'full_name',
        profile.full_name,

        'username',
        profile.username,

        'avatar_url',
        profile.avatar_url,

        'cover_url',
        profile.cover_url,

        'bio',
        profile.bio,

        'city',
        profile.city,

        'country',
        profile.country,

        'created_at',
        profile.created_at
      ),

      'summary',
      jsonb_build_object(
        'active_intents',
        (
          select
            count(*)
          from public.intents intent
          where
            intent.user_id =
              v_profile_user_id

            and intent.status =
              'active'

            and intent.recruitment_status in (
              'open',
              'full'
            )

            and intent.end_date >=
              current_date

            and intent.expired_at is null

            and intent.visibility =
              'public'

            and not exists (
              select 1
              from public.plan_intents plan_intent
              where
                plan_intent.intent_id =
                  intent.id

                and plan_intent.status =
                  'active'
            )
        ),

        'forming_activities',
        (
          select
            count(*)
          from public.plans plan
          where
            plan.host_user_id =
              v_profile_user_id

            and plan.status =
              'forming'

            and plan.visibility =
              'public'

            and plan.expired_at is null
        ),

        'upcoming_activities',
        (
          select
            count(*)
          from public.plans plan
          where
            plan.status =
              'planned'

            and plan.visibility =
              'public'

            and plan.scheduled_end >
              now()

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id

                  and member.status =
                    'active'
              )
            )
        ),

        'completed_activities',
        (
          select
            count(*)
          from public.plans plan
          where
            plan.status =
              'completed'

            and plan.visibility =
              'public'

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id
              )
            )
        ),


        'private_archive',
        case
          when v_is_owner then
            jsonb_build_object(
              'closed',
              (
                select count(*)
                from public.intents intent
                where
                  intent.user_id =
                    v_profile_user_id

                  and intent.status =
                    'active'

                  and intent.recruitment_status =
                    'closed'

                  and intent.expired_at is null
              ),

              'expired',
              (
                select count(*)
                from public.intents intent
                where
                  intent.user_id =
                    v_profile_user_id

                  and intent.expired_at is not null
              ),

              'cancelled',
              (
                select count(*)
                from public.intents intent
                where
                  intent.user_id =
                    v_profile_user_id

                  and intent.status =
                    'cancelled'
              )
            )
          else null
        end
      ),

      'active_intents',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                intent.id,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'start_date',
                intent.start_date,

                'end_date',
                intent.end_date,

                'people',
                intent.people,

                'budget',
                intent.budget,

                'recurrence',
                intent.recurrence,

                'max_participants',
                intent.max_participants,

                'recruitment_status',
                intent.recruitment_status,

                'viewer_join_request_status',
                (
                  select
                    request.status
                  from public.intent_join_requests request
                  where
                    request.intent_id =
                      intent.id

                    and request.requester_user_id =
                      v_viewer_user_id

                  order by
                    request.created_at desc

                  limit 1
                ),

                'viewer_join_request_id',
                (
                  select
                    request.id
                  from public.intent_join_requests request
                  where
                    request.intent_id =
                      intent.id

                    and request.requester_user_id =
                      v_viewer_user_id

                  order by
                    request.created_at desc

                  limit 1
                )
              )
              order by
                intent.start_date asc,
                intent.created_at desc
            )
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

          where
            intent.user_id =
              v_profile_user_id

            and intent.status =
              'active'

            and intent.recruitment_status in (
              'open',
              'full'
            )

            and intent.end_date >=
              current_date

            and intent.expired_at is null

            and intent.visibility =
              'public'

            and not exists (
              select 1
              from public.plan_intents plan_intent
              where
                plan_intent.intent_id =
                  intent.id

                and plan_intent.status =
                  'active'
            )
        ),
        '[]'::jsonb
      ),

      'forming_activities',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                plan.id,

                'title',
                plan.title,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'window_start',
                plan.window_start,

                'window_end',
                plan.window_end,

                'member_count',
                (
                  select count(*)
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.status =
                      'active'
                ),

                'recruitment_status',
                plan.recruitment_status
              )
              order by
                plan.created_at desc
            )
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

          where
            plan.host_user_id =
              v_profile_user_id

            and plan.status =
              'forming'

            and plan.visibility =
              'public'

            and plan.expired_at is null
        ),
        '[]'::jsonb
      ),

      'upcoming_activities',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                plan.id,

                'title',
                plan.title,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'scheduled_start',
                plan.scheduled_start,

                'scheduled_end',
                plan.scheduled_end,

                'timezone',
                plan.timezone,

                'meeting_point',
                plan.meeting_point,

                'member_count',
                (
                  select count(*)
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.status =
                      'active'
                ),

                'relationship',
                case
                  when plan.host_user_id =
                    v_profile_user_id
                    then 'host'
                  else (
                    select member.role
                    from public.plan_members member
                    where
                      member.plan_id =
                        plan.id

                      and member.user_id =
                        v_profile_user_id

                    limit 1
                  )
                end
              )
              order by
                plan.scheduled_start asc
            )
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

          where
            plan.status =
              'planned'

            and plan.visibility =
              'public'

            and plan.scheduled_end >
              now()

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id

                  and member.status =
                    'active'
              )
            )
        ),
        '[]'::jsonb
      ),

      'completed_activities',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                plan.id,

                'title',
                plan.title,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'scheduled_start',
                plan.scheduled_start,

                'scheduled_end',
                plan.scheduled_end,

                'timezone',
                plan.timezone,

                'member_count',
                (
                  select count(*)
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.status =
                      'active'
                ),

                'relationship',
                case
                  when plan.host_user_id =
                    v_profile_user_id
                    then 'host'
                  else (
                    select member.role
                    from public.plan_members member
                    where
                      member.plan_id =
                        plan.id

                      and member.user_id =
                        v_profile_user_id

                    limit 1
                  )
                end,

                'attendance_status',
                (
                  select member.attendance_status
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.user_id =
                      v_profile_user_id

                  limit 1
                )
              )
              order by
                plan.completed_at desc
            )
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

          where
            plan.status =
              'completed'

            and plan.visibility =
              'public'

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id
              )
            )
        ),
        '[]'::jsonb
      )
    )
  into
    v_result
  from public.profiles profile
  where
    profile.id =
      v_profile_user_id;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_page_visibility(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_viewer_user_id uuid;
  v_profile_user_id uuid;
  v_is_owner boolean;
  v_is_following boolean;
  v_friendship_id uuid;
  v_friendship_status text;
  v_friendship_direction text;
  v_result jsonb;
begin
  v_viewer_user_id :=
    auth.uid();

  select
    profile.id
  into
    v_profile_user_id
  from public.profiles profile
  where
    lower(profile.username) =
      lower(
        btrim(
          p_username
        )
      )
  limit 1;

  if v_profile_user_id is null then
    return null;
  end if;

  v_is_owner :=
    v_viewer_user_id =
      v_profile_user_id;

  v_is_following :=
    v_viewer_user_id is not null
    and exists (
      select 1
      from public.profile_follows follow_record
      where
        follow_record.follower_user_id =
          v_viewer_user_id

        and follow_record.followed_user_id =
          v_profile_user_id
    );

  if
    v_viewer_user_id is not null

    and not v_is_owner
  then
    select
      state.friendship_id,
      state.friendship_status,
      state.direction
    into
      v_friendship_id,
      v_friendship_status,
      v_friendship_direction
    from public.get_friendship_state(
      v_profile_user_id
    ) state;
  end if;

  select
    jsonb_build_object(
      'viewer',
      jsonb_build_object(
        'is_authenticated',
        v_viewer_user_id is not null,

        'is_owner',
        v_is_owner,

        'is_following',
        v_is_following,

        'friendship_id',
        v_friendship_id,

        'friendship_status',
        v_friendship_status,

        'friendship_direction',
        v_friendship_direction
      ),

      'profile',
      jsonb_build_object(
        'id',
        profile.id,

        'full_name',
        profile.full_name,

        'username',
        profile.username,

        'avatar_url',
        profile.avatar_url,

        'cover_url',
        profile.cover_url,

        'bio',
        profile.bio,

        'city',
        profile.city,

        'country',
        profile.country,

        'created_at',
        profile.created_at
      ),

      'summary',
      jsonb_build_object(
        'active_intents',
        (
          select
            count(*)
          from public.intents intent
          where
            intent.user_id =
              v_profile_user_id

            and intent.status =
              'active'

            and intent.recruitment_status in (
              'open',
              'full'
            )

            and intent.end_date >=
              current_date

            and intent.expired_at is null

            and public.can_user_view_intent_activity(
              intent.id,
              v_viewer_user_id
            )

            and not exists (
              select 1
              from public.plan_intents plan_intent
              where
                plan_intent.intent_id =
                  intent.id

                and plan_intent.status =
                  'active'
            )
        ),

        'forming_activities',
        (
          select
            count(distinct plan.id)
          from public.plans plan

          join lateral (
            select
      linked_intent.intent_id
    from public.plan_intents linked_intent

    join public.intents linked_source_intent
      on linked_source_intent.id =
        linked_intent.intent_id

    where
      linked_intent.plan_id =
        plan.id

      and linked_intent.status =
        'active'

    order by
      case
        when linked_intent.relationship =
          'host_source'
          then 0
        when linked_source_intent.user_id =
          plan.host_user_id
          then 1
        else 2
      end,

      linked_intent.intent_id

    limit 1
          ) canonical_intent
            on true

          where
            plan.status =
              'forming'

            and plan.expired_at is null

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id

                  and member.status =
                    'active'
              )
            )

            and public.can_user_view_intent_activity(
              canonical_intent.intent_id,
              v_viewer_user_id
            )
        ),

        'upcoming_activities',
        (
          select
            count(distinct plan.id)
          from public.plans plan

          left join lateral (
            select
      linked_intent.intent_id
    from public.plan_intents linked_intent

    join public.intents linked_source_intent
      on linked_source_intent.id =
        linked_intent.intent_id

    where
      linked_intent.plan_id =
        plan.id

      and linked_intent.status =
        'active'

    order by
      case
        when linked_intent.relationship =
          'host_source'
          then 0
        when linked_source_intent.user_id =
          plan.host_user_id
          then 1
        else 2
      end,

      linked_intent.intent_id

    limit 1
          ) canonical_intent
            on true

          where
            plan.status =
              'planned'

            and plan.scheduled_end >
              now()

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id

                  and member.status =
                    'active'
              )
            )

            and (
              (
                canonical_intent.intent_id is not null

                and public.can_user_view_intent_activity(
                  canonical_intent.intent_id,
                  v_viewer_user_id
                )
              )

              or (
                canonical_intent.intent_id is null

                and (
                  v_is_owner

                  or plan.visibility =
                    'public'
                )
              )
            )
        ),

        'completed_activities',
        (
          select
            count(distinct plan.id)
          from public.plans plan

          left join lateral (
            select
      linked_intent.intent_id
    from public.plan_intents linked_intent

    join public.intents linked_source_intent
      on linked_source_intent.id =
        linked_intent.intent_id

    where
      linked_intent.plan_id =
        plan.id

      and linked_intent.status =
        'active'

    order by
      case
        when linked_intent.relationship =
          'host_source'
          then 0
        when linked_source_intent.user_id =
          plan.host_user_id
          then 1
        else 2
      end,

      linked_intent.intent_id

    limit 1
          ) canonical_intent
            on true

          where
            plan.status =
              'completed'

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id
              )
            )

            and (
              v_is_owner

              or plan.visibility =
                'public'

              or (
                canonical_intent.intent_id is not null

                and public.can_user_view_intent_activity(
                  canonical_intent.intent_id,
                  v_viewer_user_id
                )
              )
            )
        ),


        'private_archive',
        case
          when v_is_owner then
            jsonb_build_object(
              'closed',
              (
                select count(*)
                from public.intents intent
                where
                  intent.user_id =
                    v_profile_user_id

                  and intent.status =
                    'active'

                  and intent.recruitment_status =
                    'closed'

                  and intent.expired_at is null
              ),

              'expired',
              (
                select count(*)
                from public.intents intent
                where
                  intent.user_id =
                    v_profile_user_id

                  and intent.expired_at is not null
              ),

              'cancelled',
              (
                select count(*)
                from public.intents intent
                where
                  intent.user_id =
                    v_profile_user_id

                  and intent.status =
                    'cancelled'
              )
            )
          else null
        end
      ),

      'active_intents',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                intent.id,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'start_date',
                intent.start_date,

                'end_date',
                intent.end_date,

                'people',
                intent.people,

                'budget',
                intent.budget,

                'recurrence',
                intent.recurrence,

                'max_participants',
                intent.max_participants,

                'recruitment_status',
                intent.recruitment_status,

                'visibility',
                intent.visibility,

                'viewer_can_request',
                public.can_user_request_join_intent(
                  intent.id,
                  v_viewer_user_id
                ),

                'viewer_join_request_status',
                (
                  select
                    request.status
                  from public.intent_join_requests request
                  where
                    request.intent_id =
                      intent.id

                    and request.requester_user_id =
                      v_viewer_user_id

                  order by
                    request.created_at desc

                  limit 1
                ),

                'viewer_join_request_id',
                (
                  select
                    request.id
                  from public.intent_join_requests request
                  where
                    request.intent_id =
                      intent.id

                    and request.requester_user_id =
                      v_viewer_user_id

                  order by
                    request.created_at desc

                  limit 1
                ),

                'viewer_invitation_status',
                (
                  select
                    invitation.status
                  from public.intent_invitations invitation
                  where
                    invitation.intent_id =
                      intent.id

                    and invitation.invited_user_id =
                      v_viewer_user_id

                  order by
                    invitation.created_at desc

                  limit 1
                )
              )
              order by
                intent.start_date asc,
                intent.created_at desc
            )
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

          where
            intent.user_id =
              v_profile_user_id

            and intent.status =
              'active'

            and intent.recruitment_status in (
              'open',
              'full'
            )

            and intent.end_date >=
              current_date

            and intent.expired_at is null

            and public.can_user_view_intent_activity(
              intent.id,
              v_viewer_user_id
            )

            and not exists (
              select 1
              from public.plan_intents plan_intent
              where
                plan_intent.intent_id =
                  intent.id

                and plan_intent.status =
                  'active'
            )
        ),
        '[]'::jsonb
      ),

      'forming_activities',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                plan.id,

                'source_intent_id',
                source_intent.id,

                'title',
                plan.title,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'window_start',
                plan.window_start,

                'window_end',
                plan.window_end,

                'member_count',
                (
                  select count(*)
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.status =
                      'active'
                ),

                'recruitment_status',
                plan.recruitment_status,

                'visibility',
                source_intent.visibility,

                'viewer_can_request',
                public.can_user_request_join_intent(
                  source_intent.id,
                  v_viewer_user_id
                ),

                'viewer_is_member',
                exists (
                  select 1
                  from public.plan_members viewer_member
                  where
                    viewer_member.plan_id =
                      plan.id

                    and viewer_member.user_id =
                      v_viewer_user_id

                    and viewer_member.status =
                      'active'
                ),

                'viewer_join_request_status',
                (
                  select
                    request.status
                  from public.intent_join_requests request
                  where
                    request.intent_id =
                      source_intent.id

                    and request.requester_user_id =
                      v_viewer_user_id

                  order by
                    request.created_at desc

                  limit 1
                ),

                'viewer_join_request_id',
                (
                  select
                    request.id
                  from public.intent_join_requests request
                  where
                    request.intent_id =
                      source_intent.id

                    and request.requester_user_id =
                      v_viewer_user_id

                  order by
                    request.created_at desc

                  limit 1
                ),

                'viewer_invitation_status',
                (
                  select
                    invitation.status
                  from public.intent_invitations invitation
                  where
                    invitation.intent_id =
                      source_intent.id

                    and invitation.invited_user_id =
                      v_viewer_user_id

                  order by
                    invitation.created_at desc

                  limit 1
                )
              )
              order by
                plan.created_at desc
            )
          from public.plans plan

          join lateral (
            select
      linked_source_intent.*
    from public.plan_intents linked_intent

    join public.intents linked_source_intent
      on linked_source_intent.id =
        linked_intent.intent_id

    where
      linked_intent.plan_id =
        plan.id

      and linked_intent.status =
        'active'

    order by
      case
        when linked_intent.relationship =
          'host_source'
          then 0
        when linked_source_intent.user_id =
          plan.host_user_id
          then 1
        else 2
      end,

      linked_intent.intent_id

    limit 1
          ) source_intent
            on true

          join public.activities activity
            on activity.id =
              plan.activity_id

          join public.activity_categories category
            on category.id =
              activity.category_id

          left join public.locations location
            on location.id =
              plan.location_id

          where
            plan.status =
              'forming'

            and plan.expired_at is null

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id

                  and member.status =
                    'active'
              )
            )

            and public.can_user_view_intent_activity(
              source_intent.id,
              v_viewer_user_id
            )
        ),
        '[]'::jsonb
      ),

      'upcoming_activities',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                plan.id,

                'title',
                plan.title,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'scheduled_start',
                plan.scheduled_start,

                'scheduled_end',
                plan.scheduled_end,

                'timezone',
                plan.timezone,

                'meeting_point',
                plan.meeting_point,

                'member_count',
                (
                  select count(*)
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.status =
                      'active'
                ),

                'relationship',
                case
                  when plan.host_user_id =
                    v_profile_user_id
                    then 'host'
                  else (
                    select member.role
                    from public.plan_members member
                    where
                      member.plan_id =
                        plan.id

                      and member.user_id =
                        v_profile_user_id

                    limit 1
                  )
                end
              )
              order by
                plan.scheduled_start asc
            )
          from public.plans plan

          left join lateral (
            select
      linked_intent.intent_id
    from public.plan_intents linked_intent

    join public.intents linked_source_intent
      on linked_source_intent.id =
        linked_intent.intent_id

    where
      linked_intent.plan_id =
        plan.id

      and linked_intent.status =
        'active'

    order by
      case
        when linked_intent.relationship =
          'host_source'
          then 0
        when linked_source_intent.user_id =
          plan.host_user_id
          then 1
        else 2
      end,

      linked_intent.intent_id

    limit 1
          ) canonical_intent
            on true

          join public.activities activity
            on activity.id =
              plan.activity_id

          join public.activity_categories category
            on category.id =
              activity.category_id

          left join public.locations location
            on location.id =
              plan.location_id

          where
            plan.status =
              'planned'

            and plan.scheduled_end >
              now()

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id

                  and member.status =
                    'active'
              )
            )

            and (
              (
                canonical_intent.intent_id is not null

                and public.can_user_view_intent_activity(
                  canonical_intent.intent_id,
                  v_viewer_user_id
                )
              )

              or (
                canonical_intent.intent_id is null

                and (
                  v_is_owner

                  or plan.visibility =
                    'public'
                )
              )
            )
        ),
        '[]'::jsonb
      ),

      'completed_activities',
      coalesce(
        (
          select
            jsonb_agg(
              jsonb_build_object(
                'id',
                plan.id,

                'title',
                plan.title,

                'activity_name',
                activity.name,

                'category_name',
                category.name,

                'city',
                location.city,

                'district',
                location.district,

                'scheduled_start',
                plan.scheduled_start,

                'scheduled_end',
                plan.scheduled_end,

                'timezone',
                plan.timezone,

                'member_count',
                (
                  select count(*)
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.status =
                      'active'
                ),

                'relationship',
                case
                  when plan.host_user_id =
                    v_profile_user_id
                    then 'host'
                  else (
                    select member.role
                    from public.plan_members member
                    where
                      member.plan_id =
                        plan.id

                      and member.user_id =
                        v_profile_user_id

                    limit 1
                  )
                end,

                'attendance_status',
                (
                  select member.attendance_status
                  from public.plan_members member
                  where
                    member.plan_id =
                      plan.id

                    and member.user_id =
                      v_profile_user_id

                  limit 1
                )
              )
              order by
                plan.completed_at desc
            )
          from public.plans plan

          left join lateral (
            select
      linked_intent.intent_id
    from public.plan_intents linked_intent

    join public.intents linked_source_intent
      on linked_source_intent.id =
        linked_intent.intent_id

    where
      linked_intent.plan_id =
        plan.id

      and linked_intent.status =
        'active'

    order by
      case
        when linked_intent.relationship =
          'host_source'
          then 0
        when linked_source_intent.user_id =
          plan.host_user_id
          then 1
        else 2
      end,

      linked_intent.intent_id

    limit 1
          ) canonical_intent
            on true

          join public.activities activity
            on activity.id =
              plan.activity_id

          join public.activity_categories category
            on category.id =
              activity.category_id

          left join public.locations location
            on location.id =
              plan.location_id

          where
            plan.status =
              'completed'

            and (
              plan.host_user_id =
                v_profile_user_id

              or exists (
                select 1
                from public.plan_members member
                where
                  member.plan_id =
                    plan.id

                  and member.user_id =
                    v_profile_user_id
              )
            )

            and (
              v_is_owner

              or plan.visibility =
                'public'

              or (
                canonical_intent.intent_id is not null

                and public.can_user_view_intent_activity(
                  canonical_intent.intent_id,
                  v_viewer_user_id
                )
              )
            )
        ),
        '[]'::jsonb
      )
    )
  into
    v_result
  from public.profiles profile
  where
    profile.id =
      v_profile_user_id;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_date_of_birth(p_date_of_birth date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_account_type text;
  v_age_state text;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_date_of_birth is null then
    raise exception
      'Date of birth is required.'
      using errcode = '22023';
  end if;

  if
    p_date_of_birth >
      current_date

    or p_date_of_birth <
      date '1900-01-01'
  then
    raise exception
      'Date of birth is not valid.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profile_age_records age_record
    where
      age_record.user_id =
        v_user_id
  ) then
    raise exception
      'Date of birth has already been recorded. Contact support to correct it.'
      using errcode = '22023';
  end if;

  v_account_type :=
    case
      when p_date_of_birth >
        (
          current_date -
          interval '18 years'
        )::date
        then 'managed_minor'
      else 'adult'
    end;

  insert into public.profile_age_records (
    user_id,
    date_of_birth,
    account_type,
    minor_status,
    recorded_at,
    updated_at
  )
  values (
    v_user_id,
    p_date_of_birth,
    v_account_type,
    case
      when v_account_type =
        'managed_minor'
        then 'active'
      else null
    end,
    now(),
    now()
  );

  if v_account_type =
    'managed_minor'
  then
    perform set_config(
      'uin.minor_safety_bypass',
      '1',
      true
    );

    delete from public.profile_follows
    where
      follower_user_id =
        v_user_id

      or followed_user_id =
        v_user_id;

    update public.friendships
    set
      status =
        'removed',

      removed_at =
        now(),

      updated_at =
        now()

    where
      (
        requester_user_id =
          v_user_id

        or addressee_user_id =
          v_user_id
      )

      and status in (
        'pending',
        'accepted'
      );

    update public.intent_join_requests
    set
      status =
        case
          when requester_user_id =
            v_user_id
            then 'withdrawn'
          else 'declined'
        end,

      response_reason =
        'Managed minor profiles cannot use public participation requests.',

      responded_at =
        now(),

      updated_at =
        now()

    where
      (
        requester_user_id =
          v_user_id

        or receiver_user_id =
          v_user_id
      )

      and status =
        'pending';

    update public.intent_requests
    set
      status =
        'rejected',

      updated_at =
        now()

    where
      (
        requester_id =
          v_user_id

        or receiver_id =
          v_user_id
      )

      and status =
        'pending';

    update public.intent_invitations
    set
      status =
        'revoked',

      revoked_at =
        now(),

      revoked_by =
        coalesce(
          invited_by,
          v_user_id
        ),

      updated_at =
        now()

    where
      invited_user_id =
        v_user_id

      and status =
        'pending'

      and not public.is_active_guardian(
        v_user_id,
        invited_by
      );


    update public.intents
    set
      visibility =
        'private',

      recruitment_status =
        'closed',

      matching_status =
        'closed',

      updated_at =
        now()

    where
      user_id =
        v_user_id

      and status =
        'active';

    perform set_config(
      'uin.minor_safety_bypass',
      '0',
      true
    );
  end if;

  v_age_state :=
    public.get_profile_age_state(
      v_user_id
    );

  return v_age_state;
end;
$function$;

-- ============================================================
-- 4. REMOVE LEGACY NOTIFICATIONS
-- ============================================================

delete from public.notifications notification_record
where
  coalesce(notification_record.entity_type, '') ilike any (
    array[
      '%organization%',
      '%hosted_activity%',
      '%hosted-activity%'
    ]
  )
  or coalesce(notification_record.notification_type, '') ilike any (
    array[
      '%organization%',
      '%hosted_activity%',
      '%hosted-activity%'
    ]
  )
  or coalesce(notification_record.source_key, '') ilike any (
    array[
      '%organization%',
      '%hosted_activity%',
      '%hosted-activity%'
    ]
  );

-- ============================================================
-- 5. REMOVE STORAGE POLICIES
-- ============================================================

drop policy if exists hosted_activity_cover_delete
  on storage.objects;

drop policy if exists hosted_activity_cover_insert
  on storage.objects;

drop policy if exists hosted_activity_cover_update
  on storage.objects;

drop policy if exists organization_media_delete_policy
  on storage.objects;

drop policy if exists organization_media_insert_policy
  on storage.objects;

drop policy if exists organization_media_public_read_policy
  on storage.objects;

drop policy if exists organization_media_update_policy
  on storage.objects;

-- ============================================================
-- 6. REMOVE LEGACY PUBLIC POLICIES
-- ============================================================

do $$
declare
  policy_record record;
begin
  for policy_record in
    select
      policy.schemaname,
      policy.tablename,
      policy.policyname
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'organizations',
        'organization_members',
        'organization_invitations',
        'hosted_activities',
        'hosted_activity_participants',
        'hosted_activity_registrations',
        'hosted_activity_reports'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

-- ============================================================
-- 7. REMOVE LEGACY TRIGGERS
-- ============================================================

do $$
declare
  trigger_record record;
begin
  for trigger_record in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      trigger_definition.tgname as trigger_name
    from pg_trigger trigger_definition
    join pg_class relation
      on relation.oid = trigger_definition.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where not trigger_definition.tgisinternal
      and namespace.nspname = 'public'
      and relation.relname in (
        'organizations',
        'organization_members',
        'organization_invitations',
        'hosted_activities',
        'hosted_activity_participants',
        'hosted_activity_registrations',
        'hosted_activity_reports'
      )
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_record.trigger_name,
      trigger_record.schema_name,
      trigger_record.table_name
    );
  end loop;
end
$$;

-- ============================================================
-- 8. REMOVE LEGACY ROUTINES WITHOUT CASCADE
-- ============================================================

do $$
declare
  routine_record record;
  v_remaining integer;
  v_dropped_this_pass integer;
  v_pass integer := 0;
  v_remaining_names text;
begin
  loop
    v_pass := v_pass + 1;
    v_dropped_this_pass := 0;

    for routine_record in
      select
        namespace.nspname as schema_name,
        procedure_record.proname as routine_name,
        pg_get_function_identity_arguments(procedure_record.oid) as arguments
      from pg_proc procedure_record
      join pg_namespace namespace
        on namespace.oid = procedure_record.pronamespace
      where namespace.nspname = 'public'
        and (
          procedure_record.proname ilike '%organization%'
          or procedure_record.proname ilike '%hosted_activity%'
        )
      order by
        procedure_record.proname,
        pg_get_function_identity_arguments(procedure_record.oid)
    loop
      begin
        execute format(
          'drop routine if exists %I.%I(%s)',
          routine_record.schema_name,
          routine_record.routine_name,
          routine_record.arguments
        );

        v_dropped_this_pass :=
          v_dropped_this_pass + 1;
      exception
        when dependent_objects_still_exist then
          null;
      end;
    end loop;

    select count(*)
    into v_remaining
    from pg_proc procedure_record
    join pg_namespace namespace
      on namespace.oid = procedure_record.pronamespace
    where namespace.nspname = 'public'
      and (
        procedure_record.proname ilike '%organization%'
        or procedure_record.proname ilike '%hosted_activity%'
      );

    exit when v_remaining = 0;

    if v_dropped_this_pass = 0 or v_pass >= 10 then
      select string_agg(
        format(
          '%I.%I(%s)',
          namespace.nspname,
          procedure_record.proname,
          pg_get_function_identity_arguments(procedure_record.oid)
        ),
        ', '
        order by
          procedure_record.proname,
          pg_get_function_identity_arguments(procedure_record.oid)
      )
      into v_remaining_names
      from pg_proc procedure_record
      join pg_namespace namespace
        on namespace.oid = procedure_record.pronamespace
      where namespace.nspname = 'public'
        and (
          procedure_record.proname ilike '%organization%'
          or procedure_record.proname ilike '%hosted_activity%'
        );

      raise exception
        'Legacy routines still have external dependencies: %',
        v_remaining_names
        using errcode = 'P0001';
    end if;
  end loop;
end
$$;

-- ============================================================
-- 9. REMOVE LEGACY TABLES IN DEPENDENCY ORDER
-- ============================================================

drop table if exists public.hosted_activity_reports;
drop table if exists public.hosted_activity_participants;
drop table if exists public.hosted_activity_registrations;
drop table if exists public.organization_invitations;
drop table if exists public.hosted_activities;
drop table if exists public.organization_members;
drop table if exists public.organizations;

-- ============================================================
-- 10. KEEP EMPTY STORAGE BUCKETS FOR STORAGE API DELETION
-- ============================================================
--
-- Supabase treats storage.buckets and storage.objects as read-only
-- from SQL for destructive operations. The two audited buckets are
-- empty. Their policies are removed above; delete the buckets later
-- through the Supabase Storage Dashboard or Storage API.

-- ============================================================
-- 11. FINAL VERIFICATION
-- ============================================================

do $$
declare
  v_legacy_objects text;
begin
  if to_regclass('public.organizations') is not null
    or to_regclass('public.organization_members') is not null
    or to_regclass('public.organization_invitations') is not null
    or to_regclass('public.hosted_activities') is not null
    or to_regclass('public.hosted_activity_participants') is not null
    or to_regclass('public.hosted_activity_registrations') is not null
    or to_regclass('public.hosted_activity_reports') is not null
  then
    raise exception
      'One or more legacy tables still exist.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_proc procedure_record
    join pg_namespace namespace
      on namespace.oid = procedure_record.pronamespace
    where namespace.nspname = 'public'
      and (
        procedure_record.proname ilike '%organization%'
        or procedure_record.proname ilike '%hosted_activity%'
      )
  ) then
    select string_agg(
      procedure_record.proname,
      ', '
      order by procedure_record.proname
    )
    into v_legacy_objects
    from pg_proc procedure_record
    join pg_namespace namespace
      on namespace.oid = procedure_record.pronamespace
    where namespace.nspname = 'public'
      and (
        procedure_record.proname ilike '%organization%'
        or procedure_record.proname ilike '%hosted_activity%'
      );

    raise exception
      'Legacy routines still exist: %',
      v_legacy_objects
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where
      (
        policy.schemaname = 'public'
        and policy.tablename in (
          'organizations',
          'organization_members',
          'organization_invitations',
          'hosted_activities',
          'hosted_activity_participants',
          'hosted_activity_registrations',
          'hosted_activity_reports'
        )
      )
      or (
        policy.schemaname = 'storage'
        and policy.tablename = 'objects'
        and (
          policy.policyname ilike '%organization%'
          or policy.policyname ilike '%hosted_activity%'
          or coalesce(policy.qual, '') ilike '%organization%'
          or coalesce(policy.qual, '') ilike '%hosted_activity%'
          or coalesce(policy.qual, '') ilike '%hosted-activity%'
          or coalesce(policy.with_check, '') ilike '%organization%'
          or coalesce(policy.with_check, '') ilike '%hosted_activity%'
          or coalesce(policy.with_check, '') ilike '%hosted-activity%'
        )
      )
  ) then
    raise exception
      'One or more legacy policies still exist.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from storage.objects storage_object
    where storage_object.bucket_id in (
      'organization-media',
      'hosted-activity-covers'
    )
  ) then
    raise exception
      'A legacy Storage bucket gained objects during migration.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_proc procedure_record
    join pg_namespace namespace
      on namespace.oid = procedure_record.pronamespace
    where namespace.nspname = 'public'
      and procedure_record.proname in (
        'get_public_profile_page',
        'get_public_profile_page_visibility',
        'set_my_date_of_birth'
      )
      and pg_get_functiondef(procedure_record.oid) ilike '%organization%'
  ) then
    raise exception
      'A rewritten generic RPC still contains a legacy Organization dependency.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.notifications notification_record
    where
      coalesce(notification_record.entity_type, '') ilike any (
        array[
          '%organization%',
          '%hosted_activity%',
          '%hosted-activity%'
        ]
      )
      or coalesce(notification_record.notification_type, '') ilike any (
        array[
          '%organization%',
          '%hosted_activity%',
          '%hosted-activity%'
        ]
      )
      or coalesce(notification_record.source_key, '') ilike any (
        array[
          '%organization%',
          '%hosted_activity%',
          '%hosted-activity%'
        ]
      )
  ) then
    raise exception
      'Legacy notifications still exist.'
      using errcode = 'P0001';
  end if;
end
$$;

commit;
