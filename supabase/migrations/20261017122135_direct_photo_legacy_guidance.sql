-- Older installed clients only render message text. Explain the attachment
-- upgrade without changing stored messages or exposing private image URLs.
create or replace function public.get_direct_conversation_messages(p_conversation_id uuid, p_limit integer default 200)
returns table(message_id uuid,sender_id uuid,sender_full_name text,sender_username text,sender_avatar_url text,body text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,200),500));
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
  if not exists(select 1 from public.direct_conversations c where c.id=p_conversation_id and auth.uid() in(c.user_a_id,c.user_b_id)) then
    raise exception 'Konuşma bulunamadı.' using errcode='P0002';
  end if;
  return query select m.id,m.sender_id,p.full_name,p.username,p.avatar_url,
    case when photo.message_id is null then m.body else
      concat_ws(E'\n\n',nullif(m.body,'📷 Fotoğraf'),
        '📷 Sana bir fotoğraf gönderildi. Görmek için UIN’i son uygulamalar ekranından tamamen kapatıp yeniden aç. Güncellemenin inmesi için kısa süre bekle, ardından uygulamayı bir kez daha kapatıp aç. Fotoğraf bu konuşmada görünecek.')
    end,
    m.created_at
  from (select dm.* from public.direct_messages dm where dm.conversation_id=p_conversation_id
    order by dm.created_at desc,dm.id desc limit v_limit) m
  join public.profiles p on p.id=m.sender_id
  left join public.direct_message_photos photo on photo.message_id=m.id
  order by m.created_at,m.id;
end; $$;

-- Photo-capable clients keep the original caption. The legacy reader still
-- authorizes the conversation and selects its newest chronological window.
create or replace function public.get_direct_conversation_messages_with_photos(p_conversation_id uuid,p_limit integer default 200)
returns table(message_id uuid,sender_id uuid,sender_full_name text,sender_username text,sender_avatar_url text,body text,created_at timestamptz,photo_path text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.' using errcode='42501'; end if;
  return query select m.message_id,m.sender_id,m.sender_full_name,m.sender_username,m.sender_avatar_url,
    original.body,m.created_at,p.storage_path
  from public.get_direct_conversation_messages(p_conversation_id,p_limit) m
  join public.direct_messages original on original.id=m.message_id
  left join public.direct_message_photos p on p.message_id=m.message_id
  order by m.created_at,m.message_id;
end; $$;

revoke all on function public.get_direct_conversation_messages(uuid,integer),public.get_direct_conversation_messages_with_photos(uuid,integer) from public,anon;
grant execute on function public.get_direct_conversation_messages(uuid,integer),public.get_direct_conversation_messages_with_photos(uuid,integer) to authenticated;
