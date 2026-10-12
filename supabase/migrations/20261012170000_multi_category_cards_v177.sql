begin;
-- One canonical identity; indexed category memberships never duplicate cards,
-- ratings, followers, seeds or personal wishes.
create table if not exists public.uin_card_content_types_v177 (
 target_id uuid not null references public.canonical_targets(id) on delete cascade,
 content_type_id text not null references public.uin_content_types(id) on delete cascade,
 primary key(target_id,content_type_id)
);
create index if not exists uin_card_content_types_type_v177 on public.uin_card_content_types_v177(content_type_id,target_id);
alter table public.uin_card_content_types_v177 enable row level security;
revoke all on public.uin_card_content_types_v177 from anon,authenticated;

create or replace function public.sync_uin_card_content_types_v177() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare target uuid; meta jsonb; primary_type text; fallback text;
begin
 if tg_op='UPDATE' and tg_table_name='canonical_targets' then
 if (old.editorial_metadata->'content_type_id') is not distinct from (new.editorial_metadata->'content_type_id') and (old.editorial_metadata->'content_type_ids') is not distinct from (new.editorial_metadata->'content_type_ids') then return new;end if;
 end if;
 if tg_table_name='canonical_targets' then target:=new.id;else target:=new.canonical_target_id;end if;
 if target is null then return new;end if;
 select editorial_metadata into meta from public.canonical_targets where id=target;
 select coalesce(ci.metadata->>'content_type_id',case when ci.item_kind='video' then 'series' else ci.item_kind end)
 into fallback from public.seed_catalog_items ci where ci.canonical_target_id=target order by ci.updated_at desc,ci.id desc limit 1;
 primary_type:=coalesce(meta->>'content_type_id',fallback);
 delete from public.uin_card_content_types_v177 where target_id=target;
 insert into public.uin_card_content_types_v177(target_id,content_type_id)
 select target,t.id from public.uin_content_types t where t.id=primary_type
 or t.id in(select jsonb_array_elements_text(case when jsonb_typeof(meta->'content_type_ids')='array' then meta->'content_type_ids' else '[]'::jsonb end));
 return new;
end;$fn$;
create trigger canonical_card_content_types_v177 after insert or update of editorial_metadata on public.canonical_targets
for each row execute function public.sync_uin_card_content_types_v177();
create trigger catalog_card_content_types_v177 after insert or update of canonical_target_id,item_kind on public.seed_catalog_items
for each row execute function public.sync_uin_card_content_types_v177();

insert into public.uin_card_content_types_v177(target_id,content_type_id)
select distinct ci.canonical_target_id,t.id from public.seed_catalog_items ci
join public.canonical_targets c on c.id=ci.canonical_target_id
join public.uin_content_types t on t.id=coalesce(c.editorial_metadata->>'content_type_id',ci.metadata->>'content_type_id',case when ci.item_kind='video' then 'series' else ci.item_kind end)
where ci.status<>'rejected' on conflict do nothing;
insert into public.uin_card_content_types_v177(target_id,content_type_id)
select c.id,t.id from public.canonical_targets c
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(c.editorial_metadata->'content_type_ids')='array' then c.editorial_metadata->'content_type_ids' else '[]'::jsonb end) a(id)
join public.uin_content_types t on t.id=a.id on conflict do nothing;

create or replace function public.get_uin_card_content_types_v177(p_target_ids uuid[]) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 select coalesce(jsonb_agg(to_jsonb(row)),'[]'::jsonb) from (
 select m.target_id,jsonb_agg(t.id order by t.position,t.id) content_type_ids,
 jsonb_agg(jsonb_build_object('id',t.id,'label',t.label,'icon',t.icon,'base_kind',t.base_kind,'ui_labels',t.ui_labels) order by t.position,t.id) content_types
 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.active
 join public.canonical_targets c on c.id=m.target_id
 where m.target_id=any(p_target_ids) and (public.is_admin() or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=m.target_id and ci.status='active')
 group by m.target_id
 ) row;
$fn$;

