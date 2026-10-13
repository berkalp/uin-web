begin;
set local statement_timeout='3min';
-- Only public artist catalogue metadata is added; the existing hidden-card
-- check, bounded pagination, function privileges and viewer rules stay intact.
create or replace function public.get_uin_type_placements_v177(p_content_type_id text,p_limit integer default 500,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
 select coalesce(jsonb_agg(to_jsonb(placement)),'[]'::jsonb) from (
 select ci.id,ci.canonical_target_id,ci.item_kind,ci.canonical_title,ci.creator_name,ci.cover_url,
 coalesce(c.editorial_metadata->>'content_type_id',ci.metadata->>'content_type_id',ci.item_kind) content_type_id,
 (select jsonb_agg(m2.content_type_id order by m2.content_type_id) from public.uin_card_content_types_v177 m2 join public.uin_content_types ct on ct.id=m2.content_type_id and ct.active where m2.target_id=m.target_id) content_type_ids,
 ci.metadata->>'imdb_top_250_rank' imdb_top_250_rank,ci.metadata->>'imdb_top_100_rank' imdb_top_100_rank,ci.metadata->>'imdb_rating' imdb_rating,
 ci.metadata->'book_lists' book_lists,ci.metadata->'book_list_ranks' book_list_ranks,ci.metadata->'book_awards' book_awards,
 ci.metadata->'series_lists' series_lists,ci.metadata->'series_list_ranks' series_list_ranks,ci.metadata->'series_awards' series_awards,
 ci.metadata->'spotify_monthly_listeners' spotify_monthly_listeners,ci.metadata->'spotify_listener_rank' spotify_listener_rank,
 ci.metadata->>'spotify_chart_as_of' spotify_chart_as_of,ci.metadata->>'spotify_chart_source' spotify_chart_source,
 ci.metadata->'artist_list_ranks' artist_list_ranks,ci.metadata->>'artist_list_source_url' artist_list_source_url
 from public.uin_card_content_types_v177 m join public.uin_content_types t on t.id=m.content_type_id and t.active
 join public.canonical_targets c on c.id=m.target_id
 join lateral(select item.* from public.seed_catalog_items item where item.canonical_target_id=m.target_id and item.status='active' order by item.updated_at desc,item.id desc limit 1) ci on true
 where m.content_type_id=p_content_type_id and ((select public.is_admin()) or coalesce(c.editorial_metadata->>'admin_hidden','false')<>'true')
 order by ci.updated_at desc,ci.id desc limit least(greatest(coalesce(p_limit,500),1),500) offset greatest(coalesce(p_offset,0),0)
 ) placement;
$fn$;
do $seed$
declare admin_id uuid; seed_type uuid; r jsonb; target uuid; patch jsonb;
previous_claim text:=current_setting('request.jwt.claim.sub',true);
begin
 select user_id into admin_id from public.admin_users order by created_at limit 1;
 if admin_id is null then raise exception 'Artist import requires an administrator';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 select id into seed_type from public.seed_types where slug='concert' and is_active;
 if seed_type is null then raise exception 'Missing concert seed type';end if;
 for r in select value from jsonb_array_elements($data$[{"title": "BLOK3", "spotify_id": "1GMwSpFzrLd12jUX15bHB6", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174d16982f5240c77786c699f13", "ranks": {"tr_wrapped_2025": 1}}, {"title": "Ati242", "spotify_id": "6bGOmNBU1AOgttgOjh0ldf", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174d864c8697c382f575f904ae8", "ranks": {"tr_wrapped_2025": 2}}, {"title": "Semicenk", "spotify_id": "1CcZoULzFHa8Uhwo6OlQcp", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174a9debaf40b203ca6e3f9ac2b", "ranks": {"tr_wrapped_2025": 3}}, {"title": "Era7capone", "spotify_id": "4UW9Hdsrx9kX2HdJ90jRKM", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174ad2f9bccbaebf444948d449c", "ranks": {"tr_wrapped_2025": 4}}, {"title": "Lvbel C5", "spotify_id": "0V2oXYR7DtrZAEFeILRW2r", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517430f7f38de5edf831bfbcda88", "ranks": {"tr_wrapped_2025": 5}}, {"title": "UZI", "spotify_id": "5U05AU34EcZ8pfohg2dicI", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051748d1632495004438557b755ec", "ranks": {"tr_wrapped_2025": 6}}, {"title": "Sezen Aksu", "spotify_id": "64d1rUxfizSAOE9UbMnUZd", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174d32dbe03236eda653b1a2bd0", "ranks": {"tr_wrapped_2025": 7}}, {"title": "Poizi", "spotify_id": "250LLR8V4fFq1XFzAB1ZN5", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab6761610000517423941a65586823889dbe02a3", "ranks": {"tr_wrapped_2025": 8}}, {"title": "Motive", "spotify_id": "38qDM8ydEFYori6yyBCjq8", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174ad2cb962ae2c34bccb57535d", "ranks": {"tr_wrapped_2025": 9}}, {"title": "AKDO", "spotify_id": "17EAWIoXAMU9Vo9xRrdZQ0", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051745da91de22b8e2041105da75d", "ranks": {"tr_wrapped_2025": 10}}, {"title": "Gülşen", "spotify_id": "1F2v33FQTavJyaD7ZsyhdA", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051745b20cf61549600f016239cc4", "ranks": {"tr_wrapped_2025": 11}}, {"title": "Yalın", "spotify_id": "46zuW8tHxwahYn7VNMgYTa", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174cd415320281d1bd3a49bf44b", "ranks": {"tr_wrapped_2025": 12}}, {"title": "Dedublüman", "spotify_id": "5PRW6j58xEEWL4DDVEITKT", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab676161000051746935936bfde4c6997f7d8284", "ranks": {"tr_wrapped_2025": 13, "tr_groups_wrapped_2025": 1}}, {"title": "Hande Yener", "spotify_id": "08mjMUUjyTchMHCW7evc3R", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174a23b36e9e0d77995334e7f93", "ranks": {"tr_wrapped_2025": 14}}, {"title": "Snow", "spotify_id": "3uZFBSsMiooimnprFL9jD1", "cover": "https://i.scdn.co/image/18f1b775c78be981dabe7fa68b932a389dfdc188", "ranks": {"tr_wrapped_2025": 15}}, {"title": "Ebru Gündeş", "spotify_id": "5AboYJAlMb9FGadTTDKRoN", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174089611d35599d38b83d1dcf8", "ranks": {"tr_wrapped_2025": 16}}, {"title": "Ezhel", "spotify_id": "6LnJKrtFnTEGdbWQ2riWCL", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174b27fa31b6424052fe3ed660a", "ranks": {"tr_wrapped_2025": 17}}, {"title": "manifest", "spotify_id": "2WjzL05RyqIk5n53sZc9nf", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174145f766083fc566e994d739a", "ranks": {"tr_wrapped_2025": 18, "tr_groups_wrapped_2025": 2}}, {"title": "Simge", "spotify_id": "4StjyzjcmZ7a9QncHVf0pu", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174fd2cb7719539190ff0da90af", "ranks": {"tr_wrapped_2025": 19}}, {"title": "Sertab Erener", "spotify_id": "4W31XN2JH8mC54NkHdh04s", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab6761610000517491e594fe89266f608a5876f3", "ranks": {"tr_wrapped_2025": 20}}, {"title": "Duman", "spotify_id": "6RTC1abMgBC7Krg6qJQHJh", "cover": "https://image-cdn-ak.spotifycdn.com/image/ab676161000051745eedfda3da66eb4591be4fa7", "ranks": {"tr_groups_wrapped_2025": 3}}, {"title": "Dolu Kadehi Ters Tut", "spotify_id": "0PhqM7UAxtvWYi5j4MwxSl", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051747e6b6acd16941485ede2b690", "ranks": {"tr_groups_wrapped_2025": 4}}, {"title": "Yüzyüzeyken Konuşuruz", "spotify_id": "7gobcoscOfsY0nOeqqFzvU", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174245d6eec4e995c39cc7c482d", "ranks": {"tr_groups_wrapped_2025": 5}}, {"title": "mor ve ötesi", "spotify_id": "5ixQSDvAMa5O758xG8MWXT", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab6761610000517432c198a198e8efe489b8948a", "ranks": {"tr_groups_wrapped_2025": 6}}, {"title": "Adamlar", "spotify_id": "1g4J8P1JWwanNyyXckRX5W", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174255fc5aa8ee8170cff4ab47e", "ranks": {"tr_groups_wrapped_2025": 7}}, {"title": "Mavi Gri", "spotify_id": "4otJVkrLLqDF8OxFJOigme", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051741861ed0dc2cc3a26c47c32c8", "ranks": {"tr_groups_wrapped_2025": 8}}, {"title": "Seksendört", "spotify_id": "7IgzsWd4tWIn70uh6dAq8d", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174d279ec4183a9fb35a07b5b84", "ranks": {"tr_groups_wrapped_2025": 9}}, {"title": "Pinhani", "spotify_id": "4Bdqzh78prwuqwInMb555P", "cover": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051744ddd595c78914a1e09ff6688", "ranks": {"tr_groups_wrapped_2025": 10}}]$data$::jsonb) loop
  target:=null;
  select ci.canonical_target_id into target from public.seed_catalog_items ci
   where ci.item_kind='artist' and ci.status='active' and
   (ci.metadata->>'spotify_id'=r->>'spotify_id' or ci.external_source='spotify' and ci.external_id=r->>'spotify_id'
    or ci.normalized_title=public.normalize_seed_catalog_text(r->>'title'))
   order by (ci.metadata->>'spotify_id'=r->>'spotify_id') desc nulls last,ci.created_at limit 1;
  if target is null then
   target:=public.admin_create_uin_card_v59(seed_type,'artist',r->>'title',null,r->>'cover',null,'https://open.spotify.com/artist/'||(r->>'spotify_id'));
  end if;
  patch:=jsonb_build_object('spotify_id',r->>'spotify_id','artist_list_ranks',r->'ranks','artist_list_source_url','https://www.rapertuar.com/turkce-rap/spotify-wrapped-aciklandi-2025in-en-cok-dinlenenleri-ortaya-cikti/','artist_list_period','2025','artist_list_retrieved_at','2026-10-13');
  update public.seed_catalog_items ci set metadata=coalesce(ci.metadata,'{}'::jsonb)||patch,
   external_source=coalesce(ci.external_source,'spotify'),external_id=coalesce(ci.external_id,r->>'spotify_id'),
   cover_url=coalesce(nullif(ci.cover_url,''),r->>'cover'),updated_at=now()
   where ci.canonical_target_id=target and ci.item_kind='artist' and ci.status='active';
  update public.canonical_targets set editorial_metadata=coalesce(editorial_metadata,'{}'::jsonb)||patch where id=target;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(previous_claim,''),true);
end;$seed$;
notify pgrst,'reload schema';
commit;
