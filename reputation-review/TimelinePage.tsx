import Link from "next/link";
import { redirect } from "next/navigation";

import TimelineHeader from "../../components/timeline/TimelineHeader";
import ResourceArchiveButton from "../../components/archive/ResourceArchiveButton";
import TimelinePlanPresentation from "../../components/timeline/TimelinePlanPresentation";
import TimelineIntentPresentation from "../../components/timeline/TimelineIntentPresentation";
import TimelineExpiredPresentation from "../../components/timeline/TimelineExpiredPresentation";
import ManagedMinorTimeline from "../../components/family/ManagedMinorTimeline";
import {
  type FamilyCenterData,
} from "../../components/family/AgeAndFamilyManager";
import IntentActionButtons from "../../components/timeline/IntentActionButtons";
import IntentInvitePeopleButton from "../../components/intents/IntentInvitePeopleButton";
import {
  getActivityVisibilityLabel,
} from "../../utils/activityVisibility";
import {
  groupIntentLinksByIntentId,
  parseIntentLinkRows,
  type IntentLinkRpcRow,
} from "../../utils/intentLinks";
import {
  type ManagedProfileSwitcherRow,
} from "../../components/navigation/AccountContextSwitcher";
import { createClient } from "../../utils/supabase/server";

type IntentStatus =
  | "active"
  | "planned"
  | "completed"
  | "cancelled";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type MatchingStatus =
  | "open"
  | "paused"
  | "matched"
  | "closed";

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type TimelineView =
  | "open"
  | "full"
  | "closed"
  | "forming"
  | "participating"
  | "planned"
  | "action_required"
  | "completed"
  | "expired"
  | "cancelled";

type IntentRequestStatus =
  | "pending"
  | "accepted"
  | "rejected";

type TimelineLocation = {
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  district: string | null;
  scope: string | null;
};

type TimelineActivityCategory = {
  name: string;
  default_cover_url: string | null;
};

type TimelineActivity = {
  name: string;
  default_cover_url: string | null;
  activity_categories:
    | TimelineActivityCategory
    | TimelineActivityCategory[]
    | null;
};

type TimelineProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type TimelineIntent = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  people: string;
  budget: number | null;
  recurrence: string;
  visibility: string;
  notes: string | null;
  intent_type: string;
  status: IntentStatus;
  recruitment_status: RecruitmentStatus;
  matching_status: MatchingStatus;
  max_participants: number | null;
  planned_at: string | null;
  expired_at: string | null;
  copied_from_intent_id: string | null;
  created_at: string;
  locations:
    | TimelineLocation
    | TimelineLocation[]
    | null;
  activities:
    | TimelineActivity
    | TimelineActivity[]
    | null;
};

type PlanMember = {
  id: string;
  user_id: string;
  role:
    | "host"
    | "co_host"
    | "participant";
  status:
    | "active"
    | "withdrawn"
    | "removed";
  budget_commitment:
    | number
    | string
    | null;
  attendance_status:
    | "pending"
    | "attended"
    | "no_show"
    | "cancelled";
  profiles:
    | TimelineProfile
    | TimelineProfile[]
    | null;
};

type PlanIntentLink = {
  id: string;
  intent_id: string;
  relationship:
    | "host_source"
    | "participant_source";
  status:
    | "active"
    | "detached";
};

type TimelinePlan = {
  id: string;
  host_user_id: string;
  title: string;
  cover_url: string | null;
  address_text: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  map_url: string | null;
  street_view_url: string | null;
  activity_id: string;
  location_id: string;
  window_start: string;
  window_end: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string;
  meeting_point: string | null;
  schedule_notes: string | null;
  budget: number | null;
  target_budget:
    | number
    | string
    | null;
  max_participants: number | null;
  status: PlanStatus;
  recruitment_status: RecruitmentStatus;
  visibility: string;
  notes: string | null;
  planned_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  created_at: string;
  locations:
    | TimelineLocation
    | TimelineLocation[]
    | null;
  activities:
    | TimelineActivity
    | TimelineActivity[]
    | null;
  profiles:
    | TimelineProfile
    | TimelineProfile[]
    | null;
  plan_members:
    | PlanMember[]
    | null;
  plan_intents:
    | PlanIntentLink[]
    | null;
};

type IntentRequestRow = {
  id: string;
  requester_id: string;
  receiver_id: string;
  target_intent_id: string;
  status: IntentRequestStatus;
};

type PlanConversationSummary = {
  plan_id: string;
  latest_message_id: string | null;
  latest_message_type:
    | "text"
    | "system"
    | null;
  latest_system_event: string | null;
  latest_body: string | null;
  latest_sender_id: string | null;
  latest_sender_name: string | null;
  latest_created_at: string | null;
  unread_count:
    | number
    | string
    | null;
};

type ExpiredActivityHistoryRow = {
  item_type: "intent" | "plan";
  item_id: string;
  plan_id: string | null;
  source_intent_id: string | null;
  title: string;
  activity_name: string | null;
  category_name: string | null;
  city: string | null;
  district: string | null;
  window_start: string;
  window_end: string;
  expired_at: string;
  user_role: "owner" | "host" | "participant";
  host_user_id: string;
  participant_count: number | string | null;
  max_participants: number | null;
  personal_budget: number | string | null;
  target_budget: number | string | null;
  committed_budget: number | string | null;
  visibility: string | null;
  notes: string | null;
  recruitment_status: string | null;
  matching_status: string | null;
  copied_from_intent_id: string | null;
  can_create_again: boolean;
};

type IntentTimelineEntry = {
  kind: "intent";
  intent: TimelineIntent;
};

type PlanTimelineEntry = {
  kind: "plan";
  plan: TimelinePlan;
  relationship:
    | "host"
    | "co_host"
    | "participant";
};

type TimelineEntry =
  | IntentTimelineEntry
  | PlanTimelineEntry;

type TimelinePageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

type TimelineTab = {
  key: TimelineView;
  label: string;
  inactiveClasses: string;
  activeClasses: string;
};

const TIMELINE_TABS: TimelineTab[] = [
  {
    key: "open",
    label: "Open",
    inactiveClasses:
      "bg-green-50 text-green-700 hover:bg-green-100",
    activeClasses:
      "bg-green-600 text-white shadow-sm",
  },
  {
    key: "full",
    label: "Full",
    inactiveClasses:
      "bg-amber-50 text-amber-700 hover:bg-amber-100",
    activeClasses:
      "bg-amber-500 text-white shadow-sm",
  },
  {
    key: "closed",
    label: "Closed",
    inactiveClasses:
      "bg-gray-100 text-gray-700 hover:bg-gray-200",
    activeClasses:
      "bg-gray-700 text-white shadow-sm",
  },
  {
    key: "forming",
    label: "Forming",
    inactiveClasses:
      "bg-violet-50 text-violet-700 hover:bg-violet-100",
    activeClasses:
      "bg-violet-600 text-white shadow-sm",
  },
  {
    key: "participating",
    label: "Participating",
    inactiveClasses:
      "bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    activeClasses:
      "bg-cyan-600 text-white shadow-sm",
  },
  {
    key: "planned",
    label: "Planned",
    inactiveClasses:
      "bg-blue-50 text-blue-700 hover:bg-blue-100",
    activeClasses:
      "bg-blue-600 text-white shadow-sm",
  },
  {
    key: "action_required",
    label: "Action Required",
    inactiveClasses:
      "bg-amber-50 text-amber-700 hover:bg-amber-100",
    activeClasses:
      "bg-amber-600 text-white shadow-sm",
  },
  {
    key: "completed",
    label: "Completed",
    inactiveClasses:
      "bg-purple-50 text-purple-700 hover:bg-purple-100",
    activeClasses:
      "bg-purple-600 text-white shadow-sm",
  },
  {
    key: "expired",
    label: "Expired",
    inactiveClasses:
      "bg-orange-50 text-orange-700 hover:bg-orange-100",
    activeClasses:
      "bg-orange-600 text-white shadow-sm",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    inactiveClasses:
      "bg-red-50 text-red-700 hover:bg-red-100",
    activeClasses:
      "bg-red-600 text-white shadow-sm",
  },
];

