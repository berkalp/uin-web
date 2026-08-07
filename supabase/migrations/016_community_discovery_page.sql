begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

-- ============================================================
-- COMMUNITY DISCOVERY
--
-- Communities remain curated Intent context. This function exposes a
-- searchable catalogue and derives location, date and participant
-- eligibility from current visible Intent resources.
-- ============================================================

create or replace function public.search_communities(
  p_query text default null,
  p_category_id uuid default null,
  p_activity_id uuid default null,
  p_location_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_eligibility text default null,
  p_following_only boolean default false,
  p_require_intent_match boolean default false,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_icon_key text,
  community_icon_url text,
  community_accent_color text,
  community_secondary_color text,
  community_cover_image_url text,
  community_scope_type text,
  category_id uuid,
  category_name text,
  category_ids uuid[],
  category_names text[],
  activity_ids uuid[],
  activity_names text[],
  is_following boolean,
  active_intent_count bigint,
  matching_intent_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text;
  v_eligibility text;
  v_limit integer;
  v_offset integer;
begin
  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  if
    p_start_date is not null
    and p_end_date is not null
    and p_end_date < p_start_date
  then
    raise exception
      'Search end date cannot be earlier than the start date.'
      using errcode = '22023';
  end if;

  v_query := nullif(
    public.normalize_activity_catalogue_name(
      p_query
    ),
    ''
  );

  v_eligibility := lower(
    btrim(
      coalesce(
        p_eligibility,
        'all'
      )
    )
  );

  if v_eligibility not in (
    'eligible',
    'everyone',
    'women_only',
    'men_only',
    'all'
  ) then
    raise exception
      'Unsupported participant eligibility filter.'
      using errcode = '22023';
  end if;

  v_limit := least(
    greatest(
      coalesce(
        p_limit,
        24
      ),
      1
    ),
    60
  );

  v_offset := greatest(
    coalesce(
      p_offset,
      0
    ),
    0
  );

  return query
  with community_links as (
    select
      link.community_id,
      link.intent_id
    from public.intent_communities link
  ),

  current_resources_raw as (
    select
      link.community_id,

      case
        when linked_plan.id is not null
          then 'plan:' || linked_plan.id::text
        else 'intent:' || intent.id::text
      end as resource_key,

      intent.id as intent_id,
      intent.participant_eligibility,

      coalesce(
        linked_plan.activity_id,
        intent.activity_id
      ) as effective_activity_id,

      activity.category_id as effective_category_id,

      coalesce(
        linked_plan.location_id,
        intent.location_id
      ) as effective_location_id,

      coalesce(
        linked_plan.window_start,
        intent.start_date
      )::date as effective_start_date,

      coalesce(
        linked_plan.window_end,
        intent.end_date
      )::date as effective_end_date,

      sport.name as sport_name,

      case
        when linked_plan.id is not null then
          public.user_is_eligible_for_plan_intents(
            linked_plan.id,
            v_user_id
          )
        else
          public.user_is_eligible_for_intent(
            intent.id,
            v_user_id
          )
      end as viewer_is_eligible

    from community_links link

    join public.intents intent
      on intent.id = link.intent_id

    left join lateral (
      select plan.*
      from public.plan_intents plan_link
      join public.plans plan
        on plan.id = plan_link.plan_id
      where plan_link.intent_id = intent.id
        and plan_link.status = 'active'
      order by
        case plan.status
          when 'forming' then 0
          when 'planned' then 1
          when 'completed' then 2
          else 3
        end,
        plan_link.created_at asc,
        plan.id asc
      limit 1
    ) linked_plan
      on true

    join public.activities activity
      on activity.id = coalesce(
        linked_plan.activity_id,
        intent.activity_id
      )

    left join public.sports sport
      on sport.id = intent.sport_id

    where
      public.can_user_view_intent_activity(
        intent.id,
        v_user_id
      )

      and (
        (
          linked_plan.id is not null
          and linked_plan.status = 'forming'
          and linked_plan.expired_at is null
          and linked_plan.window_end >= current_date
        )
        or
        (
          linked_plan.id is null
          and intent.status = 'active'
          and intent.expired_at is null
          and intent.end_date >= current_date
        )
      )
  ),

  current_resources as (
    select distinct
      resource.community_id,
      resource.resource_key,
      resource.intent_id,
      resource.participant_eligibility,
      resource.effective_activity_id,
      resource.effective_category_id,
      resource.effective_location_id,
      resource.effective_start_date,
      resource.effective_end_date,
      resource.sport_name,
      resource.viewer_is_eligible
    from current_resources_raw resource
  ),

  resource_counts as (
    select
      resource.community_id,

      count(
        distinct resource.resource_key
      )::bigint as active_intent_count,

      count(
        distinct resource.resource_key
      ) filter (
        where
          (
            p_location_id is null
            or public.locations_overlap(
              resource.effective_location_id,
              p_location_id
            )
          )

          and (
            p_start_date is null
            or resource.effective_end_date >= p_start_date
          )

          and (
            p_end_date is null
            or resource.effective_start_date <= p_end_date
          )

          and (
            v_eligibility = 'all'
            or (
              v_eligibility = 'eligible'
              and resource.viewer_is_eligible
            )
            or resource.participant_eligibility = v_eligibility
          )
      )::bigint as matching_intent_count

    from current_resources resource
    group by resource.community_id
  ),

  catalogue as (
    select
      active_community.community_id,
      active_community.community_name,
      active_community.community_slug,
      active_community.community_description,
      active_community.community_icon_key,
      active_community.community_icon_url,
      active_community.community_accent_color,
      active_community.community_secondary_color,
      community.cover_image_url as community_cover_image_url,
      active_community.community_scope_type,
      active_community.category_id,
      active_community.category_name,
      active_community.category_ids,
      active_community.category_names,
      active_community.activity_ids,
      active_community.activity_names,

      exists (
        select 1
        from public.community_follows follow_record
        where follow_record.user_id = v_user_id
          and follow_record.community_id = active_community.community_id
      ) as is_following,

      coalesce(
        counts.active_intent_count,
        0
      )::bigint as active_intent_count,

      coalesce(
        counts.matching_intent_count,
        0
      )::bigint as matching_intent_count

    from public.get_active_communities(
      null::uuid,
      null::uuid
    ) active_community

    join public.communities community
      on community.id = active_community.community_id

    left join resource_counts counts
      on counts.community_id = active_community.community_id
  ),

  filtered_catalogue as (
    select catalogue.*
    from catalogue
    where
      (
        not coalesce(
          p_following_only,
          false
        )
        or catalogue.is_following
      )

      and (
        p_category_id is null
        or catalogue.community_scope_type = 'global'
        or p_category_id = any(
          coalesce(
            catalogue.category_ids,
            array[]::uuid[]
          )
        )
      )

      and (
        p_activity_id is null
        or catalogue.community_scope_type = 'global'
        or p_activity_id = any(
          coalesce(
            catalogue.activity_ids,
            array[]::uuid[]
          )
        )
        or exists (
          select 1
          from public.activities selected_activity
          where selected_activity.id = p_activity_id
            and selected_activity.category_id = any(
              coalesce(
                catalogue.category_ids,
                array[]::uuid[]
              )
            )
        )
      )

      and (
        v_query is null

        or public.normalize_activity_catalogue_name(
          catalogue.community_name
        ) like '%' || v_query || '%'

        or public.normalize_activity_catalogue_name(
          catalogue.community_description
        ) like '%' || v_query || '%'

        or exists (
          select 1
          from unnest(
            coalesce(
              catalogue.category_names,
              array[]::text[]
            )
          ) as category_name(value)
          where public.normalize_activity_catalogue_name(
            category_name.value
          ) like '%' || v_query || '%'
        )

        or exists (
          select 1
          from unnest(
            coalesce(
              catalogue.activity_names,
              array[]::text[]
            )
          ) as activity_name(value)
          where public.normalize_activity_catalogue_name(
            activity_name.value
          ) like '%' || v_query || '%'
        )

        or exists (
          select 1
          from public.community_aliases alias
          where alias.community_id = catalogue.community_id
            and alias.normalized_alias like '%' || v_query || '%'
        )

        or exists (
          select 1
          from current_resources resource
          where resource.community_id = catalogue.community_id
            and public.normalize_activity_catalogue_name(
              resource.sport_name
            ) like '%' || v_query || '%'
        )
      )

      and (
        not coalesce(
          p_require_intent_match,
          false
        )
        or catalogue.matching_intent_count > 0
      )
  ),

  counted_catalogue as (
    select
      filtered_catalogue.*,
      count(*) over()::bigint as result_total_count
    from filtered_catalogue
  )

  select
    counted.community_id,
    counted.community_name,
    counted.community_slug,
    counted.community_description,
    counted.community_icon_key,
    counted.community_icon_url,
    counted.community_accent_color,
    counted.community_secondary_color,
    counted.community_cover_image_url,
    counted.community_scope_type,
    counted.category_id,
    counted.category_name,
    counted.category_ids,
    counted.category_names,
    counted.activity_ids,
    counted.activity_names,
    counted.is_following,
    counted.active_intent_count,
    counted.matching_intent_count,
    counted.result_total_count
  from counted_catalogue counted
  order by
    counted.is_following desc,
    counted.matching_intent_count desc,
    counted.active_intent_count desc,
    counted.community_name,
    counted.community_id
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_communities(
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
)
from public;

grant execute on function public.search_communities(
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
)
to authenticated;

-- Register source copy for the dynamic language system when installed.
do $$
begin
  if to_regclass('public.translation_keys') is not null
     and to_regclass('public.translation_values') is not null
     and to_regclass('public.app_locales') is not null then

    insert into public.translation_keys (
      key,
      namespace,
      default_text,
      description,
      source_revision,
      is_active
    )
    select
      source_row.key,
      'community-discovery',
      source_row.default_text,
      'Community discovery and navigation',
      1,
      true
    from (
      values
        ('source.community-discovery.communities', 'Communities'),
        ('source.community-discovery.eyebrow', 'Community Discovery'),
        ('source.community-discovery.title', 'Discover Communities'),
        ('source.community-discovery.description', 'Find and follow the teams, interests, genres and cultures that shape the Intents you want to discover.'),
        ('source.community-discovery.browse-all', 'All Communities'),
        ('source.community-discovery.following', 'Following Communities'),
        ('source.community-discovery.suggest', 'Suggest a Community'),
        ('source.community-discovery.search-placeholder', 'Community name, sport, category or Activity'),
        ('source.community-discovery.results', 'Community results'),
        ('source.community-discovery.active-intents', 'active Intents'),
        ('source.community-discovery.matching-intents', 'matching Intents'),
        ('source.community-discovery.open', 'Open Community'),
        ('source.community-discovery.no-results', 'No Communities found'),
        ('source.community-discovery.no-results-help', 'Try clearing one or more filters. Communities are remarkably bad at appearing where the criteria exclude them.'),
        ('source.community-discovery.follow-private', 'Following personalises Discover. It is private and does not make you a member.'),
        ('source.community-discovery.search-help', 'Search Community context directly, or use location, date and participant eligibility to find Communities with matching current Intents.'),
        ('source.community-discovery.page-template', 'Page {0} of {1}'),
        ('source.community-discovery.count-template', '{0} Communities'),
        ('source.community-discovery.search-title', 'Search Communities'),
        ('source.community-discovery.following-short', 'Following'),
        ('source.community-discovery.result-help', 'Results reflect the selected Community context and matching current Intent criteria.'),
        ('source.community-discovery.load-error', 'Community discovery could not be loaded.'),
        ('source.community-discovery.fallback-description', 'A curated UIN Community context.'),
        ('source.community-discovery.all-activities', 'All Activities'),
        ('source.community-discovery.more-template', '+{0} more'),
        ('source.community-discovery.clear-filters', 'Clear filters'),
        ('source.community-discovery.previous', 'Previous'),
        ('source.community-discovery.next', 'Next')
    ) as source_row(key, default_text)
    on conflict (key)
    do update
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

    insert into public.translation_values (
      translation_key_id,
      locale_code,
      value,
      source_revision,
      updated_by
    )
    select
      translation_key.id,
      'tr',
      translation_row.translated_text,
      translation_key.source_revision,
      null
    from (
      values
        ('source.community-discovery.communities', 'Topluluklar'),
        ('source.community-discovery.eyebrow', 'Topluluk Keşfi'),
        ('source.community-discovery.title', 'Toplulukları Keşfet'),
        ('source.community-discovery.description', 'Keşfetmek istediğin Intent’leri şekillendiren takımları, ilgi alanlarını, türleri ve kültürleri bul ve takip et.'),
        ('source.community-discovery.browse-all', 'Tüm Topluluklar'),
        ('source.community-discovery.following', 'Takip Edilen Topluluklar'),
        ('source.community-discovery.suggest', 'Topluluk Öner'),
        ('source.community-discovery.search-placeholder', 'Topluluk adı, spor, kategori veya Aktivite'),
        ('source.community-discovery.results', 'Topluluk sonuçları'),
        ('source.community-discovery.active-intents', 'aktif Intent'),
        ('source.community-discovery.matching-intents', 'eşleşen Intent'),
        ('source.community-discovery.open', 'Topluluğu Aç'),
        ('source.community-discovery.no-results', 'Topluluk bulunamadı'),
        ('source.community-discovery.no-results-help', 'Bir veya birkaç filtreyi temizlemeyi dene. Topluluklar, ölçütlerin dışladığı yerde görünmekte şaşırtıcı derecede başarısızdır.'),
        ('source.community-discovery.follow-private', 'Takip etmek Keşfet’i kişiselleştirir. Gizlidir ve seni üye yapmaz.'),
        ('source.community-discovery.search-help', 'Topluluk bağlamını doğrudan ara veya eşleşen güncel Intent’leri bulunan Toplulukları görmek için konum, tarih ve katılımcı uygunluğunu kullan.'),
        ('source.community-discovery.page-template', 'Sayfa {0} / {1}'),
        ('source.community-discovery.count-template', '{0} Topluluk'),
        ('source.community-discovery.search-title', 'Topluluklarda Ara'),
        ('source.community-discovery.following-short', 'Takip Edilenler'),
        ('source.community-discovery.result-help', 'Sonuçlar seçilen Topluluk bağlamını ve eşleşen güncel Intent ölçütlerini yansıtır.'),
        ('source.community-discovery.load-error', 'Topluluk keşfi yüklenemedi.'),
        ('source.community-discovery.fallback-description', 'UIN için düzenlenmiş bir Topluluk bağlamı.'),
        ('source.community-discovery.all-activities', 'Tüm Aktiviteler'),
        ('source.community-discovery.more-template', '+{0} daha'),
        ('source.community-discovery.clear-filters', 'Filtreleri temizle'),
        ('source.community-discovery.previous', 'Önceki'),
        ('source.community-discovery.next', 'Sonraki')
    ) as translation_row(key, translated_text)
    join public.translation_keys translation_key
      on translation_key.key = translation_row.key
    where exists (
      select 1
      from public.app_locales locale
      where locale.code = 'tr'
    )
    on conflict (translation_key_id, locale_code)
    do update
    set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
    where nullif(btrim(public.translation_values.value), '') is null
       or public.translation_values.source_revision < excluded.source_revision;
  end if;
end;
$$;

commit;
