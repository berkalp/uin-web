begin;

create or replace function public.get_my_intent_join_requests()
returns table(request_id uuid,direction text,request_status text,request_message text,response_reason text,request_created_at timestamptz,request_responded_at timestamptz,intent_id uuid,plan_id uuid,activity_name text,category_name text,city text,district text,start_date date,end_date date,other_user_id uuid,other_user_full_name text,other_user_username text,other_user_avatar_url text)
language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=auth.uid();
begin
 if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
 perform public.sync_expired_intent_join_requests_v91();
 return query select request.id,case when request.receiver_user_id=v_user_id then 'received' else 'sent' end,
  request.status,request.message,request.response_reason,request.created_at,request.responded_at,intent.id,request.plan_id,
  public.uin_event_display_title_v86(intent.id),category.name,location.city,location.district,intent.start_date,intent.end_date,
  other_profile.id,other_profile.full_name,other_profile.username,other_profile.avatar_url
 from public.intent_join_requests request join public.intents intent on intent.id=request.intent_id
 join public.activities activity on activity.id=intent.activity_id join public.activity_categories category on category.id=activity.category_id
 join public.locations location on location.id=intent.location_id left join public.profiles other_profile on other_profile.id=case when request.receiver_user_id=v_user_id then request.requester_user_id else request.receiver_user_id end
 where request.requester_user_id=v_user_id or request.receiver_user_id=v_user_id order by request.created_at desc;
end $$;
revoke all on function public.get_my_intent_join_requests() from public;
grant execute on function public.get_my_intent_join_requests() to authenticated;

create or replace function public.normalize_join_request_event_title_v92()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_subject text;v_requester text;
begin
 if new.entity_type<>'intent_join_request' or new.entity_id is null then return new;end if;
 select public.uin_event_display_title_v86(r.intent_id),coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),'Bir UIN üyesi')
 into v_subject,v_requester from public.intent_join_requests r left join public.profiles p on p.id=r.requester_user_id where r.id=new.entity_id;
 if v_subject is null then return new;end if;
 new.title:=left(case
  when new.notification_type='intent_join_request_expired_unanswered' then '“'||v_subject||'” katılım isteğine zamanında yanıt vermedin'
  when new.notification_type='intent_join_request_expired' then '“'||v_subject||'” katılım isteğin yanıtsız kapandı'
  when new.notification_type='intent_join_request_event_cancelled_owner' then '“'||v_subject||'” için bekleyen katılım isteği kapandı'
  when new.notification_type='intent_join_request_event_cancelled' then '“'||v_subject||'” etkinliği iptal edildi'
  when lower(coalesce(new.notification_type,'')) like '%accepted%' then '“'||v_subject||'” etkinliğine katılım isteğin kabul edildi'
  when lower(coalesce(new.notification_type,'')) like '%declined%' then '“'||v_subject||'” etkinliğine katılım isteğin reddedildi'
  else v_requester||', “'||v_subject||'” etkinliğine katılmak istiyor' end,200);
 return new;
end $$;

drop trigger if exists zz_normalize_join_request_event_title_v92 on public.notifications;
create trigger zz_normalize_join_request_event_title_v92 before insert or update of title,body,notification_type on public.notifications for each row execute function public.normalize_join_request_event_title_v92();

update public.notifications n set title=n.title
where n.entity_type='intent_join_request' and n.entity_id is not null;

commit;
