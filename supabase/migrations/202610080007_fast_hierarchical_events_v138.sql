begin;
set local lock_timeout='30s';
set local statement_timeout='5min';
set local search_path=public,extensions;

-- Read a whole card tree in one pass. The previous implementation invoked the
-- legacy event reader once for every descendant, and each invocation scanned
-- intents, locations and plans again. Large place trees such as Istanbul could
-- therefore exceed the statement timeout while opening a card.
create or replace function public.get_uin_card_events_v81(p_target_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
with closure as materialized (
  select descendant.target_id,descendant.depth,target.title,
    coalesce(target.editorial_metadata->>'content_type_id','')='place'
      or exists (
        select 1 from public.seed_catalog_items place_item
        where place_item.canonical_target_id=target.id and place_item.item_kind='place'
      ) is_place
  from public.get_uin_card_descendants_v81(p_target_id,true) descendant
  join public.canonical_targets target on target.id=descendant.target_id
), linked_candidates as materialized (
  select intent.id intent_id,closure.target_id,closure.title,closure.depth
  from public.intents intent
  join closure on closure.target_id=intent.canonical_target_id

  union all

  select intent.id,closure.target_id,closure.title,closure.depth
  from public.seed_intent_links seed_link
  join public.intents intent on intent.id=seed_link.intent_id
  join public.seeds seed on seed.id=seed_link.seed_id
  left join public.seed_catalog_items item on item.id=seed.catalog_item_id
  join closure on closure.target_id=coalesce(seed.canonical_target_id,item.canonical_target_id)

  union all

  select intent.id,closure.target_id,closure.title,closure.depth
  from public.intents intent
  join public.locations location on location.id=intent.location_id
  join closure on closure.is_place and public.canonical_normalize_v31(closure.title) in (
    public.canonical_normalize_v31(coalesce(location.district,'')),
    public.canonical_normalize_v31(coalesce(location.city,'')),
    public.canonical_normalize_v31(coalesce(location.country_name,''))
  )
), linked as materialized (
  select distinct on(intent_id) intent_id,target_id,title
  from linked_candidates
  order by intent_id,depth desc,target_id
), rows as materialized (
  select intent.*,linked.target_id source_target_id,linked.title source_target_title,
    location.district,location.city,location.country_name,
    linked_plan.plan_id,linked_plan.plan_status,linked_plan.scheduled_start,linked_plan.scheduled_end,
    case
      when coalesce(intent.status,'') in('cancelled','canceled') or coalesce(linked_plan.plan_status,'') in('cancelled','canceled') then 'cancelled'
      when coalesce(intent.status,'')='completed' or coalesce(linked_plan.plan_status,'')='completed' then 'completed'
      when coalesce(linked_plan.scheduled_end::date,intent.end_date,linked_plan.scheduled_start::date,intent.start_date)<(now() at time zone 'Europe/Istanbul')::date then 'expired'
      else 'active'
    end event_state
  from linked
  join public.intents intent on intent.id=linked.intent_id
  left join public.locations location on location.id=intent.location_id
  left join lateral (
    select plan.id plan_id,plan.status plan_status,plan.scheduled_start,plan.scheduled_end
    from public.plan_intents plan_link
    join public.plans plan on plan.id=plan_link.plan_id
    where plan_link.intent_id=intent.id and plan_link.status='active'
    order by plan_link.linked_at desc
    limit 1
  ) linked_plan on true
  where intent.status in('active','planned','completed','cancelled','canceled')
    and public.intent_is_visible_to_viewer_v38(intent.id,auth.uid())
)
select jsonb_build_object(
  'target_id',p_target_id,
  'source_target_id',row.source_target_id,
  'source_target_title',row.source_target_title,
  'intent_id',row.id,
  'plan_id',row.plan_id,
  'resource_id',coalesce(row.plan_id,row.id),
  'subtitle',row.common_intent_subtitle,
  'start_date',row.start_date,
  'end_date',row.end_date,
  'visibility',row.visibility,
  'status',row.status,
  'plan_status',row.plan_status,
  'event_state',row.event_state,
  'location',nullif(concat_ws(', ',nullif(row.district,''),nullif(row.city,''),nullif(row.country_name,'')),''),
  'owner_user_id',row.user_id,
  'owner_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
  'owner_username',profile.username,
  'owner_avatar_url',profile.avatar_url,
  'participant_count',1+(
    select count(*) from public.intent_participants participant
    where participant.intent_id=row.id and participant.status='active' and participant.user_id<>row.user_id
  ),
  'participants',jsonb_build_array(jsonb_build_object(
    'user_id',row.user_id,'full_name',coalesce(profile.full_name,profile.username,'UIN üyesi'),
    'username',profile.username,'avatar_url',profile.avatar_url,'role','owner'
  ))||coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',member.id,'full_name',coalesce(member.full_name,member.username,'UIN üyesi'),
      'username',member.username,'avatar_url',member.avatar_url,'role','participant'
    ) order by participant.joined_at)
    from public.intent_participants participant
    join public.profiles member on member.id=participant.user_id
    where participant.intent_id=row.id and participant.status='active' and participant.user_id<>row.user_id
  ),'[]'::jsonb),
  'max_participants',row.max_participants,
  'viewer_is_owner',row.user_id=auth.uid(),
  'viewer_is_member',row.user_id=auth.uid() or exists(
    select 1 from public.intent_participants participant
    where participant.intent_id=row.id and participant.user_id=auth.uid() and participant.status='active'
  )
)
from rows row
join public.profiles profile on profile.id=row.user_id
order by case row.event_state when 'active' then 0 when 'completed' then 1 when 'expired' then 2 else 3 end,
  case when row.event_state='active' then row.start_date end,row.end_date desc,row.id;
$function$;

revoke all on function public.get_uin_card_events_v81(uuid) from public;
grant execute on function public.get_uin_card_events_v81(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
