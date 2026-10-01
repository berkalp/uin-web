begin;

alter table public.activities add column if not exists intent_label text;
alter table public.activities add column if not exists event_label text;

update public.activities
set intent_label = coalesce(nullif(btrim(intent_label), ''), name),
    event_label = coalesce(nullif(btrim(event_label), ''), name);

update public.activities a
set intent_label = labels.intent_label,
    event_label = labels.event_label
from (values
  ('Nature Trip', 'Doğa Gezisi', 'Doğa Gezisi'),
  ('Cultural Trip', 'Kültür Gezisi', 'Kültür Gezisi'),
  ('City Walk', 'Şehir Yürüyüşü', 'Şehir Yürüyüşü'),
  ('Beach Trip', 'Sahil Gezisi', 'Sahil Gezisi'),
  ('Walking', 'Yürüyüş', 'Yürüyüş'),
  ('Family Picnic', 'Aile Pikniği', 'Aile Pikniği'),
  ('Bicycle Tour', 'Bisiklet Turu', 'Bisiklet Turu'),
  ('Video Gaming Meetup', 'Video Oyunu Buluşması', 'Video Oyunu Buluşması'),
  ('Watch a Sports Broadcast Together', 'Birlikte Spor Yayını İzlemek', 'Birlikte Spor Yayını'),
  ('Sing Karaoke', 'Karaoke Söylemek', 'Karaoke'),
  ('Camping', 'Kamp Yapmak', 'Kamp'),
  ('Coworking Session', 'Birlikte Çalışma', 'Birlikte Çalışma'),
  ('Have Dinner Together', 'Birlikte Akşam Yemeği', 'Birlikte Akşam Yemeği'),
  ('Dinner Meetup', 'Akşam Yemeği Buluşması', 'Akşam Yemeği Buluşması'),
  ('Cycling', 'Bisiklete Binmek', 'Bisiklet'),
  ('Concert', 'Konsere Gitmek', 'Konser'),
  ('Host a House Gathering', 'Ev Buluşması Düzenlemek', 'Ev Buluşması'),
  ('Join a Social Gathering', 'Sosyal Buluşmaya Katılmak', 'Sosyal Buluşma'),
  ('Forest Walk', 'Orman Yürüyüşü', 'Orman Yürüyüşü'),
  ('Watch Sports Live at the Venue', 'Sporu Yerinde Canlı İzlemek', 'Sporu Yerinde Canlı İzleme'),
  ('Rowing', 'Kürek', 'Kürek'),
  ('Road Trip', 'Araba Yolculuğu', 'Araba Yolculuğu'),
  ('Day Trip', 'Günübirlik Gezi', 'Günübirlik Gezi'),
  ('Festival', 'Festivale Gitmek', 'Festival'),
  ('Photography Walk', 'Fotoğraf Yürüyüşü', 'Fotoğraf Yürüyüşü')
) as labels(source_name, intent_label, event_label)
where lower(a.name) = lower(labels.source_name);

alter table public.activities alter column intent_label set not null;
alter table public.activities alter column event_label set not null;

comment on column public.activities.intent_label is 'Catalogue label used while choosing what the member wants to do.';
comment on column public.activities.event_label is 'Catalogue label used after an Intent becomes an Event, Plan or Experience.';

