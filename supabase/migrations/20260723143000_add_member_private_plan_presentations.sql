begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function
  public.get_my_private_plan_presentations(
    p_plan_ids uuid[]
  )
returns table (
  plan_id uuid,
  private_title text,
  plan_cover_url text,
  experience_cover_storage_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    plan.id as plan_id,
    private_title.title as private_title,
    plan.cover_url as plan_cover_url,
    cover_media.storage_path
      as experience_cover_storage_path
  from public.plans plan
  left join public.plan_private_titles private_title
    on private_title.plan_id =
      plan.id
  left join public.experiences experience
    on experience.plan_id =
      plan.id
  left join public.experience_media cover_media
    on cover_media.id =
      experience.cover_media_id
    and cover_media.media_type =
      'photo'
    and cover_media.moderation_status =
      'active'
  where
    auth.uid() is not null
    and plan.id =
      any(
        coalesce(
          p_plan_ids,
          array[]::uuid[]
        )
      )
    and (
      plan.host_user_id =
        auth.uid()
      or exists (
        select 1
        from public.plan_members member
        where
          member.plan_id =
            plan.id
          and member.user_id =
            auth.uid()
          and member.status =
            'active'
      )
    )
  order by
    plan.id;
$$;

revoke all
on function
  public.get_my_private_plan_presentations(
    uuid[]
  )
from public;

grant execute
on function
  public.get_my_private_plan_presentations(
    uuid[]
  )
to authenticated;

commit;
