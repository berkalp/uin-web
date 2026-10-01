begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create or replace function public.get_uin_card_relations_v87(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with edges as(
    select source_target_id target_id,related_target_id,'out' direction,relation_type,sort_order,section_title
    from public.uin_card_relations_v87 where source_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
    union all
    select related_target_id target_id,source_target_id related_target_id,'in' direction,relation_type,sort_order,section_title
    from public.uin_card_relations_v87 where related_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
  )
  select jsonb_build_object(
    'target_id',e.target_id,'related_target_id',e.related_target_id,'direction',e.direction,
    'relation_type',e.relation_type,'sort_order',e.sort_order,'section_title',e.section_title,
    'title',t.title,'subtitle',profile->>'creator_name','cover_url',profile->>'cover_url',
    'catalog_item_id',profile->>'catalog_item_id',
    'content_type_id',coalesce(t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity'),
    'type_label',coalesce(ct.label,'Kayıt'),'type_icon',coalesce(ct.icon,'▦'),'base_kind',coalesce(ct.base_kind,catalog.item_kind,'activity'),
    'wanting_count',coalesce((summary->>'wanting')::integer,0),
    'done_count',coalesce((summary->>'done')::integer,0),
    'active_event_count',coalesce((summary->>'active')::integer,0),
    'average_rating',(social->>'average_rating')::numeric,
    'rating_count',coalesce((social->>'rating_count')::integer,0),
    'follower_count',coalesce((social->>'follower_count')::integer,0),
    'related_count',coalesce((social->>'related_count')::integer,0)
  )
  from edges e join public.canonical_targets t on t.id=e.related_target_id
  left join lateral(select public.get_uin_card_profile_v60(t.id) profile) p on true
  left join lateral(select item_kind from public.seed_catalog_items where canonical_target_id=t.id and status='active' order by updated_at desc limit 1) catalog on true
  left join public.uin_content_types ct on ct.id=coalesce(t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity')
  left join lateral(select value summary from public.get_uin_card_summary_v81(array[e.related_target_id]) value limit 1) sm on true
  left join lateral(select value social from public.get_uin_card_social_v87(array[e.related_target_id]) value limit 1) so on true
  where coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true'
  order by e.target_id,e.sort_order,t.title;
$$;
revoke all on function public.get_uin_card_relations_v87(uuid[]) from public;
grant execute on function public.get_uin_card_relations_v87(uuid[]) to anon,authenticated;

notify pgrst,'reload schema';
commit;
