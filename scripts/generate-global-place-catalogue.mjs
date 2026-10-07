import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const cacheDir = path.join(root, '.cache', 'geonames');
const output = path.join(root, 'supabase', 'generated', '20261007100000_global_places_v122.sql');
const countryText = await readFile(path.join(cacheDir, 'countryInfo.txt'), 'utf8');
const cityText = await readFile(path.join(cacheDir, 'cities5000.txt'), 'utf8');
const trNames = new Intl.DisplayNames(['tr'], { type: 'region' });

const countries = countryText.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const fields = line.split('\t');
  const code = fields[0];
  return {
    external_id: `country:${code}`,
    title: trNames.of(code) || fields[4],
    subtitle: 'Ülke',
    kind: 'country',
    country_code: code,
    country: trNames.of(code) || fields[4],
    geonames_id: fields[16],
    latitude: null,
    longitude: null,
    population: Number(fields[7]) || 0,
    feature_code: 'PCLI',
  };
});
const countryByCode = new Map(countries.map(country => [country.country_code, country]));
const cities = cityText.split(/\r?\n/).filter(Boolean).map(line => {
  const fields = line.split('\t');
  const country = countryByCode.get(fields[8]);
  if (!country) return null;
  return {
    external_id: `city:${fields[0]}`,
    title: fields[1],
    subtitle: country.country,
    kind: 'city',
    country_code: fields[8],
    country: country.country,
    geonames_id: fields[0],
    latitude: Number(fields[4]),
    longitude: Number(fields[5]),
    population: Number(fields[14]) || 0,
    feature_code: fields[7],
  };
}).filter(Boolean);

