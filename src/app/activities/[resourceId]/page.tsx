import EventCardLinks from "@/components/ideas/EventCardLinks";
import {viewingSummary,type ViewingContext} from "@/utils/clubProfile";
import { commonIntentTitle } from "@/utils/commonIntentTitle";
import type { EventPresentation } from "@/utils/eventPresentation";
import type { Metadata } from "next";
import Link from "next/link";

import ActivityLifecycleTimeline from "@/components/activities/ActivityLifecycleTimeline";
import ActivityPublicMapPanel from "@/components/activities/ActivityPublicMapPanel";
import SportActivityPlanningHero, { type SportFixtureOption } from "@/components/activities/SportActivityPlanningHero";
import ActivityCompactOrigins from "@/components/activities/ActivityCompactOrigins";
import TimelineHomeLogo from "@/components/navigation/TimelineHomeLogo";
import PublicPlanMeetingPoint from "@/components/plans/PublicPlanMeetingPoint";
import PlanOriginsPanel from "@/components/activities/PlanOriginsPanel";
import PlanWeatherBadges from "@/components/weather/PlanWeatherBadges";
import IntentWeatherBadge from "@/components/weather/IntentWeatherBadge";
import ActivityShareMenu from "@/components/share/ActivityShareMenu";
import OpenInUinAppButton from "@/components/mobile/OpenInUinAppButton";
import ExperiencePanel from "@/components/experiences/ExperiencePanel";
import ContextReputationBadge from "@/components/reputation/ContextReputationBadge";
import ReputationFeedbackTargetsPanel from "@/components/reputation/ReputationFeedbackTargetsPanel";
import PublicIntentJoinButton from "@/components/intents/PublicIntentJoinButton";
import ParticipantEligibilityBadge from "@/components/intents/ParticipantEligibilityBadge";
import IntentReactionBar from "@/components/reactions/IntentReactionBar";
import ResourceArchiveButton from "@/components/archive/ResourceArchiveButton";
import IntentRelatedResourcesDisplay from "@/components/intents/IntentRelatedResourcesDisplay";
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
  getEventStatusPresentation,
  type CollaborationActivityTone,
} from "@/lib/collaborationActivity";
import {
  normalizeParticipantEligibility,
} from "@/utils/participationEligibility";
import {
  getPlanOriginCount,
  parsePlanOriginRows,
} from "@/utils/planOrigins";
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

type IntentSeedOriginRow = {
  seed_id: string;
  seed_type_name: string;
  seed_type_icon: string;
  seed_scope: "library" | "private" | string;
  display_title: string;
  cover_url: string | null;
  relationship: string;
  viewer_is_owner: boolean;
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

type ActivityCommonTargetContext = {
  canonical_target_id: string;
  canonical_target_title: string;
  intent_location: string | null;
  location_scope: string | null;
};

type SportTargetCard = { metadata?:{club_profile?:{logo_url?:string|null}} };

function isSportFixtureOption(value: unknown): value is SportFixtureOption {
  if (!value || typeof value !== "object") return false;
  const fixture = value as Record<string, unknown>;
  return typeof fixture.id === "string" &&
    typeof fixture.match_name === "string" &&
    typeof fixture.match_date === "string" &&
    (fixture.venue === null || typeof fixture.venue === "string") &&
    typeof fixture.selected === "boolean";
}

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
    return "Belirtilmedi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
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
    return "Belirtilmedi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return date.toLocaleString("tr-TR");
  }
}

