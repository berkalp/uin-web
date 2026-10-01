-- v91: distinguish explicit declines from requests closed because the event ended or was cancelled.
alter table public.intent_join_requests drop constraint if exists intent_join_requests_status_check;
alter table public.intent_join_requests add constraint intent_join_requests_status_check
  check (status in ('pending','accepted','declined','withdrawn','expired','cancelled'));

create or replace function public.sync_expired_intent_join_requests_v91()
returns integer language plpgsql security definer set search_path=public,extensions as $$
declare v_row record; v_count integer:=0; v_status text; v_title text;
begin
 for v_row in select request.id,request.requester_user_id,request.receiver_user_id,
  intent.status intent_status,intent.end_date,intent.expired_at,activity.id activity_id,
  public.uin_activity_event_label_v90(activity.name) activity_title
  from public.intent_join_requests request join public.intents intent on intent.id=request.intent_id
  join public.activities activity on activity.id=intent.activity_id
  where request.status='pending' and (intent.status='cancelled' or intent.expired_at is not null or (intent.end_date is not null and intent.end_date<current_date))
  for update of request skip locked
 loop
  v_status:=case when v_row.intent_status='cancelled' then 'cancelled' else 'expired' end;
  v_title:=coalesce(nullif(trim(v_row.activity_title),''),'Etkinlik');
  update public.intent_join_requests set status=v_status,
   response_reason=case when v_status='cancelled' then 'uin:event_cancelled' else 'uin:no_response_expired' end,
   responded_at=coalesce(responded_at,now()),updated_at=now() where id=v_row.id and status='pending';
  if found then
   v_count:=v_count+1;
   update public.notifications set read_at=coalesce(read_at,now()) where user_id=v_row.receiver_user_id and entity_type='intent_join_request' and entity_id=v_row.id;
   if v_status='expired' then
    insert into public.notifications(user_id,notification_type,entity_type,entity_id,title,body,action_url) values
     (v_row.requester_user_id,'intent_join_request_expired','intent_join_request',v_row.id,'“'||v_title||'” katılım isteğin yanıtsız kapandı','Etkinlik tarihi geçti ve yürütenden zamanında yanıt gelmedi.','/join-requests?history=all#request-'||v_row.id::text),
     (v_row.receiver_user_id,'intent_join_request_expired_unanswered','intent_join_request',v_row.id,'“'||v_title||'” katılım isteğine zamanında yanıt vermedin','Etkinlik tarihi geçtiği için bekleyen istek otomatik kapandı.','/join-requests?history=all#request-'||v_row.id::text);
   else
    insert into public.notifications(user_id,notification_type,entity_type,entity_id,title,body,action_url) values
     (v_row.requester_user_id,'intent_join_request_event_cancelled','intent_join_request',v_row.id,'“'||v_title||'” etkinliği iptal edildi','Bekleyen katılım isteğin etkinlik iptal edildiği için kapandı.','/join-requests?history=all#request-'||v_row.id::text),
     (v_row.receiver_user_id,'intent_join_request_event_cancelled_owner','intent_join_request',v_row.id,'“'||v_title||'” için bekleyen katılım isteği kapandı','Etkinlik iptal edildiği için bekleyen istek otomatik kapandı.','/join-requests?history=all#request-'||v_row.id::text);
   end if;
  end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.sync_expired_intent_join_requests_v91() from public;
revoke all on function public.sync_expired_intent_join_requests_v91() from anon,authenticated;
grant execute on function public.sync_expired_intent_join_requests_v91() to service_role;

create or replace function public.get_my_intent_join_requests()
returns table(request_id uuid,direction text,request_status text,request_message text,response_reason text,request_created_at timestamptz,request_responded_at timestamptz,intent_id uuid,plan_id uuid,activity_name text,category_name text,city text,district text,start_date date,end_date date,other_user_id uuid,other_user_full_name text,other_user_username text,other_user_avatar_url text)
language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=auth.uid();
begin
 if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
 perform public.sync_expired_intent_join_requests_v91();
 return query select request.id,case when request.receiver_user_id=v_user_id then 'received' else 'sent' end,
  request.status,request.message,request.response_reason,request.created_at,request.responded_at,intent.id,request.plan_id,
  public.uin_activity_event_label_v90(activity.name),category.name,location.city,location.district,intent.start_date,intent.end_date,
  other_profile.id,other_profile.full_name,other_profile.username,other_profile.avatar_url
 from public.intent_join_requests request join public.intents intent on intent.id=request.intent_id
 join public.activities activity on activity.id=intent.activity_id join public.activity_categories category on category.id=activity.category_id
 join public.locations location on location.id=intent.location_id left join public.profiles other_profile on other_profile.id=case when request.receiver_user_id=v_user_id then request.requester_user_id else request.receiver_user_id end
 where request.requester_user_id=v_user_id or request.receiver_user_id=v_user_id
 order by case request.status when 'pending' then 0 else 1 end,request.created_at desc;
end $$;
grant execute on function public.get_my_intent_join_requests() to authenticated;

do $$ declare v_job_id bigint; begin
 for v_job_id in select jobid from cron.job where jobname='uin-expire-join-requests-v91' loop perform cron.unschedule(v_job_id); end loop;
 perform cron.schedule('uin-expire-join-requests-v91','*/15 * * * *','select public.sync_expired_intent_join_requests_v91();');
end $$;
select public.sync_expired_intent_join_requests_v91();
