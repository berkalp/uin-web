begin;

-- ---------------------------------------------------------------------------
-- UIN dynamic i18n source synchronization
-- ---------------------------------------------------------------------------
-- Static application copy is detected at build/development time and shipped in
-- generatedSourceManifest.ts. Admin > Languages can synchronize that manifest
-- without replacing hand-curated keys or catalogue keys.

create or replace function public.admin_sync_translation_sources(
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_existing_id uuid;
  v_existing_text text;
  v_existing_namespace text;
  v_existing_active boolean;
  v_covering_id uuid;
  v_received integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_covered integer := 0;
  v_key text;
  v_namespace text;
  v_default_text text;
  v_description text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'Source entries must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_entries, '[]'::jsonb)) > 10000 then
    raise exception 'Too many source entries in one synchronization.' using errcode = '22023';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(coalesce(p_entries, '[]'::jsonb)) as item(
      key text,
      namespace text,
      default_text text,
      description text
    )
  loop
    v_received := v_received + 1;
    v_key := btrim(coalesce(v_item.key, ''));
    v_namespace := btrim(coalesce(v_item.namespace, 'common'));
    v_default_text := btrim(coalesce(v_item.default_text, ''));
    v_description := nullif(btrim(coalesce(v_item.description, '')), '');

    -- This RPC is intentionally restricted to generated keys. Curated and
    -- database-catalogue keys continue to be managed by their own migrations.
    if v_key !~ '^auto\.[a-z0-9][a-z0-9._-]*$' then
      raise exception 'Invalid generated translation key: %', v_key using errcode = '22023';
    end if;

    if v_namespace !~ '^[a-z0-9][a-z0-9._-]*$' then
      raise exception 'Invalid translation namespace: %', v_namespace using errcode = '22023';
    end if;

    if v_default_text = '' or char_length(v_default_text) > 2000 then
      raise exception 'Invalid source text for key %.', v_key using errcode = '22023';
    end if;

    -- Exact visible source text may already be covered by an older curated key.
    -- The compatibility runtime translates by source text, so a duplicate key
    -- would add ambiguity without adding coverage.
    select translation_key.id
    into v_covering_id
    from public.translation_keys translation_key
    where translation_key.is_active = true
      and translation_key.default_text = v_default_text
      and translation_key.key <> v_key
    order by
      case when translation_key.key like 'auto.%' then 1 else 0 end,
      translation_key.created_at,
      translation_key.key
    limit 1;

    if v_covering_id is not null then
      update public.translation_keys
      set is_active = false,
          updated_at = now()
      where key = v_key
        and key like 'auto.%'
        and is_active = true;

      v_covered := v_covered + 1;
      v_covering_id := null;
      continue;
    end if;

    select
      translation_key.id,
      translation_key.default_text,
      translation_key.namespace,
      translation_key.is_active
    into
      v_existing_id,
      v_existing_text,
      v_existing_namespace,
      v_existing_active
    from public.translation_keys translation_key
    where translation_key.key = v_key
    limit 1;

    if v_existing_id is null then
      insert into public.translation_keys (
        key,
        namespace,
        default_text,
        description,
        source_revision,
        is_active
      )
      values (
        v_key,
        v_namespace,
        v_default_text,
        coalesce(v_description, 'AUTO-SOURCE: generated from application source'),
        1,
        true
      );
      v_inserted := v_inserted + 1;
    elsif
      v_existing_text is distinct from v_default_text
      or v_existing_namespace is distinct from v_namespace
      or coalesce(v_existing_active, false) = false
    then
      update public.translation_keys
      set
        namespace = v_namespace,
        default_text = v_default_text,
        description = coalesce(v_description, description),
        source_revision = case
          when default_text is distinct from v_default_text then source_revision + 1
          else source_revision
        end,
        is_active = true,
        updated_at = now()
      where id = v_existing_id;
      v_updated := v_updated + 1;
    else
      update public.translation_keys
      set
        description = coalesce(v_description, description),
        updated_at = now()
      where id = v_existing_id;
      v_unchanged := v_unchanged + 1;
    end if;

    v_existing_id := null;
  end loop;

  return jsonb_build_object(
    'received', v_received,
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'covered_existing', v_covered,
    'deactivated', 0
  );
end;
$$;

revoke all on function public.admin_sync_translation_sources(jsonb) from public, anon;
grant execute on function public.admin_sync_translation_sources(jsonb) to authenticated;

create or replace function public.admin_finalize_translation_source_sync(
  p_active_keys jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deactivated integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_active_keys, '[]'::jsonb)) <> 'array' then
    raise exception 'Active source keys must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_active_keys, '[]'::jsonb)) > 10000 then
    raise exception 'Too many active source keys.' using errcode = '22023';
  end if;

  update public.translation_keys translation_key
  set is_active = false, updated_at = now()
  where translation_key.key like 'auto.%'
    and translation_key.is_active = true
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_active_keys, '[]'::jsonb)) active_key(key)
      where active_key.key = translation_key.key
    );

  get diagnostics v_deactivated = row_count;
  return v_deactivated;
