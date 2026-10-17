-- Shared experiences extend personal history without overwriting another person's review.
create table uin_private.shared_experiences (
 id uuid primary key default gen_random_uuid(), source_seed_id uuid not null unique references public.seeds(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 activity_id uuid not null references public.activities(id),
 title text not null, date_precision text not null check(date_precision in ('exact','year','unknown')),
 occurred_on date, occurred_year integer, created_at timestamptz not null default now()
);
create table uin_private.shared_experience_members (
 experience_id uuid not null references uin_private.shared_experiences(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 seed_id uuid references public.seeds(id) on delete set null,
 status text not null check(status in ('pending','accepted','declined','withdrawn')),
 accepted_at timestamptz, primary key(experience_id,user_id)
);
create index shared_members_seed_idx on uin_private.shared_experience_members(seed_id);
create index shared_members_user_idx on uin_private.shared_experience_members(user_id,experience_id);
create table uin_private.shared_experience_scores (
 experience_id uuid not null, reviewer_id uuid not null, target_id uuid not null,
 score integer not null check(score between 1 and 10), created_at timestamptz not null default now(),
 primary key(experience_id,reviewer_id,target_id), check(reviewer_id<>target_id),
 foreign key(experience_id,reviewer_id) references uin_private.shared_experience_members(experience_id,user_id) on delete cascade,
 foreign key(experience_id,target_id) references uin_private.shared_experience_members(experience_id,user_id) on delete cascade
);
create index shared_scores_target_idx on uin_private.shared_experience_scores(target_id,experience_id);
create table uin_private.shared_experience_repeats (
 user_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null,
 experience_id uuid not null references uin_private.shared_experiences(id) on delete cascade,
 seed_id uuid not null references public.seeds(id) on delete cascade, primary key(user_id,request_id)
);
create index shared_experiences_owner_idx on uin_private.shared_experiences(owner_id);
create index shared_experiences_activity_idx on uin_private.shared_experiences(activity_id);
create index shared_repeats_experience_idx on uin_private.shared_experience_repeats(experience_id);
create index shared_repeats_seed_idx on uin_private.shared_experience_repeats(seed_id);
alter table uin_private.shared_experiences enable row level security;
alter table uin_private.shared_experience_members enable row level security;
alter table uin_private.shared_experience_scores enable row level security;
alter table uin_private.shared_experience_repeats enable row level security;
revoke all on uin_private.shared_experiences,uin_private.shared_experience_members,uin_private.shared_experience_scores,uin_private.shared_experience_repeats from public,anon,authenticated;

-- Only sealed scores from mutually confirmed, still-existing experiences contribute.
create function uin_private.shared_score_released(p_experience uuid,p_a uuid,p_b uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from uin_private.shared_experience_members a
 join uin_private.shared_experience_members b on b.experience_id=a.experience_id
 join public.seeds sa on sa.id=a.seed_id and sa.status='completed'
 join public.seeds sb on sb.id=b.seed_id and sb.status='completed'
 where a.experience_id=p_experience and a.user_id=p_a and b.user_id=p_b
 and a.status='accepted' and b.status='accepted'
 and not public.users_are_blocked(p_a,p_b)
 and not public.reputation_is_managed_minor(p_a) and not public.reputation_is_managed_minor(p_b)
 and ((exists(select 1 from uin_private.shared_experience_scores r where r.experience_id=p_experience and r.reviewer_id=p_a and r.target_id=p_b)
 and exists(select 1 from uin_private.shared_experience_scores r where r.experience_id=p_experience and r.reviewer_id=p_b and r.target_id=p_a))
 or now()>=greatest(a.accepted_at,b.accepted_at)+interval '7 days'));
$$;
revoke all on function uin_private.shared_score_released(uuid,uuid,uuid) from public,anon,authenticated;

create function uin_private.shared_experience_api(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_id uuid; v_seed uuid; v_activity uuid; v_target uuid; v_score integer;
 v_group uin_private.shared_experiences%rowtype; v_member uin_private.shared_experience_members%rowtype;
 v_source public.seeds%rowtype; v_state public.seed_personal_state_v15%rowtype;
 v_catalog public.seed_catalog_items%rowtype; v_precision text; v_visibility text; v_date date; v_year integer;
 v_friend jsonb; v_result jsonb; v_request uuid; v_name text;
begin
 if v_user is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
 if public.reputation_is_managed_minor(v_user) then return case when p_action in ('list','reputation') then '[]'::jsonb when p_action='options' then '{"friends":[],"activities":[]}'::jsonb else null end; end if;
 if p_action='options' then
  return jsonb_build_object('friends',coalesce((select jsonb_agg(jsonb_build_object('id',f.other_user_id,'name',coalesce(f.other_full_name,f.other_username),'avatar',f.other_avatar_url))
   from public.get_my_friendships() f where f.friendship_status='accepted' and not public.users_are_blocked(v_user,f.other_user_id) and not public.reputation_is_managed_minor(f.other_user_id)),'[]'::jsonb),
   'activities',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',coalesce(a.event_label,a.name)) order by a.sort_order,a.name) from public.activities a where a.is_active),'[]'::jsonb));
 elsif p_action='save' then
  v_seed:=(p_payload->>'seedId')::uuid; v_activity:=(p_payload->>'activityId')::uuid;
  if jsonb_typeof(p_payload->'friends') is distinct from 'array' or jsonb_array_length(p_payload->'friends') not between 1 and 20 then raise exception '1 ile 20 arasında arkadaş seç.'; end if;
  select * into v_source from public.seeds where id=v_seed and user_id=v_user and status='completed' for update;
  if exists(select 1 from uin_private.shared_experience_members where seed_id=v_seed and user_id=v_user and experience_id in (select id from uin_private.shared_experiences where source_seed_id<>v_seed)) then raise exception 'Bu deneyim zaten bir ortak deneyime bağlı. Ortak deneyim ekranını kullan.'; end if;
  if not found then raise exception 'Önce kendi deneyimini kaydet.' using errcode='42501'; end if;
  if not exists(select 1 from public.activities where id=v_activity and is_active) then raise exception 'Aktivite seç.'; end if;
  select * into v_state from public.seed_personal_state_v15 where seed_id=v_seed;
  insert into uin_private.shared_experiences(source_seed_id,owner_id,activity_id,title,date_precision,occurred_on,occurred_year)
   values(v_seed,v_user,v_activity,v_source.title,coalesce(v_state.experience_precision,v_source.completed_date_precision,'unknown'),case when coalesce(v_state.experience_precision,v_source.completed_date_precision)='exact' then coalesce(v_state.experience_date,(v_source.completed_at at time zone 'Europe/Istanbul')::date) end,coalesce(v_state.experience_year,v_source.completed_year))
   on conflict(source_seed_id) do nothing;
  select * into v_group from uin_private.shared_experiences where source_seed_id=v_seed for update;
  if v_group.activity_id<>v_activity then raise exception 'Bu ortak deneyimin konusu değiştirilemez. Yeni bir deneyim ekleyebilirsin.'; end if;
  v_id:=v_group.id;
  insert into uin_private.shared_experience_members values(v_id,v_user,v_seed,'accepted',now()) on conflict do nothing;
  select coalesce(full_name,username) into v_name from public.profiles where id=v_user;
  for v_friend in select value from jsonb_array_elements(p_payload->'friends') loop
   v_target:=(v_friend->>'id')::uuid; v_score:=nullif(v_friend->>'score','')::integer;
   if v_target=v_user or not public.are_users_friends(v_user,v_target) or public.users_are_blocked(v_user,v_target) or public.reputation_is_managed_minor(v_target) then raise exception 'Yalnızca uygun arkadaşlarını ekleyebilirsin.' using errcode='42501'; end if;
   insert into uin_private.shared_experience_members(experience_id,user_id,status) values(v_id,v_target,'pending') on conflict do nothing;
   if found then
    perform public.create_app_notification(v_target,v_user,'shared_experience_invitation','shared_experience',v_id,'Birlikte miydiniz?',v_name||', “'||v_source.title||'” deneyimini birlikte yaptığınızı belirtti. Onaylayıp kendi deneyimini ekleyebilirsin.','/shared-experiences/'||v_id,'shared-experience:'||v_id||':'||v_target);
   end if;
   if v_score is not null then
    if v_score not between 1 and 10 then raise exception 'Puan 1 ile 10 arasında olmalı.'; end if;
    insert into uin_private.shared_experience_scores(experience_id,reviewer_id,target_id,score) values(v_id,v_user,v_target,v_score) on conflict do nothing;
   end if;
  end loop;
  return jsonb_build_object('id',v_id);
 elsif p_action='past' then
  v_request:=(p_payload->>'requestId')::uuid;
  if v_request is null then raise exception 'İstek kimliği eksik.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||v_request::text,0));
  select experience_id,seed_id into v_id,v_seed from uin_private.shared_experience_repeats where user_id=v_user and request_id=v_request;
  if v_seed is not null then return jsonb_build_object('id',v_id,'seedId',v_seed); end if;
  -- Each intentional submission is a distinct occurrence. The legacy catalogue
  -- helper reuses an older completed seed, which would conflate repeated outings.
  select * into v_catalog from public.seed_catalog_items where id=(p_payload->>'catalogItemId')::uuid and status in ('active','pending');
  if not found then raise exception 'Kütüphane kaydı bulunamadı.'; end if;
  v_precision:=coalesce(p_payload->>'precision','unknown'); v_visibility:=coalesce(p_payload->>'visibility','everyone');
  if v_precision not in ('exact','year','unknown') or v_visibility not in ('only_me','friends','everyone') then raise exception 'Tarih veya görünürlük seçimi geçersiz.'; end if;
  if v_precision='exact' then
   v_date:=(p_payload->>'date')::date;
   if v_date is null or v_date>current_date then raise exception 'Geçerli bir deneyim tarihi seç.'; end if;
  elsif v_precision='year' then
   v_year:=(p_payload->>'year')::integer;
   if v_year is null or v_year<1 or v_year>extract(year from current_date)::integer then raise exception 'Geçerli bir deneyim yılı seç.'; end if;
   v_date:=make_date(v_year,1,1);
  else v_date:=current_date;
  end if;
  insert into public.seeds(user_id,seed_type_id,title,subtitle,cover_url,visibility,status,completed_at,origin,catalog_item_id,canonical_target_id,completed_date_precision,completed_year)
   values(v_user,v_catalog.seed_type_id,v_catalog.canonical_title,v_catalog.creator_name,v_catalog.cover_url,v_visibility,'completed',v_date::timestamp at time zone 'Europe/Istanbul','retrospective',v_catalog.id,v_catalog.canonical_target_id,v_precision,v_year) returning id into v_seed;
  if nullif(btrim(coalesce(p_payload->>'reflection','')),'') is not null or nullif(btrim(coalesce(p_payload->>'keyTakeaway','')),'') is not null then
   perform public.save_my_seed_journal_entry(v_seed,null,'reflection',p_payload->>'reflection',p_payload->>'keyTakeaway',v_visibility,v_date,'[]'::jsonb);
  end if;
  v_result:=uin_private.shared_experience_api('save',p_payload||jsonb_build_object('seedId',v_seed));
  v_id:=(v_result->>'id')::uuid;
  insert into uin_private.shared_experience_repeats values(v_user,v_request,v_id,v_seed);
  return jsonb_build_object('id',v_id,'seedId',v_seed);
 elsif p_action='reputation' then
  v_target:=(p_payload->>'userId')::uuid;
  if v_target is null or public.users_are_blocked(v_user,v_target) or public.reputation_is_managed_minor(v_target) then return '[]'::jsonb; end if;
  with eligible as (
   select g.activity_id,r.reviewer_id,r.experience_id,r.score from uin_private.shared_experience_scores r
   join uin_private.shared_experiences g on g.id=r.experience_id
   where r.target_id=v_target and uin_private.shared_score_released(r.experience_id,r.reviewer_id,r.target_id)
  ), per_person as (select activity_id,reviewer_id,avg(score) score from eligible group by activity_id,reviewer_id),
  totals as (select activity_id,round(avg(score),1) score,count(*) people from per_person group by activity_id)
  select coalesce(jsonb_agg(jsonb_build_object('activityId',t.activity_id,'activity',coalesce(a.event_label,a.name),'score',t.score,'people',t.people,
   'experiences',(select count(distinct e.experience_id) from eligible e where e.activity_id=t.activity_id),
   'badge',case when t.people>=10 and t.score>=8 then 'Sevilen deneyim arkadaşı' when t.people>=10 then 'Deneyimli katılımcı' else null end) order by t.people desc),'[]'::jsonb)
  into v_result from totals t join public.activities a on a.id=t.activity_id;
  return v_result;
 elsif p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'activity',coalesce(a.event_label,a.name),'status',m.status,'seedId',m.seed_id,'ownerName',coalesce(p.full_name,p.username),'date',g.occurred_on,'year',g.occurred_year) order by g.created_at desc)
   from uin_private.shared_experience_members m join uin_private.shared_experiences g on g.id=m.experience_id join public.activities a on a.id=g.activity_id join public.profiles p on p.id=g.owner_id
   where m.user_id=v_user and not public.users_are_blocked(v_user,g.owner_id)
   and (p_payload->>'seedId' is null or m.seed_id=(p_payload->>'seedId')::uuid)),'[]'::jsonb);
 end if;
 v_id:=(p_payload->>'id')::uuid;
 select * into v_group from uin_private.shared_experiences where id=v_id for update;
 select * into v_member from uin_private.shared_experience_members where experience_id=v_id and user_id=v_user for update;
 if v_group.id is null or v_member.user_id is null or public.users_are_blocked(v_user,v_group.owner_id) then raise exception 'Bu ortak deneyime erişemezsin.' using errcode='42501'; end if;
 if p_action='detail' then
  update public.notifications set read_at=coalesce(read_at,now()) where user_id=v_user and entity_id=v_id and notification_type in ('shared_experience_invitation','shared_experience_accepted');
  return jsonb_build_object('id',v_id,'title',v_group.title,'activityId',v_group.activity_id,'activity',(select coalesce(event_label,name) from public.activities where id=v_group.activity_id),
   'date',v_group.occurred_on,'year',v_group.occurred_year,'status',v_member.status,'seedId',v_member.seed_id,'isOwner',v_user=v_group.owner_id,
   'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.full_name,p.username),'username',p.username,'status',m.status,'isMe',m.user_id=v_user,
    'myScore',(select r.score from uin_private.shared_experience_scores r where r.experience_id=v_id and r.reviewer_id=v_user and r.target_id=m.user_id),
    'canRate',v_member.status='accepted' and m.user_id<>v_user and m.status in ('accepted','pending') and not exists(select 1 from uin_private.shared_experience_scores r where r.experience_id=v_id and r.reviewer_id=v_user and r.target_id=m.user_id)))
    from uin_private.shared_experience_members m join public.profiles p on p.id=m.user_id where m.experience_id=v_id and not public.users_are_blocked(v_user,m.user_id)),'[]'::jsonb));
 elsif p_action='respond' then
  if v_user=v_group.owner_id then raise exception 'Kendi davetini yanıtlayamazsın.'; end if;
  if (p_payload->>'accept')::boolean is true then
   if v_member.status='accepted' then return jsonb_build_object('seedId',v_member.seed_id); end if;
   if v_member.status<>'pending' then raise exception 'Bu davet daha önce yanıtlandı.'; end if;
   select * into v_source from public.seeds where id=v_group.source_seed_id and status='completed';
   if not found then raise exception 'Kaynak deneyim artık geçerli değil.'; end if;
   -- Copy identity only. Rating, notes, photos and links belong to each individual.
   insert into public.seeds(user_id,seed_type_id,title,subtitle,cover_url,visibility,status,completed_at,origin,seed_scope,catalog_item_id,catalog_edition_id,canonical_target_id,completed_date_precision,completed_year)
    values(v_user,v_source.seed_type_id,v_source.title,v_source.subtitle,v_source.cover_url,'everyone','completed',coalesce(v_group.occurred_on::timestamptz,now()),'retrospective',v_source.seed_scope,v_source.catalog_item_id,v_source.catalog_edition_id,v_source.canonical_target_id,v_group.date_precision,v_group.occurred_year) returning id into v_seed;
   perform public.save_my_seed_v17_state(v_seed,'completed',v_group.date_precision,v_group.occurred_on,v_group.occurred_year,null,null);
   update uin_private.shared_experience_members set status='accepted',accepted_at=now(),seed_id=v_seed where experience_id=v_id and user_id=v_user;
   perform public.create_app_notification(v_group.owner_id,v_user,'shared_experience_accepted','shared_experience',v_id,'Ortak deneyim onaylandı','Arkadaşın birlikte yaptığınızı onayladı. Bu deneyime özel arkadaş değerlendirmelerini ekleyebilirsiniz.','/shared-experiences/'||v_id,'shared-accepted:'||v_id||':'||v_user);
   return jsonb_build_object('seedId',v_seed);
  else
   update uin_private.shared_experience_members set status=case when status='accepted' then 'withdrawn' else 'declined' end where experience_id=v_id and user_id=v_user;
   return '{}'::jsonb;
  end if;
 elsif p_action='rate' then
  v_target:=(p_payload->>'targetId')::uuid; v_score:=(p_payload->>'score')::integer;
  if v_member.status<>'accepted' or v_target=v_user or public.users_are_blocked(v_user,v_target) or public.reputation_is_managed_minor(v_target)
   or not exists(select 1 from uin_private.shared_experience_members where experience_id=v_id and user_id=v_target and status in ('accepted','pending')) then raise exception 'Bu kişiyi değerlendiremezsin.' using errcode='42501'; end if;
  if v_score is null or v_score not between 1 and 10 then raise exception 'Puan 1 ile 10 arasında olmalı.'; end if;
  -- Sealed once submitted; retries never change a vote after seeing another score.
  insert into uin_private.shared_experience_scores(experience_id,reviewer_id,target_id,score) values(v_id,v_user,v_target,v_score) on conflict do nothing;
  return '{}'::jsonb;
 elsif p_action='repeat' then
  if v_member.status<>'accepted' then raise exception 'Önce bu deneyimi onaylamalısın.'; end if;
  v_request:=(p_payload->>'requestId')::uuid;
  if v_request is null then raise exception 'İstek kimliği eksik.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||v_request::text,0));
  select seed_id into v_seed from uin_private.shared_experience_repeats where user_id=v_user and request_id=v_request;
  if v_seed is not null then return jsonb_build_object('seedId',v_seed); end if;
  select * into v_source from public.seeds where id=v_member.seed_id;
  if not found then raise exception 'Deneyim bulunamadı.'; end if;
  insert into public.seeds(user_id,seed_type_id,title,subtitle,cover_url,visibility,status,completed_at,origin,seed_scope,catalog_item_id,catalog_edition_id,canonical_target_id,completed_date_precision)
   values(v_user,v_source.seed_type_id,v_source.title,v_source.subtitle,v_source.cover_url,'only_me','completed',now(),'retrospective',v_source.seed_scope,v_source.catalog_item_id,v_source.catalog_edition_id,v_source.canonical_target_id,'unknown') returning id into v_seed;
  insert into uin_private.shared_experience_repeats values(v_user,v_request,v_id,v_seed);
  return jsonb_build_object('seedId',v_seed);
 end if;
 raise exception 'Geçersiz işlem.';
end;
$$;
revoke all on function uin_private.shared_experience_api(text,jsonb) from public,anon;
grant execute on function uin_private.shared_experience_api(text,jsonb) to authenticated;
create function public.shared_experience_action(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select uin_private.shared_experience_api(p_action,p_payload); $$;
revoke all on function public.shared_experience_action(text,jsonb) from public,anon;
grant execute on function public.shared_experience_action(text,jsonb) to authenticated;
