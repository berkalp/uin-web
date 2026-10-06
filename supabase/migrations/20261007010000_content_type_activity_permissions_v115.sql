begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

create table if not exists public.uin_content_type_activity_category_options_v115(
 content_type_id text not null references public.uin_content_types(id) on delete cascade,
 category_id uuid not null references public.activity_categories(id) on delete cascade,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(content_type_id,category_id)
);
create table if not exists public.uin_content_type_activity_options_v115(
 content_type_id text not null references public.uin_content_types(id) on delete cascade,
 activity_id uuid not null references public.activities(id) on delete cascade,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(content_type_id,activity_id)
);
alter table public.uin_content_type_activity_category_options_v115 enable row level security;
alter table public.uin_content_type_activity_options_v115 enable row level security;
revoke all on public.uin_content_type_activity_category_options_v115,public.uin_content_type_activity_options_v115 from anon,authenticated;

create or replace function public.uin_target_content_type_id_v115(p_target_id uuid)
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(nullif(target.editorial_metadata->>'content_type_id',''),nullif(catalog.metadata->>'content_type_id',''),nullif(catalog.item_kind,''),nullif(target.editorial_metadata->>'item_kind',''))
 from public.canonical_targets target
 left join lateral(
  select item.item_kind,item.metadata from public.seed_catalog_items item
  where item.canonical_target_id=target.id and item.status='active'
  order by item.updated_at desc limit 1
 ) catalog on true
 where target.id=p_target_id;
$$;
revoke all on function public.uin_target_content_type_id_v115(uuid) from public,anon,authenticated;

create or replace function public.get_uin_card_activity_selections_v115(p_target_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',activity.id,'name',activity.name,'category_id',category.id,'category_name',category.name,'sort_order',link.sort_order)
 from public.uin_card_activity_options_v106 link
 join public.activities activity on activity.id=link.activity_id and activity.is_active
 join public.activity_categories category on category.id=activity.category_id and category.is_active
 where link.target_id=p_target_id
 order by link.sort_order,activity.name;
$$;
revoke all on function public.get_uin_card_activity_selections_v115(uuid) from public;
grant execute on function public.get_uin_card_activity_selections_v115(uuid) to anon,authenticated;

create or replace function public.get_uin_content_type_activity_categories_v115(p_content_type_id text)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',category.id,'name',category.name,'sort_order',link.sort_order)
 from public.uin_content_type_activity_category_options_v115 link
 join public.activity_categories category on category.id=link.category_id and category.is_active
 where link.content_type_id=p_content_type_id
 order by link.sort_order,category.name;
$$;
create or replace function public.get_uin_content_type_activity_selections_v115(p_content_type_id text)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',activity.id,'name',activity.name,'category_id',category.id,'category_name',category.name,'sort_order',link.sort_order)
 from public.uin_content_type_activity_options_v115 link
 join public.activities activity on activity.id=link.activity_id and activity.is_active
 join public.activity_categories category on category.id=activity.category_id and category.is_active
 where link.content_type_id=p_content_type_id
 order by link.sort_order,activity.name;
$$;
revoke all on function public.get_uin_content_type_activity_categories_v115(text),public.get_uin_content_type_activity_selections_v115(text) from public;
grant execute on function public.get_uin_content_type_activity_categories_v115(text),public.get_uin_content_type_activity_selections_v115(text) to anon,authenticated;

create or replace function public.admin_replace_uin_content_type_activity_permissions_v115(p_content_type_id text,p_activity_ids uuid[],p_category_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
 if not exists(select 1 from public.uin_content_types where id=p_content_type_id) then raise exception 'İçerik türü bulunamadı.'; end if;
 if exists(select 1 from unnest(coalesce(p_activity_ids,array[]::uuid[])) id where not exists(select 1 from public.activities activity where activity.id=id and activity.is_active)) then raise exception 'Etkinliklerden biri bulunamadı veya aktif değil.'; end if;
 if exists(select 1 from unnest(coalesce(p_category_ids,array[]::uuid[])) id where not exists(select 1 from public.activity_categories category where category.id=id and category.is_active)) then raise exception 'Etkinlik kategorilerinden biri bulunamadı veya aktif değil.'; end if;
 delete from public.uin_content_type_activity_options_v115 where content_type_id=p_content_type_id;
 insert into public.uin_content_type_activity_options_v115(content_type_id,activity_id,sort_order,created_by)
 select p_content_type_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_activity_ids,array[]::uuid[])) with ordinality selected(id,ordinality) on conflict do nothing;
 delete from public.uin_content_type_activity_category_options_v115 where content_type_id=p_content_type_id;
 insert into public.uin_content_type_activity_category_options_v115(content_type_id,category_id,sort_order,created_by)
 select p_content_type_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_category_ids,array[]::uuid[])) with ordinality selected(id,ordinality) on conflict do nothing;
