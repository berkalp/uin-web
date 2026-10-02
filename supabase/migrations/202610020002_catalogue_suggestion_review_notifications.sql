begin;

create or replace function public.notify_catalogue_suggestion_review_v94()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_id uuid;
  v_title text;
  v_body text;
begin
  if old.status is not distinct from new.status
     or new.status not in ('active', 'rejected', 'merged')
     or new.created_by is null
     or coalesce(new.metadata->>'submission', '') = 'admin' then
    return new;
  end if;

  if new.status = 'merged' and new.merged_into_id is not null then
    select item.canonical_target_id
      into v_target_id
      from public.seed_catalog_items item
     where item.id = new.merged_into_id;
  else
    v_target_id := new.canonical_target_id;
  end if;

  if new.status = 'active' then
    v_title := '“' || new.canonical_title || '” kaydın onaylandı';
    v_body := 'UIN yönetimi kaydını kontrol etti ve Kütüphanede yayınladı.';
  elsif new.status = 'merged' then
    v_title := '“' || new.canonical_title || '” kaydın mevcut kartla birleştirildi';
    v_body := 'UIN yönetimi aynı içeriğe ait mevcut kartı buldu. Kaydın o kartla birleştirildi.';
  else
    v_title := '“' || new.canonical_title || '” kaydın yayınlanmadı';
    v_body := 'UIN yönetimi kaydını kontrol etti ancak Kütüphanede yayınlamadı.';
  end if;

  insert into public.notifications(
    user_id,
    actor_user_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body,
    action_url,
    source_key
  ) values (
    new.created_by,
    new.reviewed_by,
    'catalogue_suggestion_reviewed',
    'seed_catalog_item',
    new.id,
    v_title,
    v_body,
    case
      when v_target_id is not null then '/ideas?targetId=' || v_target_id::text
      else '/notifications'
    end,
    'uin-catalogue-review:' || new.id::text || ':' || new.status
  )
  on conflict (user_id, source_key) where source_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists notify_catalogue_suggestion_review_v94 on public.seed_catalog_items;
create trigger notify_catalogue_suggestion_review_v94
after update of status on public.seed_catalog_items
for each row
execute function public.notify_catalogue_suggestion_review_v94();

revoke all on function public.notify_catalogue_suggestion_review_v94() from public, anon, authenticated;

commit;
