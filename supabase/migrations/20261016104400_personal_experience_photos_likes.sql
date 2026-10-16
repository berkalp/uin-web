-- Personal experiences only. The separate private group gallery is untouched.
create table public.seed_experience_photos (
  seed_id uuid not null references public.seeds(id) on delete cascade,
  path text primary key,
  position integer not null check (position between 0 and 5),
  visibility text not null default 'everyone' check(visibility in ('everyone','friends','only_me')),
  created_at timestamptz not null default now(),
  unique(seed_id,position)
);
create table public.seed_experience_likes (
  seed_id uuid not null references public.seeds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(seed_id,user_id)
);
create index seed_experience_likes_user_idx on public.seed_experience_likes(user_id);
alter table public.seed_experience_photos enable row level security;
alter table public.seed_experience_likes enable row level security;
revoke all on public.seed_experience_photos,public.seed_experience_likes from anon,authenticated;

-- A rating/photo-only completed experience is valid too. Preserve the existing
-- note visibility gate when a reflection exists; never publish a private note.
create or replace function public.seed_experience_is_visible_to_viewer(p_seed_id uuid,p_viewer_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_viewer_user_id is not distinct from auth.uid() and exists (
   select 1 from public.seeds s where s.id=p_seed_id and s.status='completed'
   and public.seed_is_visible_to_viewer(s.user_id,s.visibility,p_viewer_user_id)
   and (not exists(select 1 from public.seed_journal_entries j where j.seed_id=s.id and j.entry_kind='reflection')
     or exists(select 1 from public.seed_journal_entries j where j.seed_id=s.id and j.entry_kind='reflection'
       and public.seed_is_visible_to_viewer(s.user_id,j.visibility,p_viewer_user_id)))
 );
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('personal-experience-photos','personal-experience-photos',false,8388608,
 array['image/jpeg','image/png','image/webp','image/heic','image/heif']);

create function public.can_read_personal_experience_photo(p_path text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.seed_experience_photos p join public.seeds s on s.id=p.seed_id where p.path=p_path
   and public.seed_experience_is_visible_to_viewer(p.seed_id,auth.uid())
   and public.seed_is_visible_to_viewer(s.user_id,p.visibility,auth.uid()));
$$;
revoke all on function public.can_read_personal_experience_photo(text) from public;
grant execute on function public.can_read_personal_experience_photo(text) to anon,authenticated;
create policy personal_experience_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='personal-experience-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy personal_experience_photo_select on storage.objects for select to anon,authenticated
using(bucket_id='personal-experience-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text
 or public.can_read_personal_experience_photo(name)));
create policy personal_experience_photo_delete on storage.objects for delete to authenticated
using(bucket_id='personal-experience-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);

create function public.save_my_experience_photos(p_seed_id uuid,p_paths text[],p_expected_paths text[],p_visibility text default 'everyone')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare current_paths text[];
begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
 perform 1 from public.seeds where id=p_seed_id and user_id=auth.uid() and status='completed' for update;
 if not found then raise exception 'Deneyim bulunamadı.' using errcode='42501'; end if;
 select coalesce(array_agg(path order by position),'{}') into current_paths from public.seed_experience_photos where seed_id=p_seed_id;
 if p_visibility is null or p_visibility not in ('everyone','friends','only_me') then raise exception 'Geçersiz görünürlük.' using errcode='22023'; end if;
 if current_paths=coalesce(p_paths,'{}') and not exists(select 1 from public.seed_experience_photos where seed_id=p_seed_id and visibility<>p_visibility) then return; end if;
 if current_paths is distinct from coalesce(p_expected_paths,'{}') then
   raise exception 'Fotoğraflar başka bir ekranda değişti. Ekranı yeniden açıp tekrar dene.' using errcode='40001';
 end if;
 if cardinality(p_paths)>6 or exists(select 1 from unnest(p_paths) path where path is null
   or path not like auth.uid()::text||'/'||p_seed_id::text||'/%'
   or not exists(select 1 from storage.objects o where o.bucket_id='personal-experience-photos' and o.name=path))
   or cardinality(p_paths)<>(select count(distinct path) from unnest(p_paths) path) then
   raise exception 'En fazla 6 geçerli fotoğraf ekleyebilirsin.' using errcode='22023';
 end if;
 delete from public.seed_experience_photos where seed_id=p_seed_id;
 insert into public.seed_experience_photos(seed_id,path,position,visibility)
 select p_seed_id,path,ordinality-1,p_visibility from unnest(p_paths) with ordinality as p(path,ordinality);
 update public.seeds set updated_at=now() where id=p_seed_id;
end;
$$;
revoke all on function public.save_my_experience_photos(uuid,text[],text[],text) from public;
grant execute on function public.save_my_experience_photos(uuid,text[],text[],text) to authenticated;

create function public.set_my_experience_like(p_seed_id uuid,p_liked boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.seed_experience_is_visible_to_viewer(p_seed_id,auth.uid()) then
   raise exception 'Bu deneyime erişilemiyor.' using errcode='42501';
 end if;
 if p_liked then
   insert into public.seed_experience_likes(seed_id,user_id) values(p_seed_id,auth.uid()) on conflict do nothing;
 else delete from public.seed_experience_likes where seed_id=p_seed_id and user_id=auth.uid(); end if;
end;
$$;
revoke all on function public.set_my_experience_like(uuid,boolean) from public;
grant execute on function public.set_my_experience_like(uuid,boolean) to authenticated;

create function public.get_personal_experience_extras(p_seed_ids uuid[])
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('seedId',s.id,'updatedAt',greatest(s.updated_at,ps.updated_at,j.updated_at),
   'photos',coalesce((select jsonb_agg(jsonb_build_object('path',path) order by position) from public.seed_experience_photos where seed_id=s.id and public.seed_is_visible_to_viewer(s.user_id,visibility,auth.uid())),'[]'),
   'likeCount',(select count(*) from public.seed_experience_likes where seed_id=s.id),
   'viewerLiked',exists(select 1 from public.seed_experience_likes where seed_id=s.id and user_id=auth.uid()),
   'commentCount',(select count(*) from public.seed_experience_comments where seed_id=s.id and deleted_at is null),
   'canComment',public.can_comment_on_seed_experience(s.id,auth.uid()))
 from public.seeds s left join public.seed_personal_state_v15 ps on ps.seed_id=s.id
 left join lateral(select max(updated_at) updated_at from public.seed_journal_entries where seed_id=s.id and entry_kind='reflection') j on true
 where s.id=any(p_seed_ids[1:100]) and (s.user_id=auth.uid() or public.seed_experience_is_visible_to_viewer(s.id,auth.uid()));
$$;
revoke all on function public.get_personal_experience_extras(uuid[]) from public;
grant execute on function public.get_personal_experience_extras(uuid[]) to anon,authenticated;
