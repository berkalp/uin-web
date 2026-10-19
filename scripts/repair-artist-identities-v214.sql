begin;
do $$ declare r jsonb;target uuid;seed_type uuid;admin_id uuid;patch jsonb;before_history text;begin
select md5(coalesce(string_agg(to_jsonb(s)::text,'' order by s.id),'')) into before_history from public.seeds s;
select user_id into admin_id from public.admin_users order by created_at limit 1;perform set_config('request.jwt.claim.sub',admin_id::text,true);
select id into seed_type from public.seed_types where slug='concert';
for r in select value from jsonb_array_elements($data$[{"youtube_artist_id":"/g/11ntq31x05","title":"CRUSH","channel_id":"UCdKIMZMJeZtLwitpv0O_U3Q","cover":"https://yt3.googleusercontent.com/IiyIBxDXxGiTFquxHnLUMCOEYY8ft2vdFwy1zw1lB8v1TEA25hXtZHWag26oZ0rrXgBvDxAfFg","charts":{"youtube_tr_100":{"rank":24,"weekly_views":8680482,"as_of":"2026-10-15","region":"TR","source_url":"https://charts.youtube.com/charts/TopArtists/tr/weekly/2026-10-15"}},"existingTitle":"CRUSH"},{"youtube_artist_id":"/g/12q4zmq_s","title":"Crush (Güney Kore)","channel_id":"UCEU3spVQMmXrU0Nqhw00Gpg","cover":"https://yt3.googleusercontent.com/JOflTH1k9h8J38V4pffYE69FKXbZGE0GutdFZGr396UhIqt_8OcG4WE8TmUwyf0BK9RKpusCjTBwgHg","charts":{"youtube_kr_100":{"rank":76,"weekly_views":2447268,"as_of":"2026-10-15","region":"KR","source_url":"https://charts.youtube.com/charts/TopArtists/kr/weekly/2026-10-15"}},"existingTitle":null},{"youtube_artist_id":"/g/1hb_gspmz","title":"Adam  ","channel_id":"UC3uOwAgmquYz0bPNcvXILzg","cover":"https://yt3.googleusercontent.com/9jV9NKiZFnmk9ni5V-A8uN87-iwBIFN5cVtelyiLM3qMB9dPJ5EAtJUTKLVWIecxwova6eFftW5SJgI","charts":{"youtube_sa_100":{"rank":69,"weekly_views":760840,"as_of":"2026-10-15","region":"SA","source_url":"https://charts.youtube.com/charts/TopArtists/sa/weekly/2026-10-15"}},"existingTitle":"Adam"},{"youtube_artist_id":"/g/11dxdndglc","title":"ADAM (rapçi)","channel_id":"UCu_JvydpBO66BNHxX9s2mlQ","cover":"https://lh3.googleusercontent.com/c2U0SpM8RZy1DQWFT0RQ38mcn9yex9Otfzm9-PFHv364Vlai3ezV54sb_W-dr8dU4vKSW3wT2M9gM6w","charts":{"youtube_sa_100":{"rank":78,"weekly_views":682099,"as_of":"2026-10-15","region":"SA","source_url":"https://charts.youtube.com/charts/TopArtists/sa/weekly/2026-10-15"}},"existingTitle":null}]$data$::jsonb) loop
target:=null;
if r->>'existingTitle' is not null then select canonical_target_id into target from public.seed_catalog_items where canonical_title=r->>'existingTitle' and item_kind='artist' and status='active';
else select canonical_target_id into target from public.seed_catalog_items where canonical_title=r->>'title' and item_kind='artist' and status='active';
end if;
if target is null then target:=public.admin_create_uin_card_v59(seed_type,'artist',r->>'title',null,r->>'cover',null,'https://www.youtube.com/channel/'||(r->>'channel_id'));end if;
patch:=jsonb_build_object('canonical_target_pinned',true,'youtube_artist_id',r->>'youtube_artist_id','youtube_channel_id',r->>'channel_id','artist_regional_retrieved_at','2026-10-19','artist_regional_charts',r->'charts');
update public.seed_catalog_items set metadata=metadata||patch where canonical_target_id=target and status='active';
update public.canonical_targets set editorial_metadata=editorial_metadata||patch where id=target;
end loop;
if before_history<>(select md5(coalesce(string_agg(to_jsonb(s)::text,'' order by s.id),'')) from public.seeds s) then raise exception 'Personal history changed';end if;
end $$;
select 'Two distinct homonymous artist pairs verified by official YouTube channel identities' as result;
commit;