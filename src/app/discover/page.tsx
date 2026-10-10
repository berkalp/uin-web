import AppNavigation from "@/components/navigation/AppNavigation";
import WebCardLayoutPicker from "@/components/cards/WebCardLayoutPicker";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import CommunityContextChip from "@/components/communities/CommunityContextChip";
import DiscoverFiltersForm from "@/components/discover/DiscoverFiltersForm";
import DiscoverQuickFilters from "@/components/discover/DiscoverQuickFilters";
import DiscoverIntentCard, {
  type DiscoverIntentRow,
  type ViewerPlanLineage,
} from "@/components/discover/DiscoverIntentCard";
import DiscoverMapView, {
  type DiscoverMapPoint,
} from "@/components/discover/DiscoverMapView";
import {
  parseCommunityOptions,
  parseIntentCommunityRows,
  type CommunityOption,
} from "@/utils/communities";
import {
  createClient,
} from "@/utils/supabase/server";
import { getSportPresentation } from "@/utils/sportPresentation";
import {
  hydrateVisiblePlanPresentations,
  type VisiblePlanPresentation,
  type VisiblePlanPresentationRow,
} from "@/utils/planPresentationVisibility";
import {
  groupIntentLinksByIntentId,
  parseIntentLinkRows,
  type IntentLinkRpcRow,
} from "@/utils/intentLinks";
import {
  normalizeParticipantEligibility,
  type ParticipantEligibility,
} from "@/utils/participationEligibility";
import { parseIntentReactionContexts } from "@/utils/intentReactions";
import {
  groupActivityPeopleByResourceId,
  type ActivityPeopleBatchRow,
} from "@/utils/activityPeople";

export const dynamic =
  "force-dynamic";

type PublicExperienceCoverRow = {
  plan_id: string;
  media_id: string;
  storage_path: string | null;
  external_url: string | null;
};

type PublicExperienceCover =
  PublicExperienceCoverRow & {
    signed_url: string | null;
  };

type PublicPlanActivityLocationRow = {
  plan_id: string;
  activity_location_name: string | null;
};

type IntentCardNoteRow = {
  intent_id: string;
  notes: string | null;
};

type ViewerPlanLineageRow = {
  plan_id: string;
  source_count: number | string | null;
  source_intent_id: string | null;
  source_activity_name: string | null;
};


type DiscoverMapPointContextRow = {
  intent_id: string;
  plan_id: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  location_precision: "public_venue" | "approximate";
  location_query: string | null;
  public_location_name: string | null;
};

type VisiblePlanPublicContent = {
  meeting_point?: string | null;
  activity_location_name?: string | null;
};

type IntentCommonTargetRow = {
  intent_id: string;
  canonical_target_id: string;
  canonical_target_title: string;
};

type IntentSportCoverContext = {
  intent_id: string;
  sport_id: string | null;
  sport_name: string | null;
  sport_slug: string | null;
  sport_cover_url: string | null;
  primary_community_id: string | null;
  primary_community_name: string | null;
  community_sport_cover_url: string | null;
  context_cover_url: string | null;
};

type DiscoverReadError = {
  message?: string;
};

function getRowsetReadError(
  data: unknown,
  error: DiscoverReadError | null,
  label: string
): DiscoverReadError | null {
  if (error) return error;
  if (!Array.isArray(data)) {
    return { message: `${label} geçerli bir liste döndürmedi. Lütfen yeniden dene.` };
  }
  return data.some((row) => !row || typeof row !== "object" || Array.isArray(row))
    ? { message: `${label} eksik veya bozuk döndü. Lütfen yeniden dene.` }
    : null;
}

type DiscoveryCategory = {
  id: string;
  name: string;
};

type DiscoveryActivity = {
  id: string;
  category_id: string;
  name: string;
  category_name: string;
requires_sport: boolean;
};

type DiscoverySport = {
  id: string;
  name: string;
  slug?: string | null;
};

type DiscoveryLocation = {
  id: string;
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  district?: string | null;
  scope?: string | null;
};

type DiscoveryFilters = {
  categories:
    | DiscoveryCategory[]
    | null;
  activities:
    | DiscoveryActivity[]
    | null;
  sports:
    | DiscoverySport[]
    | null;
  locations:
    | DiscoveryLocation[]
    | null;
};

type DiscoverSearchParams =
  Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;

const PAGE_SIZE = 20;
const MAP_BATCH_LIMIT = 60;
const MAP_MAX_RESULTS = 240;
const ELIGIBILITY_SCAN_BATCH_SIZE = 60;

type DiscoverView = "cards" | "map" | "split";

const LIFECYCLE_OPTIONS = [
  {
    value: "current",
    label: "Açık, Gelecek ve Şekillenen",
  },
  {
    value: "open",
    label: "Şimdi açık",
  },
  {
    value: "future",
    label: "Gelecek etkinlikler",
  },
  {
    value: "forming",
    label: "Şekillenen etkinlikler",
  },
  {
    value: "planned",
    label: "Planlanmış etkinlikler",
  },
] as const;

const COMMUNITY_SCOPE_OPTIONS = [
  {
    value: "all",
    label: "Tüm Topluluklar",
  },
  {
    value: "following",
    label: "Takip Edilen Topluluklar",
  },
] as const;

const SCOPE_OPTIONS = [
  {
    value: "all",
    label: "Keşfet",
  },
  {
    value: "mine",
    label: "Düzenlediklerim",
  },
  {
    value: "joined",
    label: "Katıldıklarım",
  },
  {
    value: "invited",
    label: "Davetler",
  },
] as const;

type EligibilityFilter =
  | "eligible"
  | ParticipantEligibility
  | "all";

type IntentEligibilityContextRow = {
  intent_id: string;
  participant_eligibility: unknown;
  viewer_is_eligible: boolean;
};

const ELIGIBILITY_FILTERS: readonly EligibilityFilter[] = [
  "eligible",
  "everyone",
  "women_only",
  "men_only",
  "all",
];

function getParam(
  searchParams:
    Record<
      string,
      string |
      string[] |
      undefined
    >,
  key: string
) {
  const value =
    searchParams[key];

  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      ""
    );
  }

  return (
    value ??
    ""
  );
}

function getPageNumber(
  value: string
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isInteger(
      parsedValue
    ) ||
    parsedValue < 1
  ) {
    return 1;
  }

  return parsedValue;
}

function getLifecycle(
  value: string
) {
  return LIFECYCLE_OPTIONS.some(
    (option) =>
      option.value ===
      value
  )
    ? value
    : "current";
}

function getCommunityScope(
  value: string
) {
  return COMMUNITY_SCOPE_OPTIONS.some(
    (option) =>
      option.value === value
  )
    ? value
    : "all";
}

function getScope(
  value: string
) {
  return SCOPE_OPTIONS.some(
    (option) =>
      option.value ===
      value
  )
    ? value
    : "all";
}

function getDiscoverView(value: string): DiscoverView {
  return value === "map" || value === "split" ? value : "cards";
}

function getEligibilityFilter(
  value: string
): EligibilityFilter {
  return ELIGIBILITY_FILTERS.includes(
    value as EligibilityFilter
  )
    ? (value as EligibilityFilter)
    : "eligible";
}

