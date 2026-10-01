begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create table if not exists public.uin_card_relations_v87(
  source_target_id uuid not null references public.canonical_targets(id) on delete cascade,
  related_target_id uuid not null references public.canonical_targets(id) on delete cascade,
  relation_type text not null check(relation_type in ('source_material','adaptation','soundtrack','series_part','sequel','remake','spin_off','inspired_by','related')),
  sort_order integer not null default 0 check(sort_order between -10000 and 10000),
  section_title text null check(char_length(section_title)<=120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  primary key(source_target_id,related_target_id,relation_type),
  check(source_target_id<>related_target_id)
);
create index if not exists uin_card_relations_v87_related_idx on public.uin_card_relations_v87(related_target_id,sort_order,source_target_id);
alter table public.uin_card_relations_v87 enable row level security;
revoke all on table public.uin_card_relations_v87 from public,anon,authenticated;

create or replace function public.get_uin_card_social_v87(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with requested as(select distinct value target_id from unnest(coalesce(p_target_ids,array[]::uuid[])) value),
  followers as(
    select ci.canonical_target_id target_id,count(distinct pref.user_id)::integer follower_count
    from public.uin_card_notification_preferences_v31 pref
    join public.seed_catalog_items ci on ci.id=pref.catalog_item_id
    where pref.is_following and ci.canonical_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
    group by ci.canonical_target_id
  ), ratings as(
    select value from public.get_uin_card_ratings_v85(p_target_ids) value
  ), relations as(
    select target_id,count(*)::integer related_count from(
      select source_target_id target_id from public.uin_card_relations_v87 where source_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
      union all
      select related_target_id target_id from public.uin_card_relations_v87 where related_target_id=any(coalesce(p_target_ids,array[]::uuid[]))
    ) r group by target_id
  )
  select jsonb_build_object(
    'target_id',requested.target_id,
    'follower_count',coalesce(followers.follower_count,0),
    'average_rating',(ratings.value->>'average_rating')::numeric,
    'rating_count',coalesce((ratings.value->>'rating_count')::integer,0),
    'viewer_rating',(ratings.value->>'viewer_rating')::numeric,
    'related_count',coalesce(relations.related_count,0)
  )
  from requested
  left join followers using(target_id)
  left join ratings on ratings.value->>'target_id'=requested.target_id::text
  left join relations using(target_id);
$$;
revoke all on function public.get_uin_card_social_v87(uuid[]) from public;
grant execute on function public.get_uin_card_social_v87(uuid[]) to anon,authenticated;

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
    'type_label',coalesce(ct.label,'Kayıt'),'type_icon',coalesce(ct.icon,'▦'),'base_kind',coalesce(ct.base_kind,catalog.item_kind,'activity')
  )
  from edges e join public.canonical_targets t on t.id=e.related_target_id
  left join lateral(select public.get_uin_card_profile_v60(t.id) profile) p on true
  left join lateral(select item_kind from public.seed_catalog_items where canonical_target_id=t.id and status='active' order by updated_at desc limit 1) catalog on true
  left join public.uin_content_types ct on ct.id=coalesce(t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity')
  where coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true'
  order by e.target_id,e.sort_order,t.title;
$$;
revoke all on function public.get_uin_card_relations_v87(uuid[]) from public;
grant execute on function public.get_uin_card_relations_v87(uuid[]) to anon,authenticated;

create or replace function public.admin_replace_uin_card_relations_v87(p_target_id uuid,p_relations jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row jsonb;related uuid;kind text;position integer;section text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.';end if;
  if jsonb_typeof(coalesce(p_relations,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_relations,'[]'::jsonb))>50 then raise exception 'En fazla 50 bağlı kart seçebilirsin.';end if;
  delete from public.uin_card_relations_v87 where source_target_id=p_target_id;
  for row in select value from jsonb_array_elements(coalesce(p_relations,'[]'::jsonb)) loop
    related:=(row->>'relatedTargetId')::uuid;kind:=coalesce(nullif(row->>'relationType',''),'related');position:=coalesce((row->>'sortOrder')::integer,0);section:=nullif(btrim(row->>'sectionTitle'),'');
    if related=p_target_id or not exists(select 1 from public.canonical_targets where id=related) then raise exception 'Bağlı kart geçersiz.';end if;
    if kind not in ('source_material','adaptation','soundtrack','series_part','sequel','remake','spin_off','inspired_by','related') then raise exception 'İlişki türü geçersiz.';end if;
    insert into public.uin_card_relations_v87(source_target_id,related_target_id,relation_type,sort_order,section_title,created_by)
    values(p_target_id,related,kind,greatest(-10000,least(10000,position)),section,auth.uid())
    on conflict(source_target_id,related_target_id,relation_type) do update set sort_order=excluded.sort_order,section_title=excluded.section_title,updated_at=now();
  end loop;
end;$$;
revoke all on function public.admin_replace_uin_card_relations_v87(uuid,jsonb) from public,anon;
grant execute on function public.admin_replace_uin_card_relations_v87(uuid,jsonb) to authenticated;

create or replace function public.admin_sync_uin_card_type_v87(p_target_id uuid,p_type_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare base text;seed_type uuid;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
  select base_kind into base from public.uin_content_types where id=p_type_id and active;
  if base is null then raise exception 'İçerik türü geçersiz.';end if;
  select id into seed_type from public.seed_types where is_active and case
    when base in ('movie','series','director','actor') then slug ~* '(watch|izle|movie|series)'
    when base in ('book','writer') then slug ~* '(read|oku|book)'
    when base in ('artist','album','podcast','music') then slug ~* '(listen|dinle|music|podcast)'
    when base='game' then slug ~* '(play|oyna|game)'
    when base='place' then slug ~* '(visit|git|travel|place)'
    else slug ~* '(try|do|make|dene|yap)'
  end order by case when slug in ('watch','read','listen','play','visit','try') then 0 else 1 end,slug limit 1;
  update public.canonical_targets set editorial_metadata=coalesce(editorial_metadata,'{}'::jsonb)||jsonb_build_object('content_type_id',p_type_id) where id=p_target_id;
  update public.seed_catalog_items set item_kind=base,seed_type_id=coalesce(seed_type,seed_type_id),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('content_type_id',p_type_id),updated_at=now() where canonical_target_id=p_target_id and status<>'rejected';
  if seed_type is not null then update public.seeds set seed_type_id=seed_type,updated_at=now() where canonical_target_id=p_target_id;end if;
end;$$;
revoke all on function public.admin_sync_uin_card_type_v87(uuid,text) from public,anon;
grant execute on function public.admin_sync_uin_card_type_v87(uuid,text) to authenticated;

-- Daha önce Film seçildiği halde okuma türünde kalan mevcut kaydı onar.
do $$declare target uuid;watch_type uuid;begin
  select id into watch_type from public.seed_types where is_active and slug ~* '(watch|izle|movie)' order by case when slug='watch' then 0 else 1 end,slug limit 1;
  for target in select id from public.canonical_targets where canonical_normalize_v31(title) like '%otostop%galaksi%rehberi%' and editorial_metadata->>'content_type_id'='movie' loop
    update public.seed_catalog_items set item_kind='movie',seed_type_id=coalesce(watch_type,seed_type_id),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('content_type_id','movie'),updated_at=now() where canonical_target_id=target and status<>'rejected';
    if watch_type is not null then update public.seeds set seed_type_id=watch_type,updated_at=now() where canonical_target_id=target;end if;
  end loop;
end$$;

notify pgrst,'reload schema';
commit;