const records = [...countries, ...cities];
const json = JSON.stringify(records).replaceAll('$json$', '$j_s_o_n$');
const sql = `begin;
set local lock_timeout='30s';
set local statement_timeout='15min';
lock table public.seed_catalog_items in share row exclusive mode;
alter table public.seed_catalog_items disable trigger guard_uin_card_insert_v73;

create temporary table global_place_source_v122(
  external_id text primary key,title text not null,subtitle text,kind text not null,
  country_code text not null,country text not null,geonames_id text,
  latitude numeric,longitude numeric,population bigint,feature_code text
) on commit drop;

insert into global_place_source_v122
select * from jsonb_to_recordset($json$${json}$json$) as row(
  external_id text,title text,subtitle text,kind text,country_code text,country text,
  geonames_id text,latitude numeric,longitude numeric,population bigint,feature_code text
);

do $migration$
declare v_go_type_id uuid;
begin
  select id into v_go_type_id from public.seed_types
  where is_active and slug in ('go','travel','visit','place','git')
  order by case slug when 'go' then 0 when 'travel' then 1 when 'visit' then 2 when 'place' then 3 else 4 end
  limit 1;
  if v_go_type_id is null then raise exception 'Aktif yer/gezi seed türü bulunamadı.'; end if;

  update public.seed_catalog_items item set
    seed_type_id=v_go_type_id,item_kind='place',canonical_title=source.title,
    creator_name=source.subtitle,language_code='tr',status='active',merged_into_id=null,
    metadata=coalesce(item.metadata,'{}'::jsonb)||jsonb_build_object(
      'content_type_id','place','uin_item_kind','place','source_provider','geonames',
      'source_external_id',source.external_id,'reference_url','https://www.geonames.org/'||source.geonames_id,
      'global_place_catalogue',true,'global_place_kind',source.kind,'place_kind',case when source.kind='country' then 'Ülke' else 'Şehir' end,
      'country_code',source.country_code,'country',source.country,'geonames_id',source.geonames_id,
      'latitude',source.latitude,'longitude',source.longitude,'population',source.population,'feature_code',source.feature_code
    ),updated_at=now()
  from global_place_source_v122 source
  where lower(coalesce(item.external_source,item.metadata->>'source_provider',''))='geonames'
    and coalesce(item.external_id,item.metadata->>'source_external_id','')=source.external_id;

  insert into public.seed_catalog_items(
    seed_type_id,item_kind,canonical_title,creator_name,language_code,external_source,external_id,metadata,status
  )
  select v_go_type_id,'place',source.title,source.subtitle,'tr','geonames',source.external_id,
    jsonb_build_object(
      'content_type_id','place','uin_item_kind','place','source_provider','geonames',
      'source_external_id',source.external_id,'reference_url','https://www.geonames.org/'||source.geonames_id,
      'global_place_catalogue',true,'global_place_kind',source.kind,'place_kind',case when source.kind='country' then 'Ülke' else 'Şehir' end,
      'country_code',source.country_code,'country',source.country,'geonames_id',source.geonames_id,
      'latitude',source.latitude,'longitude',source.longitude,'population',source.population,'feature_code',source.feature_code
    ),'active'
  from global_place_source_v122 source
  where not exists(
    select 1 from public.seed_catalog_items item
    where lower(coalesce(item.external_source,item.metadata->>'source_provider',''))='geonames'
      and coalesce(item.external_id,item.metadata->>'source_external_id','')=source.external_id
  );

  update public.canonical_targets target set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'place_hierarchy',jsonb_build_object(
      'kind',case when item.metadata->>'global_place_kind'='country' then 'Ülke' else 'Şehir' end,
      'parent_target_id',case when item.metadata->>'global_place_kind'='city' then country_item.canonical_target_id else null end
    ),
    'global_place_catalogue',true,'global_place_kind',item.metadata->>'global_place_kind',
    'country_code',item.metadata->>'country_code','country',item.metadata->>'country',
    'geonames_id',item.metadata->>'geonames_id','latitude',item.metadata->'latitude',
    'longitude',item.metadata->'longitude','population',item.metadata->'population'
  ),updated_at=now()
  from public.seed_catalog_items item
  left join public.seed_catalog_items country_item
    on country_item.status='active' and country_item.external_source='geonames'
    and country_item.external_id='country:'||(item.metadata->>'country_code')
  where item.canonical_target_id=target.id and item.status='active'
    and item.metadata->>'global_place_catalogue'='true';
end;
$migration$;

create index if not exists seed_catalog_global_places_v122
on public.seed_catalog_items((metadata->>'global_place_kind'),(metadata->>'country_code'))
where status='active' and metadata->>'global_place_catalogue'='true';

do $catalogue$
declare
  definition text;
  order_marker text := 'order by coalesce(socials.updated_at,seed.updated_at,t.updated_at) desc,t.id limit';
  place_filter text := 'and (p_target_id is not null or nullif(btrim(coalesce(p_query,'''')),'''') is not null or not exists(select 1 from public.seed_catalog_items bulk_place where bulk_place.canonical_target_id=t.id and bulk_place.status=''active'' and bulk_place.metadata->>''global_place_catalogue''=''true'' and bulk_place.metadata->>''global_place_kind''=''city''))';
begin
  definition:=pg_get_functiondef('public.get_uin_catalogue_v64(text,integer,integer,uuid)'::regprocedure);
  if position(place_filter in definition)=0 then
    if position(order_marker in definition)=0 then raise exception 'Catalogue ordering definition changed'; end if;
    execute replace(definition,order_marker,place_filter||E'\n  '||order_marker);
  end if;
end;
$catalogue$;

create or replace function public.get_global_place_counts_v122()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'countries',count(*) filter(where metadata->>'global_place_kind'='country'),
    'cities',count(*) filter(where metadata->>'global_place_kind'='city'),
    'total',count(*)
  ) from public.seed_catalog_items
  where status='active' and metadata->>'global_place_catalogue'='true';
$$;
revoke all on function public.get_global_place_counts_v122() from public;
grant execute on function public.get_global_place_counts_v122() to anon,authenticated;
notify pgrst,'reload schema';
alter table public.seed_catalog_items enable trigger guard_uin_card_insert_v73;
commit;
`;

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, sql, 'utf8');
console.log(JSON.stringify({ countries: countries.length, cities: cities.length, total: records.length, output }));
