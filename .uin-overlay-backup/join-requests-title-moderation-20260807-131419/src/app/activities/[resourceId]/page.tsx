import type { Metadata } from "next";
import Link from "next/link";

import ActivityLifecycleTimeline from "@/components/activities/ActivityLifecycleTimeline";
import ActivityShareMenu from "@/components/share/ActivityShareMenu";
import ExperiencePanel from "@/components/experiences/ExperiencePanel";
import ContextReputationBadge from "@/components/reputation/ContextReputationBadge";
import ReputationFeedbackTargetsPanel from "@/components/reputation/ReputationFeedbackTargetsPanel";
import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import ParticipantEligibilityBadge from "@/components/intents/ParticipantEligibilityBadge";
import IntentReactionBar from "@/components/reactions/IntentReactionBar";
import ResourceArchiveButton from "@/components/archive/ResourceArchiveButton";
import IntentLinksDisplay from "@/components/intents/IntentLinksDisplay";
import ReportButton from "@/components/moderation/ReportButton";
import {
  getActivityVisibilityLabel,
  type ActivityVisibility,
} from "@/utils/activityVisibility";
import {
  formatEstimatedCost,
} from "@/utils/estimatedCost";
import {
  resolveActivityCover,
} from "@/utils/activityCover";
import { createClient } from "@/utils/supabase/server";
import {
  hydrateVisiblePlanPresentations,
  type VisiblePlanPresentationRow,
} from "@/utils/planPresentationVisibility";
import {
  parseIntentLinkRows,
  type IntentLinkRpcRow,
} from "@/utils/intentLinks";
import {
  parseExperienceBundle,
  type ExperienceBundle,
} from "@/utils/experience";
import type {
  ContextualReputation,
  ReputationFeedbackTarget,
} from "@/utils/reputation";
import {
  normalizeParticipantEligibility,
} from "@/utils/participationEligibility";
import { parseIntentReactionContexts } from "@/utils/intentReactions";
import {
  resolveReturnNavigation,
  withReturnContext,
  type ReturnSearchParams,
} from "@/utils/returnNavigation";

type ActivityDetailPageProps = {
  params: Promise<{
    resourceId: string;
  }>;
  searchParams?: Promise<ReturnSearchParams>;
};

type ActivityDetailData = {
  resource_type: "intent" | "plan";

  viewer: {
    is_authenticated: boolean;
    is_owner: boolean;
    is_member: boolean;
    role: "host" | "co_host" | "participant" | null;
    can_request: boolean;
    invitation_status:
      | "pending"
      | "accepted"
      | "declined"
      | "revoked"
      | "expired"
      | null;
    join_request_status:
      | "pending"
      | "accepted"
      | "declined"
      | "withdrawn"
      | null;
    join_request_id: string | null;
  };

  activity: {
    resource_id: string;
    intent_id: string | null;
    plan_id: string | null;
    title: string;
    activity_name: string;
    category_name: string;
    description: string | null;
    status: string;
    visibility: ActivityVisibility;
    recruitment_status: "open" | "full" | "closed";
    city: string | null;
    district: string | null;
    window_start: string | null;
    window_end: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    timezone: string;
    meeting_point: string | null;
    member_count: number;
    participant_count: number;
    max_participants: number | null;
    budget: number | null;
    completed_at: string | null;
    host_user_id: string;
    host_full_name: string | null;
    host_username: string | null;
    host_avatar_url: string | null;
    viewer_attendance_status:
      | "pending"
      | "attended"
      | "no_show"
      | null;
  };
};

type ActivityTimelineData = {
  resource_type: "intent" | "plan";
  status: string;
  timezone: string;
  target_start: string | null;
  target_end: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
};

type CatalogueCoverRow = {
  id: string;
  default_cover_url: string | null;
  activity_categories:
    | {
        name: string;
        default_cover_url: string | null;
      }
    | Array<{
        name: string;
        default_cover_url: string | null;
      }>
    | null;
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

type PublicExperienceCoverRow = {
  plan_id: string;
  media_id: string;
  storage_path: string | null;
  external_url: string | null;
};

type ActivityPersonRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: "host" | "co_host" | "participant" | string;
};

type IntentProfessionalRequirementData = {
  intent_id: string;
  requirement: "preferred" | "required";
  role_id: string;
  role_name: string;
  scope_type: "category" | "activity";
  category_name: string;
  activity_name: string | null;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | null,
  timezone: string
) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toLocaleString("en-GB");
  }
}

