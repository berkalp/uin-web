begin;
create or replace function public.admin_save_uin_content_type_v58(p_id text,p_label text,p_icon text,p_base_kind text,p_active boolean default true,p_ui_labels jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; cleaned jsonb:='{}'::jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin yetkisi gerekir.' using errcode='42501'; end if;
 if jsonb_typeof(p_ui_labels) is distinct from 'object' then raise exception 'Kart ayarları geçersiz.'; end if;
 for item in select key,value from jsonb_each(p_ui_labels) loop
  if item.key not in ('want','done','wanting','doers','event','action','question','search_provider','search_entity','manual_fallback') or jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>120 then raise exception 'Kart ayarları geçersiz veya çok uzun.'; end if;
  if item.key='search_provider' and (item.value#>>'{}') not in ('auto','wikidata','google_books','spotify','tvmaze','igdb','manual') then raise exception 'Arama kaynağı geçersiz.'; end if;
  if item.key='manual_fallback' and (item.value#>>'{}') not in ('true','false') then raise exception 'Öneri ayarı geçersiz.'; end if;
  if nullif(btrim(item.value#>>'{}'),'') is not null then cleaned:=cleaned||jsonb_build_object(item.key,btrim(item.value#>>'{}'));end if;
 end loop;
 perform public.admin_save_uin_content_type_v55(p_id,p_label,p_icon,p_base_kind,p_active);
 update public.uin_content_types set ui_labels=cleaned where id=p_id;
end;$$;
revoke all on function public.admin_save_uin_content_type_v58(text,text,text,text,boolean,jsonb) from public,anon;
grant execute on function public.admin_save_uin_content_type_v58(text,text,text,text,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