create or replace function public.admin_save_uin_card_content_types_v177(p_target_id uuid,p_content_type_ids text[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare ids text[]; primary_type text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501';end if;
 select array_agg(distinct x) into ids from unnest(p_content_type_ids) x;
 select editorial_metadata->>'content_type_id' into primary_type from public.canonical_targets where id=p_target_id for update;
 if ids is null or cardinality(ids)>3 or not primary_type=any(ids) or exists(select 1 from unnest(ids) x where not exists(select 1 from public.uin_content_types t where t.id=x and t.active)) then
 raise exception 'Ana kategori dahil 1–3 aktif kategori seç.' using errcode='22023';end if;
 update public.canonical_targets set editorial_metadata=coalesce(editorial_metadata,'{}'::jsonb)||jsonb_build_object('content_type_ids',to_jsonb(ids)) where id=p_target_id;
 update public.seed_catalog_items set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('content_type_ids',to_jsonb(ids)) where canonical_target_id=p_target_id and status<>'rejected';
end;$fn$;

create or replace function public.get_uin_type_placements_v177(p_content_type_id text,p_limit integer default 500,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 select coalesce(jsonb_agg(to_jsonb(placement)),'[]'::jsonb) from (
 select ci.id,ci.canonical_target_id,ci.item_kind,ci.canonical_title,ci.creator_name,ci.cover_url,
 coalesce(c.editorial_metadata->>'content_type_id',ci.metadata->>'content_type_id',ci.item_kind) content_type_id,
 (select jsonb_agg(m2.content_type_id order by m2.content_type_id) from public.uin_card_content_types_v177 m2 join public.uin_content_types ct on ct.id=m2.content_type_id and ct.active where m2.target_id=m.target_id) content_type_ids,
 ci.metadata->>'imdb_top_250_rank' imdb_top_250_rank,ci.metadata->>'imdb_top_100_rank' imdb_top_100_rank,ci.metadata->>'imdb_rating' imdb_rating,
 ci.metadata->'book_lists' book_lists,ci.metadata->'book_list_ranks' book_list_ranks,ci.metadata->'book_awards' book_awards,
 ci.metadata->'series_lists' series_lists,ci.metadata->'series_list_ranks' series_list_ranks,ci.metadata->'series_awards' series_awards
 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.active
 join public.canonical_targets c on c.id=m.target_id
 join lateral(select item.* from public.seed_catalog_items item where item.canonical_target_id=m.target_id and item.status='active' order by item.updated_at desc,item.id desc limit 1) ci on true
 where m.content_type_id=p_content_type_id and (public.is_admin() or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 order by ci.updated_at desc,ci.id desc limit least(greatest(coalesce(p_limit,500),1),500) offset greatest(coalesce(p_offset,0),0)
 ) placement;
$fn$;
create or replace function public.get_uin_category_counts_v129() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 with eligible as materialized (
 select distinct ci.canonical_target_id from public.seed_catalog_items ci join public.canonical_targets c on c.id=ci.canonical_target_id
 where ci.status='active' and coalesce(ci.metadata->>'global_place_catalogue','false')<>'true'
 and (public.is_admin() or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 ), counts as (select m.content_type_id,count(*) n from public.uin_card_content_types_v177 m join eligible e on e.canonical_target_id=m.target_id group by m.content_type_id),
 places as (select coalesce((public.get_global_place_counts_v122()->>'cities')::bigint,0) n)
 select coalesce(jsonb_object_agg(t.id,case when t.base_kind='place' then places.n else coalesce(counts.n,0) end),'{}'::jsonb)
 ||jsonb_build_object('_total',(select count(*) from eligible e where not exists(select 1 from public.uin_card_content_types_v177 m join public.uin_content_types ct on ct.id=m.content_type_id where m.target_id=e.canonical_target_id and ct.base_kind='place'))+places.n)
 from public.uin_content_types t cross join places left join counts on counts.content_type_id=t.id where t.active group by places.n;
$fn$;

alter table public.canonical_personal_intents_v38 add column if not exists content_type_id text references public.uin_content_types(id);
create or replace function public.save_my_contextual_personal_intent_v177(p_target_id uuid,p_start_date date default null,p_end_date date default null,p_visibility text default 'only_me',p_location_id uuid default null,p_notes text default null,p_timing_precision text default 'flexible',p_date_options jsonb default '[]'::jsonb,p_content_type_id text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $fn$
declare wish uuid;
begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501';end if;
 if p_content_type_id is not null and not exists(select 1 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.active where m.target_id=p_target_id and m.content_type_id=p_content_type_id) then
 raise exception 'Bu kart için geçerli bir kategori seç.' using errcode='22023';end if;
 wish:=public.save_my_common_personal_intent_v39(p_target_id,p_start_date,p_end_date,p_visibility,p_location_id,p_notes,p_timing_precision,p_date_options);
 if p_content_type_id is not null then update public.canonical_personal_intents_v38 set content_type_id=p_content_type_id where id=wish and user_id=auth.uid();end if;
 return wish;
end;$fn$;
-- Preserve the existing private reader and all of its visibility/ordering logic.
do $patch$ declare definition text;begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='get_my_uin_personal_cards_v57';
 definition:=replace(definition,$old$'type_id',coalesce(t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity')$old$,$new$'type_id',coalesce(personal.content_type_id,t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity')$new$);
 definition:=replace(definition,$old$type.id=coalesce(t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity')$old$,$new$type.id=coalesce(personal.content_type_id,t.editorial_metadata->>'content_type_id',catalog.item_kind,'activity')$new$);
 execute definition;
end;$patch$;

revoke all on function public.sync_uin_card_content_types_v177() from public;
revoke all on function public.get_uin_card_content_types_v177(uuid[]),public.get_uin_type_placements_v177(text,integer,integer),public.admin_save_uin_card_content_types_v177(uuid,text[]),public.save_my_contextual_personal_intent_v177(uuid,date,date,text,uuid,text,text,jsonb,text) from public;
grant execute on function public.get_uin_card_content_types_v177(uuid[]),public.get_uin_type_placements_v177(text,integer,integer) to anon,authenticated;
grant execute on function public.admin_save_uin_card_content_types_v177(uuid,text[]),public.save_my_contextual_personal_intent_v177(uuid,date,date,text,uuid,text,text,jsonb,text) to authenticated;

-- Existing example cards retain their canonical ids and all user history.
update public.canonical_targets set editorial_metadata=coalesce(editorial_metadata,'{}'::jsonb)||jsonb_build_object('content_type_ids',jsonb_build_array('hobby','activity','writer'))
where id in ('33ec7aea-0891-4478-b1fb-ae2fc52a55bc','8620f712-bfff-4416-ba7c-2733a6010288');
update public.seed_catalog_items ci set metadata=coalesce(ci.metadata,'{}'::jsonb)||jsonb_build_object('content_type_ids',c.editorial_metadata->'content_type_ids')
from public.canonical_targets c where c.id=ci.canonical_target_id and c.id in ('33ec7aea-0891-4478-b1fb-ae2fc52a55bc','8620f712-bfff-4416-ba7c-2733a6010288');
notify pgrst,'reload schema';
commit;