function getStatusPresentation(status: string) {
  if (status === "forming") {
    return {
      label: "Forming Activity",
      helper: "Planning is in progress",
      classes: "bg-violet-100 text-violet-800",
    };
  }

  if (status === "planned") {
    return {
      label: "Planned Activity",
      helper: "The schedule is confirmed",
      classes: "bg-indigo-100 text-indigo-800",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      helper: "This Activity has been completed",
      classes: "bg-purple-100 text-purple-800",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      helper: "This Activity was cancelled",
      classes: "bg-red-100 text-red-800",
    };
  }

  return {
    label: "Open Intent",
    helper: "This Intent can still become a real-world Activity",
    classes: "bg-green-100 text-green-800",
  };
}

function getCategoryCoverRecord(
  row: CatalogueCoverRow | null
) {
  if (!row?.activity_categories) {
    return null;
  }

  return Array.isArray(row.activity_categories)
    ? row.activity_categories[0] ?? null
    : row.activity_categories;
}

function getParticipantLimit(
  maxParticipants: number | null
) {
  return maxParticipants === null
    ? "Unlimited"
    : String(maxParticipants);
}

function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(
      /\/$/,
      ""
    );
  }

  const vercelUrl =
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (vercelUrl) {
    return `https://${vercelUrl.replace(
      /\/$/,
      ""
    )}`;
  }

  return "http://localhost:3000";
}

function getActivityCanonicalUrl(
  resourceId: string
) {
  return `${getSiteUrl()}/activities/${encodeURIComponent(
    resourceId
  )}`;
}

function getIntentShareContent({
  activity,
  hostName,
}: {
  activity: ActivityDetailData["activity"];
  hostName: string;
}) {
  const locationParts = [
    activity.district,
    activity.city,
    "Türkiye",
  ].filter(Boolean);

  const locationLabel = [
    ...new Set(
      locationParts
    ),
  ].join(", ");

  const targetWindow =
    activity.window_start
      ? activity.window_end &&
        activity.window_end !==
          activity.window_start
        ? `${formatDate(
            activity.window_start
          )} – ${formatDate(
            activity.window_end
          )}`
        : formatDate(
            activity.window_start
          )
      : null;

  const shareActivityTitle =
    activity.status === "completed"
      ? activity.activity_name
      : activity.title;

  const title =
    `${hostName}'s ${shareActivityTitle} Intent`;

  const parts = [
    `${hostName} has a ${shareActivityTitle} Intent on UIN.`,
    targetWindow
      ? `Target availability: ${targetWindow}.`
      : null,
    locationLabel
      ? `Approximate area: ${locationLabel}.`
      : null,
    "Are you in?",
  ].filter(Boolean);

  return {
    title,
    description:
      parts.join(" "),
  };
}

async function loadActivitySharePreview(
  resourceId: string
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_activity_detail_page",
    {
      p_resource_id:
        resourceId,
    }
  );

  if (
    error ||
    !data
  ) {
    return null;
  }

  const page =
    data as ActivityDetailData;

  const activity =
    page.activity;

  const catalogueResult =
    await supabase
      .from("activities")
      .select(
        `
          default_cover_url,
          activity_categories!inner (
            name,
            default_cover_url
          )
        `
      )
      .eq(
        "name",
        activity.activity_name
      )
      .eq(
        "activity_categories.name",
        activity.category_name
      )
      .limit(1)
      .maybeSingle();

  const catalogueRow =
    (
      catalogueResult.data as
        | CatalogueCoverRow
        | null
    ) ?? null;

  const categoryCoverRecord =
    getCategoryCoverRecord(
      catalogueRow
    );

  const {
    data: sportCoverContextData,
    error: sportCoverContextError,
  } = activity.intent_id
    ? await supabase.rpc(
        "get_public_visible_intent_presentation_context",
        {
          p_intent_ids: [
            activity.intent_id,
          ],
        }
      )
    : {
        data: [],
        error: null,
      };

  const sportCoverContext =
    sportCoverContextError
      ? null
      : (
          (
            sportCoverContextData ??
            []
          ) as IntentSportCoverContext[]
        )[0] ??
        null;

  const coverUrl =
    resolveActivityCover({
      planCoverUrl:
        sportCoverContext
          ?.context_cover_url ??
        null,
      activityCoverUrl:
        catalogueRow
          ?.default_cover_url ??
        null,
      categoryCoverUrl:
        categoryCoverRecord
          ?.default_cover_url ??
        null,
      categoryName:
        activity.category_name,
      activityName:
        activity.activity_name,
    });

  return {
    activity,
    coverUrl,
  };
}

