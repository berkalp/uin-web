-- Explicit viewer-authorized aggregate over existing internal projections.
-- The privileged implementation is outside the exposed API schema.
create schema if not exists uin_private;
grant usage on schema uin_private to authenticated;
create or replace function uin_private.library_audience_v20261014(p_audience text)
returns table(scope text,target_id uuid,user_ids uuid[],event_ids uuid[],content_type_ids text[])
language sql stable security definer set search_path=public,pg_temp
as $function$
with friends as materialized (
 select other_user_id from public.get_my_friendships() where friendship_status='accepted'
), people as materialized (
 select p.*,public.resolve_uin_card_target_v129(p.target_id) resolved_id
 from public.visible_common_target_people_v38() p
 where (select auth.uid()) is not null and p_audience in ('everyone','friends')
 and (p_audience='everyone' or p.user_id in(select other_user_id from friends))
 and (p.relationship_status='completed' or p.target_date is null or p.target_date >= (now() at time zone 'Europe/Istanbul')::date)
), active_events as materialized (
 select i.id intent_id,coalesce(plan.id,i.id) resource_id,plan.id plan_id,i.user_id,i.canonical_target_id,i.location_id
 from public.intents i
 left join lateral (
  select p.id,p.status,p.scheduled_start,p.scheduled_end from public.plan_intents pi
  join public.plans p on p.id=pi.plan_id where pi.intent_id=i.id and pi.status='active'
  order by pi.linked_at desc limit 1
 ) plan on true
 where (select auth.uid()) is not null and p_audience in ('everyone','friends')
 and i.status in ('active','planned') and public.intent_is_visible_to_viewer_v38(i.id,auth.uid())
 and coalesce(plan.status,'') not in ('completed','cancelled','canceled')
 and (coalesce(plan.scheduled_end::date,i.end_date,plan.scheduled_start::date,i.start_date) is null
 or coalesce(plan.scheduled_end::date,i.end_date,plan.scheduled_start::date,i.start_date)>=(now() at time zone 'Europe/Istanbul')::date)
), actors as materialized (
 select e.intent_id,e.user_id from active_events e where e.plan_id is null
 union select e.intent_id,p.host_user_id from active_events e join public.plans p on p.id=e.plan_id
 union select e.intent_id,p.user_id from active_events e join public.intent_participants p on p.intent_id=e.intent_id and p.status='active' where e.plan_id is null
 union select e.intent_id,p.user_id from active_events e join public.plan_members p on p.plan_id=e.plan_id and p.status='active'
), selected_actors as materialized (
 select a.* from actors a where a.user_id is not null and (p_audience='everyone' or a.user_id in(select other_user_id from friends))
), location_names as materialized (
 select e.intent_id,unnest(array[public.canonical_normalize_v31(coalesce(l.district,'')),public.canonical_normalize_v31(coalesce(l.city,'')),public.canonical_normalize_v31(coalesce(l.country_name,''))]) name
 from active_events e join public.locations l on l.id=e.location_id
), event_links as materialized (
 select e.intent_id,public.resolve_uin_card_target_v129(e.canonical_target_id) target_id from active_events e
 union
 select e.intent_id,public.resolve_uin_card_target_v129(coalesce(s.canonical_target_id,c.canonical_target_id))
 from active_events e join public.seed_intent_links l on l.intent_id=e.intent_id
 join public.seeds s on s.id=l.seed_id left join public.seed_catalog_items c on c.id=s.catalog_item_id
 where coalesce(s.canonical_target_id,c.canonical_target_id) is not null
 union
 select n.intent_id,t.id from public.canonical_targets t
 join location_names n on n.name<>'' and public.canonical_normalize_v31(t.title)=n.name
 where coalesce(t.editorial_metadata->>'content_type_id','')='place'
 or exists(select 1 from public.seed_catalog_items c where c.canonical_target_id=t.id and c.item_kind='place')
), memberships as (
 select case when p.relationship_status='completed' then 'experiences' else 'wishes' end scope,
 p.resolved_id target_id,p.user_id,null::uuid event_id
 from people p where p.source_kind in ('seed','personal') and p.resolved_id is not null
 union all
 select 'plans',l.target_id,p.user_id,e.resource_id
 from selected_actors p join active_events e on e.intent_id=p.intent_id
 join event_links l on l.intent_id=e.intent_id
 where l.target_id is not null
), grouped as materialized (
 select m.scope,m.target_id,array_agg(distinct m.user_id) user_ids,
 coalesce(array_agg(distinct m.event_id) filter(where m.event_id is not null),array[]::uuid[]) event_ids
 from memberships m group by m.scope,m.target_id
), categories as materialized (
 select (c->>'target_id')::uuid target_id, array(select jsonb_array_elements_text(c->'content_type_ids')) content_type_ids from jsonb_array_elements(public.get_uin_card_content_types_v177(
 coalesce((select array_agg(distinct g.target_id) from grouped g),array[]::uuid[]))) c
)
select g.scope,g.target_id,g.user_ids,g.event_ids,c.content_type_ids
from grouped g join categories c on c.target_id=g.target_id;
$function$;
revoke all on function uin_private.library_audience_v20261014(text) from public,anon;
grant execute on function uin_private.library_audience_v20261014(text) to authenticated;
create or replace function public.get_uin_library_audience_v20261014(p_audience text)
returns table(scope text,target_id uuid,user_ids uuid[],event_ids uuid[],content_type_ids text[])
language sql stable security invoker set search_path=public,pg_temp
as $$ select * from uin_private.library_audience_v20261014(p_audience) where (select auth.uid()) is not null; $$;
revoke all on function public.get_uin_library_audience_v20261014(text) from public,anon;
grant execute on function public.get_uin_library_audience_v20261014(text) to authenticated;
