-- Restore only exact existing activity identities missing their event option.
with expected(target_id,activity_id) as (values
('c36e96b1-6d90-4dd1-aa13-3a0bd89a3c49'::uuid,'8cc8e6d8-d4e8-4a7d-8a96-2dde9b7bfb17'::uuid),
('e2ce53de-f3d9-41b8-bc1a-ab130170da7e'::uuid,'ae5e47ee-7b88-4fb7-80ba-cd1fe1552a45'::uuid),
('6c0151d9-fd70-4886-80b8-fe353d2a7890'::uuid,'903ab55b-e701-44b0-ae92-50554e4c696a'::uuid),
('2faeaa64-5844-461f-85e4-d109778d2fd0'::uuid,'ed97331d-742d-4ce9-a1ff-5cc2459d0c85'::uuid),
('8e8787b7-fbe2-4fa0-a5ec-1338fe913a9f'::uuid,'7660c370-b9fc-44f1-9993-39ef8c72548d'::uuid),
('d021e9a2-8deb-4004-a36b-9827887e2d7f'::uuid,'f1ef206c-b0a2-4ab8-b68c-24b5fe68bd3b'::uuid),
('25967caa-fdc7-4ca2-ac11-34864d5a6a82'::uuid,'8eed447e-5fe8-4d54-b741-1de46bcf5649'::uuid),
('5a9f28d4-3463-4d0a-b320-a139f67f1e13'::uuid,'4a5dc360-2a10-4d40-9091-14d4ca7d3d56'::uuid),
('c38d8d5e-7ec7-4af7-a06a-fb83b52e7c5c'::uuid,'bab0b326-6467-48fe-85e5-3ae377b58eb0'::uuid),
('562a7fd7-a25a-45da-9965-4141a1d74069'::uuid,'18db5e7b-c230-419e-bc53-51efe3845122'::uuid),
('6c1c3a98-81e6-40a0-beed-c4507833d8c7'::uuid,'f22c61c1-63cf-4710-b87c-a08ae73114c3'::uuid),
('bc44edd9-1d6b-4f93-bef0-438e17c4612c'::uuid,'1f0b5340-79ba-4d79-9188-ca950c24d641'::uuid),
('1e14decc-d965-456d-b4d2-88be5f2546ab'::uuid,'b373b78b-2a01-46b1-98a4-bfaf686bbe5c'::uuid),
('92c76eb9-df02-4444-9b36-3f8c4335a6fe'::uuid,'7165c556-be92-42b2-9772-e2944c3d79b8'::uuid),
('881513d3-3360-4a3f-9021-5537da72cc78'::uuid,'c2384a7e-99d4-436a-9d52-5ce0f467d7b7'::uuid),
('00c99ea3-4af0-4b37-a9ca-358fd26abeb7'::uuid,'ca3df832-5a38-497a-9006-4722506ef189'::uuid),
('1398034c-4c9f-48e9-b810-27d05daed5a0'::uuid,'8c90a97d-69c0-4f58-be07-a7d453301fc9'::uuid),
('7cf70e7d-5b50-43c7-9f62-be6c35e1cb32'::uuid,'37fbd22d-794a-4b5b-8a71-43aa478e85c5'::uuid),
('f6e5fdb3-2b2c-476d-89dd-5b4e94ae1f27'::uuid,'7fc26eea-fd6d-41e1-8537-f71145209d2e'::uuid),
('8f9c98e6-44a2-4dc2-84bc-4c80cb945dfa'::uuid,'c842924a-b9b3-414c-b5bb-3181c3d6298c'::uuid),
('85186b5c-5956-4a5c-b93c-9fc33f686a0b'::uuid,'f283c1f7-0b04-4615-8459-30234a3c9537'::uuid),
('e755649c-6e7c-479a-a254-31d130e3fe38'::uuid,'af197565-ec03-40c3-85ef-f3178fd6e2c0'::uuid),
('150ac01b-9867-4ff6-b64e-327d06fe20dc'::uuid,'f4803f7c-b09e-4dfa-9093-bda3c651f569'::uuid),
('aff81c03-c40b-4c48-9257-c4bdff27a97f'::uuid,'8a2862e7-c176-416f-a75c-6cbbee7eae62'::uuid),
('6f6cc2e3-c606-4da1-beca-b122d08fb126'::uuid,'f1a0483c-8966-4d1b-b2c8-8c6896d39c2d'::uuid),
('626f0c72-6416-45cc-8792-0d651080741e'::uuid,'78cabd1a-2241-4e3b-9aa6-4c719ebc7f3d'::uuid),
('0c15f411-afe9-4638-b579-2500d478060a'::uuid,'91e2272d-a22a-46c0-abbc-fbb68f973b50'::uuid)
)
insert into public.uin_card_activity_options_v106(target_id,activity_id,sort_order)
select e.target_id,e.activity_id,0 from expected e
join public.canonical_targets t on t.id=e.target_id and t.activity_id=e.activity_id
join public.activities a on a.id=e.activity_id and a.is_active
join public.activity_categories c on c.id=a.category_id and c.is_active
where public.uin_target_content_type_id_v115(t.id)='activity'
and not exists(select 1 from public.uin_card_activity_options_v106 x where x.target_id=t.id)
and not exists(select 1 from public.uin_card_activity_category_options_v114 x where x.target_id=t.id)
and not exists(select 1 from public.get_uin_card_activity_options_v114(t.id))
on conflict do nothing
returning target_id,activity_id;
