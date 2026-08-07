-- DESTRUCTIVE ROLLBACK
-- This removes every Plan Need and contribution record.

begin;

drop trigger if exists cleanup_plan_need_contributions_on_member_change
on public.plan_members;

drop function if exists public.cleanup_plan_need_contributions_for_member();

drop function if exists public.withdraw_my_plan_need_contribution(uuid);
drop function if exists public.set_my_plan_need_contribution(uuid, integer);
drop function if exists public.delete_plan_need(uuid);
drop function if exists public.update_plan_need(uuid, text, integer, text);
drop function if exists public.create_plan_need(uuid, text, integer, text);
drop function if exists public.get_plan_needs(uuid);

drop function if exists public.can_contribute_plan_needs(uuid);
drop function if exists public.lock_plan_need_member(uuid);
drop function if exists public.lock_plan_need_manager(uuid);
drop function if exists public.is_plan_needs_editable(uuid);
drop function if exists public.can_manage_plan_needs(uuid);
drop function if exists public.can_view_plan_needs(uuid);

drop trigger if exists set_plan_need_contributions_updated_at
on public.plan_need_contributions;

drop trigger if exists set_plan_needs_updated_at
on public.plan_needs;

drop function if exists public.set_plan_need_updated_at();

drop table if exists public.plan_need_contributions;
drop table if exists public.plan_needs;

-- Remove only feature-specific translation keys.
do $language_cleanup$
begin
  if to_regclass('public.translation_keys') is not null then
    delete from public.translation_keys
    where namespace = 'plan-needs';
  end if;
end;
$language_cleanup$;

commit;

notify pgrst, 'reload schema';
