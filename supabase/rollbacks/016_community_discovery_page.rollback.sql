begin;

drop function if exists public.search_communities(
  text,
  uuid,
  uuid,
  uuid,
  date,
  date,
  text,
  boolean,
  boolean,
  integer,
  integer
);

do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null then
    delete from public.translation_values
    where translation_key_id in (
      select translation_key.id
      from public.translation_keys translation_key
      where translation_key.namespace = 'community-discovery'
    );

    delete from public.translation_keys
    where namespace = 'community-discovery';
  end if;
end;
$$;

commit;
