create table if not exists uin_private.category_count_cache (
 admin_view boolean primary key, counts jsonb not null, refreshed_at timestamptz not null default now()
);
alter table uin_private.category_count_cache enable row level security;
revoke all on uin_private.category_count_cache from public,anon,authenticated;
create table if not exists uin_private.category_count_revision (
 id boolean primary key default true check(id), revision bigint not null default 1, refreshed_revision bigint not null default 0
);
alter table uin_private.category_count_revision enable row level security;
revoke all on uin_private.category_count_revision from public,anon,authenticated;
insert into uin_private.category_count_revision(id) values(true) on conflict do nothing;
create or replace function uin_private.compute_category_counts(p_admin boolean) returns jsonb
language sql stable security definer set search_path=public,pg_temp set jit=off as $fn$
with viewer as materialized(select p_admin is_admin), eligible as materialized (
 select distinct ci.canonical_target_id from public.seed_catalog_items ci cross join viewer
 where ci.status='active' and ci.canonical_target_id is not null and coalesce(ci.metadata->>'global_place_catalogue','false')<>'true'
 and (viewer.is_admin or not exists(select 1 from public.canonical_targets c where c.id=ci.canonical_target_id and coalesce(c.editorial_metadata->>'admin_hidden','false')='true'))
 ), counts as materialized (
 select m.content_type_id,count(*) n from eligible e
 join public.uin_card_content_types_v177 m on m.target_id=e.canonical_target_id
 group by m.content_type_id
 ), places as materialized(select coalesce((public.get_global_place_counts_v122()->>'cities')::bigint,0) n),
 total as materialized(select count(*) n from eligible e where not exists(
 select 1 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.base_kind='place' where m.target_id=e.canonical_target_id))
 select coalesce(jsonb_object_agg(t.id,case when t.base_kind='place' then places.n else coalesce(counts.n,0) end),'{}'::jsonb)
 ||jsonb_build_object('_total',total.n+places.n)
 from public.uin_content_types t cross join places cross join total left join counts on counts.content_type_id=t.id where t.active group by places.n,total.n
$fn$;
revoke all on function uin_private.compute_category_counts(boolean) from public,anon,authenticated;
create or replace function uin_private.mark_category_counts_dirty() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin update uin_private.category_count_revision set revision=revision+1 where id; return null; end;
$fn$;
revoke all on function uin_private.mark_category_counts_dirty() from public,anon,authenticated;
create or replace function uin_private.refresh_category_counts() returns void
language plpgsql security definer set search_path=public,pg_temp set jit=off as $fn$
declare v_revision bigint;
begin
 if not pg_try_advisory_xact_lock(hashtext('uin-category-count-refresh')) then return; end if;
 select revision into v_revision from uin_private.category_count_revision where id and revision<>refreshed_revision;
 if v_revision is null then return; end if;
 insert into uin_private.category_count_cache(admin_view,counts,refreshed_at)
 select flag,uin_private.compute_category_counts(flag),now() from unnest(array[false,true]) flag
 on conflict(admin_view) do update set counts=excluded.counts,refreshed_at=excluded.refreshed_at;
 update uin_private.category_count_revision set refreshed_revision=v_revision where id;
end;
$fn$;
revoke all on function uin_private.refresh_category_counts() from public,anon,authenticated;

drop trigger if exists uin_category_counts_dirty on public.seed_catalog_items;
create trigger uin_category_counts_dirty after insert or update or delete or truncate on public.seed_catalog_items for each statement execute function uin_private.mark_category_counts_dirty();

drop trigger if exists uin_category_counts_dirty on public.canonical_targets;
create trigger uin_category_counts_dirty after insert or update or delete or truncate on public.canonical_targets for each statement execute function uin_private.mark_category_counts_dirty();

drop trigger if exists uin_category_counts_dirty on public.uin_card_content_types_v177;
create trigger uin_category_counts_dirty after insert or update or delete or truncate on public.uin_card_content_types_v177 for each statement execute function uin_private.mark_category_counts_dirty();

drop trigger if exists uin_category_counts_dirty on public.uin_content_types;
create trigger uin_category_counts_dirty after insert or update or delete or truncate on public.uin_content_types for each statement execute function uin_private.mark_category_counts_dirty();

select uin_private.refresh_category_counts();
create or replace function public.get_uin_category_counts_v129() returns jsonb
language sql stable security definer set search_path=public,pg_temp set jit=off as $fn$
select counts from uin_private.category_count_cache where admin_view=public.is_admin();
$fn$;
select cron.schedule('uin-refresh-category-counts','* * * * *','select uin_private.refresh_category_counts();');

drop trigger if exists uin_category_counts_dirty on public.uin_global_place_kind_stats_v122;
create trigger uin_category_counts_dirty after insert or update or delete or truncate on public.uin_global_place_kind_stats_v122 for each statement execute function uin_private.mark_category_counts_dirty();
