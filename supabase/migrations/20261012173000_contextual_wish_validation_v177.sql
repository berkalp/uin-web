begin;
create or replace function public.save_my_contextual_personal_intent_v177(p_target_id uuid,p_start_date date default null,p_end_date date default null,p_visibility text default 'only_me',p_location_id uuid default null,p_notes text default null,p_timing_precision text default 'flexible',p_date_options jsonb default '[]'::jsonb,p_content_type_id text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $fn$
declare wish uuid;canonical_id uuid;
begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501';end if;
 canonical_id:=coalesce(public.resolve_uin_card_target_v129(p_target_id),p_target_id);
 if p_content_type_id is not null and not exists(
 select 1 from public.uin_card_content_types_v177 m
 join public.uin_content_types t on t.id=m.content_type_id and t.active
 join public.canonical_targets c on c.id=m.target_id
 where m.target_id=canonical_id and m.content_type_id=p_content_type_id
 and ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 and exists(select 1 from public.seed_catalog_items ci where ci.canonical_target_id=m.target_id and ci.status='active')) then
 raise exception 'Bu kart için geçerli bir kategori seç.' using errcode='22023';end if;
 wish:=public.save_my_common_personal_intent_v39(p_target_id,p_start_date,p_end_date,p_visibility,p_location_id,p_notes,p_timing_precision,p_date_options);
 if p_content_type_id is not null then update public.canonical_personal_intents_v38 set content_type_id=p_content_type_id where id=wish and user_id=auth.uid();end if;
 return wish;
end;$fn$;
do $patch$ declare definition text;begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='admin_save_uin_card_content_types_v177';
 definition:=replace(definition,'if ids is null or cardinality(ids)>3','if primary_type is null or ids is null or cardinality(ids)>3');
 execute definition;
end;$patch$;
notify pgrst,'reload schema';
commit;