const INTENT_TIMELINE_TABS =
  TIMELINE_TABS.filter(
    (tab) =>
      tab.key === "open" ||
      tab.key === "full" ||
      tab.key === "closed"
  );

const ACTIVITY_TIMELINE_TABS =
  TIMELINE_TABS.filter(
    (tab) =>
      tab.key !== "open" &&
      tab.key !== "full" &&
      tab.key !== "closed"
  );

const INTENT_LIFECYCLE_VIEWS =
  new Set<TimelineView>([
    "open",
    "full",
    "closed",
  ]);

const INTENT_SELECT_QUERY = `
  id,
  user_id,
  start_date,
  end_date,
  people,
  budget,
  recurrence,
  visibility,
  notes,
  intent_type,
  status,
  recruitment_status,
  matching_status,
  max_participants,
  planned_at,
  expired_at,
  copied_from_intent_id,
  created_at,
  locations (
    country_code,
    country_name,
    city,
    district,
    scope
  ),
  activities (
    name,
    default_cover_url,
    activity_categories (
      name,
      default_cover_url
    )
  )
`;

const PLAN_SELECT_QUERY = `
  id,
  host_user_id,
  title,
  cover_url,
  address_text,
  latitude,
  longitude,
  map_url,
  street_view_url,
  activity_id,
  location_id,
  window_start,
  window_end,
  scheduled_start,
  scheduled_end,
  timezone,
  meeting_point,
  schedule_notes,
  budget,
  target_budget,
  max_participants,
  status,
  recruitment_status,
  visibility,
  notes,
  planned_at,
  completed_at,
  cancelled_at,
  expired_at,
  created_at,
  locations (
    country_code,
    country_name,
    city,
    district,
    scope
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
    avatar_url
  ),
  plan_members (
    id,
    user_id,
    role,
    status,
    budget_commitment,
    attendance_status,
    profiles!plan_members_user_id_fkey (
      id,
      full_name,
      avatar_url
    )
  ),
  plan_intents (
    id,
    intent_id,
    relationship,
    status
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

  return Number.isFinite(parsedValue)
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
    toFiniteNumber(
      value,
      Number.NaN
    );

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function formatBudget(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function getTodayDateKey() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function isExpiredIntent(
  intent: TimelineIntent
) {
  return (
    intent.status === "active" &&
    (
      intent.expired_at !== null ||
      intent.end_date <
        getTodayDateKey()
    )
  );
}

function isExpiredPlan(
  plan: TimelinePlan
) {
  return (
    plan.status === "forming" &&
    (
      plan.expired_at !== null ||
      plan.window_end <
        getTodayDateKey()
    )
  );
}

const PLANNED_OUTCOME_GRACE_MS =
  24 * 60 * 60 * 1000;

function isOverduePlannedPlan(
  plan: TimelinePlan
) {
  if (
    plan.status !==
      "planned"
  ) {
    return false;
  }

  if (
    plan.expired_at !==
    null
  ) {
    return true;
  }

  if (
    !plan.scheduled_end
  ) {
    return (
      plan.window_end <
      getTodayDateKey()
    );
  }

  const scheduledEnd =
    new Date(
      plan.scheduled_end
    ).getTime();

  return (
    Number.isFinite(
      scheduledEnd
    ) &&
    scheduledEnd +
      PLANNED_OUTCOME_GRACE_MS <=
      Date.now()
  );
}

function formatHistoryDate(
  value: string
) {
  const date = new Date(
    `${value}T00:00:00`
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
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatHistoryTimestamp(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}

function isTimelineView(
  value: string | undefined
): value is TimelineView {
  return TIMELINE_TABS.some(
    (tab) =>
      tab.key === value
  );
}

function getActivePlanMembers(
  plan: TimelinePlan
) {
  return (
    plan.plan_members ?? []
  ).filter(
    (member) =>
      member.status === "active"
  );
}

function getActivePlanParticipants(
  plan: TimelinePlan
) {
  return getActivePlanMembers(
    plan
  ).filter(
    (member) =>
      member.role ===
      "participant"
  );
}

function getPlanCommittedBudget(
  plan: TimelinePlan
) {
  return getActivePlanMembers(
    plan
  ).reduce(
    (total, member) =>
      total +
      toFiniteNumber(
        member.budget_commitment
      ),
    0
  );
}

function isPlanCompletionRequired(
  plan: TimelinePlan
) {
  if (
    plan.status !==
      "planned" ||
    !plan.scheduled_end
  ) {
    return false;
  }

  const endTime =
    new Date(
      plan.scheduled_end
    ).getTime();

  return (
    Number.isFinite(endTime) &&
    endTime <= Date.now()
  );
}

function getCurrentUserActivePlanMember(
  plan: TimelinePlan,
  currentUserId: string
) {
  return getActivePlanMembers(
    plan
  ).find(
    (member) =>
      member.user_id ===
      currentUserId
  ) ?? null;
}

function getCurrentUserPlanRelationship(
  plan: TimelinePlan,
  currentUserId: string
):
  | "host"
  | "co_host"
  | "participant"
  | null {
  if (
    plan.host_user_id ===
    currentUserId
  ) {
    return "host";
  }

  const currentMember =
    getCurrentUserActivePlanMember(
      plan,
      currentUserId
    );

  if (!currentMember) {
    return null;
  }

  return currentMember.role ===
    "co_host"
    ? "co_host"
    : "participant";
}

function getEntryView(
  entry: TimelineEntry
): TimelineView | null {
  if (
    entry.kind === "intent"
  ) {
    const { intent } = entry;

    if (
      isExpiredIntent(intent)
    ) {
      return null;
    }

    if (
      intent.status === "planned"
    ) {
      return "planned";
    }

    if (
      intent.status === "completed"
    ) {
      return "completed";
    }

    if (
      intent.status === "cancelled"
    ) {
      return "cancelled";
    }

    if (
      intent.status !== "active" ||
      intent.matching_status ===
        "matched"
    ) {
      return null;
    }

    if (
      intent.recruitment_status ===
      "full"
    ) {
      return "full";
    }

    if (
      intent.recruitment_status ===
        "closed" ||
      intent.matching_status ===
        "paused" ||
      intent.matching_status ===
        "closed"
    ) {
      return "closed";
    }

    return "open";
  }

  const {
    plan,
    relationship,
  } = entry;

  if (
    isExpiredPlan(plan)
  ) {
    return null;
  }

  if (
    isOverduePlannedPlan(
      plan
    )
  ) {
    return "expired";
  }

  if (
    plan.status === "planned"
  ) {
    if (
      isPlanCompletionRequired(
        plan
      ) &&
      (
        relationship ===
          "host" ||
        relationship ===
          "co_host"
      )
    ) {
      return "action_required";
    }

    return "planned";
  }

  if (
    plan.status === "completed"
  ) {
    return "completed";
  }

  if (
    plan.status === "cancelled"
  ) {
    return "cancelled";
  }

  if (
    relationship ===
    "participant"
  ) {
    return "participating";
  }

  if (
    plan.status ===
    "forming"
  ) {
    return "forming";
  }

  return null;
}

function getTimelineTabLabel(
  view: TimelineView
) {
  return (
    TIMELINE_TABS.find(
      (tab) =>
        tab.key === view
    )?.label ?? "Timeline"
  );
}

function getIntentSectionTitle(
  view: TimelineView
) {
  return `${getTimelineTabLabel(
    view
  )} Intents`;
}

function getFormingActivitySectionTitle(
  view: TimelineView
) {
  if (view === "open") {
    return "Forming Activities";
  }

  return `${getTimelineTabLabel(
    view
  )} Forming Activities`;
}

function getIntentSectionDescription(
  view: TimelineView
) {
  if (view === "open") {
    return "Your Intents currently open to matching.";
  }

  if (view === "full") {
    return "Your Intents that have reached participant capacity.";
  }

  return "Your active Intents where matching is closed.";
}

function getFormingActivitySectionDescription(
  view: TimelineView
) {
  if (view === "open") {
    return "Shared Plans currently being organized and open to participants.";
  }

  if (view === "full") {
    return "Shared Plans currently being organized with full participant capacity.";
  }

  return "Shared Plans currently being organized with recruitment closed.";
}

function getActivitySectionTitle(
  view: TimelineView
) {
  if (view === "action_required") {
    return "Activities Requiring Action";
  }

  if (view === "expired") {
    return "Expired Intents & Forming Activities";
  }

  return `${getTimelineTabLabel(
    view
  )} Activities`;
}

function getEmptyIntentSectionText(
  view: TimelineView
) {
  if (view === "open") {
    return "You have no Intent currently open to matching.";
  }

  if (view === "full") {
    return "You have no Intent with full participant capacity.";
  }

  return "You have no active Intent with matching closed.";
}

function getEmptyFormingActivitySectionText(
  view: TimelineView
) {
  if (view === "open") {
    return "You have no forming Activity currently open to participants.";
  }

  if (view === "full") {
    return "You have no forming Activity with full participant capacity.";
  }

  return "You have no forming Activity with recruitment closed.";
}

function getEmptyStateText(
  view: TimelineView
) {
  if (view === "open") {
    return "You have no Intent or Plan currently open for matching.";
  }

  if (view === "full") {
    return "You have no Plan with full participant capacity.";
  }

  if (view === "closed") {
    return "You have no Intent or Plan with matching closed.";
  }

  if (
    view === "forming"
  ) {
    return "You have no forming Activity currently being organized.";
  }

  if (
    view === "participating"
  ) {
    return "You are not currently participating in another person's forming Plan.";
  }

  if (view === "planned") {
    return "You have no planned Activity yet.";
  }

  if (
    view ===
      "action_required"
  ) {
    return "No ended Activity currently needs your attendance review.";
  }

  if (
    view === "completed"
  ) {
    return "You have no completed Activity yet.";
  }

  if (view === "expired") {
    return "You have no expired Intent or forming Plan.";
  }

  return "You have no cancelled Activity.";
}

function getSectionDescription(
  view: TimelineView
) {
  if (view === "open") {
    return "Your Intents and forming Plans currently open for matching.";
  }

  if (view === "full") {
    return "Your forming Plans that have reached participant capacity.";
  }

  if (view === "closed") {
    return "Your active Intents and forming Plans where new matching is closed.";
  }

  if (
    view === "forming"
  ) {
    return "Shared Plans you host or co-host that are currently being organized.";
  }

  if (
    view === "participating"
  ) {
    return "Forming Plans hosted by another person that you have joined.";
  }

  if (view === "planned") {
    return "Planned Activities you host or participate in.";
  }

  if (
    view ===
      "action_required"
  ) {
    return "Ended planned Activities waiting for attendance and completion confirmation.";
  }

  if (
    view === "completed"
  ) {
    return "Completed Activities from your UIN history.";
  }

  if (view === "expired") {
    return "Intents, forming Plans and overdue scheduled Activities that ended without a recorded outcome.";
  }

  return "Cancelled Activities you hosted or participated in.";
}

function getIntentStatusLabel(
  intent: TimelineIntent
) {
  if (
    intent.status === "planned"
  ) {
    return "Planned";
  }

  if (
    intent.status === "completed"
  ) {
    return "Completed";
  }

  if (
    intent.status === "cancelled"
  ) {
    return "Cancelled";
  }

  if (
    intent.recruitment_status ===
    "full"
  ) {
    return "Full";
  }

  if (
    intent.recruitment_status ===
      "closed" ||
    intent.matching_status ===
      "paused" ||
    intent.matching_status ===
      "closed"
  ) {
    return "Closed";
  }

  return "Open";
}

function getIntentStatusClasses(
  intent: TimelineIntent
) {
  if (
    intent.status === "planned"
  ) {
    return "bg-blue-50 text-blue-700";
  }

  if (
    intent.status === "completed"
  ) {
    return "bg-purple-50 text-purple-700";
  }

  if (
    intent.status === "cancelled"
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    intent.recruitment_status ===
    "full"
  ) {
    return "bg-amber-50 text-amber-700";
  }

  if (
    intent.recruitment_status ===
      "closed" ||
    intent.matching_status ===
      "paused" ||
    intent.matching_status ===
      "closed"
  ) {
    return "bg-gray-100 text-gray-700";
  }

  return "bg-green-50 text-green-700";
}

function getPlanStatusLabel(
  plan: TimelinePlan,
  relationship:
    | "host"
    | "co_host"
    | "participant"
) {
  if (
    isOverduePlannedPlan(
      plan
    )
  ) {
    return "Expired";
  }

  if (
    plan.status === "planned"
  ) {
    if (
      isPlanCompletionRequired(
        plan
      ) &&
      (
        relationship ===
          "host" ||
        relationship ===
          "co_host"
      )
    ) {
      return "Action Required";
    }

    return "Planned";
  }

  if (
    plan.status === "completed"
  ) {
    return "Completed";
  }

  if (
    plan.status === "cancelled"
  ) {
    return "Cancelled";
  }

  if (
    relationship ===
      "co_host"
  ) {
    return "Co-hosting";
  }

  if (
    relationship ===
    "participant"
  ) {
    return "Participating";
  }

  if (
    plan.recruitment_status ===
    "full"
  ) {
    return "Full";
  }

  if (
    plan.recruitment_status ===
    "closed"
  ) {
    return "Closed";
  }

  return "Open";
}

function getPlanStatusClasses(
  plan: TimelinePlan,
  relationship:
    | "host"
    | "co_host"
    | "participant"
) {
  if (
    isOverduePlannedPlan(
      plan
    )
  ) {
    return "bg-orange-100 text-orange-800";
  }

  if (
    plan.status === "planned"
  ) {
    if (
      isPlanCompletionRequired(
        plan
      ) &&
      (
        relationship ===
          "host" ||
        relationship ===
          "co_host"
      )
    ) {
      return "bg-amber-100 text-amber-800";
    }

    return "bg-blue-50 text-blue-700";
  }

  if (
    plan.status === "completed"
  ) {
    return "bg-purple-50 text-purple-700";
  }

  if (
    plan.status === "cancelled"
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    relationship ===
      "co_host"
  ) {
    return "bg-purple-50 text-purple-700";
  }

  if (
    relationship ===
    "participant"
  ) {
    return "bg-cyan-50 text-cyan-700";
  }

  if (
    plan.recruitment_status ===
    "full"
  ) {
    return "bg-amber-50 text-amber-700";
  }

  if (
    plan.recruitment_status ===
    "closed"
  ) {
    return "bg-gray-100 text-gray-700";
  }

  return "bg-green-50 text-green-700";
}

function formatPlanDateTime(
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

function formatPlanTime(
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

function isSameLocalDate(
  firstIsoDate: string,
  secondIsoDate: string,
  timezone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  return (
    formatter.format(
      new Date(firstIsoDate)
    ) ===
    formatter.format(
      new Date(secondIsoDate)
    )
  );
}

function formatScheduleRange(
  scheduledStart: string,
  scheduledEnd: string,
  timezone: string
) {
  if (
    isSameLocalDate(
      scheduledStart,
      scheduledEnd,
      timezone
    )
  ) {
    return `${formatPlanDateTime(
      scheduledStart,
      timezone
    )} – ${formatPlanTime(
      scheduledEnd,
      timezone
    )}`;
  }

  return `${formatPlanDateTime(
    scheduledStart,
    timezone
  )} – ${formatPlanDateTime(
    scheduledEnd,
    timezone
  )}`;
}

function cleanPreviewText(
  text: string
) {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

function getConversationPreview(
  summary:
    | PlanConversationSummary
    | null,
  currentUserId: string
) {
  if (
    !summary ||
    !summary.latest_message_id ||
    !summary.latest_body
  ) {
    return "No messages yet.";
  }

  const body =
    cleanPreviewText(
      summary.latest_body
    );

  if (
    summary.latest_message_type ===
    "system"
  ) {
    return body;
  }

  const senderName =
    summary.latest_sender_id ===
    currentUserId
      ? "You"
      : summary.latest_sender_name ??
        "UIN member";

  return `${senderName}: ${body}`;
}

function getUnreadCount(
  summary:
    | PlanConversationSummary
    | null
) {
  const count = Number(
    summary?.unread_count ?? 0
  );

  return Number.isFinite(count)
    ? count
    : 0;
}

function ExpiredActivityCard({
  item,
}: {
  item: ExpiredActivityHistoryRow;
}) {
  const participantCount =
    toFiniteNumber(
      item.participant_count
    );

  const committedBudget =
    toNullableNumber(
      item.committed_budget
    );

  const targetBudget =
    toNullableNumber(
      item.target_budget
    );

  const personalBudget =
    toNullableNumber(
      item.personal_budget
    );

  const roleLabel =
    item.user_role === "host"
      ? "Plan Host"
      : item.user_role ===
          "participant"
        ? "Plan Participant"
        : "Intent Owner";

  return (
    <div className="space-y-3">
      <TimelineExpiredPresentation
      itemType={
        item.item_type
      }
      title={
        item.title ||
        item.activity_name ||
        "Expired Activity"
      }
      activityName={
        item.activity_name
      }
      categoryName={
        item.category_name
      }
      city={
        item.city
      }
      district={
        item.district
      }
      windowStart={
        item.window_start
      }
      windowEnd={
        item.window_end
      }
      expiredAt={
        item.expired_at
      }
      roleLabel={
        roleLabel
      }
      participantCount={
        participantCount
      }
      maxParticipants={
        item.max_participants
      }
      personalBudget={
        personalBudget
      }
      committedBudget={
        committedBudget
      }
      targetBudget={
        targetBudget
      }
      visibility={
        item.visibility
      }
      notes={
        item.notes
      }
      recruitmentStatus={
        item.recruitment_status
      }
      matchingStatus={
        item.matching_status
      }
      copiedFromIntentId={
        item.copied_from_intent_id
      }
      planId={
        item.plan_id
      }
      sourceIntentId={
        item.source_intent_id
      }
      canCreateAgain={
        item.can_create_again
      }
      />

      <div className="flex justify-end">
        <ResourceArchiveButton
          resourceType={
            item.item_type
          }
          resourceId={
            item.item_id
          }
          compact
        />
      </div>
    </div>
  );
}

export default async function TimelinePage({
  searchParams,
}: TimelinePageProps) {
  const resolvedSearchParams =
    await searchParams;

  const selectedView =
    isTimelineView(
      resolvedSearchParams.view
    )
      ? resolvedSearchParams.view
      : "open";

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const currentUserId = user.id;
  const {
    data: familyCenterData,
    error: familyCenterError,
  } = await supabase.rpc(
    "get_my_family_center"
  );

  if (familyCenterError) {
    console.error(
      "Timeline age and family query failed:",
      familyCenterError
    );
  }

  const familyCenter =
    familyCenterData as
      | FamilyCenterData
      | null;

  if (
    familyCenter?.self
      .is_managed_minor
  ) {
    return (
      <ManagedMinorTimeline
        familyData={
          familyCenter
        }
      />
    );
  }

  const today = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());

  const [
    ownedIntentResult,
    planResult,
    requestResult,
    conversationSummaryResult,
    expiredActivityResult,
    intentInvitationResult,
    joinRequestResult,
    notificationCountResult,
    managedProfilesResult,
    personalProfileResult,
    adminResult,
    activeMatchCountResult,
    archivedResourceKeysResult,
  ] = await Promise.all([
    supabase
      .from("intents")
      .select(
        INTENT_SELECT_QUERY
      )
      .eq(
        "user_id",
        currentUserId
      )
      .is(
        "archived_at",
        null
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from("plans")
      .select(
        PLAN_SELECT_QUERY
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    supabase
      .from(
        "intent_requests"
      )
      .select(`
        id,
        requester_id,
        receiver_id,
        target_intent_id,
        status
      `)
      .or(
        `requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`
      ),

    supabase.rpc(
      "get_plan_conversation_summaries"
    ),

    supabase.rpc(
      "get_my_expired_activity_history"
    ),

    supabase.rpc(
      "get_my_received_intent_invitations"
    ),

    supabase.rpc(
      "get_my_intent_join_requests"
    ),

    supabase.rpc(
      "get_my_unread_notification_count"
    ),

    supabase.rpc(
      "get_my_managed_profile_switcher"
    ),

    supabase
      .from("profiles")
      .select(
        "full_name, username, avatar_url"
      )
      .eq(
        "id",
        currentUserId
      )
      .maybeSingle(),

    supabase.rpc(
      "is_admin"
    ),

    supabase.rpc(
      "get_my_active_match_count"
    ),

    supabase.rpc(
      "get_my_archived_resource_keys"
    ),
  ]);

  if (
    ownedIntentResult.error
  ) {
    console.error(
      "Owned intents query failed:",
      ownedIntentResult.error
    );
  }

  if (
    planResult.error
  ) {
    console.error(
      "Plans query failed:",
      planResult.error
    );
  }

  if (
    requestResult.error
  ) {
    console.error(
      "Requests query failed:",
      requestResult.error
    );
  }

  if (
    conversationSummaryResult.error
  ) {
    console.error(
      "Conversation summaries query failed:",
      conversationSummaryResult.error
    );
  }

  if (
    expiredActivityResult.error
  ) {
    console.error(
      "Expired activity history query failed:",
      expiredActivityResult.error
    );
  }

  if (
    intentInvitationResult.error
  ) {
    console.error(
      "Intent invitation query failed:",
      intentInvitationResult.error
    );
  }

  if (
    joinRequestResult.error
  ) {
    console.error(
      "Join request query failed:",
      joinRequestResult.error
    );
  }

  if (
    notificationCountResult.error
  ) {
    console.error(
      "Notification count query failed:",
      notificationCountResult.error
    );
  }

  if (
    managedProfilesResult.error
  ) {
    console.error(
      "Managed profile switcher query failed:",
      managedProfilesResult.error
    );
  }

  if (
    personalProfileResult.error
  ) {
    console.error(
      "Personal profile query failed:",
      personalProfileResult.error
    );
  }

  if (
    adminResult.error
  ) {
    console.error(
      "Admin status query failed:",
      adminResult.error
    );
  }

  if (
    activeMatchCountResult.error
  ) {
    console.error(
      "Active Match count query failed:",
      activeMatchCountResult.error
    );
  }

  if (
    archivedResourceKeysResult.error
  ) {
    console.error(
      "Archive keys query failed:",
      archivedResourceKeysResult.error
    );
  }

  const joinRequests =
    (
      joinRequestResult.data ??
      []
    ) as {
      direction?: string;
      request_status?: string;
    }[];

  const pendingJoinRequestCount =
    joinRequests.filter(
      (request) =>
        request.direction ===
          "received" &&
        request.request_status ===
          "pending"
    ).length;

  const unreadNotificationCount =
    Number(
      notificationCountResult.data ??
      0
    );

  const receivedIntentInvitations =
    (
      intentInvitationResult.data ??
      []
    ) as {
      invitation_status?: string;
    }[];

  const pendingIntentInvitationCount =
    receivedIntentInvitations.filter(
      (invitation) =>
        invitation.invitation_status ===
        "pending"
    ).length;

  const managedProfiles =
    (
      managedProfilesResult.data ??
      []
    ) as ManagedProfileSwitcherRow[];

  const personalProfile =
    (
      personalProfileResult.data ??
      {
        full_name: null,
        username: null,
        avatar_url: null,
      }
    ) as {
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };

  const isAdmin =
    adminResult.data ===
      true;

  const activeMatchCount =
    Number(
      activeMatchCountResult.data ??
      0
    );

  const archivedResourceKeys =
    (
      archivedResourceKeysResult.data ??
      []
    ) as Array<{
      resource_type: "intent" | "plan";
      resource_id: string;
    }>;

  const archivedPlanIds =
    new Set(
      archivedResourceKeys
        .filter(
          (item) =>
            item.resource_type === "plan"
        )
        .map(
          (item) => item.resource_id
        )
    );

  const archivedIntentIds =
    new Set(
      archivedResourceKeys
        .filter(
          (item) =>
            item.resource_type === "intent"
        )
        .map(
          (item) => item.resource_id
        )
    );

  const ownedIntents =
    (
      ownedIntentResult.data ??
      []
    ) as unknown as TimelineIntent[];

  const plans =
    (
      planResult.data ??
      []
    )
      .filter(
        (plan) =>
          !archivedPlanIds.has(
            String(
              (plan as { id?: string }).id ?? ""
            )
          )
      ) as unknown as TimelinePlan[];

  let intentLinkRows:
    IntentLinkRpcRow[] =
    [];

  const visibleIntentIds =
    Array.from(
      new Set(
        [
          ...ownedIntents.map(
            (intent) =>
              intent.id
          ),
          ...plans.flatMap(
            (plan) =>
              (
                plan.plan_intents ??
                []
              )
                .filter(
                  (link) =>
                    link.status ===
                      "active"
                )
                .map(
                  (link) =>
                    link.intent_id
                )
          ),
        ]
      )
    );

  for (
    let startIndex = 0;
    startIndex <
      visibleIntentIds.length;
    startIndex += 100
  ) {
    const intentIdBatch =
      visibleIntentIds.slice(
        startIndex,
        startIndex + 100
      );

    const {
      data:
        intentLinkData,
      error:
        intentLinkError,
    } = await supabase.rpc(
      "get_visible_intent_links",
      {
        p_intent_ids:
          intentIdBatch,
      }
    );

    if (
      intentLinkError
    ) {
      console.error(
        "Intent related links query failed:",
        intentLinkError
      );

      continue;
    }

    intentLinkRows.push(
      ...(
        (
          intentLinkData ??
          []
        ) as IntentLinkRpcRow[]
      )
    );
  }

  const intentLinksByIntentId =
    groupIntentLinksByIntentId(
      parseIntentLinkRows(
        intentLinkRows
      )
    );


  const requests =
    (
      requestResult.data ??
      []
    ) as IntentRequestRow[];

  const conversationSummaries =
    (
      conversationSummaryResult.data ??
      []
    ) as PlanConversationSummary[];

  const expiredActivities =
    (
      expiredActivityResult.data ??
      []
    ).filter(
      (item) => {
        const archiveSet =
          item.item_type === "plan"
            ? archivedPlanIds
            : archivedIntentIds;

        return !archiveSet.has(
          String(
            item.item_id
          )
        );
      }
    ) as ExpiredActivityHistoryRow[];

  const conversationSummaryByPlanId =
    new Map<
      string,
      PlanConversationSummary
    >();

  conversationSummaries.forEach(
    (summary) => {
      conversationSummaryByPlanId.set(
        summary.plan_id,
        summary
      );
    }
  );

  const linkedIntentIds =
    new Set<string>();

  plans.forEach((plan) => {
    (
      plan.plan_intents ?? []
    )
      .filter(
        (link) =>
          link.status === "active"
      )
      .forEach((link) => {
        linkedIntentIds.add(
          link.intent_id
        );
      });
  });

  const standaloneIntentEntries:
    IntentTimelineEntry[] =
    ownedIntents
      .filter(
        (intent) =>
          !linkedIntentIds.has(
            intent.id
          )
      )
      .map((intent) => ({
        kind: "intent",
        intent,
      }));

  const planEntries:
    PlanTimelineEntry[] =
    plans.flatMap((plan) => {
      const relationship =
        getCurrentUserPlanRelationship(
          plan,
          currentUserId
        );

      if (!relationship) {
        return [];
      }

      return [
        {
          kind: "plan",
          plan,
          relationship,
        },
      ];
    });

  const timelineEntries:
    TimelineEntry[] = [
    ...standaloneIntentEntries,
    ...planEntries,
  ];

  const requestCountByIntentId =
    new Map<string, number>();

  requests
    .filter(
      (request) =>
        request.receiver_id ===
          currentUserId &&
        request.status ===
          "pending"
    )
    .forEach((request) => {
      const currentCount =
        requestCountByIntentId.get(
          request.target_intent_id
        ) ?? 0;

      requestCountByIntentId.set(
        request.target_intent_id,
        currentCount + 1
      );
    });

  const incomingRequestCount =
    requests.filter(
      (request) =>
        request.receiver_id ===
          currentUserId &&
        request.status ===
          "pending"
    ).length;

  const pendingManagedProfileActionCount =
    managedProfiles.reduce(
      (
        total,
        profile
      ) =>
        total +
        Number(
          profile.pending_invitation_count ||
            0
        ),
      0
    );

  const inboxCount =
    incomingRequestCount +
    pendingIntentInvitationCount +
    pendingJoinRequestCount +
    pendingManagedProfileActionCount;

  const viewCounts: Record<
    TimelineView,
    number
  > = {
    open: 0,
    full: 0,
    closed: 0,
    forming: 0,
    participating: 0,
    planned: 0,
    action_required: 0,
    completed: 0,
    expired:
      expiredActivities.length,
    cancelled: 0,
  };

  standaloneIntentEntries.forEach(
    (entry) => {
      const view =
        getEntryView(entry);

      if (
        view === "open" ||
        view === "full" ||
        view === "closed"
      ) {
        viewCounts[view] += 1;
      }
    }
  );

  timelineEntries.forEach(
    (entry) => {
      const view =
        getEntryView(entry);

      if (
        view &&
        !INTENT_LIFECYCLE_VIEWS.has(
          view
        )
      ) {
        viewCounts[view] += 1;
      }
    }
  );

  const visibleEntries =
    timelineEntries
      .filter(
        (entry) =>
          getEntryView(entry) ===
          selectedView
      )
      .sort(
        (first, second) => {
          const firstCreatedAt =
            first.kind === "intent"
              ? first.intent
                  .created_at
              : first.plan
                  .created_at;

          const secondCreatedAt =
            second.kind === "intent"
              ? second.intent
                  .created_at
              : second.plan
                  .created_at;

          return (
            new Date(
              secondCreatedAt
            ).getTime() -
            new Date(
              firstCreatedAt
            ).getTime()
          );
        }
      );

  const visibleIntentEntries =
    visibleEntries.filter(
      (
        entry
      ): entry is IntentTimelineEntry =>
        entry.kind === "intent"
    );

  const visibleFormingActivityEntries =
    visibleEntries.filter(
      (
        entry
      ): entry is PlanTimelineEntry =>
        entry.kind === "plan"
    );

  const isIntentLifecycleView =
    INTENT_LIFECYCLE_VIEWS.has(
      selectedView
    );

  function renderTimelineEntry(
    entry: TimelineEntry
  ) {
    if (
      entry.kind ===
      "intent"
    ) {
      const {
        intent,
      } = entry;

      const location =
        getFirst(
          intent.locations
        );

      const activity =
        getFirst(
          intent.activities
        );

      const category =
        getFirst(
          activity
            ?.activity_categories
        );

      const requestCount =
        requestCountByIntentId.get(
          intent.id
        ) ?? 0;

      const participantLimit =
        intent.max_participants ===
        null
          ? "Unlimited"
          : String(
              intent.max_participants
            );

      return (
        <article
          key={`intent-${intent.id}`}
          className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm"
        >
          <TimelineIntentPresentation
            title={
              activity?.name ??
              "Unknown Activity"
            }
            categoryName={
              category?.name ??
              "Unknown Category"
            }
            activityCoverUrl={
              activity?.default_cover_url ??
              null
            }
            categoryCoverUrl={
              category?.default_cover_url ??
              null
            }
            countryName={
              location?.country_name ??
              null
            }
            locationScope={
              location?.scope ??
              null
            }
            city={
              location?.city ??
              null
            }
            district={
              location?.district ??
              null
            }
            startDate={
              intent.start_date
            }
            endDate={
              intent.end_date
            }
            lifecycleStatus={
              intent.expired_at
                ? "expired"
                : intent.status === "cancelled"
                  ? "cancelled"
                  : intent.status === "completed"
                    ? "completed"
                    : intent.status === "planned"
                      ? "planned"
                      : intent.recruitment_status === "closed" ||
                          intent.matching_status === "closed"
                        ? "closed"
                        : "open"
            }
            expiredAt={
              intent.expired_at
            }
            intentType={
              intent.intent_type
            }
            statusLabel={
              getIntentStatusLabel(
                intent
              )
            }
            statusClasses={
              getIntentStatusClasses(
                intent
              )
            }
            recruitmentStatus={
              intent.recruitment_status
            }
            matchingStatus={
              intent.matching_status
            }
            requestCount={
              requestCount
            }
            participantLimit={
              participantLimit
            }
            budget={
              intent.budget
            }
            visibilityLabel={
              getActivityVisibilityLabel(
                intent.visibility
              )
            }
            people={
              intent.people
            }
            recurrence={
              intent.recurrence
            }
            relatedLinks={
              intentLinksByIntentId.get(
                intent.id
              ) ?? []
            }
          />

          <div className="border-t border-gray-100 p-5">
            {intent.notes && (
              <p className="mb-5 line-clamp-3 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                {
                  intent.notes
                }
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {requestCount >
                0 &&
                intent.status ===
                  "active" && (
                  <Link
                    href="/requests"
                    className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    Review{" "}
                    {requestCount} request
                    {requestCount ===
                    1
                      ? ""
                      : "s"}
                  </Link>
                )}

              {intent.status ===
                "active" &&
                intent.recruitment_status ===
                  "open" &&
                intent.end_date >=
                  today && (
                <IntentInvitePeopleButton
                  intentId={
                    intent.id
                  }
                  activityLabel={
                    activity?.name ??
                    "UIN Activity"
                  }
                  compact
                />
              )}

              <Link
                href={`/intents/${encodeURIComponent(
                  intent.id
                )}/visibility`}
                className="inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Manage Visibility
              </Link>
            </div>

            <IntentActionButtons
              intentId={
                intent.id
              }
              status={
                intent.status
              }
              recruitmentStatus={
                intent.recruitment_status
              }
            />

            {(
              intent.expired_at !== null ||
              intent.status === "cancelled" ||
              intent.status === "completed" ||
              intent.matching_status === "closed"
            ) && (
              <div className="mt-4 flex justify-end">
                <ResourceArchiveButton
                  resourceType="intent"
                  resourceId={intent.id}
                  compact
                />
              </div>
            )}
          </div>
        </article>
      );
    }

    const {
      plan,
      relationship,
    } = entry;

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
        activity
          ?.activity_categories
      );

    const hostProfile =
      getFirst(
        plan.profiles
      );

    const currentPlanMember =
      getCurrentUserActivePlanMember(
        plan,
        currentUserId
      );

    const currentAttendance =
      currentPlanMember
        ?.attendance_status ??
      "pending";

    const completionRequired =
      isPlanCompletionRequired(
        plan
      );

    const activeMembers =
      getActivePlanMembers(
        plan
      );

    const activeParticipants =
      getActivePlanParticipants(
        plan
      );

    const committedBudget =
      getPlanCommittedBudget(
        plan
      );

    const targetBudget =
      toNullableNumber(
        plan.target_budget
      );

    const budgetProgress =
      targetBudget !== null &&
      targetBudget > 0
        ? (
            committedBudget /
            targetBudget
          ) * 100
        : null;

    const displayedProgress =
      budgetProgress === null
        ? null
        : Math.round(
            budgetProgress *
              10
          ) / 10;

    const progressBarWidth =
      budgetProgress === null
        ? 0
        : Math.min(
            Math.max(
              budgetProgress,
              0
            ),
            100
          );

    const participantLimit =
      plan.max_participants ===
      null
        ? "Unlimited"
        : String(
            plan.max_participants
          );

    const hostSourceIntentId =
      (
        plan.plan_intents ??
        []
      ).find(
        (link) =>
          link.relationship ===
            "host_source" &&
          link.status ===
            "active"
      )?.intent_id ??
      null;

    const requestCount =
      hostSourceIntentId
        ? requestCountByIntentId.get(
            hostSourceIntentId
          ) ?? 0
        : 0;

    const conversationSummary =
      conversationSummaryByPlanId.get(
        plan.id
      ) ?? null;

    const unreadCount =
      getUnreadCount(
        conversationSummary
      );

    const conversationPreview =
      getConversationPreview(
        conversationSummary,
        currentUserId
      );

    const roomName =
      plan.status ===
      "forming"
        ? "Planning Room"
        : "Activity Room";

    const roomButtonLabel =
      plan.status ===
      "forming"
        ? "Open Planning Room"
        : "Open Activity Room";

    const canArchivePlan =
      plan.status === "completed" ||
      plan.status === "cancelled" ||
      getEntryView(entry) === "expired";

    return (
      <article
        key={`plan-${plan.id}`}
        className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm"
      >
        <TimelinePlanPresentation
          title={
            plan.title ||
            activity?.name ||
            "UIN Activity"
          }
          categoryName={
            category?.name ??
            "Unknown Category"
          }
          coverUrl={
            plan.cover_url ??
            activity?.default_cover_url ??
            category?.default_cover_url ??
            null
          }
          countryName={
            location?.country_name ??
            null
          }
          locationScope={
            location?.scope ??
            null
          }
          city={
            location?.city ??
            null
          }
          district={
            location?.district ??
            null
          }
          meetingPoint={
            plan.meeting_point
          }
          latitude={
            plan.latitude
          }
          longitude={
            plan.longitude
          }
          mapUrl={
            plan.map_url
          }
          hostName={
            hostProfile?.full_name ??
            "UIN member"
          }
          hostAvatarUrl={
            hostProfile?.avatar_url ??
            null
          }
          isCurrentUserHost={
            plan.host_user_id ===
            currentUserId
          }
          members={activeMembers.map(
            (member) => {
              const memberProfile =
                getFirst(
                  member.profiles
                );

              return {
                id:
                  member.id,
                fullName:
                  memberProfile?.full_name ??
                  null,
                avatarUrl:
                  memberProfile?.avatar_url ??
                  null,
                role:
                  member.role,
              };
            }
          )}
          participantCount={
            activeParticipants.length
          }
          participantLimit={
            participantLimit
          }
          committedBudget={
            committedBudget
          }
          targetBudget={
            targetBudget
          }
          relationshipLabel={
            relationship ===
            "host"
              ? "Primary Host"
              : relationship ===
                  "co_host"
                ? "Co-host"
                : "Plan Participant"
          }
          relationshipClasses={
            relationship ===
            "host"
              ? "bg-gray-950 text-white"
              : relationship ===
                  "co_host"
                ? "bg-purple-100 text-purple-800"
                : "bg-cyan-100 text-cyan-800"
          }
          statusLabel={
            getPlanStatusLabel(
              plan,
              relationship
            )
          }
          statusClasses={
            getPlanStatusClasses(
              plan,
              relationship
            )
          }
          planStatus={
            plan.status
          }
          recruitmentStatus={
            plan.recruitment_status
          }
          requestCount={
            relationship ===
              "host"
              ? requestCount
              : 0
          }
          scheduledStart={
            plan.scheduled_start
          }
          scheduledEnd={
            plan.scheduled_end
          }
          timezone={
            plan.timezone
          }
          windowStart={
            plan.window_start
          }
          windowEnd={
            plan.window_end
          }
          completedAt={
            plan.completed_at
          }
          cancelledAt={
            plan.cancelled_at
          }
          expiredAt={
            plan.expired_at ??
            (
              isOverduePlannedPlan(
                plan
              )
                ? plan.scheduled_end
                : null
            )
          }
          visibilityLabel={
            getActivityVisibilityLabel(
              plan.visibility
            )
          }
          relatedLinks={
            hostSourceIntentId
              ? intentLinksByIntentId.get(
                  hostSourceIntentId
                ) ?? []
              : []
          }
        />

        {completionRequired && (
          <div className="mx-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 md:mx-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Action Required
            </p>

            <h4 className="mt-2 font-bold text-amber-950">
              The confirmed schedule has ended.
            </h4>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              {relationship ===
                "host" ||
              relationship ===
                "co_host"
                ? "Review attendance and complete the Activity."
                : "The Activity is waiting for the Primary Host or a Co-host to confirm completion."}
            </p>

            {(relationship ===
              "host" ||
              relationship ===
                "co_host") && (
              <Link
                href={`/plans/${plan.id}/completion`}
                className="mt-4 inline-flex rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Review Attendance →
              </Link>
            )}
          </div>
        )}

        {plan.status ===
          "completed" && (
          <div
            className={`mx-5 mt-5 rounded-2xl border p-5 md:mx-6 ${
              currentAttendance ===
              "attended"
                ? "border-green-200 bg-green-50"
                : currentAttendance ===
                    "no_show"
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-gray-100"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Your Attendance
            </p>

            <p className="mt-2 font-bold text-gray-950">
              {currentAttendance ===
              "attended"
                ? "You attended"
                : currentAttendance ===
                    "no_show"
                  ? "You did not attend"
                  : "Attendance not recorded"}
            </p>
          </div>
        )}

        <div className="mt-5 border-t border-gray-200 bg-gray-50 p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {plan.status ===
              "forming" &&
              plan.recruitment_status ===
                "open" &&
              hostSourceIntentId &&
              (
                relationship ===
                  "host" ||
                relationship ===
                  "co_host"
              ) && (
              <div className="shrink-0">
                <IntentInvitePeopleButton
                  intentId={
                    hostSourceIntentId
                  }
                  activityLabel={
                    plan.title ||
                    activity?.name ||
                    "UIN Activity"
                  }
                  compact
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  {roomName}
                </p>

                {unreadCount >
                  0 && (
                  <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
                    {
                      unreadCount
                    }{" "}
                    unread
                  </span>
                )}
              </div>

              <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                {
                  conversationPreview
                }
              </p>

              {conversationSummary?.latest_created_at && (
                <p className="mt-1 text-xs text-gray-500">
                  {formatPlanDateTime(
                    conversationSummary.latest_created_at,
                    plan.timezone
                  )}
                </p>
              )}
            </div>

            <Link
              href={`/plans/${plan.id}`}
              className="shrink-0 rounded-xl border border-green-200 bg-white px-5 py-3 text-center text-sm font-semibold text-green-700 shadow-sm transition hover:border-green-400 hover:bg-green-50"
            >
              {
                roomButtonLabel
              }{" "}
              →
            </Link>
          </div>
        </div>

        {canArchivePlan && (
          <div className="border-t border-gray-100 bg-white px-5 py-4 md:px-6">
            <div className="flex justify-end">
              <ResourceArchiveButton
                resourceType="plan"
                resourceId={plan.id}
                compact
              />
            </div>
          </div>
        )}
      </article>
    );
  }


  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-5xl">
        <TimelineHeader
          email={
            user.email ??
            null
          }
          personal={{
            fullName:
              personalProfile.full_name,
            username:
              personalProfile.username,
            avatarUrl:
              personalProfile.avatar_url,
          }}
          managedProfiles={
            managedProfiles
          }
          activeMatchCount={
            activeMatchCount
          }
          inboxCount={
            inboxCount
          }
          unreadNotificationCount={
            unreadNotificationCount
          }
          isAdmin={
            isAdmin
          }
        />

        <nav className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-0">
            <section className="lg:pr-6">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
                  Intents
                </p>

                <span className="text-xs text-gray-400">
                  Before a Shared Plan
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {INTENT_TIMELINE_TABS.map(
                  (tab) => {
                    const isActive =
                      selectedView ===
                      tab.key;

                    return (
                      <Link
                        key={tab.key}
                        href={`/timeline?view=${tab.key}`}
                        className={`flex min-h-24 flex-col items-center justify-center rounded-2xl px-3 py-4 text-center transition ${
                          isActive
                            ? tab.activeClasses
                            : tab.inactiveClasses
                        }`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {tab.label}
                        </span>

                        <span className="mt-2 text-2xl font-bold">
                          {viewCounts[
                            tab.key
                          ]}
                        </span>
                      </Link>
                    );
                  }
                )}
              </div>
            </section>

            <section className="border-t border-gray-100 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Activities
                </p>

                <span className="text-xs text-gray-400">
                  Shared, scheduled and completed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                {ACTIVITY_TIMELINE_TABS.map(
                  (tab) => {
                    const isActive =
                      selectedView ===
                      tab.key;

                    return (
                      <Link
                        key={tab.key}
                        href={`/timeline?view=${tab.key}`}
                        className={`flex min-h-24 flex-col items-center justify-center rounded-2xl px-3 py-4 text-center transition ${
                          isActive
                            ? tab.activeClasses
                            : tab.inactiveClasses
                        }`}
                      >
                        <span className="text-[11px] font-semibold uppercase leading-4 tracking-wide">
                          {tab.label}
                        </span>

                        <span className="mt-2 text-2xl font-bold">
                          {viewCounts[
                            tab.key
                          ]}
                        </span>
                      </Link>
                    );
                  }
                )}
              </div>
            </section>
          </div>
        </nav>

        <section className="mt-8">
          {isIntentLifecycleView ? (
            <div className="space-y-12">
              <section>
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
                    Intent Stage
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-gray-900">
                    {getIntentSectionTitle(
                      selectedView
                    )}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {getIntentSectionDescription(
                      selectedView
                    )}
                  </p>
                </div>

                <div className="space-y-6">
                  {visibleIntentEntries.map(
                    renderTimelineEntry
                  )}

                  {visibleIntentEntries.length ===
                    0 && (
                    <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
                      <h3 className="text-xl font-bold text-gray-900">
                        No Intents here yet.
                      </h3>

                      <p className="mt-3 text-gray-500">
                        {getEmptyIntentSectionText(
                          selectedView
                        )}
                      </p>

                      {selectedView ===
                        "open" && (
                        <Link
                          href="/onboarding"
                          className="mt-6 inline-block rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
                        >
                          Create New Intent
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </section>

            </div>
          ) : (
            <div>
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Activity Stage
                </p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  {getActivitySectionTitle(
                    selectedView
                  )}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {getSectionDescription(
                    selectedView
                  )}
                </p>
              </div>

              <div className="space-y-6">
                {selectedView ===
                  "expired" &&
                  expiredActivityResult.error && (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
                      <p className="font-semibold text-red-800">
                        Expired history could not be loaded.
                      </p>

                      <p className="mt-2 text-sm leading-6 text-red-700">
                        {
                          expiredActivityResult
                            .error.message
                        }
                      </p>
                    </div>
                  )}

                {selectedView ===
                  "expired" &&
                  !expiredActivityResult.error &&
                  expiredActivities.map(
                    (item) => (
                      <ExpiredActivityCard
                        key={`${item.item_type}-${item.item_id}`}
                        item={item}
                      />
                    )
                  )}

                {selectedView ===
                  "expired" &&
                  visibleEntries.map(
                    renderTimelineEntry
                  )}

                {selectedView !==
                  "expired" &&
                  visibleEntries.map(
                    renderTimelineEntry
                  )}

                {selectedView ===
                  "expired" &&
                  !expiredActivityResult.error &&
                  expiredActivities.length ===
                    0 &&
                  visibleEntries.length ===
                    0 && (
                    <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
                      <h3 className="text-xl font-bold text-gray-900">
                        Nothing here yet.
                      </h3>

                      <p className="mt-3 text-gray-500">
                        {getEmptyStateText(
                          "expired"
                        )}
                      </p>
                    </div>
                  )}

                {selectedView !==
                  "expired" &&
                  visibleEntries.length ===
                    0 && (
                  <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
                    <h3 className="text-xl font-bold text-gray-900">
                      Nothing here yet.
                    </h3>

                    <p className="mt-3 text-gray-500">
                      {getEmptyStateText(
                        selectedView
                      )}
                    </p>

                    {selectedView ===
                      "participating" && (
                      <Link
                        href="/matches"
                        className="mt-6 inline-block rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
                      >
                        Matches
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}