function toCount(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function toKnownCount(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  ) && parsedValue >= 0
    ? parsedValue
    : null;
}

function matchesEligibilityFilter(
  intent: DiscoverIntentRow,
  eligibility: EligibilityFilter
) {
  if (eligibility === "all") {
    return true;
  }

  if (eligibility === "eligible") {
    return intent.viewer_is_eligible === true;
  }

  return intent.participant_eligibility === eligibility;
}

function isActiveDiscoverResult(intent: DiscoverIntentRow) {
  return (
    ["open", "future", "forming", "planned"].includes(
      intent.lifecycle_status
    ) &&
    intent.intent_status !== "completed" &&
    intent.intent_status !== "cancelled" &&
    intent.lifecycle_status !== "completed" &&
    !intent.completed_at &&
    !intent.cancelled_at &&
    !intent.expired_at
  );
}

function buildDiscoverHref({
  query,
  categoryId,
  activityId,
  sportId,
  communityId,
  communityScope,
  locationId,
  startDate,
  endDate,
  lifecycle,
  scope,
  eligibility,
  view,
  page,
}: {
  query: string;
  categoryId: string;
  activityId: string;
  sportId: string;
  communityId: string;
  communityScope: string;
  locationId: string;
  startDate: string;
  endDate: string;
  lifecycle: string;
  scope: string;
  eligibility: EligibilityFilter;
  view: DiscoverView;
  page: number;
}) {
  const params =
    new URLSearchParams();

  if (query) {
    params.set(
      "q",
      query
    );
  }

  if (categoryId) {
    params.set(
      "category",
      categoryId
    );
  }

  if (activityId) {
    params.set(
      "activity",
      activityId
    );
  }

  if (sportId) {
    params.set(
      "sport",
      sportId
    );
  }

  if (communityId) {
    params.set(
      "community",
      communityId
    );
  }

  if (
    communityScope ===
    "following"
  ) {
    params.set(
      "community_scope",
      "following"
    );
  }

  if (locationId) {
    params.set(
      "location",
      locationId
    );
  }

  if (startDate) {
    params.set(
      "start",
      startDate
    );
  }

  if (endDate) {
    params.set(
      "end",
      endDate
    );
  }

  if (
    lifecycle !==
    "current"
  ) {
    params.set(
      "lifecycle",
      lifecycle
    );
  }

  if (
    scope !==
    "all"
  ) {
    params.set(
      "scope",
      scope
    );
  }

  if (
    eligibility !==
    "eligible"
  ) {
    params.set(
      "eligibility",
      eligibility
    );
  }

  if (view !== "cards") {
    params.set("view", view);
  }

  if (page > 1 && view === "cards") {
    params.set(
      "page",
      String(page)
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/discover?${queryString}`
    : "/discover";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams:
    DiscoverSearchParams;
}) {
  const resolvedSearchParams =
    await searchParams;

  const query =
    getParam(
      resolvedSearchParams,
      "q"
    ).trim();

  const kind = "social" as const;

  const categoryId =
    getParam(
      resolvedSearchParams,
      "category"
    );

  const activityId =
    getParam(
      resolvedSearchParams,
      "activity"
    );

  const sportId =
    getParam(
      resolvedSearchParams,
      "sport"
    );

  const communityId = "";
  const communityScope = getCommunityScope("");

  const locationId =
    getParam(
      resolvedSearchParams,
      "location"
    );

  const startDate =
    getParam(
      resolvedSearchParams,
      "start"
    );

  const endDate =
    getParam(
      resolvedSearchParams,
      "end"
    );

  const lifecycle =
    getLifecycle(
      getParam(
        resolvedSearchParams,
        "lifecycle"
      )
    );

  const scope =
    getScope(
      getParam(
        resolvedSearchParams,
        "scope"
      )
    );

  const eligibility =
    getEligibilityFilter(
      getParam(
        resolvedSearchParams,
        "eligibility"
      )
    );

  const view = getDiscoverView(
    getParam(resolvedSearchParams, "view")
  );

  const page =
    getPageNumber(
      getParam(
        resolvedSearchParams,
        "page"
      )
    );

  const needsEligibilityScan =
    view === "cards" &&
    eligibility !== "all";
  const resultLimit = view === "cards"
    ? needsEligibilityScan
      ? ELIGIBILITY_SCAN_BATCH_SIZE
      : PAGE_SIZE
    : MAP_BATCH_LIMIT;
  const resultOffset =
    view === "cards" && !needsEligibilityScan
      ? (page - 1) * PAGE_SIZE
      : 0;

  const hasAdvancedSearch =
    Boolean(
      query ||
      categoryId ||
      activityId ||
      sportId ||
      communityId ||
      communityScope ===
        "following" ||
      locationId ||
      startDate ||
      endDate ||
      eligibility !==
        "eligible"
    );

  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Discover session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Etkinlikler şu anda yüklenemedi"
        retryHref="/discover"
        backHref="/timeline"
        backLabel="Ana sayfaya dön"
      />
    );
  }

  if (!user) {
    redirect("/");
  }
  const viewerId = user.id;

  function runDiscoverSearch(limit: number, offset: number, lifecycleOverride?: string) {
    const requestedLifecycle = lifecycleOverride ?? lifecycle;
    if (communityId) {
      return supabase.rpc("search_visible_intents_by_community", {
        p_community_id: communityId,
        p_query: query || null,
        p_category_id: categoryId || null,
        p_activity_id: activityId || null,
        p_sport_id: sportId || null,
        p_location_id: locationId || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_lifecycle: requestedLifecycle,
        p_scope: scope,
        p_limit: limit,
        p_offset: offset,
      });
    }

    if (communityScope === "following") {
      return supabase.rpc("search_visible_intents_followed_communities", {
        p_query: query || null,
        p_category_id: categoryId || null,
        p_activity_id: activityId || null,
        p_sport_id: sportId || null,
        p_location_id: locationId || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_lifecycle: requestedLifecycle,
        p_scope: scope,
        p_limit: limit,
        p_offset: offset,
      });
    }

    return supabase.rpc("search_visible_intents", {
      p_query: query || null,
      p_category_id: categoryId || null,
      p_activity_id: activityId || null,
      p_sport_id: sportId || null,
      p_location_id: locationId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_lifecycle: requestedLifecycle,
      p_scope: scope,
      p_limit: limit,
      p_offset: offset,
    });
  }

  const [
    filterResponse,
    communityResponse,
    followedCommunityResponse,
    searchResponse,
    archiveResponse,
  ] =
    await Promise.all([
      supabase.rpc(
        "get_intent_discovery_filters"
      ),

      Promise.resolve({ data: [], error: null }),

      Promise.resolve({ data: [], error: null }),

      runDiscoverSearch(resultLimit, resultOffset),
      view === "cards"
        ? runDiscoverSearch(80, 0, "history")
        : Promise.resolve({ data: [], error: null }),
    ]);

  const rawFilterPayload = filterResponse.data as unknown;
  const filterReadError: DiscoverReadError | null = filterResponse.error ??
    (!rawFilterPayload || typeof rawFilterPayload !== "object" || Array.isArray(rawFilterPayload) ||
      !Array.isArray((rawFilterPayload as DiscoveryFilters).categories) ||
      !Array.isArray((rawFilterPayload as DiscoveryFilters).activities) ||
      !Array.isArray((rawFilterPayload as DiscoveryFilters).sports) ||
      !Array.isArray((rawFilterPayload as DiscoveryFilters).locations)
      ? { message: "Keşif filtreleri eksik veya bozuk döndü. Lütfen yeniden dene." }
      : null);
  const searchReadError = getRowsetReadError(
    searchResponse.data,
    searchResponse.error,
    "Etkinlik arama sonuçları"
  );
  const archiveReadError = getRowsetReadError(
    archiveResponse.data,
    archiveResponse.error,
    "Etkinlik arşivi"
  );

  if (filterReadError) {
    console.error(
      "Intent discovery filters failed:",
      filterReadError
    );
  }

  if (
    communityResponse.error
  ) {
    console.error(
      "Community discovery catalogue failed:",
      communityResponse.error
    );
  }

  if (
    followedCommunityResponse.error
  ) {
    console.error(
      "Followed Community quick filter query failed:",
      followedCommunityResponse.error
    );
  }

  if (searchReadError) {
    console.error(
      "Intent discovery search failed:",
      searchReadError
    );
  }

  if (archiveReadError) {
    console.warn("Etkinlik arşivi yüklenemedi:", archiveReadError.message);
  }

  let mapBatchError: { message?: string } | null = null;
  const searchRows = searchReadError
    ? []
    : [...(searchResponse.data as DiscoverIntentRow[])];

  if (view !== "cards" && !searchReadError && searchRows.length > 0) {
    const totalAvailable = toCount(searchRows[0]?.total_count);
    const maximumToLoad = Math.min(totalAvailable, MAP_MAX_RESULTS);

    for (let offset = MAP_BATCH_LIMIT; offset < maximumToLoad; offset += MAP_BATCH_LIMIT) {
      const batchResponse = await runDiscoverSearch(MAP_BATCH_LIMIT, offset);

      const batchReadError = getRowsetReadError(
        batchResponse.data,
        batchResponse.error,
        "Harita etkinlik sonuçları"
      );
      if (batchReadError) {
        console.error("Discover map batch query failed:", batchReadError);
        mapBatchError = batchReadError;
        break;
      }

      searchRows.push(...(batchResponse.data as DiscoverIntentRow[]));
    }
  }

  const archivedResults = Array.from(
    new Map(
      (archiveReadError ? [] : archiveResponse.data as DiscoverIntentRow[])
        .filter((intent) => intent.lifecycle_status === "cancelled" || intent.lifecycle_status === "expired")
        .map((intent) => [intent.intent_id, intent])
    ).values()
  );

  const filters =
    (
      filterReadError ? {
        categories: [],
        activities: [],
        sports: [],
        locations: [],
      } : filterResponse.data
    ) as DiscoveryFilters;

  const categories =
    filters.categories ??
    [];

  const activities =
    filters.activities ??
    [];

  const sports =
    filters.sports ??
    [];

  const locations =
    filters.locations ??
    [];

  const communities:
    CommunityOption[] =
    parseCommunityOptions(
      communityResponse.data
    );

  const followedCommunities:
    CommunityOption[] =
    parseCommunityOptions(
      followedCommunityResponse.data
    );

  const selectedSport =
    sports.find(
      (sport) =>
        sport.id ===
        sportId
    ) ?? null;

  const selectedCommunity =
    communities.find(
      (community) =>
        community.id ===
        communityId
    ) ??
    followedCommunities.find(
      (community) =>
        community.id ===
        communityId
    ) ??
    null;

  const rawResultByIntentId = new Map(
    searchRows.map((row) => [row.intent_id, row])
  );
  const enrichedResultByIntentId = new Map<string, DiscoverIntentRow>();
  let eligibilityScanError: { message?: string } | null = null;
  let rawSearchTotal = toKnownCount(searchRows[0]?.total_count);

  if (
    rawSearchTotal === null &&
    resultOffset === 0 &&
    !searchReadError &&
    searchRows.length === 0
  ) {
    rawSearchTotal = 0;
  }

  let rawRowsScanned = searchRows.length;
  let rawSearchExhausted =
    !searchReadError &&
    (searchRows.length < resultLimit ||
      (rawSearchTotal !== null && rawRowsScanned >= rawSearchTotal));

  async function enrichEligibilityRows(rows: DiscoverIntentRow[]) {
    const intentIds = Array.from(
      new Set(rows.map((intent) => intent.intent_id))
    );
    const response = intentIds.length > 0
      ? await supabase.rpc(
          "get_visible_intent_participant_eligibility",
          { p_intent_ids: intentIds }
        )
      : { data: [], error: null };

    if (response.error) {
      return {
        data: [] as DiscoverIntentRow[],
        error: response.error,
      };
    }

    const eligibilityByIntentId = new Map(
      ((response.data ?? []) as IntentEligibilityContextRow[]).map((row) => [
        row.intent_id,
        {
          participantEligibility: normalizeParticipantEligibility(
            row.participant_eligibility
          ),
          viewerIsEligible: row.viewer_is_eligible === true,
        },
      ])
    );
    const missingEligibility = intentIds.some(
      (intentId) => !eligibilityByIntentId.has(intentId)
    );

    if (missingEligibility) {
      return {
        data: [] as DiscoverIntentRow[],
        error: {
          message: "Bazı etkinliklerin katılım uygunluğu doğrulanamadı. Lütfen yeniden dene.",
        },
      };
    }

    return {
      data: rows.map((intent) => {
        const context = eligibilityByIntentId.get(intent.intent_id);

        return {
          ...intent,
          participant_eligibility:
            context?.participantEligibility ??
            normalizeParticipantEligibility(intent.participant_eligibility),
          viewer_is_eligible:
            context?.viewerIsEligible ??
            intent.viewer_is_member ??
            false,
        };
      }),
      error: null,
    };
  }

  function getMatchingResults() {
    return Array.from(enrichedResultByIntentId.values())
      .filter((intent) => matchesEligibilityFilter(intent, eligibility))
      .filter((intent) => {
        if (scope === "mine") {
          return intent.owner_user_id === viewerId;
        }

        if (scope === "joined") {
          return (
            intent.viewer_is_member === true &&
            intent.owner_user_id !== viewerId
          );
        }

        if (scope === "invited") {
          return intent.viewer_invitation_status === "pending";
        }

        return true;
      })
      .filter(isActiveDiscoverResult);
  }

  const initialEligibilityResult = await enrichEligibilityRows(
    Array.from(rawResultByIntentId.values())
  );

  if (initialEligibilityResult.error) {
    eligibilityScanError = initialEligibilityResult.error;
  } else {
    for (const intent of initialEligibilityResult.data) {
      enrichedResultByIntentId.set(intent.intent_id, intent);
    }
  }

  let matchingResults = getMatchingResults();
  const eligibilityLookaheadTarget = page * PAGE_SIZE + 1;

  while (
    needsEligibilityScan &&
    !eligibilityScanError &&
    !rawSearchExhausted &&
    matchingResults.length < eligibilityLookaheadTarget
  ) {
    const batchResponse = await runDiscoverSearch(
      ELIGIBILITY_SCAN_BATCH_SIZE,
      rawRowsScanned
    );

    const batchReadError = getRowsetReadError(
      batchResponse.data,
      batchResponse.error,
      "Uygunluk taraması sonuçları"
    );
    if (batchReadError) {
      eligibilityScanError = batchReadError;
      break;
    }

    const batchRows = batchResponse.data as DiscoverIntentRow[];
    if (batchRows.length === 0) {
      rawSearchExhausted = true;
      break;
    }

    rawRowsScanned += batchRows.length;
    rawSearchTotal =
      rawSearchTotal ??
      toKnownCount(batchRows[0]?.total_count);
    rawSearchExhausted =
      batchRows.length < ELIGIBILITY_SCAN_BATCH_SIZE ||
      (rawSearchTotal !== null && rawRowsScanned >= rawSearchTotal);

    const uniqueBatchRows = batchRows.filter(
      (intent) => !rawResultByIntentId.has(intent.intent_id)
    );
    for (const intent of uniqueBatchRows) {
      rawResultByIntentId.set(intent.intent_id, intent);
    }

    const batchEligibilityResult = await enrichEligibilityRows(uniqueBatchRows);
    if (batchEligibilityResult.error) {
      eligibilityScanError = batchEligibilityResult.error;
      break;
    }

    for (const intent of batchEligibilityResult.data) {
      enrichedResultByIntentId.set(intent.intent_id, intent);
    }
    matchingResults = getMatchingResults();
  }

  if (eligibilityScanError) {
    console.error(
      "Intent participant eligibility scan failed:",
      eligibilityScanError
    );
  }

  const eligibilityPageStart = (page - 1) * PAGE_SIZE;
  if (
    needsEligibilityScan &&
    rawSearchExhausted &&
    !eligibilityScanError &&
    page > 1 &&
    eligibilityPageStart >= matchingResults.length
  ) {
    const lastPage = Math.max(
      Math.ceil(matchingResults.length / PAGE_SIZE),
      1
    );
    redirect(
      buildDiscoverHref({
        query,
        categoryId,
        activityId,
        sportId,
        communityId,
        communityScope,
        locationId,
        startDate,
        endDate,
        lifecycle,
        scope,
        eligibility,
        view,
        page: lastPage,
      })
    );
  }

  const hasEligibilityLookahead =
    needsEligibilityScan &&
    matchingResults.length > page * PAGE_SIZE;
  const eligibleResults = needsEligibilityScan
    ? matchingResults.slice(
        eligibilityPageStart,
        eligibilityPageStart + PAGE_SIZE
      )
    : matchingResults;
  const rawResults = Array.from(rawResultByIntentId.values());

  const visibleIntentIds =
    Array.from(
      new Set(
        eligibleResults.map(
          (intent) =>
            intent.intent_id
        )
      )
    );

  const selectedScopeTotal = eligibility === "all"
    ? rawSearchTotal
    : rawSearchExhausted && !eligibilityScanError
      ? matchingResults.length
      : null;
  const scopeCounts = {
    all: scope === "all" ? selectedScopeTotal : null,
    mine: scope === "mine" ? selectedScopeTotal : null,
    joined: scope === "joined" ? selectedScopeTotal : null,
    invited: scope === "invited" ? selectedScopeTotal : null,
  };

  const commonTargetIntentIds = Array.from(
    new Set([
      ...visibleIntentIds,
      ...archivedResults.map((intent) => intent.intent_id),
    ])
  );

  const visiblePlanIds =
    Array.from(
      new Set(
        eligibleResults
          .map(
            (intent) =>
              intent.plan_id
          )
          .filter(
            (planId):
              planId is string =>
                Boolean(planId)
          )
      )
    );

  const visibleResourceIds = Array.from(
    new Set(
      eligibleResults.map((intent) =>
        intent.plan_id ?? intent.resource_id ?? intent.intent_id
      )
    )
  );

  async function loadEventDisplayTitles() {
    const eventDisplayTitleByIntentId = new Map<string, string | null>();
    let fallbackError: DiscoverReadError | null = null;
    const presentationBatches = Array.from(
      { length: Math.ceil(commonTargetIntentIds.length / 100) },
      (_, index) => commonTargetIntentIds.slice(index * 100, (index + 1) * 100)
    );
    const presentationBatchResponses = await Promise.all(
      presentationBatches.map((resourceIds) =>
        supabase.rpc("get_uin_event_presentations_v150", {
          p_resource_ids: resourceIds,
        })
      )
    );

    for (let index = 0; index < presentationBatchResponses.length; index += 1) {
      const response = presentationBatchResponses[index];
      const resourceIds = presentationBatches[index] ?? [];
      const rowsetError = getRowsetReadError(
        response.data,
        response.error,
        "Etkinlik kartı sunumları"
      );
      const batchReadError = rowsetError ??
        ((response.data as unknown[]).some((value) => {
          const row = value as { resource_id?: unknown; presentation?: unknown };
          return typeof row.resource_id !== "string" || !row.resource_id.trim() ||
            (row.presentation !== null &&
              (typeof row.presentation !== "object" || Array.isArray(row.presentation)));
        })
          ? { message: "Etkinlik kartı sunumları eksik veya bozuk döndü. Lütfen yeniden dene." }
          : null);

      if (batchReadError) {
        console.warn(
          "Canonical event presentation batch is temporarily unavailable; using the exact fallback:",
          batchReadError.message
        );
        const fallbackResponses = await Promise.all(
          resourceIds.map(async (intentId) => ({
            intentId,
            result: await supabase.rpc("get_uin_event_presentation_v86", {
              p_resource_id: intentId,
            }),
          }))
        );
        for (const { intentId, result } of fallbackResponses) {
          if (result.error) {
            fallbackError ??= result.error;
            continue;
          }
          if (result.data !== null &&
              (typeof result.data !== "object" || Array.isArray(result.data))) {
            fallbackError ??= {
              message: "Etkinlik kartı sunumu doğrulanamadı. Lütfen yeniden dene.",
            };
            continue;
          }
          const displayTitle =
            result.data && typeof result.data === "object" && !Array.isArray(result.data)
              ? (result.data as { displayTitle?: unknown }).displayTitle
              : null;
          eventDisplayTitleByIntentId.set(
            intentId,
            typeof displayTitle === "string" ? displayTitle : null
          );
        }
        continue;
      }

      for (const row of response.data as Array<{
        resource_id: string;
        presentation: { displayTitle?: unknown } | null;
      }>) {
        const displayTitle = row.presentation?.displayTitle;
        eventDisplayTitleByIntentId.set(
          row.resource_id,
          typeof displayTitle === "string" ? displayTitle : null
        );
      }
    }

    return { titles: eventDisplayTitleByIntentId, error: fallbackError };
  }

  async function loadPrivatePresentations() {
    const response = visiblePlanIds.length > 0
      ? await supabase.rpc(
          "get_visible_plan_presentations",
          { p_plan_ids: visiblePlanIds }
        )
      : { data: [], error: null };
    const error = getRowsetReadError(
      response.data,
      response.error,
      "Özel etkinlik sunumları"
    );
    const presentations = error
      ? []
      : await hydrateVisiblePlanPresentations(
          supabase,
          response.data as VisiblePlanPresentationRow[]
        );
    const hydrationError = presentations.some((presentation) =>
      (presentation.custom_cover_storage_path &&
        !presentation.signed_custom_cover_url &&
        !presentation.custom_cover_external_url) ||
      (presentation.experience_cover_storage_path &&
        !presentation.signed_experience_cover_url)
    )
      ? { message: "Bazı özel etkinlik kapakları doğrulanamadı. Lütfen yeniden dene." }
      : null;

    return { error: error ?? hydrationError, presentations };
  }

  async function loadPublicExperienceCovers() {
    const response = visiblePlanIds.length > 0
      ? await supabase.rpc(
          "get_visible_public_experience_covers",
          { p_plan_ids: visiblePlanIds }
        )
      : { data: [], error: null };
    const readError = getRowsetReadError(
      response.data,
      response.error,
      "Herkese açık deneyim kapakları"
    );

    if (readError) {
      return {
        covers: [] as PublicExperienceCover[],
        error: readError,
      };
    }

    const coverRows = response.data as PublicExperienceCoverRow[];
    const storagePaths = Array.from(
      new Set(
        coverRows
          .filter((cover) => !cover.external_url)
          .map((cover) => cover.storage_path)
          .filter((path): path is string => Boolean(path))
      )
    );
    const signedUrlByPath = new Map<string, string>();
    let signingError: DiscoverReadError | null = null;

    if (storagePaths.length > 0) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("experience-media")
        .createSignedUrls(storagePaths, 60 * 60);

      if (signedError) {
        console.error("Public Discover cover signing failed:", signedError);
        signingError = signedError;
      } else {
        for (const item of signedData ?? []) {
          if (item.error) {
            console.error("Public Discover cover path signing failed:", item.error);
            signingError ??= { message: String(item.error) };
            continue;
          }

          if (item.path && item.signedUrl) {
            signedUrlByPath.set(item.path, item.signedUrl);
          }
        }

        if (storagePaths.some((path) => !signedUrlByPath.has(path))) {
          signingError ??= {
            message: "Bazı deneyim kapakları imzalanamadı. Lütfen yeniden dene.",
          };
        }
      }
    }

    return {
      covers: coverRows.map((cover): PublicExperienceCover => ({
        ...cover,
        signed_url:
          cover.external_url ||
          (cover.storage_path
            ? signedUrlByPath.get(cover.storage_path) ?? null
            : null),
      })),
      error: signingError,
    };
  }

  async function loadPublicPlanContent() {
    const reads = await Promise.all(
      visiblePlanIds.map(async (planId) => {
        const { data, error } = await supabase.rpc(
          "get_visible_plan_public_content",
          { p_plan_id: planId }
        );

        return {
          planId,
          content: error ? null : (data as VisiblePlanPublicContent | null),
          error,
        };
      })
    );

    return {
      entries: reads.map(({ planId, content }) => [planId, content] as const),
      error: reads.find((read) => read.error)?.error ?? null,
    };
  }

  const [
    intentCommonTargetResponse,
    eventPresentationLoad,
    reactionContextResponse,
    intentCardNoteResponse,
    discoverMapContextResponse,
    sportCoverContextResponse,
    activityPeopleResponse,
    viewerLineageResponse,
    privatePresentationLoad,
    publicExperienceCoverLoad,
    publicActivityLocationResponse,
    publicPlanContentLoad,
    intentLinksResponse,
  ] = await Promise.all([
    commonTargetIntentIds.length > 0
      ? supabase.rpc("get_visible_intent_common_targets_v40", {
          p_intent_ids: commonTargetIntentIds,
        })
      : Promise.resolve({ data: [], error: null }),
    loadEventDisplayTitles(),
    visibleIntentIds.length > 0
      ? supabase.rpc("get_visible_intent_reaction_context", {
          p_intent_ids: visibleIntentIds,
        })
      : Promise.resolve({ data: [], error: null }),
    visibleIntentIds.length > 0
      ? supabase.rpc("get_visible_intent_card_notes", {
          p_intent_ids: visibleIntentIds,
        })
      : Promise.resolve({ data: [], error: null }),
    visibleIntentIds.length > 0
      ? supabase.rpc("get_visible_discover_map_points", {
          p_intent_ids: visibleIntentIds,
        })
      : Promise.resolve({ data: [], error: null }),
    visibleIntentIds.length > 0
      ? supabase.rpc("get_intent_sport_cover_context", {
          p_intent_ids: visibleIntentIds,
        })
      : Promise.resolve({ data: [], error: null }),
    visibleResourceIds.length > 0
      ? supabase.rpc("get_visible_activity_people_batch", {
          p_resource_ids: visibleResourceIds,
        })
      : Promise.resolve({ data: [], error: null }),
    visiblePlanIds.length > 0
      ? supabase.rpc("get_my_visible_plan_lineage", {
          p_plan_ids: visiblePlanIds,
        })
      : Promise.resolve({ data: [], error: null }),
    loadPrivatePresentations(),
    loadPublicExperienceCovers(),
    visiblePlanIds.length > 0
      ? supabase.rpc("get_visible_public_plan_activity_locations", {
          p_plan_ids: visiblePlanIds,
        })
      : Promise.resolve({ data: [], error: null }),
    loadPublicPlanContent(),
    visibleIntentIds.length > 0
      ? supabase.rpc("get_visible_intent_links", {
          p_intent_ids: visibleIntentIds,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const eventDisplayTitleByIntentId = eventPresentationLoad.titles;

  const intentCommonTargetError = getRowsetReadError(
    intentCommonTargetResponse.data,
    intentCommonTargetResponse.error,
    "Ortak kart bağlantıları"
  );
  const reactionContextError = getRowsetReadError(
    reactionContextResponse.data,
    reactionContextResponse.error,
    "Etkinlik tepkileri"
  );
  const intentCardNoteError = getRowsetReadError(
    intentCardNoteResponse.data,
    intentCardNoteResponse.error,
    "Etkinlik kart notları"
  );
  const discoverMapContextError = getRowsetReadError(
    discoverMapContextResponse.data,
    discoverMapContextResponse.error,
    "Etkinlik harita bilgileri"
  );
  const sportCoverContextError = getRowsetReadError(
    sportCoverContextResponse.data,
    sportCoverContextResponse.error,
    "Spor etkinliği kapak bilgileri"
  );
  const activityPeopleError = getRowsetReadError(
    activityPeopleResponse.data,
    activityPeopleResponse.error,
    "Etkinlik kişi bilgileri"
  );
  const viewerLineageError = getRowsetReadError(
    viewerLineageResponse.data,
    viewerLineageResponse.error,
    "Etkinlik kaynak bilgileri"
  );
  const publicActivityLocationError = getRowsetReadError(
    publicActivityLocationResponse.data,
    publicActivityLocationResponse.error,
    "Etkinlik konum bilgileri"
  );
  const intentLinksError = getRowsetReadError(
    intentLinksResponse.data,
    intentLinksResponse.error,
    "Etkinlik bağlantıları"
  );

  const discoverEnrichmentError =
    intentCommonTargetError ??
    eventPresentationLoad.error ??
    reactionContextError ??
    intentCardNoteError ??
    discoverMapContextError ??
    sportCoverContextError ??
    activityPeopleError ??
    viewerLineageError ??
    privatePresentationLoad.error ??
    publicExperienceCoverLoad.error ??
    publicActivityLocationError ??
    publicPlanContentLoad.error ??
    intentLinksError;

  if (discoverEnrichmentError) {
    console.error(
      "Discover enrichment could not be loaded completely:",
      discoverEnrichmentError.message
    );
  }

  const commonTargetByIntentId = new Map(
    ((intentCommonTargetResponse.data ?? []) as IntentCommonTargetRow[]).map((row) => [
      row.intent_id,
      {
        id: row.canonical_target_id,
        title: row.canonical_target_title,
      },
    ])
  );

  const reactionContextByIntentId = new Map(
    parseIntentReactionContexts(reactionContextResponse.data).map((context) => [
      context.intent_id,
      context,
    ])
  );

  const results = eligibleResults.map((intent) => ({
    ...intent,
    reaction_context:
      reactionContextByIntentId.get(intent.intent_id) ?? null,
  }));
  const mixedDiscoverItems: Array<
    {
        kind: "social";
        key: string;
        item: (typeof results)[number];
      }
  > = [];

  const mixedDiscoverLength = results.length;

  for (let index = 0; index < mixedDiscoverLength; index += 1) {
    if (results[index]) {
      mixedDiscoverItems.push({
        kind: "social",
        key: `social-${results[index].intent_id}`,
        item: results[index],
      });
    }
  }

  const intentNoteByIntentId = new Map(
    ((intentCardNoteResponse.data ?? []) as IntentCardNoteRow[]).map((row) => [
      row.intent_id,
      row.notes,
    ])
  );

  const discoverMapContextByIntentId = new Map(
    ((discoverMapContextResponse.data ?? []) as DiscoverMapPointContextRow[]).map((row) => [
      row.intent_id,
      row,
    ])
  );

  const sportCoverContextByIntentId =
    new Map<string, IntentSportCoverContext>(
      ((sportCoverContextResponse.data ?? []) as IntentSportCoverContext[]).map(
        (context) => [context.intent_id, context]
      )
    );

  const activityPeopleByResourceId = groupActivityPeopleByResourceId(
    (activityPeopleResponse.data ?? []) as ActivityPeopleBatchRow[]
  );

  const viewerLineageByPlanId = new Map<string, ViewerPlanLineage>();

  ((viewerLineageResponse.data ?? []) as ViewerPlanLineageRow[]).forEach(
    (row) => {
      if (!row.source_intent_id) return;

      viewerLineageByPlanId.set(row.plan_id, {
        sourceCount: toCount(row.source_count),
        sourceIntentId: row.source_intent_id,
        sourceIntentName: row.source_activity_name,
        sourceIntentHref: `/activities/${encodeURIComponent(
          row.source_intent_id
        )}`,
      });
    }
  );

  const privatePresentationByPlanId =
    new Map<string, VisiblePlanPresentation>(
      privatePresentationLoad.presentations.map(
        (presentation) => [presentation.plan_id, presentation]
      )
    );

  const publicExperienceCoverByPlanId = new Map(
    publicExperienceCoverLoad.covers.map((cover) => [cover.plan_id, cover])
  );

  const publicActivityLocationByPlanId =
    new Map(
      ((publicActivityLocationResponse.data ?? []) as PublicPlanActivityLocationRow[]).map(
        (row) => [row.plan_id, row.activity_location_name]
      )
    );

  const publicMeetingPointByPlanId = new Map(
    publicPlanContentLoad.entries.map(([planId, content]) => [
      planId,
      typeof content?.meeting_point === "string" ? content.meeting_point.trim() || null : null,
    ])
  );

  const intentLinkRows = intentLinksError
    ? []
    : (intentLinksResponse.data ?? []) as IntentLinkRpcRow[];

  const intentCommunityRows:
    ReturnType<
      typeof parseIntentCommunityRows
    > = [];

  const intentLinksByIntentId =
    groupIntentLinksByIntentId(
      parseIntentLinkRows(
        intentLinkRows
      )
    );

  const intentCommunitiesByIntentId =
    new Map<string, typeof intentCommunityRows>();

  intentCommunityRows.forEach(
    (community) => {
      const current =
        intentCommunitiesByIntentId.get(
          community.intentId
        ) ?? [];

      current.push(community);
      current.sort(
        (left, right) =>
          left.position - right.position
      );

      intentCommunitiesByIntentId.set(
        community.intentId,
        current
      );
    }
  );

  const totalCount =
    selectedScopeTotal;

  const visibleResultCount =
    results.length;

  const totalPages = totalCount === null
    ? null
    : Math.max(
        Math.ceil(totalCount / PAGE_SIZE),
        1
      );

  const hasPrevious =
    page > 1;

  const hasNext = needsEligibilityScan
    ? hasEligibilityLookahead
    : totalPages !== null && page < totalPages;

  const lifecycleLabel =
    LIFECYCLE_OPTIONS.find(
      (option) =>
        option.value ===
        lifecycle
    )?.label ??
    "Tüm aşamalar";

  const mapPoints: DiscoverMapPoint[] = view === "cards"
    ? []
    : results.map((intent) => {
        const mapContext = discoverMapContextByIntentId.get(intent.intent_id);
        const privatePresentation = intent.plan_id
          ? privatePresentationByPlanId.get(intent.plan_id) ?? null
          : null;
        const communitiesForIntent =
          intentCommunitiesByIntentId.get(intent.intent_id) ?? [];
        const contextCover =
          sportCoverContextByIntentId.get(intent.intent_id)?.context_cover_url ?? null;
        const publicCover = intent.plan_id
          ? publicExperienceCoverByPlanId.get(intent.plan_id)?.signed_url ?? null
          : null;
        const privateCoverUrl =
          privatePresentation?.signed_experience_cover_url ||
          publicCover ||
          privatePresentation?.visible_cover_url ||
          null;
        const coverUrl =
          privateCoverUrl ||
          contextCover ||
          intent.activity_cover_url ||
          intent.category_cover_url ||
          null;
        const latitude = mapContext?.latitude == null ? null : Number(mapContext.latitude);
        const longitude = mapContext?.longitude == null ? null : Number(mapContext.longitude);

        return {
          intentId: intent.intent_id,
          planId: intent.plan_id,
          resourceHref: `/activities/${encodeURIComponent(
            intent.plan_id ?? intent.resource_id ?? intent.intent_id
          )}`,
          title: eventDisplayTitleByIntentId.get(intent.intent_id) || intent.activity_name,
          activityName: intent.activity_name,
          categoryName: intent.category_name,
          lifecycle: intent.lifecycle_status,
          city: intent.city,
          district: intent.district,
          publicLocationName:
            mapContext?.public_location_name ||
            (intent.plan_id
              ? publicActivityLocationByPlanId.get(intent.plan_id) ?? null
              : null),
          locationPrecision: mapContext?.location_precision ?? "approximate",
          locationQuery:
            mapContext?.location_query?.trim() ||
            [intent.district, intent.city, "Türkiye"].filter(Boolean).join(", "),
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          startDate: intent.start_date,
          endDate: intent.end_date,
          coverUrl,
          sportName:
            sportCoverContextByIntentId.get(intent.intent_id)?.sport_name ||
            intent.sport_name ||
            null,
          communityNames:
            communitiesForIntent.length > 0
              ? communitiesForIntent.map((community) => community.name)
              : sportCoverContextByIntentId.get(intent.intent_id)?.primary_community_name
                ? [sportCoverContextByIntentId.get(intent.intent_id)!.primary_community_name!]
                : [],
          participantCount: toCount(intent.active_participant_count),
          maxParticipants: intent.max_participants,
          viewerCanRequest: intent.viewer_can_request,
          viewerIsMember: intent.viewer_is_member,
          cardIntent: intent,
          cardDisplayTitle:
            eventDisplayTitleByIntentId.get(intent.intent_id) ?? null,
          cardPrivateCoverUrl: privateCoverUrl,
          cardContextCoverUrl: contextCover,
          cardPublicActivityLocationName:
            intent.plan_id
              ? publicActivityLocationByPlanId.get(intent.plan_id) ?? null
              : null,
          cardCommunities: communitiesForIntent,
          cardRelatedLinks:
            intentLinksByIntentId.get(intent.intent_id) ?? [],
          cardActivityPeople:
            activityPeopleByResourceId.get(
              intent.plan_id ?? intent.resource_id ?? intent.intent_id
            ) ?? [],
          cardViewerLineage:
            intent.plan_id
              ? viewerLineageByPlanId.get(intent.plan_id) ?? null
              : null,
        };
      });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      <div className="relative z-[60] mx-auto mb-8 max-w-[1320px]"><AppNavigation /></div>
      <div className="mx-auto max-w-[1320px]">
        <DiscoverQuickFilters lifecycle={lifecycle} scope={scope} communityScope={communityScope} communityId={communityId} followedCommunities={followedCommunities.map(community=>({id:community.id,name:community.name}))} lifecycleOptions={LIFECYCLE_OPTIONS} scopeOptions={SCOPE_OPTIONS} communityScopeOptions={COMMUNITY_SCOPE_OPTIONS} counts={scopeCounts}/>

        <form action="/discover" method="get" className="mt-4 flex gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <span className="grid w-10 shrink-0 place-items-center text-xl text-gray-400" aria-hidden="true">⌕</span>
          <input name="q" type="search" defaultValue={query} placeholder="Etkinlik, kişi veya konum ara" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-gray-950 outline-none placeholder:text-gray-400" />
          <button type="submit" className="rounded-xl bg-green-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-green-700">Ara</button>
        </form>

        {!filterReadError && (
          <DiscoverFiltersForm
            kind={kind}
            query={query}
            categoryId={categoryId}
            activityId={activityId}
            sportId={sportId}
            communityId={communityId}
            communityScope={communityScope}
            locationId={locationId}
            startDate={startDate}
            endDate={endDate}
            lifecycle={lifecycle}
            scope={scope}
            eligibility={eligibility}
            view={view}
            categories={categories}
            activities={activities}
            sports={sports}
            communities={communities}
            locations={locations}
          />
        )}

        {(filterReadError ||
          searchReadError ||
          eligibilityScanError ||
          discoverEnrichmentError ||
          mapBatchError) && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Intent discovery could not
              be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {searchReadError?.message ??
                eligibilityScanError?.message ??
                discoverEnrichmentError?.message ??
                mapBatchError?.message ??
                filterReadError?.message}
            </p>
          </section>
        )}

        {(!filterReadError &&
              !searchReadError &&
              !eligibilityScanError &&
              !discoverEnrichmentError &&
              !mapBatchError) && (
          <>
            <section className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  {selectedCommunity
                    ? `${selectedCommunity.name} Topluluğu`
                    : selectedSport
                      ? selectedSport.name
                      : hasAdvancedSearch
                      ? "Arama sonuçları"
                      : lifecycleLabel}
                </p>

                <h2 className="mt-1 text-2xl font-bold text-gray-950">
                  Etkinlikleri Keşfet
                </h2>

                <p className="mt-1 text-sm font-semibold text-gray-500">
                  {view === "cards"
                    ? mixedDiscoverItems.length
                    : results.length}{" "}
                  etkinlik
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSport && (() => {
                    const presentation =
                      getSportPresentation(
                        selectedSport.name
                      );

                    return (
                      <span
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                        style={{
                          backgroundColor:
                            presentation.backgroundColor,
                          borderColor:
                            presentation.borderColor,
                          color:
                            presentation.textColor,
                        }}
                      >
                        <span aria-hidden="true">
                          {presentation.icon}
                        </span>

                        <span>
                          {selectedSport.name}
                        </span>
                      </span>
                    );
                  })()}

                  {selectedCommunity && (
                    <CommunityContextChip
                      community={
                        selectedCommunity
                      }
                    />
                  )}
                </div>

                {!selectedCommunity &&
                  communityScope ===
                    "following" && (
                  <div className="mt-3 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800">
                    Following Communities
                  </div>
                )}

                {eligibility !==
                  "all" &&
                  rawResults.length >
                    matchingResults.length && (
                  <p className="mt-2 text-sm text-gray-500">
                    Seçilen katılım koşullarına uymayan etkinlikler bu sayfada gösterilmez.
                  </p>
                )}

                {view === "cards" &&
                  (visibleResultCount > 0 || hasPrevious) && (
                  <p className="mt-2 text-sm text-gray-500">
                    Sayfa {page}
                    {totalPages === null ? "" : ` / ${totalPages}`}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-1.5 shadow-md">
                  {([
                    {
                      value: "cards",
                      label: "Kartlar",
                      helper: "Izgara",
                      icon: "▦",
                    },
                    {
                      value: "map",
                      label: "Harita",
                      helper: "Keşfet",
                      icon: "⌖",
                    },
                    {
                      value: "split",
                      label: "Bölünmüş",
                      helper: "Liste + harita",
                      icon: "◫",
                    },
                  ] as const).map((option) => {
                    const active = view === option.value;

                    return (
                      <Link
                        key={option.value}
                        href={buildDiscoverHref({
                          query,
                          categoryId,
                          activityId,
                          sportId,
                          communityId,
                          communityScope,
                          locationId,
                          startDate,
                          endDate,
                          lifecycle,
                          scope,
                          eligibility,
                          view: option.value,
                          page: 1,
                        })}
                        aria-current={active ? "page" : undefined}
                        className={`${
                          option.value === "split"
                            ? "hidden lg:inline-flex"
                            : "inline-flex"
                        } min-w-[106px] items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-left transition ${
                          active
                            ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200"
                            : "border-transparent bg-white/70 text-gray-600 hover:border-blue-200 hover:bg-white hover:text-blue-700"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-8 w-8 place-items-center rounded-lg text-base ${
                            active
                              ? "bg-white/15"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {option.icon}
                        </span>

                        <span>
                          <span className="block text-sm font-bold leading-none">
                            {option.label}
                          </span>
                          <span
                            className={`mt-1 block text-[10px] font-semibold uppercase tracking-wide ${
                              active ? "text-blue-100" : "text-gray-400"
                            }`}
                          >
                            {option.helper}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>

              {view === "cards" && <WebCardLayoutPicker/>}

              </div>
            </section>

            {(view === "cards" ? mixedDiscoverItems.length : results.length) > 0 ? (
              view === "cards" ? (
              <section className="uin-card-grid mt-5 grid gap-5">
                {mixedDiscoverItems.map(
                  (entry) => {
                    const intent = entry.item;
                    const intentCommunities =
                      intentCommunitiesByIntentId.get(
                        intent.intent_id
                      ) ?? [];

                    const privatePresentation =
                      intent.plan_id
                        ? privatePresentationByPlanId.get(
                            intent.plan_id
                          ) ??
                          null
                        : null;

                    return (
                      <DiscoverIntentCard
                        key={
                          intent.intent_id
                        }
                        intent={{
                          ...intent,
                          sport_name: sportCoverContextByIntentId.get(intent.intent_id)?.sport_name || intent.sport_name,
                        }}
                        currentUserId={
                          viewerId
                        }
                        commonTarget={
                          commonTargetByIntentId.get(intent.intent_id) ?? null
                        }
                        displayTitle={
                          eventDisplayTitleByIntentId.get(intent.intent_id) ?? null
                        }
                        privateCoverUrl={
                          privatePresentation
                            ?.signed_experience_cover_url ||
                          (intent.plan_id
                            ? publicExperienceCoverByPlanId.get(
                                intent.plan_id
                              )?.signed_url ?? null
                            : null) ||
                          privatePresentation
                            ?.visible_cover_url ||
                          null
                        }
                        contextCoverUrl={
                          sportCoverContextByIntentId.get(
                            intent.intent_id
                          )?.context_cover_url ??
                          null
                        }
                        mapPointContext={
                          discoverMapContextByIntentId.get(intent.intent_id) ?? null
                        }
                        publicActivityLocationName={
                          intent.plan_id
                            ? publicActivityLocationByPlanId.get(
                                intent.plan_id
                              ) ?? null
                            : null
                        }
                        publicMeetingPoint={
                          intent.plan_id
                            ? publicMeetingPointByPlanId.get(intent.plan_id) ?? null
                            : null
                        }
                        communities={
                          intentCommunities
                        }
                        fallbackCommunityName={
                          sportCoverContextByIntentId.get(
                            intent.intent_id
                          )?.primary_community_name ??
                          null
                        }
                        fallbackCommunityHref={(() => {
                          const fallbackId =
                            sportCoverContextByIntentId.get(
                              intent.intent_id
                            )?.primary_community_id ?? null;

                          if (!fallbackId) {
                            return null;
                          }

                          const option =
                            communities.find(
                              (community) => community.id === fallbackId
                            ) ??
                            followedCommunities.find(
                              (community) => community.id === fallbackId
                            ) ??
                            null;

                          return option?.slug
                            ? `/communities/${encodeURIComponent(option.slug)}`
                            : null;
                        })()}
                        intentNote={
                          intentNoteByIntentId.get(intent.intent_id) ?? null
                        }
                        relatedLinks={
                          intentLinksByIntentId.get(
                            intent.intent_id
                          ) ?? []
                        }
                        activityPeople={
                          activityPeopleByResourceId.get(
                            intent.plan_id ?? intent.resource_id ?? intent.intent_id
                          ) ?? []
                        }
                        viewerLineage={
                          intent.plan_id
                            ? viewerLineageByPlanId.get(intent.plan_id) ?? null
                            : null
                        }
                      />
                    );
                  }
                )}
              </section>
              ) : (
                <DiscoverMapView
                  points={mapPoints}
                  mode={view}
                  currentUserId={viewerId}
                />
              )
            ) : (
              <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-bold text-gray-950">
                  Etkinlik bulunamadı
                </h2>

                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500">
                  Etkinlik, aşama, sahiplik, konum veya tarih filtrelerini genişlet. Özel kayıtları yalnızca sahipleri ve izin verilen katılımcılar görebilir.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/discover"
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    Filtreleri temizle
                  </Link>

                  <Link
                    href="/ideas"
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
                  >
                    UIN Kartı seç
                  </Link>
                </div>
              </section>
            )}

            {view === "cards" && (hasPrevious || hasNext) && (
              <nav
                aria-label="Etkinlik sonuç sayfaları"
                className="mt-8 flex items-center justify-center gap-3"
              >
                {hasPrevious ? (
                  <Link
                    href={buildDiscoverHref({
                      query,
                      categoryId,
                      activityId,
                      sportId,
                      communityId,
                      communityScope,
                      locationId,
                      startDate,
                      endDate,
                      lifecycle,
                      scope,
                      eligibility,
                      view,
                      page:
                        page -
                        1,
                    })}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="rounded-xl border border-gray-100 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                    ← Previous
                  </span>
                )}

                <span className="rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white">
                  Sayfa {page}
                  {totalPages === null ? "" : ` / ${totalPages}`}
                </span>

                {hasNext ? (
                  <Link
                    href={buildDiscoverHref({
                      query,
                      categoryId,
                      activityId,
                      sportId,
                      communityId,
                      communityScope,
                      locationId,
                      startDate,
                      endDate,
                      lifecycle,
                      scope,
                      eligibility,
                      view,
                      page:
                        page +
                        1,
                    })}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="rounded-xl border border-gray-100 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                    Next →
                  </span>
                )}
              </nav>
            )}

            {view === "cards" && archiveReadError && (
              <section role="alert" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-semibold text-amber-900">
                  İptal olan ve süresi geçen etkinlikler şu anda yüklenemedi.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                  Eksik bir arşiv göstermemek için bu bölüm gizlendi. Sayfayı yenileyerek yeniden deneyebilirsin.
                </p>
              </section>
            )}

            {view === "cards" && !archiveReadError && archivedResults.length > 0 && (
              <details className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-gray-900 marker:hidden md:px-6">
                  <span>
                    İptal olanlar / süresi geçenler
                    <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{archivedResults.length}</span>
                  </span>
                  <span aria-hidden="true" className="text-lg text-gray-400">⌄</span>
                </summary>
                <div className="grid grid-cols-1 gap-5 border-t border-gray-100 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
                  {archivedResults.map((intent) => (
                    <DiscoverIntentCard
                      key={intent.intent_id}
                      intent={intent}
                      currentUserId={viewerId}
                      commonTarget={
                        commonTargetByIntentId.get(intent.intent_id) ?? null
                      }
                      displayTitle={eventDisplayTitleByIntentId.get(intent.intent_id) ?? null}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </main>
  );
}
