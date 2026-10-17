insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('direct-message-photos','direct-message-photos',false,10485760,array['image/jpeg','image/png','image/webp']);

create table public.direct_message_photos (
  message_id uuid primary key references public.direct_messages(id) on delete cascade,
  storage_path text not null unique,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check(byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index direct_message_photo_uploader_idx on public.direct_message_photos(uploader_id);
alter table public.direct_message_photos enable row level security;
revoke all on public.direct_message_photos from public,anon,authenticated;

create function uin_private.can_upload_direct_photo(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_parts text[]:=string_to_array(p_path,'/'); v_conversation uuid;
begin
  if auth.uid() is null or array_length(v_parts,1)<>3 or v_parts[2]<>auth.uid()::text
    or v_parts[1]!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v_parts[3]!~*'^[0-9a-f-]{36}\.(jpg|png|webp)$' then return false; end if;
  v_conversation:=v_parts[1]::uuid;
  return exists(select 1 from public.direct_conversations where id=v_conversation and auth.uid() in (user_a_id,user_b_id))
    and public.direct_conversation_user_can_send(v_conversation,auth.uid());
end; $$;
create function uin_private.can_read_direct_photo(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    split_part(p_path,'/',2)=auth.uid()::text
    or exists(select 1 from public.direct_message_photos photo
      join public.direct_messages m on m.id=photo.message_id
      join public.direct_conversations c on c.id=m.conversation_id
      where photo.storage_path=p_path and auth.uid() in (c.user_a_id,c.user_b_id))
  );
$$;
create function uin_private.can_delete_pending_direct_photo(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and split_part(p_path,'/',2)=auth.uid()::text
    and not exists(select 1 from public.direct_message_photos where storage_path=p_path);
$$;
revoke all on function uin_private.can_upload_direct_photo(text),uin_private.can_read_direct_photo(text),uin_private.can_delete_pending_direct_photo(text) from public,anon;
grant usage on schema uin_private to authenticated;
grant execute on function uin_private.can_upload_direct_photo(text),uin_private.can_read_direct_photo(text),uin_private.can_delete_pending_direct_photo(text) to authenticated;
create policy direct_photo_insert on storage.objects for insert to authenticated
  with check(bucket_id='direct-message-photos' and uin_private.can_upload_direct_photo(name));
create policy direct_photo_select on storage.objects for select to authenticated
  using(bucket_id='direct-message-photos' and uin_private.can_read_direct_photo(name));
create policy direct_photo_delete_pending on storage.objects for delete to authenticated
  using(bucket_id='direct-message-photos' and uin_private.can_delete_pending_direct_photo(name));

create function public.send_direct_message_with_photo(p_conversation_id uuid,p_body text,p_storage_path text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_body text:=btrim(coalesce(p_body,''));
  v_metadata jsonb; v_mime text; v_size bigint; v_existing_body text;
begin
  if v_actor is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
  if char_length(v_body)>5000 then raise exception 'Mesaj en fazla 5000 karakter olabilir.' using errcode='22023'; end if;
  if not exists(select 1 from public.direct_conversations where id=p_conversation_id and v_actor in (user_a_id,user_b_id)) then
    raise exception 'Konuşma bulunamadı.' using errcode='42501'; end if;
  if p_storage_path is null or split_part(p_storage_path,'/',1)<>p_conversation_id::text or split_part(p_storage_path,'/',2)<>v_actor::text then
    raise exception 'Fotoğraf bu konuşmaya ait değil.' using errcode='42501'; end if;
  if v_body='' then v_body:='📷 Fotoğraf'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_storage_path,9137));
  select m.id,m.body into v_id,v_existing_body from public.direct_message_photos p
    join public.direct_messages m on m.id=p.message_id where p.storage_path=p_storage_path and m.sender_id=v_actor and m.conversation_id=p_conversation_id;
  if found then
    if v_body<>v_existing_body then raise exception 'Bu fotoğraf zaten gönderildi. Yeni yazını fotoğrafı kaldırıp gönderebilirsin.'; end if;
    return v_id;
  end if;
  if not uin_private.can_upload_direct_photo(p_storage_path) then raise exception 'Bu konuşmada gönderim iznin yok.' using errcode='42501'; end if;
  select metadata into v_metadata from storage.objects where bucket_id='direct-message-photos' and name=p_storage_path and owner_id=v_actor::text for share;
  if not found then raise exception 'Fotoğraf yüklenemedi. Yeniden dene.' using errcode='22023'; end if;
  v_mime:=v_metadata->>'mimetype';
  v_size:=(v_metadata->>'size')::bigint;
  if v_mime is null or v_mime not in ('image/jpeg','image/png','image/webp') or v_size is null or v_size not between 1 and 10485760 then
    raise exception 'JPEG, PNG veya WebP seç; fotoğraf en fazla 10 MB olabilir.' using errcode='22023'; end if;
  v_id:=public.send_direct_message(p_conversation_id,v_body);
  insert into public.direct_message_photos(message_id,storage_path,uploader_id,mime_type,byte_size)
    values(v_id,p_storage_path,v_actor,v_mime,v_size);
  return v_id;
end; $$;
revoke all on function public.send_direct_message_with_photo(uuid,text,text) from public,anon;
grant execute on function public.send_direct_message_with_photo(uuid,text,text) to authenticated;

-- Keep the original RPC contract for clients that have not updated yet.
create function public.get_direct_conversation_messages_with_photos(p_conversation_id uuid,p_limit integer default 200)
returns table(message_id uuid,sender_id uuid,sender_full_name text,sender_username text,sender_avatar_url text,body text,created_at timestamptz,photo_path text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
  return query select m.*,p.storage_path from public.get_direct_conversation_messages(p_conversation_id,p_limit) m
    left join public.direct_message_photos p on p.message_id=m.message_id order by m.created_at,m.message_id;
end; $$;
revoke all on function public.get_direct_conversation_messages_with_photos(uuid,integer) from public,anon;
grant execute on function public.get_direct_conversation_messages_with_photos(uuid,integer) to authenticated;
