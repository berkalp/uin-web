import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import CommunityFollowButton from "@/components/communities/CommunityFollowButton";
import CommunityMembershipVisibilityToggle from "@/components/communities/CommunityMembershipVisibilityToggle";
import CommunityIcon from "@/components/communities/CommunityIcon";
import CommunityIntentFiltersForm, {
  type CommunityEligibilityFilter,
} from "@/components/communities/CommunityIntentFiltersForm";
import DiscoverIntentCard, {
  type DiscoverIntentRow,
  type ViewerPlanLineage,
} from "@/components/discover/DiscoverIntentCard";

import {
  createClient,
} from "@/utils/supabase/server";
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
import {
  parseIntentReactionContexts,
  type IntentReactionContext,
} from "@/utils/intentReactions";
import {
  communityAccentWithAlpha,
  getCommunityAccentForeground,
  getCommunityVisibleBorder,
  normalizeCommunityAccent,
  normalizeCommunitySecondary,
  type CommunityIconKey,
  type CommunityScopeType,
} from "@/utils/communities";
import type {
  HierarchicalLocation,
} from "@/utils/location";
import {
  groupActivityPeopleByResourceId,
  type ActivityPeopleBatchRow,
} from "@/utils/activityPeople";

export const dynamic =
  "force-dynamic";

const CURRENT_PAGE_SIZE = 24;
const EXPERIENCE_PAGE_SIZE = 12;

const ELIGIBILITY_FILTERS: readonly CommunityEligibilityFilter[] = [
  "eligible",
  "everyone",
  "women_only",
  "men_only",
  "all",
];

type ViewerPlanLineageRow = {
  plan_id: string;
  source_count: number | string | null;
  source_intent_id: string | null;
  source_activity_name: string | null;
};

type CommunityPageValue = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_key: CommunityIconKey;
  icon_url: string | null;
  accent_color: string;
  secondary_color: string | null;
  scope_type: CommunityScopeType;
  category_id: string | null;
  category_ids: string[];
  category_names: string[];
  activity_ids: string[];
  activity_names: string[];
  scope_label: string;
};

type IntentSportCoverContext = {
  intent_id: string;
  community_sport_cover_url: string | null;
  context_cover_url: string | null;
};

type CommunityDiscoveryMetrics = {
  follower_count: number | string;
  open_intent_count: number | string;
  planning_activity_count: number | string;
  completed_experience_count: number | string;
  planning_style:
    | "mostly_public"
    | "mixed"
    | "mostly_private"
    | "mostly_invite_only"
    | "not_enough_data";
  resolved_cover_image_url: string | null;
};

type CommunityIntentAccessContext = {
  community_id: string;
  intent_access_mode: "open" | "verified_members";
  is_verified_member: boolean;
  can_use_for_intent: boolean;
  member_label: string | null;
  show_on_profile: boolean;
  verified_at: string | null;
  expires_at: string | null;
  active_member_count: number | string;
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
};

type DiscoveryFilters = {
  categories:
    | DiscoveryCategory[]
    | null;
  activities:
    | DiscoveryActivity[]
    | null;
  locations:
    | HierarchicalLocation[]
    | null;
};

type CommunitySearchParams =
  Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;

type IntentEligibilityContext = {
  participantEligibility:
    ParticipantEligibility;
  viewerIsEligible: boolean;
};

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

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getPageNumber(
  value: string
) {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : 1;
}

function getEligibilityFilter(
  value: string
): CommunityEligibilityFilter {
  return ELIGIBILITY_FILTERS.includes(
    value as CommunityEligibilityFilter
  )
    ? (value as CommunityEligibilityFilter)
    : "eligible";
}

