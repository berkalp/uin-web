import type { ReactNode } from "react";
import PlanWeatherBadges from "../weather/PlanWeatherBadges";
import Link from "next/link";

import ActivityLifecycleTimeline from "../activities/ActivityLifecycleTimeline";
import PlanOriginsPanel from "../activities/PlanOriginsPanel";
import ReputationFeedbackTargetsPanel from "../reputation/ReputationFeedbackTargetsPanel";
import type {
  ReputationFeedbackTarget,
} from "../../utils/reputation";
import {
  notFound,
  redirect,
} from "next/navigation";

import ActivityLocationPreview from "./ActivityLocationPreview";
import PlanCoverQuickEditor from "./PlanCoverQuickEditor";
import PlanCompletionReview, {
  type CompletionMemberData,
  type CompletionPlanData,
} from "./PlanCompletionReview";
import CommunityContextList from "../communities/CommunityContextList";
import ActivityCoverImage from "../media/ActivityCoverImage";
import PlanPresentationSettingsForm from "./PlanPresentationSettingsForm";
import PlanningRoomQuickActions from "./PlanningRoomQuickActions";
import PlanBudgetPanel from "./PlanBudgetPanel";
import PlanNeedsPanel from "./PlanNeedsPanel";
import PlanToolkitPanel from "./PlanToolkitPanel";
import PlanMessageComposer from "./PlanMessageComposer";
import PlanRoomRealtimeRefresh from "./PlanRoomRealtimeRefresh";
import SharedPlanScheduleForm from "./SharedPlanScheduleForm";
import SharedActivityTitleForm from "../experiences/SharedActivityTitleForm";
import ReportCustomActivityTitleButton from "../experiences/ReportCustomActivityTitleButton";
import ExperiencePanel from "../experiences/ExperiencePanel";
import ProfileNameLink from "../profile/ProfileNameLink";
import PlanPeoplePanel, {
  type PlanPeopleInvitation,
  type PlanPeopleMember,
} from "./PlanPeoplePanel";
import IntentInvitePeopleButton from "../intents/IntentInvitePeopleButton";
import ActivityVisibilityManager from "../visibility/ActivityVisibilityManager";
import {
  type ActivityVisibility,
  getActivityVisibilityLabel,
} from "../../utils/activityVisibility";
import {
  getReliableSystemCoverFallback,
  resolveActivityCover,
} from "../../utils/activityCover";
import {
  parseExperienceBundle,
  type ExperienceBundle,
} from "../../utils/experience";
import {
  parseIntentCommunityRows,
  type IntentCommunityContext,
} from "../../utils/communities";
import { getSportPresentation } from "../../utils/sportPresentation";
import { createClient } from "../../utils/supabase/server";
import {
  hydrateVisiblePlanPresentations,
  normalizePlanPresentationVisibility,
  type VisiblePlanPresentationRow,
} from "../../utils/planPresentationVisibility";
import { withReturnContext } from "../../utils/returnNavigation";
import {
  getPlanOriginCount,
  parsePlanOriginRows,
} from "../../utils/planOrigins";

type RoomPhase =
  | "planning"
  | "activity";

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type MessageType =
  | "text"
  | "system";

type MemberRole =
  | "host"
  | "co_host"
  | "participant";

type MemberStatus =
  | "active"
  | "withdrawn"
  | "removed";

type AttendanceStatus =
  | "pending"
  | "attended"
  | "no_show"
  | "cancelled";

type PlanLocation = {
  city: string;
  district: string;
};

type ActivityCategory = {
  name: string;
  default_cover_url: string | null;
};

type PlanActivity = {
  name: string;
  default_cover_url: string | null;
  activity_categories:
    | ActivityCategory
    | ActivityCategory[]
    | null;
};

type PlanProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type PlanMember = {
  id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_via_request_id: string | null;
  joined_at: string;
  departed_at: string | null;
  budget_commitment:
    | number
    | string;
  attendance_status: AttendanceStatus;
  actual_contribution:
    | number
    | string
    | null;
  profiles:
    | PlanProfile
    | PlanProfile[]
    | null;
};

type PlanIntentInvitationRow = {
  invitation_id: string;
  intent_id: string;
  invited_user_id: string;
  invited_user_full_name: string | null;
  invited_user_username: string | null;
  invited_user_avatar_url: string | null;
  invited_by_user_id: string;
  invited_by_full_name: string | null;
  invited_by_username: string | null;
  invitation_status:
    | "pending"
    | "accepted"
    | "declined"
    | "revoked"
    | "expired";
  invitation_message: string | null;
  invitation_expires_at: string;
  invitation_responded_at: string | null;
  invitation_created_at: string;
};

