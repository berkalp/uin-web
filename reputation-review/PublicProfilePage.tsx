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
import DiscoverIntentCard, {
  type DiscoverIntentRow,
  type IntentLifecycleStatus,
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
import type {
  ProfileConnectionSummary,
  RawFamilyData,
} from "@/utils/profileConnections";

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

function deduplicateById<Item extends { id: string }>(items: Item[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function getInitial(value: string | null) {
  return value?.trim().charAt(0).toUpperCase() || "?";
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
  "activity_id" | "category_id" | "location_id" | "relevance" | "total_count"
> {
  return {
    activity_id: "",
    category_id: "",
    location_id: "",
    relevance: 0,
    total_count: 0,
  };
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-gray-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const [{ data, error }, viewerResult] = await Promise.all([
    supabase.rpc("get_public_profile_page_visibility", {
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

  const planIds = [
    ...formingActivities.map((item) => item.id),
    ...upcomingActivities.map((item) => item.id),
    ...completedActivities.map((item) => item.id),
  ];

  const activityNames = Array.from(
    new Set([
      ...activeIntents.map((item) => item.activity_name),
      ...formingActivities.map((item) => item.activity_name),
      ...upcomingActivities.map((item) => item.activity_name),
      ...completedActivities.map((item) => item.activity_name),
    ])
  );

  const activeIntentIds = activeIntents.map((item) => item.id);

  const [
    familyResult,
    connectionResult,
    presenceResult,
    planMetadataResult,
    catalogueActivityResult,
    participantResult,
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
  ]);

  if (familyResult.error) console.error("Visible family query failed:", familyResult.error);
  if (connectionResult.error) console.error("Profile connection summary failed:", connectionResult.error);
  if (presenceResult.error) console.error("Profile presence query failed:", presenceResult.error);
  if (planMetadataResult.error) console.error("Plan card metadata query failed:", planMetadataResult.error);
  if (catalogueActivityResult.error) console.error("Catalogue cover query failed:", catalogueActivityResult.error);
  if (participantResult.error) console.error("Intent participant query failed:", participantResult.error);

  const publicFamily = (
    familyResult.data ?? { children: [], relationships: [] }
  ) as RawFamilyData;

  const connectionSummary = (
    connectionResult.data ?? null
  ) as ProfileConnectionSummary | null;

  const presence = (
    presenceResult.data ?? { links: [], embeds: [] }
  ) as ProfilePresenceData;

  const youtubeEmbedUrl =
    buildYouTubeEmbedUrl(
      presence.embeds.find(
        (embed) =>
          embed.provider ===
          "youtube"
      )?.source_url
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

  function ownerData(metadata?: PlanCardMetadata) {
    return {
      owner_user_id: metadata?.host_user_id ?? profile.id,
      owner_full_name: metadata?.host_full_name ?? profile.full_name,
      owner_username: metadata?.host_username ?? profile.username,
      owner_avatar_url: metadata?.host_avatar_url ?? profile.avatar_url,
    };
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

    return {
      ...emptyDiscoverFields(),
      intent_id: activity.source_intent_id,
      resource_id: activity.id,
      plan_id: activity.id,
      plan_status: "forming",
      plan_cover_url: metadata?.cover_url ?? null,
      ...ownerData(metadata),
      activity_id: cover.activityId,
      activity_name: activity.title || activity.activity_name,
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

    return {
      ...emptyDiscoverFields(),
      intent_id: activity.id,
      resource_id: activity.id,
      plan_id: activity.id,
      plan_status: lifecycle,
      plan_cover_url: metadata?.cover_url ?? null,
      ...ownerData(metadata),
      activity_id: cover.activityId,
      activity_name: activity.title || activity.activity_name,
      activity_cover_url: cover.activityCoverUrl,
      category_id: cover.categoryId,
      category_name: activity.category_name,
      category_cover_url: cover.categoryCoverUrl,
      location_id: "",
      city: activity.city,
      district: activity.district,
      start_date: dateOnly(activity.scheduled_start),
      end_date: dateOnly(activity.scheduled_end),
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

  const hasTimelineContent =
    activeCards.length > 0 ||
    formingCards.length > 0 ||
    upcomingCards.length > 0 ||
    completedCards.length > 0;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1600px]">
        <Link
          href="/timeline"
          className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
        >
          ← Back to Timeline
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
                    <h1 className="truncate text-3xl font-bold text-gray-950 md:text-4xl">
                      {displayName}
                    </h1>
                    <p className="mt-2 text-gray-500">@{profile.username}</p>
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

              <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)_300px]">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    About
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {profile.bio || "No profile description yet."}
                  </p>

                  <ProfilePresencePanel
                    links={presence.links}
                    embeds={presence.embeds}
                  />
                </div>

                <ProfileConnectionsFamilyPanel
                  connections={connectionSummary}
                  family={publicFamily}
                />

                <aside className="rounded-2xl bg-gray-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Profile Details
                  </p>

                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    {location && <p>📍 {location}</p>}

                    <p>
                      Public Intent updates can be followed without unlocking private visibility.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Active", value: activeCards.length, href: "#active-intents" },
            { label: "Forming", value: formingCards.length, href: "#forming-activities" },
            { label: "Upcoming", value: upcomingCards.length, href: "#upcoming-activities" },
            { label: "Completed", value: completedCards.length, href: "#completed-activities" },
          ].map((metric) =>
            metric.value > 0 ? (
              <Link
                key={metric.label}
                href={metric.href}
                className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {metric.label}
                </p>
                <p className="mt-3 text-3xl font-bold text-gray-950">
                  {metric.value}
                </p>
              </Link>
            ) : (
              <div
                key={metric.label}
                className="rounded-3xl border border-gray-200 bg-white p-5 opacity-55 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {metric.label}
                </p>
                <p className="mt-3 text-3xl font-bold text-gray-950">0</p>
              </div>
            )
          )}
        </section>

        {!hasTimelineContent && (
          <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              No visible Intent history yet
            </h2>
          </section>
        )}

        {[
          {
            id: "active-intents",
            eyebrow: "Active Intents",
            title: `${displayName} is open to opportunities`,
            description: "Current visible Intents that can still become real-world Activities.",
            cards: activeCards,
          },
          {
            id: "forming-activities",
            eyebrow: "Forming Activities",
            title: "Activities currently being planned",
            description: "Shared Plans that have not reached a confirmed schedule yet.",
            cards: formingCards,
          },
          {
            id: "upcoming-activities",
            eyebrow: "Upcoming Activities",
            title: "Confirmed Activities",
            description: "Visible Activities with a final schedule.",
            cards: upcomingCards,
          },
          {
            id: "completed-activities",
            eyebrow: "Completed Activities",
            title: "Activity history",
            description: "Visible Activities this person hosted, co-hosted or joined.",
            cards: completedCards,
          },
        ].map((section) =>
          section.cards.length > 0 ? (
            <section key={section.id} id={section.id} className="mt-10 scroll-mt-8">
              <SectionHeader
                eyebrow={section.eyebrow}
                title={section.title}
                description={section.description}
              />
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {section.cards.map((intent) => (
                  <DiscoverIntentCard
                    key={`${section.id}-${intent.resource_id ?? intent.intent_id}`}
                    intent={intent}
                    currentUserId={viewerUserId}
                    isAuthenticated={page.viewer.is_authenticated}
                  />
                ))}
              </div>
            </section>
          ) : null
        )}

        {page.viewer.is_owner && page.summary.private_archive && (
          <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Private Archive
            </p>
            <h2 className="mt-2 text-xl font-bold text-gray-950">
              Hidden from public view
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Closed", value: page.summary.private_archive.closed },
                { label: "Expired", value: page.summary.private_archive.expired },
                { label: "Cancelled", value: page.summary.private_archive.cancelled },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-950">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <Link
              href="/timeline"
              className="mt-5 inline-flex text-sm font-semibold text-green-700"
            >
              Open Personal Timeline →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