create table if not exists public.uin_feature_flags_v86 (
  feature_key text primary key,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.uin_feature_flags_v86(feature_key,enabled,configuration)
values('ai_event_covers',false,jsonb_build_object('reason','No configured image generation service','visualRuleVersion','uin-event-cover-v1'))
on conflict(feature_key) do nothing;
alter table public.uin_feature_flags_v86 enable row level security;
revoke all on public.uin_feature_flags_v86 from public,anon,authenticated;
create table if not exists public.event_cover_generations_v86 (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intents(id) on delete cascade,
  context_hash text not null,
  visual_rule_version text not null default 'uin-event-cover-v1',
  status text not null default 'queued' check (status in ('queued','processing','approved','failed','superseded')),
  cover_url text,
  prompt_payload jsonb not null default '{}'::jsonb,
  error_code text,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(intent_id, context_hash, visual_rule_version)
);

comment on table public.event_cover_generations_v86 is 'Feature-flagged server-side AI cover jobs. No client supplied prompt or personal text is stored.';
alter table public.event_cover_generations_v86 enable row level security;
revoke all on public.event_cover_generations_v86 from public, anon, authenticated;

create or replace function public.uin_event_display_title_v86(p_intent_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_base text;v_activity_name text;v_target_title text;v_target_kind text;v_seed_title text;
begin
 select coalesce(nullif(btrim(a.event_label),''),nullif(btrim(a.name),''),'UIN Aktivitesi'),a.name,t.title,t.kind
 into v_base,v_activity_name,v_target_title,v_target_kind from public.intents i join public.activities a on a.id=i.activity_id join public.canonical_targets t on t.id=i.canonical_target_id where i.id=p_intent_id;
 if lower(btrim(coalesce(v_target_title,'')))=lower(btrim(coalesce(v_activity_name,''))) or v_target_kind='activity' then
  select t.title into v_seed_title from public.seed_intent_links l join public.seeds s on s.id=l.seed_id join public.canonical_targets t on t.id=s.canonical_target_id
  where l.intent_id=p_intent_id and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=t.id and ci.status='active')
  order by (l.relationship='spawned_from') desc,l.created_at,l.id limit 1;
  v_target_title:=v_seed_title;
 end if;
 return v_base||case when nullif(btrim(v_target_title),'') is not null and lower(btrim(v_target_title))<>lower(btrim(v_activity_name)) then ' · '||btrim(v_target_title) else '' end;
end;$$;

create or replace function public.get_uin_event_presentation_v86(p_resource_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
$$;

create or replace function public.update_my_event_activity_dna_v86(
  p_resource_id uuid,
  p_activity_id uuid,
  p_primary_target_id uuid,
  p_related_target_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intent_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
  if not exists(select 1 from public.activities where id=p_activity_id) then raise exception 'Aktivite bulunamadı.'; end if;
  if not exists(select 1 from public.canonical_targets where id=p_primary_target_id and coalesce(editorial_metadata->>'admin_hidden','false')<>'true') then raise exception 'Ana DNA kartı bulunamadı.'; end if;
  if coalesce(array_length(p_related_target_ids,1),0)>5 then raise exception 'En fazla 5 ek DNA kartı seçebilirsin.'; end if;
  if exists(select 1 from unnest(coalesce(p_related_target_ids,'{}')) id where id is null or not exists(select 1 from public.canonical_targets t where t.id=id and coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true')) then raise exception 'DNA kartlarından biri bulunamadı.'; end if;

  select i.id into v_intent_id
  from public.intents i
  left join public.plan_intents pi on pi.intent_id=i.id and pi.plan_id=p_resource_id and pi.status='active'
  left join public.plans p on p.id=pi.plan_id
  where (i.id=p_resource_id or pi.plan_id=p_resource_id)
    and (i.user_id=v_user_id or p.host_user_id=v_user_id or exists(
      select 1 from public.plan_members pm where pm.plan_id=p.id and pm.user_id=v_user_id and pm.status='active' and pm.role='co_host'
    ))
  order by (i.id=p_resource_id) desc, (pi.relationship='host_source') desc
  limit 1 for update of i;

  if v_intent_id is null then raise exception 'Etkinlik bulunamadı veya yetkin yok.' using errcode='42501'; end if;

  update public.intents set activity_id=p_activity_id, canonical_target_id=p_primary_target_id,
    uin_main_card_explicit=true, updated_at=now() where id=v_intent_id;
  delete from public.uin_event_related_cards_v72 where intent_id=v_intent_id;
  insert into public.uin_event_related_cards_v72(intent_id,target_id)
  select v_intent_id,id from (select distinct unnest(coalesce(p_related_target_ids,'{}'::uuid[])) id) x
  where id<>p_primary_target_id;
  update public.event_cover_generations_v86 set status='superseded'
  where intent_id=v_intent_id and status in ('queued','processing','approved');
  return public.get_uin_event_presentation_v86(v_intent_id);
end;
$$;

create or replace function public.update_shared_activity_title(p_plan_id uuid,p_shared_title text,p_visibility text default 'participants')
returns text language plpgsql security definer set search_path=public as $$
begin
  raise exception 'Etkinlik başlığı aktivite ve DNA kartlarından otomatik oluşturulur. “Aktivite ve DNA’yı düzenle” akışını kullan.' using errcode='0A000';
end;$$;

create or replace function public.update_plan_custom_cover(p_plan_id uuid,p_cover_url text default null,p_storage_path text default null,p_visibility text default 'participants')
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  raise exception 'Etkinlik kapağı sistem tarafından yönetilir; doğrudan kapak yüklenemez.' using errcode='0A000';
end;$$;

create or replace function public.set_my_intent_custom_cover(p_intent_id uuid,p_cover_url text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();v_clean_url text:=nullif(btrim(coalesce(p_cover_url,'')),'');
begin
 if v_user_id is null then raise exception 'Authentication required.' using errcode='42501'; end if;
 if not exists(select 1 from public.intents i where i.id=p_intent_id and i.user_id=v_user_id) then raise exception 'Intent not found or not owned by you.' using errcode='42501'; end if;
 if exists(select 1 from public.plan_intents pi where pi.intent_id=p_intent_id and pi.status='active') then
  raise exception 'Etkinlik kapağı sistem tarafından yönetilir; doğrudan kapak yüklenemez.' using errcode='0A000';
 end if;
 if v_clean_url is null then delete from public.intent_custom_covers where intent_id=p_intent_id and owner_user_id=v_user_id;return;end if;
 if char_length(v_clean_url)>2000 or v_clean_url!~*'^https://' then raise exception 'Cover must be a valid HTTPS image URL.' using errcode='22023';end if;
 insert into public.intent_custom_covers(intent_id,owner_user_id,cover_url,updated_at) values(p_intent_id,v_user_id,v_clean_url,now())
 on conflict(intent_id) do update set owner_user_id=excluded.owner_user_id,cover_url=excluded.cover_url,updated_at=now();
end;$$;

create or replace function public.protect_event_custom_cover_v86()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_intent_id uuid;
begin
 v_intent_id:=case when tg_op='DELETE' then old.intent_id else new.intent_id end;
 if auth.uid() is not null and exists(select 1 from public.plan_intents pi where pi.intent_id=v_intent_id and pi.status='active') then
  raise exception 'Etkinlik kapağı sistem tarafından yönetilir; doğrudan kapak yüklenemez.' using errcode='0A000';
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;$$;
drop trigger if exists protect_event_custom_cover_v86 on public.intent_custom_covers;
create trigger protect_event_custom_cover_v86 before insert or update or delete on public.intent_custom_covers for each row execute function public.protect_event_custom_cover_v86();
create or replace function public.normalize_room_message_notification_title()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_title text;
begin
  if new.entity_type<>'plan' or new.entity_id is null or lower(coalesce(new.notification_type,'')) not like '%room_message%' then return new; end if;
  select public.uin_event_display_title_v86(pi.intent_id) into v_title
  from public.plan_intents pi where pi.plan_id=new.entity_id and pi.status='active'
  order by (pi.relationship='host_source') desc,pi.created_at limit 1;
  if nullif(btrim(v_title),'') is not null then new.title:=left(v_title,200); end if;
  return new;
end;$$;

revoke all on function public.uin_event_display_title_v86(uuid), public.get_uin_event_presentation_v86(uuid), public.update_my_event_activity_dna_v86(uuid,uuid,uuid,uuid[]) from public;
grant execute on function public.get_uin_event_presentation_v86(uuid) to anon, authenticated;
grant execute on function public.update_my_event_activity_dna_v86(uuid,uuid,uuid,uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
