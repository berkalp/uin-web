-- Anonymous clients have no personal/friend scope; do not call authenticated helpers.
create or replace function public.get_uin_latest_placements_v187(
 p_before_time timestamptz default null,p_before_id uuid default null,p_audience text default 'everyone'
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select case when p_audience not in ('everyone','friends','me')
   or (p_audience<>'everyone' and (select auth.uid()) is null) then '[]'::jsonb
 else uin_private.latest_library_placements_v187(p_before_time,p_before_id,p_audience) end;
$$;
