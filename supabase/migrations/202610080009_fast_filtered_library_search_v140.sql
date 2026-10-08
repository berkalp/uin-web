begin;
set local lock_timeout='30s';
set local statement_timeout='5min';
set local search_path=public,extensions;

create index if not exists seed_catalog_items_active_creator_trgm_v140_idx
on public.seed_catalog_items using gin(normalized_creator gin_trgm_ops)
where status='active' and canonical_target_id is not null;

-- When a query was supplied the old candidate reader still returned every
-- non-place card and every country, then filtered them only after several
-- joins. Restrict candidates before the catalogue reader performs those joins.
create or replace function public.get_uin_catalogue_candidate_ids_v122(
  p_query text,p_target_id uuid
)
returns setof uuid
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $function$
declare v_query text:=public.canonical_normalize_v31(coalesce(p_query,''));
begin
  if p_target_id is not null then
    return next p_target_id;
    return;
  end if;

  if v_query<>'' then
    return query
      select distinct item.canonical_target_id
      from public.seed_catalog_items item
      where item.status='active' and item.canonical_target_id is not null
        and (
          coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
          or item.metadata->>'global_place_kind' in('country','city')
        )
        and (
          item.normalized_title like '%'||v_query||'%'
          or item.normalized_creator like '%'||v_query||'%'
          or exists(
            select 1 from public.seed_catalog_aliases alias
            where alias.catalog_item_id=item.id
              and alias.normalized_alias like '%'||v_query||'%'
          )
        );
    return;
  end if;

  return query
    select distinct item.canonical_target_id
    from public.seed_catalog_items item
    where item.status='active' and item.canonical_target_id is not null
      and coalesce(item.metadata->>'global_place_catalogue','false')<>'true'
    union
    select distinct item.canonical_target_id
    from public.seed_catalog_items item
    where item.status='active' and item.canonical_target_id is not null
      and item.metadata->>'global_place_catalogue'='true'
      and item.metadata->>'global_place_kind'='country';
end;
$function$;

revoke all on function public.get_uin_catalogue_candidate_ids_v122(text,uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
