begin;

create or replace function public.uin_activity_event_label_v90(p_value text)
returns text
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare v_value text:=nullif(btrim(coalesce(p_value,'')),'');v_label text;
begin
 if v_value is null then return null;end if;
 select coalesce(nullif(btrim(a.event_label),''),nullif(btrim(a.name),'')) into v_label
 from public.activities a
 where lower(btrim(a.name))=lower(v_value)
    or lower(btrim(coalesce(a.intent_label,'')))=lower(v_value)
    or lower(btrim(coalesce(a.event_label,'')))=lower(v_value)
 order by (lower(btrim(a.name))=lower(v_value)) desc,a.id limit 1;
 if v_label is not null then return v_label;end if;
 return case lower(v_value)
  when 'forest walk' then 'Orman Yürüyüşü'
  when 'nature trip' then 'Doğa Gezisi'
  when 'cultural trip' then 'Kültür Gezisi'
  when 'city walk' then 'Şehir Yürüyüşü'
  when 'brainstorming session' then 'Beyin Fırtınası'
  when 'meet new people' then 'Yeni İnsanlarla Tanışma'
  when 'beach trip' then 'Sahil Gezisi'
  when 'walking' then 'Yürüyüş'
  when 'family picnic' then 'Aile Pikniği'
  when 'bicycle tour' then 'Bisiklet Turu'
  when 'video gaming meetup' then 'Video Oyunu Buluşması'
  when 'watch a sports broadcast together' then 'Birlikte Spor Yayını'
  when 'sing karaoke' then 'Karaoke'
  when 'camping' then 'Kamp'
  when 'coworking session' then 'Birlikte Çalışma'
  when 'have dinner together' then 'Birlikte Akşam Yemeği'
  when 'dinner meetup' then 'Akşam Yemeği Buluşması'
  when 'cycling' then 'Bisiklet'
  when 'concert' then 'Konser'
  when 'host a house gathering' then 'Ev Buluşması'
  when 'join a social gathering' then 'Sosyal Buluşma'
  when 'watch sports live at the venue' then 'Sporu Yerinde Canlı İzleme'
  when 'rowing' then 'Kürek'
  when 'road trip' then 'Araba Yolculuğu'
  when 'day trip' then 'Günübirlik Gezi'
  when 'festival' then 'Festival'
  when 'photography walk' then 'Fotoğraf Yürüyüşü'
  else v_value end;
end;$$;

create or replace function public.uin_seed_display_title_v90(p_seed_id uuid)
returns text
language sql
stable
security definer
set search_path=public,pg_temp
as $$
 select public.uin_activity_event_label_v90(coalesce(nullif(btrim(t.title),''),nullif(btrim(s.title),''),'Kişisel Niyet'))
 from public.seeds s left join public.canonical_targets t on t.id=s.canonical_target_id where s.id=p_seed_id
$$;

create or replace function public.normalize_turkish_notification_v90()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_match text[];v_subject text;
begin
 if lower(coalesce(new.notification_type,'')) like '%join_request%' then
  v_match:=regexp_match(coalesce(new.title,''),'^(.*) wants to join (.+)$','i');
  if v_match is not null then
   v_subject:=public.uin_activity_event_label_v90(v_match[2]);
   new.title:=left(btrim(v_match[1])||', “'||v_subject||'” etkinliğine katılmak istiyor',200);
  else
   v_match:=regexp_match(coalesce(new.title,''),'^(.*), “(.+)” etkinliğine katılmak istiyor$','i');
   if v_match is not null then
    v_subject:=public.uin_activity_event_label_v90(v_match[2]);
    new.title:=left(btrim(v_match[1])||', “'||v_subject||'” etkinliğine katılmak istiyor',200);
   else
    v_match:=regexp_match(coalesce(new.title,''),'^Your request to join (.+) was (accepted|declined)$','i');
    if v_match is not null then
     v_subject:=public.uin_activity_event_label_v90(v_match[1]);
     new.title:=left('“'||v_subject||'” etkinliğine katılım isteğin '||case when lower(v_match[2])='accepted' then 'kabul edildi' else 'reddedildi' end,200);
    end if;
   end if;
  end if;
  if lower(coalesce(new.notification_type,'')) like '%accepted%' then
   new.body:='Katılım isteğin kabul edildi. Etkinlik ayrıntılarını açabilirsin.';
  elsif lower(coalesce(new.notification_type,'')) like '%declined%' then
   new.body:='Katılım isteğin reddedildi.';
  elsif new.body is null or new.body~*'(open|review|accept|decline|join request)' then
   new.body:='Katılım isteğini incelemek, kabul etmek veya reddetmek için aç.';
  end if;
 end if;
 return new;
