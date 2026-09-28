begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local search_path=public,extensions;

alter table public.seed_journal_entries add column if not exists comments_enabled boolean not null default false;

create table if not exists public.seed_journal_comments(
 id uuid primary key default gen_random_uuid(),
 journal_entry_id uuid not null references public.seed_journal_entries(id) on delete cascade,
 seed_id uuid not null references public.seeds(id) on delete cascade,
 author_user_id uuid not null,
 body text not null check(char_length(trim(body)) between 1 and 1200),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists seed_journal_comments_entry_idx on public.seed_journal_comments(journal_entry_id,created_at);
alter table public.seed_journal_comments enable row level security;
revoke all on table public.seed_journal_comments from public,anon,authenticated;

create or replace function public.get_seed_journal_comment_context_v36(p_entry_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare v_user uuid:=auth.uid();v_owner uuid;v_seed uuid;v_visibility text;v_enabled boolean;v_friend boolean:=false;v_allowed boolean:=false;v_comments jsonb:='[]'::jsonb;
begin
 select s.user_id,j.seed_id,coalesce(j.visibility,'only_me'),coalesce(j.comments_enabled,false) into v_owner,v_seed,v_visibility,v_enabled
 from public.seed_journal_entries j join public.seeds s on s.id=j.seed_id where j.id=p_entry_id;
 if not found then raise exception 'Günlük kaydı bulunamadı.';end if;
 if v_user is not null and v_user<>v_owner then
  select exists(select 1 from public.get_my_friendships() f where to_jsonb(f)->>'other_user_id'=v_owner::text and to_jsonb(f)->>'friendship_status'='accepted') into v_friend;
 end if;
 v_allowed:=v_user=v_owner or v_visibility='everyone' or (v_visibility='friends' and v_friend);
 if not v_allowed then raise exception 'Bu günlük kaydını görme yetkin yok.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'author_user_id',c.author_user_id,'body',c.body,'created_at',c.created_at,'full_name',p.full_name,'username',p.username,'avatar_url',p.avatar_url) order by c.created_at),'[]'::jsonb) into v_comments
 from public.seed_journal_comments c left join public.profiles p on p.id=c.author_user_id where c.journal_entry_id=p_entry_id;
 return jsonb_build_object('enabled',v_enabled,'is_owner',v_user=v_owner,'can_comment',v_user is not null and v_enabled and v_allowed,'comments',v_comments);
end $$;

create or replace function public.set_my_seed_journal_comments_v36(p_entry_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
 update public.seed_journal_entries j set comments_enabled=coalesce(p_enabled,false)
 from public.seeds s where j.id=p_entry_id and s.id=j.seed_id and s.user_id=auth.uid();
 if not found then raise exception 'Günlük kaydını düzenleme yetkin yok.';end if;
end $$;

create or replace function public.add_seed_journal_comment_v36(p_entry_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare v_user uuid:=auth.uid();v_owner uuid;v_seed uuid;v_visibility text;v_enabled boolean;v_friend boolean:=false;v_id uuid;v_name text;
begin
 if v_user is null then raise exception 'Yorum yapmak için oturum gerekli.';end if;
 if nullif(trim(p_body),'') is null then raise exception 'Yorum boş olamaz.';end if;
 select s.user_id,j.seed_id,coalesce(j.visibility,'only_me'),coalesce(j.comments_enabled,false) into v_owner,v_seed,v_visibility,v_enabled
 from public.seed_journal_entries j join public.seeds s on s.id=j.seed_id where j.id=p_entry_id;
 if not found or not v_enabled then raise exception 'Bu günlük kaydı yorumlara kapalı.';end if;
 if v_user<>v_owner and v_visibility='friends' then
  select exists(select 1 from public.get_my_friendships() f where to_jsonb(f)->>'other_user_id'=v_owner::text and to_jsonb(f)->>'friendship_status'='accepted') into v_friend;
 end if;
 if v_user<>v_owner and not (v_visibility='everyone' or (v_visibility='friends' and v_friend)) then raise exception 'Bu günlük kaydına yorum yapamazsın.';end if;
 insert into public.seed_journal_comments(journal_entry_id,seed_id,author_user_id,body) values(p_entry_id,v_seed,v_user,left(trim(p_body),1200)) returning id into v_id;
 if v_user<>v_owner then
  select coalesce(nullif(trim(full_name),''),nullif(trim(username),''),'Bir UIN üyesi') into v_name from public.profiles where id=v_user;
  insert into public.notifications(user_id,notification_type,entity_type,entity_id,title,body,action_url)
  values(v_owner,'seed_journal_comment','seed_journal_entry',p_entry_id,coalesce(v_name,'Bir UIN üyesi')||' günlüğüne yorum yaptı',left(trim(p_body),180),'/seed/'||v_seed::text||'?journal='||p_entry_id::text);
 end if;
 return v_id;
end $$;

create or replace function public.delete_my_seed_journal_comment_v36(p_comment_id uuid)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
 delete from public.seed_journal_comments where id=p_comment_id and author_user_id=auth.uid();
 if not found then raise exception 'Yorum bulunamadı.';end if;
end $$;

revoke all on function public.get_seed_journal_comment_context_v36(uuid),public.set_my_seed_journal_comments_v36(uuid,boolean),public.add_seed_journal_comment_v36(uuid,text),public.delete_my_seed_journal_comment_v36(uuid) from public,anon;
grant execute on function public.get_seed_journal_comment_context_v36(uuid),public.set_my_seed_journal_comments_v36(uuid,boolean),public.add_seed_journal_comment_v36(uuid,text),public.delete_my_seed_journal_comment_v36(uuid) to authenticated;
commit;
