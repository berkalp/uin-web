CREATE OR REPLACE FUNCTION public.get_uin_event_presentation_v86(p_resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_intent public.intents%rowtype;
  v_activity public.activities%rowtype;
  v_category_name text;
  v_plan_id uuid;
  v_primary_title text;
  v_primary_target_id uuid;
  v_primary_kind text;
  v_primary_cover text;
  v_dna jsonb := '[]'::jsonb;
  v_title text;
  v_has_dna boolean := false;
  v_ai_cover_enabled boolean := false;
begin
  select i.* into v_intent
  from public.intents i
  where (i.id = p_resource_id or exists (
    select 1 from public.plan_intents pi
    where pi.plan_id = p_resource_id and pi.intent_id = i.id and pi.status = 'active'
  ))
    and public.intent_is_visible_to_viewer_v38(i.id, auth.uid())
  order by (i.id = p_resource_id) desc, i.updated_at desc
  limit 1;

  if v_intent.id is null then return null; end if;

  select p.id into v_plan_id
  from public.plans p
  join public.plan_intents pi on pi.plan_id = p.id and pi.intent_id = v_intent.id and pi.status = 'active'
  order by (pi.relationship = 'host_source') desc, pi.created_at
  limit 1;

  select a.* into v_activity from public.activities a where a.id = v_intent.activity_id;
  select c.name into v_category_name from public.activity_categories c where c.id = v_activity.category_id;

  select t.title, t.kind,
         coalesce(t.editorial_cover_url, card.cover_url)
  into v_primary_title, v_primary_kind, v_primary_cover
  from public.canonical_targets t
  left join lateral (
    select ci.cover_url from public.seed_catalog_items ci
    where ci.canonical_target_id = t.id and ci.status = 'active'
    order by ci.updated_at desc, ci.id limit 1
  ) card on true
  where t.id = v_intent.canonical_target_id;

  v_primary_target_id := v_intent.canonical_target_id;
  v_has_dna := v_primary_kind <> 'activity' and lower(btrim(coalesce(v_primary_title,''))) <> lower(btrim(coalesce(v_activity.name,'')));
  if not v_has_dna then
    select t.id,t.title,t.kind,coalesce(t.editorial_cover_url,card.cover_url)
    into v_primary_target_id,v_primary_title,v_primary_kind,v_primary_cover
    from public.seed_intent_links l join public.seeds s on s.id=l.seed_id
    join public.canonical_targets t on t.id=s.canonical_target_id
    left join lateral(select ci.cover_url from public.seed_catalog_items ci where ci.canonical_target_id=t.id and ci.status='active' order by ci.updated_at desc,ci.id limit 1)card on true
    where l.intent_id=v_intent.id and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=t.id and ci.status='active')
    order by (l.relationship='spawned_from') desc,l.created_at,l.id limit 1;
    v_has_dna := v_primary_target_id is not null and lower(btrim(coalesce(v_primary_title,''))) <> lower(btrim(coalesce(v_activity.name,'')));
    if not v_has_dna then v_primary_target_id:=v_intent.canonical_target_id; end if;
  end if;

  with candidate_ids as (
    select v_primary_target_id id,true is_primary,0 sort_order where v_has_dna
    union all select r.target_id,false,1 from public.uin_event_related_cards_v72 r where r.intent_id=v_intent.id
    union all select s.canonical_target_id,(s.canonical_target_id=v_primary_target_id),2 from public.seed_intent_links l join public.seeds s on s.id=l.seed_id where l.intent_id=v_intent.id and s.canonical_target_id is not null and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=s.canonical_target_id and ci.status='active')
  ),deduped as(select id,bool_or(is_primary) is_primary,min(sort_order) sort_order from candidate_ids where id is not null group by id),cards as (
    select t.id, t.title, t.kind, d.is_primary, d.sort_order,
           coalesce(t.editorial_cover_url, card.cover_url) as cover_url
    from deduped d join public.canonical_targets t on t.id=d.id
    left join lateral (
      select ci.cover_url from public.seed_catalog_items ci
      where ci.canonical_target_id=t.id and ci.status='active'
      order by ci.updated_at desc, ci.id limit 1
    ) card on true
    where coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'targetId', id, 'title', title, 'kind', kind,
    'isPrimary', is_primary, 'coverUrl', cover_url
  ) order by sort_order, lower(title), id), '[]'::jsonb)
  into v_dna from cards;

  v_title := coalesce(nullif(btrim(v_activity.event_label), ''), nullif(btrim(v_activity.name), ''), 'UIN Aktivitesi');
  if v_has_dna and nullif(btrim(v_primary_title), '') is not null then
    v_title := v_title || ' · ' || btrim(v_primary_title);
  end if;

  -- Presentation only: preserve source IDs and all intent/experience records.
  -- Prefer the existing Turkish activity label and collapse spelling aliases in display DNA.
  with translated as (
    select card, ordinal,
      case when lower(card->>'title') in ('istanbul','i̇stanbul') then 'İstanbul'
        else coalesce((select nullif(btrim(a.event_label),'') from public.activities a
          where lower(btrim(a.name))=lower(btrim(card->>'title')) order by a.id limit 1),card->>'title') end as label
    from jsonb_array_elements(v_dna) with ordinality as entry(card,ordinal)
  ), distinct_labels as (
    select distinct on (lower(label)) card,ordinal,label
    from translated
    where lower(btrim(label)) <> lower(btrim(coalesce(v_activity.event_label,v_activity.name)))
    order by lower(label), (card->>'isPrimary')::boolean desc, (nullif(card->>'coverUrl','') is not null) desc, ordinal
  )
  select coalesce(jsonb_agg(jsonb_set(card,'{title}',to_jsonb(label)) order by ordinal),'[]'::jsonb)
    into v_dna from distinct_labels;

  if lower(v_primary_title) in ('istanbul','i̇stanbul') then v_primary_title := 'İstanbul'; end if;
  if lower(btrim(v_primary_title)) = lower(btrim(v_activity.name)) then
    v_primary_title := coalesce(nullif(btrim(v_activity.event_label),''),v_activity.name);
  end if;
  v_title := coalesce(nullif(btrim(v_activity.event_label),''),nullif(btrim(v_activity.name),''),'Etkinlik');
  if v_has_dna and nullif(btrim(v_primary_title),'') is not null and lower(btrim(v_primary_title))<>lower(btrim(v_title)) then
    v_title := v_title || ' · ' || v_primary_title;
  end if;

  select coalesce(enabled,false) into v_ai_cover_enabled from public.uin_feature_flags_v86 where feature_key='ai_event_covers';

  return jsonb_build_object(
    'intentId', v_intent.id,
    'planId', v_plan_id,
    'activityId', v_activity.id,
    'intentLabel', coalesce(v_activity.intent_label, v_activity.name),
    'eventLabel', coalesce(v_activity.event_label, v_activity.name),
    'categoryId', v_activity.category_id,
    'categoryName', v_category_name,
    'displayTitle', v_title,
    'mainTarget', jsonb_build_object(
      'targetId', v_primary_target_id, 'title', v_primary_title,
      'kind', v_primary_kind, 'coverUrl', v_primary_cover
    ),
    'primaryDna', case when v_has_dna then jsonb_build_object(
      'targetId', v_primary_target_id, 'title', v_primary_title,
      'kind', v_primary_kind, 'coverUrl', v_primary_cover
    ) else null end,
    'dnaCards', v_dna,
    'legacyTitle', v_intent.common_intent_subtitle,
    'aiCoverEnabled', v_ai_cover_enabled,
    'visualRuleVersion', 'uin-event-cover-v1'
  );
end;
$function$;

