-- Add verified honours to existing identities only. No user activity is rewritten.
begin;
set local statement_timeout='120s';
do $honours$
declare
 p jsonb := $payload$PAYLOAD_JSON$payload$::jsonb;
 r jsonb; v_admin uuid; v_before text; v_after text; v_count bigint;
 v_claim text:=current_setting('request.jwt.claim.sub',true);
begin
 perform pg_advisory_xact_lock(hashtext('uin-card-honours-v213'));
 select user_id into v_admin from public.admin_users order by created_at limit 1;
 if v_admin is null then raise exception 'Catalogue admin missing';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select md5(coalesce(string_agg(to_jsonb(s)::text,'' order by s.id),'')) into v_before from public.seeds s;
 select count(*) into v_count from public.canonical_targets;
 update public.uin_content_types set ui_labels=coalesce(ui_labels,'{}'::jsonb)||'{"want":"Oynamak istiyorum","done":"Oynadım","wanting":"Oynamak isteyenler","doers":"Oynayanlar","event":"Oyun buluşması","action":"OYNA","question":"Ne oynamak istiyorsun?"}'::jsonb where id='game' and base_kind='game';
 for r in select value from jsonb_array_elements(p) loop
  if not exists(select 1 from public.seed_catalog_items where id=(r->>'id')::uuid and canonical_target_id=(r->>'target_id')::uuid and canonical_title=r->>'title' and item_kind=r->>'kind' and status='active') then raise exception 'Catalogue identity changed: %',r->>'title';end if;
  update public.seed_catalog_items set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{card_honours}',
   (select coalesce(jsonb_agg(h order by priority,ordinal),'[]'::jsonb) from (
    select distinct on(h->>'label',h->>'url') h,priority,ordinal from (
     select value h,0 priority,ordinality ordinal from jsonb_array_elements(r->'honours') with ordinality
     union all select value,1,ordinality from jsonb_array_elements(coalesce(metadata->'card_honours','[]'::jsonb)) with ordinality
    ) entries order by h->>'label',h->>'url',priority,ordinal
   ) merged)) where id=(r->>'id')::uuid;
  if not exists(select 1 from public.seed_catalog_items where id=(r->>'id')::uuid and canonical_target_id=(r->>'target_id')::uuid) then raise exception 'Canonical identity changed: %',r->>'title';end if;
  update public.canonical_targets t set editorial_metadata=jsonb_set(coalesce(t.editorial_metadata,'{}'::jsonb),'{card_honours}',i.metadata->'card_honours') from public.seed_catalog_items i where i.id=(r->>'id')::uuid and t.id=(r->>'target_id')::uuid;
 end loop;
 select md5(coalesce(string_agg(to_jsonb(s)::text,'' order by s.id),'')) into v_after from public.seeds s;
 if v_before is distinct from v_after then raise exception 'Personal history changed; rolling back';end if;
 if v_count<>(select count(*) from public.canonical_targets) then raise exception 'Canonical count changed; rolling back';end if;
 perform set_config('request.jwt.claim.sub',coalesce(v_claim,''),true);
end;
$honours$;
commit;
