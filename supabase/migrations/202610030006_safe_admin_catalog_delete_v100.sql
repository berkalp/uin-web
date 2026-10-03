begin;

create or replace function public.admin_remove_empty_uin_card_v100(
  p_target_id uuid,
  p_catalog_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_linked_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Bu işlem için admin yetkisi gerekir.' using errcode = '42501';
  end if;

  select item.canonical_title into v_title
  from public.seed_catalog_items item
  where item.id = p_catalog_item_id
    and item.canonical_target_id = p_target_id
  for update;

  if v_title is null then
    raise exception 'Kütüphane kaydı bulunamadı.' using errcode = 'P0002';
  end if;

  select
    (select count(*) from public.seeds where catalog_item_id = p_catalog_item_id or canonical_target_id = p_target_id)
    + (select count(*) from public.canonical_personal_intents_v38 where target_id = p_target_id)
    + (select count(*) from public.intents where canonical_target_id = p_target_id)
    + (select count(*) from public.uin_card_notification_preferences_v31 where catalog_item_id = p_catalog_item_id)
    + (select count(*) from public.user_favorite_catalog_items where catalog_item_id = p_catalog_item_id)
    + (select count(*) from public.uin_club_follows where target_id = p_target_id)
  into v_linked_count;

  if v_linked_count > 0 then
    raise exception 'Bu kartta kullanıcı niyeti, deneyimi, etkinliği veya takibi var. Kullanıcı kayıtlarını korumak için kart silinmedi.' using errcode = '23503';
  end if;

  delete from public.seed_catalog_items
  where id = p_catalog_item_id and canonical_target_id = p_target_id;

  return jsonb_build_object('deleted', true, 'catalog_item_id', p_catalog_item_id, 'title', v_title);
end;
$$;

revoke all on function public.admin_remove_empty_uin_card_v100(uuid,uuid) from public, anon;
grant execute on function public.admin_remove_empty_uin_card_v100(uuid,uuid) to authenticated;

commit;
