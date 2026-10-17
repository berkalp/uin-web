-- Storage evaluates policies for every bucket. Keep private experience-table
-- lookups behind guarded helpers instead of requiring direct table SELECT.
create or replace function uin_private.can_read_experience_storage_photo(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.experience_media media
    where media.storage_path = p_path
      and media.media_type in ('photo', 'video')
      and media.moderation_status = 'active'
      and public.can_user_view_experience_media(media.id, auth.uid())
  );
$$;

create or replace function uin_private.can_delete_experience_storage_photo(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.experience_media media
    where media.storage_path = p_path
      and (media.uploader_user_id = auth.uid()
        or public.is_experience_manager(media.experience_id, auth.uid()))
  );
$$;

revoke all on function uin_private.can_read_experience_storage_photo(text) from public, anon;
revoke all on function uin_private.can_delete_experience_storage_photo(text) from public, anon;
grant execute on function uin_private.can_read_experience_storage_photo(text) to authenticated;
grant execute on function uin_private.can_delete_experience_storage_photo(text) to authenticated;

alter policy "Visible Experience media can be read" on storage.objects
  using (bucket_id = 'experience-media'
    and uin_private.can_read_experience_storage_photo(name));
alter policy "Experience photo owners and managers can delete" on storage.objects
  using (bucket_id = 'experience-media'
    and uin_private.can_delete_experience_storage_photo(name));
