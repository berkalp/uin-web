begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create table if not exists public.uin_card_activity_category_options_v114(
 target_id uuid not null references public.canonical_targets(id) on delete cascade,
 category_id uuid not null references public.activity_categories(id) on delete cascade,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(target_id,category_id)
);
alter table public.uin_card_activity_category_options_v114 enable row level security;
revoke all on public.uin_card_activity_category_options_v114 from anon,authenticated;

create or replace function public.uin_target_is_place_v114(p_target_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(type.base_kind,catalog.item_kind,target.editorial_metadata->>'item_kind','')='place'
 from public.canonical_targets target
 left join public.uin_content_types type on type.id=target.editorial_metadata->>'content_type_id'
 left join lateral(
  select item.item_kind from public.seed_catalog_items item
  where item.canonical_target_id=target.id and item.status='active'
  order by item.updated_at desc limit 1
 ) catalog on true
 where target.id=p_target_id;
$$;
revoke all on function public.uin_target_is_place_v114(uuid) from public,anon,authenticated;

insert into public.uin_card_activity_category_options_v114(target_id,category_id,sort_order)
select target.id,category.id,0
from public.canonical_targets target
join public.activity_categories category on category.name='Travel Activity' and category.is_active
where public.uin_target_is_place_v114(target.id)
on conflict(target_id,category_id) do nothing;

create or replace function public.ensure_place_travel_activity_category_v114()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_category_id uuid;
begin
 if new.status='active' and new.canonical_target_id is not null and coalesce((select base_kind from public.uin_content_types where id=coalesce(new.metadata->>'content_type_id','')),new.item_kind)='place' then
  select id into v_category_id from public.activity_categories where name='Travel Activity' and is_active limit 1;
  if v_category_id is not null then
   insert into public.uin_card_activity_category_options_v114(target_id,category_id,sort_order)
   values(new.canonical_target_id,v_category_id,0)
   on conflict(target_id,category_id) do nothing;
  end if;
 end if;
 return new;
end;$$;
drop trigger if exists ensure_place_travel_activity_category_v114 on public.seed_catalog_items;
create trigger ensure_place_travel_activity_category_v114
after insert or update of item_kind,metadata,canonical_target_id,status on public.seed_catalog_items
for each row execute function public.ensure_place_travel_activity_category_v114();

create or replace function public.get_uin_card_activity_categories_v114(p_target_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',category.id,'name',category.name,'sort_order',link.sort_order)
 from public.uin_card_activity_category_options_v114 link
 join public.activity_categories category on category.id=link.category_id and category.is_active
 where link.target_id=p_target_id
 order by link.sort_order,category.name;
$$;
revoke all on function public.get_uin_card_activity_categories_v114(uuid) from public;
grant execute on function public.get_uin_card_activity_categories_v114(uuid) to anon,authenticated;

create or replace function public.get_uin_card_activity_options_v114(p_target_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with allowed as (
  select activity.id,activity.name,category.id category_id,category.name category_name,link.sort_order,0 source_order
  from public.uin_card_activity_options_v106 link
  join public.activities activity on activity.id=link.activity_id and activity.is_active
  join public.activity_categories category on category.id=activity.category_id and category.is_active
  where link.target_id=p_target_id
  union all
  select activity.id,activity.name,category.id,category.name,link.sort_order,1
  from public.uin_card_activity_category_options_v114 link
  join public.activity_categories category on category.id=link.category_id and category.is_active
  join public.activities activity on activity.category_id=category.id and activity.is_active
  where link.target_id=p_target_id
 ), deduped as (
  select distinct on(id) * from allowed order by id,source_order,sort_order
 )
 select jsonb_build_object('id',id,'name',name,'category_id',category_id,'category_name',category_name,'sort_order',sort_order)
 from deduped order by sort_order,category_name,name;
$$;
revoke all on function public.get_uin_card_activity_options_v114(uuid) from public;
grant execute on function public.get_uin_card_activity_options_v114(uuid) to anon,authenticated;

create or replace function public.admin_replace_uin_card_activity_permissions_v114(p_target_id uuid,p_activity_ids uuid[],p_category_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_travel_id uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
 if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.'; end if;
 if exists(select 1 from unnest(coalesce(p_activity_ids,array[]::uuid[])) id where not exists(select 1 from public.activities a where a.id=id and a.is_active)) then raise exception 'Etkinliklerden biri bulunamadı veya aktif değil.'; end if;
 if exists(select 1 from unnest(coalesce(p_category_ids,array[]::uuid[])) id where not exists(select 1 from public.activity_categories c where c.id=id and c.is_active)) then raise exception 'Etkinlik kategorilerinden biri bulunamadı veya aktif değil.'; end if;
 if public.uin_target_is_place_v114(p_target_id) then
  select id into v_travel_id from public.activity_categories where name='Travel Activity' and is_active limit 1;
  if v_travel_id is not null and not(v_travel_id=any(coalesce(p_category_ids,array[]::uuid[]))) then p_category_ids:=array_append(coalesce(p_category_ids,array[]::uuid[]),v_travel_id); end if;
 end if;
 delete from public.uin_card_activity_options_v106 where target_id=p_target_id;
 insert into public.uin_card_activity_options_v106(target_id,activity_id,sort_order,created_by)
 select p_target_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_activity_ids,array[]::uuid[])) with ordinality selected(id,ordinality)
 on conflict do nothing;
 delete from public.uin_card_activity_category_options_v114 where target_id=p_target_id;
 insert into public.uin_card_activity_category_options_v114(target_id,category_id,sort_order,created_by)
 select p_target_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_category_ids,array[]::uuid[])) with ordinality selected(id,ordinality)
 on conflict do nothing;
end;$$;
revoke all on function public.admin_replace_uin_card_activity_permissions_v114(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.admin_replace_uin_card_activity_permissions_v114(uuid,uuid[],uuid[]) to authenticated;

create or replace function public.send_uin_together_v114(p_target_id uuid,p_recipient_id uuid,p_activity_id uuid,p_date date default null,p_place text default '',p_preference text default '',p_note text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;v_activity_name text;
begin
 select activity.name into v_activity_name
 from public.activities activity
 where activity.id=p_activity_id and activity.is_active and (
  exists(select 1 from public.uin_card_activity_options_v106 link where link.target_id=p_target_id and link.activity_id=activity.id)
  or exists(select 1 from public.uin_card_activity_category_options_v114 link where link.target_id=p_target_id and link.category_id=activity.category_id)
 );
 if not found then raise exception 'Bu etkinlik kartın izinli seçenekleri arasında değil.'; end if;
 v_id:=public.send_uin_together_v71(p_target_id,p_recipient_id,p_date,p_place,left(v_activity_name||case when nullif(trim(coalesce(p_preference,'')),'') is null then '' else ' · '||trim(p_preference) end,300),p_note);
 update public.uin_together_proposals_v71 set activity_id=p_activity_id where id=v_id;
 return v_id;
end;$$;
revoke all on function public.send_uin_together_v114(uuid,uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.send_uin_together_v114(uuid,uuid,uuid,date,text,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
