import type { ReactNode } from "react";
import PlanWeatherBadges from "../weather/PlanWeatherBadges";
import Link from "next/link";

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
import PlanPublicContentEditor from "./PlanPublicContentEditor";
import PlanBudgetPanel from "./PlanBudgetPanel";
import PlanNeedsPanel from "./PlanNeedsPanel";
import PlanToolkitPanel from "./PlanToolkitPanel";
import PlanMessageComposer from "./PlanMessageComposer";
import PlanRoomRealtimeRefresh from "./PlanRoomRealtimeRefresh";
import ReminderSettingsPanel from "../reminders/ReminderSettingsPanel";
import PlanLifecycleActions, {
  type CancelledPlanRecoveryOption,
} from "./PlanLifecycleActions";
import PlanJourneyHistoryPanel, {
  type PlanJourneyLifecycleEvent,
} from "./PlanJourneyHistoryPanel";
import IntentRoomWorkspace, {
  type IntentRoomNavItem,
  type IntentRoomStat,
  type IntentRoomTeamMember,
} from "./IntentRoomWorkspace";
import SharedPlanScheduleForm from "./SharedPlanScheduleForm";
import SharedActivityTitleForm from "../experiences/SharedActivityTitleForm";
import ReportCustomActivityTitleButton from "../experiences/ReportCustomActivityTitleButton";
import ExperiencePanel from "../experiences/ExperiencePanel";
import ProfileNameLink from "../profile/ProfileNameLink";
import PlanPeoplePanel, {
  type PlanPeopleInvitation,
  type PlanPeopleMember,
  type PlanPeopleDeparture,
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
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancellation_reason_code: string | null;
  cancellation_phase: "planning" | "activity" | null;
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

type PlanMemberDeparture = {
  departure_id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  room_phase: RoomPhase;
  reason_code: string;
  reason_text: string | null;
  departed_at: string;
};

type PlanLifecycleEventRow = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  subject_user_id: string | null;
  room_phase: RoomPhase | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
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
  fillHeight?: boolean;
  showHeader?: boolean;
};

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
  cancelled_by,
  cancellation_reason,
  cancellation_reason_code,
  cancellation_phase,
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
    "tr-TR",
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
    "tr-TR",
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
    "tr-TR",
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