function toCount(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function buildCommunityHref({
  slug,
  query,
  categoryId,
  activityId,
  locationId,
  startDate,
  endDate,
  eligibility,
  currentPage,
  experiencePage,
}: {
  slug: string;
  query: string;
  categoryId: string;
  activityId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  eligibility: CommunityEligibilityFilter;
  currentPage: number;
  experiencePage: number;
}) {
  const params =
    new URLSearchParams();

  if (query) {
    params.set("q", query);
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

  if (eligibility !== "eligible") {
    params.set(
      "eligibility",
      eligibility
    );
  }

  if (currentPage > 1) {
    params.set(
      "current_page",
      String(currentPage)
    );
  }

  if (experiencePage > 1) {
    params.set(
      "experience_page",
      String(experiencePage)
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/communities/${encodeURIComponent(
        slug
      )}?${queryString}`
    : `/communities/${encodeURIComponent(
        slug
      )}`;
}

function intentMatchesEligibility(
  context: IntentEligibilityContext,
  filter: CommunityEligibilityFilter
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "eligible") {
    return context.viewerIsEligible;
  }

  return (
    context.participantEligibility ===
    filter
  );
}

function Pagination({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <span className="text-sm font-semibold text-gray-600">
        Page {page} of {totalPages}
      </span>

      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={previousHref}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
          >
            ← Previous
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-xl border border-gray-100 px-4 py-2 text-sm font-semibold text-gray-300">
            ← Previous
          </span>
        )}

        {page < totalPages ? (
          <Link
            href={nextHref}
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Next →
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-300">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params:
    Promise<{
      slug: string;
    }>;
  searchParams:
    CommunitySearchParams;
}) {
  const [
    resolvedParams,
    resolvedSearchParams,
  ] = await Promise.all([
    params,
    searchParams,
  ]);

  const { slug } =
    resolvedParams;

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

  const eligibility =
    getEligibilityFilter(
      getParam(
        resolvedSearchParams,
        "eligibility"
      )
    );

  const currentPage =
    getPageNumber(
      getParam(
        resolvedSearchParams,
        "current_page"
      )
    );

  const experiencePage =
    getPageNumber(
      getParam(
        resolvedSearchParams,
        "experience_page"
      )
    );

  const hasSearchFilters =
    Boolean(
      query ||
      categoryId ||
      activityId ||
      locationId ||
      startDate ||
      endDate ||
      eligibility !== "eligible"
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

  const {
    data: communityData,
    error: communityError,
  } = await supabase.rpc(
    "get_community_by_slug",
    {
      p_slug: slug,
    }
  );

  if (
    communityError ||
    !communityData ||
    typeof communityData !==
      "object"
  ) {
    notFound();
  }

  const community =
    communityData as CommunityPageValue;

  if (!community.id) {
    notFound();
  }

  const [
    adminRoleResponse,
    followResponse,
    coverResponse,
    metricsResponse,
    accessResponse,
    filterResponse,
    currentResponse,
    completedResponse,
  ] = await Promise.all([
    supabase.rpc(
      "get_admin_role"
    ),
    supabase.rpc(
      "is_following_community",
      {
        p_community_id:
          community.id,
      }
    ),

    supabase.rpc(
      "get_community_cover_image",
      {
        p_community_id:
          community.id,
      }
    ),

    supabase.rpc(
      "get_community_discovery_metrics",
      {
        p_community_id: community.id,
      }
    ),

    supabase.rpc(
      "get_community_intent_access_context",
      {
        p_community_id: community.id,
      }
    ),

    supabase.rpc(
      "get_intent_discovery_filters"
    ),

    supabase.rpc(
      "search_visible_intents_by_community",
      {
        p_community_id:
          community.id,
        p_query:
          query || null,
        p_category_id:
          categoryId || null,
        p_activity_id:
          activityId || null,
        p_location_id:
          locationId || null,
        p_start_date:
          startDate || null,
        p_end_date:
          endDate || null,
        p_lifecycle: "current",
        p_scope: "all",
        p_limit:
          CURRENT_PAGE_SIZE,
        p_offset:
          (currentPage - 1) *
          CURRENT_PAGE_SIZE,
      }
    ),

    supabase.rpc(
      "search_visible_intents_by_community",
      {
        p_community_id:
          community.id,
        p_query:
          query || null,
        p_category_id:
          categoryId || null,
        p_activity_id:
          activityId || null,
        p_location_id:
          locationId || null,
        p_start_date:
          startDate || null,
        p_end_date:
          endDate || null,
        p_lifecycle: "completed",
        p_scope: "all",
        p_limit:
          EXPERIENCE_PAGE_SIZE,
        p_offset:
          (experiencePage - 1) *
          EXPERIENCE_PAGE_SIZE,
      }
    ),
  ]);

  const adminRole =
    adminRoleResponse.error
      ? null
      : typeof adminRoleResponse.data ===
          "string"
        ? adminRoleResponse.data
        : null;

  const canEditCommunity =
    adminRole === "owner" ||
    adminRole === "admin" ||
    adminRole === "moderator";

  if (followResponse.error) {
    console.error(
      "Community follow state failed:",
      followResponse.error
    );
  }

  if (coverResponse.error) {
    console.error(
      "Community cover failed:",
      coverResponse.error
    );
  }

  if (metricsResponse.error) {
    console.warn(
      "Community metrics failed:",
      metricsResponse.error
    );
  }

  if (accessResponse.error) {
    console.warn(
      "Community membership access failed; using open-access fallback until the membership migration is applied:",
      accessResponse.error
    );
  }

  const accessContext =
    !accessResponse.error &&
    accessResponse.data &&
    typeof accessResponse.data === "object"
      ? (accessResponse.data as CommunityIntentAccessContext)
      : null;

  const intentAccessMode =
    accessContext?.intent_access_mode === "verified_members"
      ? "verified_members"
      : "open";

  const isVerifiedMember =
    accessContext?.is_verified_member === true;

  const canUseCommunityForIntent =
    accessContext?.can_use_for_intent !== false;

  const membershipLabel =
    accessContext?.member_label || "Verified member";

  const showMembershipOnProfile =
    accessContext?.show_on_profile === true;

  const activeMemberCount = Number(
    accessContext?.active_member_count ?? 0
  );

  if (filterResponse.error) {
    console.error(
      "Community Intent filters failed:",
      filterResponse.error
    );
  }

  if (currentResponse.error) {
    console.error(
      "Community current feed failed:",
      currentResponse.error
    );
  }

  if (completedResponse.error) {
    console.error(
      "Community experience feed failed:",
      completedResponse.error
    );
  }

  const metrics =
    (Array.isArray(metricsResponse.data)
      ? metricsResponse.data[0]
      : metricsResponse.data) as CommunityDiscoveryMetrics | null;

  const followerCount = toCount(metrics?.follower_count);
  const openIntentCount = toCount(metrics?.open_intent_count);
  const planningActivityCount = toCount(
    metrics?.planning_activity_count
  );
  const completedExperienceCount = toCount(
    metrics?.completed_experience_count
  );

  const planningStyleLabel =
    metrics?.planning_style === "mostly_public"
      ? "Mostly public"
      : metrics?.planning_style === "mostly_invite_only"
        ? "Mostly invite-only"
        : metrics?.planning_style === "mostly_private"
          ? "Mostly private"
          : metrics?.planning_style === "mixed"
            ? "Mixed visibility"
            : "Not enough data";

  const filters =
    (
      filterResponse.data ?? {
        categories: [],
        activities: [],
        locations: [],
      }
    ) as DiscoveryFilters;

  const rawCurrentIntents =
    (
      currentResponse.data ?? []
    ) as DiscoverIntentRow[];

  const rawCompletedActivities =
    (
      completedResponse.data ?? []
    ) as DiscoverIntentRow[];

  const rawCurrentTotal =
    toCount(
      rawCurrentIntents[0]
        ?.total_count
    );

  const rawCompletedTotal =
    toCount(
      rawCompletedActivities[0]
        ?.total_count
    );

  const allResults = [
    ...rawCurrentIntents,
    ...rawCompletedActivities,
  ];

  const visiblePlanIds = Array.from(
    new Set(
      allResults
        .map((result) => result.plan_id)
        .filter((planId): planId is string => Boolean(planId))
    )
  );

  const visibleResourceIds = Array.from(
    new Set(
      allResults.map((intent) =>
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
      "Community Activity people query failed:",
      activityPeopleResponse.error
    );
  }

  if (viewerLineageResponse.error) {
    console.error(
      "Community viewer lineage query failed:",
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

  const visiblePresentationResponse =
    visiblePlanIds.length > 0
      ? await supabase.rpc("get_visible_plan_presentations", {
          p_plan_ids: visiblePlanIds,
        })
      : { data: [], error: null };

  if (visiblePresentationResponse.error) {
    console.error(
      "Community Plan presentation query failed:",
      visiblePresentationResponse.error
    );
  }

  const visiblePresentations = await hydrateVisiblePlanPresentations(
    supabase,
    (visiblePresentationResponse.data ?? []) as VisiblePlanPresentationRow[]
  );

  const visiblePresentationByPlanId = new Map<string, VisiblePlanPresentation>(
    visiblePresentations.map((presentation) => [
      presentation.plan_id,
      presentation,
    ])
  );

  let intentLinkRows:
    IntentLinkRpcRow[] = [];

  const eligibilityByIntentId =
    new Map<
      string,
      IntentEligibilityContext
    >();

  const sportCoverContextByIntentId =
    new Map<
      string,
      IntentSportCoverContext
    >();

  const reactionContextByIntentId =
    new Map<string, IntentReactionContext>();

  if (allResults.length > 0) {
    const intentIds = [
      ...new Set(
        allResults.map(
          (result) =>
            result.intent_id
        )
      ),
    ];

    const [
      linksResponse,
      eligibilityResponse,
      sportCoverContextResponse,
      reactionContextResponse,
    ] = await Promise.all([
      supabase.rpc(
        "get_visible_intent_links",
        {
          p_intent_ids:
            intentIds,
        }
      ),
      supabase.rpc(
        "get_visible_intent_participant_eligibility",
        {
          p_intent_ids:
            intentIds,
        }
      ),
      supabase.rpc(
        "get_intent_sport_cover_context",
        {
          p_intent_ids:
            intentIds,
        }
      ),
      supabase.rpc(
        "get_visible_intent_reaction_context",
        {
          p_intent_ids: intentIds,
        }
      ),
    ]);

    if (linksResponse.error) {
      console.error(
        "Community Intent links failed:",
        linksResponse.error
      );
    } else {
      intentLinkRows =
        (
          linksResponse.data ?? []
        ) as IntentLinkRpcRow[];
    }

    if (eligibilityResponse.error) {
      console.error(
        "Community participant eligibility failed:",
        eligibilityResponse.error
      );
    } else {
      (
        (eligibilityResponse.data ??
          []) as Array<{
          intent_id: string;
          participant_eligibility: unknown;
          viewer_is_eligible: boolean;
        }>
      ).forEach((row) => {
        eligibilityByIntentId.set(
          row.intent_id,
          {
            participantEligibility:
              normalizeParticipantEligibility(
                row.participant_eligibility
              ),
            viewerIsEligible:
              row.viewer_is_eligible ===
              true,
          }
        );
      });
    }

    if (
      sportCoverContextResponse.error
    ) {
      console.error(
        "Community cover context failed:",
        sportCoverContextResponse.error
      );
    } else {
      (
        (sportCoverContextResponse.data ??
          []) as IntentSportCoverContext[]
      ).forEach((context) => {
        sportCoverContextByIntentId.set(
          context.intent_id,
          context
        );
      });
    }


    if (reactionContextResponse.error) {
      console.warn(
        "Community Intent reactions are temporarily unavailable:",
        reactionContextResponse.error.message
      );
    } else {
      parseIntentReactionContexts(
        reactionContextResponse.data
      ).forEach((context) => {
        reactionContextByIntentId.set(
          context.intent_id,
          context
        );
      });
    }
  }

  function withEligibility(
    intent: DiscoverIntentRow
  ): DiscoverIntentRow {
    const context =
      eligibilityByIntentId.get(
        intent.intent_id
      );

    return {
      ...intent,
      participant_eligibility:
        context
          ?.participantEligibility ??
        normalizeParticipantEligibility(
          intent.participant_eligibility
        ),
      viewer_is_eligible:
        context?.viewerIsEligible ??
        intent.viewer_is_member,
      reaction_context:
        reactionContextByIntentId.get(intent.intent_id) ?? null,
    };
  }

  function filterByEligibility(
    intent: DiscoverIntentRow
  ) {
    const normalizedIntent =
      withEligibility(intent);

    return intentMatchesEligibility(
      {
        participantEligibility:
          normalizeParticipantEligibility(
            normalizedIntent.participant_eligibility
          ),
        viewerIsEligible:
          normalizedIntent.viewer_is_eligible ===
          true,
      },
      eligibility
    );
  }

  const currentIntents =
    rawCurrentIntents
      .map(withEligibility)
      .filter(filterByEligibility);

  const completedActivities =
    rawCompletedActivities
      .map(withEligibility)
      .filter(filterByEligibility);

  const fallbackHeroIntent =
    rawCurrentIntents[0] ??
    rawCompletedActivities[0] ??
    null;

  const fallbackHeroCoverContext =
    fallbackHeroIntent
      ? sportCoverContextByIntentId.get(
          fallbackHeroIntent.intent_id
        )
      : null;

  const communityCoverUrl =
    typeof coverResponse.data ===
      "string" &&
    coverResponse.data.trim()
      ? coverResponse.data.trim()
      : null;

  const heroCoverUrl =
    metrics?.resolved_cover_image_url ||
    communityCoverUrl ||
    fallbackHeroCoverContext
      ?.community_sport_cover_url ||
    fallbackHeroCoverContext
      ?.context_cover_url ||
    (fallbackHeroIntent?.plan_id
      ? visiblePresentationByPlanId.get(fallbackHeroIntent.plan_id)
          ?.visible_cover_url
      : null) ||
    fallbackHeroIntent
      ?.activity_cover_url ||
    fallbackHeroIntent
      ?.category_cover_url ||
    null;

  const linksByIntentId =
    groupIntentLinksByIntentId(
      parseIntentLinkRows(
        intentLinkRows
      )
    );

  const accentColor =
    normalizeCommunityAccent(
      community.accent_color
    );

  const secondaryColor =
    normalizeCommunitySecondary(
      community.secondary_color
    );

  const brandSecondaryColor =
    secondaryColor ?? accentColor;

  const accentForeground =
    getCommunityAccentForeground(
      accentColor
    );

  const secondaryForeground =
    getCommunityAccentForeground(
      brandSecondaryColor
    );

  const visibleBorder =
    getCommunityVisibleBorder(
      accentColor,
      secondaryColor
    );

  const heroBrandOverlay =
    `linear-gradient(135deg, ${communityAccentWithAlpha(
      accentColor,
      heroCoverUrl ? 0.74 : 1
    )} 0%, ${communityAccentWithAlpha(
      accentColor,
      heroCoverUrl ? 0.74 : 1
    )} 82%, ${communityAccentWithAlpha(
      brandSecondaryColor,
      heroCoverUrl ? 0.78 : 1
    )} 82%, ${communityAccentWithAlpha(
      brandSecondaryColor,
      heroCoverUrl ? 0.78 : 1
    )} 100%)`;

  const availableCategoryIds =
    Array.isArray(
      community.category_ids
    )
      ? community.category_ids
      : [];

  const createIntentParams =
    new URLSearchParams({
      community:
        community.id,
    });

  if (
    availableCategoryIds.length === 1
  ) {
    createIntentParams.set(
      "category",
      availableCategoryIds[0]
    );
  }

  const createIntentHref =
    `/onboarding?${createIntentParams.toString()}`;

  const currentTotalPages =
    Math.max(
      1,
      Math.ceil(
        rawCurrentTotal /
          CURRENT_PAGE_SIZE
      )
    );

  const experienceTotalPages =
    Math.max(
      1,
      Math.ceil(
        rawCompletedTotal /
          EXPERIENCE_PAGE_SIZE
      )
    );

  const buildHref = (
    nextCurrentPage: number,
    nextExperiencePage: number
  ) =>
    buildCommunityHref({
      slug,
      query,
      categoryId,
      activityId,
      locationId,
      startDate,
      endDate,
      eligibility,
      currentPage:
        nextCurrentPage,
      experiencePage:
        nextExperiencePage,
    });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1520px]">
        <header className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div
            className="relative isolate overflow-hidden border-t-[10px] px-6 py-8 md:px-10 md:py-12"
            style={{
              color:
                accentForeground,
              backgroundColor:
                accentColor,
              borderTopColor:
                visibleBorder,
            }}
          >
            {heroCoverUrl && (
              <div
                aria-hidden="true"
                className="absolute -inset-5 -z-20 scale-105 bg-cover bg-center blur-[5px]"
                style={{
                  backgroundImage:
                    `url(${JSON.stringify(
                      heroCoverUrl
                    )})`,
                }}
              />
            )}

            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10"
              style={{
                backgroundImage:
                  heroBrandOverlay,
              }}
            />

            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-start gap-5">
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border shadow-lg backdrop-blur-md"
                  style={{
                    backgroundColor:
                      communityAccentWithAlpha(
                        "#FFFFFF",
                        0.36
                      ),
                    borderColor:
                      visibleBorder,
                    boxShadow:
                      `inset 0 0 0 3px ${visibleBorder}`,
                  }}
                >
                  <CommunityIcon
                    iconKey={
                      community.icon_key ||
                      "people"
                    }
                    iconUrl={
                      community.icon_url
                    }
                    className="h-10 w-10"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
                    {community.scope_label}
                  </p>

                  <h1 className="mt-2 break-words text-4xl font-black md:text-5xl">
                    {community.name}
                  </h1>

                  <p className="mt-4 max-w-3xl text-sm leading-7 opacity-90 md:text-base">
                    {community.description ||
                      "A curated context for people expressing related Intents on UIN."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {community.scope_type ===
                    "global" ? (
                      <span
                        className="rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
                        style={{
                          borderColor:
                            communityAccentWithAlpha(
                              accentForeground,
                              0.28
                            ),
                          backgroundColor:
                            communityAccentWithAlpha(
                              accentForeground,
                              0.09
                            ),
                        }}
                      >
                        All Activities
                      </span>
                    ) : (
                      <>
                        {(community.category_names ?? []).map(
                          (categoryName) => (
                            <span
                              key={categoryName}
                              className="rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
                              style={{
                                borderColor:
                                  communityAccentWithAlpha(
                                    accentForeground,
                                    0.28
                                  ),
                                backgroundColor:
                                  communityAccentWithAlpha(
                                    accentForeground,
                                    0.09
                                  ),
                              }}
                            >
                              {categoryName}
                            </span>
                          )
                        )}

                        {(community.activity_names ?? []).slice(0, 6).map(
                          (activityName) => (
                            <span
                              key={activityName}
                              className="rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
                              style={{
                                borderColor:
                                  communityAccentWithAlpha(
                                    accentForeground,
                                    0.28
                                  ),
                                backgroundColor:
                                  communityAccentWithAlpha(
                                    accentForeground,
                                    0.09
                                  ),
                              }}
                            >
                              {activityName}
                            </span>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-3">
                {canEditCommunity && (
                  <Link
                    href={`/admin/communities?edit=${encodeURIComponent(
                      community.id
                    )}#community-editor`}
                    className="rounded-xl border border-white/30 bg-white/95 px-5 py-3 text-sm font-bold text-gray-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Edit Community
                  </Link>
                )}

                <CommunityFollowButton
                  communityId={
                    community.id
                  }
                  communityName={
                    community.name
                  }
                  initialIsFollowing={
                    Boolean(
                      followResponse.data
                    )
                  }
                  hero
                  accentColor={
                    accentColor
                  }
                  secondaryColor={
                    secondaryColor
                  }
                />

                {intentAccessMode === "verified_members" && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={`rounded-xl border border-white/35 px-4 py-2.5 text-xs font-black ${
                        isVerifiedMember
                          ? "bg-emerald-500/25 text-white"
                          : "bg-black/20 text-white"
                      }`}
                    >
                      {isVerifiedMember
                        ? membershipLabel
                        : "Verified membership required"}
                    </span>

                    {isVerifiedMember && (
                      <CommunityMembershipVisibilityToggle
                        communityId={community.id}
                        initialShowOnProfile={
                          showMembershipOnProfile
                        }
                      />
                    )}
                  </div>
                )}

                {canUseCommunityForIntent ? (
                  <Link
                  href={createIntentHref}
                  className="rounded-xl border px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5"
                  style={{
                    backgroundColor:
                      brandSecondaryColor,
                    color:
                      secondaryForeground,
                    borderColor:
                      communityAccentWithAlpha(
                        visibleBorder,
                        0.9
                      ),
                  }}
                >
                  Create an Intent here
                </Link>
                ) : (
                  <span
                    className="cursor-not-allowed rounded-xl border border-white/30 bg-black/20 px-5 py-3 text-sm font-bold text-white/85 shadow-sm"
                    title="Only verified members may attach an Intent to this Community."
                  >
                    Members-only Intent context
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4 md:p-8">
            <div className="rounded-2xl bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Followers
              </p>
              <p className="mt-2 text-2xl font-black text-gray-950">
                {followerCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                private follows shaping Discover
              </p>
              {intentAccessMode === "verified_members" && (
                <p className="mt-2 text-xs font-bold text-emerald-700">
                  {activeMemberCount} verified {activeMemberCount === 1 ? "member" : "members"}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Open Intents
              </p>
              <p className="mt-2 text-2xl font-black text-gray-950">
                {openIntentCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                visible current opportunities
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Planning
              </p>
              <p className="mt-2 text-2xl font-black text-gray-950">
                {planningActivityCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                visible Forming or Planned Activities
              </p>
            </div>

            <div className="rounded-2xl bg-green-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Completed
              </p>
              <p className="mt-2 text-2xl font-black text-gray-950">
                {completedExperienceCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                visible completed Experiences
              </p>
            </div>

            <div className="sm:col-span-2 xl:col-span-4 flex flex-col gap-3 rounded-2xl bg-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  How this Community usually plans
                </p>
                <p className="mt-2 text-sm font-bold text-gray-950">
                  {planningStyleLabel}
                </p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  An anonymised recent pattern. Exact Friends-only and Invite-only Activity counts are not exposed.
                </p>
              </div>

              <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                <span className="font-bold text-gray-950">
                  {intentAccessMode === "verified_members"
                    ? isVerifiedMember
                      ? "Verified member."
                      : "Follow ≠ membership."
                    : "Open Intent context."}
                </span>{" "}
                {intentAccessMode === "verified_members"
                  ? isVerifiedMember
                    ? "Your verified affiliation lets you attach compatible Intents to this Community. Following remains a separate private interest signal."
                    : "Only verified members can attach compatible Intents to this Community. Following personalises Discover but grants no affiliation rights."
                  : "Compatible Intents may use this Community without a verified affiliation. Following still remains private and separate."}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/discover?community=${encodeURIComponent(
              community.id
            )}`}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50"
          >
            Open full Discover feed
          </Link>

          <Link
            href="/communities"
            className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-50"
          >
            All Communities
          </Link>

          <Link
            href="/communities?scope=following"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
          >
            Following Communities
          </Link>

          <Link
            href="/communities/suggest"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
          >
            Suggest a Community
          </Link>
        </div>

        <CommunityIntentFiltersForm
          slug={slug}
          query={query}
          categoryId={categoryId}
          activityId={activityId}
          locationId={locationId}
          startDate={startDate}
          endDate={endDate}
          eligibility={eligibility}
          categories={
            filters.categories ?? []
          }
          activities={
            filters.activities ?? []
          }
          locations={
            filters.locations ?? []
          }
        />

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
                Current Intent context
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-950">
                Open, Future and Forming
              </h2>
              {hasSearchFilters && (
                <p className="mt-2 text-sm text-gray-500">
                  {currentIntents.length} matching records on this page
                </p>
              )}
            </div>

            {canUseCommunityForIntent ? (
              <Link
                href={createIntentHref}
                className="text-sm font-semibold text-green-700 hover:text-green-800"
              >
                Create an Intent →
              </Link>
            ) : (
              <span className="text-sm font-semibold text-gray-400">
                Verified members can create here
              </span>
            )}
          </div>

          {currentIntents.length > 0 ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {currentIntents.map(
                  (intent) => (
                    <DiscoverIntentCard
                      key={`${intent.plan_id ?? "intent"}-${intent.intent_id}`}
                      intent={intent}
                      currentUserId={
                        user.id
                      }
                      displayTitle={
                        intent.plan_id
                          ? visiblePresentationByPlanId.get(intent.plan_id)
                              ?.custom_title ?? null
                          : null
                      }
                      privateCoverUrl={
                        intent.plan_id
                          ? visiblePresentationByPlanId.get(intent.plan_id)
                              ?.visible_cover_url ?? null
                          : null
                      }
                      contextCoverUrl={
                        sportCoverContextByIntentId.get(
                          intent.intent_id
                        )?.context_cover_url ??
                        null
                      }
                      relatedLinks={
                        linksByIntentId.get(
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
                  )
                )}
              </div>

              <Pagination
                page={currentPage}
                totalPages={
                  currentTotalPages
                }
                previousHref={buildHref(
                  Math.max(
                    1,
                    currentPage - 1
                  ),
                  experiencePage
                )}
                nextHref={buildHref(
                  Math.min(
                    currentTotalPages,
                    currentPage + 1
                  ),
                  experiencePage
                )}
              />
            </>
          ) : (
            <>
              <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold text-gray-950">
                  {hasSearchFilters
                    ? "No matching current Intents"
                    : "No current Intents yet"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {hasSearchFilters
                    ? "Try clearing one or more filters. The database remains stubbornly literal, as databases tend to do."
                    : "This Community has context, but nobody has expressed a current Intent in it yet."}
                </p>
                <Link
                  href={
                    hasSearchFilters
                      ? `/communities/${encodeURIComponent(
                          slug
                        )}`
                      : createIntentHref
                  }
                  className="mt-5 inline-flex rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
                >
                  {hasSearchFilters
                    ? "Clear filters"
                    : "Create the first Intent"}
                </Link>
              </div>

              <Pagination
                page={currentPage}
                totalPages={
                  currentTotalPages
                }
                previousHref={buildHref(
                  Math.max(
                    1,
                    currentPage - 1
                  ),
                  experiencePage
                )}
                nextHref={buildHref(
                  Math.min(
                    currentTotalPages,
                    currentPage + 1
                  ),
                  experiencePage
                )}
              />
            </>
          )}
        </section>

        {(rawCompletedTotal > 0 ||
          hasSearchFilters) && (
          <section className="mt-10 border-t border-gray-200 pt-8">
            <div>
              <h2 className="text-2xl font-black text-gray-950">
                Completed Activities
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Public completed Activities keep the Community grounded in what actually happened, rather than becoming another decorative interest page.
              </p>
            </div>

            {completedActivities.length > 0 ? (
              <>
                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {completedActivities.map(
                    (intent) => (
                      <DiscoverIntentCard
                        key={`${intent.plan_id ?? "intent"}-${intent.intent_id}`}
                        intent={intent}
                        currentUserId={
                          user.id
                        }
                        displayTitle={
                          intent.plan_id
                            ? visiblePresentationByPlanId.get(intent.plan_id)
                                ?.custom_title ?? null
                            : null
                        }
                        privateCoverUrl={
                          intent.plan_id
                            ? visiblePresentationByPlanId.get(intent.plan_id)
                                ?.visible_cover_url ?? null
                            : null
                        }
                        contextCoverUrl={
                          sportCoverContextByIntentId.get(
                            intent.intent_id
                          )?.context_cover_url ??
                          null
                        }
                        relatedLinks={
                          linksByIntentId.get(
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
                    )
                  )}
                </div>

                <Pagination
                  page={experiencePage}
                  totalPages={
                    experienceTotalPages
                  }
                  previousHref={buildHref(
                    currentPage,
                    Math.max(
                      1,
                      experiencePage - 1
                    )
                  )}
                  nextHref={buildHref(
                    currentPage,
                    Math.min(
                      experienceTotalPages,
                      experiencePage + 1
                    )
                  )}
                />
              </>
            ) : (
              <>
                <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <p className="text-sm font-semibold text-gray-700">
                    No completed Activities match these filters.
                  </p>
                </div>

                <Pagination
                  page={experiencePage}
                  totalPages={
                    experienceTotalPages
                  }
                  previousHref={buildHref(
                    currentPage,
                    Math.max(
                      1,
                      experiencePage - 1
                    )
                  )}
                  nextHref={buildHref(
                    currentPage,
                    Math.min(
                      experienceTotalPages,
                      experiencePage + 1
                    )
                  )}
                />
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
