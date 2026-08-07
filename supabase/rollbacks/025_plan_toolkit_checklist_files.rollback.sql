begin;

drop policy if exists "Plan toolkit file owners can remove objects" on storage.objects;
drop policy if exists "Visible Plan toolkit files can be read" on storage.objects;
drop policy if exists "Plan members can upload toolkit files" on storage.objects;

delete from storage.objects where bucket_id = 'plan-files';
delete from storage.buckets where id = 'plan-files';

drop function if exists public.delete_plan_toolkit_file_v1(uuid);
drop function if exists public.create_plan_toolkit_link_v1(uuid, text, text, text, text, text, boolean, uuid, uuid[]);
drop function if exists public.register_plan_toolkit_file_v1(uuid, text, text, text, bigint, text, text, text, boolean, uuid, uuid[]);
drop function if exists public.get_plan_toolkit_files_v1(uuid);
drop function if exists public.review_plan_toolkit_task_v1(uuid, boolean);
drop function if exists public.set_plan_toolkit_task_status_v1(uuid, text);
drop function if exists public.unclaim_plan_toolkit_task_v1(uuid);
drop function if exists public.claim_plan_toolkit_task_v1(uuid);
drop function if exists public.delete_plan_toolkit_task_v1(uuid);
drop function if exists public.update_plan_toolkit_task_v1(uuid, text, text, text, timestamptz, boolean, boolean, uuid[]);
drop function if exists public.create_plan_toolkit_task_v1(uuid, text, text, text, timestamptz, boolean, boolean, uuid[]);
drop function if exists public.get_plan_toolkit_tasks_v1(uuid);
drop function if exists public.can_view_plan_toolkit_file_v1(uuid);
drop function if exists public.can_view_plan_toolkit_file_for_user_v1(uuid, uuid);
drop function if exists public.is_plan_toolkit_editable_v1(uuid);
drop function if exists public.is_plan_toolkit_manager_v1(uuid);
drop function if exists public.is_plan_toolkit_manager_for_user_v1(uuid, uuid);
drop function if exists public.is_plan_toolkit_member_v1(uuid);
drop function if exists public.is_plan_toolkit_member_for_user_v1(uuid, uuid);
drop function if exists public.set_plan_toolkit_updated_at_v1();

drop table if exists public.plan_toolkit_file_recipients cascade;
drop table if exists public.plan_toolkit_files cascade;
drop table if exists public.plan_toolkit_task_assignees cascade;
drop table if exists public.plan_toolkit_tasks cascade;

notify pgrst, 'reload schema';

commit;
