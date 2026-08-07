begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'activity-covers',
  'activity-covers',
  true,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]::text[]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit =
    excluded.file_size_limit,
  allowed_mime_types =
    excluded.allowed_mime_types;

drop policy if exists
  activity_cover_authorized_insert
on storage.objects;

drop policy if exists
  activity_cover_authorized_delete
on storage.objects;

create policy
  activity_cover_authorized_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'activity-covers'

  and (
    (
      (storage.foldername(name))[1] =
        'catalog'

      and public.is_admin()
    )

    or

    (
      (storage.foldername(name))[1] =
        'plans'

      and exists (
        select 1
        from public.plans plan
        where plan.id::text =
          (storage.foldername(name))[2]

          and (
            plan.host_user_id =
              auth.uid()

            or exists (
              select 1
              from public.plan_members member
              where member.plan_id =
                plan.id

                and member.user_id =
                  auth.uid()

                and member.status =
                  'active'

                and member.role =
                  'co_host'
            )
          )
      )
    )
  )
);

create policy
  activity_cover_authorized_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'activity-covers'

  and (
    (
      (storage.foldername(name))[1] =
        'catalog'

      and public.is_admin()
    )

    or

    (
      (storage.foldername(name))[1] =
        'plans'

      and exists (
        select 1
        from public.plans plan
        where plan.id::text =
          (storage.foldername(name))[2]

          and (
            plan.host_user_id =
              auth.uid()

            or exists (
              select 1
              from public.plan_members member
              where member.plan_id =
                plan.id

                and member.user_id =
                  auth.uid()

                and member.status =
                  'active'

                and member.role =
                  'co_host'
            )
          )
      )
    )
  )
);

commit;