type LegacyParticipationRow = {
  id: string;
  source_request_id: string | null;
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

type PlanRoomData = {
  id: string;
  host_user_id: string;
  title: string;
  recruitment_status: RecruitmentStatus;
  target_budget:
    | number
    | string
    | null;
  window_start: string;
  window_end: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string;
  meeting_point: string | null;
  address_text: string | null;
  latitude:
    | number
    | string
    | null;
  longitude:
    | number
    | string
    | null;
  map_url: string | null;
  street_view_url: string | null;
  activity_location_name: string | null;
  activity_address_text: string | null;
  activity_latitude:
    | number
    | string
    | null;
  activity_longitude:
    | number
    | string
    | null;
  activity_map_url: string | null;
  activity_street_view_url: string | null;
  meeting_location_same_as_activity: boolean;
  activity_location_visibility:
    | "members"
    | "public";
  cover_url: string | null;
  schedule_notes: string | null;
  budget: number | null;
  max_participants: number | null;
  status: PlanStatus;
  visibility: string;
  notes: string | null;
  planned_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  created_at: string;
  locations:
    | PlanLocation
    | PlanLocation[]
    | null;
  activities:
    | PlanActivity
    | PlanActivity[]
    | null;
  profiles:
    | PlanProfile
    | PlanProfile[]
    | null;
  plan_members:
    | PlanMember[]
    | null;
};

type PlanMessage = {
  id: string;
  plan_id: string;
  sender_id: string | null;
  room_phase: RoomPhase;
  message_type: MessageType;
  system_event: string | null;
  body: string;
  metadata: Record<
    string,
    unknown
  > | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  profiles:
    | PlanProfile
    | PlanProfile[]
    | null;
};

type BudgetSummaryRow = {
  target_budget:
    | number
    | string
    | null;
  committed_budget:
    | number
    | string
    | null;
  remaining_budget:
    | number
    | string
    | null;
  progress_percent:
    | number
    | string
    | null;
  actual_budget:
    | number
    | string
    | null;
  active_member_count:
    | number
    | string
    | null;
  attended_member_count:
    | number
    | string
    | null;
};

type PlanRoomViewProps = {
  planId: string;
  roomPhase: RoomPhase;
  backHref?: string;
  backLabel?: string;
};

type ConversationPanelProps = {
  title: string;
  description: string;
  messages: PlanMessage[];
  currentUserId: string;
  timezone: string;
  planId: string;
  memberNameByUserId: Map<
    string,
    string
  >;
  canSendMessages: boolean;
  readOnlyTitle: string;
  readOnlyDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  heightClass?: string;
};

type CollapsiblePlanningSectionProps = {
  id?: string;
  title: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

function CollapsiblePlanningSection({
  id,
  title,
  description,
  badge,
  defaultOpen = true,
  children,
  className = "",
}: CollapsiblePlanningSectionProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={`group scroll-mt-24 ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-green-200 hover:bg-green-50/30">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900 sm:text-base">{title}</h2>
            {badge && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
          )}
        </div>
        <span
          aria-hidden="true"
          className="shrink-0 text-gray-400 transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

const PLAN_SELECT_QUERY = `
  id,
  host_user_id,
  title,
  recruitment_status,
  target_budget,
  window_start,
  window_end,
  scheduled_start,
  scheduled_end,
  timezone,
  meeting_point,
  address_text,
  latitude,
  longitude,
  map_url,
  street_view_url,
  activity_location_name,
  activity_address_text,
  activity_latitude,
  activity_longitude,
  activity_map_url,
  activity_street_view_url,
  meeting_location_same_as_activity,
  activity_location_visibility,
  cover_url,
  schedule_notes,
  budget,
  max_participants,
  status,
  visibility,
  notes,
  planned_at,
  completed_at,
  cancelled_at,
  expired_at,
  created_at,
  locations (
    city,
    district
  ),
  activities (
    name,
    default_cover_url,
    activity_categories (
      name,
      default_cover_url
    )
  ),
  profiles!plans_host_user_id_fkey (
    id,
    full_name,
    username,
    avatar_url
  ),
  plan_members (
    id,
    user_id,
    role,
    status,
    joined_via_request_id,
    joined_at,
    departed_at,
    budget_commitment,
    attendance_status,
    actual_contribution,
    profiles!plan_members_user_id_fkey (
      id,
      full_name,
      username,
      avatar_url
    )
  )
`;

const MESSAGE_SELECT_QUERY = `
  id,
  plan_id,
  sender_id,
  room_phase,
  message_type,
  system_event,
  body,
  metadata,
  created_at,
  edited_at,
  deleted_at,
  profiles!plan_messages_sender_id_fkey (
    id,
    full_name,
    username,
    avatar_url
  )
`;

function getFirst<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function toFiniteNumber(
  value: unknown,
  fallback = 0
) {
  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : fallback;
}

function toNullableNumber(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : null;
}

function getMetadataString(
  metadata: Record<
    string,
    unknown
  > | null,
  key: string
) {
  const value =
    metadata?.[key];

  return typeof value === "string"
    ? value
    : null;
}

function formatDateTime(
  isoDate: string,
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(
    new Date(isoDate)
  );
}

function formatTime(
  isoDate: string,
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(
    new Date(isoDate)
  );
}

function getLocalDateKey(
  isoDate: string,
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date(isoDate)
  );
}

function getLocalDateLabel(
  isoDate: string,
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(isoDate)
  );
}

function getInitial(
  name: string | null | undefined
) {
  return (
    name
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function getStatusClasses(
  status: PlanStatus
) {
  if (status === "planned") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "completed") {
    return "bg-purple-50 text-purple-700";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-green-50 text-green-700";
}

function getCurrentDateInTimezone(
  timezone: string
) {
  try {
    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date());
  } catch {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
}

function isExpiredFormingPlan(
  plan: PlanRoomData
) {
  if (
    plan.status !==
    "forming"
  ) {
    return false;
  }

  if (plan.expired_at) {
    return true;
  }

  return (
    plan.window_end <
    getCurrentDateInTimezone(
      plan.timezone
    )
  );
}

function formatWindowDate(
  value: string
) {
  const date = new Date(
    `${value}T00:00:00Z`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function getSystemMessageText(
  message: PlanMessage,
  memberNameByUserId: Map<
    string,
    string
  >,
  timezone: string
) {
  const userId =
    getMetadataString(
      message.metadata,
      "user_id"
    );

  const memberName = userId
    ? memberNameByUserId.get(
        userId
      ) ?? "A participant"
    : "A participant";

  if (
    message.system_event ===
    "plan_created"
  ) {
    return "The Planning Room was created.";
  }

  if (
    message.system_event ===
    "member_joined"
  ) {
    return `${memberName} joined the Plan.`;
  }

  if (
    message.system_event ===
    "member_left"
  ) {
    return `${memberName} left the Plan.`;
  }

  if (
    message.system_event ===
    "member_removed"
  ) {
    return `${memberName} was removed from the Plan.`;
  }

  if (
    message.system_event ===
      "schedule_set" ||
    message.system_event ===
      "schedule_updated"
  ) {
    const scheduledStart =
      getMetadataString(
        message.metadata,
        "scheduled_start"
      );

    const scheduledEnd =
      getMetadataString(
        message.metadata,
        "scheduled_end"
      );

    const meetingPoint =
      getMetadataString(
        message.metadata,
        "meeting_point"
      );

    const eventLabel =
      message.system_event ===
      "schedule_set"
        ? "The host added a schedule draft"
        : "The host updated the schedule draft";

    if (
      scheduledStart &&
      scheduledEnd
    ) {
      return `${eventLabel}: ${formatDateTime(
        scheduledStart,
        timezone
      )} to ${formatTime(
        scheduledEnd,
        timezone
      )}${
        meetingPoint
          ? ` at ${meetingPoint}`
          : ""
      }.`;
    }

    return `${eventLabel}.`;
  }

  if (
    message.system_event ===
    "activity_finalized"
  ) {
    return "The host confirmed the schedule. The Planning Room is now archived.";
  }

  if (
    message.system_event ===
    "activity_room_opened"
  ) {
    return "The Activity Room was opened.";
  }

  if (
    message.system_event ===
    "plan_completed"
  ) {
    return "The Activity was marked as completed.";
  }

  if (
    message.system_event ===
    "plan_cancelled"
  ) {
    return "The Activity was cancelled.";
  }

  return message.body;
}

function ConversationPanel({
  title,
  description,
  messages,
  currentUserId,
  timezone,
  planId,
  memberNameByUserId,
  canSendMessages,
  readOnlyTitle,
  readOnlyDescription,
  emptyTitle,
  emptyDescription,
  heightClass = "max-h-[650px] min-h-[420px]",
}: ConversationPanelProps) {
  let previousDateKey:
    | string
    | null = null;

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-bold text-gray-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      </div>

      <div
        className={`${heightClass} overflow-y-auto bg-gray-50 px-4 py-5 md:px-6`}
      >
        {messages.length === 0 && (
          <div className="flex min-h-[320px] items-center justify-center text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {emptyTitle}
              </p>

              <p className="mt-2 text-sm text-gray-500">
                {emptyDescription}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map(
            (message) => {
              const currentDateKey =
                getLocalDateKey(
                  message.created_at,
                  timezone
                );

              const shouldShowDate =
                currentDateKey !==
                previousDateKey;

              previousDateKey =
                currentDateKey;

              const senderProfile =
                getFirst(
                  message.profiles
                );

              const senderName =
                senderProfile?.full_name ??
                "UIN member";

              const isCurrentUser =
                message.sender_id ===
                currentUserId;

              const isDeleted =
                message.deleted_at !==
                null;

              return (
                <div key={message.id}>
                  {shouldShowDate && (
                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-gray-200" />

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm">
                        {getLocalDateLabel(
                          message.created_at,
                          timezone
                        )}
                      </span>

                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                  )}

                  {message.message_type ===
                  "system" ? (
                    <div className="flex justify-center">
                      <div className="max-w-xl rounded-2xl bg-gray-200/70 px-4 py-2 text-center">
                        <p className="text-sm text-gray-600">
                          {getSystemMessageText(
                            message,
                            memberNameByUserId,
                            timezone
                          )}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {formatTime(
                            message.created_at,
                            timezone
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex gap-3 ${
                        isCurrentUser
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {!isCurrentUser && (
                        <ProfileNameLink
                          username={
                            senderProfile?.username
                          }
                          title={`View ${senderName}'s profile`}
                          className="shrink-0 rounded-full transition hover:ring-2 hover:ring-green-300"
                        >
                          {senderProfile?.avatar_url ? (
                            <img
                              src={
                                senderProfile.avatar_url
                              }
                              alt={
                                senderName
                              }
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-500 shadow-sm">
                              {getInitial(
                                senderName
                              )}
                            </div>
                          )}
                        </ProfileNameLink>
                      )}

                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 md:max-w-[70%] ${
                          isCurrentUser
                            ? "rounded-br-md bg-green-600 text-white"
                            : "rounded-bl-md border border-gray-200 bg-white text-gray-800"
                        }`}
                      >
                        {!isCurrentUser && (
                          <ProfileNameLink
                            username={
                              senderProfile?.username
                            }
                            title={`View ${senderName}'s profile`}
                            className="mb-1 inline-block text-xs font-semibold text-gray-500 transition hover:text-green-700 hover:underline hover:underline-offset-2"
                          >
                            {senderName}
                          </ProfileNameLink>
                        )}

                        <p
                          className={`whitespace-pre-wrap break-words text-sm ${
                            isDeleted
                              ? "italic opacity-70"
                              : ""
                          }`}
                        >
                          {isDeleted
                            ? "This message was deleted."
                            : message.body}
                        </p>

                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-xs ${
                            isCurrentUser
                              ? "text-green-100"
                              : "text-gray-400"
                          }`}
                        >
                          <span>
                            {formatTime(
                              message.created_at,
                              timezone
                            )}
                          </span>

                          {message.edited_at &&
                            !isDeleted && (
                              <span>
                                · edited
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>

        {canSendMessages && <div id="plan-conversation-bottom" aria-hidden="true" />}

        {messages.length ===
          100 && (
          <p className="mt-6 text-center text-xs text-gray-400">
            Showing the latest 100 messages.
          </p>
        )}
      </div>

      {canSendMessages ? (
        <PlanMessageComposer
          planId={planId}
        />
      ) : (
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 text-center">
          <p className="text-sm font-semibold text-gray-600">
            {readOnlyTitle}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {readOnlyDescription}
          </p>
        </div>
      )}
    </section>
  );
}

export default async function PlanRoomView({
  planId,
  roomPhase,
  backHref = "/timeline",
  backLabel = "Timeline",
}: PlanRoomViewProps) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: planData,
    error: planError,
  } = await supabase
    .from("plans")
    .select(PLAN_SELECT_QUERY)
    .eq("id", planId)
    .maybeSingle();

  if (
    planError ||
    !planData
  ) {
    if (planError) {
      console.error(
        "Plan Room query failed:",
        planError
      );
    }

    notFound();
  }

  const plan =
    planData as unknown as PlanRoomData;

  const {
    data: planOriginsData,
    error: planOriginsError,
  } = await supabase.rpc("get_visible_plan_origins", {
    p_plan_id: plan.id,
  });

  if (planOriginsError) {
    console.error(
      "Plan origin query failed:",
      planOriginsError
    );
  }

  const planOrigins = parsePlanOriginRows(planOriginsData);
  const planOriginCount = getPlanOriginCount(planOrigins);

  const {
    data: visiblePresentationData,
    error: visiblePresentationError,
  } = await supabase.rpc("get_visible_plan_presentations", {
    p_plan_ids: [plan.id],
  });

  if (visiblePresentationError) {
    console.error(
      "Plan presentation visibility query failed:",
      visiblePresentationError
    );
  }

  const hydratedPresentations = await hydrateVisiblePlanPresentations(
    supabase,
    (visiblePresentationData ?? []) as VisiblePlanPresentationRow[]
  );

  const visiblePresentation = hydratedPresentations[0] ?? null;

  const titlePresentationVisibility =
    normalizePlanPresentationVisibility(
      visiblePresentation?.title_visibility
    );

  const coverPresentationVisibility =
    normalizePlanPresentationVisibility(
      visiblePresentation?.cover_visibility
    );

  const {
    data: experienceData,
    error: experienceError,
  } = await supabase.rpc(
    "get_visible_experience_gallery_v3",
    {
      p_plan_id:
        plan.id,
    }
  );

  if (experienceError) {
    console.error(
      "Activity Room Experience query failed:",
      experienceError
    );
  }

  const rawExperienceBundle =
    parseExperienceBundle(
      experienceData
    );

  let experienceBundle:
    ExperienceBundle | null =
    rawExperienceBundle;

  if (rawExperienceBundle) {
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
                "Activity Room Experience photo signing failed:",
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

  const sharedTitle =
    visiblePresentation?.custom_title ??
    experienceBundle?.sharedTitle ??
    null;

  const {
    data: reputationTargetData,
    error: reputationTargetError,
  } = plan.status === "completed"
    ? await supabase.rpc(
        "get_reputation_feedback_targets",
        {
          p_plan_id: plan.id,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (reputationTargetError) {
    console.error(
      "Activity Archive reputation targets query failed:",
      reputationTargetError
    );
  }

  const reputationTargets =
    (reputationTargetData ??
      []) as ReputationFeedbackTarget[];

  const {
    data: sourceIntentLink,
    error: sourceIntentError,
  } = await supabase
    .from("plan_intents")
    .select("intent_id")
    .eq("plan_id", plan.id)
    .eq("relationship", "host_source")
    .eq("status", "active")
    .maybeSingle();

  if (sourceIntentError) {
    console.error(
      "Plan source Intent query failed:",
      sourceIntentError
    );
  }

  const sourceIntentId =
    typeof sourceIntentLink?.intent_id ===
      "string"
      ? sourceIntentLink.intent_id
      : null;

  const [
    sourceSportContextResponse,
    sourceCommunityContextResponse,
  ] = sourceIntentId
    ? await Promise.all([
        supabase.rpc(
          "get_intent_sport_cover_context",
          {
            p_intent_ids: [
              sourceIntentId,
            ],
          }
        ),
        supabase.rpc(
          "get_visible_intent_communities",
          {
            p_intent_ids: [
              sourceIntentId,
            ],
          }
        ),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (
    sourceSportContextResponse.error
  ) {
    console.error(
      "Plan Room sport context query failed:",
      sourceSportContextResponse.error
    );
  }

  if (
    sourceCommunityContextResponse.error
  ) {
    console.error(
      "Plan Room Community context query failed:",
      sourceCommunityContextResponse.error
    );
  }

  const sourceSportContext =
    (
      (
        sourceSportContextResponse.data ??
        []
      ) as IntentSportCoverContext[]
    )[0] ?? null;

  const sourceCommunities: IntentCommunityContext[] =
    parseIntentCommunityRows(
      sourceCommunityContextResponse.data
    );

  const sourceSportPresentation =
    sourceSportContext?.sport_name
      ? getSportPresentation(
          sourceSportContext.sport_name
        )
      : null;

  const activityRoomExists =
    plan.status === "planned" ||
    plan.status === "completed" ||
    (
      plan.status ===
        "cancelled" &&
      plan.planned_at !== null
    );

  if (
    roomPhase === "activity" &&
    !activityRoomExists
  ) {
    redirect(
      `/plans/${plan.id}/planning`
    );
  }

  const {
    data: currentMessageData,
    error: currentMessageError,
  } = await supabase
    .from("plan_messages")
    .select(MESSAGE_SELECT_QUERY)
    .eq("plan_id", plan.id)
    .eq(
      "room_phase",
      roomPhase
    )
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(100);

  if (currentMessageError) {
    console.error(
      "Room messages query failed:",
      currentMessageError
    );
  }

  let planningArchiveData:
    unknown[] = [];

  if (
    roomPhase === "activity"
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("plan_messages")
      .select(
        MESSAGE_SELECT_QUERY
      )
      .eq("plan_id", plan.id)
      .eq(
        "room_phase",
        "planning"
      )
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .limit(100);

    if (error) {
      console.error(
        "Planning archive query failed:",
        error
      );
    }

    planningArchiveData =
      data ?? [];
  }

  const {
    data: budgetSummaryData,
    error: budgetSummaryError,
  } = await supabase.rpc(
    "get_plan_budget_summary",
    {
      p_plan_id: plan.id,
    }
  );

  if (budgetSummaryError) {
    console.error(
      "Budget summary query failed:",
      budgetSummaryError
    );
  }

  const currentMessages = (
    (currentMessageData ??
      []) as unknown as PlanMessage[]
  ).reverse();

  const planningArchiveMessages = (
    planningArchiveData as PlanMessage[]
  ).reverse();

  const budgetSummary = (
    (
      budgetSummaryData ??
      []
    ) as unknown as BudgetSummaryRow[]
  )[0] ?? null;

  const members =
    plan.plan_members ?? [];

  const activeMembers =
    members
      .filter(
        (member) =>
          member.status ===
          "active"
      )
      .sort(
        (first, second) => {
          if (
            first.role === "host" &&
            second.role !== "host"
          ) {
            return -1;
          }

          if (
            first.role !== "host" &&
            second.role === "host"
          ) {
            return 1;
          }

          return (
            new Date(
              first.joined_at
            ).getTime() -
            new Date(
              second.joined_at
            ).getTime()
          );
        }
      );

  const sourceRequestIds =
    activeMembers
      .map(
        (member) =>
          member.joined_via_request_id
      )
      .filter(
        (
          requestId
        ): requestId is string =>
          Boolean(requestId)
      );

  let legacyParticipations:
    LegacyParticipationRow[] = [];

  if (
    sourceRequestIds.length > 0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "intent_participants"
      )
      .select(`
        id,
        source_request_id
      `)
      .in(
        "source_request_id",
        sourceRequestIds
      )
      .eq("status", "active");

    if (error) {
      console.error(
        "Participant management query failed:",
        error
      );
    }

    legacyParticipations =
      (data ??
        []) as LegacyParticipationRow[];
  }

  const legacyParticipationIdByRequestId =
    new Map<string, string>();

  legacyParticipations.forEach(
    (participation) => {
      if (
        participation.source_request_id
      ) {
        legacyParticipationIdByRequestId.set(
          participation.source_request_id,
          participation.id
        );
      }
    }
  );

  const currentMember =
    members.find(
      (member) =>
        member.user_id ===
        user.id
    ) ?? null;

  const isHost =
    plan.host_user_id ===
    user.id;

  const isActiveMember =
    currentMember?.status ===
    "active";

  const isCoHost =
    isActiveMember &&
    currentMember?.role ===
      "co_host";

  const actorRole:
    | "host"
    | "co_host"
    | "participant" =
    isHost
      ? "host"
      : isCoHost
        ? "co_host"
        : "participant";

  const roomLabel =
    roomPhase === "planning"
      ? "Planning Room"
      : "Activity Room";

  const roomDescription =
    roomPhase === "planning"
      ? "Manage the team, visibility and planning details from one place."
      : "Coordinate the confirmed Activity, team and live Activity details from one place.";

  let planIntentInvitations:
    PlanIntentInvitationRow[] = [];

  if (
    sourceIntentId &&
    (
      isHost ||
      isCoHost
    )
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      "get_shared_plan_intent_invitations",
      {
        p_plan_id:
          plan.id,
      }
    );

    if (error) {
      console.error(
        "Shared Plan invitation query failed:",
        error
      );
    } else {
      planIntentInvitations =
        (
          data ??
          []
        ) as PlanIntentInvitationRow[];
    }
  }

  const isExpiredPlanningPlan =
    isExpiredFormingPlan(
      plan
    );

  if (
    isActiveMember &&
    !isExpiredPlanningPlan
  ) {
    const {
      error: readError,
    } = await supabase.rpc(
      "mark_plan_room_read",
      {
        p_plan_id: plan.id,
        p_room_phase:
          roomPhase,
      }
    );

    if (readError) {
      console.error(
        "Mark room read failed:",
        readError
      );
    }
  }

  const scheduledStartTime = plan.scheduled_start
    ? new Date(plan.scheduled_start).getTime()
    : Number.NaN;

  const scheduledEndTime = plan.scheduled_end
    ? new Date(plan.scheduled_end).getTime()
    : Number.NaN;

  const hasScheduledActivityStarted =
    roomPhase === "activity" &&
    plan.status === "planned" &&
    Number.isFinite(scheduledStartTime) &&
    scheduledStartTime <= Date.now();

  const isScheduledActivityEnded =
    roomPhase === "activity" &&
    plan.status === "planned" &&
    Number.isFinite(scheduledEndTime) &&
    scheduledEndTime <= Date.now();

  const isOutcomeUnknown =
    isScheduledActivityEnded &&
    scheduledEndTime + 7 * 24 * 60 * 60 * 1000 <= Date.now();

  const canInviteToCurrentRoom =
    sourceIntentId !== null &&
    (isHost || isCoHost) &&
    plan.recruitment_status === "open" &&
    !isExpiredPlanningPlan &&
    !isOutcomeUnknown &&
    ((roomPhase === "planning" && plan.status === "forming") ||
      (roomPhase === "activity" && plan.status === "planned"));

  const canSendMessages =
    (isHost ||
      isActiveMember) &&
    (
      (
        roomPhase ===
          "planning" &&
        plan.status ===
          "forming" &&
        !isExpiredPlanningPlan
      ) ||
      (
        roomPhase ===
          "activity" &&
        plan.status ===
          "planned" &&
        !isOutcomeUnknown
      )
    );

  const canManageMembers =
    (isHost || isCoHost) &&
    !isExpiredPlanningPlan &&
    (
      plan.status ===
        "forming" ||
      (
        plan.status ===
          "planned" &&
        !isOutcomeUnknown
      )
    );

  const isCompletionRequired =
    isScheduledActivityEnded;

  const canReviewActivityOutcome =
    hasScheduledActivityStarted &&
    (isHost || isCoHost);

  const attendanceSummary =
    activeMembers.reduce(
      (
        summary,
        member
      ) => {
        if (
          member.attendance_status ===
          "attended"
        ) {
          summary.attended += 1;
        } else if (
          member.attendance_status ===
          "no_show"
        ) {
          summary.noShow += 1;
        } else {
          summary.notRecorded += 1;
        }

        return summary;
      },
      {
        attended: 0,
        noShow: 0,
        notRecorded: 0,
      }
    );

  const isExpiredPlanningArchive =
    roomPhase ===
      "planning" &&
    isExpiredPlanningPlan;

  const isPlanningArchived =
    roomPhase ===
      "planning" &&
    (
      plan.status !==
        "forming" ||
      isExpiredPlanningPlan
    );

  const location =
    getFirst(
      plan.locations
    );

  const activity =
    getFirst(
      plan.activities
    );

  const category =
    getFirst(
      activity?.activity_categories
    );

  const canonicalActivityName =
    activity?.name ||
    plan.title ||
    "UIN Activity";

  const heroTitle =
    plan.status === "completed"
      ? canonicalActivityName
      : sharedTitle ||
        plan.title ||
        canonicalActivityName;

  const completedSharedTitle =
    plan.status === "completed" &&
    sharedTitle &&
    sharedTitle !== canonicalActivityName
      ? sharedTitle
      : null;

  const completionPlanData: CompletionPlanData | null =
    canReviewActivityOutcome
      ? {
          id: plan.id,
          title: heroTitle,
          status: plan.status,
          host_user_id: plan.host_user_id,
          scheduled_start: plan.scheduled_start,
          scheduled_end: plan.scheduled_end,
          timezone: plan.timezone,
          window_start: plan.window_start,
          window_end: plan.window_end,
          meeting_point: plan.meeting_point,
          meeting_address_text: plan.address_text,
          activity_location_name: plan.activity_location_name,
          activity_address_text: plan.activity_address_text,
          meeting_location_same_as_activity: plan.meeting_location_same_as_activity,
          intent_notes: plan.notes,
          schedule_notes: plan.schedule_notes,
          cancellation_reason: null,
          actor_role: isHost ? "host" : "co_host",
          activity_name: canonicalActivityName,
          category_name: category?.name ?? null,
          city: location?.city ?? null,
          district: location?.district ?? null,
        }
      : null;

  const completionMemberData: CompletionMemberData[] =
    activeMembers.map((member) => {
      const profile = getFirst(member.profiles);

      return {
        member_id: member.id,
        user_id: member.user_id,
        role: member.role,
        status: "active",
        full_name: profile?.full_name ?? null,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        attendance_status: member.attendance_status,
        attendance_updated_at: null,
        attendance_updated_by: null,
      };
    });

  const hostProfile =
    getFirst(
      plan.profiles
    );

  const hostName =
    hostProfile?.full_name ??
    "UIN member";

  const experienceCoverMedia =
    experienceBundle?.media.find(
      (media) => media.isCover
    ) ?? null;

  const experienceCoverUrl =
    experienceCoverMedia?.signedUrl ||
    experienceCoverMedia?.externalUrl ||
    null;

  const resolvedCoverUrl =
    experienceCoverUrl ||
    resolveActivityCover({
      planCoverUrl:
        visiblePresentation?.visible_cover_url ??
        sourceSportContext?.context_cover_url ??
        null,
      activityCoverUrl:
        activity?.default_cover_url ??
        null,
      categoryCoverUrl:
        category?.default_cover_url ??
        null,
      categoryName:
        category?.name ??
        null,
      activityName:
        activity?.name ??
        plan.title,
    });

  const memberNameByUserId =
    new Map<string, string>();

  members.forEach(
    (member) => {
      const profile =
        getFirst(
          member.profiles
        );

      memberNameByUserId.set(
        member.user_id,
        profile?.full_name ??
          "UIN member"
      );
    }
  );

  if (hostProfile) {
    memberNameByUserId.set(
      plan.host_user_id,
      hostProfile.full_name ??
        "UIN member"
    );
  }

  const participantCount =
    activeMembers.filter(
      (member) =>
        member.role ===
        "participant"
    ).length;

  const participantLimit =
    plan.max_participants ===
    null
      ? "Unlimited"
      : String(
          plan.max_participants
        );

  const fallbackCommittedBudget =
    activeMembers.reduce(
      (total, member) =>
        total +
        toFiniteNumber(
          member.budget_commitment
        ),
      0
    );

  const fallbackActualBudget =
    members.reduce(
      (total, member) => {
        if (
          member.attendance_status !==
          "attended"
        ) {
          return total;
        }

        return (
          total +
          toFiniteNumber(
            member.actual_contribution
          )
        );
      },
      0
    );

  const fallbackAttendedCount =
    members.filter(
      (member) =>
        member.attendance_status ===
        "attended"
    ).length;

  const targetBudget =
    budgetSummary
      ? toNullableNumber(
          budgetSummary.target_budget
        )
      : toNullableNumber(
          plan.target_budget
        );

  const committedBudget =
    budgetSummary
      ? toFiniteNumber(
          budgetSummary.committed_budget
        )
      : fallbackCommittedBudget;

  const actualBudget =
    budgetSummary
      ? toFiniteNumber(
          budgetSummary.actual_budget
        )
      : fallbackActualBudget;

  const activeMemberCount =
    budgetSummary
      ? toFiniteNumber(
          budgetSummary.active_member_count,
          activeMembers.length
        )
      : activeMembers.length;

  const attendedMemberCount =
    budgetSummary
      ? toFiniteNumber(
          budgetSummary.attended_member_count,
          fallbackAttendedCount
        )
      : fallbackAttendedCount;

  const myCommitment =
    currentMember
      ? toFiniteNumber(
          currentMember.budget_commitment
        )
      : 0;

  const hasSchedule =
    plan.scheduled_start !==
      null &&
    plan.scheduled_end !==
      null &&
    plan.meeting_point !==
      null;

  const peoplePanelMembers:
    PlanPeopleMember[] =
    activeMembers.map(
      (member) => {
        const profile =
          getFirst(
            member.profiles
          );

        return {
          id:
            member.id,

          userId:
            member.user_id,

          fullName:
            profile?.full_name ??
            null,

          username:
            profile?.username ??
            null,

          avatarUrl:
            profile?.avatar_url ??
            null,

          role:
            member.role,

          budgetCommitment:
            toFiniteNumber(
              member.budget_commitment
            ),

          attendanceStatus:
            member.attendance_status,
        };
      }
    );

  const peoplePanelInvitations:
    PlanPeopleInvitation[] =
    planIntentInvitations.map(
      (invitation) => ({
        invitationId:
          invitation.invitation_id,

        intentId:
          invitation.intent_id,

        invitedUserId:
          invitation.invited_user_id,

        invitedUserFullName:
          invitation.invited_user_full_name,

        invitedUserUsername:
          invitation.invited_user_username,

        invitedUserAvatarUrl:
          invitation.invited_user_avatar_url,

        invitedByUserId:
          invitation.invited_by_user_id,

        invitedByFullName:
          invitation.invited_by_full_name,

        invitedByUsername:
          invitation.invited_by_username,

        status:
          invitation.invitation_status,

        message:
          invitation.invitation_message,

        expiresAt:
          invitation.invitation_expires_at,

        respondedAt:
          invitation.invitation_responded_at,

        createdAt:
          invitation.invitation_created_at,
      })
    );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
          >
            ← Back to {backLabel}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {roomPhase === "activity" &&
              canReviewActivityOutcome &&
              plan.status === "planned" && (
                <a
                  href="#attendance-review"
                  className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Complete Activity
                </a>
              )}

            {roomPhase ===
              "planning" &&
              activityRoomExists && (
                <Link
                  href={withReturnContext(
                    `/plans/${plan.id}/activity`,
                    backHref,
                    backLabel,
                    "room"
                  )}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Open Activity Room
                </Link>
              )}

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                isExpiredPlanningArchive
                  ? "bg-orange-100 text-orange-800"
                  : isOutcomeUnknown
                    ? "bg-slate-100 text-slate-800"
                    : getStatusClasses(
                        plan.status
                      )
              }`}
            >
              {isExpiredPlanningArchive
                ? "Expired"
                : isOutcomeUnknown
                  ? "Outcome Unknown"
                  : plan.status}
            </span>
          </div>
        </div>

        {isPlanningArchived && (
          <div
            className={`mb-6 rounded-2xl border p-5 ${
              isExpiredPlanningArchive
                ? "border-orange-200 bg-orange-50"
                : "border-gray-200 bg-gray-100"
            }`}
          >
            <p
              className={`font-semibold ${
                isExpiredPlanningArchive
                  ? "text-orange-900"
                  : "text-gray-800"
              }`}
            >
              {isExpiredPlanningArchive
                ? "This Planning Room has expired."
                : "This Planning Room is archived."}
            </p>

            <p
              className={`mt-2 text-sm ${
                isExpiredPlanningArchive
                  ? "text-orange-800"
                  : "text-gray-600"
              }`}
            >
              {isExpiredPlanningArchive
                ? `The availability window ended on ${formatWindowDate(
                    plan.window_end
                  )}. Messages, members, budget and schedule details are preserved as a read-only record.`
                : "The schedule has been confirmed. This conversation remains available as a read-only record."}
            </p>

            {isExpiredPlanningArchive && (
              <Link
                href="/timeline?view=expired"
                className="mt-4 inline-flex rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-800 transition hover:bg-orange-100"
              >
                Back to Expired Activities
              </Link>
            )}
          </div>
        )}

        {isCompletionRequired && (
          <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Action Required
            </p>

            <h2 className="mt-2 text-xl font-bold text-amber-950">
              {isOutcomeUnknown
                ? "The Activity outcome is still unknown."
                : "The confirmed Activity schedule has ended."}
            </h2>

            <p className="mt-3 text-sm leading-7 text-amber-800">
              {isOutcomeUnknown
                ? "No final outcome was recorded within seven days. It is no longer treated as an active Planned Activity, but a Host or Co-host can still resolve it below."
                : "Confirm whether the Activity happened and record attendance here in the Activity Room. Only the Primary Host can mark it as not happened."}
            </p>

            {(isHost || isCoHost) && (
              <a
                href="#attendance-review"
                className="mt-5 inline-flex rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Review outcome & attendance ↓
              </a>
            )}
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0">
            <section className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-950 shadow-sm">
              <div className="relative h-64 md:h-[330px]">
                <ActivityCoverImage
                  src={resolvedCoverUrl}
                  fallbackSrc={getReliableSystemCoverFallback()}
                  alt={`${heroTitle} cover`}
                  className="h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/25" />

                <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {(isHost ||
                      (isCoHost &&
                        coverPresentationVisibility !== "only_me")) &&
                      !isExpiredPlanningPlan &&
                      !isOutcomeUnknown && (
                        <PlanCoverQuickEditor
                          planId={plan.id}
                          initialPreviewUrl={resolvedCoverUrl}
                          initialExternalUrl={
                            visiblePresentation?.custom_cover_external_url ?? null
                          }
                          initialStoragePath={
                            visiblePresentation?.custom_cover_storage_path ?? null
                          }
                          initialVisibility={coverPresentationVisibility}
                        />
                      )}

                    <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                      {roomPhase === "planning" ? "Planning Room" : "Activity Room"}
                    </span>

                    {planOriginCount > 0 && (
                      <a
                        href="#plan-origins"
                        className="rounded-full border border-emerald-300/35 bg-emerald-950/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 backdrop-blur transition hover:bg-emerald-900/75"
                      >
                        {planOriginCount > 1
                          ? `↘ Formed from ${planOriginCount} Intents`
                          : "↘ Started from 1 Intent"}
                      </a>
                    )}
                  </div>

                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                    isOutcomeUnknown ? "bg-slate-100 text-slate-800" : getStatusClasses(plan.status)
                  }`}>
                    {isOutcomeUnknown ? "Outcome Unknown" : plan.status}
                  </span>
                </div>

                {roomPhase === "activity" && (
                  <PlanWeatherBadges
                    planId={plan.id}
                    className="absolute right-5 top-[72px] z-20 md:right-6 md:top-[78px]"
                  />
                )}

                <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-green-200 backdrop-blur">
                      {category?.name ?? "UIN Activity"}
                    </span>

                    {sourceSportContext?.sport_name && sourceSportPresentation && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm"
                        style={{
                          backgroundColor: sourceSportPresentation.backgroundColor,
                          borderColor: sourceSportPresentation.borderColor,
                          color: sourceSportPresentation.textColor,
                        }}
                      >
                        <span aria-hidden="true">{sourceSportPresentation.icon}</span>
                        {sourceSportContext.sport_name}
                      </span>
                    )}
                  </div>

                  {plan.status !== "completed" &&
                  (isHost ||
                    (isCoHost &&
                      titlePresentationVisibility !== "only_me")) &&
                  plan.status !== "cancelled" &&
                  !isOutcomeUnknown ? (
                    <SharedActivityTitleForm
                      planId={plan.id}
                      initialTitle={sharedTitle}
                      canonicalActivityName={canonicalActivityName}
                      canManage
                      initialVisibility={titlePresentationVisibility}
                      variant="hero"
                    />
                  ) : (
                    <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-4xl">
                      {heroTitle}
                    </h1>
                  )}

                  {completedSharedTitle && (
                    <p className="mt-2 text-sm font-semibold text-white/80">
                      Shared experience · {completedSharedTitle}
                    </p>
                  )}

                  {!isHost &&
                    !isCoHost &&
                    sharedTitle &&
                    sharedTitle.trim() !== canonicalActivityName.trim() && (
                      <div className="mt-2">
                        {plan.status !== "completed" && (
                          <p className="text-xs font-semibold text-white/70">
                            Activity type · {canonicalActivityName}
                          </p>
                        )}
                        <ReportCustomActivityTitleButton
                          planId={plan.id}
                          customTitle={sharedTitle}
                          canonicalTitle={canonicalActivityName}
                          compact
                        />
                      </div>
                    )}

                  <CommunityContextList communities={sourceCommunities} variant="hero" />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {roomPhase === "planning" && activityRoomExists && (
                      <Link
                        href={`/plans/${plan.id}/activity`}
                        className="rounded-xl border border-white/30 bg-white/90 px-4 py-2.5 text-sm font-semibold text-gray-950 backdrop-blur transition hover:bg-white"
                      >
                        Preview public page ↗
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {plan.status === "completed" &&
              (isHost ||
                (isCoHost &&
                  titlePresentationVisibility !== "only_me")) && (
                <SharedActivityTitleForm
                  planId={plan.id}
                  initialTitle={sharedTitle}
                  canonicalActivityName={canonicalActivityName}
                  canManage
                  initialVisibility={titlePresentationVisibility}
                  variant="card"
                />
              )}

            <div className="mt-4">
              <ActivityLifecycleTimeline
                targetStart={plan.window_start}
                targetEnd={plan.window_end}
                scheduledStart={plan.scheduled_start}
                scheduledEnd={plan.scheduled_end}
                completedAt={plan.completed_at}
                cancelledAt={plan.cancelled_at}
                expiredAt={isExpiredPlanningArchive ? plan.expired_at ?? plan.window_end : plan.expired_at}
                status={isExpiredPlanningArchive ? "expired" : plan.status}
                timezone={plan.timezone}
                variant="horizontal"
              />
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{roomLabel}</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">{roomDescription}</p>

            <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-5">
              {hostProfile?.avatar_url ? (
                <img src={hostProfile.avatar_url} alt={hostName} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-50 font-bold text-cyan-700">
                  {getInitial(hostName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Host</p>
                <ProfileNameLink
                  username={hostProfile?.username}
                  title={`View ${hostName}'s profile`}
                  className="block truncate font-bold text-gray-950 hover:text-green-700"
                >
                  {hostName}
                </ProfileNameLink>
                {hostProfile?.username && <p className="truncate text-xs text-gray-500">@{hostProfile.username}</p>}
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-gray-50 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Participants</dt>
                <dd className="mt-1 font-bold text-gray-950">{participantCount} / {participantLimit}</dd>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Visibility</dt>
                <dd className="mt-1 font-bold text-gray-950">{getActivityVisibilityLabel(plan.visibility)}</dd>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Target budget</dt>
                <dd className="mt-1 font-bold text-gray-950">{targetBudget === null ? "Not set" : `${targetBudget.toLocaleString()} TL`}</dd>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Recruitment</dt>
                <dd className="mt-1 font-bold capitalize text-gray-950">{plan.recruitment_status}</dd>
              </div>
            </dl>

            {sourceIntentId && canInviteToCurrentRoom && (
              <div className="mt-5">
                <IntentInvitePeopleButton
                  intentId={sourceIntentId}
                  activityLabel={sharedTitle || plan.title || activity?.name || "UIN Activity"}
                  compact
                />
              </div>
            )}
          </aside>
        </section>

        <CollapsiblePlanningSection
          id="team-chat"
          title="Team & Conversation"
          description={`See the active team, invitations and ${roomLabel} messages together.`}
          badge={`${peoplePanelMembers.length} members`}
          defaultOpen
          className="mt-4"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <PlanPeoplePanel
              planId={plan.id}
              planStatus={plan.status}
              roomPhase={roomPhase}
              recruitmentStatus={plan.recruitment_status}
              visibility={
                plan.visibility as
                  | "public"
                  | "friends"
                  | "except_friends"
                  | "invite_only"
                  | "private"
              }
              actorUserId={user.id}
              actorRole={actorRole}
              sourceIntentId={sourceIntentId}
              activityLabel={sharedTitle || plan.title || activity?.name || "UIN Activity"}
              members={peoplePanelMembers}
              invitations={peoplePanelInvitations}
            />

            <ConversationPanel
              title={`${roomLabel} Conversation`}
              description={
                roomPhase === "planning"
                  ? "Coordinate the plan without leaving the room."
                  : "Coordinate the Activity without falling back into the archived planning chat."
              }
              messages={currentMessages}
              currentUserId={user.id}
              timezone={plan.timezone}
              planId={plan.id}
              memberNameByUserId={memberNameByUserId}
              canSendMessages={canSendMessages}
              readOnlyTitle={isExpiredPlanningArchive ? "This Planning Room has expired." : "This room is read-only."}
              readOnlyDescription={
                isExpiredPlanningArchive
                  ? `The availability window ended on ${formatWindowDate(plan.window_end)}. This conversation cannot be continued.`
                  : isPlanningArchived
                    ? "Planning ended when the schedule was confirmed."
                    : "Messages cannot be sent in the current Activity state."
              }
              emptyTitle="No messages yet."
              emptyDescription={
                isExpiredPlanningArchive
                  ? "No messages were recorded before this Planning Room expired."
                  : `Start the ${roomLabel} conversation.`
              }
            />

            <PlanRoomRealtimeRefresh
              planId={plan.id}
              roomPhase={roomPhase}
              currentUserId={user.id}
            />
          </div>
        </CollapsiblePlanningSection>

        <PlanningRoomQuickActions
          ariaLabel={`${roomLabel} quick actions`}
          actions={[
            { targetId: "locations", icon: "⌖", label: "Locations" },
            { targetId: "privacy", icon: "▣", label: "Privacy & Visibility" },
            { targetId: "toolkit", icon: "☑", label: "Checklist & Files" },
            { targetId: "budget", icon: "▤", label: "Budget" },
            ...(
              roomPhase === "planning" &&
              plan.status === "forming" &&
              !isExpiredPlanningPlan &&
              (isHost || isCoHost)
                ? [{ targetId: "schedule", icon: "▦", label: "Schedule" }]
                : []
            ),
            { targetId: "team-chat", icon: "◌", label: "Team & Chat" },
          ]}
        />

        <CollapsiblePlanningSection
          id="locations"
          title="Locations"
          description="Edit the meeting point and Activity location without hunting through the page."
          badge={plan.meeting_point || plan.activity_location_name ? "Configured" : "Needs attention"}
          defaultOpen
          className="mt-5"
        >
          {(isHost || isCoHost) && !isExpiredPlanningPlan && !isOutcomeUnknown ? (
            <div>
            <PlanPresentationSettingsForm
              planId={plan.id}
              initialCoverUrl={plan.cover_url}
              initialMeetingPoint={plan.meeting_point}
              initialMeetingAddressText={plan.address_text}
              initialMeetingMapUrl={plan.map_url}
              initialMeetingStreetViewUrl={plan.street_view_url}
              initialMeetingLatitude={plan.latitude}
              initialMeetingLongitude={plan.longitude}
              initialActivityLocationName={plan.activity_location_name}
              initialActivityAddressText={plan.activity_address_text}
              initialActivityMapUrl={plan.activity_map_url}
              initialActivityStreetViewUrl={plan.activity_street_view_url}
              initialActivityLatitude={plan.activity_latitude}
              initialActivityLongitude={plan.activity_longitude}
              initialMeetingLocationSameAsActivity={plan.meeting_location_same_as_activity}
              initialActivityLocationVisibility={plan.activity_location_visibility}
              planStatus={plan.status}
            />
          </div>
        ) : (
            <div>
            <ActivityLocationPreview
              city={location?.city ?? null}
              district={location?.district ?? null}
              meetingLocation={{
                name: plan.meeting_point,
                addressText: plan.address_text,
                latitude: plan.latitude,
                longitude: plan.longitude,
                mapUrl: plan.map_url,
                streetViewUrl: plan.street_view_url,
              }}
              activityLocation={{
                name: plan.activity_location_name,
                addressText: plan.activity_address_text,
                latitude: plan.activity_latitude,
                longitude: plan.activity_longitude,
                mapUrl: plan.activity_map_url,
                streetViewUrl: plan.activity_street_view_url,
              }}
              meetingLocationSameAsActivity={plan.meeting_location_same_as_activity}
              activityLocationVisibility={plan.activity_location_visibility}
              canViewExactLocation
            />
          </div>
        )}

        </CollapsiblePlanningSection>

        {roomPhase === "activity" &&
          canReviewActivityOutcome &&
          completionPlanData && (
            <div className="mt-6">
              <PlanCompletionReview
                plan={completionPlanData}
                members={completionMemberData}
                outcomeUnknown={isOutcomeUnknown}
              />
            </div>
          )}

        {roomPhase === "activity" &&
          isCompletionRequired &&
          !isHost &&
          !isCoHost && (
            <section id="attendance-review" className="mt-6 scroll-mt-24 rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Activity Outcome</p>
              <h2 className="mt-2 text-xl font-bold text-amber-950">
                {isOutcomeUnknown ? "Outcome Unknown" : "Waiting for Host confirmation"}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-amber-800">
                {isOutcomeUnknown
                  ? "The scheduled Activity ended more than seven days ago without a final outcome. It is archived as Outcome Unknown instead of being automatically marked as completed or not happened."
                  : "The Activity has ended. The Primary Host or a Co-host can close the Activity and record attendance. If nobody resolves it within seven days, UIN will archive it as Outcome Unknown rather than guessing what happened."}
              </p>
            </section>
          )}

        {roomPhase === "activity" &&
          plan.status === "completed" && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Attendance</p>
              <h2 className="mt-2 text-xl font-bold text-gray-950">Activity attendance archive</h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Attended</p>
                <p className="mt-2 text-2xl font-bold text-green-950">{attendanceSummary.attended}</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Did Not Attend</p>
                <p className="mt-2 text-2xl font-bold text-red-950">{attendanceSummary.noShow}</p>
              </div>
              <div className="rounded-2xl bg-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Not Recorded</p>
                <p className="mt-2 text-2xl font-bold text-gray-950">{attendanceSummary.notRecorded}</p>
              </div>
            </div>
          </section>
        )}

        {roomPhase ===
          "activity" &&
          plan.status ===
            "completed" &&
          experienceBundle?.experience && (
            <ExperiencePanel
              bundle={
                experienceBundle
              }
            />
          )}

        {roomPhase === "activity" &&
          plan.status === "completed" &&
          reputationTargets.length > 0 && (
            <div id="activity-feedback" className="mt-6 scroll-mt-24">
              <ReputationFeedbackTargetsPanel
                planId={plan.id}
                targets={reputationTargets}
              />
            </div>
          )}

        <CollapsiblePlanningSection
          title="Plan Needs · What should we bring?"
          description="Coordinate the items participants will bring."
          className="mt-5"
        >
          <PlanNeedsPanel
              planId={plan.id}
              planStatus={plan.status}
              canManage={
                (isHost || isCoHost) &&
                !isPlanningArchived &&
                !isCompletionRequired &&
                plan.expired_at === null &&
                (plan.status === "forming" || plan.status === "planned")
              }
              canContribute={
                (isHost || isActiveMember) &&
                !isPlanningArchived &&
                !isCompletionRequired &&
                plan.expired_at === null &&
                (plan.status === "forming" || plan.status === "planned")
              }
              readOnly={
                isPlanningArchived ||
                isCompletionRequired ||
                plan.expired_at !== null ||
                (plan.status !== "forming" && plan.status !== "planned")
              }
            />
        </CollapsiblePlanningSection>

        <CollapsiblePlanningSection
          id="toolkit"
          title="Checklist & Files"
          description="Tasks, tickets, QR codes and private planning documents."
          className="mt-5"
        >
          <PlanToolkitPanel
            planId={plan.id}
            planStatus={plan.status}
            currentUserId={user.id}
            members={peoplePanelMembers}
            canManage={
              (isHost || isCoHost) &&
              !isPlanningArchived &&
              !isCompletionRequired &&
              plan.expired_at === null &&
              (plan.status === "forming" || plan.status === "planned")
            }
            readOnly={
              isPlanningArchived ||
              isCompletionRequired ||
              plan.expired_at !== null ||
              (plan.status !== "forming" && plan.status !== "planned")
            }
          />
        </CollapsiblePlanningSection>

        <div className={`mt-5 grid grid-cols-1 gap-5 ${
          roomPhase === "planning" &&
          plan.status === "forming" &&
          !isExpiredPlanningPlan &&
          (isHost || isCoHost)
            ? "xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]"
            : ""
        }`}>
          <CollapsiblePlanningSection
            id="budget"
            title="Budget"
            description="Review the target, commitments and remaining estimate."
          >
            <PlanBudgetPanel
              planId={plan.id}
              planStatus={plan.status}
              isHost={isHost && !isExpiredPlanningPlan && !isOutcomeUnknown}
              isActiveMember={isActiveMember && !isExpiredPlanningPlan && !isOutcomeUnknown}
              initialTargetBudget={targetBudget}
              initialCommittedBudget={committedBudget}
              initialActualBudget={actualBudget}
              initialMyCommitment={myCommitment}
              initialActiveMemberCount={activeMemberCount}
              initialAttendedMemberCount={attendedMemberCount}
              compact
            />
          </CollapsiblePlanningSection>

          {roomPhase === "planning" &&
            plan.status === "forming" &&
            !isExpiredPlanningPlan &&
            (isHost || isCoHost) && (
              <CollapsiblePlanningSection
                id="schedule"
                title="Schedule"
                description="Save a draft and confirm it when the group is ready."
                badge={hasSchedule ? "Draft saved" : "Draft"}
                defaultOpen
              >
                <SharedPlanScheduleForm
                  planId={plan.id}
                  windowStart={plan.window_start}
                  windowEnd={plan.window_end}
                  timezone={plan.timezone}
                  scheduledStart={plan.scheduled_start}
                  scheduledEnd={plan.scheduled_end}
                  meetingPoint={plan.meeting_point}
                  meetingLocationSameAsActivity={plan.meeting_location_same_as_activity}
                  activityLocationName={plan.activity_location_name}
                  scheduleNotes={plan.schedule_notes}
                  actorRole={isHost ? "host" : "co_host"}
                  recruitmentStatus={plan.recruitment_status}
                />
              </CollapsiblePlanningSection>
            )}
        </div>



        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <CollapsiblePlanningSection
            id="privacy"
            title="Privacy & Visibility"
            description="Control who can discover, view and request to join."
            badge={getActivityVisibilityLabel(plan.visibility)}
          >
            {sourceIntentId && (plan.status === "forming" || plan.status === "planned") ? (
              <ActivityVisibilityManager
                intentId={sourceIntentId}
                initialVisibility={plan.visibility as ActivityVisibility}
                canEdit={isHost && !isExpiredPlanningPlan && !isOutcomeUnknown}
                compact
              />
            ) : (
              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Privacy & Visibility</p>
                <p className="mt-2 text-lg font-bold text-gray-950">{getActivityVisibilityLabel(plan.visibility)}</p>
                <p className="mt-1 text-sm text-gray-500">Visibility is read-only in the current state.</p>
              </section>
            )}
          </CollapsiblePlanningSection>

          <CollapsiblePlanningSection
            title="Next steps"
            description="A short list of what still needs attention."
            badge={plan.status}
          >
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  [Boolean(plan.meeting_point || plan.activity_location_name), "Set both locations"],
                  [targetBudget !== null, "Review the budget"],
                  [hasSchedule, "Save the schedule draft"],
                  [activeMembers.length > 1, "Coordinate the team"],
                ].map(([done, label]) => (
                  <div key={String(label)} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-green-100 text-green-700" : "bg-white text-gray-400"}`}>
                      {done ? "✓" : "○"}
                    </span>
                    <span className={done ? "font-semibold text-gray-500 line-through" : "font-semibold text-gray-800"}>{String(label)}</span>
                  </div>
                ))}
              </div>
            </section>
          </CollapsiblePlanningSection>
        </div>

        {planOrigins.length > 0 && (
          <PlanOriginsPanel
            origins={planOrigins}
            resultTitle={heroTitle}
            context={
              plan.status === "completed"
                ? "completed"
                : roomPhase === "planning"
                  ? "planning"
                  : "activity"
            }
            id="plan-origins"
            className="mt-6"
          />
        )}

        {roomPhase ===
          "activity" &&
          planningArchiveMessages.length >
            0 && (
            <div className="mt-6">
              <ConversationPanel
                title="Planning Archive"
                description="The conversation that led to the confirmed Activity schedule."
                messages={
                  planningArchiveMessages
                }
                currentUserId={
                  user.id
                }
                timezone={
                  plan.timezone
                }
                planId={plan.id}
                memberNameByUserId={
                  memberNameByUserId
                }
                canSendMessages={
                  false
                }
                readOnlyTitle="Planning is complete."
                readOnlyDescription="This archive cannot be edited or continued."
                emptyTitle="No planning history."
                emptyDescription="No Planning Room messages were recorded."
                heightClass="max-h-[500px] min-h-[280px]"
              />
            </div>
          )}
      </div>
    </main>
  );
}