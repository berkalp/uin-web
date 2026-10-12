begin;
set local statement_timeout='10min';
set local lock_timeout='15s';
-- Index both names separately so the duplicate check never scans the place catalogue.
create index if not exists catalogue_duplicate_title_v175_idx on public.seed_catalog_items(public.canonical_normalize_v31(canonical_title)) where status in ('pending','active');
create index if not exists target_duplicate_title_v175_idx on public.canonical_targets(public.canonical_normalize_v31(title));
create or replace function public.find_uin_duplicate_v73(p_title text,p_kind text,p_creator text default '') returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 with candidate_ids as materialized (
 select ci.id from public.seed_catalog_items ci where ci.status in ('pending','active') and public.canonical_normalize_v31(ci.canonical_title)=public.canonical_normalize_v31(p_title)
 union
 select ci.id from public.canonical_targets t join public.seed_catalog_items ci on ci.canonical_target_id=t.id where ci.status in ('pending','active') and public.canonical_normalize_v31(t.title)=public.canonical_normalize_v31(p_title)
 )
 select jsonb_build_object('catalogItemId',ci.id,'canonicalTargetId',ci.canonical_target_id,'status',ci.status)
 from candidate_ids candidate join public.seed_catalog_items ci on ci.id=candidate.id
 left join public.canonical_targets target on target.id=ci.canonical_target_id
 left join public.uin_content_types ct on ct.id=coalesce(ci.metadata->>'content_type_id',target.editorial_metadata->>'content_type_id')
 where coalesce(ct.base_kind,case when ci.item_kind='video' then 'series' else ci.item_kind end)=p_kind
 and (p_kind not in ('movie','series','book','game') or nullif(btrim(p_creator),'') is null or nullif(btrim(ci.creator_name),'') is null or public.canonical_normalize_v31(ci.creator_name)=public.canonical_normalize_v31(p_creator))
 order by (ci.status='active') desc,ci.id limit 1;
