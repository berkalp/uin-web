create or replace function public.admin_get_record_v202(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.intents%rowtype; p public.plans%rowtype; s public.seeds%rowtype;
  v jsonb; r jsonb; c text; pi public.canonical_personal_intents_v38%rowtype; ps public.seed_personal_state_v15%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.' using errcode='42501';
  end if;
  if p_kind='personal' then
    select * into pi from public.canonical_personal_intents_v38 where id=p_id;
    if pi.id is null then raise exception 'Niyet bulunamadı.' using errcode='P0002'; end if;
    v:=to_jsonb(pi);
    select jsonb_object_agg(key,value) into r from jsonb_each(v)
      where key=any(array['start_date','end_date','notes','location_id','visibility']);
    return jsonb_build_object('id',pi.id,'kind','personal','ownerId',pi.user_id,'status',pi.status,
      'targetId',pi.target_id,'record',r,'revision',md5(v::text));
  elsif p_kind='seed' then
    select * into s from public.seeds where id=p_id;
    if s.id is null then raise exception 'Kayıt bulunamadı.' using errcode='P0002'; end if;
    select * into ps from public.seed_personal_state_v15 where seed_id=s.id;
    v:=to_jsonb(s);
    select jsonb_object_agg(key,value) into r from jsonb_each(v)
      where key=any(array['title','subtitle','notes','cover_url','target_date','visibility']);
    r:=jsonb_set(r,'{cover_url}',coalesce(to_jsonb(coalesce(ps.personal_cover_url,s.cover_url)),'null'::jsonb));
    v:=jsonb_build_object('seed',v,'personalState',to_jsonb(ps));
    return jsonb_build_object('id',s.id,'kind','seed','ownerId',s.user_id,'status',s.status,
      'targetId',s.canonical_target_id,'record',r,'revision',md5(v::text));
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
      'activity_id',coalesce(i.activity_id,p.activity_id),'sport_id',i.sport_id,
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
  pi public.canonical_personal_intents_v38%rowtype; npi public.canonical_personal_intents_v38%rowtype;
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
  if p_kind='personal' then
    select * into pi from public.canonical_personal_intents_v38 where id=p_id for update;
    v_allowed:=array['start_date','end_date','location_id','notes','visibility'];
  elsif p_kind='seed' then
    select * into s from public.seeds where id=p_id for update;
    perform 1 from public.seed_personal_state_v15 where seed_id=p_id for update;
    v_allowed:=array['title','subtitle','notes','cover_url','target_date','visibility'];
  else
    if b->>'intentId' is not null then
      select * into i from public.intents where id=(b->>'intentId')::uuid for update;
    end if;
    if b->>'planId' is not null then
      select * into p from public.plans where id=(b->>'planId')::uuid for update;
    end if;
    v_allowed:=array['title','activity_id','sport_id','location_id','canonical_target_id','start_date','end_date','notes',
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
  if p_kind='personal' then
    npi:=jsonb_populate_record(pi,r);
    update public.canonical_personal_intents_v38 set start_date=npi.start_date,end_date=npi.end_date,
      location_id=npi.location_id,notes=npi.notes,visibility=npi.visibility,updated_at=now(),
      timing_precision=case when p_patch ?| array['start_date','end_date'] then
        case when npi.start_date is null then 'flexible' when npi.end_date is null or npi.end_date=npi.start_date then 'day' else 'range' end
        else pi.timing_precision end,
      date_options=case when p_patch ?| array['start_date','end_date'] then '[]'::jsonb else pi.date_options end
      where id=pi.id;
  elsif p_kind='seed' then
    if nullif(btrim(r->>'title'),'') is null then raise exception 'Başlık gerekli.'; end if;
    ns:=jsonb_populate_record(s,r);
    update public.seeds set title=btrim(ns.title),subtitle=nullif(btrim(ns.subtitle),''),notes=ns.notes,
      cover_url=nullif(ns.cover_url,''),target_date=ns.target_date,visibility=ns.visibility,updated_at=now()
      where id=s.id;
    if p_patch ? 'cover_url' then
      update public.seed_personal_state_v15 set personal_cover_url=nullif(ns.cover_url,''),updated_at=now() where seed_id=s.id;
    end if;
  else
    if r->>'activity_id' is null or r->>'location_id' is null then raise exception 'Etkinlik türü ve konum gerekli.'; end if;
    if r->>'meeting_mode' not in ('in_person','online','hybrid') then raise exception 'Geçerli bir buluşma biçimi seç.'; end if;
    if nullif(r->>'online_url','') is not null and ((r->>'online_url')!~'^https://' or char_length(r->>'online_url')>2000) then raise exception 'Çevrimiçi bağlantı HTTPS ile başlamalı.'; end if;
    if (r->>'start_date')::date>(r->>'end_date')::date then raise exception 'Bitiş tarihi başlangıçtan önce olamaz.'; end if;
    if i.id is not null then
      ni:=jsonb_populate_record(i,r);
      -- Update in one transaction; synchronization below preserves the plan lifecycle and owner.
      update public.intents set editorial_title=nullif(btrim(r->>'title'),''),activity_id=ni.activity_id,sport_id=ni.sport_id,
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
        timezone=np.timezone,
        latitude=case when np.location_id is distinct from p.location_id then null else p.latitude end,
        longitude=case when np.location_id is distinct from p.location_id then null else p.longitude end,
        address_text=case when np.location_id is distinct from p.location_id then null else p.address_text end,
        map_url=case when np.location_id is distinct from p.location_id then null else p.map_url end,
        street_view_url=case when np.location_id is distinct from p.location_id then null else p.street_view_url end,
        activity_latitude=case when np.location_id is distinct from p.location_id then null else p.activity_latitude end,
        activity_longitude=case when np.location_id is distinct from p.location_id then null else p.activity_longitude end,
        activity_address_text=case when np.location_id is distinct from p.location_id then null else p.activity_address_text end,
        activity_map_url=case when np.location_id is distinct from p.location_id then null else p.activity_map_url end,
        activity_street_view_url=case when np.location_id is distinct from p.location_id then null else p.activity_street_view_url end,
        updated_at=now() where id=p.id;
    elsif p_patch ?| array['scheduled_start','scheduled_end','meeting_point','timezone'] then
      raise exception 'Kesin saat ve buluşma noktası için önce planlama odası açılmalı.';
    end if;
  end if;
  perform set_config('uin.admin_record_edit',coalesce(v_old_context,''),true);
  a:=public.admin_get_record_v202(p_kind,p_id);
  insert into public.admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'mobile_record_update',p_kind,p_id,jsonb_build_object('before',b,'after',a,'previousPlan',case when p.id is not null then to_jsonb(p) end,'changedFields',(select jsonb_agg(key) from jsonb_object_keys(p_patch) key)));
  return a;
end $$;

revoke all on function public.admin_get_record_v202(text,uuid) from public,anon;
revoke all on function public.admin_save_record_v202(text,uuid,text,jsonb) from public,anon;
grant execute on function public.admin_get_record_v202(text,uuid) to authenticated;
grant execute on function public.admin_save_record_v202(text,uuid,text,jsonb) to authenticated;