export async function generateMetadata({
  params,
}: ActivityDetailPageProps): Promise<Metadata> {
  const {
    resourceId,
  } = await params;

  const canonicalUrl =
    getActivityCanonicalUrl(
      resourceId
    );

  const genericMetadata: Metadata = {
    title: "Shared UIN Intent",
    description:
      "Open this UIN link to see the Intent or Activity details available to you.",
    alternates: {
      canonical:
        canonicalUrl,
    },
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      type: "website",
      siteName: "UIN",
      url: canonicalUrl,
      title:
        "Shared UIN Intent",
      description:
        "Open this UIN link to see the Intent or Activity details available to you.",
    },
    twitter: {
      card: "summary",
      title:
        "Shared UIN Intent",
      description:
        "Open this UIN link to see the Intent or Activity details available to you.",
    },
  };

  if (
    !resourceId ||
    !isValidUuid(
      resourceId
    )
  ) {
    return genericMetadata;
  }

  const preview =
    await loadActivitySharePreview(
      resourceId
    );

  if (
    !preview ||
    preview.activity.visibility !==
      "public"
  ) {
    return genericMetadata;
  }

  const activity =
    preview.activity;

  const hostName =
    activity.host_full_name ||
    activity.host_username ||
    "A UIN member";

  const shareContent =
    getIntentShareContent({
      activity,
      hostName,
    });

  const title =
    `${shareContent.title} | UIN`;

  const description =
    shareContent.description;

  return {
    title,
    description,
    alternates: {
      canonical:
        canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "UIN",
      url: canonicalUrl,
      title,
      description,
      images: [
        {
          url:
            preview.coverUrl,
          width: 1200,
          height: 630,
          alt:
            `${shareContent.title} on UIN`,
        },
      ],
    },
    twitter: {
      card:
        "summary_large_image",
      title,
      description,
      images: [
        preview.coverUrl,
      ],
    },
  };
}

