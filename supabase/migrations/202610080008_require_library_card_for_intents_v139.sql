begin;
set local lock_timeout='30s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- A catalogue row may deliberately be attached to an existing canonical card.
-- This is needed when older intents already have a stable target identity but
-- predate the visible Library catalogue. Normal catalogue inserts keep the
-- existing canonicalisation behaviour.
create or replace function public.catalog_canonical_target_v31()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare v_slug text;
begin
  if new.canonical_target_id is not null
     and coalesce((new.metadata->>'canonical_target_pinned')::boolean,false)
     and exists(select 1 from public.canonical_targets target where target.id=new.canonical_target_id) then
    return new;
  end if;
  select slug into v_slug from public.seed_types where id=new.seed_type_id;
  new.canonical_target_id:=public.resolve_canonical_target_v31(
    'catalog:'||new.id,new.item_kind,new.canonical_title,new.creator_name,new.metadata,v_slug
  );
  return new;
end;
$function$;

do $block$
declare v_do_type uuid;
begin
  select type.id into v_do_type
  from public.seed_types type
  where type.is_active and type.slug ~* '(try|do|make|dene|yap|activity|sport)'
  order by case when type.slug in('try','do','yap') then 0 else 1 end,type.slug
  limit 1;
  if v_do_type is null then raise exception 'Aktivite Kütüphane türü bulunamadı.'; end if;

  -- Backfill only canonical targets that are actually referenced by an intent
  -- and do not already have an active Library record.
  insert into public.seed_catalog_items(
    seed_type_id,item_kind,canonical_title,creator_name,cover_url,external_source,
    external_id,metadata,status,canonical_target_id,primary_category_id
  )
  select v_do_type,
    case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then 'sport' else 'activity' end,
    target.title,target.creator_name,
    coalesce(target.editorial_cover_url,activity.default_cover_url,category.default_cover_url),
    'uin-canonical-target-backfill',target.id::text,
    coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
      'canonical_target_pinned',true,
      'content_type_id',case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then 'sport' else 'activity' end,
      'uin_item_kind',case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then 'sport' else 'activity' end,
      'legacy_activity_target',true
    ),
    'active',target.id,target.primary_category_id
  from public.canonical_targets target
  left join public.activities activity on activity.id=target.activity_id
  left join public.activity_categories category on category.id=activity.category_id
  where exists(
    select 1 from public.intents intent where intent.canonical_target_id=target.id
    union all
    select 1 from public.canonical_personal_intents_v38 personal where personal.target_id=target.id
  )
    and not exists(
      select 1 from public.seed_catalog_items item
      where item.canonical_target_id=target.id and item.status='active'
    );

  update public.canonical_targets target
  set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
      'content_type_id',case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then 'sport' else 'activity' end,
      'item_kind',case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then 'sport' else 'activity' end,
      'action_key',case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then 'sport-do' else 'do' end,
      'display_icon',case when coalesce(target.editorial_metadata->>'content_type_id','')='sport' then '🏃' else '✨' end
    ),updated_at=now()
  where exists(
    select 1 from public.seed_catalog_items item
    where item.canonical_target_id=target.id and item.external_source='uin-canonical-target-backfill'
  );
end;
$block$;

-- Check the current row at transaction end. This lets create_my_card_event_v72
-- create its temporary intent and attach the chosen Library card in the same
-- transaction, while preventing every committed orphan intent.
create or replace function public.assert_intent_has_library_card_v139()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare v_target uuid;
begin
  select intent.canonical_target_id into v_target from public.intents intent where intent.id=new.id;
  if v_target is not null and not exists(
    select 1 from public.seed_catalog_items item
    where item.canonical_target_id=v_target and item.status='active'
  ) then
    raise exception 'Niyet veya etkinlik Kütüphane kartına bağlı olmalıdır.' using errcode='23514';
  end if;
  return null;
end;
$function$;

drop trigger if exists require_intent_library_card_v139 on public.intents;
create constraint trigger require_intent_library_card_v139
after insert or update of canonical_target_id on public.intents
deferrable initially deferred
for each row execute function public.assert_intent_has_library_card_v139();

create or replace function public.assert_personal_intent_has_library_card_v139()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare v_target uuid;
begin
  select personal.target_id into v_target
  from public.canonical_personal_intents_v38 personal where personal.id=new.id;
  if v_target is not null and not exists(
    select 1 from public.seed_catalog_items item
    where item.canonical_target_id=v_target and item.status='active'
  ) then
    raise exception 'Niyet Kütüphane kartına bağlı olmalıdır.' using errcode='23514';
  end if;
  return null;
end;
$function$;

drop trigger if exists require_personal_intent_library_card_v139 on public.canonical_personal_intents_v38;
create constraint trigger require_personal_intent_library_card_v139
after insert or update of target_id on public.canonical_personal_intents_v38
deferrable initially deferred
for each row execute function public.assert_personal_intent_has_library_card_v139();

do $verify$
begin
  if exists(
    select 1 from public.intents intent
    where not exists(select 1 from public.seed_catalog_items item where item.canonical_target_id=intent.canonical_target_id and item.status='active')
  ) then raise exception 'Kütüphane kartı olmayan sosyal niyet kaldı.'; end if;
  if exists(
    select 1 from public.canonical_personal_intents_v38 personal
    where not exists(select 1 from public.seed_catalog_items item where item.canonical_target_id=personal.target_id and item.status='active')
  ) then raise exception 'Kütüphane kartı olmayan kişisel niyet kaldı.'; end if;
end;
$verify$;

notify pgrst,'reload schema';
commit;
