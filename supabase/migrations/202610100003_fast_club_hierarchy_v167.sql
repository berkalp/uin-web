begin;
set local lock_timeout='30s';
set local statement_timeout='10min';
set local search_path=public,extensions;

-- Club discovery previously scanned every canonical target and evaluated the
-- viewer role while filtering that full scan. A cold database cache could
-- therefore exceed the API statement timeout even though only a few dozen
-- club targets exist. Resolve the content type through an expression index and
-- evaluate the viewer role once per request.
create index if not exists canonical_targets_content_type_id_v167_idx
on public.canonical_targets ((editorial_metadata->>'content_type_id'));

analyze public.canonical_targets;

create or replace function public.get_club_hierarchy_v78()
returns table(
  target_id uuid,
  parent_target_id uuid,
  sport text,
  division text,
  league text,
  season text,
  display_name text,
  logo_url text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  with viewer as materialized (
    select public.is_admin() is_admin
  )
  select target.id,
    nullif(target.editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid,
    coalesce(target.editorial_metadata->'club_hierarchy'->>'sport',''),
    coalesce(target.editorial_metadata->'club_hierarchy'->>'division',''),
    coalesce(target.editorial_metadata->'club_hierarchy'->>'league',''),
    coalesce(target.editorial_metadata->'club_hierarchy'->>'season',''),
    coalesce(nullif(target.editorial_metadata->'club_hierarchy'->>'display_name',''),target.title),
    case when nullif(target.editorial_metadata->'club_hierarchy'->>'parent_target_id','') is not null
      then coalesce(
        nullif(target.editorial_metadata->'club_profile'->'teams'->0->>'logo_url',''),
        nullif(target.editorial_metadata->'club_profile'->>'logo_url',''),
        nullif(target.editorial_cover_url,'')
      )
      else coalesce(
        nullif(target.editorial_metadata->'club_profile'->>'logo_url',''),
        nullif(target.editorial_cover_url,'')
      )
    end
  from public.uin_content_types content_type
  join public.canonical_targets target
    on target.editorial_metadata->>'content_type_id'=content_type.id
  cross join viewer
  where content_type.base_kind='club'
    and (
      viewer.is_admin
      or coalesce(target.editorial_metadata->>'admin_hidden','false')<>'true'
    );
$function$;

comment on function public.get_club_hierarchy_v78() is
  'Visible club hierarchy using the content-type index and a single viewer-role evaluation.';

revoke all on function public.get_club_hierarchy_v78() from public;
grant execute on function public.get_club_hierarchy_v78() to anon,authenticated;

notify pgrst,'reload schema';
commit;
