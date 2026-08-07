begin;

revoke all on function public.get_public_profile_page_with_participation_visibility(text)
  from anon, authenticated;
revoke all on function public.update_my_profile_with_gender_and_participation_visibility(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
) from authenticated;

drop function if exists public.update_my_profile_with_gender_and_participation_visibility(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
);
drop function if exists public.get_public_profile_page_with_participation_visibility(text);
drop function if exists public.decorate_visible_profile_activity_items(jsonb, uuid, boolean);
drop function if exists public.get_profile_plan_relationship(uuid, uuid);

alter table public.profiles
  drop constraint if exists profiles_participation_profile_visibility_check;

alter table public.profiles
  drop column if exists participation_profile_visibility;

commit;
