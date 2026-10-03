begin;
set local lock_timeout='10s';
set local statement_timeout='120s';

do $$
declare
  definition text;
  old_filter text := 'and (p_target_id is not null or coalesce(stats.wanting,0)>0 or coalesce(stats.completed,0)>0 or coalesce(socials.social_count,0)>0';
  new_filter text := 'and (p_target_id is not null or public.is_admin() or coalesce(stats.wanting,0)>0 or coalesce(stats.completed,0)>0 or coalesce(socials.social_count,0)>0';
begin
  definition:=pg_get_functiondef('public.get_uin_catalogue_v64(text,integer,integer,uuid)'::regprocedure);
  if position(old_filter in definition)=0 then
    raise exception 'Catalogue inclusion definition changed';
  end if;
  execute replace(definition,old_filter,new_filter);
end;
$$;

revoke all on function public.get_uin_catalogue_v64(text,integer,integer,uuid) from public;
grant execute on function public.get_uin_catalogue_v64(text,integer,integer,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