end;$$;
revoke all on function public.admin_replace_uin_content_type_activity_permissions_v115(text,uuid[],uuid[]) from public,anon;
grant execute on function public.admin_replace_uin_content_type_activity_permissions_v115(text,uuid[],uuid[]) to authenticated;

create or replace function public.get_uin_card_activity_options_v106(p_target_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with target_type as (select public.uin_target_content_type_id_v115(p_target_id) id), allowed as (
  select activity.id,activity.name,category.id category_id,category.name category_name,link.sort_order,0 source_order
  from public.uin_card_activity_options_v106 link join public.activities activity on activity.id=link.activity_id and activity.is_active join public.activity_categories category on category.id=activity.category_id and category.is_active where link.target_id=p_target_id
  union all
  select activity.id,activity.name,category.id,category.name,link.sort_order,1 from public.uin_card_activity_category_options_v114 link join public.activity_categories category on category.id=link.category_id and category.is_active join public.activities activity on activity.category_id=category.id and activity.is_active where link.target_id=p_target_id
  union all
  select activity.id,activity.name,category.id,category.name,link.sort_order,2 from target_type join public.uin_content_type_activity_options_v115 link on link.content_type_id=target_type.id join public.activities activity on activity.id=link.activity_id and activity.is_active join public.activity_categories category on category.id=activity.category_id and category.is_active
  union all
  select activity.id,activity.name,category.id,category.name,link.sort_order,3 from target_type join public.uin_content_type_activity_category_options_v115 link on link.content_type_id=target_type.id join public.activity_categories category on category.id=link.category_id and category.is_active join public.activities activity on activity.category_id=category.id and activity.is_active
 ), deduped as (select distinct on(id) * from allowed order by id,source_order,sort_order)
 select jsonb_build_object('id',id,'name',name,'category_id',category_id,'category_name',category_name,'sort_order',sort_order) from deduped order by source_order,sort_order,category_name,name;
$$;
revoke all on function public.get_uin_card_activity_options_v106(uuid) from public;
grant execute on function public.get_uin_card_activity_options_v106(uuid) to anon,authenticated;

create or replace function public.get_uin_card_activity_options_v114(p_target_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select value from public.get_uin_card_activity_options_v106(p_target_id) option(value);
$$;
revoke all on function public.get_uin_card_activity_options_v114(uuid) from public;
grant execute on function public.get_uin_card_activity_options_v114(uuid) to anon,authenticated;

create or replace function public.send_uin_together_v106(p_target_id uuid,p_recipient_id uuid,p_activity_id uuid,p_date date default null,p_place text default '',p_preference text default '',p_note text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;v_activity_name text;
begin
 select value->>'name' into v_activity_name from public.get_uin_card_activity_options_v106(p_target_id) option(value) where value->>'id'=p_activity_id::text limit 1;
 if not found then raise exception 'Bu etkinlik kartın izinli seçenekleri arasında değil.'; end if;
 v_id:=public.send_uin_together_v71(p_target_id,p_recipient_id,p_date,p_place,left(v_activity_name||case when nullif(trim(coalesce(p_preference,'')),'') is null then '' else ' · '||trim(p_preference) end,300),p_note);
 update public.uin_together_proposals_v71 set activity_id=p_activity_id where id=v_id;
 return v_id;
end;$$;
revoke all on function public.send_uin_together_v106(uuid,uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.send_uin_together_v106(uuid,uuid,uuid,date,text,text,text) to authenticated;

create or replace function public.send_uin_together_v114(p_target_id uuid,p_recipient_id uuid,p_activity_id uuid,p_date date default null,p_place text default '',p_preference text default '',p_note text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return public.send_uin_together_v106(p_target_id,p_recipient_id,p_activity_id,p_date,p_place,p_preference,p_note);
end;$$;
revoke all on function public.send_uin_together_v114(uuid,uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.send_uin_together_v114(uuid,uuid,uuid,date,text,text,text) to authenticated;

notify pgrst,'reload schema';
commit;

