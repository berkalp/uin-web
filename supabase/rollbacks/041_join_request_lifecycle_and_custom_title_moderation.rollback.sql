begin;

-- Data in reports is intentionally dropped by this rollback. The previous title
-- RPC is not recreated here because migration 029 remains the source of truth;
-- re-run 029 after rollback if an exact historical function body is required.
drop function if exists public.resolve_admin_plan_title_report(uuid, text, text);
drop function if exists public.get_admin_plan_title_reports(text, integer, integer);
drop function if exists public.get_plan_title_moderation_state(uuid[]);
drop function if exists public.report_shared_activity_title(uuid, text, text);
drop table if exists public.plan_title_reports;

alter table public.plan_private_titles
  drop constraint if exists plan_private_titles_moderation_status_check,
  drop constraint if exists plan_private_titles_held_title_length_check,
  drop column if exists moderation_status,
  drop column if exists held_title,
  drop column if exists moderation_reported_at;

commit;