function getPlanStatusLabel(
  status: PlanStatus
) {
  if (status === "forming") return "Planlanıyor";
  if (status === "planned") return "Netleşti";
  if (status === "completed") return "Tamamlandı";
  if (status === "cancelled") return "İptal edildi";
  return status;
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
    "tr-TR",
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
    return "Niyet Odası açıldı.";
  }

  if (
    message.system_event ===
    "member_joined"
  ) {
    return `${memberName} Niyete katıldı.`;
  }

  if (
    message.system_event ===
    "member_left"
  ) {
    return message.room_phase === "activity"
      ? `${memberName} Aktiviteye katılamayacak.`
      : `${memberName} katılımdan ayrıldı.`;
  }

  if (
    message.system_event ===
    "member_removed"
  ) {
    return `${memberName} ekipten çıkarıldı.`;
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
        ? "Program taslağı eklendi"
        : "Program taslağı güncellendi";

    if (
      scheduledStart &&
      scheduledEnd
    ) {
      return `${eventLabel}: ${formatDateTime(
        scheduledStart,
        timezone
      )} → ${formatTime(
        scheduledEnd,
        timezone
      )}${
        meetingPoint
          ? ` · ${meetingPoint}`
          : ""
      }.`;
    }

    return `${eventLabel}.`;
  }

  if (
    message.system_event ===
    "activity_finalized"
  ) {
    return "Program netleşti. Niyet Aktivite aşamasına geçti.";
  }

  if (
    message.system_event ===
    "activity_room_opened"
  ) {
    return "Aktivite aşaması başladı.";
  }

  if (
    message.system_event ===
    "plan_completed"
  ) {
    return "Aktivite tamamlandı olarak işaretlendi.";
  }

  if (
    message.system_event ===
    "plan_cancelled"
  ) {
    const actorUserId =
      getMetadataString(
        message.metadata,
        "actor_user_id"
      );

    const actorName = actorUserId
      ? memberNameByUserId.get(actorUserId) ?? "Ana Yürüten / Birlikte Yürüten"
      : "Ana Yürüten / Birlikte Yürüten";

    const reasonLabel =
      getMetadataString(
        message.metadata,
        "reason_label"
      );

    return `${actorName} şunu iptal etti: ${
      message.room_phase === "planning" ? "planlamayı" : "Aktiviteyi"
    }.${reasonLabel ? ` ${reasonLabel}.` : ""}`;
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
  fillHeight = false,
  showHeader = true,
}: ConversationPanelProps) {
  let previousDateKey:
    | string
    | null = null;

  return (
    <section className={`overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm ${fillHeight ? "flex h-full min-h-0 flex-col" : ""}`}>
      {showHeader && (
        <div className="shrink-0 border-b border-gray-200 px-5 py-4">
          <h2 className="text-xl font-black text-gray-950">
            {title}
          </h2>

          <p className="mt-1 text-[15px] leading-6 text-gray-500">
            {description}
          </p>
        </div>
      )}

      <div
        className={`${fillHeight ? "min-h-0 flex-1" : heightClass} overflow-y-auto bg-gray-50 px-4 py-5 md:px-6`}
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
                      <div className="max-w-2xl rounded-2xl bg-gray-200/70 px-4 py-2.5 text-center">
                        <p className="text-[14px] leading-5 text-gray-600">
                          {getSystemMessageText(
                            message,
                            memberNameByUserId,
                            timezone
                          )}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-400">
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
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-gray-500 shadow-sm">
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
                            className="mb-1.5 inline-block text-sm font-bold text-gray-600 transition hover:text-green-700 hover:underline hover:underline-offset-2"
                          >
                            {senderName}
                          </ProfileNameLink>
                        )}

                        <p
                          className={`whitespace-pre-wrap break-words text-[15px] leading-6 ${
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

  // UX'te ayrı bir Plan nesnesi yok. Niyet planlanırken aynı oda kullanılır;
  // program netleştiğinde kanonik görünüm Aktivite aşamasına geçer.
  if (
    roomPhase === "planning" &&
    activityRoomExists
  ) {
    redirect(
      `/plans/${plan.id}/activity`
    );
  }

  const {
    data: currentMessageData,
    error: currentMessageError,
  } = await supabase
    .from("plan_messages")
    .select(MESSAGE_SELECT_QUERY)
    .eq("plan_id", plan.id)
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(200);

  if (currentMessageError) {
    console.error(
      "Room messages query failed:",
      currentMessageError
    );
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

  const [recoveryOptionResult, departureHistoryResult, lifecycleHistoryResult] = await Promise.all([
    plan.status === "cancelled"
      ? supabase.rpc("get_my_cancelled_plan_recovery_options", {
          p_plan_id: plan.id,
        })
      : Promise.resolve({ data: [], error: null }),
    isHost || isCoHost
      ? supabase.rpc("get_plan_member_departures", {
          p_plan_id: plan.id,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("plan_lifecycle_events")
      .select("id,event_type,actor_user_id,subject_user_id,room_phase,metadata,created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true }),
  ]);

  if (recoveryOptionResult.error) {
    console.error(
      "Cancelled Plan recovery options query failed:",
      recoveryOptionResult.error
    );
  }

  if (departureHistoryResult.error) {
    console.error(
      "Plan departure history query failed:",
      departureHistoryResult.error
    );
  }

  if (lifecycleHistoryResult.error) {
    console.error(
      "Plan lifecycle history query failed:",
      lifecycleHistoryResult.error
    );
  }

  const recoveryOptions = (recoveryOptionResult.data ?? []) as CancelledPlanRecoveryOption[];
  const departureHistory = (departureHistoryResult.data ?? []) as PlanMemberDeparture[];
  const lifecycleHistoryRows = (lifecycleHistoryResult.data ?? []) as PlanLifecycleEventRow[];

  const roomLabel =
    roomPhase === "planning"
      ? "Niyet Odası"
      : "Aktivite Odası";

  const roomDescription =
    roomPhase === "planning"
      ? "Niyetini ekiple birlikte planla; sohbet, konum, program ve katılım aynı yerde yaşasın."
      : "Netleşen Aktiviteyi aynı sohbet ve aynı ekiple burada yürüt.";

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
    isHost || isActiveMember
  ) {
    const [
      roomReadResult,
      transportReadResult,
    ] = await Promise.all([
      supabase.rpc(
        "mark_plan_room_read",
        {
          p_plan_id: plan.id,
          p_room_phase:
            roomPhase,
        }
      ),
      supabase.rpc(
        "mark_my_room_message_transport_read",
        {
          p_plan_id: plan.id,
          p_room_phase:
            roomPhase,
        }
      ),
    ]);

    if (roomReadResult.error) {
      console.error(
        "Mark room read failed:",
        roomReadResult.error
      );
    }

    if (transportReadResult.error) {
      console.error(
        "Mark room message transport read failed:",
        transportReadResult.error
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

  const peoplePanelDepartures: PlanPeopleDeparture[] = departureHistory.map(
    (departure) => ({
      departureId: departure.departure_id,
      userId: departure.user_id,
      fullName: departure.full_name,
      username: departure.username,
      avatarUrl: departure.avatar_url,
      roomPhase: departure.room_phase,
      reasonCode: departure.reason_code,
      reasonText: departure.reason_text,
      departedAt: departure.departed_at,
    })
  );

  const cancellationActorName = plan.cancelled_by
    ? memberNameByUserId.get(plan.cancelled_by) ?? "Ana Yürüten / Birlikte Yürüten"
    : "Ana Yürüten / Birlikte Yürüten";

  const journeyLifecycleEvents: PlanJourneyLifecycleEvent[] = lifecycleHistoryRows.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    actorName: event.actor_user_id
      ? memberNameByUserId.get(event.actor_user_id) ?? null
      : null,
    subjectName: event.subject_user_id
      ? memberNameByUserId.get(event.subject_user_id) ?? null
      : null,
    roomPhase: event.room_phase,
    metadata: event.metadata,
    createdAt: event.created_at,
  }));

  const locationCompletion =
    Number(Boolean(plan.meeting_point)) +
    Number(Boolean(plan.activity_location_name || plan.meeting_location_same_as_activity));

  const scheduleCompletion =
    Number(Boolean(plan.scheduled_start)) +
    Number(Boolean(plan.scheduled_end));

  const coHostCount = activeMembers.filter((member) => member.role === "co_host").length;
  const pendingInvitationCount = peoplePanelInvitations.filter(
    (invitation) => invitation.status === "pending"
  ).length;

  const roomStats: IntentRoomStat[] = [
    {
      label: "Katılımcılar",
      value: `${participantCount} / ${participantLimit === "Unlimited" ? "∞" : participantLimit}`,
      icon: "◎",
      tone: activeMembers.length > 1 ? "good" : "default",
    },
    {
      label: "Konumlar",
      value: `${locationCompletion} / 2`,
      icon: "⌖",
      tone: locationCompletion === 2 ? "good" : "default",
    },
    {
      label: "Zamanlama",
      value: `${scheduleCompletion} / 2`,
      icon: "◷",
      tone: scheduleCompletion === 2 ? "good" : "default",
    },
    {
      label: "Davetler",
      value: pendingInvitationCount > 0 ? `${pendingInvitationCount} bekliyor` : "Güncel",
      icon: "+",
      tone: pendingInvitationCount > 0 ? "default" : "good",
    },
    {
      label: "Görünürlük",
      value: getActivityVisibilityLabel(plan.visibility),
      icon: "◉",
    },
  ];

  const teamPreviewMembers: IntentRoomTeamMember[] = peoplePanelMembers.map((member) => ({
    id: member.id,
    name: member.fullName || member.username || "UIN üyesi",
    avatarUrl: member.avatarUrl,
    role: member.role,
  }));

  const canEditPlanningDetails =
    (isHost || isCoHost) &&
    !isPlanningArchived &&
    !isCompletionRequired &&
    plan.expired_at === null &&
    (plan.status === "forming" || plan.status === "planned");

  const canContributePlanningDetails =
    (isHost || isActiveMember) &&
    !isPlanningArchived &&
    !isCompletionRequired &&
    plan.expired_at === null &&
    (plan.status === "forming" || plan.status === "planned");

  const planningReadOnly =
    isPlanningArchived ||
    isCompletionRequired ||
    plan.expired_at !== null ||
    (plan.status !== "forming" && plan.status !== "planned");

  const nextStep = (() => {
    if (roomPhase !== "planning" || plan.status !== "forming" || isExpiredPlanningPlan) {
      return null;
    }

    if (locationCompletion < 2) {
      return {
        sectionId: "locations",
        label: "Buluşma noktası ve Aktivite konumunu netleştir",
        hint: `${locationCompletion}/2 tamamlandı`,
      };
    }

    if (scheduleCompletion < 2) {
      return {
        sectionId: "schedule",
        label: "Tarih ve saatleri netleştir",
        hint: `${scheduleCompletion}/2 tamamlandı`,
      };
    }

    if (activeMembers.length < 2) {
      return {
        sectionId: "team",
        label: "Ekibi oluştur ve katılımcıları davet et",
        hint: `${activeMembers.length} kişi`,
      };
    }

    return {
      sectionId: "schedule",
      label: "Niyet hazır görünüyor; Aktiviteyi netleştir",
      hint: "son kontrol",
    };
  })();

  type WorkspaceSection = IntentRoomNavItem & {
    content: ReactNode;
  };

  const workspaceSections: WorkspaceSection[] = [];

  workspaceSections.push({
    id: "locations",
    label: "Konum & Buluşma",
    description: "Buluşma noktasını ve ardından gidilecek Aktivite konumunu tek yerde yönet.",
    meta: `${locationCompletion} / 2`,
    icon: "⌖",
    content:
      (isHost || isCoHost) && !isExpiredPlanningPlan && !isOutcomeUnknown ? (
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
      ) : (
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
      ),
  });

  workspaceSections.push({
    id: "schedule",
    label: "Zamanlama",
    description: "Tarih, saat, buluşma akışı ve program notlarını netleştir.",
    meta: `${scheduleCompletion} / 2`,
    icon: "◷",
    content:
      roomPhase === "planning" &&
      plan.status === "forming" &&
      !isExpiredPlanningPlan &&
      (isHost || isCoHost) ? (
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
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Başlangıç</p>
            <p className="mt-2 text-sm font-black text-gray-950">
              {plan.scheduled_start ? formatDateTime(plan.scheduled_start, plan.timezone) : "Henüz netleşmedi"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Bitiş</p>
            <p className="mt-2 text-sm font-black text-gray-950">
              {plan.scheduled_end ? formatDateTime(plan.scheduled_end, plan.timezone) : "Henüz netleşmedi"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Program notu</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
              {plan.schedule_notes || "Henüz program notu eklenmedi."}
            </p>
          </div>
        </section>
      ),
  });

  workspaceSections.push({
    id: "needs",
    label: "İhtiyaçlar",
    description: "Katılımcıların getireceği şeyleri ve ortak ihtiyaçları birlikte planla.",
    meta: "Birlikte yönet",
    icon: "✓",
    content: (
      <PlanNeedsPanel
        planId={plan.id}
        planStatus={plan.status}
        canManage={canEditPlanningDetails}
        canContribute={canContributePlanningDetails}
        readOnly={planningReadOnly}
      />
    ),
  });

  workspaceSections.push({
    id: "toolkit",
    label: "Görevler & Dosyalar",
    description: "Kontrol listesini, görevleri, biletleri, QR kodlarını ve ortak dosyaları burada tut.",
    meta: "Hazırlık alanı",
    icon: "☑",
    content: (
      <PlanToolkitPanel
        planId={plan.id}
        planStatus={plan.status}
        currentUserId={user.id}
        members={peoplePanelMembers}
        canManage={canEditPlanningDetails}
        readOnly={planningReadOnly}
      />
    ),
  });

  workspaceSections.push({
    id: "team",
    label: "Davetler & Ekip",
    description: "Katılımcıları, rolleri, bekleyen davetleri ve ekip değişikliklerini yönet.",
    meta: `${activeMembers.length} kişi`,
    icon: "◎",
    content: (
      <PlanPeoplePanel
        planId={plan.id}
        planStatus={plan.status}
        roomPhase={roomPhase}
        recruitmentStatus={plan.recruitment_status}
        visibility={plan.visibility as "public" | "friends" | "except_friends" | "invite_only" | "private"}
        actorUserId={user.id}
        actorRole={actorRole}
        sourceIntentId={sourceIntentId}
        activityLabel={sharedTitle || plan.title || activity?.name || "UIN Aktivitesi"}
        members={peoplePanelMembers}
        invitations={peoplePanelInvitations}
        departures={peoplePanelDepartures}
      />
    ),
  });

  workspaceSections.push({
    id: "budget",
    label: "Bütçe",
    description: "Bütçeyi gerektiğinde aç; ana görünümde sürekli yer kaplamasın.",
    meta: targetBudget === null ? "Belirlenmedi" : `${targetBudget.toLocaleString()} TL`,
    icon: "₺",
    secondary: true,
    content: (
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
    ),
  });

  if ((isHost || isCoHost) && (plan.status === "forming" || plan.status === "planned")) {
    workspaceSections.push({
      id: "public-content",
      label: "Görünen Bilgiler",
      description: "Açıklama, bağlantılar, videolar ve dışarıdan görünen Aktivite bilgilerini düzenle.",
      meta: "Sunum",
      icon: "✎",
      secondary: true,
      content: (
        <PlanPublicContentEditor
          planId={plan.id}
          canManage={plan.expired_at === null && (isHost || isCoHost)}
        />
      ),
    });
  }

  workspaceSections.push({
    id: "privacy",
    label: "Gizlilik",
    description: "Kimlerin görebileceğini ve katılım isteği gönderebileceğini belirle.",
    meta: getActivityVisibilityLabel(plan.visibility),
    icon: "◉",
    secondary: true,
    content:
      sourceIntentId && (plan.status === "forming" || plan.status === "planned") ? (
        <ActivityVisibilityManager
          intentId={sourceIntentId}
          initialVisibility={plan.visibility as ActivityVisibility}
          canEdit={isHost && !isExpiredPlanningPlan && !isOutcomeUnknown}
          compact
        />
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Görünürlük</p>
          <p className="mt-2 text-lg font-black text-gray-950">{getActivityVisibilityLabel(plan.visibility)}</p>
        </section>
      ),
  });

  workspaceSections.push({
    id: "journey",
    label: "Niyet Yolculuğu",
    description: "Geçmişi, önemli dönüm noktalarını ve bundan sonra nereye gittiğini tek yerde gör.",
    meta: getPlanStatusLabel(plan.status),
    icon: "↺",
    secondary: true,
    content: (
      <div>
        <PlanJourneyHistoryPanel
          planId={plan.id}
          planCreatedAt={plan.created_at}
          plannedAt={plan.planned_at}
          completedAt={plan.completed_at}
          cancelledAt={plan.cancelled_at}
          expiredAt={isExpiredPlanningArchive ? plan.expired_at ?? plan.window_end : plan.expired_at}
          status={plan.status}
          timezone={plan.timezone}
          sourceIntentCount={Math.max(planOriginCount, 1)}
          cancellationReason={plan.cancellation_reason}
          lifecycleEvents={journeyLifecycleEvents}
        />
      </div>
    ),
  });

  if (roomPhase === "activity" && isCompletionRequired) {
    workspaceSections.push({
      id: "outcome",
      label: "Aktivite Sonucu",
      description: "Aktivitenin gerçekleşip gerçekleşmediğini ve katılımı kaydet.",
      meta: isOutcomeUnknown ? "Sonuç belirsiz" : "İşlem gerekli",
      icon: "!",
      secondary: true,
      content:
        canReviewActivityOutcome && completionPlanData ? (
          <PlanCompletionReview
            plan={completionPlanData}
            members={completionMemberData}
            outcomeUnknown={isOutcomeUnknown}
          />
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-black text-amber-950">
              {isOutcomeUnknown ? "Sonuç Belirsiz" : "Ana Yürüten onayı bekleniyor"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Aktivite sona erdi. Ana Yürüten veya Birlikte Yürüten sonucu ve katılımı kaydedebilir.
            </p>
          </section>
        ),
    });
  }

  if (roomPhase === "activity" && plan.status === "completed") {
    workspaceSections.push({
      id: "attendance",
      label: "Katılım",
      description: "Tamamlanan Aktivitenin katılım kaydını gör.",
      meta: `${attendanceSummary.attended} katıldı`,
      icon: "✓",
      secondary: true,
      content: (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Katıldı</p>
            <p className="mt-2 text-2xl font-bold text-green-950">{attendanceSummary.attended}</p>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Katılmadı</p>
            <p className="mt-2 text-2xl font-bold text-red-950">{attendanceSummary.noShow}</p>
          </div>
          <div className="rounded-2xl bg-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Kaydedilmedi</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{attendanceSummary.notRecorded}</p>
          </div>
        </section>
      ),
    });

    if (reputationTargets.length > 0) {
      workspaceSections.push({
        id: "feedback",
        label: "Değerlendirme",
        description: "Birlikte katıldığın kişileri ve deneyimi değerlendir.",
        meta: `${reputationTargets.length} kişi`,
        icon: "◇",
        secondary: true,
        content: (
          <ReputationFeedbackTargetsPanel
            planId={plan.id}
            targets={reputationTargets}
            memoryHref="#activity-memory"
          />
        ),
      });
    }

    workspaceSections.push({
      id: "memory",
      label: "Hatıra",
      description: "Tamamlanan Aktivitenin hikâyesi, görselleri ve bağlantıları burada yaşar.",
      meta: experienceBundle?.experience ? "Hazır" : "Bekleniyor",
      icon: "◈",
      secondary: true,
      content: experienceBundle?.experience ? (
        <ExperiencePanel bundle={experienceBundle} />
      ) : (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm leading-6 text-indigo-900">
          Aktivite tamamlandı ancak Hatıra kaydı henüz görünmüyor. Odayı yeniledikten sonra tekrar kontrol et.
        </div>
      ),
    });
  }

  const defaultWorkspaceSection = nextStep?.sectionId ?? "locations";

  const hasLifecycleMenu =
    plan.status === "cancelled" ||
    ((plan.status === "forming" || plan.status === "planned") &&
      ((isHost || isCoHost) || (isActiveMember && !isHost)));

  const hero = (
    <section className="overflow-hidden rounded-[30px] border border-gray-200 bg-gray-950 shadow-sm">
      <div className="relative h-64 md:h-[330px]">
        <ActivityCoverImage
          src={resolvedCoverUrl}
          fallbackSrc={getReliableSystemCoverFallback()}
          alt={`${heroTitle} cover`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/25" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-green-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm">
              {roomPhase === "planning" ? "NİYET" : "AKTİVİTE"}
            </span>
            {roomPhase === "activity" && (
              <PlanWeatherBadges planId={plan.id} />
            )}
          </div>

          <div className="flex items-start gap-2">
            {(isHost || (isCoHost && coverPresentationVisibility !== "only_me")) &&
              !isExpiredPlanningPlan &&
              !isOutcomeUnknown && (
                <PlanCoverQuickEditor
                  planId={plan.id}
                  initialPreviewUrl={resolvedCoverUrl}
                  initialExternalUrl={visiblePresentation?.custom_cover_external_url ?? null}
                  initialStoragePath={visiblePresentation?.custom_cover_storage_path ?? null}
                  initialVisibility={coverPresentationVisibility}
                />
              )}

            {!isExpiredPlanningArchive && hasLifecycleMenu && (
              <details className="group relative z-30">
                <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/25 bg-black/45 text-lg font-black text-white backdrop-blur transition hover:bg-black/60">
                  ⋯
                </summary>
                <div className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl">
                  <PlanLifecycleActions
                    planId={plan.id}
                    activityLabel={sharedTitle || plan.title || activity?.name || "UIN Activity"}
                    planStatus={plan.status}
                    roomPhase={roomPhase}
                    actorRole={actorRole}
                    isActiveMember={isActiveMember}
                    recoveryOptions={recoveryOptions}
                  />
                </div>
              </details>
            )}
          </div>
        </div>

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
          (isHost || (isCoHost && titlePresentationVisibility !== "only_me")) &&
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
            <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-4xl">
              {heroTitle}
            </h1>
          )}

          {completedSharedTitle && (
            <p className="mt-2 text-sm font-semibold text-white/80">Ortak deneyim · {completedSharedTitle}</p>
          )}

          {!isHost &&
            !isCoHost &&
            sharedTitle &&
            sharedTitle.trim() !== canonicalActivityName.trim() && (
              <div className="mt-2">
                <ReportCustomActivityTitleButton
                  planId={plan.id}
                  customTitle={sharedTitle}
                  canonicalTitle={canonicalActivityName}
                  compact
                />
              </div>
            )}

          <CommunityContextList communities={sourceCommunities} variant="hero" />
        </div>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1780px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-black text-green-700 transition hover:text-green-800"
          >
            ← {backLabel}
          </Link>

        </div>

        {isPlanningArchived && (
          <div className={`mb-5 rounded-2xl border p-4 ${
            isExpiredPlanningArchive ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-gray-100"
          }`}>
            <p className="font-black text-gray-900">
              {isExpiredPlanningArchive ? "Bu Niyetin planlama süresi doldu." : "Bu Niyet artık aktif değil."}
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Geçmiş kayıtlar korunuyor; bu alan artık yalnızca okunabilir.
            </p>
          </div>
        )}

        {plan.status === "cancelled" && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-black text-red-900">Bu süreç iptal edildi; geçmiş korunuyor.</p>
            <p className="mt-1 text-xs leading-5 text-red-700">
              {cancellationActorName} tarafından iptal edildi
              {plan.cancelled_at ? ` · ${formatDateTime(plan.cancelled_at, plan.timezone)}` : ""}.
              {plan.cancellation_reason ? ` Gerekçe: ${plan.cancellation_reason}` : ""}
            </p>
          </div>
        )}

        {isCompletionRequired && plan.status === "planned" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <p className="text-sm font-black text-amber-950">
                {isOutcomeUnknown ? "Aktivitenin sonucu hâlâ belirsiz." : "Planlanan Aktivite sona erdi."}
              </p>
              <p className="mt-1 text-xs text-amber-800">Sonucu ve katılımı Aktivite Sonucu bölümünden kaydet.</p>
            </div>
          </div>
        )}

        <IntentRoomWorkspace
          hero={hero}
          stats={roomStats}
          navItems={workspaceSections.map((section) => ({
            id: section.id,
            label: section.label,
            description: section.description,
            meta: section.meta,
            icon: section.icon,
            secondary: section.secondary,
          }))}
          defaultSectionId={defaultWorkspaceSection}
          team={{
            total: activeMembers.length,
            hostCount: activeMembers.filter((member) => member.role === "host").length || 1,
            coHostCount,
            participantCount,
            members: teamPreviewMembers,
          }}
          teamInviteAction={
            sourceIntentId && canInviteToCurrentRoom ? (
              <IntentInvitePeopleButton
                intentId={sourceIntentId}
                activityLabel={sharedTitle || plan.title || activity?.name || "UIN Activity"}
                compact
              />
            ) : null
          }
          chat={
            <>
              <ConversationPanel
                title="Sohbet"
                description={roomPhase === "planning" ? "Niyeti birlikte şekillendirin." : "Aynı sohbet Aktivite boyunca devam eder."}
                messages={currentMessages}
                currentUserId={user.id}
                timezone={plan.timezone}
                planId={plan.id}
                memberNameByUserId={memberNameByUserId}
                canSendMessages={canSendMessages}
                readOnlyTitle={isExpiredPlanningArchive ? "Bu Niyetin planlama süresi doldu." : "Bu sohbet yalnızca okunabilir."}
                readOnlyDescription={
                  isExpiredPlanningArchive
                    ? `Uygunluk aralığı ${formatWindowDate(plan.window_end)} tarihinde sona erdi.`
                    : "Mevcut Aktivite durumunda mesaj gönderilemez."
                }
                emptyTitle="Henüz mesaj yok."
                emptyDescription="İlk mesajı gönder ve ekibi aynı yerde tut."
                heightClass="max-h-[560px] min-h-[460px]"
              />
              <PlanRoomRealtimeRefresh
                planId={plan.id}
                roomPhase={roomPhase}
                currentUserId={user.id}
              />
            </>
          }
          chatExpanded={
            <>
              <ConversationPanel
                title="Sohbet"
                description={roomPhase === "planning" ? "Niyeti birlikte şekillendirin." : "Aynı sohbet Aktivite boyunca devam eder."}
                messages={currentMessages}
                currentUserId={user.id}
                timezone={plan.timezone}
                planId={plan.id}
                memberNameByUserId={memberNameByUserId}
                canSendMessages={canSendMessages}
                readOnlyTitle={isExpiredPlanningArchive ? "Bu Niyetin planlama süresi doldu." : "Bu sohbet yalnızca okunabilir."}
                readOnlyDescription={
                  isExpiredPlanningArchive
                    ? `Uygunluk aralığı ${formatWindowDate(plan.window_end)} tarihinde sona erdi.`
                    : "Mevcut Aktivite durumunda mesaj gönderilemez."
                }
                emptyTitle="Henüz mesaj yok."
                emptyDescription="İlk mesajı gönder ve ekibi aynı yerde tut."
                fillHeight
                showHeader={false}
              />
              <PlanRoomRealtimeRefresh
                planId={plan.id}
                roomPhase={roomPhase}
                currentUserId={user.id}
              />
            </>
          }
          reminders={
            <ReminderSettingsPanel
              resourceType="plan"
              resourceId={plan.id}
              title={heroTitle}
              hasTarget={Boolean(plan.scheduled_start)}
              timezone={plan.timezone}
              targetLabel={
                plan.scheduled_start
                  ? `Netleşti · ${formatDateTime(plan.scheduled_start, plan.timezone)}`
                  : "Henüz onaylanmış başlangıç zamanı yok."
              }
              compact
            />
          }
          nextStep={nextStep}
          originCount={planOriginCount}
          origins={
            planOrigins.length > 0 ? (
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
                className="mt-0"
              />
            ) : null
          }
        >
          {workspaceSections.map((section) => (
            <div key={section.id}>{section.content}</div>
          ))}
        </IntentRoomWorkspace>
      </div>
    </main>
  );
}
