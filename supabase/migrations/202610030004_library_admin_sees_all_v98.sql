begin;
set local lock_timeout='10s';
set local statement_timeout='120s';

do $$
declare
  definition text;
  old_filter text := 'where (coalesce((t.editorial_metadata->>''admin_hidden'')::boolean,false)=false or (exists(select 1 from public.seed_catalog_items library_item where library_item.canonical_target_id=t.id and library_item.status=''active'') and exists(select 1 from public.seeds library_seed where library_seed.canonical_target_id=t.id and library_seed.status in (''active'',''completed'')))) and (p_target_id is null or t.id=p_target_id)';
  new_filter text := 'where (public.is_admin() or coalesce((t.editorial_metadata->>''admin_hidden'')::boolean,false)=false or (exists(select 1 from public.seed_catalog_items library_item where library_item.canonical_target_id=t.id and library_item.status=''active'') and exists(select 1 from public.seeds library_seed where library_seed.canonical_target_id=t.id and library_seed.status in (''active'',''completed'')))) and (p_target_id is null or t.id=p_target_id)';
begin
  definition:=pg_get_functiondef('public.get_uin_catalogue_v64(text,integer,integer,uuid)'::regprocedure);
  if position(old_filter in definition)=0 then
    raise exception 'Catalogue visibility definition changed';
  end if;
  execute replace(definition,old_filter,new_filter);
end;
$$;

revoke all on function public.get_uin_catalogue_v64(text,integer,integer,uuid) from public;
grant execute on function public.get_uin_catalogue_v64(text,integer,integer,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
