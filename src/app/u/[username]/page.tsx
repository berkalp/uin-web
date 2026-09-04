import Link from "next/link";
import { notFound } from "next/navigation";

import ManagedMinorPublicProfile, {
  type ManagedMinorContext,
  type PublicGuardianRow,
} from "@/components/family/ManagedMinorPublicProfile";
import ReportButton from "@/components/moderation/ReportButton";
import FriendshipButton from "@/components/profile/FriendshipButton";
import ProfileFollowButton from "@/components/profile/ProfileFollowButton";
import ProfilePresencePanel from "@/components/profile/ProfilePresencePanel";
import ProfileConnectionsFamilyPanel from "@/components/profile/ProfileConnectionsFamilyPanel";
import ProfileActivityTabs from "@/components/profile/ProfileActivityTabs";
import PublicFavoritesPanel, { type PublicFavoriteItem } from "@/components/profile/PublicFavoritesPanel";
import ProfileIntentReactions, {
  type ProfileIntentReactionItem,
} from "@/components/profile/ProfileIntentReactions";
import PublicSeedsPanel from "@/components/seeds/PublicSeedsPanel";
import PublicBadgesPanel from "@/components/badges/PublicBadgesPanel";
import PublicCommunityMembershipsPanel from "@/components/communities/PublicCommunityMembershipsPanel";
import PublicProfessionalCredentialsPanel from "@/components/professionals/PublicProfessionalCredentialsPanel";
import VerificationMark from "@/components/professionals/VerificationMark";
import PublicReputationPanel from "@/components/reputation/PublicReputationPanel";
import type {
  DiscoverIntentRow,
  IntentLifecycleStatus,
  ViewerPlanLineage,
} from "@/components/discover/DiscoverIntentCard";
import type {
  ActivityVisibility,
} from "@/utils/activityVisibility";
import {
  buildYouTubeEmbedUrl,
  type ProfileEmbed,
  type ProfileLink,
} from "@/utils/profilePresence";
import { createClient } from "@/utils/supabase/server";
import {
  groupActivityPeopleByResourceId,
  type ActivityPeopleBatchRow,
} from "@/utils/activityPeople";
import {
  hydrateVisiblePlanPresentations,
  type VisiblePlanPresentation,
  type VisiblePlanPresentationRow,
} from "@/utils/planPresentationVisibility";
import type {
  ProfileConnectionSummary,
  RawFamilyData,
} from "@/utils/profileConnections";
import type {
  PublicBadge,
} from "@/utils/badges";
import type {
  PublicCommunityMembership,
} from "@/utils/communityMemberships";
import type {
  PublicProfessionalStatus,
} from "@/utils/professionals";
import type {
  PublicReputationSummary,
} from "@/utils/reputation";
import {
  getProfileGenderLabel,
  normalizeParticipantEligibility,
  normalizeProfileGender,
} from "@/utils/participationEligibility";
import {
  parseIntentCommunityRows,
  type IntentCommunityContext,
} from "@/utils/communities";
import {
  parseIntentReactionContexts,
  type IntentReactionContext,
} from "@/utils/intentReactions";
import {
  parseSeedReactionContexts,
  type PublicSeedRecord,
} from "@/utils/seeds";

type PublicProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

type ProfileData = {
  id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
};

type ActiveIntent = {
  id: string;
  activity_name: string;
  category_name: string;
  city: string;
  district: string;
  start_date: string;
  end_date: string;
  people: string;
  budget: number | null;
  recurrence: string;
  max_participants: number | null;
  recruitment_status: "open" | "full";
  visibility: ActivityVisibility;
  viewer_can_request: boolean;
  viewer_invitation_status:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired"
    | null;
  viewer_join_request_status:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | null;
  viewer_join_request_id: string | null;
};

type FormingActivity = {
  id: string;
  source_intent_id: string;
  title: string;
  activity_name: string;
  category_name: string;
  city: string | null;
  district: string | null;
  window_start: string;
  window_end: string;
  member_count: number;
  relationship: "host" | "co_host" | "participant";
  recruitment_status: "open" | "full" | "closed";
  visibility: ActivityVisibility;
  viewer_can_request: boolean;
  viewer_is_member: boolean;
  viewer_invitation_status:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired"
    | null;
  viewer_join_request_status:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | null;
  viewer_join_request_id: string | null;
};

type ScheduledActivity = {
  id: string;
  title: string;
  activity_name: string;
  category_name: string;
  city: string | null;
  district: string | null;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  meeting_point?: string | null;
  member_count: number;
  relationship: "host" | "co_host" | "participant";
  attendance_status?: "pending" | "attended" | "no_show" | null;
};

type ProfilePageData = {
  viewer: {
    is_authenticated: boolean;
    is_owner: boolean;
    is_following: boolean;
    friendship_id: string | null;
    friendship_status:
      | "pending"
      | "accepted"
      | "declined"
      | "removed"
      | null;
    friendship_direction: "incoming" | "outgoing" | null;
  };
  profile: ProfileData;
  summary: {
    active_intents: number;
    forming_activities: number;
    upcoming_activities: number;
    completed_activities: number;
    private_archive:
      | {
          closed: number;
          expired: number;
          cancelled: number;
        }
      | null;
  };
  active_intents: ActiveIntent[];
  forming_activities: FormingActivity[];
  upcoming_activities: ScheduledActivity[];
  completed_activities: ScheduledActivity[];
};

type ProfilePresenceData = {
  links: ProfileLink[];
  embeds: ProfileEmbed[];
};

type CatalogueActivityRow = {
  id: string;
  name: string;
  category_id: string;
  default_cover_url: string | null;
};

type CatalogueCategoryRow = {
  id: string;
  name: string;
  default_cover_url: string | null;
};

type PlanCardMetadata = {
  plan_id: string;
  cover_url: string | null;
  host_user_id: string;
  host_full_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  plan_visibility: ActivityVisibility;
  recruitment_status: "open" | "full" | "closed";
  viewer_is_member: boolean;
};

type PlanSourceIntentRow = {
  plan_id: string;
  intent_id: string;
};

