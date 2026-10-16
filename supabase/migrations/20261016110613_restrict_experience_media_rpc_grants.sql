-- Override project default function grants: writes require an authenticated user.
revoke all on function public.save_my_experience_photos(uuid,text[],text[],text) from public,anon,authenticated;
grant execute on function public.save_my_experience_photos(uuid,text[],text[],text) to authenticated;
revoke all on function public.set_my_experience_like(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_my_experience_like(uuid,boolean) to authenticated;
-- Read RPCs deliberately support public experiences and still check visibility.
revoke all on function public.get_personal_experience_extras(uuid[]) from public,anon,authenticated;
grant execute on function public.get_personal_experience_extras(uuid[]) to anon,authenticated;
revoke all on function public.can_read_personal_experience_photo(text) from public,anon,authenticated;
grant execute on function public.can_read_personal_experience_photo(text) to anon,authenticated;
-- All data access is through the checked RPCs; direct table access is denied.
create policy experience_photos_rpc_only on public.seed_experience_photos for all to anon,authenticated using(false) with check(false);
create policy experience_likes_rpc_only on public.seed_experience_likes for all to anon,authenticated using(false) with check(false);
