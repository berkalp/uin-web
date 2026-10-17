CREATE OR REPLACE FUNCTION public.protect_event_custom_cover_v86()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_intent_id uuid;
begin
 v_intent_id:=case when tg_op='DELETE' then old.intent_id else new.intent_id end;
 if not (coalesce(current_setting('uin.admin_record_edit',true),'')='on' and auth.uid() is not null and public.is_admin()) and auth.uid() is not null and exists(select 1 from public.plan_intents pi where pi.intent_id=v_intent_id and pi.status='active') then
  raise exception 'Etkinlik kapağı sistem tarafından yönetilir; doğrudan kapak yüklenemez.' using errcode='0A000';
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;$function$;
