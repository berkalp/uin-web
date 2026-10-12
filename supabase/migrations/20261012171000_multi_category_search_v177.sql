begin;
create or replace function public.search_uin_category_topics_v177(p_query text,p_content_type_id text,p_limit integer default 24) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 select coalesce(jsonb_agg(to_jsonb(found)),'[]'::jsonb) from (
 select ci.id "catalogItemId",ci.canonical_target_id "canonicalTargetId",ci.canonical_title title,ci.creator_name subtitle,ci.cover_url "coverUrl",ci.status,
 ci.seed_type_id "seedTypeId",st.name "seedTypeName",st.slug "seedTypeSlug",st.icon "seedTypeIcon"
 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.active
 join public.canonical_targets c on c.id=m.target_id
 join lateral(select item.* from public.seed_catalog_items item where item.canonical_target_id=m.target_id and item.status='active' order by item.updated_at desc,item.id desc limit 1) ci on true
 join public.seed_types st on st.id=ci.seed_type_id
 where m.content_type_id=p_content_type_id and nullif(btrim(p_query),'') is not null
 and (public.is_admin() or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 and public.canonical_normalize_v31(ci.canonical_title||' '||coalesce(ci.original_title,'')||' '||coalesce(ci.creator_name,'')) like '%'||public.canonical_normalize_v31(left(p_query,240))||'%'
 order by case when public.canonical_normalize_v31(ci.canonical_title)=public.canonical_normalize_v31(p_query) then 0 else 1 end,ci.updated_at desc,ci.id desc
 limit greatest(1,least(coalesce(p_limit,24),24))
 ) found;
$fn$;
revoke all on function public.search_uin_category_topics_v177(text,text,integer) from public;
grant execute on function public.search_uin_category_topics_v177(text,text,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
