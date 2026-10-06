import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LIST_SIZE = 100;
const FETCH_SIZE = 200;
const OUTPUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20261006130000_open_library_book_lists_v110.sql');
const FIELDS = [
  'key','title','subtitle','author_name','first_publish_year','cover_i','language','isbn','publisher','subject',
  'ratings_average','ratings_count','edition_count','edition_key','number_of_pages_median','readinglog_count',
  'want_to_read_count','currently_reading_count','already_read_count',
].join(',');

const lists = [
  { id: 'most_read', label: 'En çok okunan 100', q: 'trending_score_hourly_sum:[1 TO *] readinglog_count:[4 TO *]', sort: 'trending' },
  { id: 'classics', label: 'Klasikler 100', q: 'ddc:8* first_publish_year:[* TO 1950] publish_year:[2000 TO *] NOT public_scan_b:false', sort: 'trending' },
  { id: 'science_fiction_fantasy', label: 'Bilimkurgu & Fantastik 100', q: '(subject:"science fiction" OR subject:fantasy) readinglog_count:[2 TO *]', sort: 'trending' },
  { id: 'mystery_thriller', label: 'Polisiye & Gerilim 100', q: '(subject:mystery OR subject:thrillers) readinglog_count:[2 TO *]', sort: 'trending' },
  { id: 'turkish_literature', label: 'Türk Edebiyatı 100', subjectPath: 'turkish_literature' },
];

