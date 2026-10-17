-- No actual files or messages are delivered: fixtures and webhook requests roll back.
begin;
do $$ declare c record; outsider uuid; path text; begin
  select * into c from uin_private.team_support_conversations limit 1;
  select id into outsider from public.profiles where id not in(c.sender_user_id,c.recipient_user_id) limit 1;
  path:=c.conversation_id||'/'||c.recipient_user_id||'/'||gen_random_uuid()||'.png';
  perform set_config('test.photo_conv',c.conversation_id::text,true);
  perform set_config('test.photo_sender',c.recipient_user_id::text,true);
  perform set_config('test.photo_receiver',c.sender_user_id::text,true);
  perform set_config('test.photo_outsider',outsider::text,true);
  perform set_config('test.photo_path',path,true);
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('direct-message-photos',path,c.recipient_user_id::text,'{"mimetype":"image/png","size":1024}');
end; $$;
set local role authenticated;
do $$ declare c uuid:=current_setting('test.photo_conv')::uuid; path text:=current_setting('test.photo_path'); first_id uuid; again_id uuid; pending text; begin
  perform set_config('request.jwt.claim.sub',current_setting('test.photo_receiver'),true);
  if exists(select 1 from storage.objects where bucket_id='direct-message-photos' and name=path) then raise exception 'Recipient can see unsent upload'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.photo_sender'),true);
  if not uin_private.can_upload_direct_photo(path) then raise exception 'Sender cannot upload'; end if;
  if uin_private.can_upload_direct_photo('invalid/path.jpg') then raise exception 'Invalid path allowed'; end if;
  pending:=c||'/'||auth.uid()||'/'||gen_random_uuid()||'.png';
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('direct-message-photos',pending,auth.uid()::text,'{"mimetype":"image/png","size":1024}');
  if not uin_private.can_delete_pending_direct_photo(pending) then raise exception 'Pending cleanup denied'; end if;
  first_id:=public.send_direct_message_with_photo(c,'',path);
  again_id:=public.send_direct_message_with_photo(c,'',path);
  if first_id<>again_id then raise exception 'Duplicate photo message'; end if;
  begin perform public.send_direct_message_with_photo(c,'changed caption',path); raise exception 'Duplicate photo changed'; exception when raise_exception then
    if sqlerrm not like 'Bu fotoğraf zaten gönderildi%' then raise; end if;
  end;
  if not exists(select 1 from public.get_direct_conversation_messages_with_photos(c) where message_id=first_id and photo_path=path and body='📷 Fotoğraf') then raise exception 'Photo-only message missing'; end if;
  if uin_private.can_delete_pending_direct_photo(path) then raise exception 'Sent photo can be removed'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.photo_receiver'),true);
  if not exists(select 1 from storage.objects where bucket_id='direct-message-photos' and name=path) then raise exception 'Recipient cannot see sent photo'; end if;
  if not exists(select 1 from public.get_direct_conversation_messages_with_photos(c) where message_id=first_id and photo_path=path) then raise exception 'Recipient message missing'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.photo_outsider'),true);
  if exists(select 1 from storage.objects where bucket_id='direct-message-photos' and name=path) then raise exception 'Photo exposed to outsider'; end if;
  if uin_private.can_upload_direct_photo(path) then raise exception 'Outsider upload allowed'; end if;
  begin insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('direct-message-photos',c||'/'||auth.uid()||'/'||gen_random_uuid()||'.png',auth.uid()::text,'{"mimetype":"image/png","size":1024}');
    raise exception 'Outsider storage insert allowed'; exception when insufficient_privilege then null; end;
  begin perform public.send_direct_message_with_photo(c,'',path); raise exception 'Outsider send allowed'; exception when insufficient_privilege then null; end;
  begin perform public.get_direct_conversation_messages_with_photos(c); raise exception 'Outsider read allowed'; exception when sqlstate 'P0002' then null; end;
end; $$;
reset role;
do $$ declare path text:=current_setting('test.photo_path'); bad text; c uuid:=current_setting('test.photo_conv')::uuid; begin
  perform set_config('request.jwt.claim.sub',current_setting('test.photo_sender'),true);
  bad:=c||'/'||auth.uid()||'/'||gen_random_uuid()||'.png';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('direct-message-photos',bad,auth.uid()::text,'{"mimetype":"image/svg+xml","size":1024}');
  begin perform public.send_direct_message_with_photo(c,'caption',bad); raise exception 'SVG accepted'; exception when invalid_parameter_value then null; end;
  update storage.objects set metadata='{"mimetype":"image/png","size":10485761}' where bucket_id='direct-message-photos' and name=bad;
  begin perform public.send_direct_message_with_photo(c,'caption',bad); raise exception 'Oversize accepted'; exception when invalid_parameter_value then null; end;
  update storage.objects set metadata='{"mimetype":"image/png","size":1024}' where bucket_id='direct-message-photos' and name=bad;
  update public.direct_conversation_access set revoked_at=now() where conversation_id=c and user_id=auth.uid();
  begin perform public.send_direct_message_with_photo(c,'caption',bad); raise exception 'Revoked sender accepted'; exception when insufficient_privilege then null; end;
  if (select public from storage.buckets where id='direct-message-photos') then raise exception 'Bucket is public'; end if;
end; $$;
set constraints all immediate;
rollback;
select 'PASS: photo-only messages, repeat-send idempotency, participant-only reads, pending privacy, MIME/size validation, revoked access, sent-file protection; all rolled back' as result;