end;$$;

drop trigger if exists normalize_turkish_notification_v90 on public.notifications;
create trigger normalize_turkish_notification_v90 before insert or update of title,body,notification_type on public.notifications for each row execute function public.normalize_turkish_notification_v90();

create or replace function public.create_personal_intent_collaboration_suggestion_v2918(p_seed_id uuid)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare v_user uuid:=auth.uid();v_owner uuid;v_mode text;v_friend boolean:=false;v_id uuid;v_requester_name text;v_subject text;
begin
 if v_user is null then raise exception 'Oturum gerekli.';end if;
 select s.user_id,coalesce(x.suggestion_mode,'everyone'),public.uin_seed_display_title_v90(s.id) into v_owner,v_mode,v_subject from public.seeds s left join public.personal_intent_collaboration_settings x on x.seed_id=s.id where s.id=p_seed_id and coalesce(s.status,'active')<>'completed';
 if not found then raise exception 'Bu Niyet bulunamadı veya tamamlanmış.';end if;
 if v_owner=v_user then raise exception 'Kendi Niyetin için öneri gönderemezsin.';end if;
 if public.is_user_discovery_blocked_v2918(v_owner,v_user) or public.is_user_discovery_blocked_v2918(v_user,v_owner) then raise exception 'Bu kullanıcıyla etkileşim kuramazsın.';end if;
 if v_mode='friends' then select exists(select 1 from public.get_my_friendships() f where to_jsonb(f)->>'other_user_id'=v_owner::text and to_jsonb(f)->>'friendship_status'='accepted') into v_friend;end if;
 if v_mode='off' or (v_mode='friends' and not v_friend) then raise exception 'Bu Niyet birlikte yapma önerisi kabul etmiyor.';end if;
 if (select count(*) from public.personal_intent_collaboration_suggestions where requester_user_id=v_user and created_at>=current_date)>=10 then raise exception 'Günlük öneri sınırına ulaştın.';end if;
 insert into public.personal_intent_collaboration_suggestions(seed_id,owner_user_id,requester_user_id) values(p_seed_id,v_owner,v_user) returning id into v_id;
 select coalesce(nullif(trim(p.full_name),''),nullif(trim(p.username),''),'Bir UIN üyesi') into v_requester_name from public.profiles p where p.id=v_user;
 insert into public.notifications(user_id,actor_user_id,notification_type,entity_type,entity_id,title,body,action_url)
 values(v_owner,v_user,'personal_intent_collaboration','personal_intent_collaboration',v_id,coalesce(v_requester_name,'Bir UIN üyesi')||', “'||coalesce(v_subject,'Kişisel Niyet')||'” için birlikte yapmayı önerdi','“'||coalesce(v_subject,'Kişisel Niyet')||'” konusunu birlikte gerçekleştirmek istiyor. Kabul etmek veya reddetmek için aç.','/collaboration-suggestions?focus='||v_id::text);
 return v_id;
exception when unique_violation then raise exception 'Bu Niyet için daha önce öneri gönderdin.';end $$;

create or replace function public.sync_collaboration_notification_route_v90()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status is distinct from old.status then
  update public.notifications set action_url=case when new.status='accepted' then '/collaboration-chat/'||new.id::text else '/collaboration-suggestions?focus='||new.id::text end
  where entity_id=new.id and notification_type='personal_intent_collaboration';
 end if;
 return new;
end;$$;
drop trigger if exists sync_collaboration_notification_route_v90 on public.personal_intent_collaboration_suggestions;
create trigger sync_collaboration_notification_route_v90 after update of status on public.personal_intent_collaboration_suggestions for each row execute function public.sync_collaboration_notification_route_v90();

