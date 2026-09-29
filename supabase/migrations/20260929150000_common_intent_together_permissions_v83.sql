begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

alter table public.canonical_personal_intents_v38 add column if not exists collaboration_mode text not null default 'everyone';
alter table public.canonical_personal_intents_v38 drop constraint if exists canonical_personal_intents_v38_collaboration_mode_check;
alter table public.canonical_personal_intents_v38 add constraint canonical_personal_intents_v38_collaboration_mode_check check (collaboration_mode in ('off','friends','everyone'));
update public.canonical_personal_intents_v38 set collaboration_mode='everyone' where collaboration_mode is null or collaboration_mode not in ('off','friends','everyone');

create or replace function public.get_my_common_personal_intent_v39(p_target_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',personal.id,'status',personal.status,'start_date',personal.start_date,'end_date',personal.end_date,
  'visibility',personal.visibility,'collaboration_mode',personal.collaboration_mode,'location_id',personal.location_id,'notes',personal.notes,
  'timing_precision',personal.timing_precision,'date_options',personal.date_options)
 from public.canonical_personal_intents_v38 personal
 where personal.target_id=p_target_id and personal.user_id=auth.uid() and personal.status in ('active','completed')
 order by personal.updated_at desc limit 1;
$$;

create or replace function public.set_my_common_intent_collaboration_v83(p_target_id uuid,p_mode text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_mode text:=lower(coalesce(nullif(btrim(p_mode),''),'everyone'));
begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501';end if;
 if v_mode not in ('off','friends','everyone') then raise exception 'Birlikte yapma izni geçersiz.' using errcode='22023';end if;
 update public.canonical_personal_intents_v38 set collaboration_mode=v_mode,updated_at=now()
 where target_id=p_target_id and user_id=auth.uid() and status in ('active','completed');
 if not found then raise exception 'Önce bu kart için isteğini kaydet.' using errcode='P0002';end if;
end;$$;

create or replace function public.prepare_uin_together_v71(p_target_id uuid,p_recipient_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_friend boolean:=false;v_mode text;v_existing text;
begin
 if auth.uid() is null then return jsonb_build_object('allowed',false,'reason','Öneri göndermek için giriş yap.','code','login_required');end if;
 if public.is_managed_minor_user(auth.uid()) or public.is_managed_minor_user(p_recipient_id) then return jsonb_build_object('allowed',false,'reason','Bu profil için öneri gönderilemiyor.','code','restricted_profile');end if;
 if auth.uid()=p_recipient_id then return jsonb_build_object('allowed',false,'reason','Kendine öneri gönderemezsin.','code','self');end if;
 if public.is_user_discovery_blocked_v2918(auth.uid(),p_recipient_id) or public.is_user_discovery_blocked_v2918(p_recipient_id,auth.uid()) then return jsonb_build_object('allowed',false,'reason','Bu kişiye öneri gönderilemiyor.','code','blocked');end if;
 select personal.collaboration_mode into v_mode from public.canonical_personal_intents_v38 personal
 where personal.target_id=p_target_id and personal.user_id=p_recipient_id and personal.status='active'
  and public.personal_common_intent_visible_v38(personal.user_id,personal.visibility,auth.uid())
 order by personal.updated_at desc limit 1;
 if not found then return jsonb_build_object('allowed',false,'reason','Bu kişinin görünür ve güncel bir isteği bulunamadı.','code','not_current');end if;
 select proposal.status into v_existing from public.uin_together_proposals_v71 proposal
 where proposal.target_id=p_target_id and proposal.sender_id=auth.uid() and proposal.recipient_id=p_recipient_id order by proposal.created_at desc limit 1;
 if v_existing is not null then return jsonb_build_object('allowed',false,'reason',case v_existing when 'pending' then 'Bu kişi için daha önce birlikte yapma isteği gönderdin; yanıt bekliyor.' when 'accepted' then 'Bu kişi için daha önce gönderdiğin birlikte yapma isteği kabul edildi.' else 'Bu kişi için daha önce birlikte yapma isteği gönderdin ve yanıtlandı.' end,'code','already_sent','status',v_existing);end if;
 if v_mode='off' then return jsonb_build_object('allowed',false,'reason','Kişi bu istekte birlikte yapma önerilerini kapattı.','code','closed');end if;
 if v_mode='friends' then
  select exists(select 1 from public.get_my_friendships() friendship where to_jsonb(friendship)->>'other_user_id'=p_recipient_id::text and to_jsonb(friendship)->>'friendship_status'='accepted') into v_friend;
  if not v_friend then return jsonb_build_object('allowed',false,'reason','Bu kişi yalnızca arkadaşlarından birlikte yapma önerisi kabul ediyor.','code','friends_only');end if;
 end if;
 return jsonb_build_object('allowed',true,'code','allowed');
end;$$;

create or replace function public.get_uin_together_permissions_v83(p_requests jsonb)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select permission.result || jsonb_build_object('target_id',request->>'target_id','recipient_id',request->>'recipient_id')
 from jsonb_array_elements(coalesce(p_requests,'[]'::jsonb)) request
 cross join lateral (select public.prepare_uin_together_v71((request->>'target_id')::uuid,(request->>'recipient_id')::uuid) result) permission;
$$;

revoke all on function public.set_my_common_intent_collaboration_v83(uuid,text),public.get_uin_together_permissions_v83(jsonb) from public,anon;
grant execute on function public.set_my_common_intent_collaboration_v83(uuid,text),public.get_uin_together_permissions_v83(jsonb) to authenticated;
grant execute on function public.get_my_common_personal_intent_v39(uuid),public.prepare_uin_together_v71(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
