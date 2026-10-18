-- Additive, repeatable catalogue update. No personal record is reassigned.
begin;
set local statement_timeout='120s';
do $seed$
declare
 p jsonb := $payload$PAYLOAD_JSON$payload$::jsonb;
 r jsonb; v_admin uuid; v_play uuid; v_target uuid; v_item uuid; v_meta jsonb; v_types jsonb;
 v_before text; v_after text; v_claim text:=current_setting('request.jwt.claim.sub',true);
begin
 perform pg_advisory_xact_lock(hashtext('uin-games-20261018'));
 select user_id into v_admin from public.admin_users order by created_at limit 1;
 if v_admin is null then raise exception 'Catalogue admin missing';end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select id into v_play from public.seed_types where slug='play' and is_active;
 if v_play is null then raise exception 'Play action missing';end if;
 select md5(coalesce(string_agg((to_jsonb(s)-'cover_url'-'updated_at')::text,'' order by s.id),'')) into v_before from public.seeds s;
 for r in select value from jsonb_array_elements(p->'games') loop
   v_item:=null;v_target:=null;
   if r->>'existing_id' is not null then
     select id,canonical_target_id into v_item,v_target from public.seed_catalog_items
       where id=(r->>'existing_id')::uuid and canonical_target_id=(r->>'existing_target')::uuid and canonical_title=r->>'title' and status='active';
     if v_item is null then raise exception 'Existing game changed: %',r->>'title';end if;
   else
     select catalog_item_id,canonical_target_id into v_item,v_target from public.add_verified_seed_catalog_item_v42(
       v_play,'game',r->>'title',r->>'creator',r->>'cover','igdb',r->>'externalId',r->>'source',r->'metadata');
   end if;
   if v_target is null then raise exception 'Missing game target: %',r->>'title';end if;
   update public.seed_catalog_items set metadata=coalesce(metadata,'{}'::jsonb)||(r->'metadata'),
     cover_url=case when cover_url=r->>'replaced_cover' then r->>'cover' else coalesce(nullif(cover_url,''),r->>'cover') end,updated_at=now() where id=v_item;
   update public.canonical_targets set editorial_metadata=coalesce(editorial_metadata,'{}'::jsonb)||(r->'metadata'),
     editorial_cover_url=case when editorial_cover_url=r->>'replaced_cover' then r->>'cover' else coalesce(nullif(editorial_cover_url,''),r->>'cover') end,updated_at=now() where id=v_target;
 end loop;
 for r in select value from jsonb_array_elements(p->'boards') loop
   if r#>>'{cover,url}' is null then raise exception 'Missing photo: %',r->>'title';end if;
   v_target:=null;
   select id into v_target from public.canonical_targets where editorial_metadata->>'catalogue_batch'='uin-board-games-20261018' and editorial_metadata->>'catalogue_title'=r->>'title';
   if v_target is null and r->>'existing_target' is not null then
     select id into v_target from public.canonical_targets where id=(r->>'existing_target')::uuid and title=r->>'title';
     if v_target is null then raise exception 'Board target changed: %',r->>'title';end if;
   elsif v_target is null then
     if exists(select 1 from public.seed_catalog_items where status='active' and canonical_title=r->>'title' and item_kind in ('generic','hobby','activity','sport')) then raise exception 'Unreviewed duplicate: %',r->>'title';end if;
     v_target:=public.admin_create_uin_card_v59(v_play,'board_game',r->>'title',null,r#>>'{cover,url}',r->>'description',r->>'reference');
   end if;
   select editorial_metadata into v_meta from public.canonical_targets where id=v_target for update;
   select jsonb_agg(distinct content_type_id) into v_types from (
     select content_type_id from public.uin_card_content_types_v177 where target_id=v_target union select 'board_game'
   ) t;
   if jsonb_array_length(v_types)>3 then raise exception 'Category limit: %',r->>'title';end if;
   update public.canonical_targets set editorial_cover_url=coalesce(nullif(editorial_cover_url,''),r#>>'{cover,url}'),
     editorial_metadata=coalesce(v_meta,'{}'::jsonb)||coalesce(r->'metadata','{}'::jsonb)||jsonb_build_object('content_type_ids',v_types)||case when r->>'existing_target' is not null then '{}'::jsonb else jsonb_build_object(
       'content_type_ids',v_types,'description',r->>'description','reference_url',r->>'reference',
       'reference_links',jsonb_build_array(jsonb_build_object('label','Oyun hakkında','url',r->>'reference'),
         jsonb_build_object('label','Görsel: '||(r#>>'{cover,attribution,author}')||' · '||(r#>>'{cover,attribution,license}'),'url',r#>>'{cover,source}')),
       'image_attribution',r#>'{cover,attribution}','cover_source_url',r#>>'{cover,source}','cover_provider',coalesce(r#>>'{cover,provider}','wikimedia'),
       'cover_is_illustrative',coalesce((r->>'illustrative')::boolean,false),'catalogue_batch','uin-board-games-20261018','catalogue_title',r->>'title','language','tr') end,updated_at=now()
   where id=v_target;
   update public.seed_catalog_items set metadata=coalesce(metadata,'{}'::jsonb)||coalesce(r->'metadata','{}'::jsonb)||jsonb_build_object('content_type_ids',v_types), updated_at=now() where canonical_target_id=v_target and status='active';
   if not exists(select 1 from public.uin_card_content_types_v177 where target_id=v_target and content_type_id='board_game') then raise exception 'Board category missing: %',r->>'title';end if;
 end loop;
 select md5(coalesce(string_agg((to_jsonb(s)-'cover_url'-'updated_at')::text,'' order by s.id),'')) into v_after from public.seeds s;
 if v_before is distinct from v_after then raise exception 'Personal history changed';end if;
 perform set_config('request.jwt.claim.sub',coalesce(v_claim,''),true);
end;
$seed$;
select uin_private.refresh_category_counts();
commit;