end;
$$;

revoke all on function public.admin_finalize_translation_source_sync(jsonb) from public, anon;
grant execute on function public.admin_finalize_translation_source_sync(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed Type catalogue localization
-- ---------------------------------------------------------------------------
-- Seed Types are database catalogue values (Read, Visit, Make...), not user
-- content. Register their name and description just like Activity/Sport/etc.

create or replace function public.sync_seed_type_translation_catalogue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_id text;
  v_name text;
  v_description text;
  v_key text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := v_row ->> 'id';

  if tg_op = 'DELETE' then
    update public.translation_keys
    set is_active = false, updated_at = now()
    where key in (
      'catalogue.seed-types.' || v_id || '.name',
      'catalogue.seed-types.' || v_id || '.description'
    );
    return old;
  end if;

  v_name := nullif(btrim(coalesce(v_row ->> 'name', '')), '');
  v_description := nullif(btrim(coalesce(v_row ->> 'description', '')), '');

  v_key := 'catalogue.seed-types.' || v_id || '.name';
  if v_name is null then
    update public.translation_keys set is_active = false, updated_at = now() where key = v_key;
  else
    insert into public.translation_keys (key, namespace, default_text, description, source_revision, is_active)
    values (v_key, 'catalogue.seed-types', v_name, 'Database catalogue: seed_types.name', 1, true)
    on conflict (key) do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();
  end if;

  v_key := 'catalogue.seed-types.' || v_id || '.description';
  if v_description is null then
    update public.translation_keys set is_active = false, updated_at = now() where key = v_key;
  else
    insert into public.translation_keys (key, namespace, default_text, description, source_revision, is_active)
    values (v_key, 'catalogue.seed-types', v_description, 'Database catalogue: seed_types.description', 1, true)
    on conflict (key) do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();
  end if;

  return new;
end;
$$;

-- Install/update Seed Type catalogue keys only if the feature exists.
do $seed_type_i18n$
begin
  if to_regclass('public.seed_types') is not null then
    insert into public.translation_keys (key, namespace, default_text, description, source_revision, is_active)
    select
      'catalogue.seed-types.' || seed_type.id::text || '.name',
      'catalogue.seed-types',
      seed_type.name,
      'Database catalogue: seed_types.name',
      1,
      true
    from public.seed_types seed_type
    where nullif(btrim(seed_type.name), '') is not null
    on conflict (key) do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    insert into public.translation_keys (key, namespace, default_text, description, source_revision, is_active)
    select
      'catalogue.seed-types.' || seed_type.id::text || '.description',
      'catalogue.seed-types',
      seed_type.description,
      'Database catalogue: seed_types.description',
      1,
      true
    from public.seed_types seed_type
    where nullif(btrim(seed_type.description), '') is not null
    on conflict (key) do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision = case
        when public.translation_keys.default_text is distinct from excluded.default_text
          then public.translation_keys.source_revision + 1
        else public.translation_keys.source_revision
      end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    drop trigger if exists sync_seed_type_translation_catalogue_upsert on public.seed_types;
    drop trigger if exists sync_seed_type_translation_catalogue_delete on public.seed_types;

    create trigger sync_seed_type_translation_catalogue_upsert
      after insert or update of name, description
      on public.seed_types
      for each row
      execute function public.sync_seed_type_translation_catalogue();

    create trigger sync_seed_type_translation_catalogue_delete
      after delete
      on public.seed_types
      for each row
      execute function public.sync_seed_type_translation_catalogue();
  end if;
end;
$seed_type_i18n$;

-- Turkish labels for the built-in Seed Type vocabulary. These are only seeded
-- when blank/outdated, so later edits in Admin > Languages remain authoritative.
do $seed_type_tr$
begin
  if to_regclass('public.seed_types') is not null
     and exists (select 1 from public.app_locales where code = 'tr') then
    insert into public.translation_values (
      translation_key_id, locale_code, value, source_revision, updated_by
    )
    select
      translation_key.id,
      'tr',
      translated.value,
      translation_key.source_revision,
      null
    from public.seed_types seed_type
    join lateral (
      values
        ('name', case seed_type.slug
          when 'read' then 'Oku'
          when 'watch' then 'İzle'
          when 'listen' then 'Dinle'
          when 'visit' then 'Git'
          when 'try' then 'Dene'
          when 'learn' then 'Öğren'
          when 'play' then 'Oyna'
          when 'make' then 'Üret'
          when 'explore' then 'Keşfet'
          when 'practice' then 'Pratik Yap'
          else null end),
        ('description', case seed_type.slug
          when 'read' then 'Okumak istediğin kitaplar, makaleler ve yazılı eserler.'
          when 'watch' then 'İzlemek istediğin filmler, diziler, belgeseller ve videolar.'
          when 'listen' then 'Dinlemek istediğin müzikler, podcast’ler ve sesli içerikler.'
          when 'visit' then 'Gitmek istediğin yerler, müzeler, şehirler ve rotalar.'
          when 'try' then 'Denemek istediğin yemekler, mekânlar ve deneyimler.'
          when 'learn' then 'Öğrenmek istediğin beceriler, kurslar ve konular.'
          when 'play' then 'Oynamak veya deneyimlemek istediğin oyunlar ve eğlenceli şeyler.'
          when 'make' then 'İnşa etmek, yaratmak veya üretmek istediğin şeyler.'
          when 'explore' then 'Keşfetmek istediğin fikirler ve olasılıklar.'
          when 'practice' then 'Pratik yapmak istediğin beceriler ve alışkanlıklar.'
          else null end)
    ) translated(field_name, value) on translated.value is not null
    join public.translation_keys translation_key
      on translation_key.key =
        'catalogue.seed-types.' || seed_type.id::text || '.' || translated.field_name
    on conflict (translation_key_id, locale_code) do update
    set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
    where nullif(btrim(public.translation_values.value), '') is null
       or public.translation_values.source_revision < excluded.source_revision;
  end if;
end;
$seed_type_tr$;

-- ---------------------------------------------------------------------------
-- Immediate Turkish coverage for the new Timeline/Seed dashboard copy.
-- ---------------------------------------------------------------------------
-- The source-manifest sync will cover future additions. This small curated seed
-- makes the currently shipped dashboard coherent as soon as the migration runs.

with copy(key, namespace, default_text, translated_text) as (
  values
    ('source.timeline.attention-kicker.v2', 'timeline', 'Needs your attention', 'Dikkatini Bekleyenler'),
    ('source.timeline.attention-title.v2', 'timeline', 'A few things need you', 'Birkaç Şey Seni Bekliyor'),
    ('source.timeline.attention-description.v2', 'timeline', 'Actions and real-world changes that may affect an Intent or Activity appear here.', 'Bir Niyeti veya Aktiviteyi etkileyebilecek aksiyonlar ve gerçek hayattaki değişiklikler burada görünür.'),
    ('source.timeline.coming-up.v2', 'timeline', 'Coming up', 'Yaklaşanlar'),
    ('source.timeline.coming-up-title.v2', 'timeline', 'Activities already becoming real', 'Gerçeğe Dönüşmeye Başlayanlar'),
    ('source.timeline.coming-up-description.v2', 'timeline', 'Your nearest forming and planned Activities, ordered by what happens next.', 'En yakın şekillenen ve planlanmış Aktivitelerin, sırada ne olduğuna göre dizilir.'),
    ('source.timeline.personal-layer.v2', 'timeline', 'Personal layer', 'Kişisel Katman'),
    ('source.timeline.growing-seeds.v2', 'timeline', 'Growing Seeds', 'Büyüyen Tohumlar'),
    ('source.timeline.growing-seeds-description.v2', 'timeline', 'Personal possibilities still growing before they become an Intent.', 'Bir Niyete dönüşmeden önce büyümeye devam eden kişisel olasılıkların.'),
    ('source.timeline.view-all-seeds.v2', 'timeline', 'View all Seeds', 'Tüm Tohumları Gör'),
    ('source.timeline.previous-seeds.v2', 'timeline', 'Previous Seeds', 'Önceki Tohumlar'),
    ('source.timeline.next-seeds.v2', 'timeline', 'Next Seeds', 'Sonraki Tohumlar'),
    ('source.timeline.no-target-date.v2', 'timeline', 'No target date', 'Hedef tarih yok'),
    ('source.timeline.recent-history.v2', 'timeline', 'Recent history', 'Yakın Geçmiş'),
    ('source.timeline.recent-history-title.v2', 'timeline', 'What just moved behind you', 'Az Önce Geride Kalanlar'),
    ('source.timeline.recent-history-description.v2', 'timeline', 'Only the latest completed, expired or cancelled items live here. Full history stays in its own views.', 'Burada yalnızca en son yaşanan, süresi dolan veya iptal edilenler görünür. Tüm geçmiş kendi görünümünde kalır.'),
    ('source.timeline.not-scheduled-yet.v2', 'timeline', 'Not scheduled yet', 'Henüz planlanmadı'),
    ('source.timeline.waiting-for-a-match.v2', 'timeline', 'Waiting for a match', 'Eşleşme bekliyor'),
    ('source.timeline.join-requests.v2', 'timeline', 'Join requests', 'Katılım İstekleri'),
    ('source.timeline.review-join-requests.v2', 'timeline', 'Review who wants to join your Intents.', 'Niyetlerine kimlerin katılmak istediğine göz at.'),
    ('source.timeline.outcome-review.v2', 'timeline', 'Outcome review', 'Sonuç İncelemesi'),
    ('source.timeline.intent-to-activity-count.v2', 'timeline', '{1} Intents matched → 1 Activity', '{1} Niyet eşleşti → 1 Aktivite'),
    ('source.timeline.your-intent.v2', 'timeline', 'Your Intent ·', 'Senin Niyetin ·'),
    ('source.timeline.source.v2', 'timeline', 'Source ↗', 'Kaynak ↗')
), inserted as (
  insert into public.translation_keys (
    key, namespace, default_text, description, source_revision, is_active
  )
  select
    copy.key,
    copy.namespace,
    copy.default_text,
    'Curated UIN dashboard copy introduced with source-manifest synchronization',
    1,
    true
  from copy
  where not exists (
    select 1
    from public.translation_keys existing
    where existing.is_active = true
      and existing.default_text = copy.default_text
  )
  on conflict (key) do update
  set
    namespace = excluded.namespace,
    description = excluded.description,
    source_revision = case
      when public.translation_keys.default_text is distinct from excluded.default_text
        then public.translation_keys.source_revision + 1
      else public.translation_keys.source_revision
    end,
    default_text = excluded.default_text,
    is_active = true,
    updated_at = now()
  returning id
)
select count(*) from inserted;

with copy(default_text, translated_text) as (
  values
    ('Needs your attention', 'Dikkatini Bekleyenler'),
    ('A few things need you', 'Birkaç Şey Seni Bekliyor'),
    ('Actions and real-world changes that may affect an Intent or Activity appear here.', 'Bir Niyeti veya Aktiviteyi etkileyebilecek aksiyonlar ve gerçek hayattaki değişiklikler burada görünür.'),
    ('Coming up', 'Yaklaşanlar'),
    ('Activities already becoming real', 'Gerçeğe Dönüşmeye Başlayanlar'),
    ('Your nearest forming and planned Activities, ordered by what happens next.', 'En yakın şekillenen ve planlanmış Aktivitelerin, sırada ne olduğuna göre dizilir.'),
    ('Personal layer', 'Kişisel Katman'),
    ('Growing Seeds', 'Büyüyen Tohumlar'),
    ('Personal possibilities still growing before they become an Intent.', 'Bir Niyete dönüşmeden önce büyümeye devam eden kişisel olasılıkların.'),
    ('View all Seeds', 'Tüm Tohumları Gör'),
    ('Previous Seeds', 'Önceki Tohumlar'),
    ('Next Seeds', 'Sonraki Tohumlar'),
    ('No target date', 'Hedef tarih yok'),
    ('Recent history', 'Yakın Geçmiş'),
    ('What just moved behind you', 'Az Önce Geride Kalanlar'),
    ('Only the latest completed, expired or cancelled items live here. Full history stays in its own views.', 'Burada yalnızca en son yaşanan, süresi dolan veya iptal edilenler görünür. Tüm geçmiş kendi görünümünde kalır.'),
    ('Not scheduled yet', 'Henüz planlanmadı'),
    ('Waiting for a match', 'Eşleşme bekliyor'),
    ('Join requests', 'Katılım İstekleri'),
    ('Review who wants to join your Intents.', 'Niyetlerine kimlerin katılmak istediğine göz at.'),
    ('Outcome review', 'Sonuç İncelemesi'),
    ('{1} Intents matched → 1 Activity', '{1} Niyet eşleşti → 1 Aktivite'),
    ('Your Intent ·', 'Senin Niyetin ·'),
    ('Source ↗', 'Kaynak ↗')
), target as (
  select distinct on (translation_key.default_text)
    translation_key.id,
    translation_key.default_text,
    translation_key.source_revision
  from public.translation_keys translation_key
  join copy on copy.default_text = translation_key.default_text
  where translation_key.is_active = true
  order by translation_key.default_text,
    case when translation_key.key like 'auto.%' then 1 else 0 end,
    translation_key.key
)
insert into public.translation_values (
  translation_key_id, locale_code, value, source_revision, updated_by
)
select
  target.id,
  'tr',
  copy.translated_text,
  target.source_revision,
  null
from target
join copy on copy.default_text = target.default_text
where exists (select 1 from public.app_locales where code = 'tr')
on conflict (translation_key_id, locale_code) do update
set
  value = excluded.value,
  source_revision = excluded.source_revision,
  updated_by = excluded.updated_by,
  updated_at = now()
where nullif(btrim(public.translation_values.value), '') is null
   or public.translation_values.source_revision < excluded.source_revision;

commit;