$fn$;
revoke all on function public.find_uin_duplicate_v73(text,text,text) from public,anon;
grant execute on function public.find_uin_duplicate_v73(text,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.guard_uin_card_insert_v73() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$ declare k text; begin select base_kind into k from public.uin_content_types where id=new.metadata->>'content_type_id'; k:=coalesce(k,case when new.item_kind='video' then 'series' else new.item_kind end); if new.status='active' and k in ('sport','club') and auth.uid() is not null and not public.is_admin() then raise exception 'Spor ve spor kulübü kartlarını yalnızca admin ekleyebilir.' using errcode='42501'; end if; if tg_op='UPDATE' and public.canonical_normalize_v31(old.canonical_title)=public.canonical_normalize_v31(new.canonical_title) and coalesce((select base_kind from public.uin_content_types where id=old.metadata->>'content_type_id'),case when old.item_kind='video' then 'series' else old.item_kind end)=k and old.status=new.status and (k not in ('movie','series','book','game') or coalesce(old.creator_name,'')=coalesce(new.creator_name,'')) then return new; end if; if new.status in ('active','pending') then perform pg_advisory_xact_lock(hashtextextended(k||':'||public.canonical_normalize_v31(new.canonical_title),0)); if exists( select 1 from public.seed_catalog_items ci left join public.canonical_targets target on target.id=ci.canonical_target_id left join public.uin_content_types ct on ct.id=coalesce(ci.metadata->>'content_type_id',target.editorial_metadata->>'content_type_id') where ci.id<>new.id and (new.canonical_target_id is null or ci.canonical_target_id is distinct from new.canonical_target_id) and ci.status in ('active','pending') and coalesce(ct.base_kind,case when ci.item_kind='video' then 'series' else ci.item_kind end)=k and ci.id in (select id from public.seed_catalog_items where status in ('active','pending') and public.canonical_normalize_v31(canonical_title)=public.canonical_normalize_v31(new.canonical_title) union select item.id from public.canonical_targets named join public.seed_catalog_items item on item.canonical_target_id=named.id where item.status in ('active','pending') and public.canonical_normalize_v31(named.title)=public.canonical_normalize_v31(new.canonical_title)) and ( k not in ('movie','series','book','game') or nullif(btrim(new.creator_name),'') is null or nullif(btrim(ci.creator_name),'') is null or public.canonical_normalize_v31(ci.creator_name)=public.canonical_normalize_v31(new.creator_name) ) ) then raise exception 'Bu UIN kartı zaten var. Mevcut kartı açabilirsin.' using errcode='23505'; end if; end if; return new; end;$function$ ;

-- Only anonymous aggregates are public. Personal records and comments retain their visibility.
create or replace function public.get_uin_card_ratings_v85(p_target_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 with requested as materialized (select distinct id from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)),
 closure as materialized (select requested.id,tree.target_id from requested cross join lateral public.get_uin_card_closure_v143(array[requested.id],true) tree group by requested.id,tree.target_id),
 ranked as materialized (
 select closure.id,s.user_id,ps.rating,row_number() over(partition by closure.id,s.user_id order by s.updated_at desc nulls last,s.id) rn
 from closure join public.seeds s on s.canonical_target_id=closure.target_id
 join public.seed_personal_state_v15 ps on ps.seed_id=s.id and ps.user_id=s.user_id
 where s.status in ('active','completed') and (s.status='completed' or ps.relationship_status='completed') and ps.rating between 1 and 10
 and not exists(select 1 from public.seed_catalog_items ci where ci.id=s.catalog_item_id and ci.status='rejected')
 )
 select jsonb_build_object('target_id',requested.id,'average_rating',round(avg(ranked.rating) filter(where rn=1),1),'rating_count',count(*) filter(where rn=1),'viewer_rating',max(ranked.rating) filter(where rn=1 and ranked.user_id=auth.uid()))
 from requested left join ranked on ranked.id=requested.id group by requested.id;
$fn$;
revoke all on function public.get_uin_card_ratings_v85(uuid[]) from public;
grant execute on function public.get_uin_card_ratings_v85(uuid[]) to anon,authenticated;
-- Friends metrics only consider accepted friends and records visible to the viewer.
create or replace function public.get_uin_friend_card_scores_v175(p_target_ids uuid[]) returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 with friends as materialized(select other_user_id id from public.get_my_friendships() where friendship_status='accepted'),
 requested as materialized(select distinct id from unnest(coalesce(p_target_ids,array[]::uuid[])) input(id)),
 people as materialized(select p.* from public.get_uin_card_people_projection_v143(p_target_ids) p join friends f on f.id=p.user_id where p.relationship_status='completed'),
 ratings as (select people.requested_id,people.user_id,ps.rating,row_number() over(partition by people.requested_id,people.user_id order by s.updated_at desc nulls last,s.id) rn from people join public.seeds s on people.source_kind='seed' and s.id=people.source_id join public.seed_personal_state_v15 ps on ps.seed_id=s.id and ps.user_id=people.user_id where ps.rating between 1 and 10)
 select jsonb_build_object('target_id',requested.id,'done_count',(select count(distinct user_id) from people where requested_id=public.resolve_uin_card_target_v129(requested.id)),'average_rating',round(avg(ratings.rating) filter(where rn=1),1),'rating_count',count(*) filter(where rn=1)) from requested left join ratings on ratings.requested_id=public.resolve_uin_card_target_v129(requested.id) group by requested.id;
$fn$;
revoke all on function public.get_uin_friend_card_scores_v175(uuid[]) from public,anon;
grant execute on function public.get_uin_friend_card_scores_v175(uuid[]) to authenticated;
update public.uin_content_types set ui_labels=coalesce(ui_labels,'{}'::jsonb)||'{"manual_fallback":"true"}'::jsonb where active;
create or replace function public.notify_catalogue_submission_v175() returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
 begin
 if new.status='pending' and new.created_by is not null and not exists(select 1 from public.admin_users where user_id=new.created_by) then
 insert into public.notifications(user_id,actor_user_id,notification_type,entity_type,entity_id,title,body,action_url,source_key)
 select user_id,new.created_by,'catalogue_suggestion_submitted','seed_catalog_item',new.id,'Yeni Kütüphane önerisi',new.canonical_title,'/admin/seed-catalogue?status=pending','uin-catalogue-submission:'||new.id::text from public.admin_users
 on conflict(user_id,source_key) where source_key is not null do nothing;
 end if;return new;end;
$fn$;
drop trigger if exists notify_catalogue_submission_v175 on public.seed_catalog_items;
create trigger notify_catalogue_submission_v175 after insert on public.seed_catalog_items for each row execute function public.notify_catalogue_submission_v175();
revoke all on function public.notify_catalogue_submission_v175() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
