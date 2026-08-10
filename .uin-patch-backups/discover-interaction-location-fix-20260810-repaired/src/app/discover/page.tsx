import Link from "next/link";
import {
  redirect,
} from "next/navigation";

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

const PAGE_SIZE = 24;
const MAP_BATCH_LIMIT = 60;
const MAP_MAX_RESULTS = 240;

type DiscoverView = "cards" | "map" | "split";

const LIFECYCLE_OPTIONS = [
  {
    value: "current",
    label: "Open, Future & Forming",
  },
  {
    value: "all",
    label: "All lifecycle stages",
  },
  {
    value: "open",
    label: "Open now",
  },
  {
    value: "future",
    label: "Future Intents",
  },
  {
    value: "forming",
    label: "Forming Activities",
  },
  {
    value: "planned",
    label: "Planned Activities",
  },
  {
    value: "closed",
    label: "Closed Intents",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
  {
    value: "expired",
    label: "Expired / did not happen",
  },
  {
    value: "history",
    label: "All history",
  },
] as const;

const COMMUNITY_SCOPE_OPTIONS = [
  {
    value: "all",
    label: "All Communities",
  },
  {
    value: "following",
    label: "Following Communities",
  },
] as const;

const SCOPE_OPTIONS = [
  {
    value: "all",
    label: "Everyone",
  },
  {
    value: "mine",
    label: "Hosted by me",
  },
  {
    value: "friends",
    label: "My friends",
  },
  {
    value: "others",
    label: "Other people",
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

  const communityId =
    getParam(
      resolvedSearchParams,
      "community"
    );

  const communityScope =
    getCommunityScope(
      getParam(
        resolvedSearchParams,
        "community_scope"
      )
    );

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

  const resultLimit = view === "cards" ? PAGE_SIZE : MAP_BATCH_LIMIT;
  const resultOffset = view === "cards" ? (page - 1) * PAGE_SIZE : 0;

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
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  function runDiscoverSearch(limit: number, offset: number) {
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
        p_lifecycle: lifecycle,
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
        p_lifecycle: lifecycle,
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
      p_lifecycle: lifecycle,
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
  ] =
    await Promise.all([
      supabase.rpc(
        "get_intent_discovery_filters"
      ),

      supabase.rpc(
        "get_active_communities",
        {
          p_category_id:
            null,
        }
      ),

      supabase.rpc(
        "get_my_followed_communities"
      ),

      runDiscoverSearch(resultLimit, resultOffset),
    ]);

  if (
    filterResponse.error
  ) {
    console.error(
      "Intent discovery filters failed:",
      filterResponse.error
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

  if (
    searchResponse.error
  ) {
    console.error(
      "Intent discovery search failed:",
      searchResponse.error
    );
  }

  let mapBatchError: { message?: string } | null = null;
  const searchRows = [
    ...(((searchResponse.data ?? []) as DiscoverIntentRow[])),
  ];

  if (view !== "cards" && !searchResponse.error && searchRows.length > 0) {
    const totalAvailable = toCount(searchRows[0]?.total_count);
    const maximumToLoad = Math.min(totalAvailable, MAP_MAX_RESULTS);

    for (let offset = MAP_BATCH_LIMIT; offset < maximumToLoad; offset += MAP_BATCH_LIMIT) {
      const batchResponse = await runDiscoverSearch(MAP_BATCH_LIMIT, offset);

      if (batchResponse.error) {
        console.error("Discover map batch query failed:", batchResponse.error);
        mapBatchError = batchResponse.error;
        break;
      }

      searchRows.push(...((batchResponse.data ?? []) as DiscoverIntentRow[]));
    }
  }

  const deduplicatedSearchRows = Array.from(
    new Map(searchRows.map((row) => [row.intent_id, row])).values()
  );

  const filters =
    (
      filterResponse.data ?? {
        categories: [],
        activities: [],
        sports: [],
        locations: [],
      }
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

  const rawResults = deduplicatedSearchRows;

  const rawIntentIds =
    Array.from(
      new Set(
        rawResults.map(
          (intent) =>
            intent.intent_id
        )
      )
    );

  const intentEligibilityResponse =
    rawIntentIds.length > 0
      ? await supabase.rpc(
          "get_visible_intent_participant_eligibility",
          {
            p_intent_ids:
              rawIntentIds,
          }
        )
      : {
          data: [],
          error: null,
        };

  if (
    intentEligibilityResponse.error
  ) {
    console.error(
      "Intent participant eligibility query failed:",
      intentEligibilityResponse.error
    );
  }

  const eligibilityByIntentId =
    new Map(
      ((
        intentEligibilityResponse.data ??
        []
      ) as IntentEligibilityContextRow[]).map((row) => [
        row.intent_id,
        {
          participantEligibility:
            normalizeParticipantEligibility(
              row.participant_eligibility
            ),
          viewerIsEligible:
            row.viewer_is_eligible ===
            true,
        },
      ])
    );

  const enrichedResults =
    rawResults.map((intent) => {
      const context =
        eligibilityByIntentId.get(
          intent.intent_id
        );

      const participantEligibility =
        context
          ?.participantEligibility ??
        normalizeParticipantEligibility(
          intent.participant_eligibility
        );

      return {
        ...intent,
        participant_eligibility:
          participantEligibility,
        viewer_is_eligible:
          context?.viewerIsEligible ??
          intent.viewer_is_member ??
          false,
      };
    });

  const eligibleResults =
    enrichedResults.filter(
      (intent) => {
        if (eligibility === "all") {
          return true;
        }

        if (
          eligibility ===
          "eligible"
        ) {
          return (
            intent.viewer_is_eligible ===
            true
          );
        }

        return (
          intent.participant_eligibility ===
          eligibility
        );
      }
    );

  const visibleIntentIds =
    Array.from(
      new Set(
        eligibleResults.map(
          (intent) =>
            intent.intent_id
        )
      )
    );

  const {
    data: reactionContextData,
    error: reactionContextError,
  } = visibleIntentIds.length > 0
    ? await supabase.rpc("get_visible_intent_reaction_context", {
        p_intent_ids: visibleIntentIds,
      })
    : { data: [], error: null };

  if (reactionContextError) {
    console.warn(
      "Intent reaction context is temporarily unavailable:",
      reactionContextError.message
    );
  }

  const reactionContextByIntentId = new Map(
    parseIntentReactionContexts(reactionContextData).map((context) => [
      context.intent_id,
      context,
    ])
  );

  const results = eligibleResults.map((intent) => ({
    ...intent,
    reaction_context:
      reactionContextByIntentId.get(intent.intent_id) ?? null,
  }));

  const {
    data: intentCardNoteData,
    error: intentCardNoteError,
  } = visibleIntentIds.length > 0
    ? await supabase.rpc("get_visible_intent_card_notes", {
        p_intent_ids: visibleIntentIds,
      })
    : { data: [], error: null };

  if (intentCardNoteError) {
    console.warn(
      "Intent card notes are temporarily unavailable:",
      intentCardNoteError.message
    );
  }

  const intentNoteByIntentId = new Map(
    ((intentCardNoteData ?? []) as IntentCardNoteRow[]).map((row) => [
      row.intent_id,
      row.notes,
    ])
  );

  const {
    data: discoverMapContextData,
    error: discoverMapContextError,
  } = visibleIntentIds.length > 0
    ? await supabase.rpc("get_visible_discover_map_points", {
        p_intent_ids: visibleIntentIds,
      })
    : { data: [], error: null };

  if (discoverMapContextError) {
    console.error("Discover map context query failed:", discoverMapContextError);
  }

  const discoverMapContextByIntentId = new Map(
    ((discoverMapContextData ?? []) as DiscoverMapPointContextRow[]).map((row) => [
      row.intent_id,
      row,
    ])
  );

  const {
    data: sportCoverContextData,
    error: sportCoverContextError,
  } = visibleIntentIds.length > 0
    ? await supabase.rpc(
        "get_intent_sport_cover_context",
        {
          p_intent_ids:
            visibleIntentIds,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (sportCoverContextError) {
    console.error(
      "Intent sport cover context query failed:",
      sportCoverContextError
    );
  }

  const sportCoverContextByIntentId =
    new Map<
      string,
      IntentSportCoverContext
    >(
      (
        (
          sportCoverContextData ??
          []
        ) as IntentSportCoverContext[]
      ).map(
        (context) => [
          context.intent_id,
          context,
        ]
      )
    );

  const visiblePlanIds =
    Array.from(
      new Set(
        results
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
      results.map((intent) =>
        intent.plan_id ?? intent.resource_id ?? intent.intent_id
      )
    )
  );

  const [activityPeopleResponse, viewerLineageResponse] = await Promise.all([
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
  ]);

  if (activityPeopleResponse.error) {
    console.error(
      "Discover Activity people query failed:",
      activityPeopleResponse.error
    );
  }

  if (viewerLineageResponse.error) {
    console.error(
      "Discover viewer lineage query failed:",
      viewerLineageResponse.error
    );
  }

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

  const {
    data: privatePresentationData,
    error: privatePresentationError,
  } = visiblePlanIds.length > 0
    ? await supabase.rpc(
        "get_visible_plan_presentations",
        {
          p_plan_ids:
            visiblePlanIds,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (privatePresentationError) {
    console.error(
      "Private Discover presentation query failed:",
      privatePresentationError
    );
  }

  const privatePresentations =
    await hydrateVisiblePlanPresentations(
      supabase,
      (privatePresentationData ?? []) as VisiblePlanPresentationRow[]
    );

  const privatePresentationByPlanId =
    new Map<string, VisiblePlanPresentation>(
      privatePresentations.map(
        (presentation) => [
          presentation.plan_id,
          presentation,
        ]
      )
    );

  const {
    data: publicExperienceCoverData,
    error: publicExperienceCoverError,
  } = visiblePlanIds.length > 0
    ? await supabase.rpc(
        "get_visible_public_experience_covers",
        {
          p_plan_ids: visiblePlanIds,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (publicExperienceCoverError) {
    console.error(
      "Public Discover cover query failed:",
      publicExperienceCoverError
    );
  }

  const publicExperienceCovers = await Promise.all(
    ((publicExperienceCoverData ?? []) as PublicExperienceCoverRow[]).map(
      async (cover): Promise<PublicExperienceCover> => {
        if (cover.external_url) {
          return { ...cover, signed_url: cover.external_url };
        }

        if (!cover.storage_path) {
          return { ...cover, signed_url: null };
        }

        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("experience-media")
            .createSignedUrl(cover.storage_path, 60 * 60);

        if (signedError) {
          console.error("Public Discover cover signing failed:", signedError);
        }

        return {
          ...cover,
          signed_url: signedData?.signedUrl ?? null,
        };
      }
    )
  );

  const publicExperienceCoverByPlanId = new Map(
    publicExperienceCovers.map((cover) => [cover.plan_id, cover])
  );

  const {
    data: publicActivityLocationData,
    error: publicActivityLocationError,
  } = visiblePlanIds.length > 0
    ? await supabase.rpc(
        "get_visible_public_plan_activity_locations",
        {
          p_plan_ids:
            visiblePlanIds,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (publicActivityLocationError) {
    console.error(
      "Public Activity venue query failed:",
      publicActivityLocationError
    );
  }

  const publicActivityLocationByPlanId =
    new Map(
      (
        (publicActivityLocationData ??
          []) as PublicPlanActivityLocationRow[]
      ).map((row) => [
        row.plan_id,
        row.activity_location_name,
      ])
    );

  let intentLinkRows:
    IntentLinkRpcRow[] =
    [];

  let intentCommunityRows:
    ReturnType<
      typeof parseIntentCommunityRows
    > = [];

  if (
    results.length >
    0
  ) {
    const intentIds =
      results.map(
        (intent) =>
          intent.intent_id
      );

    const [
      intentLinksResponse,
      intentCommunitiesResponse,
    ] = await Promise.all([
      supabase.rpc(
        "get_visible_intent_links",
        {
          p_intent_ids:
            intentIds,
        }
      ),

      supabase.rpc(
        "get_visible_intent_communities",
        {
          p_intent_ids:
            intentIds,
        }
      ),
    ]);

    if (
      intentLinksResponse.error
    ) {
      console.error(
        "Intent related links query failed:",
        intentLinksResponse.error
      );
    } else {
      intentLinkRows =
        (
          intentLinksResponse.data ??
          []
        ) as IntentLinkRpcRow[];
    }

    if (
      intentCommunitiesResponse.error
    ) {
      console.error(
        "Intent Community context query failed:",
        intentCommunitiesResponse.error
      );
    } else {
      intentCommunityRows =
        parseIntentCommunityRows(
          intentCommunitiesResponse.data
        );
    }
  }

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
    toCount(
      rawResults[0]?.total_count
    );

  const visibleResultCount =
    results.length;

  const totalPages =
    Math.max(
      Math.ceil(
        totalCount /
          PAGE_SIZE
      ),
      1
    );

  const hasPrevious =
    page > 1;

  const hasNext =
    page <
    totalPages;

  const lifecycleLabel =
    LIFECYCLE_OPTIONS.find(
      (option) =>
        option.value ===
        lifecycle
    )?.label ??
    "All lifecycle stages";

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
          title: privatePresentation?.custom_title?.trim() || intent.activity_name,
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
            privatePresentation?.custom_title ?? null,
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
      <div className="mx-auto max-w-[1680px]">
        <header className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Intent Discovery
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-950">
                Discover Intents
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
                Discover opens with a rotating
                mix of Open, Future and Forming
                Intents. Forming Activities appear
                first, followed by current Intent
                opportunities. Use the search area for
                precise criteria, or the quick
                filters above the results to switch
                lifecycle and ownership instantly.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/timeline"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
              >
                ← Timeline
              </Link>

              <Link
                href="/communities"
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-100"
              >
                Communities
              </Link>

              <Link
                href="/communities/suggest"
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100"
              >
                Suggest Community
              </Link>

              <Link
                href="/onboarding"
                className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Create New Intent
              </Link>
            </div>
          </div>
        </header>

        <DiscoverFiltersForm
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

        {(filterResponse.error ||
          communityResponse.error ||
          followedCommunityResponse.error ||
          searchResponse.error ||
          intentEligibilityResponse.error ||
          discoverMapContextError ||
          mapBatchError) && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Intent discovery could not
              be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {searchResponse.error?.message ??
                communityResponse.error?.message ??
                intentEligibilityResponse.error?.message ??
                discoverMapContextError?.message ??
                mapBatchError?.message ??
                filterResponse.error?.message}
            </p>
          </section>
        )}

        {!searchResponse.error &&
          !intentEligibilityResponse.error &&
          !discoverMapContextError &&
          !mapBatchError && (
          <>
            <section className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  {selectedCommunity
                    ? `${selectedCommunity.name} Community`
                    : selectedSport
                      ? selectedSport.name
                      : hasAdvancedSearch
                      ? "Search results"
                      : lifecycleLabel}
                </p>

                <h2 className="mt-1 text-2xl font-bold text-gray-950">
                  {eligibility ===
                  "all"
                    ? totalCount
                    : visibleResultCount}{" "}
                  Intent
                  {(eligibility ===
                    "all"
                    ? totalCount
                    : visibleResultCount) ===
                  1
                    ? ""
                    : "s"}
                </h2>

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
                    visibleResultCount && (
                  <p className="mt-2 text-sm text-gray-500">
                    Intents that do not match the selected participant eligibility are hidden from this page.
                  </p>
                )}

                {view === "cards" && totalCount > 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-1.5 shadow-md">
                  {([
                    {
                      value: "cards",
                      label: "Cards",
                      helper: "Grid",
                      icon: "▦",
                    },
                    {
                      value: "map",
                      label: "Map",
                      helper: "Explore",
                      icon: "⌖",
                    },
                    {
                      value: "split",
                      label: "Split",
                      helper: "List + map",
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

              <DiscoverQuickFilters
                lifecycle={lifecycle}
                scope={scope}
                communityScope={communityScope}
                communityId={communityId}
                followedCommunities={
                  followedCommunities.map(
                    (community) => ({
                      id: community.id,
                      name: community.name,
                    })
                  )
                }
                lifecycleOptions={LIFECYCLE_OPTIONS}
                scopeOptions={SCOPE_OPTIONS}
                communityScopeOptions={COMMUNITY_SCOPE_OPTIONS}
              />
              </div>
            </section>

            {results.length > 0 ? (
              view === "cards" ? (
              <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {results.map(
                  (intent) => {
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
                        intent={
                          intent
                        }
                        currentUserId={
                          user.id
                        }
                        displayTitle={
                          privatePresentation
                            ?.custom_title ??
                          null
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
                  currentUserId={user.id}
                />
              )
            ) : (
              <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-bold text-gray-950">
                  No Intents found
                </h2>

                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500">
                  Broaden the Activity,
                  Community, lifecycle,
                  ownership, location or
                  date filters.
                  Private records remain
                  visible only to their
                  owners and eligible
                  members.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/discover"
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    Clear filters
                  </Link>

                  <Link
                    href="/onboarding"
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Create an Intent
                  </Link>
                </div>
              </section>
            )}

            {view === "cards" && totalPages >
              1 && (
              <nav
                aria-label="Intent discovery pagination"
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
                  {page} /{" "}
                  {
                    totalPages
                  }
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
          </>
        )}
      </div>
    </main>
  );
}
