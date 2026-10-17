-- Admin edits are explicit, audited and never impersonate a record owner.
alter table public.intents add column if not exists editorial_title text
  check (editorial_title is null or char_length(btrim(editorial_title)) between 2 and 180);

create or replace function public.admin_get_record_v202(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.intents%rowtype; p public.plans%rowtype; s public.seeds%rowtype;
  v jsonb; r jsonb; c text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.' using errcode='42501';
  end if;
  if p_kind='seed' then
    select * into s from public.seeds where id=p_id;
    if s.id is null then raise exception 'Kayıt bulunamadı.' using errcode='P0002'; end if;
    v:=to_jsonb(s);
    select jsonb_object_agg(key,value) into r from jsonb_each(v)
      where key=any(array['title','subtitle','notes','cover_url','target_date','visibility']);
    return jsonb_build_object('id',s.id,'kind','seed','ownerId',s.user_id,'status',s.status,
      'record',r,'revision',md5(v::text));
  elsif p_kind='event' then
    p_id:=public.resolve_event_record_v201(p_id);
    select x.* into i from public.intents x where x.id=p_id;
    if i.id is null then
      select x.* into i from public.intents x join public.plan_intents l on l.intent_id=x.id
        where l.plan_id=p_id and l.relationship='host_source' and l.status='active' limit 1;
    end if;
    select x.* into p from public.plans x where x.id=p_id or exists(
      select 1 from public.plan_intents l where l.plan_id=x.id and l.intent_id=i.id
        and l.relationship='host_source' and l.status='active')
      order by (x.id=p_id) desc limit 1;
    if i.id is null and p.id is null then raise exception 'Etkinlik bulunamadı.' using errcode='P0002'; end if;
    if i.id is not null then
      select cover_url into c from public.intent_custom_covers where intent_id=i.id;
    end if;
    v:=jsonb_build_object('intent',to_jsonb(i),'plan',to_jsonb(p),'cover',c);
    r:=jsonb_build_object(
      'title',coalesce(i.editorial_title,case when i.id is null then p.title end),
      'activity_id',coalesce(i.activity_id,p.activity_id),
      'location_id',coalesce(p.location_id,i.location_id),
      'canonical_target_id',i.canonical_target_id,
      'start_date',coalesce(p.window_start,i.start_date),'end_date',coalesce(p.window_end,i.end_date),
      'notes',coalesce(p.notes,i.notes),'max_participants',coalesce(p.max_participants,i.max_participants),
      'visibility',coalesce(p.visibility,i.visibility),
      'meeting_mode',coalesce(p.meeting_mode,i.meeting_mode,'in_person'),
      'online_provider',coalesce(p.online_provider,i.online_provider),'online_url',coalesce(p.online_url,i.online_url),
      'cover_url',coalesce(c,p.cover_url),
      'scheduled_start',p.scheduled_start,'scheduled_end',p.scheduled_end,
      'meeting_point',p.meeting_point,'timezone',p.timezone);
    return jsonb_build_object('id',coalesce(i.id,p.id),'kind','event','intentId',i.id,'planId',p.id,
      'ownerId',coalesce(i.user_id,p.host_user_id),'status',coalesce(p.status,i.status),
      'record',r,'revision',md5(v::text));
  end if;
  raise exception 'Geçersiz kayıt türü.' using errcode='22023';
end $$;

create or replace function public.admin_save_record_v202(p_kind text,p_id uuid,p_revision text,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b jsonb; a jsonb; r jsonb; v_allowed text[]; k text;
  i public.intents%rowtype; p public.plans%rowtype; s public.seeds%rowtype;
  ni public.intents%rowtype; np public.plans%rowtype; ns public.seeds%rowtype;
  v_old_context text:=current_setting('uin.admin_record_edit',true);
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.' using errcode='42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then
    raise exception 'Düzenlenecek alan bulunamadı.' using errcode='22023';
  end if;
  b:=public.admin_get_record_v202(p_kind,p_id);
  p_id:=(b->>'id')::uuid;
  -- Lock the canonical record before checking the revision, including alias requests.
  if p_kind='seed' then
    select * into s from public.seeds where id=p_id for update;
    v_allowed:=array['title','subtitle','notes','cover_url','target_date','visibility'];
  else
    if b->>'intentId' is not null then
      select * into i from public.intents where id=(b->>'intentId')::uuid for update;
    end if;
    if b->>'planId' is not null then
      select * into p from public.plans where id=(b->>'planId')::uuid for update;
    end if;
    v_allowed:=array['title','activity_id','location_id','canonical_target_id','start_date','end_date','notes',
      'max_participants','visibility','meeting_mode','online_provider','online_url','cover_url',
      'scheduled_start','scheduled_end','meeting_point','timezone'];
  end if;
  b:=public.admin_get_record_v202(p_kind,p_id);
  if p_revision is null or b->>'revision' is distinct from p_revision then
    raise exception 'Kayıt başka bir işlemle değişti. Yenileyip tekrar düzenle.' using errcode='40001';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not k=any(v_allowed) then raise exception 'Bu alan düzenlenemez: %',k using errcode='22023'; end if;
  end loop;
  r:=(b->'record')||p_patch;
  if char_length(coalesce(r->>'notes',''))>4000 then raise exception 'Açıklama en fazla 4000 karakter olabilir.'; end if;
  if nullif(btrim(r->>'title'),'') is not null and char_length(btrim(r->>'title')) not between 2 and 180 then
    raise exception 'Başlık 2–180 karakter olmalı.';
  end if;
  if nullif(r->>'cover_url','') is not null and ((r->>'cover_url')!~'^https://' or char_length(r->>'cover_url')>2000) then
    raise exception 'Görsel için geçerli bir HTTPS adresi gerekiyor.';
  end if;
  perform set_config('uin.admin_record_edit','on',true);
  if p_kind='seed' then
    if nullif(btrim(r->>'title'),'') is null then raise exception 'Başlık gerekli.'; end if;
    ns:=jsonb_populate_record(s,r);
    update public.seeds set title=btrim(ns.title),subtitle=nullif(btrim(ns.subtitle),''),notes=ns.notes,
      cover_url=nullif(ns.cover_url,''),target_date=ns.target_date,visibility=ns.visibility,updated_at=now()
      where id=s.id;
  else
    if r->>'activity_id' is null or r->>'location_id' is null then raise exception 'Etkinlik türü ve konum gerekli.'; end if;
    if r->>'meeting_mode' not in ('in_person','online','hybrid') then raise exception 'Geçerli bir buluşma biçimi seç.'; end if;
    if nullif(r->>'online_url','') is not null and ((r->>'online_url')!~'^https://' or char_length(r->>'online_url')>2000) then raise exception 'Çevrimiçi bağlantı HTTPS ile başlamalı.'; end if;
    if (r->>'start_date')::date>(r->>'end_date')::date then raise exception 'Bitiş tarihi başlangıçtan önce olamaz.'; end if;
    if i.id is not null then
      ni:=jsonb_populate_record(i,r);
      -- Update in one transaction; synchronization below preserves the plan lifecycle and owner.
      update public.intents set editorial_title=nullif(btrim(r->>'title'),''),activity_id=ni.activity_id,
        location_id=ni.location_id,canonical_target_id=ni.canonical_target_id,uin_main_card_explicit=true,
        start_date=ni.start_date,end_date=ni.end_date,notes=ni.notes,max_participants=ni.max_participants,
        visibility=ni.visibility,meeting_mode=ni.meeting_mode,online_provider=ni.online_provider,
        online_url=nullif(ni.online_url,''),updated_at=now() where id=i.id;
      if p_patch ? 'cover_url' then
        if nullif(r->>'cover_url','') is null then
          delete from public.intent_custom_covers where intent_id=i.id;
        else
          insert into public.intent_custom_covers(intent_id,owner_user_id,cover_url,updated_at)
            values(i.id,i.user_id,r->>'cover_url',now())
            on conflict(intent_id) do update set cover_url=excluded.cover_url,updated_at=excluded.updated_at;
        end if;
      end if;
    end if;
    if p.id is not null then
      np:=jsonb_populate_record(p,r||jsonb_build_object('window_start',r->'start_date','window_end',r->'end_date'));
      update public.plans set title=coalesce(nullif(btrim(r->>'title'),''),p.title),activity_id=np.activity_id,
        location_id=np.location_id,window_start=np.window_start,window_end=np.window_end,notes=np.notes,
        max_participants=np.max_participants,visibility=np.visibility,meeting_mode=np.meeting_mode,
        online_provider=np.online_provider,online_url=nullif(np.online_url,''),cover_url=nullif(np.cover_url,''),
        scheduled_start=np.scheduled_start,scheduled_end=np.scheduled_end,meeting_point=np.meeting_point,
        timezone=np.timezone,updated_at=now() where id=p.id;
    elsif p_patch ?| array['scheduled_start','scheduled_end','meeting_point','timezone'] then
      raise exception 'Kesin saat ve buluşma noktası için önce planlama odası açılmalı.';
    end if;
  end if;
  perform set_config('uin.admin_record_edit',coalesce(v_old_context,''),true);
  a:=public.admin_get_record_v202(p_kind,p_id);
  insert into public.admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'mobile_record_update',p_kind,p_id,jsonb_build_object('before',b,'after',a,'changedFields',(select jsonb_agg(key) from jsonb_object_keys(p_patch) key)));
  return a;
end $$;

revoke all on function public.admin_get_record_v202(text,uuid) from public,anon;
revoke all on function public.admin_save_record_v202(text,uuid,text,jsonb) from public,anon;
grant execute on function public.admin_get_record_v202(text,uuid) to authenticated;
grant execute on function public.admin_save_record_v202(text,uuid,text,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.protect_intent_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_details_changed boolean;
begin
  if old.user_id is distinct from new.user_id then
    raise exception
      'Intent ownership cannot be changed.';
  end if;

  v_details_changed :=
    (
      old.start_date,
      old.end_date,
      old.people,
      old.location_id,
      old.activity_id,
      old.budget,
      old.recurrence,
      old.visibility,
      old.notes,
      old.max_participants,
      old.timing_mode
    )
    is distinct from
    (
      new.start_date,
      new.end_date,
      new.people,
      new.location_id,
      new.activity_id,
      new.budget,
      new.recurrence,
      new.visibility,
      new.notes,
      new.max_participants,
      new.timing_mode
    );

  if not v_details_changed then
    return new;
  end if;

  if old.status <> 'active' and not (coalesce(current_setting('uin.admin_record_edit',true),'')='on' and auth.uid() is not null and public.is_admin()) then
    raise exception
      'Only active Intents can be edited.';
  end if;

  if not (coalesce(current_setting('uin.admin_record_edit',true),'')='on' and auth.uid() is not null and public.is_admin()) and exists (
    select 1
    from public.plan_intents
    where plan_intents.intent_id = old.id
      and plan_intents.status = 'active'
  ) then
    raise exception
      'An Intent linked to a shared Plan cannot be edited.';
  end if;

  if new.end_date < new.start_date then
    raise exception
      'End date cannot be earlier than start date.';
  end if;

  if new.max_participants is not null
     and new.max_participants < 1 then
    raise exception
      'Participant capacity must be at least 1.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_finalized_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not (coalesce(current_setting('uin.admin_record_edit',true),'')='on' and auth.uid() is not null and public.is_admin()) and old.status in (
    'planned',
    'completed',
    'cancelled'
  ) then
    if (
      old.title,
      old.activity_id,
      old.location_id,
      old.window_start,
      old.window_end,
      old.scheduled_start,
      old.scheduled_end,
      old.timezone,
      old.meeting_point,
      old.schedule_notes,
      old.target_budget
    ) is distinct from (
      new.title,
      new.activity_id,
      new.location_id,
      new.window_start,
      new.window_end,
      new.scheduled_start,
      new.scheduled_end,
      new.timezone,
      new.meeting_point,
      new.schedule_notes,
      new.target_budget
    ) then
      raise exception
        'A confirmed Activity schedule and target budget cannot be changed.';
    end if;
  end if;

  if old.status in (
    'planned',
    'completed',
    'cancelled'
  )
  and new.status = 'forming' then
    raise exception
      'A confirmed Activity cannot return to planning.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_expired_forming_plan_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if (coalesce(current_setting('uin.admin_record_edit',true),'')='on' and auth.uid() is not null and public.is_admin()) then return new; end if;
  if
    old.status = 'forming'
    and (
      old.expired_at is not null
      or coalesce(
        old.window_end,
        old.scheduled_end::date
      ) < current_date
    )
  then
    if
      (
        to_jsonb(new)
        - array[
            'expired_at',
            'recruitment_status',
            'updated_at'
          ]::text[]
      )
      is distinct from
      (
        to_jsonb(old)
        - array[
            'expired_at',
            'recruitment_status',
            'updated_at'
          ]::text[]
      )
    then
      raise exception
        'Expired forming Plans are read-only. Create a new Intent instead.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_plan_from_host_intent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan_id uuid;
begin
  if (coalesce(current_setting('uin.admin_record_edit',true),'')='on' and auth.uid() is not null and public.is_admin()) then return new; end if;
  select plan_id
  into v_plan_id
  from public.plan_intents
  where intent_id = new.id
    and relationship = 'host_source'
    and status = 'active'
  limit 1;

  if v_plan_id is null then
    return new;
  end if;

  update public.plans
  set
    activity_id = new.activity_id,
    location_id = new.location_id,
    window_start = new.start_date,
    window_end = new.end_date,
    budget = new.budget,
    max_participants =
      new.max_participants,
    notes = new.notes,
    visibility = new.visibility,

    status =
      case
        when new.status = 'planned'
          then 'planned'

        when new.status = 'completed'
          then 'completed'

        when new.status = 'cancelled'
          then 'cancelled'

        when new.status = 'active'
             and old.status = 'planned'
          then 'forming'

        else plans.status
      end,

    planned_at =
      case
        when new.status = 'planned'
          then coalesce(
            plans.planned_at,
            new.planned_at,
            now()
          )

        when new.status = 'active'
             and old.status = 'planned'
          then null

        else plans.planned_at
      end,

    completed_at =
      case
        when new.status = 'completed'
          then coalesce(
            plans.completed_at,
            now()
          )

        when new.status in (
          'active',
          'planned'
        )
          then null

        else plans.completed_at
      end,

    cancelled_at =
      case
        when new.status = 'cancelled'
          then coalesce(
            plans.cancelled_at,
            now()
          )

        when new.status in (
          'active',
          'planned',
          'completed'
        )
          then null

        else plans.cancelled_at
      end,

    updated_at = now()

  where id = v_plan_id;

  return new;
end;
$function$;

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
  v_location jsonb; v_place_title text; v_place_city text; v_meeting_mode text;
  v_sources jsonb; v_main jsonb;
begin
  p_resource_id := public.resolve_event_record_v201(p_resource_id);
  select i.* into v_intent
  from public.intents i
  where (i.id = p_resource_id or exists (
    select 1 from public.plan_intents pi
    where pi.plan_id = p_resource_id and pi.intent_id = i.id and pi.status = 'active'
  ))
    and public.intent_is_visible_to_viewer_v38(i.id, auth.uid())
  order by (i.id = p_resource_id) desc, exists(select 1 from public.plan_intents pi where pi.plan_id=p_resource_id and pi.intent_id=i.id and pi.relationship='host_source') desc, i.updated_at desc
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

  select coalesce(p.meeting_mode,v_intent.meeting_mode,'in_person'),
    coalesce(nullif(l.city,''),l.country_name),
    jsonb_build_object('locationId',l.id,'mode',coalesce(p.meeting_mode,v_intent.meeting_mode,'in_person'),
      'icon',case when coalesce(p.meeting_mode,v_intent.meeting_mode)='online' then '💻' else '📍' end,
      'title',case when coalesce(p.meeting_mode,v_intent.meeting_mode)='online' then
        'Çevrimiçi' || coalesce(' · ' || case coalesce(p.online_provider,v_intent.online_provider) when 'zoom' then 'Zoom' when 'google_meet' then 'Google Meet' when 'teams' then 'Microsoft Teams' when 'other' then 'Diğer platform' end,'')
      else coalesce(nullif(concat_ws(' / ',nullif(l.city,''),nullif(nullif(l.district,''),'Merkez')),''),nullif(l.country_name,''),'Yer bilgisi tamamlanmalı') ||
        case when coalesce(p.meeting_mode,v_intent.meeting_mode)='hybrid' then ' · Çevrimiçi katılım da var' else '' end end)
  into v_meeting_mode,v_place_city,v_location
  from public.locations l left join public.plans p on p.id=v_plan_id
  where l.id=coalesce((select location_id from public.plans where id=v_plan_id),v_intent.location_id);
  v_place_title:=v_location->>'title';
  if v_meeting_mode='online' then v_place_city:='Çevrimiçi'; end if;
  if nullif(v_place_title,'') is null then
    v_location:=jsonb_build_object('icon','📍','title','Yer bilgisi tamamlanmalı','mode',coalesce(v_meeting_mode,'in_person'));
  end if;
  v_primary_title:=public.event_catalogue_label_tr_v201(v_primary_title);
  v_title:=public.event_catalogue_label_tr_v201(coalesce(nullif(v_intent.editorial_title,''),nullif(v_activity.event_label,''),v_activity.name,'Etkinlik'));
  if v_has_dna and nullif(v_primary_title,'') is not null and lower(v_primary_title)<>lower(v_title) then
    v_title:=v_title||' · '||v_primary_title;
  end if;
  if nullif(v_place_city,'') is not null and not exists(
    select 1 from regexp_split_to_table(v_title,' · ') segment
    where public.canonical_normalize_v31(segment)=public.canonical_normalize_v31(v_place_city)
  ) then
    v_title:=v_title||' · '||v_place_city;
  end if;
  -- A catalogue source is DNA even when its name equals the activity title.
  select jsonb_build_object('targetId',t.id,'title',public.event_catalogue_label_tr_v201(t.title),
    'kind',coalesce(t.editorial_metadata->>'content_type_id',ci.item_kind,t.kind),'isPrimary',not v_has_dna or t.id=v_primary_target_id,
    'coverUrl',coalesce(t.editorial_cover_url,ci.cover_url)) into v_main
  from public.canonical_targets t left join lateral(select item_kind,cover_url from public.seed_catalog_items where canonical_target_id=t.id and status='active' order by updated_at desc,id limit 1)ci on true
  where t.id=v_intent.canonical_target_id and coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true';
  select coalesce(jsonb_agg(card),'[]'::jsonb) into v_sources from (
    select v_main card where v_main is not null
    union all select card from jsonb_array_elements(v_dna) card where card->>'targetId' is distinct from v_main->>'targetId'
  ) sources;

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
    'sourceCards',v_sources,
    'locationDna',v_location,
    'legacyTitle', v_intent.common_intent_subtitle,
    'aiCoverEnabled', v_ai_cover_enabled,
    'visualRuleVersion', 'uin-event-cover-v1'
  );
end;
$function$;
