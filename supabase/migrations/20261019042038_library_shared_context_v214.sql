-- Context is derived from the saved Library identity, never from an arbitrary activity chosen by a client.
insert into public.activities(category_id,name,intent_label,event_label)
select c.id,v.name,v.name,v.name from (values
 ('Culture & Events','Dizi İzleme'),('Culture & Events','Film İzleme'),
 ('Culture & Events','Müzik Dinleme'),('Culture & Events','Gösteri İzleme'),
 ('Games & Play','Video Oyunu Oynama'),('Games & Play','Masa ve Kutu Oyunu Oynama'),
 ('Travel Activity','Birlikte Gezi'),('Learning Activity','Birlikte Öğrenme'),
 ('Social Activity','Birlikte Aktivite'))v(category,name)
join public.activity_categories c on c.name=v.category
on conflict(category_id,name) do nothing;

alter table uin_private.shared_experiences add column context jsonb not null default '{}'::jsonb;

create or replace function uin_private.shared_library_context(p_catalog uuid,p_type uuid,p_title text) returns jsonb
language plpgsql stable set search_path='' as $$
declare c public.seed_catalog_items%rowtype; slug text; kind text; activity_name text; activity uuid;
 question text; role_label text; reported text; context_key text; title text:=coalesce(nullif(p_title,''),'Bu kart');
begin
 select * into c from public.seed_catalog_items where id=p_catalog;
 select t.slug into slug from public.seed_types t where t.id=coalesce(c.seed_type_id,p_type);
 kind:=coalesce(c.metadata->>'content_type_id',c.metadata->>'uin_item_kind',c.item_kind,slug,'activity');
 title:=coalesce(c.canonical_title,title);
 if kind='series' then activity_name:='Dizi İzleme';question:='Kiminle izledin?';role_label:='Dizi izleyicisi';reported:='“'||title||'” dizisini izlediğini';context_key:='series:watch';
 elsif kind='movie' or slug='watch' and kind not in ('club','theatre_artist','comedian') then activity_name:='Film İzleme';question:='Kiminle izledin?';role_label:='Film izleyicisi';reported:='“'||title||'” filmini izlediğini';context_key:='movie:watch';
 elsif kind='board_game' or coalesce(c.metadata->'content_type_ids','[]'::jsonb)?'board_game' then activity_name:='Masa ve Kutu Oyunu Oynama';question:='Kiminle oynadın?';role_label:='Masa ve kutu oyunu arkadaşı';reported:='“'||title||'” oyununu oynadığını';context_key:='board_game:play';
 elsif kind='game' or slug='play' then activity_name:='Video Oyunu Oynama';question:='Kiminle oynadın?';role_label:='Video oyunu arkadaşı';reported:='“'||title||'” oyununu oynadığını';context_key:='game:play';
 elsif kind='book' or slug='read' then activity_name:='Book Reading';question:='Kiminle okudun?';role_label:='Okuma arkadaşı';reported:='“'||title||'” kitabını okuduğunu';context_key:='book:read';
 elsif kind='club' then activity_name:='Watch a Sports Broadcast Together';question:='Maçı kiminle izledin?';role_label:='Maç izleme arkadaşı';reported:='“'||title||'” maçını izlediğini';context_key:='club:watch';
 elsif slug='concert' or kind in ('concert','festival','artist') and slug<>'listen' then activity_name:='Concert';question:='Konsere kiminle gittin?';role_label:='Konser arkadaşı';reported:='“'||title||'” konserine gittiğini';context_key:='concert:visit';
 elsif slug='listen' then activity_name:='Müzik Dinleme';question:='Kiminle dinledin?';role_label:='Müzik dinleme arkadaşı';reported:='“'||title||'” dinlediğini';context_key:='music:listen';
 elsif kind='place' or slug in ('visit','explore') then activity_name:='Birlikte Gezi';question:='Kiminle gittin?';role_label:='Gezi arkadaşı';reported:='“'||title||'” ziyaretini yaptığını';context_key:='place:visit';
 elsif slug='live-performance' or kind in ('comedian','theatre_artist') then activity_name:='Gösteri İzleme';question:='Kiminle izledin?';role_label:='Gösteri izleme arkadaşı';reported:='“'||title||'” gösterisini izlediğini';context_key:='performance:watch';
 elsif slug='learn' then activity_name:='Birlikte Öğrenme';question:='Kiminle öğrendin?';role_label:=title||' · Öğrenme arkadaşı';reported:='“'||title||'” öğrendiğini';context_key:=coalesce(c.canonical_target_id::text,public.normalize_seed_catalog_text(title))||':learn';
 else activity_name:='Birlikte Aktivite';question:='Kiminle yaptın?';role_label:=title||' · Deneyim arkadaşı';reported:='“'||title||'” deneyimini yaşadığını';context_key:=coalesce(c.canonical_target_id::text,public.normalize_seed_catalog_text(title))||':do';
 end if;
 select a.id into activity from public.activities a where a.name=activity_name and a.is_active order by a.sort_order,a.id limit 1;
 if activity is null then raise exception 'Bu kartın deneyim bağlamı hazırlanamadı.';end if;
 return jsonb_build_object('activityId',activity,'key',context_key,'kind',kind,'title',title,'question',question,'peerRole',role_label,'reported',reported);