const STATUS_TONE_CLASSES: Record<CollaborationActivityTone, string> = {
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-900",
  slate: "bg-slate-200 text-slate-800",
  red: "bg-red-100 text-red-800",
};

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
  maxKatılımcılar: number | null
) {
  return maxKatılımcılar === null
    ? "Sınırsız"
    : String(maxKatılımcılar);
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
    `${hostName} · ${shareActivityTitle}`;

  const parts = [
    `${hostName}, UIN'de ${shareActivityTitle} etkinliğini paylaştı.`,
    targetWindow
      ? `Tarih: ${targetWindow}.`
      : null,
    locationLabel
      ? `Yaklaşık konum: ${locationLabel}.`
      : null,
    "Sen de katılmak ister misin?",
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
    title: "UIN Etkinliği",
    description:
      "Etkinliğin ayrıntılarını UIN'de gör.",
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
        "UIN Etkinliği",
      description:
        "Etkinliğin ayrıntılarını UIN'de gör.",
    },
    twitter: {
      card: "summary",
      title:
        "UIN Etkinliği",
      description:
        "Etkinliğin ayrıntılarını UIN'de gör.",
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
            `${shareContent.title} · UIN`,
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

// UIN_ACTIVITY_DETAIL_REDESIGN_V1
export default async function ActivityDetailPage({
  params,
  searchParams,
}: ActivityDetailPageProps) {
  const { resourceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backNavigation = resolveReturnNavigation(resolvedSearchParams, {
    href: "/discover",
    label: "Etkinlikler",
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
            ← Geri {backNavigation.label}
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-950">
              Geçersiz etkinlik adresi
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

  if (error) {
    console.error(
      "Activity detail query failed:",
      error
    );

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href={backNavigation.href}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Geri {backNavigation.label}
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Yükleme sorunu
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-950">
              Etkinlik şu anda yüklenemedi
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
              Eksik veya yanlış bilgi göstermemek için etkinlik ayrıntılarını gizledik. Biraz sonra yeniden deneyebilirsin.
            </p>

            <a
              href={`/activities/${encodeURIComponent(resourceId)}`}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
            >
              Yeniden dene
            </a>
          </section>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href={backNavigation.href}
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Geri {backNavigation.label}
          </Link>

          <section className="mt-8 rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Etkinlik kullanılamıyor
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-950">
              Bu etkinliği görüntüleyemezsin
            </h1>

            <p className="mt-3 text-sm leading-7 text-gray-600">
                           Etkinlik özel, davete bağlı, yalnızca arkadaşlara açık veya artık kullanılamıyor olabilir.
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

  const commonTargetPromise = activity.intent_id
    ? supabase.rpc("get_visible_activity_common_context_v41", {
        p_intent_id: activity.intent_id,
      })
    : Promise.resolve({ data: null, error: null });

  const planOriginsPromise = activity.plan_id
    ? supabase.rpc("get_visible_plan_origins", {
        p_plan_id: activity.plan_id,
      })
    : Promise.resolve({
        data: [],
        error: null,
      });

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
          "get_visible_experience_gallery_v3",
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

  const seedOriginsPromise = activity.intent_id
    ? supabase.rpc("get_visible_intent_seed_origins", { p_intent_id: activity.intent_id })
    : Promise.resolve({ data: [], error: null });

  const eventPresentationPromise = supabase.rpc("get_uin_event_presentation_v86", {
    p_resource_id: resourceId,
  });

  const [
    catalogueResult,
    linksResult,
    peopleResult,
    commonTargetResult,
    planOriginsResult,
    timelineResult,
    professionalRequirementResult,
    experienceResult,
    privatePresentationResult,
    sportCoverContextResult,
    eligibilityContextResult,
    reactionContextResult,
    seedOriginsResult,
    eventPresentationResult,
  ] = await Promise.all([
    cataloguePromise,
    linksPromise,
    peoplePromise,
    commonTargetPromise,
    planOriginsPromise,
    timelinePromise,
    professionalRequirementPromise,
    experiencePromise,
    privatePresentationPromise,
    sportCoverContextPromise,
    eligibilityContextPromise,
    reactionContextPromise,
    seedOriginsPromise,
    eventPresentationPromise,
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

  if (planOriginsResult.error) {
    console.error(
      "Activity origin query failed:",
      planOriginsResult.error
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

  if (seedOriginsResult.error) {
    console.warn("Intent Seed DNA is temporarily unavailable:", seedOriginsResult.error.message);
  }

  const seedOrigins = (seedOriginsResult.data ?? []) as IntentSeedOriginRow[];

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

  const peopleUnavailable = Boolean(
    peopleResult.error
  );

  const activityPeople = peopleUnavailable
    ? []
    : ((peopleResult.data ?? []) as ActivityPersonRow[]);

  const commonTarget = commonTargetResult.error
    ? null
    : ((commonTargetResult.data as ActivityCommonTargetContext | null) ?? null);

  const isLiveSportActivity=Boolean(commonTarget?.canonical_target_id&&sportCoverContext?.sport_name);
  const [sportTargetCardResult,sportFixturesResult]=isLiveSportActivity&&commonTarget
    ? await Promise.all([
        supabase.rpc("get_uin_card_profile_v60",{p_target_id:commonTarget.canonical_target_id}),
        activity.intent_id?supabase.rpc("get_intent_match_options_v50",{p_intent_id:activity.intent_id}):Promise.resolve({data:[],error:null}),
      ])
    : [{data:[],error:null},{data:[],error:null}];
  const sportTargetCard=(sportTargetCardResult.data as SportTargetCard|null)||null;
  const mediaViewingResult=activity.intent_id?await supabase.rpc("get_uin_media_event_v66",{p_intent_id:activity.intent_id}):null;
  const mediaViewing=mediaViewingResult?.data as {context:ViewingContext;target_id:string;title:string;private_info:string|null}|null;
  const clubViewingResult=activity.intent_id?await supabase.rpc("get_uin_event_viewing_v60",{p_intent_id:activity.intent_id}):null;
  const clubViewing=clubViewingResult?.data as {context:ViewingContext;target_id:string;club_title:string}|null;
  const sportTeamLogo=sportTargetCard?.metadata?.club_profile?.logo_url||null;
  const sportFixturesReadFailed=Boolean(
    isLiveSportActivity&&(
      sportFixturesResult.error||
      !Array.isArray(sportFixturesResult.data)||
      !sportFixturesResult.data.every(isSportFixtureOption)
    )
  );
  const sportFixtures=sportFixturesReadFailed
    ? []
    : (sportFixturesResult.data as SportFixtureOption[]);

  const planOrigins = parsePlanOriginRows(
    planOriginsResult.data
  );
  const planOriginCount = getPlanOriginCount(planOrigins);

  const peopleById = new Map<string, ActivityPersonRow>();
  if (!peopleUnavailable) {
    for (const person of activityPeople) {
      peopleById.set(person.user_id, person);
    }
    peopleById.set(activity.host_user_id, {
      user_id: activity.host_user_id,
      full_name: activity.host_full_name,
      username: activity.host_username,
      avatar_url: activity.host_avatar_url,
      role: "host",
    });
  }
  const participants = Array.from(peopleById.values());
  const visiblePeopleCount = peopleUnavailable
    ? null
    : participants.length;

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
    (eventPresentationResult.data as EventPresentation | null)?.eventLabel ||
    activity.activity_name ||
    activity.title;

  const eventPresentation = eventPresentationResult.data as EventPresentation | null;
  const displayTitle = eventPresentation?.displayTitle || canonicalActivityName;

  const coverUrl =
    privateExperienceCoverUrl ||
    publicExperienceCoverUrl ||
    privatePresentation?.visible_cover_url ||
    fallbackCoverUrl;

  const canonicalStatus = activity.status === "completed" || activity.status === "cancelled"
    ? activity.status
    : activityTimeline.expired_at
      ? "expired"
      : activity.status;
  const statusPresentation = getEventStatusPresentation({
    status: canonicalStatus,
    scheduledStart: activity.scheduled_start,
    scheduledEnd: activity.scheduled_end,
  });
  const status = {
    ...statusPresentation,
    classes: STATUS_TONE_CLASSES[statusPresentation.tone],
  };

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
        "Etkinlik",
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
  const mapLocationLabel =
    approximateLocationLabel || commonTarget?.intent_location || null;
const detailLabel =
    page.resource_type === "intent"
      ? "Etkinlik ayrıntısı"
      : activity.status === "completed"
        ? "Etkinlik arşivi"
        : "Ortak etkinlik";

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
      ? "Bu etkinlik hakkında"
      : "Etkinlik hakkında";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <TimelineHomeLogo className="-ml-2 mr-1" />
            <Link
              href={backNavigation.href}
              className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
            >
              ← Geri {backNavigation.label}
            </Link>

            {activity.host_username && (
              <Link
                href={`/u/${encodeURIComponent(
                  activity.host_username
                )}`}
                className="text-sm font-semibold text-gray-400 transition hover:text-green-700"
              >
                Yürütenin profilini gör
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <OpenInUinAppButton resourceId={resourceId} />
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
                  Etkinliği Düzenle
                </Link>
              )}

                        {viewer.is_owner &&
              activity.plan_id &&
              (isForming || activity.status === "planned") && (
                <Link
                  href={`/plans/${encodeURIComponent(
                    activity.plan_id
                  )}/${isForming ? "planning" : "activity"}#public-content`}
                  className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-100"
                >
                  Bilgileri Düzenle
                </Link>
              )}
{viewer.is_member && roomHref && (
              <Link
                href={roomHref}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {isForming
                  ? "Planlama Odasını Aç"
                  : activity.status === "completed"
                    ? "Etkinlik Arşivini Aç"
                    : "Etkinlik Odasını Aç"}
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
                  Görünürlüğü Yönet
                </Link>
              )}
          </div>
        </div>

        <section className="mt-6">
          <div className={`grid overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm ${isLiveSportActivity?"md:grid-cols-[128px_minmax(0,1fr)]":"lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.82fr)]"}`}>
            <div className={`relative overflow-hidden ${isLiveSportActivity?"m-6 mb-0 h-24 w-24 self-start rounded-2xl border border-gray-200 bg-white md:mr-0":"bg-gray-950 min-h-[330px] lg:min-h-[390px]"}`}>
              {isLiveSportActivity ? (sportTeamLogo ? <img src={sportTeamLogo} alt="Kulüp logosu" className="h-full w-full object-contain p-2"/> : <span aria-label="Kulüp logosu eklenmemiş" className="grid h-full w-full place-items-center bg-gray-50 text-3xl font-black">{commonTarget?.canonical_target_title?.charAt(0)||"⚽"}</span>) : <img src={coverUrl} alt={`${activity.activity_name} cover`} className="absolute inset-0 h-full w-full object-cover"/>}
              <div className={isLiveSportActivity?"hidden":""}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/35" />

              <div className="absolute left-5 top-5 flex flex-wrap gap-2 md:left-7 md:top-7">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${status.classes}`}
                >
                  {page.resource_type === "intent" ? "ETKİNLİK" : status.label}
                </span>

                <span className="rounded-full bg-gray-950/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                  {activity.visibility === "public" ? "Herkese Açık" : getActivityVisibilityLabel(activity.visibility)}
                </span>

                {participantEligibility !== "everyone" && <ParticipantEligibilityBadge eligibility={participantEligibility} />}

                <span className="rounded-full bg-gray-950/75 px-3 py-1.5 text-xs font-semibold capitalize text-white backdrop-blur">
                  {activity.recruitment_status === "open"
                    ? "Katılıma Açık"
                    : activity.recruitment_status === "full"
                      ? "Kontenjan Dolu"
                      : "Katılıma Kapalı"}
                </span>
              </div>

              {activity.plan_id && activity.status === "planned" ? (
                <PlanWeatherBadges
                  planId={activity.plan_id}
                  className="absolute right-4 top-16 z-20 md:right-6 md:top-20"
                />
              ) : activity.intent_id &&
                !["completed", "cancelled", "expired"].includes(activity.status) ? (
                <IntentWeatherBadge
                  intentId={activity.intent_id}
                  className="absolute right-4 top-16 z-20 md:right-6 md:top-20"
                />
              ) : null}

              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                  {activity.category_name}
                </p>

                <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-white">{sportCoverContext?.sport_name && <span className="rounded-full bg-white/20 px-3 py-1.5">{sportCoverContext.sport_name}</span>}</div><h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-white md:text-4xl">
                  {displayTitle}
                </h1>

                {eventPresentation?.dnaCards?.length ? <div className="mt-3 flex flex-wrap gap-2" aria-label="Etkinlik DNA kartları">{eventPresentation.dnaCards.slice(0,3).map(card=><span key={card.targetId} className="rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">⌁ {card.title}</span>)}{eventPresentation.dnaCards.length>3&&<span className="rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-bold text-white">+{eventPresentation.dnaCards.length-3}</span>}</div>:null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
                  <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur">
                    {detailLabel}
                  </span>

                  {activity.plan_id && planOriginCount > 0 && (
                    <a
                      href="#activity-origins"
                      className="rounded-full border border-emerald-300/40 bg-emerald-950/55 px-3 py-1.5 font-bold text-emerald-100 backdrop-blur transition hover:bg-emerald-900/70"
                    >
                      ↘ {planOriginCount > 1
                        ? `${planOriginCount} niyetten oluştu`
                        : "1 niyetten doğdu"}
                    </a>
                  )}

                  {approximateLocationLabel && (
                    <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur">
                      Yaklaşık bölge · {approximateLocationLabel}
                    </span>
                  )}
                  {commonTarget && (
                    <Link
                      href={`/intentions/${encodeURIComponent(commonTarget.canonical_target_id)}`}
                      className="rounded-full border border-emerald-300/40 bg-emerald-950/55 px-3 py-1.5 font-bold text-emerald-100 backdrop-blur transition hover:bg-emerald-900/70"
                    >
                      ▦ UIN kartı · {commonIntentTitle(commonTarget.canonical_target_title)}
                    </Link>
                  )}
                </div>
              </div>
              </div>
            </div>

            <div className="overflow-hidden border-t border-gray-200 bg-white lg:border-l lg:border-t-0">
              <EventCardLinks resourceId={resourceId}/>
              {isLiveSportActivity?(sportFixturesReadFailed?<section role="alert" className="m-5 rounded-2xl border border-red-200 bg-red-50 p-5 md:m-7"><p className="text-xs font-black uppercase tracking-[.16em] text-red-700">Fikstür yüklenemedi</p><p className="mt-2 text-sm leading-6 text-red-900">Maç bilgilerini yanlış veya eksik göstermemek için seçim alanını gizledik. Lütfen yeniden dene.</p><a href={`/activities/${encodeURIComponent(resourceId)}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-black text-white">Yeniden dene</a></section>:<SportActivityPlanningHero intentId={activity.intent_id} teamTitle={commonTarget?.canonical_target_title||displayTitle} sportName={sportCoverContext?.sport_name||null} scheduleLabel={scheduleLabel} locationLabel={locationLabel||approximateLocationLabel} hostName={hostName} participantCount={activity.participant_count} maxParticipants={activity.max_participants} visibilityLabel={activity.visibility==="public"?"Herkese Açık":getActivityVisibilityLabel(activity.visibility)} recruitmentLabel={activity.recruitment_status==="open"?"Katılıma Açık":activity.recruitment_status==="full"?"Kontenjan Dolu":"Katılıma Kapalı"} fixtures={sportFixtures} canManage={viewer.is_owner} roomHref={roomHref}/>):<ActivityPublicMapPanel
                planId={activity.plan_id}
                title={displayTitle}
                fallbackActivityLocation={mapLocationLabel}
                fallbackLocationScope={commonTarget?.location_scope ?? null}
              />}
            </div>
          </div>

<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              {mediaViewing&&<section className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-violet-700">{mediaViewing.context.media_kind==="series"?"Dizi izleme etkinliği":"Film izleme etkinliği"}</p><p className="mt-2 font-black">{mediaViewing.title}</p><p className="mt-2 text-sm text-violet-800">{viewingSummary(mediaViewing.context)}</p>{mediaViewing.private_info&&<div className="mt-4 rounded-xl border border-violet-200 bg-white p-4"><p className="text-xs font-bold text-violet-700">Yalnızca düzenleyen ve kabul edilen katılımcılar görebilir</p>{mediaViewing.context.mode==="online"?<a href={mediaViewing.private_info} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-violet-800 hover:underline">Çevrim içi izlemeye katıl ↗</a>:<p className="mt-2 whitespace-pre-line text-sm">{mediaViewing.private_info}</p>}</div>}</section>}
              {clubViewing&&<section className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Maç izleme etkinliği</p><a href={"/clubs/"+clubViewing.target_id} className="mt-2 inline-block font-black text-emerald-900 hover:underline">{clubViewing.club_title} · Kulüp profili ↗</a><p className="mt-2 text-sm text-emerald-800">{viewingSummary(clubViewing.context)||"Branş ve izleme biçimi henüz belli değil."}</p></section>}
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
                variant="horizontal"
              />

              {activity.description && (
                <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                    {aboutLabel}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-gray-700">
                    {activity.description}
                  </p>
                </section>
              )}
              {seedOrigins.length > 0 && (
                <section className="mt-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50 p-5 shadow-sm md:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">NİYETİN KÖKENİ</p>
                  <h2 className="mt-2 text-xl font-black text-gray-950">{seedOrigins.length} niyetten doğdu</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">Bu etkinliğin oluşmasını sağlayan kişisel niyetler burada görünür. Özel niyetlerin içeriği diğer kişilerden gizlenir.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {seedOrigins.map((origin) => (
                      <span key={origin.seed_id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${origin.seed_scope === "private" ? "border-gray-300 bg-white text-gray-700" : "border-emerald-200 bg-white text-emerald-800"}`}>
                        <span aria-hidden="true">{origin.seed_type_icon}</span>
                        {origin.seed_scope === "private" && !origin.viewer_is_owner ? "🔒 Özel niyet" : origin.display_title}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {professionalRequirement && (
                <section className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                        Doğrulanmış uzman tercihi
                      </p>

                      <h2 className="mt-2 text-xl font-bold text-blue-950">
                        {professionalRequirement.role_name}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-blue-900">
                        {professionalRequirement.requirement === "required"
                          ? `Yalnızca onaylı ve güncel ${professionalRequirement.role_name} yeterliliği olan kişiler katılma isteği gönderebilir.`
                          : `Doğrulanmış bir ${professionalRequirement.role_name} tercih ediliyor. Diğer kişiler de katılma isteği gönderebilir.`}
                      </p>
                    </div>

                    <span className="self-start rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-800">
                      {professionalRequirement.requirement === "required"
                        ? "Zorunlu"
                        : "Tercih edilen"}
                    </span>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-blue-700">
                    Uzmanlık bağlamı: {professionalRequirement.activity_name || professionalRequirement.category_name}
                  </p>
                </section>
              )}

              {relatedLinks.length > 0 && (
                <section className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                        Bağlantılar ve videolar
                      </p>

                      <h2 className="mt-2 text-lg font-bold text-gray-950">
                        Resmî sayfalar, biletler, videolar ve diğer kaynaklar
                      </h2>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
                      {relatedLinks.length} bağlantı
                    </span>
                  </div>

                  <div className="mt-4">
                    <IntentRelatedResourcesDisplay links={relatedLinks} />
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
                    Katılımcılar
                  </p>
                  <p className="mt-2 text-xl font-black text-gray-950">
                    {visiblePeopleCount === null
                      ? "—"
                      : `${visiblePeopleCount} / ${getParticipantLimit(activity.max_participants)}`}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Plan üyeleri
                  </p>
                  <p className="mt-2 text-xl font-black text-gray-950">
                    {activity.member_count}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {page.resource_type ===
                    "intent"
                      ? "Tahmini kişi başı maliyet"
                      : "Plan bütçesi"}
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
                          "tr-TR"
                          )} TL`
                        : "Belirtilmedi"}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Görünürlük
                  </p>
                  <p className="mt-2 text-sm font-black text-gray-950">
                    {getActivityVisibilityLabel(
                      activity.visibility
                    )}
                  </p>
                </div>
              </section>

            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                  Yürüten
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

              <section id="people" className="scroll-mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                      Katılımcılar
                    </p>

                    <h2 className="mt-2 text-lg font-bold text-gray-950">
                      Bu etkinlikteki insanlar
                    </h2>
                  </div>

                  <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                    {peopleUnavailable ? "—" : participants.length}
                  </span>
                </div>

                {peopleUnavailable ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5">
                    <p className="text-sm font-bold text-amber-950">
                      Katılımcı listesi şu anda yüklenemedi.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                      Eksik bir liste göstermemek için katılımcıları gizledik. Biraz sonra yeniden deneyebilirsin.
                    </p>
                    <a
                      href={`/activities/${encodeURIComponent(resourceId)}#people`}
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-900 transition hover:bg-amber-100"
                    >
                      Katılımcıları yeniden yükle
                    </a>
                  </div>
                ) : participants.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {participants.map(
                      (person) => {
                        const personName =
                          person.full_name ||
                          person.username ||
                          "UIN üyesi";

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
                                  ? "Yardımcı yürütücü"
                                  : person.role === "host"
                                    ? "Yürütücü"
                                    : "Katılımcı"}
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
                    Bu etkinliğe henüz katılımcı eklenmedi.
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



              {!viewer.is_owner &&
                activity.intent_id &&
                !isPlannedOrCompleted && (
                  <section className="rounded-3xl border border-green-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                      BU ETKİNLİĞE KATIL
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-gray-950">
                      Katılmak ister misin?
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Özel planlama mesajlarını görmeden katılma isteği gönderebilirsin.
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
                      ETKİNLİĞİ YÖNET
                    </p>

                    <div className="mt-4 grid gap-3">
                      <Link
                        href={`/intents/${encodeURIComponent(
                          activity.intent_id
                        )}/edit`}
                        className="rounded-xl bg-gray-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                      >
                        Etkinliği Düzenle
                      </Link>

                      <Link
                        href={`/intents/${encodeURIComponent(
                          activity.intent_id
                        )}/visibility`}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        Görünürlüğü Yönet
                      </Link>
                    </div>
                  </section>
                )}

              <section className="rounded-3xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  GİZLİLİK SINIRI
                </p>

                <p className="mt-3 text-sm leading-7 text-gray-600">
                  Bu sayfada yalnızca seçilen kitlenin görebileceği bilgiler yer alır. Planlama mesajları, davet geçmişi ve üye yönetimi etkinliğin katılımcılarına özel kalır.
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
            {activity.plan_id && planOrigins.length > 0 && (
              <div className="lg:col-span-2">
                <ActivityCompactOrigins
                  origins={planOrigins}
                  resultTitle={displayTitle}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
