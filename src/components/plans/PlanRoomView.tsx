import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import ConfirmActivityPlanButton from "./FinalizeActivityButton";
import PlanBudgetPanel from "./PlanBudgetPanel";
import PlanMessageComposer from "./PlanMessageComposer";
import SharedPlanScheduleForm from "./SharedPlanScheduleForm";
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
import { createClient } from "../../utils/supabase/server";

type RoomPhase =
  | "planning"
  | "activity";

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type CreationMode =
  | "matched"
  | "scheduled_direct";

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
};

type PlanActivity = {
  name: string;
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

type PlanRoomData = {
  id: string;
  host_user_id: string;
  title: string;
  creation_mode: CreationMode;
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
  schedule_notes: string | null;
  budget: number | null;
  max_participants: number | null;
  status: PlanStatus;
  visibility: string;
  notes: string | null;
  planned_at: string | null;
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

const PLAN_SELECT_QUERY = `
  id,
  host_user_id,
  title,
  creation_mode,
  recruitment_status,
  target_budget,
  window_start,
  window_end,
  scheduled_start,
  scheduled_end,
  timezone,
  meeting_point,
  schedule_notes,
  budget,
  max_participants,
  status,
  visibility,
  notes,
  planned_at,
  expired_at,
  created_at,
  locations (
    city,
    district
  ),
  activities (
    name,
    activity_categories (
      name
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

  const activityRoomExists =
    plan.creation_mode ===
      "scheduled_direct" ||
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

  if (
    roomPhase === "planning" &&
    plan.creation_mode ===
      "scheduled_direct"
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
    roomPhase === "activity" &&
    plan.creation_mode ===
      "matched"
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
          "planned"
      )
    );

  const canManageMembers =
    (isHost || isCoHost) &&
    !isExpiredPlanningPlan &&
    (
      plan.status ===
        "forming" ||
      plan.status ===
        "planned"
    );

  const isCompletionRequired =
    roomPhase ===
      "activity" &&
    plan.status ===
      "planned" &&
    plan.scheduled_end !==
      null &&
    new Date(
      plan.scheduled_end
    ).getTime() <=
      Date.now();

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

  const hostProfile =
    getFirst(
      plan.profiles
    );

  const hostName =
    hostProfile?.full_name ??
    "UIN member";

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

  const roomTitle =
    roomPhase === "planning"
      ? "Planning Room"
      : "Activity Room";

  const roomDescription =
    isExpiredPlanningArchive
      ? "Review the read-only planning history for this expired Activity window."
      : roomPhase === "planning"
        ? "Discuss the details and prepare the final Activity schedule."
        : "Coordinate the confirmed Activity with the other members.";

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
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/timeline"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {roomPhase ===
              "planning" &&
              activityRoomExists && (
                <Link
                  href={`/plans/${plan.id}/activity`}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Open Activity Room
                </Link>
              )}

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                isExpiredPlanningArchive
                  ? "bg-orange-100 text-orange-800"
                  : getStatusClasses(
                      plan.status
                    )
              }`}
            >
              {isExpiredPlanningArchive
                ? "Expired"
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
              The confirmed Activity schedule has ended.
            </h2>

            <p className="mt-3 text-sm leading-7 text-amber-800">
              The Primary Host or a
              Co-host should review
              attendance and complete the
              Activity. Only the Primary
              Host can mark it as not
              happened.
            </p>

            {(isHost || isCoHost) && (
              <Link
                href={`/plans/${plan.id}/completion`}
                className="mt-5 inline-flex rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Review Attendance →
              </Link>
            )}
          </div>
        )}

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isHost
                      ? "bg-gray-900 text-white"
                      : "bg-cyan-100 text-cyan-800"
                  }`}
                >
                  {isHost
                    ? "Primary Host"
                    : isCoHost
                      ? "Co-host"
                      : "Plan Participant"}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    roomPhase ===
                    "planning"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {roomTitle}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-bold text-gray-900">
                {plan.title ||
                  activity?.name ||
                  "UIN Activity"}
              </h1>

              <p className="mt-2 text-gray-500">
                {category?.name ??
                  "Unknown Category"}
              </p>

              <p className="mt-3 text-sm text-gray-600">
                Hosted by{" "}
                <ProfileNameLink
                  username={
                    hostProfile?.username
                  }
                  title={`View ${hostName}'s profile`}
                  className="font-semibold text-gray-900 transition hover:text-green-700 hover:underline hover:underline-offset-4"
                >
                  {hostName}
                </ProfileNameLink>
              </p>

              <p className="mt-3 text-sm text-gray-600">
                {roomDescription}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p className="font-semibold text-gray-900">
                {
                  activeMembers.length
                }{" "}
                members
              </p>

              <p className="mt-1">
                {participantCount} /{" "}
                {participantLimit}{" "}
                participants
              </p>

              <p className="mt-1 capitalize">
                Recruitment:{" "}
                {
                  plan.recruitment_status
                }
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2">
            <p>
              📅 Availability:{" "}
              {plan.window_start} →{" "}
              {plan.window_end}
            </p>

            <p>
              📍 Area:{" "}
              {location?.district ??
                "Unknown District"}
              ,{" "}
              {location?.city ??
                "Unknown City"}
            </p>

            <p>
              👥 Capacity:{" "}
              {participantCount} /{" "}
              {participantLimit}
            </p>

            <p>
              👁 Visible to:{" "}
              {getActivityVisibilityLabel(
                plan.visibility
              )}
            </p>
          </div>

          {hasSchedule &&
            plan.scheduled_start &&
            plan.scheduled_end &&
            plan.meeting_point && (
              <div
                className={`mt-6 rounded-2xl border p-5 ${
                  roomPhase ===
                  "planning"
                    ? "border-amber-100 bg-amber-50"
                    : "border-blue-100 bg-blue-50"
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    roomPhase ===
                    "planning"
                      ? "text-amber-700"
                      : "text-blue-700"
                  }`}
                >
                  {roomPhase ===
                  "planning"
                    ? "Current Schedule Draft"
                    : "Confirmed Schedule"}
                </p>

                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <p>
                    🕒{" "}
                    {formatDateTime(
                      plan.scheduled_start,
                      plan.timezone
                    )}{" "}
                    to{" "}
                    {formatTime(
                      plan.scheduled_end,
                      plan.timezone
                    )}
                  </p>

                  <p>
                    📍{" "}
                    {
                      plan.meeting_point
                    }
                  </p>

                  <p>
                    🌍{" "}
                    {plan.timezone}
                  </p>
                </div>

                {plan.schedule_notes && (
                  <p className="mt-4 whitespace-pre-wrap border-t border-black/5 pt-4 text-sm text-gray-700">
                    {
                      plan.schedule_notes
                    }
                  </p>
                )}
              </div>
            )}
        </section>

        {sourceIntentId &&
          (
            plan.status ===
              "forming" ||
            plan.status ===
              "planned"
          ) && (
          <div className="mt-6">
            <ActivityVisibilityManager
              intentId={
                sourceIntentId
              }
              initialVisibility={
                plan.visibility as ActivityVisibility
              }
              canEdit={
                isHost &&
                !isExpiredPlanningPlan
              }
              compact
            />
          </div>
        )}

        {roomPhase ===
          "activity" &&
          (
            plan.status ===
              "completed" ||
            isCompletionRequired
          ) && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                  Attendance
                </p>

                <h2 className="mt-2 text-xl font-bold text-gray-950">
                  {plan.status ===
                  "completed"
                    ? "Activity attendance archive"
                    : "Attendance review pending"}
                </h2>
              </div>

              {isCompletionRequired &&
                (isHost ||
                  isCoHost) && (
                <Link
                  href={`/plans/${plan.id}/completion`}
                  className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Review Attendance
                </Link>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Attended
                </p>

                <p className="mt-2 text-2xl font-bold text-green-950">
                  {
                    attendanceSummary.attended
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Did Not Attend
                </p>

                <p className="mt-2 text-2xl font-bold text-red-950">
                  {
                    attendanceSummary.noShow
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Not Recorded
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-950">
                  {
                    attendanceSummary.notRecorded
                  }
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-6">
          <PlanBudgetPanel
            planId={plan.id}
            planStatus={
              plan.status
            }
            isHost={
              isHost &&
              !isExpiredPlanningPlan
            }
            isActiveMember={
              isActiveMember &&
              !isExpiredPlanningPlan
            }
            initialTargetBudget={
              targetBudget
            }
            initialCommittedBudget={
              committedBudget
            }
            initialActualBudget={
              actualBudget
            }
            initialMyCommitment={
              myCommitment
            }
            initialActiveMemberCount={
              activeMemberCount
            }
            initialAttendedMemberCount={
              attendedMemberCount
            }
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          <PlanPeoplePanel
            planId={
              plan.id
            }
            planStatus={
              plan.status
            }
            roomPhase={
              roomPhase
            }
            recruitmentStatus={
              plan.recruitment_status
            }
            visibility={
              plan.visibility as
                | "public"
                | "friends"
                | "except_friends"
                | "invite_only"
                | "private"
            }
            actorUserId={
              user.id
            }
            actorRole={
              actorRole
            }
            sourceIntentId={
              sourceIntentId
            }
            activityLabel={
              plan.title ||
              activity?.name ||
              "UIN Activity"
            }
            members={
              peoplePanelMembers
            }
            invitations={
              peoplePanelInvitations
            }
          />

          <ConversationPanel
            title={`${roomTitle} Conversation`}
            description="Messages are shown from oldest to newest."
            messages={
              currentMessages
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
              canSendMessages
            }
            readOnlyTitle={
              isExpiredPlanningArchive
                ? "This Planning Room has expired."
                : "This room is read-only."
            }
            readOnlyDescription={
              isExpiredPlanningArchive
                ? `The availability window ended on ${formatWindowDate(
                    plan.window_end
                  )}. This conversation cannot be continued.`
                : isPlanningArchived
                  ? "Planning ended when the schedule was confirmed."
                  : "Messages cannot be sent in the current Activity state."
            }
            emptyTitle="No messages yet."
            emptyDescription={
              isExpiredPlanningArchive
                ? "No messages were recorded before this Planning Room expired."
                : "Start the room conversation."
            }
          />
        </div>

        {roomPhase ===
          "planning" &&
          plan.status ===
            "forming" &&
          !isExpiredPlanningPlan &&
          (isHost ||
            isCoHost) && (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SharedPlanScheduleForm
                planId={plan.id}
                windowStart={
                  plan.window_start
                }
                windowEnd={
                  plan.window_end
                }
                timezone={
                  plan.timezone
                }
                scheduledStart={
                  plan.scheduled_start
                }
                scheduledEnd={
                  plan.scheduled_end
                }
                meetingPoint={
                  plan.meeting_point
                }
                scheduleNotes={
                  plan.schedule_notes
                }
                actorRole={
                  isHost
                    ? "host"
                    : "co_host"
                }
              />

              {isHost ? (
                <ConfirmActivityPlanButton
                  planId={plan.id}
                  hasSchedule={
                    hasSchedule
                  }
                  recruitmentStatus={
                    plan.recruitment_status
                  }
                />
              ) : (
                <section className="rounded-3xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Co-host Access
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-purple-950">
                    Schedule draft access
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-purple-700">
                    You can edit the
                    schedule draft and
                    coordinate members.
                    The Primary Host keeps
                    final confirmation and
                    host-transfer authority.
                  </p>
                </section>
              )}
            </div>
          )}

        {roomPhase ===
          "activity" &&
          plan.creation_mode ===
            "matched" &&
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