type PublicPlanActivityLocationRow = {
  plan_id: string;
  activity_location_name: string | null;
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

type PublicIntentPresentationContextRow =
  IntentSportCoverContext & {
    community_id: string | null;
    community_name: string | null;
    community_slug: string | null;
    community_description: string | null;
    community_icon_key: string | null;
    community_icon_url: string | null;
    community_accent_color: string | null;
    community_secondary_color: string | null;
    community_scope_type: string | null;
    category_id: string | null;
    community_status: string | null;
    community_position: number | string | null;
    is_primary: boolean | null;
  };


type ViewerPlanLineageRow = {
  plan_id: string;
  source_count: number | string | null;
  source_intent_id: string | null;
  source_activity_name: string | null;
};

type ProfileIntentReactionRow = {
  reaction_id: string;
  reaction_type: "save" | "paw";
  reaction_visibility: "only_me" | "friends" | "everyone";
  reacted_at: string;
  intent_id: string;
  resource_id: string;
  plan_id: string | null;
  owner_user_id: string;
  owner_full_name: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
  activity_name: string;
  activity_cover_url: string | null;
  category_name: string;
  category_cover_url: string | null;
  city: string | null;
  district: string | null;
  start_date: string;
  end_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  lifecycle_status: string;
  total_count: number | string;
};

type ProfileDisplayOrderRow = {
  item_type: "seed" | "credential" | "badge";
  item_id: string;
  sort_order: number | string;
};

function deduplicateById<Item extends { id: string }>(items: Item[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function getInitial(value: string | null) {
  return value?.trim().charAt(0).toUpperCase() || "?";
}

function sortByProfileDisplayOrder<Item>(
  items: Item[],
  getId: (item: Item) => string,
  orderMap: Map<string, number>
) {
  const fallbackStart = 1_000_000;

  return [...items].sort((left, right) => {
    const leftId = getId(left);
    const rightId = getId(right);
    const leftOrder = orderMap.get(leftId);
    const rightOrder = orderMap.get(rightId);

    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? fallbackStart) - (rightOrder ?? fallbackStart);
    }

    return 0;
  });
}

function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function toCount(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getIntentType(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const days = Math.max(Math.ceil((end - start) / 86_400_000), 0);

  if (days <= 30) return "Short-term Intent";
  if (days <= 365) return "Strategic Intent";
  return "Telos Intent";
}

function getCatalogueKey(categoryName: string, activityName: string) {
  return `${categoryName.trim().toLocaleLowerCase("en-US")}::${activityName
    .trim()
    .toLocaleLowerCase("en-US")}`;
}

function emptyDiscoverFields(): Pick<
  DiscoverIntentRow,
  | "activity_id"
  | "category_id"
  | "location_id"
  | "relevance"
  | "total_count"
  | "timezone"
  | "scheduled_start"
  | "scheduled_end"
  | "completed_at"
  | "cancelled_at"
  | "participant_eligibility"
> {
  return {
    activity_id: "",
    category_id: "",
    location_id: "",
    relevance: 0,
    total_count: 0,
    timezone: "Europe/Istanbul",
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    cancelled_at: null,
    participant_eligibility:
      "everyone",
  };
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const [{ data, error }, viewerResult] = await Promise.all([
    supabase.rpc("get_public_profile_page_with_participation_visibility", {
      p_username: decodeURIComponent(username),
    }),
    supabase.auth.getUser(),
  ]);

  if (error || !data) {
    console.error("Public profile query failed:", error);
    notFound();
  }

  const rawPage = data as ProfilePageData;
  const profile = rawPage.profile;
  const viewerUserId = viewerResult.data.user?.id ?? "";

  const {
    data: hiddenResourceData,
    error: hiddenResourceError,
  } = await supabase.rpc(
    "get_profile_hidden_resource_keys",
    {
      p_profile_user_id: profile.id,
    }
  );

  if (hiddenResourceError) {
    console.error(
      "Profile hidden resource query failed:",
      hiddenResourceError
    );
  }

  const hiddenResources =
    (hiddenResourceData ?? []) as Array<{
      resource_type: "intent" | "plan";
      resource_id: string;
    }>;

  const hiddenIntentIds = new Set(
    hiddenResources
      .filter((item) => item.resource_type === "intent")
      .map((item) => item.resource_id)
  );

  const hiddenPlanIds = new Set(
    hiddenResources
      .filter((item) => item.resource_type === "plan")
      .map((item) => item.resource_id)
  );

  const activeIntents = deduplicateById(rawPage.active_intents)
    .filter((item) => !hiddenIntentIds.has(item.id));
  const formingActivities = deduplicateById(rawPage.forming_activities)
    .filter((item) => !hiddenPlanIds.has(item.id));
  const upcomingActivities = deduplicateById(rawPage.upcoming_activities)
    .filter((item) => !hiddenPlanIds.has(item.id));
  const completedActivities = deduplicateById(rawPage.completed_activities)
    .filter((item) => !hiddenPlanIds.has(item.id));

  const page: ProfilePageData = {
    ...rawPage,
    summary: {
      ...rawPage.summary,
      active_intents: activeIntents.length,
      forming_activities: formingActivities.length,
      upcoming_activities: upcomingActivities.length,
      completed_activities: completedActivities.length,
    },
    active_intents: activeIntents,
    forming_activities: formingActivities,
    upcoming_activities: upcomingActivities,
    completed_activities: completedActivities,
  };

  const { data: minorContextData, error: minorContextError } =
    await supabase.rpc("get_public_minor_profile_context", {
      p_profile_user_id: profile.id,
    });

  if (minorContextError) {
    console.error("Managed minor profile context query failed:", minorContextError);
  }

  const minorContext = (
    minorContextData ?? {
      is_managed_minor: false,
      age_state: "age_unverified",
      viewer_user_id: null,
      viewer_is_guardian: false,
      viewer_guardian_role: null,
      viewer_can_follow_guardians: false,
      guardian_count: 0,
    }
  ) as ManagedMinorContext;

  if (minorContext.is_managed_minor) {
    const { data: guardianData, error: guardianError } = await supabase.rpc(
      "get_public_profile_guardians",
      { p_child_user_id: profile.id }
    );

    if (guardianError) {
      console.error("Public guardian query failed:", guardianError);
    }

    return (
      <ManagedMinorPublicProfile
        profile={profile}
        context={minorContext}
        guardians={(guardianData ?? []) as PublicGuardianRow[]}
        viewerIsAuthenticated={page.viewer.is_authenticated}
        viewerIsOwner={page.viewer.is_owner}
      />
    );
  }

  const [visibleSeedResult, displayOrderResult] = await Promise.all([
    supabase.rpc("get_visible_profile_seeds_v2", {
      p_profile_user_id: profile.id,
      p_limit: 40,
    }),
    supabase.rpc("get_visible_profile_display_order", {
      p_profile_user_id: profile.id,
    }),
  ]);

  const { data: visibleSeedData, error: visibleSeedError } = visibleSeedResult;
  const { data: displayOrderData, error: displayOrderError } = displayOrderResult;

  if (visibleSeedError) {
    console.warn(
      "Planted Seeds profile section is temporarily unavailable:",
      visibleSeedError.message
    );
  }

  if (displayOrderError) {
    console.warn(
      "Profile display order is temporarily unavailable:",
      displayOrderError.message
    );
  }

  const displayOrderRows = (
    displayOrderData ?? []
  ) as ProfileDisplayOrderRow[];

  const displayOrderMaps = {
    seed: new Map<string, number>(),
    credential: new Map<string, number>(),
    badge: new Map<string, number>(),
  };

  for (const row of displayOrderRows) {
    const value = Number(row.sort_order);
    if (Number.isFinite(value)) {
      displayOrderMaps[row.item_type].set(row.item_id, value);
    }
  }

  const baseVisibleSeeds = sortByProfileDisplayOrder(
    (visibleSeedData ?? []) as PublicSeedRecord[],
    (seed) => seed.seed_id,
    displayOrderMaps.seed
  );

  const visibleSeedReactionResult =
    baseVisibleSeeds.length > 0
      ? await supabase.rpc("get_visible_seed_reaction_context", {
          p_seed_ids: baseVisibleSeeds.map((seed) => seed.seed_id),
        })
      : { data: [], error: null };

  if (visibleSeedReactionResult.error) {
    console.warn(
      "Seed reaction context is temporarily unavailable:",
      visibleSeedReactionResult.error.message
    );
  }

  const visibleSeedReactionById = new Map(
    parseSeedReactionContexts(visibleSeedReactionResult.data).map(
      (context) => [context.seed_id, context]
    )
  );

  const visibleSeeds = baseVisibleSeeds.map((seed) => ({
    ...seed,
    reaction_context:
      visibleSeedReactionById.get(seed.seed_id) ?? null,
  }));

  const { data: publicPreferencesData, error: publicPreferencesError } =
    await supabase.rpc("get_public_preferences_v2921", {
      p_username: profile.username,
    });

  if (publicPreferencesError) {
    console.warn("Public favorites are temporarily unavailable:", publicPreferencesError.message);
  }

  const publicPreferences = (publicPreferencesData ?? {}) as {
    favorites?: PublicFavoriteItem[];
    shared_favorite_count?: number | string;
  };
  const publicFavorites = Array.isArray(publicPreferences.favorites)
    ? publicPreferences.favorites
    : [];

  const [savedReactionResult, pawedReactionResult] = await Promise.all([
    page.viewer.is_owner
      ? supabase.rpc("get_profile_visible_intent_reactions", {
          p_profile_user_id: profile.id,
          p_reaction_type: "save",
          p_limit: 60,
          p_offset: 0,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("get_profile_visible_intent_reactions", {
      p_profile_user_id: profile.id,
      p_reaction_type: "paw",
      p_limit: 60,
      p_offset: 0,
    }),
  ]);

  if (savedReactionResult.error) {
    console.warn(
      "Saved Intent profile section is temporarily unavailable:",
      savedReactionResult.error.message
    );
  }

  if (pawedReactionResult.error) {
    console.warn(
      "Pawed Intent profile section is temporarily unavailable:",
      pawedReactionResult.error.message
    );
  }

  const savedReactionRows =
    (savedReactionResult.data ?? []) as ProfileIntentReactionRow[];
  const pawedReactionRows =
    (pawedReactionResult.data ?? []) as ProfileIntentReactionRow[];
  const reactionIntentIds = Array.from(
    new Set(
      [...savedReactionRows, ...pawedReactionRows].map(
        (row) => row.intent_id
      )
    )
  );

  const planIds = [
    ...formingActivities.map((item) => item.id),
    ...upcomingActivities.map((item) => item.id),
    ...completedActivities.map((item) => item.id),
  ];

  const {
    data: planSourceIntentData,
    error: planSourceIntentError,
  } = planIds.length > 0
    ? await supabase.rpc(
        "get_visible_plan_source_intents",
        {
          p_plan_ids: planIds,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (planSourceIntentError) {
    console.error(
      "Profile Plan source Intent query failed:",
      planSourceIntentError
    );
  }

  const sourceIntentByPlanId = new Map(
    (
      (planSourceIntentData ?? []) as PlanSourceIntentRow[]
    ).map((row) => [
      row.plan_id,
      row.intent_id,
    ])
  );

  const activityNames = Array.from(
    new Set([
      ...activeIntents.map((item) => item.activity_name),
      ...formingActivities.map((item) => item.activity_name),
      ...upcomingActivities.map((item) => item.activity_name),
      ...completedActivities.map((item) => item.activity_name),
    ])
  );

  const activeIntentIds = activeIntents.map((item) => item.id);

  const presentationIntentIds = Array.from(
    new Set([
      ...activeIntentIds,
      ...formingActivities.map(
        (item) => item.source_intent_id
      ),
      ...sourceIntentByPlanId.values(),
      ...reactionIntentIds,
    ])
  );

  const participantEligibilityIntentIds = presentationIntentIds;

  const [
    familyResult,
    connectionResult,
    presenceResult,
    planMetadataResult,
    visiblePlanPresentationResult,
    catalogueActivityResult,
    participantResult,
    reputationResult,
    professionalStatusResult,
    publicGenderResult,
    eligibilityContextResult,
    presentationContextResult,
    reactionContextResult,
    publicActivityLocationResult,
  ] = await Promise.all([
    supabase.rpc("get_visible_profile_family", {
      p_profile_user_id: profile.id,
    }),
    supabase.rpc("get_profile_connection_summary", {
      p_profile_user_id: profile.id,
    }),
    supabase.rpc("get_public_profile_presence", {
      p_profile_user_id: profile.id,
    }),
    planIds.length > 0
      ? supabase.rpc("get_visible_plan_card_metadata", {
          p_plan_ids: planIds,
        })
      : Promise.resolve({ data: [], error: null }),
    planIds.length > 0
      ? supabase.rpc("get_visible_plan_presentations", {
          p_plan_ids: planIds,
        })
      : Promise.resolve({ data: [], error: null }),
    activityNames.length > 0
      ? supabase
          .from("activities")
          .select("id, name, category_id, default_cover_url")
          .in("name", activityNames)
      : Promise.resolve({ data: [], error: null }),
    activeIntentIds.length > 0
      ? supabase
          .from("intent_participants")
          .select("intent_id, user_id")
          .in("intent_id", activeIntentIds)
          .eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc(
      "get_public_reputation_summary",
      {
        p_user_id: profile.id,
      }
    ),
    supabase.rpc(
      "get_public_profile_professional_status",
      {
        p_username: profile.username,
      }
    ),
    supabase.rpc(
      "get_public_profile_gender",
      {
        p_username: profile.username,
      }
    ),
    participantEligibilityIntentIds.length > 0
      ? supabase.rpc(
          "get_visible_intent_participant_eligibility",
          {
            p_intent_ids:
              participantEligibilityIntentIds,
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        }),
    presentationIntentIds.length > 0
      ? supabase.rpc(
          "get_public_visible_intent_presentation_context",
          {
            p_intent_ids: presentationIntentIds,
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        }),
    presentationIntentIds.length > 0
      ? supabase.rpc(
          "get_visible_intent_reaction_context",
          {
            p_intent_ids: presentationIntentIds,
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        }),
    planIds.length > 0
      ? supabase.rpc(
          "get_visible_public_plan_activity_locations",
          {
            p_plan_ids: planIds,
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (familyResult.error) console.error("Visible family query failed:", familyResult.error);
  if (connectionResult.error) console.error("Profile connection summary failed:", connectionResult.error);
  if (presenceResult.error) console.error("Profile presence query failed:", presenceResult.error);
  if (planMetadataResult.error) console.error("Plan card metadata query failed:", planMetadataResult.error);
  if (visiblePlanPresentationResult.error) console.error("Plan presentation query failed:", visiblePlanPresentationResult.error);
  if (catalogueActivityResult.error) console.error("Catalogue cover query failed:", catalogueActivityResult.error);
  if (participantResult.error) console.error("Intent participant query failed:", participantResult.error);
  if (reputationResult.error) console.error("Public reputation query failed:", reputationResult.error);
  if (professionalStatusResult.error) console.error("Public professional status query failed:", professionalStatusResult.error);
  if (publicGenderResult.error) console.error("Public profile gender query failed:", publicGenderResult.error);
  if (eligibilityContextResult.error) console.error("Profile Intent eligibility query failed:", eligibilityContextResult.error);
  if (presentationContextResult.error) {
    console.warn(
      "Public profile Intent presentation context unavailable:",
      presentationContextResult.error.message
    );
  }
  if (reactionContextResult.error) {
    console.warn(
      "Public profile Intent reactions are temporarily unavailable:",
      reactionContextResult.error.message
    );
  }
  if (publicActivityLocationResult.error) console.error("Profile public Activity venue query failed:", publicActivityLocationResult.error);

  const publicActivityLocationByPlanId = new Map(
    (
      (publicActivityLocationResult.data ??
        []) as PublicPlanActivityLocationRow[]
    ).map((row) => [
      row.plan_id,
      row.activity_location_name,
    ])
  );

  const publicGender =
    normalizeProfileGender(
      publicGenderResult.data
    );

  const eligibilityByIntentId =
    new Map(
      (
        (eligibilityContextResult.data ??
          []) as Array<{
          intent_id: string;
          participant_eligibility: unknown;
          viewer_is_eligible: boolean;
        }>
      ).map((row) => [
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

  const presentationContextRows = (
    presentationContextResult.data ?? []
  ) as PublicIntentPresentationContextRow[];

  const sportCoverContextByIntentId = new Map<
    string,
    IntentSportCoverContext
  >();

  for (const row of presentationContextRows) {
    if (
      !sportCoverContextByIntentId.has(
        row.intent_id
      )
    ) {
      sportCoverContextByIntentId.set(
        row.intent_id,
        {
          intent_id: row.intent_id,
          sport_id: row.sport_id,
          sport_name: row.sport_name,
          sport_slug: row.sport_slug,
          sport_cover_url:
            row.sport_cover_url,
          primary_community_id:
            row.primary_community_id,
          primary_community_name:
            row.primary_community_name,
          community_sport_cover_url:
            row.community_sport_cover_url,
          context_cover_url:
            row.context_cover_url,
        }
      );
    }
  }

  const intentCommunitiesByIntentId = new Map<
    string,
    IntentCommunityContext[]
  >();

  parseIntentCommunityRows(
    presentationContextRows
  ).forEach((community) => {
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
  });


  const reactionContextByIntentId = new Map<string, IntentReactionContext>(
    parseIntentReactionContexts(reactionContextResult.data).map((context) => [
      context.intent_id,
      context,
    ])
  );

  const publicFamily = (
    familyResult.data ?? { children: [], relationships: [] }
  ) as RawFamilyData;

  const connectionSummary = (
    connectionResult.data ?? null
  ) as ProfileConnectionSummary | null;

  const presence = (
    presenceResult.data ?? { links: [], embeds: [] }
  ) as ProfilePresenceData;

  const reputationSummary = (
    reputationResult.data ?? {
      is_managed_minor: false,
      participation_count: 0,
      global: null,
      role_summaries: [],
      contexts: [],
    }
  ) as PublicReputationSummary;

  const rawProfessionalStatus = (
    professionalStatusResult.data ?? {
      identity_verified: false,
      credentials: [],
    }
  ) as PublicProfessionalStatus;

  const professionalStatus: PublicProfessionalStatus = {
    ...rawProfessionalStatus,
    credentials: sortByProfileDisplayOrder(
      rawProfessionalStatus.credentials,
      (credential) => credential.id,
      displayOrderMaps.credential
    ),
  };

  const {
    data: badgeData,
    error: badgeError,
  } = await supabase.rpc(
    "get_public_profile_badges",
    {
      p_user_id: profile.id,
    }
  );

  if (badgeError) {
    console.error(
      "Public badge query failed:",
      badgeError
    );
  }

  const publicBadges = sortByProfileDisplayOrder(
    (badgeData ?? []) as PublicBadge[],
    (badge) => badge.id,
    displayOrderMaps.badge
  );

  const {
    data: communityMembershipData,
    error: communityMembershipError,
  } = await supabase.rpc(
    "get_public_profile_community_memberships",
    {
      p_user_id: profile.id,
    }
  );

  if (communityMembershipError) {
    console.warn(
      "Public Community membership query failed; the membership migration may not be applied yet:",
      communityMembershipError
    );
  }

  const publicCommunityMemberships =
    communityMembershipError
      ? []
      : (communityMembershipData ?? []) as PublicCommunityMembership[];

  const youtubeEmbedUrl =
    buildYouTubeEmbedUrl(
      presence.embeds.find(
        (embed) =>
          embed.provider ===
          "youtube"
      )?.source_url
    );

  const visiblePlanPresentations = await hydrateVisiblePlanPresentations(
    supabase,
    (visiblePlanPresentationResult.data ?? []) as VisiblePlanPresentationRow[]
  );

  const visiblePlanPresentationByPlanId = new Map<string, VisiblePlanPresentation>(
    visiblePlanPresentations.map((presentation) => [
      presentation.plan_id,
      presentation,
    ])
  );

  const planMetadata = (planMetadataResult.data ?? []) as PlanCardMetadata[];
  const planMetadataMap = new Map(
    planMetadata.map((item) => [item.plan_id, item])
  );

  const catalogueActivities = (
    catalogueActivityResult.data ?? []
  ) as CatalogueActivityRow[];

  const categoryIds = Array.from(
    new Set(catalogueActivities.map((item) => item.category_id))
  );

  const { data: catalogueCategoryData, error: catalogueCategoryError } =
    categoryIds.length > 0
      ? await supabase
          .from("activity_categories")
          .select("id, name, default_cover_url")
          .in("id", categoryIds)
      : { data: [], error: null };

  if (catalogueCategoryError) {
    console.error("Category cover query failed:", catalogueCategoryError);
  }

  const categoryMap = new Map(
    ((catalogueCategoryData ?? []) as CatalogueCategoryRow[]).map((item) => [
      item.id,
      item,
    ])
  );

  const catalogueCoverMap = new Map<
    string,
    {
      activityId: string;
      categoryId: string;
      activityCoverUrl: string | null;
      categoryCoverUrl: string | null;
    }
  >();

  for (const activity of catalogueActivities) {
    const category = categoryMap.get(activity.category_id);
    if (!category) continue;

    catalogueCoverMap.set(getCatalogueKey(category.name, activity.name), {
      activityId: activity.id,
      categoryId: category.id,
      activityCoverUrl: activity.default_cover_url,
      categoryCoverUrl: category.default_cover_url,
    });
  }

  const participantCounts = new Map<string, number>();
  for (const row of (participantResult.data ?? []) as Array<{
    intent_id: string;
    user_id: string;
  }>) {
    if (row.user_id === profile.id) continue;
    participantCounts.set(
      row.intent_id,
      (participantCounts.get(row.intent_id) ?? 0) + 1
    );
  }

  const displayName = profile.full_name || profile.username;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  function coverData(categoryName: string, activityName: string) {
    return (
      catalogueCoverMap.get(getCatalogueKey(categoryName, activityName)) ?? {
        activityId: "",
        categoryId: "",
        activityCoverUrl: null,
        categoryCoverUrl: null,
      }
    );
  }

  function intentPresentationData(
    intentId: string | null | undefined
  ) {
    if (!intentId) {
      return {
        sport_id: null,
        sport_name: null,
        context_cover_url: null,
        community_contexts: [] as IntentCommunityContext[],
      };
    }

    const sportContext =
      sportCoverContextByIntentId.get(
        intentId
      );

    return {
      sport_id:
        sportContext?.sport_id ??
        null,
      sport_name:
        sportContext?.sport_name ??
        null,
      context_cover_url:
        sportContext?.context_cover_url ??
        null,
      community_contexts:
        intentCommunitiesByIntentId.get(
          intentId
        ) ?? [],
    };
  }

  function reactionItem(
    row: ProfileIntentReactionRow
  ): ProfileIntentReactionItem {
    const presentation = intentPresentationData(row.intent_id);

    return {
      reactionId: row.reaction_id,
      reactionType: row.reaction_type,
      reactionVisibility: row.reaction_visibility,
      reactedAt: row.reacted_at,
      intentId: row.intent_id,
      resourceId: row.resource_id,
      planId: row.plan_id,
      ownerUserId: row.owner_user_id,
      ownerFullName: row.owner_full_name,
      ownerUsername: row.owner_username,
      ownerAvatarUrl: row.owner_avatar_url,
      activityName: row.activity_name,
      activityCoverUrl: row.activity_cover_url,
      categoryName: row.category_name,
      categoryCoverUrl: row.category_cover_url,
      city: row.city,
      district: row.district,
      startDate: row.start_date,
      endDate: row.end_date,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      lifecycleStatus: row.lifecycle_status,
      sportName: presentation.sport_name,
      contextCoverUrl: presentation.context_cover_url,
      communities: presentation.community_contexts,
    };
  }

  const savedReactionItems = savedReactionRows.map(reactionItem);
  const pawedReactionItems = pawedReactionRows.map(reactionItem);

  function ownerData(metadata?: PlanCardMetadata) {
    return {
      owner_user_id: metadata?.host_user_id ?? profile.id,
      owner_full_name: metadata?.host_full_name ?? profile.full_name,
      owner_username: metadata?.host_username ?? profile.username,
      owner_avatar_url: metadata?.host_avatar_url ?? profile.avatar_url,
    };
  }

  function profileRoleLabel(
    relationship: "host" | "co_host" | "participant"
  ) {
    if (relationship === "host") {
      return page.viewer.is_owner
        ? "Hosted by you"
        : `Hosted by ${displayName}`;
    }

    if (relationship === "co_host") {
      return page.viewer.is_owner
        ? "Co-hosted by you"
        : "Co-host";
    }

    return page.viewer.is_owner
      ? "You're participating"
      : "Participant";
  }

  const activeCards: DiscoverIntentRow[] = activeIntents.map((intent) => {
    const cover = coverData(intent.category_name, intent.activity_name);
    const lifecycle: IntentLifecycleStatus =
      intent.start_date > new Date().toISOString().slice(0, 10)
        ? "future"
        : "open";

    return {
      ...emptyDiscoverFields(),
      intent_id: intent.id,
      resource_id: intent.id,
      plan_id: null,
      plan_status: null,
      profile_role: "host",
      profile_role_label: profileRoleLabel("host"),
      ...intentPresentationData(intent.id),
      reaction_context:
        reactionContextByIntentId.get(intent.id) ?? null,
      ...ownerData(),
      activity_id: cover.activityId,
      activity_name: intent.activity_name,
      activity_cover_url: cover.activityCoverUrl,
      category_id: cover.categoryId,
      category_name: intent.category_name,
      category_cover_url: cover.categoryCoverUrl,
      location_id: "",
      city: intent.city,
      district: intent.district,
      start_date: intent.start_date,
      end_date: intent.end_date,
      people: intent.people,
      budget: intent.budget,
      recurrence: intent.recurrence,
      visibility: intent.visibility,
      intent_type: getIntentType(intent.start_date, intent.end_date),
      intent_status: "active",
      recruitment_status: intent.recruitment_status,
      matching_status: "open",
      expired_at: null,
      lifecycle_status: lifecycle,
      max_participants: intent.max_participants,
      active_participant_count: participantCounts.get(intent.id) ?? 0,
      participant_eligibility:
        eligibilityByIntentId.get(
          intent.id
        )?.participantEligibility ??
        "everyone",
      viewer_is_eligible:
        eligibilityByIntentId.get(
          intent.id
        )?.viewerIsEligible ??
        page.viewer.is_owner,
      viewer_can_request: intent.viewer_can_request,
      viewer_is_member:
        page.viewer.is_owner || intent.viewer_join_request_status === "accepted",
      viewer_invitation_status: intent.viewer_invitation_status,
      viewer_request_status: intent.viewer_join_request_status,
      viewer_request_id: intent.viewer_join_request_id,
      created_at: `${intent.start_date}T00:00:00Z`,
    };
  });

  const formingCards: DiscoverIntentRow[] = formingActivities.map((activity) => {
    const cover = coverData(activity.category_name, activity.activity_name);
    const metadata = planMetadataMap.get(activity.id);
    const presentation = visiblePlanPresentationByPlanId.get(activity.id) ?? null;

    return {
      ...emptyDiscoverFields(),
      intent_id: activity.source_intent_id,
      resource_id: activity.id,
      plan_id: activity.id,
      plan_status: "forming",
      plan_cover_url: presentation?.visible_cover_url ?? null,
      public_activity_location_name:
        publicActivityLocationByPlanId.get(
          activity.id
        ) ?? null,
      profile_role: activity.relationship,
      profile_role_label: profileRoleLabel(activity.relationship),
      ...intentPresentationData(activity.source_intent_id),
      reaction_context:
        reactionContextByIntentId.get(activity.source_intent_id) ?? null,
      ...ownerData(metadata),
      activity_id: cover.activityId,
      activity_name:
        presentation?.custom_title?.trim() ||
        activity.activity_name,
      activity_cover_url: cover.activityCoverUrl,
      category_id: cover.categoryId,
      category_name: activity.category_name,
      category_cover_url: cover.categoryCoverUrl,
      location_id: "",
      city: activity.city,
      district: activity.district,
      start_date: activity.window_start,
      end_date: activity.window_end,
      people: "shared plan",
      budget: null,
      recurrence: "one-time",
      visibility: metadata?.plan_visibility ?? activity.visibility,
      intent_type: "Shared Plan",
      intent_status: "planned",
      recruitment_status: metadata?.recruitment_status ?? activity.recruitment_status,
      matching_status: "matched",
      expired_at: null,
      lifecycle_status: "forming",
      max_participants: null,
      active_participant_count: Math.max(activity.member_count - 1, 0),
      participant_eligibility:
        eligibilityByIntentId.get(
          activity.source_intent_id
        )?.participantEligibility ??
        "everyone",
      viewer_is_eligible:
        eligibilityByIntentId.get(
          activity.source_intent_id
        )?.viewerIsEligible ??
        page.viewer.is_owner,
      viewer_can_request: activity.viewer_can_request,
      viewer_is_member: page.viewer.is_owner || activity.viewer_is_member,
      viewer_invitation_status: activity.viewer_invitation_status,
      viewer_request_status: activity.viewer_join_request_status,
      viewer_request_id: activity.viewer_join_request_id,
      created_at: `${activity.window_start}T00:00:00Z`,
    };
  });

  function scheduledCard(
    activity: ScheduledActivity,
    lifecycle: "planned" | "completed"
  ): DiscoverIntentRow {
    const cover = coverData(activity.category_name, activity.activity_name);
    const metadata = planMetadataMap.get(activity.id);
    const presentation = visiblePlanPresentationByPlanId.get(activity.id) ?? null;
    const sourceIntentId =
      sourceIntentByPlanId.get(
        activity.id
      ) ?? null;

    return {
      ...emptyDiscoverFields(),
      intent_id: sourceIntentId ?? activity.id,
      resource_id: activity.id,
      plan_id: activity.id,
      plan_status: lifecycle,
      plan_cover_url: presentation?.visible_cover_url ?? null,
      public_activity_location_name:
        publicActivityLocationByPlanId.get(
          activity.id
        ) ?? null,
      profile_role: activity.relationship,
      profile_role_label: profileRoleLabel(activity.relationship),
      ...intentPresentationData(sourceIntentId),
      reaction_context:
        sourceIntentId
          ? reactionContextByIntentId.get(sourceIntentId) ?? null
          : null,
      ...ownerData(metadata),
      activity_id: cover.activityId,
      activity_name:
        presentation?.custom_title?.trim() ||
        activity.activity_name,
      activity_cover_url: cover.activityCoverUrl,
      category_id: cover.categoryId,
      category_name: activity.category_name,
      category_cover_url: cover.categoryCoverUrl,
      location_id: "",
      city: activity.city,
      district: activity.district,
      start_date: dateOnly(activity.scheduled_start),
      end_date: dateOnly(activity.scheduled_end),
      timezone: activity.timezone,
      scheduled_start: activity.scheduled_start,
      scheduled_end: activity.scheduled_end,
      completed_at:
        lifecycle === "completed"
          ? activity.scheduled_end
          : null,
      cancelled_at: null,
      people: activity.relationship,
      budget: null,
      recurrence: "one-time",
      visibility: metadata?.plan_visibility ?? "public",
      intent_type:
        activity.relationship === "host"
          ? "Hosted Activity"
          : activity.relationship === "co_host"
            ? "Co-hosted Activity"
            : "Participated Activity",
      intent_status: lifecycle === "completed" ? "completed" : "planned",
      recruitment_status: metadata?.recruitment_status ?? "closed",
      matching_status: "closed",
      expired_at: null,
      lifecycle_status: lifecycle,
      max_participants: null,
      active_participant_count: Math.max(activity.member_count - 1, 0),
      viewer_can_request: false,
      viewer_is_eligible: true,
      viewer_is_member:
        page.viewer.is_owner || metadata?.viewer_is_member === true,
      viewer_invitation_status: null,
      viewer_request_status: null,
      viewer_request_id: null,
      created_at: activity.scheduled_start,
    };
  }

  const upcomingCards = upcomingActivities.map((activity) =>
    scheduledCard(activity, "planned")
  );
  const completedCards = completedActivities.map((activity) =>
    scheduledCard(activity, "completed")
  );

  const allProfileCards = [
    ...activeCards,
    ...formingCards,
    ...upcomingCards,
    ...completedCards,
  ];

  const profileResourceIds = Array.from(
    new Set(
      allProfileCards.map((card) =>
        card.plan_id ?? card.resource_id ?? card.intent_id
      )
    )
  );

  const profilePlanIds = Array.from(
    new Set(
      allProfileCards
        .map((card) => card.plan_id)
        .filter((planId): planId is string => Boolean(planId))
    )
  );

  const [profilePeopleResponse, profileLineageResponse] = await Promise.all([
    profileResourceIds.length > 0
      ? supabase.rpc("get_visible_activity_people_batch", {
          p_resource_ids: profileResourceIds,
        })
      : Promise.resolve({ data: [], error: null }),
    viewerUserId && profilePlanIds.length > 0
      ? supabase.rpc("get_my_visible_plan_lineage", {
          p_plan_ids: profilePlanIds,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilePeopleResponse.error) {
    console.error("Profile Activity people query failed:", profilePeopleResponse.error);
  }

  if (profileLineageResponse.error) {
    console.error("Profile viewer lineage query failed:", profileLineageResponse.error);
  }

  const profilePeopleByResourceId = groupActivityPeopleByResourceId(
    (profilePeopleResponse.data ?? []) as ActivityPeopleBatchRow[]
  );

  const profileLineageByPlanId = new Map<string, ViewerPlanLineage>();

  ((profileLineageResponse.data ?? []) as ViewerPlanLineageRow[]).forEach((row) => {
    if (!row.source_intent_id) return;

    profileLineageByPlanId.set(row.plan_id, {
      sourceCount: toCount(row.source_count),
      sourceIntentId: row.source_intent_id,
      sourceIntentName: row.source_activity_name,
      sourceIntentHref: `/activities/${encodeURIComponent(row.source_intent_id)}`,
    });
  });

  function enrichProfileCard(card: DiscoverIntentRow): DiscoverIntentRow {
    return {
      ...card,
      activity_people:
        profilePeopleByResourceId.get(
          card.plan_id ?? card.resource_id ?? card.intent_id
        ) ?? [],
      viewer_lineage: card.plan_id
        ? profileLineageByPlanId.get(card.plan_id) ?? null
        : null,
    };
  }

  const enrichedActiveCards = activeCards.map(enrichProfileCard);
  const enrichedFormingCards = formingCards.map(enrichProfileCard);
  const enrichedUpcomingCards = upcomingCards.map(enrichProfileCard);
  const enrichedCompletedCards = completedCards.map(enrichProfileCard);

  const hostedActiveCards = [
    ...enrichedActiveCards,
    ...enrichedFormingCards.filter(
      (card) =>
        card.profile_role === "host" ||
        card.profile_role === "co_host"
    ),
    ...enrichedUpcomingCards.filter(
      (card) =>
        card.profile_role === "host" ||
        card.profile_role === "co_host"
    ),
  ];

  const participatingActiveCards = [
    ...enrichedFormingCards.filter(
      (card) => card.profile_role === "participant"
    ),
    ...enrichedUpcomingCards.filter(
      (card) => card.profile_role === "participant"
    ),
  ];

  const hostedExperienceCards =
    enrichedCompletedCards.filter(
      (card) =>
        card.profile_role === "host" ||
        card.profile_role === "co_host"
    );

  const participatedExperienceCards =
    enrichedCompletedCards.filter(
      (card) => card.profile_role === "participant"
    );

  const hasActiveSocial = [...hostedActiveCards, ...participatingActiveCards].some(
    (card) => card.lifecycle_status === "open"
  );

  const hasActivePersonal = visibleSeeds.some(
    (seed) => seed.status === "active"
  );

  const hasPlanning = [...hostedActiveCards, ...participatingActiveCards].some(
    (card) => card.lifecycle_status === "forming"
  );

  const hasSocialExperiences =
    hostedExperienceCards.length > 0 || participatedExperienceCards.length > 0;

  const hasPersonalExperiences = visibleSeeds.some(
    (seed) => seed.status === "completed"
  );

  const hasUpcoming = [...hostedActiveCards, ...participatingActiveCards].some(
    (card) =>
      card.lifecycle_status === "planned" ||
      card.lifecycle_status === "future"
  );

  const hasFavorites =
    toCount(publicPreferences.shared_favorite_count ?? 0) > 0;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1600px]">
        <Link
          href="/timeline"
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
        </Link>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div
            className={`grid overflow-hidden bg-gray-950 ${
              youtubeEmbedUrl
                ? "md:grid-cols-2"
                : ""
            }`}
          >
            <div className="relative h-64 bg-gradient-to-br from-gray-950 via-slate-900 to-green-950 md:h-72">
              {profile.cover_url && (
                <img
                  src={profile.cover_url}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-gray-950/65 via-transparent to-transparent" />
            </div>

            {youtubeEmbedUrl && (
              <div className="relative aspect-video overflow-hidden border-t border-white/10 bg-black md:aspect-auto md:h-72 md:border-l md:border-t-0">
                <iframe
                  title="Featured YouTube video"
                  src={youtubeEmbedUrl}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />

                <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                  Featured video
                </span>
              </div>
            )}
          </div>

          <div className="relative px-5 pb-8 md:px-8">
            <div className="-mt-16 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-28 w-28 shrink-0 rounded-full border-4 border-white object-cover shadow-lg"
                    />
                  ) : (
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gray-100 text-4xl font-bold text-gray-500 shadow-lg">
                      {getInitial(displayName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h1 className="truncate text-3xl font-bold text-gray-950 md:text-4xl">
                        {displayName}
                      </h1>

                      {professionalStatus.identity_verified && (
                        <VerificationMark />
                      )}
                    </div>
                    <p className="mt-2 text-gray-500">@{profile.username}</p>

                    {publicGender && (
                      <span className="mt-3 inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                        {getProfileGenderLabel(
                          publicGender
                        )}
                      </span>
                    )}

                    <p className="mt-3 text-sm text-gray-400">
                      Joined {formatMonthYear(profile.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {page.viewer.is_owner ? (
                    <>
                      <Link
                        href="/settings/profile"
                        className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                      >
                        Edit Profile
                      </Link>
                      <Link
                        href="/join-requests"
                        className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                      >
                        Join Requests
                      </Link>
                      <Link
                        href="/friends"
                        className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Friends
                      </Link>
                    </>
                  ) : page.viewer.is_authenticated ? (
                    <>
                      <ProfileFollowButton
                        profileUserId={profile.id}
                        initialFollowing={page.viewer.is_following}
                      />
                      <FriendshipButton
                        profileUserId={profile.id}
                        initialFriendshipId={page.viewer.friendship_id}
                        initialStatus={page.viewer.friendship_status}
                        initialDirection={page.viewer.friendship_direction}
                      />
                      <ReportButton
                        targetType="user"
                        targetId={profile.id}
                        targetLabel={displayName}
                        variant="compact"
                      />
                    </>
                  ) : (
                    <Link
                      href="/"
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)_minmax(280px,0.72fr)]">
                <div className="min-w-0">
                  <ProfilePresencePanel
                    links={presence.links}
                    embeds={presence.embeds}
                  />

                  {presence.links.length === 0 &&
                    presence.embeds.every(
                      (embed) => embed.provider !== "spotify"
                    ) && (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-400">
                        Henüz herkese açık bağlantı veya öne çıkan müzik yok.
                      </div>
                    )}
                </div>

                <ProfileConnectionsFamilyPanel
                  connections={connectionSummary}
                  family={publicFamily}
                />

                <aside className="rounded-2xl bg-gray-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Hakkında
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {profile.bio || "Henüz profil açıklaması yok."}
                  </p>

                  {location && (
                    <p className="mt-5 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-600">
                      📍 {location}
                    </p>
                  )}
                </aside>
              </div>
            </div>
          </div>
        </section>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Aktif Sosyal Niyet", value: activeCards.filter((card) => card.lifecycle_status === "open").length, href: "#active-social" },
          { label: "Aktif Kişisel Niyet", value: visibleSeeds.filter((seed) => seed.status === "active").length, href: "#active-personal" },
          { label: "Planlanıyor", value: formingActivities.length, href: "#planning" },
          { label: "Sosyal Deneyim", value: completedActivities.length, href: "#social-experiences" },
          { label: "Kişisel Deneyim", value: visibleSeeds.filter((seed) => seed.status === "completed").length, href: "#personal-experiences" },
          { label: "Yaklaşan", value: upcomingActivities.length + activeCards.filter((card) => card.lifecycle_status === "future").length, href: "#upcoming" },
        ].map((item) => {
          const content = (
            <>
              <p className={`text-3xl font-black ${item.value > 0 ? "text-gray-950 transition group-hover:text-green-800" : "text-gray-300"}`}>
                {item.value}
              </p>
              <p className={`mt-1 text-xs font-bold ${item.value > 0 ? "text-gray-500" : "text-gray-300"}`}>
                {item.label}
              </p>
            </>
          );

          return item.value > 0 ? (
            <a
              key={item.label}
              href={item.href}
              className="group rounded-3xl border border-gray-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
            >
              {content}
            </a>
          ) : (
            <div
              key={item.label}
              aria-disabled="true"
              className="cursor-default rounded-3xl border border-gray-100 bg-white/70 p-5 text-center shadow-sm"
            >
              {content}
            </div>
          );
        })}
      </section>

        <PublicReputationPanel summary={reputationSummary} />

        <PublicBadgesPanel
          badges={publicBadges}
          isOwner={page.viewer.is_owner}
        />

        <PublicProfessionalCredentialsPanel
          status={professionalStatus}
          isOwner={page.viewer.is_owner}
        />

        {hasActiveSocial && (
        <div id="active-social" className="scroll-mt-8">
          <ProfileActivityTabs
            eyebrow="Aktif Sosyal"
            title={`${displayName} · Aktif Sosyal Niyetler`}
            description="Şu anda açık olan sosyal niyetler."
            hostedCards={hostedActiveCards}
            participatingCards={participatingActiveCards}
            currentUserId={viewerUserId}
            isAuthenticated={page.viewer.is_authenticated}
            hostingLabel="Yürüttükleri"
            participatingLabel="Katıldıkları"
            emptyTitle="Aktif sosyal niyet yok"
            emptyDescription="Şu anda gösterilebilecek aktif bir sosyal niyet bulunmuyor."
            lifecycleMode="active"
          />
        </div>
        )}

        {hasActivePersonal && (
        <div id="active-personal" className="scroll-mt-8">
          <PublicSeedsPanel
            displayName={displayName}
            seeds={visibleSeeds}
            isOwner={page.viewer.is_owner}
            isAuthenticated={page.viewer.is_authenticated}
            mode="active"
            eyebrow="Aktif Kişisel"
            title={`${displayName} · Aktif Kişisel Niyetler`}
            description="Henüz deneyime dönüşmemiş aktif kişisel niyetler."
          />
        </div>
        )}

        {hasPlanning && (
        <div id="planning" className="scroll-mt-8">
          <ProfileActivityTabs
            eyebrow="Planlanıyor"
            title={`${displayName} · Planlanıyor`}
            description="Planlama aşamasındaki sosyal niyetler."
            hostedCards={hostedActiveCards}
            participatingCards={participatingActiveCards}
            currentUserId={viewerUserId}
            isAuthenticated={page.viewer.is_authenticated}
            hostingLabel="Yürüttükleri"
            participatingLabel="Katıldıkları"
            emptyTitle="Planlanan sosyal niyet yok"
            emptyDescription="Şu anda planlama aşamasında görünen bir sosyal niyet bulunmuyor."
            lifecycleMode="forming"
          />
        </div>
        )}

        {hasSocialExperiences && (
        <div id="social-experiences" className="scroll-mt-8">
          <ProfileActivityTabs
            eyebrow="Sosyal Deneyimler"
            title={`${displayName} · Sosyal Deneyimler`}
            description="Yürütücü veya katılımcı olarak tamamlanmış sosyal deneyimler."
            hostedCards={hostedExperienceCards}
            participatingCards={participatedExperienceCards}
            currentUserId={viewerUserId}
            isAuthenticated={page.viewer.is_authenticated}
            hostingLabel="Yürüttükleri"
            participatingLabel="Katıldıkları"
            emptyTitle="Sosyal deneyim yok"
            emptyDescription="Bu bölümde gösterilebilecek tamamlanmış bir sosyal deneyim bulunmuyor."
            sortMode="experience"
          />
        </div>
        )}

        {hasPersonalExperiences && (
        <div id="personal-experiences" className="scroll-mt-8">
          <PublicSeedsPanel
            displayName={displayName}
            seeds={visibleSeeds}
            isOwner={page.viewer.is_owner}
            isAuthenticated={page.viewer.is_authenticated}
            mode="completed"
            eyebrow="Kişisel Deneyimler"
            title={`${displayName} · Kişisel Deneyimler`}
            description="Tamamlanmış kişisel niyetler ve yaşanmış deneyimler."
          />
        </div>
        )}

        {hasUpcoming && (
        <div id="upcoming" className="scroll-mt-8">
          <ProfileActivityTabs
            eyebrow="Yaklaşan"
            title={`${displayName} · Yaklaşan`}
            description="Tarihi yaklaşan veya ileri bir tarihe planlanmış sosyal niyetler."
            hostedCards={hostedActiveCards}
            participatingCards={participatingActiveCards}
            currentUserId={viewerUserId}
            isAuthenticated={page.viewer.is_authenticated}
            hostingLabel="Yürüttükleri"
            participatingLabel="Katıldıkları"
            emptyTitle="Yaklaşan sosyal niyet yok"
            emptyDescription="Şu anda yaklaşan bir sosyal niyet bulunmuyor."
            lifecycleMode="upcoming"
          />
        </div>
        )}

        {hasFavorites && (
        <div id="favorites" className="scroll-mt-8">
          <PublicFavoritesPanel
            items={publicFavorites}
            sharedCount={toCount(publicPreferences.shared_favorite_count ?? 0)}
          />
        </div>
        )}

        {page.viewer.is_owner && (
          <ProfileIntentReactions
            eyebrow="Kaydettiklerin"
            title="Sonra bakmak için kaydettiğin niyetler"
            description="Bu listeyi yalnızca sen görürsün. Bir niyeti kaydetmek, görünürlüğü sonradan değişirse erişim hakkı vermez."
            items={savedReactionItems}
            emptyTitle="Henüz kaydettiğin bir niyet yok"
            emptyDescription="Daha sonra dönmek istediğin niyetleri kaydettiğinde burada görünür."
            privateSection
          />
        )}

        {(page.viewer.is_owner || pawedReactionItems.length > 0) && (
          <ProfileIntentReactions
            eyebrow="Destek Verilen Niyetler"
            title={`${displayName} · destek verdiği niyetler`}
            description="Bu bölüm, kullanıcının destek tepkisi verdiği ve görünürlüğü buna izin veren niyetleri gösterir."
            items={pawedReactionItems}
            emptyTitle="Henüz görünür bir destek yok"
            emptyDescription="Bir niyete destek vermek, katılım isteği göndermeden onu öne çıkarmanın bir yoludur."
          />
        )}

        <PublicCommunityMembershipsPanel
          memberships={publicCommunityMemberships}
          isOwner={page.viewer.is_owner}
        />

      </div>
    </main>
  );
}
