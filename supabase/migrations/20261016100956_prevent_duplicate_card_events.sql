-- Keep historical rows intact. New writes are serialized per owner and checked
-- against the final library DNA, including aliases and host-source plans.
create table public.card_event_creation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (length(request_id) between 1 and 128),
  payload jsonb not null,
  intent_id uuid not null references public.intents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.card_event_creation_receipts enable row level security;
revoke all on public.card_event_creation_receipts from public, anon, authenticated;

create or replace function public.assert_new_card_event_unique(
  p_user_id uuid, p_target_id uuid, p_activity_id uuid, p_sport_id uuid,
  p_location_id uuid, p_start_date date, p_end_date date, p_exclude_id uuid default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_existing record;
begin
  -- All creation entry points take the same transaction lock. A second request
  -- waits for the first commit before checking; no check-then-insert race.
  perform pg_advisory_xact_lock(hashtextextended('card-event-owner:' || p_user_id::text, 0));
  select i.id, host_plan.id as plan_id into v_existing
  from public.intents i
  left join lateral (
    select p.id, p.status
    from public.plan_intents pi join public.plans p on p.id=pi.plan_id
    where pi.intent_id=i.id and pi.relationship='host_source'
    order by (pi.status='active') desc, p.created_at desc, p.id
    limit 1
  ) host_plan on true
  where i.user_id=p_user_id
    and i.id is distinct from p_exclude_id
    and i.status in ('active','planned')
    and (host_plan.id is null or host_plan.status in ('forming','planned'))
    and public.resolve_uin_card_target_v129(i.canonical_target_id)=public.resolve_uin_card_target_v129(p_target_id)
    and i.activity_id is not distinct from p_activity_id
    and i.sport_id is not distinct from p_sport_id
    and i.location_id is not distinct from p_location_id
    and i.start_date is not distinct from p_start_date
    and i.end_date is not distinct from p_end_date
  order by (host_plan.id is not null) desc, i.created_at, i.id
  limit 1;
  if found then
    raise exception 'Bu kartta aynı tür, yer ve tarihler için zaten bir etkinliğin var. Mevcut etkinliği düzenleyebilirsin.'
      using errcode='23505',
      detail=jsonb_build_object('kind','duplicate_card_event','intent_id',v_existing.id,'plan_id',v_existing.plan_id)::text;
  end if;
end;
$$;
revoke all on function public.assert_new_card_event_unique(uuid,uuid,uuid,uuid,uuid,date,date,uuid) from public, anon, authenticated;

create or replace function public.begin_card_event_creation(
 p_target_id uuid, p_details jsonb, p_related_target_ids uuid[]
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid:=auth.uid();
 v_key text:=nullif(p_details->>'p_creation_request_id','');
 v_payload jsonb;
 v_receipt public.card_event_creation_receipts%rowtype;
begin
 if v_user is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
 if length(v_key)>128 then raise exception 'Geçersiz kayıt isteği.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('card-event-owner:' || v_user::text,0));
 v_payload:=jsonb_build_object('target',p_target_id,'details',p_details-'p_creation_request_id',
   'related',to_jsonb(array(select distinct x from unnest(p_related_target_ids) x order by x)));
 if v_key is not null then
   select * into v_receipt from public.card_event_creation_receipts where user_id=v_user and request_id=v_key;
   if found then
     if v_receipt.payload<>v_payload then
       raise exception 'Bu kayıt isteğinin bilgileri değişti. Formu yeniden açarak mevcut etkinliği kontrol et.' using errcode='22023';
     end if;
     -- A retry returns the original result without running creation again.
     return v_receipt.intent_id;
   end if;
 end if;
 perform public.assert_new_card_event_unique(v_user,p_target_id,
   nullif(p_details->>'p_activity_id','')::uuid, nullif(p_details->>'p_sport_id','')::uuid,
   nullif(p_details->>'p_location_id','')::uuid, nullif(p_details->>'p_start_date','')::date,
   nullif(p_details->>'p_end_date','')::date);
 return null;
end;
$$;
revoke all on function public.begin_card_event_creation(uuid,jsonb,uuid[]) from public, anon, authenticated;

create or replace function public.finish_card_event_creation(
 p_target_id uuid,p_details jsonb,p_related_target_ids uuid[],p_intent_id uuid
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if nullif(p_details->>'p_creation_request_id','') is not null then
   insert into public.card_event_creation_receipts(user_id,request_id,payload,intent_id)
   values(auth.uid(),p_details->>'p_creation_request_id',
     jsonb_build_object('target',p_target_id,'details',p_details-'p_creation_request_id',
       'related',to_jsonb(array(select distinct x from unnest(p_related_target_ids) x order by x))),p_intent_id);
 end if;
end;
$$;
revoke all on function public.finish_card_event_creation(uuid,jsonb,uuid[],uuid) from public, anon, authenticated;

-- Deferred: creation initially assigns an activity target and attaches the main
-- library card later in the SAME transaction. Inspect the final row, not NEW.
create or replace function public.guard_inserted_card_event_unique()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_intent public.intents%rowtype;
begin
 select * into v_intent from public.intents where id=new.id;
 if found and v_intent.uin_main_card_explicit and v_intent.status in ('active','planned') then
   perform public.assert_new_card_event_unique(v_intent.user_id,v_intent.canonical_target_id,
     v_intent.activity_id,v_intent.sport_id,v_intent.location_id,v_intent.start_date,v_intent.end_date,v_intent.id);
 end if;
 return null;
end;
$$;
revoke all on function public.guard_inserted_card_event_unique() from public, anon, authenticated;
create constraint trigger prevent_duplicate_inserted_card_event
after insert on public.intents deferrable initially deferred
for each row execute function public.guard_inserted_card_event_unique();

CREATE OR REPLACE FUNCTION public.create_my_card_event_v72(p_target_id uuid, p_event_title text, p_details jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_intent_id uuid;
  v_community_ids uuid[];
  v_retry_id uuid;
  v_activity_id uuid;
  v_activity_name text;
  v_target_title text;
  v_event_title text;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Kart bulunamadı.'; end if;
  begin
    v_activity_id := nullif(p_details->>'p_activity_id','')::uuid;
  exception when others then
    raise exception 'Geçerli bir etkinlik türü seç.';
  end;
  if v_activity_id is null then raise exception 'Etkinlik türü seçmelisin.'; end if;

  select value->>'name' into v_activity_name
  from public.get_uin_card_activity_options_v106(p_target_id) option(value)
  where value->>'id'=v_activity_id::text
  limit 1;
  if v_activity_name is null then raise exception 'Bu kart için izin verilmeyen bir etkinlik türü seçildi.'; end if;

  select title into v_target_title from public.canonical_targets where id=p_target_id;
  v_event_title := left(coalesce(nullif(trim(v_target_title),''),'UIN Kartı') || ' / ' || v_activity_name, 160);

  v_community_ids := case when jsonb_typeof(p_details->'p_community_ids')='array'
    then array(select jsonb_array_elements_text(p_details->'p_community_ids')::uuid) else '{}'::uuid[] end;

  v_retry_id := public.begin_card_event_creation(p_target_id,p_details,'{}');
  if v_retry_id is not null then return v_retry_id; end if;

  v_intent_id := public.create_personal_intent_v32(
    v_activity_id,
    nullif(p_details->>'p_sport_id','')::uuid,
    nullif(p_details->>'p_location_id','')::uuid,
    p_details->>'p_start_date',
    p_details->>'p_end_date',
    coalesce(p_details->>'p_people','anyone'),
    coalesce(p_details->>'p_recurrence','one-time'),
    coalesce(p_details->>'p_visibility','public'),
    nullif(p_details->>'p_budget',''),
    p_details->>'p_notes',
    nullif(p_details->>'p_meeting_mode',''),
    nullif(p_details->>'p_online_provider',''),
    nullif(p_details->>'p_online_url',''),
    nullif(p_details->>'p_max_participants',''),
    nullif(p_details->>'p_participant_eligibility',''),
    nullif(p_details->>'p_join_message_mode',''),
    p_details->>'p_join_message_prompt',
    v_community_ids,
    coalesce(p_details->'p_links','[]'::jsonb)
  );

  perform public.attach_my_social_intent_to_uin_card_v72(v_intent_id,p_target_id,true,v_event_title);
  perform public.finish_card_event_creation(p_target_id,p_details,'{}',v_intent_id);
  return v_intent_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_my_card_event_v72(p_target_id uuid, p_details jsonb, p_related_target_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;v_retry_id uuid;v_communities uuid[];begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.';end if;
 if p_target_id is null or not exists(select 1 from public.canonical_targets where id=p_target_id and coalesce(editorial_metadata->>'admin_hidden','false')<>'true') then raise exception 'Etkinliğin ana UIN kartını seç.';end if;
 if jsonb_typeof(p_details)<>'object' then raise exception 'Etkinlik bilgileri geçersiz.';end if;
 if coalesce(array_length(p_related_target_ids,1),0)>5 then raise exception 'En fazla 5 ilgili kart seçebilirsin.';end if;
 if exists(select 1 from unnest(p_related_target_ids) id where id is null or not exists(select 1 from public.canonical_targets t where t.id=id and coalesce(t.editorial_metadata->>'admin_hidden','false')<>'true')) then raise exception 'İlgili UIN kartı bulunamadı.';end if;
 select coalesce(array_agg(value::uuid),'{}') into v_communities from jsonb_array_elements_text(coalesce(p_details->'p_community_ids','[]'));
 v_retry_id:=public.begin_card_event_creation(p_target_id,p_details,p_related_target_ids);
 if v_retry_id is not null then return v_retry_id;end if;
 v_id:=public.create_my_intent_with_communities_eligibility_and_join_settings(
 p_start_date:=(p_details->>'p_start_date')::date,p_end_date:=(p_details->>'p_end_date')::date,p_people:=p_details->>'p_people',p_location_id:=(p_details->>'p_location_id')::uuid,p_activity_id:=(p_details->>'p_activity_id')::uuid,p_sport_id:=(p_details->>'p_sport_id')::uuid,p_budget:=(p_details->>'p_budget')::numeric,p_recurrence:=p_details->>'p_recurrence',p_visibility:=p_details->>'p_visibility',p_notes:=p_details->>'p_notes',p_intent_type:=p_details->>'p_intent_type',p_max_participants:=(p_details->>'p_max_participants')::integer,p_community_ids:=v_communities,p_participant_eligibility:=p_details->>'p_participant_eligibility',p_join_message_mode:=p_details->>'p_join_message_mode',p_join_message_prompt:=p_details->>'p_join_message_prompt',p_professional_requirement:=p_details->>'p_professional_requirement',p_professional_role_id:=(p_details->>'p_professional_role_id')::uuid);
 perform public.attach_my_social_intent_to_common_target_v38(v_id,p_target_id,p_details->>'p_event_title');
 insert into public.uin_event_related_cards_v72(intent_id,target_id) select distinct v_id,id from unnest(p_related_target_ids) id where id<>p_target_id;
 perform public.finish_card_event_creation(p_target_id,p_details,p_related_target_ids,v_id);
 return v_id;
end;$function$
;

revoke all on function public.create_my_card_event_v72(uuid,jsonb,uuid[]) from public,anon;
revoke all on function public.create_my_card_event_v72(uuid,text,jsonb) from public,anon;
grant execute on function public.create_my_card_event_v72(uuid,jsonb,uuid[]) to authenticated;
grant execute on function public.create_my_card_event_v72(uuid,text,jsonb) to authenticated;
