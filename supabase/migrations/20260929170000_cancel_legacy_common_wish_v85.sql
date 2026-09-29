begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;

create or replace function public.archive_my_common_wish_v73(p_target_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501';end if;

 update public.canonical_personal_intents_v38
 set status='archived',updated_at=now()
 where target_id=p_target_id and user_id=auth.uid() and status='active';

 update public.seeds seed
 set status='archived',updated_at=now()
 where seed.canonical_target_id=p_target_id
   and seed.user_id=auth.uid()
   and seed.status='active'
   and coalesce((select state.relationship_status from public.seed_personal_state_v15 state where state.seed_id=seed.id and state.user_id=auth.uid()),'want') in ('want','in_progress');
end;$$;

revoke all on function public.archive_my_common_wish_v73(uuid) from public,anon;
grant execute on function public.archive_my_common_wish_v73(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