end $$;
revoke all on function uin_private.shared_library_context(uuid,uuid,text) from public,anon,authenticated;

create or replace function uin_private.shared_experience_api(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_id uuid; v_seed uuid; v_activity uuid; v_target uuid; v_score integer;
 v_group uin_private.shared_experiences%rowtype; v_member uin_private.shared_experience_members%rowtype;
 v_source public.seeds%rowtype; v_state public.seed_personal_state_v15%rowtype;
 v_catalog public.seed_catalog_items%rowtype; v_precision text; v_visibility text; v_date date; v_year integer;
 v_context jsonb; v_own_rating integer; v_friend jsonb; v_result jsonb; v_request uuid; v_name text;
begin
 if v_user is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
 if public.reputation_is_managed_minor(v_user) then return case when p_action in ('list','reputation') then '[]'::jsonb when p_action='options' then '{"friends":[],"activities":[]}'::jsonb else null end; end if;
 if p_action='options' then
  if nullif(p_payload->>'seedId','') is not null then
   select * into v_source from public.seeds where id=(p_payload->>'seedId')::uuid and user_id=v_user;
   if not found then raise exception 'Bu deneyime erişemezsin.' using errcode='42501';end if;
   v_context:=uin_private.shared_library_context(v_source.catalog_item_id,v_source.seed_type_id,v_source.title);
  elsif nullif(p_payload->>'catalogItemId','') is not null then
   select * into v_catalog from public.seed_catalog_items where id=(p_payload->>'catalogItemId')::uuid and status='active';
   if not found then raise exception 'Kart bulunamadı.';end if;
   v_context:=uin_private.shared_library_context(v_catalog.id,v_catalog.seed_type_id,v_catalog.canonical_title);
  elsif nullif(p_payload->>'seedTypeId','') is not null then
   v_context:=uin_private.shared_library_context(null,(p_payload->>'seedTypeId')::uuid,p_payload->>'title');
  end if;
  return jsonb_build_object('friends',coalesce((select jsonb_agg(jsonb_build_object('id',f.other_user_id,'name',coalesce(f.other_full_name,f.other_username),'avatar',f.other_avatar_url))
   from public.get_my_friendships() f where f.friendship_status='accepted' and not public.users_are_blocked(v_user,f.other_user_id) and not public.reputation_is_managed_minor(f.other_user_id)),'[]'::jsonb),
   'context',v_context,'activities',case when v_context is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id',v_context->>'activityId','name',v_context->>'peerRole')) end);
 elsif p_action='save' then
  v_seed:=(p_payload->>'seedId')::uuid;
  if jsonb_typeof(p_payload->'friends') is distinct from 'array' or jsonb_array_length(p_payload->'friends') not between 1 and 20 then raise exception '1 ile 20 arasında arkadaş seç.'; end if;
  select * into v_source from public.seeds where id=v_seed and user_id=v_user and status='completed' for update;
  if exists(select 1 from uin_private.shared_experience_members where seed_id=v_seed and user_id=v_user and experience_id in (select id from uin_private.shared_experiences where source_seed_id<>v_seed)) then raise exception 'Bu deneyim zaten bir ortak deneyime bağlı. Ortak deneyim ekranını kullan.'; end if;
  if not found then raise exception 'Önce kendi deneyimini kaydet.' using errcode='42501'; end if;
  v_context:=uin_private.shared_library_context(v_source.catalog_item_id,v_source.seed_type_id,v_source.title);
  v_activity:=(v_context->>'activityId')::uuid;
  if nullif(p_payload->>'activityId','') is not null and (p_payload->>'activityId')::uuid<>v_activity then raise exception 'Deneyimin konusu seçili kartla aynı olmalı.';end if;
  select * into v_state from public.seed_personal_state_v15 where seed_id=v_seed;
  insert into uin_private.shared_experiences(source_seed_id,owner_id,activity_id,title,date_precision,occurred_on,occurred_year,context)
   values(v_seed,v_user,v_activity,v_source.title,coalesce(v_state.experience_precision,v_source.completed_date_precision,'unknown'),case when coalesce(v_state.experience_precision,v_source.completed_date_precision)='exact' then coalesce(v_state.experience_date,(v_source.completed_at at time zone 'Europe/Istanbul')::date) end,coalesce(v_state.experience_year,v_source.completed_year),v_context)
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
    perform public.create_app_notification(v_target,v_user,'shared_experience_invitation','shared_experience',v_id,v_context->>'question',v_name||' '||(v_context->>'reported')||' kaydetti'||case when v_state.rating is not null then ' ve '||v_state.rating||'/10 deneyim puanı verdi' else '' end||'. Seninle birlikte olduğunu belirtti. Onaylıyorsan kendi deneyimini kaydedip puanlayabilir, ardından arkadaşını değerlendirebilirsin.','/shared-experiences/'||v_id,'shared-experience:'||v_id||':'||v_target);
   end if;
   if v_score is not null then
    if v_state.rating is null then raise exception 'Arkadaşını değerlendirmeden önce kendi deneyim puanını ver.';end if;
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
   select g.activity_id,coalesce(g.context->>'key',g.activity_id::text) context_key,coalesce(g.context->>'peerRole',a.event_label,a.name) role_label,r.reviewer_id,r.experience_id,r.score from uin_private.shared_experience_scores r
   join uin_private.shared_experiences g on g.id=r.experience_id join public.activities a on a.id=g.activity_id
   where r.target_id=v_target and uin_private.shared_score_released(r.experience_id,r.reviewer_id,r.target_id)
  ), per_person as (select context_key,min(activity_id::text)::uuid activity_id,min(role_label) role_label,reviewer_id,avg(score) score from eligible group by context_key,reviewer_id),
  totals as (select context_key,min(activity_id::text)::uuid activity_id,min(role_label) role_label,round(avg(score),1) score,count(*) people from per_person group by context_key)
  select coalesce(jsonb_agg(jsonb_build_object('activityId',t.context_key,'activity',t.role_label,'score',t.score,'people',t.people,
   'experiences',(select count(distinct e.experience_id) from eligible e where e.context_key=t.context_key),
   'badge',case when t.people>=10 and t.score>=8 then 'Sevilen deneyim arkadaşı' when t.people>=10 then 'Deneyimli katılımcı' else null end) order by t.people desc),'[]'::jsonb)
  into v_result from totals t join public.activities a on a.id=t.activity_id;
  return v_result;
 elsif p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'activity',coalesce(g.context->>'peerRole',a.event_label,a.name),'context',g.context,'status',m.status,'seedId',m.seed_id,'ownerName',coalesce(p.full_name,p.username),'date',g.occurred_on,'year',g.occurred_year) order by g.created_at desc)
   from uin_private.shared_experience_members m join uin_private.shared_experiences g on g.id=m.experience_id join public.activities a on a.id=g.activity_id join public.profiles p on p.id=g.owner_id
   where m.user_id=v_user and not public.users_are_blocked(v_user,g.owner_id)
   and (p_payload->>'seedId' is null or m.seed_id=(p_payload->>'seedId')::uuid)),'[]'::jsonb);
 end if;
 v_id:=(p_payload->>'id')::uuid;
 select * into v_group from uin_private.shared_experiences where id=v_id for update;
 select * into v_member from uin_private.shared_experience_members where experience_id=v_id and user_id=v_user for update;
 if v_group.id is null or v_member.user_id is null or public.users_are_blocked(v_user,v_group.owner_id) then raise exception 'Bu ortak deneyime erişemezsin.' using errcode='42501'; end if;
 v_context:=case when v_group.context<>'{}'::jsonb then v_group.context else (select uin_private.shared_library_context(s.catalog_item_id,s.seed_type_id,s.title) from public.seeds s where s.id=v_group.source_seed_id) end;
 if p_action='detail' then
  update public.notifications set read_at=coalesce(read_at,now()) where user_id=v_user and entity_id=v_id and notification_type in ('shared_experience_invitation','shared_experience_accepted');
  return jsonb_build_object('id',v_id,'title',v_group.title,'activityId',v_group.activity_id,'activity',(select coalesce(event_label,name) from public.activities where id=v_group.activity_id),
   'context',v_context,'ownerName',(select coalesce(full_name,username) from public.profiles where id=v_group.owner_id),'ownerRating',(select rating from public.seed_personal_state_v15 where seed_id=v_group.source_seed_id),'ownRating',(select rating from public.seed_personal_state_v15 where seed_id=v_member.seed_id),'date',v_group.occurred_on,'year',v_group.occurred_year,'status',v_member.status,'seedId',v_member.seed_id,'isOwner',v_user=v_group.owner_id,
   'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.full_name,p.username),'username',p.username,'status',m.status,'isMe',m.user_id=v_user,
    'myScore',(select r.score from uin_private.shared_experience_scores r where r.experience_id=v_id and r.reviewer_id=v_user and r.target_id=m.user_id),
    'canRate',v_member.status='accepted' and exists(select 1 from public.seed_personal_state_v15 where seed_id=v_member.seed_id and rating is not null) and m.user_id<>v_user and m.status in ('accepted','pending') and not exists(select 1 from uin_private.shared_experience_scores r where r.experience_id=v_id and r.reviewer_id=v_user and r.target_id=m.user_id)))
    from uin_private.shared_experience_members m join public.profiles p on p.id=m.user_id where m.experience_id=v_id and not public.users_are_blocked(v_user,m.user_id)),'[]'::jsonb));
 elsif p_action='respond' then
  if v_user=v_group.owner_id then raise exception 'Kendi davetini yanıtlayamazsın.'; end if;
  if (p_payload->>'accept')::boolean is true then
   if v_member.status='accepted' then return jsonb_build_object('seedId',v_member.seed_id); end if;
   v_own_rating:=nullif(p_payload->>'rating','')::integer;
   if v_own_rating is not null and v_own_rating not between 1 and 10 then raise exception 'Deneyim puanı 1 ile 10 arasında olmalı.';end if;
   if v_member.status<>'pending' then raise exception 'Bu davet daha önce yanıtlandı.'; end if;
   select * into v_source from public.seeds where id=v_group.source_seed_id and status='completed';
   if not found then raise exception 'Kaynak deneyim artık geçerli değil.'; end if;
   -- Copy identity only. Rating, notes, photos and links belong to each individual.
   insert into public.seeds(user_id,seed_type_id,title,subtitle,cover_url,visibility,status,completed_at,origin,seed_scope,catalog_item_id,catalog_edition_id,canonical_target_id,completed_date_precision,completed_year)
    values(v_user,v_source.seed_type_id,v_source.title,v_source.subtitle,v_source.cover_url,'everyone','completed',coalesce(v_group.occurred_on::timestamptz,now()),'retrospective',v_source.seed_scope,v_source.catalog_item_id,v_source.catalog_edition_id,v_source.canonical_target_id,v_group.date_precision,v_group.occurred_year) returning id into v_seed;
   perform public.save_my_seed_v17_state(v_seed,'completed',v_group.date_precision,v_group.occurred_on,v_group.occurred_year,null,v_own_rating);
   if nullif(btrim(p_payload->>'note'),'') is not null then perform public.save_my_seed_journal_entry(v_seed,null,'reflection',p_payload->>'note',null,'everyone',coalesce(v_group.occurred_on,current_date),'[]'::jsonb);end if;
   update uin_private.shared_experience_members set status='accepted',accepted_at=now(),seed_id=v_seed where experience_id=v_id and user_id=v_user;
   perform public.create_app_notification(v_group.owner_id,v_user,'shared_experience_accepted','shared_experience',v_id,'Ortak deneyim onaylandı','Arkadaşın '||(v_context->>'reported')||' ve birlikte olduğunuzu onayladı. '||(v_context->>'peerRole')||' olarak birbirinizi değerlendirebilirsiniz.','/shared-experiences/'||v_id,'shared-accepted:'||v_id||':'||v_user);
   return jsonb_build_object('seedId',v_seed);
  else
   update uin_private.shared_experience_members set status=case when status='accepted' then 'withdrawn' else 'declined' end where experience_id=v_id and user_id=v_user;
   return '{}'::jsonb;
  end if;
 elsif p_action='rate' then
  v_target:=(p_payload->>'targetId')::uuid; v_score:=(p_payload->>'score')::integer;
  if not exists(select 1 from public.seed_personal_state_v15 where seed_id=v_member.seed_id and rating is not null) then raise exception 'Önce kendi deneyimini puanla.';end if;
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