export default async function ActivityDetailPage({
  params,
  searchParams,
}: ActivityDetailPageProps) {
  const { resourceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backNavigation = resolveReturnNavigation(resolvedSearchParams, {
    href: "/discover",
    label: "Discover",
  });
  const supabase = await createClient();

  if (!resourceId || !isValidUuid(resourceId)) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href={backNavigation.href}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to {backNavigation.label}
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-950">
              Invalid Intent address
            </h1>
          </section>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.rpc(
    "get_activity_detail_page",
    {
      p_resource_id: resourceId,
    }
  );

  if (error || !data) {
    if (error) {
      console.error(
        "Activity detail query failed:",
        error
      );
    }

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href={backNavigation.href}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to {backNavigation.label}
          </Link>

          <section className="mt-8 rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Intent unavailable
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-950">
              This Intent or Activity is not visible to you
            </h1>

            <p className="mt-3 text-sm leading-7 text-gray-600">
              It may be private, invite-only, restricted to friends or no longer available.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const page = data as ActivityDetailData;
  const activity = page.activity;
  const viewer = page.viewer;

  const cataloguePromise = supabase
    .from("activities")
    .select(
      `
        id,
        default_cover_url,
        activity_categories!inner (
          name,
          default_cover_url
        )
      `
    )
    .eq("name", activity.activity_name)
    .eq(
      "activity_categories.name",
      activity.category_name
    )
    .limit(1)
    .maybeSingle();

  const linksPromise = activity.intent_id
    ? supabase.rpc("get_visible_intent_links", {
        p_intent_ids: [activity.intent_id],
      })
    : Promise.resolve({
        data: [],
        error: null,
      });

  const peoplePromise = supabase.rpc(
    "get_visible_activity_people",
    {
      p_resource_id: resourceId,
    }
  );

  const timelinePromise = supabase.rpc(
    "get_visible_activity_timeline",
    {
      p_resource_id: resourceId,
    }
  );

  const professionalRequirementPromise =
    supabase.rpc(
      "get_visible_intent_professional_requirement",
      {
        p_resource_id:
          resourceId,
      }
    );

  const experiencePromise =
    activity.plan_id
      ? supabase.rpc(
          "get_visible_experience_gallery_v2",
          {
            p_plan_id:
              activity.plan_id,
          }
        )
      : Promise.resolve({
          data: null,
          error: null,
        });

  const privatePresentationPromise =
    activity.plan_id
      ? supabase.rpc(
          "get_visible_plan_presentations",
          {
            p_plan_ids: [
              activity.plan_id,
            ],
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        });

  const sportCoverContextPromise =
    activity.intent_id
      ? supabase.rpc(
          "get_public_visible_intent_presentation_context",
          {
            p_intent_ids: [
              activity.intent_id,
            ],
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        });

  const eligibilityContextPromise =
    activity.intent_id
      ? supabase.rpc(
          "get_visible_intent_participant_eligibility",
          {
            p_intent_ids: [
              activity.intent_id,
            ],
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        });

  const reactionContextPromise =
    activity.intent_id
      ? supabase.rpc(
          "get_visible_intent_reaction_context",
          {
            p_intent_ids: [activity.intent_id],
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        });

  const [
    catalogueResult,
    linksResult,
    peopleResult,
    timelineResult,
    professionalRequirementResult,
    experienceResult,
    privatePresentationResult,
    sportCoverContextResult,
    eligibilityContextResult,
    reactionContextResult,
  ] = await Promise.all([
    cataloguePromise,
    linksPromise,
    peoplePromise,
    timelinePromise,
    professionalRequirementPromise,
    experiencePromise,
    privatePresentationPromise,
    sportCoverContextPromise,
    eligibilityContextPromise,
    reactionContextPromise,
  ]);

  if (catalogueResult.error) {
    console.error(
      "Activity cover lookup failed:",
      catalogueResult.error
    );
  }

  if (linksResult.error) {
    console.error(
      "Activity related links query failed:",
      linksResult.error
    );
  }

  if (peopleResult.error) {
    console.error(
      "Activity people query failed:",
      peopleResult.error
    );
  }

  if (timelineResult.error) {
    console.error(
      "Activity timeline query failed:",
      timelineResult.error
    );
  }

  if (professionalRequirementResult.error) {
    console.error(
      "Professional requirement query failed:",
      professionalRequirementResult.error
    );
  }

  if (experienceResult.error) {
    console.error(
      "Shared Experience query failed:",
      experienceResult.error
    );
  }

  if (privatePresentationResult.error) {
    console.error(
      "Private Plan presentation query failed:",
      privatePresentationResult.error
    );
  }

  if (eligibilityContextResult.error) {
    console.error(
      "Intent participant eligibility query failed:",
      eligibilityContextResult.error
    );
  }

  if (reactionContextResult.error) {
    console.warn(
      "Intent reaction context is temporarily unavailable:",
      reactionContextResult.error.message
    );
  }

  const reactionContext =
    parseIntentReactionContexts(reactionContextResult.data)[0] ?? null;

  const eligibilityContext =
    (
      (
        eligibilityContextResult.data ??
        []
      ) as Array<{
        participant_eligibility?: unknown;
        viewer_is_eligible?: boolean;
      }>
    )[0] ??
    null;

  const participantEligibility =
    normalizeParticipantEligibility(
      eligibilityContext
        ?.participant_eligibility
    );

  const viewerIsEligible =
    eligibilityContextResult.error
      ? false
      : eligibilityContext
          ?.viewer_is_eligible !==
        false;

  const catalogueRow =
    (catalogueResult.data as CatalogueCoverRow | null) ??
    null;

  const categoryCoverRecord =
    getCategoryCoverRecord(catalogueRow);

  const sportCoverContext =
    sportCoverContextResult.error
      ? null
      : (
          (
            sportCoverContextResult.data ??
            []
          ) as IntentSportCoverContext[]
        )[0] ??
        null;

  const fallbackCoverUrl =
    resolveActivityCover({
      planCoverUrl:
        sportCoverContext
          ?.context_cover_url ??
        null,
      activityCoverUrl:
        catalogueRow?.default_cover_url ?? null,
      categoryCoverUrl:
        categoryCoverRecord?.default_cover_url ?? null,
      categoryName:
        activity.category_name,
      activityName:
        activity.activity_name,
    });

  const relatedLinks = parseIntentLinkRows(
    (linksResult.data ?? []) as IntentLinkRpcRow[]
  );

  const activityPeople = (
    peopleResult.data ?? []
  ) as ActivityPersonRow[];

  const participants =
    activityPeople.filter(
      (person) =>
        person.role !== "host"
    );

  const professionalRequirement =
    (professionalRequirementResult.data as IntentProfessionalRequirementData | null) ??
    null;

  const hydratedPresentations = await hydrateVisiblePlanPresentations(
    supabase,
    (privatePresentationResult.data ?? []) as VisiblePlanPresentationRow[]
  );

  const privatePresentation = hydratedPresentations[0] ?? null;

  const privateExperienceCoverUrl =
    privatePresentation?.signed_experience_cover_url ?? null;

  let publicExperienceCoverUrl: string | null = null;

  if (activity.plan_id) {
    const {
      data: publicCoverData,
      error: publicCoverError,
    } = await supabase.rpc(
      "get_visible_public_experience_covers",
      {
        p_plan_ids: [activity.plan_id],
      }
    );

    if (publicCoverError) {
      console.error(
        "Public Experience cover query failed:",
        publicCoverError
      );
    }

    const publicCover =
      ((publicCoverData ?? []) as PublicExperienceCoverRow[])[0] ?? null;

    if (publicCover?.external_url) {
      publicExperienceCoverUrl = publicCover.external_url;
    } else if (publicCover?.storage_path) {
      const { data: signedPublicCover, error: signedPublicCoverError } =
        await supabase.storage
          .from("experience-media")
          .createSignedUrl(publicCover.storage_path, 60 * 60);

      if (signedPublicCoverError) {
        console.error(
          "Public Experience cover signing failed:",
          signedPublicCoverError
        );
      }

      publicExperienceCoverUrl = signedPublicCover?.signedUrl ?? null;
    }
  }

  const rawExperienceBundle =
    parseExperienceBundle(
      experienceResult.data
    );

  let experienceBundle:
    ExperienceBundle | null =
    rawExperienceBundle;

  if (
    rawExperienceBundle
  ) {
    const signedMedia =
      await Promise.all(
        rawExperienceBundle.media.map(
          async (media) => {
            if (
              (media.mediaType !==
                "photo" &&
                media.mediaType !==
                "video") ||
              !media.storagePath
            ) {
              return media;
            }

            const {
              data: signedData,
              error: signedError,
            } = await supabase.storage
              .from(
                "experience-media"
              )
              .createSignedUrl(
                media.storagePath,
                60 * 60
              );

            if (signedError) {
              console.error(
                "Experience photo signing failed:",
                signedError
              );
            }

            return {
              ...media,
              signedUrl:
                signedData?.signedUrl ??
                null,
            };
          }
        )
      );

    experienceBundle = {
      ...rawExperienceBundle,
      media:
        signedMedia,
    };
  }

  const activityTimeline =
    (timelineResult.data as ActivityTimelineData | null) ?? {
      resource_type: page.resource_type,
      status: activity.status,
      timezone: activity.timezone,
      target_start: activity.window_start,
      target_end: activity.window_end,
      scheduled_start: activity.scheduled_start,
      scheduled_end: activity.scheduled_end,
      completed_at: activity.completed_at,
      cancelled_at: null,
      expired_at: null,
    };

  const [
    feedbackTargetsResult,
    hostReputationResult,
  ] = await Promise.all([
    activity.plan_id &&
    activity.status === "completed" &&
    viewer.is_authenticated
      ? supabase.rpc(
          "get_reputation_feedback_targets",
          {
            p_plan_id:
              activity.plan_id,
          }
        )
      : Promise.resolve({
          data: [],
          error: null,
        }),
    catalogueRow?.id
      ? supabase.rpc(
          "get_public_reputation_context",
          {
            p_user_id:
              activity.host_user_id,
            p_activity_id:
              catalogueRow.id,
          }
        )
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  if (feedbackTargetsResult.error) {
    console.error(
      "Activity feedback targets query failed:",
      feedbackTargetsResult.error
    );
  }

  if (hostReputationResult.error) {
    console.error(
      "Context reputation query failed:",
      hostReputationResult.error
    );
  }

  const feedbackTargets =
    (feedbackTargetsResult.data ??
      []) as ReputationFeedbackTarget[];

  const hostReputation =
    (hostReputationResult.data ??
      null) as ContextualReputation | null;

  const timelineTimezone =
    activityTimeline.timezone ||
    activity.timezone ||
    "Europe/Istanbul";

  const hostName =
    activity.host_full_name ||
    activity.host_username ||
    "UIN host";

  const canonicalActivityName =
    activity.activity_name ||
    activity.title;

  const visibleSharedTitle =
    privatePresentation?.custom_title ||
    experienceBundle?.sharedTitle ||
    null;

  const displayTitle =
    activity.status === "completed"
      ? canonicalActivityName
      : visibleSharedTitle ||
        activity.title;

  const completedSharedTitle =
    activity.status === "completed" &&
    visibleSharedTitle &&
    visibleSharedTitle !== canonicalActivityName
      ? visibleSharedTitle
      : null;

  const coverUrl =
    privateExperienceCoverUrl ||
    publicExperienceCoverUrl ||
    privatePresentation?.visible_cover_url ||
    fallbackCoverUrl;

  const status = getStatusPresentation(
    activity.status
  );

  const isForming = activity.status === "forming";

  const isPlannedOrCompleted =
    activity.status === "planned" ||
    activity.status === "completed";

  const canArchiveResource =
    activity.status === "completed" ||
    activity.status === "cancelled" ||
    activityTimeline.expired_at !== null;

  const activityDetailHref = withReturnContext(
    `/activities/${encodeURIComponent(resourceId)}`,
    backNavigation.href,
    backNavigation.label,
    "activity"
  );

  const roomHref = activity.plan_id
    ? withReturnContext(
        isForming
          ? `/plans/${encodeURIComponent(activity.plan_id)}/planning`
          : `/plans/${encodeURIComponent(activity.plan_id)}/activity`,
        activityDetailHref,
        "Activity",
        "activity"
      )
    : null;

  const scheduleLabel = activity.scheduled_start
    ? `${formatDateTime(
        activity.scheduled_start,
        activity.timezone
      )} → ${formatDateTime(
        activity.scheduled_end,
        activity.timezone
      )}`
    : `${formatDate(
        activity.window_start
      )} → ${formatDate(activity.window_end)}`;

  const reportTargetId =
    activity.plan_id ?? activity.intent_id;

  const reportTargetType: "plan" | "intent" =
    activity.plan_id ? "plan" : "intent";

  const locationLabel = [
    activity.meeting_point,
    activity.district,
    activity.city,
  ]
    .filter(Boolean)
    .join(", ");

  const approximateLocationLabel = [
    activity.district,
    activity.city,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery =
    activity.meeting_point ||
    approximateLocationLabel;

  const mapEmbedUrl = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        mapQuery
      )}&z=12&output=embed`
    : null;

  const mapOpenUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        mapQuery
      )}`
    : null;

  const detailLabel =
    page.resource_type === "intent"
      ? "Intent detail"
      : activity.status === "completed"
        ? "Activity archive"
        : "Shared Activity";

  const canonicalUrl =
    getActivityCanonicalUrl(
      resourceId
    );

  const shareContent =
    getIntentShareContent({
      activity,
      hostName,
    });

  const aboutLabel =
    page.resource_type === "intent"
      ? "About this Intent"
      : "About this Activity";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={backNavigation.href}
              className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
            >
              ← Back to {backNavigation.label}
            </Link>

            {activity.host_username && (
              <Link
                href={`/u/${encodeURIComponent(
                  activity.host_username
                )}`}
                className="text-sm font-semibold text-gray-400 transition hover:text-green-700"
              >
                View host profile
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <ActivityShareMenu
              title={shareContent.title}
              text={shareContent.description}
              url={canonicalUrl}
              isPublic={
                activity.visibility ===
                "public"
              }
            />

            {viewer.is_owner &&
              activity.intent_id &&
              activity.status === "active" && (
                <Link
                  href={`/intents/${encodeURIComponent(
                    activity.intent_id
                  )}/edit`}
                  className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  Edit Intent
                </Link>
              )}

            {viewer.is_member && roomHref && (
              <Link
                href={roomHref}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {isForming
                  ? "Open Planning Room"
                  : activity.status === "completed"
                    ? "Open Activity Archive"
                    : "Open Activity Room"}
              </Link>
            )}

            {canArchiveResource &&
              (viewer.is_owner || viewer.is_member) && (
                <ResourceArchiveButton
                  resourceType={page.resource_type}
                  resourceId={activity.resource_id}
                  redirectTo="/archive"
                />
              )}

            {viewer.is_owner &&
              activity.intent_id && (
                <Link
                  href={`/intents/${encodeURIComponent(
                    activity.intent_id
                  )}/visibility`}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  Manage Visibility
                </Link>
              )}
          </div>
        </div>

        <section className="mt-7 overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
            <div className="relative min-h-[330px] overflow-hidden bg-gray-950 lg:min-h-[390px]">
              <img
                src={coverUrl}
                alt={`${activity.activity_name} cover`}
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/35" />

              <div className="absolute left-5 top-5 flex flex-wrap gap-2 md:left-7 md:top-7">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${status.classes}`}
                >
                  {status.label}
                </span>

                <span className="rounded-full bg-gray-950/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                  {getActivityVisibilityLabel(
                    activity.visibility
                  )}
                </span>

                <ParticipantEligibilityBadge
                  eligibility={
                    participantEligibility
                  }
                />

                <span className="rounded-full bg-gray-950/75 px-3 py-1.5 text-xs font-semibold capitalize text-white backdrop-blur">
                  {activity.recruitment_status}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                  {activity.category_name}
                </p>

                <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-white md:text-6xl">
                  {displayTitle}
                </h1>

                {activity.status === "completed" &&
                completedSharedTitle ? (
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    Shared experience · {completedSharedTitle}
                  </p>
                ) : displayTitle !== canonicalActivityName ? (
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    {canonicalActivityName}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
                  <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur">
                    {detailLabel}
                  </span>

                  {approximateLocationLabel && (
                    <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur">
                      Approximate area · {approximateLocationLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="relative min-h-[260px] overflow-hidden border-t border-gray-200 bg-gray-100 lg:min-h-[390px] lg:border-l lg:border-t-0">
              {mapEmbedUrl ? (
                <iframe
                  title={`${displayTitle} location`}
                  src={mapEmbedUrl}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-full min-h-[260px] items-center justify-center p-8 text-center text-sm text-gray-500">
                  No location preview is available.
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />

              <span className="absolute left-4 top-4 rounded-full bg-gray-950/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                {activity.meeting_point
                  ? "Meeting point"
                  : "Approximate area"}
              </span>

              {mapOpenUrl && (
                <a
                  href={mapOpenUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="absolute bottom-4 right-4 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-blue-700 shadow-lg transition hover:bg-blue-50"
                >
                  Open map ↗
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <ActivityLifecycleTimeline
                targetStart={activityTimeline.target_start}
                targetEnd={activityTimeline.target_end}
                scheduledStart={activityTimeline.scheduled_start}
                scheduledEnd={activityTimeline.scheduled_end}
                completedAt={activityTimeline.completed_at}
                cancelledAt={activityTimeline.cancelled_at}
                expiredAt={activityTimeline.expired_at}
                status={activityTimeline.status}
                timezone={timelineTimezone}
                variant="detail"
                title="From Intent to outcome"
                description="Read the dates in order: when the person was available, what the group confirmed, and what finally happened."
              />

              <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                      Current record
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-gray-950">
                      {status.label}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {status.helper}
                    </p>
                  </div>

                  {locationLabel && (
                    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                      📍 {locationLabel}
                    </div>
                  )}
                </div>
              </section>

              {professionalRequirement && (
                <section className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                        Verified professional preference
                      </p>

                      <h2 className="mt-2 text-xl font-bold text-blue-950">
                        {professionalRequirement.role_name}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-blue-900">
                        {professionalRequirement.requirement === "required"
                          ? `Only people with an approved and current ${professionalRequirement.role_name} credential can match or request to join this Intent.`
                          : `A verified ${professionalRequirement.role_name} is preferred. Other people may still request to join.`}
                      </p>
                    </div>

                    <span className="self-start rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-800">
                      {professionalRequirement.requirement === "required"
                        ? "Required"
                        : "Preferred"}
                    </span>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-blue-700">
                    Credential context: {professionalRequirement.activity_name || professionalRequirement.category_name}
                  </p>
                </section>
              )}

              {activity.description && (
                <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                    {aboutLabel}
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {activity.description}
                  </p>
                </section>
              )}

              {relatedLinks.length > 0 && (
                <section className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                        Related links
                      </p>

                      <h2 className="mt-2 text-lg font-bold text-gray-950">
                        Event, ticket and organizer information
                      </h2>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
                      {relatedLinks.length} link{relatedLinks.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <IntentLinksDisplay links={relatedLinks} />
                  </div>
                </section>
              )}

              {activity.status ===
                  "completed" &&
                experienceBundle?.experience && (
                  <ExperiencePanel
                    bundle={
                      experienceBundle
                    }
                  />
                )}

              <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Participants
                  </p>
                  <p className="mt-2 text-xl font-black text-gray-950">
                    {activity.participant_count} / {getParticipantLimit(activity.max_participants)}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Plan members
                  </p>
                  <p className="mt-2 text-xl font-black text-gray-950">
                    {activity.member_count}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {page.resource_type ===
                    "intent"
                      ? "Estimated cost / person"
                      : "Plan budget"}
                  </p>

                  <p className="mt-2 text-lg font-black text-gray-950">
                    {page.resource_type ===
                    "intent"
                      ? formatEstimatedCost(
                          activity.budget,
                          {
                            includePerPerson:
                              false,
                          }
                        )
                      : activity.budget !==
                          null
                        ? `${Number(
                            activity.budget
                          ).toLocaleString(
                            "en-US"
                          )} TL`
                        : "Not set"}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Visibility
                  </p>
                  <p className="mt-2 text-sm font-black text-gray-950">
                    {getActivityVisibilityLabel(
                      activity.visibility
                    )}
                  </p>
                </div>
              </section>

              {activity.status === "completed" && (
                <section className="mt-5 rounded-3xl border border-purple-200 bg-purple-50 p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Activity record
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-purple-950">
                    Completed Activity
                  </h2>

                  {activity.completed_at && (
                    <p className="mt-2 text-sm text-purple-800">
                      Completed {formatDateTime(
                        activity.completed_at,
                        activity.timezone
                      )}
                    </p>
                  )}

                  {activity.viewer_attendance_status && (
                    <p className="mt-3 text-sm font-semibold text-purple-900">
                      Your attendance: {activity.viewer_attendance_status === "attended"
                        ? "Attended"
                        : activity.viewer_attendance_status === "no_show"
                          ? "Did not attend"
                          : "Not recorded"}
                    </p>
                  )}
                </section>
              )}
            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                  Hosted by
                </p>

                <div className="mt-4 flex items-center gap-4">
                  {activity.host_avatar_url ? (
                    <img
                      src={activity.host_avatar_url}
                      alt={hostName}
                      className="h-16 w-16 rounded-full object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-cyan-700 shadow-sm">
                      {getInitial(hostName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    {activity.host_username ? (
                      <Link
                        href={`/u/${encodeURIComponent(
                          activity.host_username
                        )}`}
                        className="block truncate text-lg font-bold text-gray-950 transition hover:text-green-700"
                      >
                        {hostName}
                      </Link>
                    ) : (
                      <p className="truncate text-lg font-bold text-gray-950">
                        {hostName}
                      </p>
                    )}

                    {activity.host_username && (
                      <p className="mt-1 truncate text-sm text-gray-500">
                        @{activity.host_username}
                      </p>
                    )}
                  </div>
                </div>

                <ContextReputationBadge
                  reputation={hostReputation}
                  activityName={activity.activity_name}
                  categoryName={activity.category_name}
                />
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                      Participants
                    </p>

                    <h2 className="mt-2 text-lg font-bold text-gray-950">
                      People in this Activity
                    </h2>
                  </div>

                  <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                    {participants.length}
                  </span>
                </div>

                {participants.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {participants.map(
                      (person) => {
                        const personName =
                          person.full_name ||
                          person.username ||
                          "UIN member";

                        const personCard = (
                          <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-gray-50 p-3 transition hover:bg-violet-50">
                            {person.avatar_url ? (
                              <img
                                src={person.avatar_url}
                                alt={personName}
                                className="h-11 w-11 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-violet-700 shadow-sm">
                                {getInitial(personName)}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-gray-950">
                                {personName}
                              </p>

                              <p className="mt-0.5 truncate text-xs text-gray-500">
                                {person.username
                                  ? `@${person.username} · `
                                  : ""}
                                {person.role === "co_host"
                                  ? "Co-host"
                                  : "Participant"}
                              </p>
                            </div>
                          </div>
                        );

                        return person.username ? (
                          <Link
                            key={person.user_id}
                            href={`/u/${encodeURIComponent(
                              person.username
                            )}`}
                            className="block"
                          >
                            {personCard}
                          </Link>
                        ) : (
                          <div key={person.user_id}>
                            {personCard}
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-500">
                    No participants are attached to this Activity yet.
                  </p>
                )}
              </section>

              {activity.plan_id &&
                activity.status === "completed" &&
                feedbackTargets.length > 0 && (
                  <ReputationFeedbackTargetsPanel
                    planId={activity.plan_id}
                    targets={feedbackTargets}
                    compact
                  />
                )}

              {activity.intent_id && (
                <IntentReactionBar
                  intentId={activity.intent_id}
                  initialContext={reactionContext}
                  isAuthenticated={viewer.is_authenticated}
                  isOwner={viewer.is_owner}
                  variant="detail"
                />
              )}

              {!viewer.is_owner &&
                activity.intent_id &&
                !isPlannedOrCompleted && (
                  <section className="rounded-3xl border border-green-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                      Join this Intent
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-gray-950">
                      Interested in joining?
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Send a request without unlocking private Planning Room messages.
                    </p>

                    <div className="mt-5">
                      <PublicIntentJoinButton
                        intentId={activity.intent_id}
                        planId={activity.plan_id}
                        activityName={displayTitle}
                        recruitmentStatus={
                          activity.recruitment_status === "full"
                            ? "full"
                            : "open"
                        }
                        visibility={activity.visibility}
                        viewerCanRequest={viewer.can_request}
                        viewerIsEligible={viewerIsEligible}
                        viewerIsMember={viewer.is_member}
                        viewerInvitationStatus={viewer.invitation_status}
                        initialRequestStatus={viewer.join_request_status}
                        initialRequestId={viewer.join_request_id}
                        isAuthenticated={viewer.is_authenticated}
                      />
                    </div>
                  </section>
                )}

              {viewer.is_owner &&
                activity.intent_id &&
                activity.status === "active" && (
                  <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Manage Intent
                    </p>

                    <div className="mt-4 grid gap-3">
                      <Link
                        href={`/intents/${encodeURIComponent(
                          activity.intent_id
                        )}/edit`}
                        className="rounded-xl bg-gray-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                      >
                        Edit Intent
                      </Link>

                      <Link
                        href={`/intents/${encodeURIComponent(
                          activity.intent_id
                        )}/visibility`}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        Manage Visibility
                      </Link>
                    </div>
                  </section>
                )}

              <section className="rounded-3xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Privacy boundary
                </p>

                <p className="mt-3 text-sm leading-7 text-gray-600">
                  This page shows only details allowed by the selected audience. Planning messages, invitation history and member management remain private to the Plan.
                </p>
              </section>

              {viewer.is_authenticated &&
                !viewer.is_owner &&
                reportTargetId && (
                  <ReportButton
                    targetType={reportTargetType}
                    targetId={reportTargetId}
                    targetLabel={displayTitle}
                    variant="compact"
                  />
                )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
