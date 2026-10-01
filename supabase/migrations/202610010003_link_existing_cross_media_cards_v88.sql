begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
set local search_path=public,extensions;

-- Kullanıcının işaret ettiği mevcut film ve kitap ayrı kartlardır. Filmden kaynak
-- esere tek yönlü bağ kurulur; okuma/izleme davranışları birbirine karışmaz.
insert into public.uin_card_relations_v87(source_target_id,related_target_id,relation_type,sort_order,section_title)
select movie.id,book.id,'source_material',0,'Kaynak eser'
from lateral(
  select id from public.canonical_targets
  where id='b09c79c3-ef99-4cdb-ac3e-7b509884c263'::uuid
) movie
cross join lateral(
  select id from public.canonical_targets
  where id='3b408a6c-08c0-482e-8299-8fa2d83a029c'::uuid
) book
on conflict(source_target_id,related_target_id,relation_type) do update
set section_title=excluded.section_title,updated_at=now();

notify pgrst,'reload schema';
commit;
