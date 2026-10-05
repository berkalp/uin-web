begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

update public.uin_content_types
set ui_labels=coalesce(ui_labels,'{}'::jsonb)||jsonb_build_object(
  'want','Dinlemek / Konsere Gitmek İstiyorum',
  'wanting','Dinlemek / Konsere Gitmek İsteyenler',
  'doers','Dinleyen / Konsere Gidenler'
)
where id='artist';

create or replace function public.get_uin_card_summary_v106(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with requested as (
  select distinct value requested_id from unnest(coalesce(p_target_ids,array[]::uuid[])) value
 ), closure as materialized (
  select requested.requested_id,descendants.target_id from requested
  cross join lateral public.get_uin_card_descendants_v81(requested.requested_id,true) descendants
 ), people_stats as (
  select closure.requested_id,
   count(distinct raw.user_id) filter(where raw.relationship_status='want') wanting,
   count(distinct raw.user_id) filter(where raw.relationship_status='completed') done
  from closure join public.visible_common_target_people_v38() raw on raw.target_id=closure.target_id
  where raw.source_kind in('seed','personal') and raw.relationship_status in('want','completed')
  group by closure.requested_id
 ), raw_events as materialized (
  select closure.requested_id,event,coalesce(event->>'resource_id',event->>'plan_id',event->>'intent_id') resource_id
  from closure cross join lateral public.get_uin_card_events_v80(closure.target_id) event
 ), events as (
  select distinct on(requested_id,resource_id) requested_id,event from raw_events order by requested_id,resource_id
 ), event_stats as (
  select requested_id,
   count(*) filter(where event->>'event_state'='active') active,
   count(*) filter(where event->>'event_state'='completed') completed,
   count(*) filter(where event->>'event_state'='expired') expired,
   count(*) filter(where event->>'event_state'='cancelled') cancelled
  from events group by requested_id
 )
 select jsonb_build_object(
  'target_id',target.id,'wanting',coalesce(people.wanting,0),'done',coalesce(people.done,0),
  'active',coalesce(events.active,0),'completed',coalesce(events.completed,0),'expired',coalesce(events.expired,0),'cancelled',coalesce(events.cancelled,0),
  'type_id',target.editorial_metadata->>'content_type_id','creator_name',target.creator_name,'editorial_cover_url',target.editorial_cover_url,
  'child_count',(select count(*) from closure c where c.requested_id=target.id and c.target_id<>target.id)
 )
 from requested join public.canonical_targets target on target.id=requested.requested_id
 left join people_stats people on people.requested_id=target.id
 left join event_stats events on events.requested_id=target.id;
$$;

revoke all on function public.get_uin_card_summary_v106(uuid[]) from public;
grant execute on function public.get_uin_card_summary_v106(uuid[]) to anon,authenticated;

create table if not exists public.uin_card_activity_options_v106(
 target_id uuid not null references public.canonical_targets(id) on delete cascade,
 activity_id uuid not null references public.activities(id) on delete cascade,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(target_id,activity_id)
);
alter table public.uin_card_activity_options_v106 enable row level security;
revoke all on public.uin_card_activity_options_v106 from anon,authenticated;

create or replace function public.get_uin_card_activity_options_v106(p_target_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',activity.id,'name',activity.name,'category_name',category.name,'sort_order',link.sort_order)
 from public.uin_card_activity_options_v106 link
 join public.activities activity on activity.id=link.activity_id and activity.is_active
 join public.activity_categories category on category.id=activity.category_id and category.is_active
 where link.target_id=p_target_id
 order by link.sort_order,activity.name;
$$;
revoke all on function public.get_uin_card_activity_options_v106(uuid) from public;
grant execute on function public.get_uin_card_activity_options_v106(uuid) to anon,authenticated;

create or replace function public.admin_replace_uin_card_activity_options_v106(p_target_id uuid,p_activity_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
 if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.'; end if;
 if exists(select 1 from unnest(coalesce(p_activity_ids,array[]::uuid[])) id where not exists(select 1 from public.activities a where a.id=id and a.is_active)) then raise exception 'Etkinliklerden biri bulunamadı veya aktif değil.'; end if;
 delete from public.uin_card_activity_options_v106 where target_id=p_target_id;
 insert into public.uin_card_activity_options_v106(target_id,activity_id,sort_order,created_by)
 select p_target_id,id,ordinality::integer,auth.uid() from unnest(coalesce(p_activity_ids,array[]::uuid[])) with ordinality selected(id,ordinality)
 on conflict do nothing;
end;$$;
revoke all on function public.admin_replace_uin_card_activity_options_v106(uuid,uuid[]) from public,anon;
grant execute on function public.admin_replace_uin_card_activity_options_v106(uuid,uuid[]) to authenticated;

alter table public.uin_together_proposals_v71 add column if not exists activity_id uuid references public.activities(id) on delete set null;

create or replace function public.send_uin_together_v106(p_target_id uuid,p_recipient_id uuid,p_activity_id uuid,p_date date default null,p_place text default '',p_preference text default '',p_note text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;v_activity_name text;
begin
 select activity.name into v_activity_name
 from public.uin_card_activity_options_v106 link join public.activities activity on activity.id=link.activity_id and activity.is_active
 where link.target_id=p_target_id and link.activity_id=p_activity_id;
 if not found then raise exception 'Bu etkinlik kartın izinli seçenekleri arasında değil.'; end if;
 v_id:=public.send_uin_together_v71(p_target_id,p_recipient_id,p_date,p_place,left(v_activity_name||case when nullif(trim(coalesce(p_preference,'')),'') is null then '' else ' · '||trim(p_preference) end,300),p_note);
 update public.uin_together_proposals_v71 set activity_id=p_activity_id where id=v_id;
 return v_id;
end;$$;
revoke all on function public.send_uin_together_v106(uuid,uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.send_uin_together_v106(uuid,uuid,uuid,date,text,text,text) to authenticated;

insert into public.uin_card_activity_options_v106(target_id,activity_id,sort_order)
select target.id,activity.id,choice.sort_order
from public.canonical_targets target
cross join (values('Concert',1),('Festival',2),('Host a House Gathering',3)) choice(name,sort_order)
join public.activities activity on activity.name=choice.name and activity.is_active
where public.canonical_normalize_v31(target.title)=public.canonical_normalize_v31('Pink Floyd')
on conflict(target_id,activity_id) do update set sort_order=excluded.sort_order;

notify pgrst,'reload schema';
commit;