const clean = (value) => typeof value === 'string' ? value.trim() : '';
const textArray = (value, max = 20) => Array.isArray(value) ? [...new Set(value.map(clean).filter(Boolean))].slice(0, max) : [];
const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const workId = (key) => clean(key).replace(/^\/works\//, '');
const identity = (doc) => `${clean(doc.title).toLocaleLowerCase('tr-TR')}|${clean(doc.author_name?.[0]).toLocaleLowerCase('tr-TR')}`;

async function fetchList(list) {
  if (list.subjectPath) {
    const url = `https://openlibrary.org/subjects/${encodeURIComponent(list.subjectPath)}.json?limit=500`;
    const response = await fetch(url, { headers: { 'User-Agent': 'UIN/2.0 (https://uin.onl)' } });
    if (!response.ok) throw new Error(`${list.label}: Open Library ${response.status}`);
    const body = await response.json();
    const docs = (Array.isArray(body.works) ? body.works : []).map((work) => ({
      ...work,
      author_name: Array.isArray(work.authors) ? work.authors.map((author) => author?.name).filter(Boolean) : [],
      cover_i: work.cover_id,
      subject: work.subject,
    }));
    return selectWorks(list, docs);
  }
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', list.q);
  url.searchParams.set('sort', list.sort);
  url.searchParams.set('limit', String(FETCH_SIZE));
  url.searchParams.set('fields', FIELDS);
  const response = await fetch(url, { headers: { 'User-Agent': 'UIN/2.0 (https://uin.onl)' } });
  if (!response.ok) throw new Error(`${list.label}: Open Library ${response.status}`);
  const body = await response.json();
  return selectWorks(list, Array.isArray(body.docs) ? body.docs : []);
}

function selectWorks(list, docs) {
  const seen = new Set();
  const selected = [];
  for (const doc of docs) {
    const id = workId(doc.key);
    const title = clean(doc.title);
    const author = clean(doc.author_name?.[0]);
    const coverId = numberOrNull(doc.cover_i);
    const key = identity(doc);
    if (!id || !title || !author || !coverId || seen.has(key)) continue;
    seen.add(key);
    selected.push({ doc, id, title, author, coverId });
    if (selected.length === LIST_SIZE) break;
  }
  if (selected.length < LIST_SIZE) throw new Error(`${list.label}: yalnızca ${selected.length} kapaklı ve yazarlı eser bulundu.`);
  return selected;
}

const fetched = await Promise.all(lists.map(async (list) => {
  const rows = await fetchList(list);
  process.stdout.write(`${list.label}: ${rows.length}\n`);
  return { ...list, rows };
}));

const books = new Map();
for (const list of fetched) {
  list.rows.forEach(({ doc, id, title, author, coverId }, index) => {
    const key = identity(doc);
    const existing = books.get(key);
    const rawYear = numberOrNull(doc.first_publish_year);
    const year = rawYear && rawYear >= 1 && rawYear <= 3000 ? rawYear : null;
    const source = existing ?? {
      external_id: id,
      title,
      original_title: clean(doc.subtitle) || null,
      creator_name: author,
      release_year: year,
      cover_url: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
      language_code: textArray(doc.language, 10).includes('tr') ? 'tr' : (textArray(doc.language, 10)[0] ?? null),
      metadata: {
        content_type_id: 'book', uin_item_kind: 'book', source_provider: 'open_library', source_external_id: id,
        open_library_work_id: id, open_library_key: `/works/${id}`,
        source_url: `https://openlibrary.org/works/${id}`, reference_url: `https://openlibrary.org/works/${id}`,
        open_library_cover_id: coverId, isbn: textArray(doc.isbn, 30), languages: textArray(doc.language, 20),
        publishers: textArray(doc.publisher, 10), subjects: textArray(doc.subject, 30), edition_keys: textArray(doc.edition_key, 10),
        ratings_average: numberOrNull(doc.ratings_average), ratings_count: numberOrNull(doc.ratings_count),
        edition_count: numberOrNull(doc.edition_count), number_of_pages_median: numberOrNull(doc.number_of_pages_median),
        readinglog_count: numberOrNull(doc.readinglog_count), want_to_read_count: numberOrNull(doc.want_to_read_count),
        currently_reading_count: numberOrNull(doc.currently_reading_count), already_read_count: numberOrNull(doc.already_read_count),
        book_lists: [], book_list_ranks: {},
      },
    };
    if (year && (!source.release_year || year < source.release_year)) source.release_year = year;
    source.metadata.book_lists.push(list.id);
    source.metadata.book_list_ranks[list.id] = index + 1;
    books.set(key, source);
  });
}

const rows = [...books.values()].sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'));
const payload = JSON.stringify(rows).replace(/\$json\$/g, '$ json $');
const listConfig = JSON.stringify(lists.map(({ id, label }) => ({ id, label, size: LIST_SIZE })));
const sql = `begin;

do $migration$
declare
  v_read_type_id uuid;
  v_row record;
  v_item_id uuid;
begin
  select id into v_read_type_id from public.seed_types where slug in ('read','book','oku') and is_active order by case slug when 'read' then 0 else 1 end limit 1;
  if v_read_type_id is null then raise exception 'Aktif kitap/okuma seed türü bulunamadı.'; end if;

  for v_row in
    select * from jsonb_to_recordset($json$${payload}$json$::jsonb) as x(
      external_id text, title text, original_title text, creator_name text, release_year integer,
      cover_url text, language_code text, metadata jsonb
    )
  loop
    select item.id into v_item_id
    from public.seed_catalog_items item
    where item.status in ('active','pending','approved') and (
      (lower(coalesce(item.external_source,item.metadata->>'source_provider',''))='open_library' and coalesce(item.external_id,item.metadata->>'source_external_id','')=v_row.external_id)
      or (public.canonical_normalize_v31(item.canonical_title)=public.canonical_normalize_v31(v_row.title)
          and public.canonical_normalize_v31(item.creator_name)=public.canonical_normalize_v31(v_row.creator_name))
    )
    order by case item.status when 'active' then 0 when 'approved' then 1 else 2 end,item.created_at,item.id limit 1;

    if v_item_id is null then
      insert into public.seed_catalog_items(seed_type_id,item_kind,canonical_title,original_title,creator_name,release_year,cover_url,language_code,external_source,external_id,metadata,status)
      values(v_read_type_id,'book',v_row.title,v_row.original_title,v_row.creator_name,v_row.release_year,v_row.cover_url,v_row.language_code,'open_library',v_row.external_id,v_row.metadata,'active')
      returning id into v_item_id;
    else
      update public.seed_catalog_items
      set seed_type_id=v_read_type_id,item_kind='book',cover_url=coalesce(nullif(cover_url,''),v_row.cover_url),
          external_source=case when nullif(external_source,'') is null then 'open_library' else external_source end,
          external_id=case when nullif(external_id,'') is null then v_row.external_id else external_id end,
          metadata=coalesce(metadata,'{}'::jsonb)||v_row.metadata,status='active',merged_into_id=null,updated_at=now()
      where id=v_item_id;
    end if;
  end loop;

  update public.seed_catalog_items item
  set metadata=coalesce(item.metadata,'{}'::jsonb)||jsonb_build_object(
    'book_lists',source.metadata->'book_lists','book_list_ranks',source.metadata->'book_list_ranks',
    'book_list_catalog_version','2026-10-06','book_list_catalogues', '${listConfig.replace(/'/g, "''")}'::jsonb
  ),updated_at=now()
  from public.seed_catalog_items source
  where source.metadata ? 'book_lists'
    and source.canonical_target_id=item.canonical_target_id and item.status='active';

  update public.canonical_targets target
  set editorial_metadata=coalesce(target.editorial_metadata,'{}'::jsonb)||jsonb_build_object(
    'book_lists',source.metadata->'book_lists','book_list_ranks',source.metadata->'book_list_ranks',
    'book_list_catalog_version','2026-10-06'
  ),updated_at=now()
  from public.seed_catalog_items source
  where source.metadata ? 'book_lists' and source.canonical_target_id=target.id;
end;
$migration$;

notify pgrst,'reload schema';
commit;
`;

await writeFile(OUTPUT, sql, 'utf8');
process.stdout.write(`Benzersiz kitap: ${rows.length}; liste sırası: ${lists.length * LIST_SIZE}; çıktı: ${OUTPUT}\n`);
