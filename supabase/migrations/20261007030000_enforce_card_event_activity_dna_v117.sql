begin;

create or replace function public.create_my_card_event_v72(
  p_target_id uuid,
  p_event_title text,
  p_details jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_intent_id uuid;
  v_community_ids uuid[];
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
  return v_intent_id;
end;
$$;

revoke all on function public.create_my_card_event_v72(uuid,text,jsonb) from public;
grant execute on function public.create_my_card_event_v72(uuid,text,jsonb) to authenticated;
commit;
