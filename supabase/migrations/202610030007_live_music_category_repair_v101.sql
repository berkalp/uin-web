begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Eski konser içe aktarıcısı place türünü teknik bir geri dönüş olarak
-- kullanıyordu. Bundan sonra gerçek konser/festival konuları Aktivite olur.
create or replace function public.normalize_live_music_catalog_kind_v101()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.item_kind = 'place' and new.metadata->>'uin_item_kind' = 'concert' then
    new.item_kind := 'activity';
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_live_music_catalog_kind_v101 on public.seed_catalog_items;
create trigger normalize_live_music_catalog_kind_v101
before insert or update of item_kind, metadata on public.seed_catalog_items
for each row execute function public.normalize_live_music_catalog_kind_v101();

do $$
declare
  listen_type uuid;
  activity_type uuid;
  duplicate record;
  definition text;
  old_where text := 'where (public.is_admin() or coalesce((t.editorial_metadata->>''admin_hidden'')::boolean,false)=false';
  new_where text := 'where not (coalesce(t.editorial_metadata,''{}''::jsonb) ? ''merged_into_target_id'') and (public.is_admin() or coalesce((t.editorial_metadata->>''admin_hidden'')::boolean,false)=false';
begin
  select id into listen_type from public.seed_types
  where is_active and slug ~* '(listen|dinle|music)'
  order by case when slug='listen' then 0 else 1 end, slug limit 1;
  select id into activity_type from public.seed_types
  where is_active and slug ~* '(try|do|make|dene|yap|concert|konser)'
  order by case when slug in ('try','concert') then 0 else 1 end, slug limit 1;

  -- Sanatçı adıyla açılmış yanlış konser kartını mevcut aynı adlı sanatçı
  -- kartıyla birleştir. Den Ze, Epica ve Metallica bu kapsamdadır.
  for duplicate in
    select bad.id bad_catalog_id,bad.canonical_target_id bad_target_id,
      good.id artist_catalog_id,good.canonical_target_id artist_target_id
    from public.seed_catalog_items bad
    join lateral (
      select candidate.* from public.seed_catalog_items candidate
      where candidate.status='active' and candidate.item_kind='artist'
        and candidate.id<>bad.id
        and public.canonical_normalize_v31(candidate.canonical_title)=public.canonical_normalize_v31(bad.canonical_title)
      order by candidate.updated_at desc,candidate.id limit 1
    ) good on true
    where bad.status='active' and bad.item_kind='place'
      and bad.metadata->>'live_event_kind'='concert'
      and public.canonical_normalize_v31(bad.canonical_title)=public.canonical_normalize_v31(coalesce(bad.metadata->>'artist_name',''))
  loop
    update public.seeds set
      catalog_item_id=duplicate.artist_catalog_id,
      canonical_target_id=duplicate.artist_target_id,
      seed_type_id=coalesce(listen_type,seed_type_id),
      updated_at=now()
    where catalog_item_id=duplicate.bad_catalog_id or canonical_target_id=duplicate.bad_target_id;

    update public.intents set canonical_target_id=duplicate.artist_target_id
    where canonical_target_id=duplicate.bad_target_id;

    update public.seed_catalog_items set status='merged',merged_into_id=duplicate.artist_catalog_id,updated_at=now()
    where id=duplicate.bad_catalog_id;

    update public.canonical_targets set
      editorial_metadata=coalesce(editorial_metadata,'{}'::jsonb)||jsonb_build_object(
        'merged_into_target_id',duplicate.artist_target_id::text,'merged_at',now()
      ),updated_at=now()
    where id=duplicate.bad_target_id;
  end loop;

  -- Başlığı doğrudan sanatçı adı olan eski manuel konser kayıtları sanatçıdır.
  update public.seed_catalog_items item set
    item_kind='artist',
    seed_type_id=coalesce(listen_type,item.seed_type_id),
    metadata=(coalesce(item.metadata,'{}'::jsonb)||jsonb_build_object('uin_item_kind','artist','content_type_id','artist'))-'live_event_kind',
    updated_at=now()
  where item.status='active' and item.item_kind='place'
    and item.metadata->>'live_event_kind'='concert'
    and public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(coalesce(item.metadata->>'artist_name',''));

  update public.canonical_targets target set
    editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
      'content_type_id','artist','item_kind','artist','action_key','listen','display_icon','🎵'
    ),
    updated_at=now()
  where exists(select 1 from public.seed_catalog_items item where item.canonical_target_id=target.id and item.status='active' and item.item_kind='artist' and item.metadata->>'spotify_artist_id' is not null);

  update public.seeds seed set seed_type_id=coalesce(listen_type,seed.seed_type_id),updated_at=now()
  where exists(select 1 from public.seed_catalog_items item where item.id=seed.catalog_item_id and item.status='active' and item.item_kind='artist' and item.metadata->>'spotify_artist_id' is not null);

  -- Kalan kayıtların başlığı bir konser veya festival olayıdır; Yer değil Aktivite.
  update public.seed_catalog_items item set
    item_kind='activity',
    seed_type_id=coalesce(activity_type,item.seed_type_id),
    metadata=coalesce(item.metadata,'{}'::jsonb)||jsonb_build_object('content_type_id','activity'),
    updated_at=now()
  where item.status='active' and item.item_kind='place' and item.metadata->>'uin_item_kind'='concert';

  update public.canonical_targets target set
    editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
      'content_type_id','activity','item_kind','activity','action_key','try','display_icon','✨'
    ),
    updated_at=now()
  where exists(select 1 from public.seed_catalog_items item where item.canonical_target_id=target.id and item.status='active' and item.item_kind='activity' and item.metadata->>'uin_item_kind'='concert');

  definition:=pg_get_functiondef('public.get_uin_catalogue_v64(text,integer,integer,uuid)'::regprocedure);
  if position(old_where in definition)=0 then raise exception 'Catalogue visibility definition changed'; end if;
  execute replace(definition,old_where,new_where);
end;
$$;

revoke all on function public.get_uin_catalogue_v64(text,integer,integer,uuid) from public;
grant execute on function public.get_uin_catalogue_v64(text,integer,integer,uuid) to anon, authenticated;
notify pgrst,'reload schema';
commit;
