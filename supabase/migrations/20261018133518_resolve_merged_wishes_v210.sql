CREATE OR REPLACE FUNCTION public.save_my_common_personal_intent_v39(p_target_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_visibility text DEFAULT 'only_me'::text, p_location_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_timing_precision text DEFAULT 'flexible'::text, p_date_options jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid; v_visibility text:=lower(coalesce(nullif(btrim(p_visibility),''),'only_me'));
  v_precision text:=lower(coalesce(nullif(btrim(p_timing_precision),''),'flexible'));
begin
  if auth.uid() is null then raise exception 'GiriÅŸ yapmalÄ±sÄ±n.' using errcode='42501'; end if;
  p_target_id:=public.resolve_uin_card_target_v129(p_target_id);
  if not exists(select 1 from public.canonical_targets where id=p_target_id) then raise exception 'Ortak niyet bulunamadÄ±.' using errcode='P0002'; end if;
  if v_visibility not in ('only_me','friends','everyone') then raise exception 'GÃ¶rÃ¼nÃ¼rlÃ¼k geÃ§ersiz.' using errcode='22023'; end if;
  if v_precision not in ('flexible','day','range','week','month','year','multiple') then raise exception 'Zaman seÃ§imi geÃ§ersiz.' using errcode='22023'; end if;
  if p_start_date is not null and p_end_date is not null and p_end_date<p_start_date then raise exception 'BitiÅŸ tarihi baÅŸlangÄ±Ã§tan Ã¶nce olamaz.' using errcode='22023'; end if;
  if p_location_id is not null and not exists(select 1 from public.locations where id=p_location_id) then raise exception 'Konum bulunamadÄ±.' using errcode='P0002'; end if;
  if char_length(coalesce(p_notes,''))>2000 then raise exception 'Not 2000 karakteri geÃ§emez.' using errcode='22001'; end if;
  if jsonb_typeof(coalesce(p_date_options,'[]'::jsonb))<>'array' then raise exception 'Tarih seÃ§enekleri dizi olmalÄ±.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_target_id::text,0));
  insert into public.canonical_personal_intents_v38(
    target_id,user_id,start_date,end_date,visibility,location_id,notes,timing_precision,date_options)
  values(p_target_id,auth.uid(),p_start_date,p_end_date,v_visibility,p_location_id,
    nullif(btrim(p_notes),''),v_precision,coalesce(p_date_options,'[]'::jsonb))
  on conflict(target_id,user_id) where status in ('active','completed') do update set
    start_date=excluded.start_date,end_date=excluded.end_date,visibility=excluded.visibility,
    location_id=excluded.location_id,notes=excluded.notes,timing_precision=excluded.timing_precision,
    date_options=excluded.date_options,status='active',updated_at=now()
  returning id into v_id;
  return v_id;
end;
$function$;