create or replace function public.get_my_personal_intent_collaboration_chats_v34()
returns table(chat_id uuid,seed_id uuid,seed_title text,other_user_id uuid,other_full_name text,other_username text,other_avatar_url text,status text,planning_proposed_by uuid,viewer_message_count bigint,other_message_count bigint,unread_count bigint,last_message_body text,last_message_at timestamptz)
language sql stable security definer set search_path=public,extensions as $$
 select c.suggestion_id,c.seed_id,public.uin_seed_display_title_v90(s.id)::text,
  case when c.owner_user_id=auth.uid() then c.requester_user_id else c.owner_user_id end,
  coalesce(nullif(trim(p.full_name),''),nullif(trim(p.username),''),'UIN üyesi')::text,p.username::text,p.avatar_url::text,c.status,c.planning_proposed_by,
  (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id=c.suggestion_id and m.sender_user_id=auth.uid()),
  (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id=c.suggestion_id and m.sender_user_id<>auth.uid()),
  (select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id=c.suggestion_id and m.sender_user_id<>auth.uid() and m.created_at>coalesce(r.last_read_at,'-infinity'::timestamptz)),latest.body,latest.created_at
 from public.personal_intent_collaboration_chats c join public.seeds s on s.id=c.seed_id
 left join public.profiles p on p.id=case when c.owner_user_id=auth.uid() then c.requester_user_id else c.owner_user_id end
 left join public.personal_intent_collaboration_reads r on r.suggestion_id=c.suggestion_id and r.user_id=auth.uid()
 left join lateral(select m.body,m.created_at from public.personal_intent_collaboration_messages m where m.suggestion_id=c.suggestion_id order by m.created_at desc,m.id desc limit 1)latest on true
 where auth.uid() in(c.owner_user_id,c.requester_user_id) order by coalesce(latest.created_at,c.updated_at) desc
$$;

create or replace function public.get_personal_intent_collaboration_chat_v34(p_suggestion_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare v_user uuid:=auth.uid();v_chat public.personal_intent_collaboration_chats%rowtype;v_result jsonb;
begin
 select * into v_chat from public.personal_intent_collaboration_chats c where c.suggestion_id=p_suggestion_id and v_user in(c.owner_user_id,c.requester_user_id);
 if not found then raise exception 'Tanışma sohbeti bulunamadı.';end if;
 select jsonb_build_object('chat_id',v_chat.suggestion_id,'seed_id',v_chat.seed_id,'canonical_target_id',s.canonical_target_id,'seed_title',public.uin_seed_display_title_v90(s.id),'status',v_chat.status,'planning_proposed_by',v_chat.planning_proposed_by,'viewer_id',v_user,
  'viewer_message_count',(select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id=v_chat.suggestion_id and m.sender_user_id=v_user),
  'other_message_count',(select count(*) from public.personal_intent_collaboration_messages m where m.suggestion_id=v_chat.suggestion_id and m.sender_user_id<>v_user),
  'other_user_id',p.id,'other_full_name',coalesce(nullif(trim(p.full_name),''),nullif(trim(p.username),''),'UIN üyesi'),'other_username',p.username,'other_avatar_url',p.avatar_url,
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender_user_id',m.sender_user_id,'body',m.body,'created_at',m.created_at,'sender_full_name',coalesce(nullif(trim(mp.full_name),''),nullif(trim(mp.username),''),'UIN üyesi'),'sender_username',mp.username,'sender_avatar_url',mp.avatar_url) order by m.created_at,m.id) from public.personal_intent_collaboration_messages m left join public.profiles mp on mp.id=m.sender_user_id where m.suggestion_id=v_chat.suggestion_id),'[]'::jsonb)) into v_result
 from public.seeds s left join public.profiles p on p.id=case when v_chat.owner_user_id=v_user then v_chat.requester_user_id else v_chat.owner_user_id end where s.id=v_chat.seed_id;
 return v_result;
end $$;

update public.notifications set title=title,body=body where lower(coalesce(notification_type,'')) like '%join_request%';

update public.notifications n set
 title=coalesce(nullif(trim(p.full_name),''),nullif(trim(p.username),''),'Bir UIN üyesi')||', “'||public.uin_seed_display_title_v90(x.seed_id)||'” için birlikte yapmayı önerdi',
 body='“'||public.uin_seed_display_title_v90(x.seed_id)||'” konusunu birlikte gerçekleştirmek istiyor. Kabul etmek veya reddetmek için aç.',
 action_url=case when x.status='accepted' then '/collaboration-chat/'||x.id::text else '/collaboration-suggestions?focus='||x.id::text end,
 actor_user_id=coalesce(n.actor_user_id,x.requester_user_id)
from public.personal_intent_collaboration_suggestions x left join public.profiles p on p.id=x.requester_user_id
where n.entity_id=x.id and n.notification_type='personal_intent_collaboration';

revoke all on function public.uin_activity_event_label_v90(text),public.uin_seed_display_title_v90(uuid) from public;
grant execute on function public.uin_activity_event_label_v90(text),public.uin_seed_display_title_v90(uuid) to authenticated;
grant execute on function public.get_my_personal_intent_collaboration_chats_v34(),public.get_personal_intent_collaboration_chat_v34(uuid),public.create_personal_intent_collaboration_suggestion_v2918(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
