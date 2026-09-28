begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
alter table public.personal_intent_collaboration_chats
  add column if not exists planning_creator_user_id uuid null,
  add column if not exists planning_intent_id uuid null references public.intents(id) on delete set null;
create or replace function public.respond_personal_intent_planning_v34(p_suggestion_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_chat public.personal_intent_collaboration_chats%rowtype; v_other uuid;
begin
  select * into v_chat from public.personal_intent_collaboration_chats c where c.suggestion_id = p_suggestion_id and auth.uid() in (c.owner_user_id, c.requester_user_id) for update;
  if not found or v_chat.status <> 'planning_proposed' or v_chat.planning_proposed_by = auth.uid() then raise exception 'Yanıtlanacak planlama önerisi bulunamadı.'; end if;
  if p_accept then
    update public.personal_intent_collaboration_chats set status = 'planning_ready', planning_ready_at = now(), planning_creator_user_id = owner_user_id, updated_at = now() where suggestion_id = p_suggestion_id;
  else
    update public.personal_intent_collaboration_chats set status = 'chat', planning_proposed_by = null, planning_creator_user_id = null, updated_at = now() where suggestion_id = p_suggestion_id;
  end if;
  v_other := v_chat.planning_proposed_by;
  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values (v_other, 'personal_intent_collaboration_planning_response', 'personal_intent_collaboration', p_suggestion_id, case when p_accept then 'Planlama önerin kabul edildi' else 'Henüz konuşmaya devam etmek istiyor' end, case when p_accept then 'İkiniz de hazırsınız. Niyet sahibi planlama bilgilerini oluşturabilir.' else 'Tanışma sohbetinden konuşmaya devam edebilirsiniz.' end, '/collaboration-chat/' || p_suggestion_id::text);
  return v_chat.seed_id;
end $$;
create or replace function public.get_personal_intent_collaboration_plan_v35(p_suggestion_id uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'planning_creator_user_id', c.planning_creator_user_id,
    'planning_intent_id', c.planning_intent_id
  )
  from public.personal_intent_collaboration_chats c
  where c.suggestion_id = p_suggestion_id and auth.uid() in (c.owner_user_id, c.requester_user_id);
$$;
create or replace function public.finalize_personal_intent_collaboration_plan_v35(p_suggestion_id uuid, p_intent_id uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_chat public.personal_intent_collaboration_chats%rowtype; v_other uuid;
begin
  select * into v_chat from public.personal_intent_collaboration_chats c where c.suggestion_id = p_suggestion_id and auth.uid() in (c.owner_user_id, c.requester_user_id) for update;
  if not found or v_chat.status <> 'planning_ready' then raise exception 'Bu sohbet planlama oluşturmaya hazır değil.'; end if;
  if v_chat.planning_creator_user_id <> auth.uid() then raise exception 'Planlamayı kaynak Niyet sahibi oluşturabilir.'; end if;
  if not exists(select 1 from public.intents i where i.id = p_intent_id and i.user_id = auth.uid()) then raise exception 'Oluşturulan planlama bulunamadı.'; end if;
  if v_chat.planning_intent_id is not null and v_chat.planning_intent_id <> p_intent_id then return v_chat.planning_intent_id; end if;
  update public.personal_intent_collaboration_chats set planning_intent_id = p_intent_id, updated_at = now() where suggestion_id = p_suggestion_id;
  v_other := case when v_chat.owner_user_id = auth.uid() then v_chat.requester_user_id else v_chat.owner_user_id end;
  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values (v_other, 'personal_intent_collaboration_plan_ready', 'intent', p_intent_id, 'Birlikte planladığınız etkinlik hazır', 'Kesin tarih, yer ve diğer ayrıntıları inceleyip katılım davetini yanıtlayabilirsin.', '/intent/' || p_intent_id::text);
  return p_intent_id;
end $$;
revoke all on function public.get_personal_intent_collaboration_plan_v35(uuid), public.finalize_personal_intent_collaboration_plan_v35(uuid,uuid) from public, anon;
grant execute on function public.get_personal_intent_collaboration_plan_v35(uuid), public.finalize_personal_intent_collaboration_plan_v35(uuid,uuid) to authenticated;
commit;
