begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

alter table public.uin_together_proposals_v71 drop constraint if exists uin_together_proposals_v71_status_check;
alter table public.uin_together_proposals_v71 add constraint uin_together_proposals_v71_status_check check (status in ('pending','accepted','declined','cancelled'));

create or replace function public.prepare_uin_together_v71(p_target_id uuid,p_recipient_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_source record;v_friend boolean:=false;v_mode text;v_existing text;
begin
 if auth.uid() is null then return jsonb_build_object('allowed',false,'reason','Öneri göndermek için giriş yap.','code','login_required');end if;
 if public.is_managed_minor_user(auth.uid()) or public.is_managed_minor_user(p_recipient_id) then return jsonb_build_object('allowed',false,'reason','Bu profil için öneri gönderilemiyor.','code','restricted_profile');end if;
 if auth.uid()=p_recipient_id then return jsonb_build_object('allowed',false,'reason','Kendine öneri gönderemezsin.','code','self');end if;
 if public.is_user_discovery_blocked_v2918(auth.uid(),p_recipient_id) or public.is_user_discovery_blocked_v2918(p_recipient_id,auth.uid()) then return jsonb_build_object('allowed',false,'reason','Bu kişiye öneri gönderilemiyor.','code','blocked');end if;
 select visible.* into v_source from public.visible_common_target_people_v38() visible where visible.target_id=p_target_id and visible.user_id=p_recipient_id and visible.relationship_status='want' order by case visible.source_kind when 'personal' then 0 when 'seed' then 1 else 2 end limit 1;
 if not found then return jsonb_build_object('allowed',false,'reason','Bu kişinin görünür ve güncel bir isteği bulunamadı.','code','not_current');end if;
 select proposal.status into v_existing from public.uin_together_proposals_v71 proposal where proposal.target_id=p_target_id and proposal.sender_id=auth.uid() and proposal.recipient_id=p_recipient_id and proposal.status<>'cancelled' order by proposal.created_at desc limit 1;
 if v_existing is not null then return jsonb_build_object('allowed',false,'reason',case v_existing when 'pending' then 'Bu kişi için daha önce birlikte yapma isteği gönderdin; yanıt bekliyor.' when 'accepted' then 'Bu kişi için daha önce gönderdiğin birlikte yapma isteği kabul edildi.' else 'Bu kişi için daha önce birlikte yapma isteği gönderdin ve yanıtlandı.' end,'code','already_sent','status',v_existing);end if;
 if (select count(*) from public.uin_together_proposals_v71 where sender_id=auth.uid() and created_at>now()-interval '1 day')>=10 then return jsonb_build_object('allowed',false,'reason','24 saat içinde en fazla 10 birlikte yapma önerisi gönderebilirsin.','code','daily_limit');end if;
 if v_source.source_kind='personal' then select personal.collaboration_mode into v_mode from public.canonical_personal_intents_v38 personal where personal.id=v_source.source_id and personal.status='active';
 elsif v_source.source_kind='seed' then select coalesce(settings.suggestion_mode,'everyone') into v_mode from public.seeds seed left join public.personal_intent_collaboration_settings settings on settings.seed_id=seed.id where seed.id=v_source.source_id and coalesce(seed.status,'active')<>'completed';
 else v_mode:='everyone';end if;
 if v_mode is null then return jsonb_build_object('allowed',false,'reason','Bu kişinin görünür ve güncel bir isteği bulunamadı.','code','not_current');end if;
 if v_mode='off' then return jsonb_build_object('allowed',false,'reason','Kişi bu istekte birlikte yapma önerilerini kapattı.','code','closed');end if;
 if v_mode='friends' then select exists(select 1 from public.get_my_friendships() friendship where to_jsonb(friendship)->>'other_user_id'=p_recipient_id::text and to_jsonb(friendship)->>'friendship_status'='accepted') into v_friend;if not v_friend then return jsonb_build_object('allowed',false,'reason','Bu kişi yalnızca arkadaşlarından birlikte yapma önerisi kabul ediyor.','code','friends_only');end if;end if;
 return jsonb_build_object('allowed',true,'code','allowed');
end;$$;

create or replace function public.cancel_uin_together_v108(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_proposal public.uin_together_proposals_v71;
begin
 select * into v_proposal from public.uin_together_proposals_v71 where id=p_id and sender_id=auth.uid() and status='pending' for update;
 if not found then raise exception 'İptal edilebilecek bekleyen öneri bulunamadı.';end if;
 update public.uin_together_proposals_v71 set status='cancelled',answered_at=now() where id=p_id;
 delete from public.notifications where entity_id=p_id and notification_type='personal_intent_collaboration' and user_id=v_proposal.recipient_id;
end;$$;

revoke all on function public.cancel_uin_together_v108(uuid) from public,anon;
grant execute on function public.cancel_uin_together_v108(uuid) to authenticated;
grant execute on function public.prepare_uin_together_v71(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
