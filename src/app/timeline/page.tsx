import Link from "next/link";

import EyeIcon from "../../components/ui/EyeIcon";
import { redirect } from "next/navigation";

import TimelineHeader from "../../components/timeline/TimelineHeader";
import TimelineProfileOverview from "../../components/timeline/TimelineProfileOverview";
import TimelineGrowingSeeds from "../../components/timeline/TimelineGrowingSeeds";
import TimelinePlanPresentation from "../../components/timeline/TimelinePlanPresentation";
import TimelineIntentPresentation from "../../components/timeline/TimelineIntentPresentation";
import TimelineExpiredPresentation from "../../components/timeline/TimelineExpiredPresentation";
import TimelineShareButton from "../../components/timeline/TimelineShareButton";
import CancelledPlanHistorySummary from "../../components/timeline/CancelledPlanHistorySummary";
import ActivityPeopleStrip from "../../components/activities/ActivityPeopleStrip";
import IntentResolutionPanel, {
  type IntentResolutionItem,
} from "../../components/timeline/IntentResolutionPanel";
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
  parseIntentCommunityRows,
  type IntentCommunityContext,
} from "../../utils/communities";
import {
  type ManagedProfileSwitcherRow,
} from "../../components/navigation/AccountContextSwitcher";
import { createClient } from "../../utils/supabase/server";
import {
  hydrateVisiblePlanPresentations,
  type VisiblePlanPresentation,
  type VisiblePlanPresentationRow,
} from "../../utils/planPresentationVisibility";
import type { SeedRecord } from "../../utils/seeds";
import { withReturnContext } from "../../utils/returnNavigation";
import {
  dedupeActivityPeople,
  type ActivityPersonView,
} from "../../utils/activityPeople";
import ProfileIntentReactions, {
  type ProfileIntentReactionItem,
} from "../../components/profile/ProfileIntentReactions";
import PublicProfessionalCredentialsPanel from "../../components/professionals/PublicProfessionalCredentialsPanel";
import PublicCommunityMembershipsPanel from "../../components/communities/PublicCommunityMembershipsPanel";
import type {
  ProfileConnectionSummary,
  RawFamilyData,
} from "../../utils/profileConnections";
import type {
  ProfileEmbed,
  ProfileLink,
} from "../../utils/profilePresence";
import type { PublicBadge } from "../../utils/badges";
import type { PublicCommunityMembership } from "../../utils/communityMemberships";
import type { PublicProfessionalStatus } from "../../utils/professionals";
import type { PublicReputationSummary } from "../../utils/reputation";

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
  | "outcome_unknown"
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

type TimelineSport = {
  name: string;
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
  username: string | null;
  avatar_url: string | null;
};

type TimelineProfileIntentReactionRow = {
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
};

type TimelineProfileDisplayOrderRow = {
  item_type: "seed" | "credential" | "badge";
  item_id: string;
  sort_order: number | string;
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
  sport_id: string | null;
  sports:
    | TimelineSport
    | TimelineSport[]
    | null;
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
  activity_location_name: string | null;
  activity_address_text: string | null;
  activity_latitude: number | string | null;
  activity_longitude: number | string | null;
  activity_map_url: string | null;
  activity_street_view_url: string | null;
  meeting_location_same_as_activity: boolean;
  activity_location_visibility:
    | "members"
    | "public";
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
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancellation_reason_code: string | null;
  cancellation_phase: "planning" | "activity" | null;
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
  own_intent_id: string;
  target_intent_id: string;
  plan_id: string | null;
  status: IntentRequestStatus;
};

type IntentJoinResolutionRow = {
  id: string;
  source_intent_id: string;
  target_intent_id: string;
  plan_id: string;
  status: "pending" | "auto_resolved" | "resolved" | "kept_open" | "undone";
  decision_reason: string | null;
  pending_join_request_count: number | null;
  pending_invitation_count: number | null;
  created_at: string;
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

type OpenMomentFilter = "all" | "now" | "upcoming" | "future";

type TimelinePageProps = {
  searchParams: Promise<{
    view?: string;
    page?: string;
    moment?: string;
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
    key: "outcome_unknown",
    label: "Outcome Unknown",
    inactiveClasses:
      "bg-slate-100 text-slate-700 hover:bg-slate-200",
    activeClasses:
      "bg-slate-700 text-white shadow-sm",
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

const TIMELINE_PAGE_SIZE = 8;
const OPEN_UPCOMING_WINDOW_DAYS = 30;

const OPEN_MOMENT_FILTERS: Array<{
  key: OpenMomentFilter;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "now", label: "Now" },
  { key: "upcoming", label: "Upcoming" },
  { key: "future", label: "Future" },
];

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
  sport_id,
  sports!intents_sport_id_fkey (
    name
  ),
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
  activity_location_name,
  activity_address_text,
  activity_latitude,
  activity_longitude,
  activity_map_url,
  activity_street_view_url,
  meeting_location_same_as_activity,
  activity_location_visibility,
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
  cancelled_by,
  cancellation_reason,
  cancellation_reason_code,
  cancellation_phase,
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
    username,
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
      username,
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
  7 * 24 * 60 * 60 * 1000;

function isOutcomeUnknownPlan(
  plan: TimelinePlan
) {
  if (
    plan.status !==
      "planned"
  ) {
    return false;
  }

  if (!plan.scheduled_end) {
    return false;
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

function isOpenMomentFilter(
  value: string | undefined
): value is OpenMomentFilter {
  return OPEN_MOMENT_FILTERS.some((item) => item.key === value);
}

function parseTimelinePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function addUtcDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getOpenIntentMoment(
  intent: TimelineIntent,
  today: string
): Exclude<OpenMomentFilter, "all"> {
  if (intent.start_date <= today && intent.end_date >= today) {
    return "now";
  }

  const upcomingLimit = addUtcDays(today, OPEN_UPCOMING_WINDOW_DAYS);
  if (intent.start_date > today && intent.start_date <= upcomingLimit) {
    return "upcoming";
  }

  return "future";
}

function getTimelineEntrySortDate(entry: TimelineEntry) {
  if (entry.kind === "intent") {
    return entry.intent.start_date;
  }

  return (
    entry.plan.scheduled_start ??
    entry.plan.window_start ??
    entry.plan.created_at
  );
}

function formatCompactTimelineDate(value: string | null) {
  if (!value) return "Date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getTimelineHistorySortDate(entry: TimelineEntry) {
  if (entry.kind === "intent") {
    return entry.intent.end_date || entry.intent.created_at;
  }

  return (
    entry.plan.completed_at ??
    entry.plan.cancelled_at ??
    entry.plan.expired_at ??
    entry.plan.scheduled_end ??
    entry.plan.window_end ??
    entry.plan.created_at
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

function getTimelinePlanPeople(
  plan: TimelinePlan
): ActivityPersonView[] {
  const people = getActivePlanMembers(plan).map((member) => {
    const profile = getFirst(member.profiles);

    return {
      userId: member.user_id,
      fullName: profile?.full_name ?? null,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: member.role,
    } satisfies ActivityPersonView;
  });

  if (!people.some((person) => person.userId === plan.host_user_id)) {
    const hostProfile = getFirst(plan.profiles);
    people.unshift({
      userId: plan.host_user_id,
      fullName: hostProfile?.full_name ?? null,
      username: hostProfile?.username ?? null,
      avatarUrl: hostProfile?.avatar_url ?? null,
      role: "host",
    });
  }

  return dedupeActivityPeople(people);
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
    isOutcomeUnknownPlan(
      plan
    )
  ) {
    return "outcome_unknown";
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

  if (view === "outcome_unknown") {
    return "Activities with Unknown Outcomes";
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
    return "No ended Activity currently needs an outcome review.";
  }

  if (view === "outcome_unknown") {
    return "No Activity is currently archived with an unknown outcome.";
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

  if (view === "outcome_unknown") {
    return "Planned Activities whose scheduled end passed more than seven days ago without a confirmed outcome. UIN does not guess whether they happened.";
  }

  if (
    view === "completed"
  ) {
    return "Completed Activities from your UIN history.";
  }

  if (view === "expired") {
    return "Intents and forming Plans whose availability window ended before they became a confirmed Activity.";
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
    isOutcomeUnknownPlan(
      plan
    )
  ) {
    return "Outcome Unknown";
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

  if (plan.status === "forming") {
    return "Forming";
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
    isOutcomeUnknownPlan(
      plan
    )
  ) {
    return "bg-slate-100 text-slate-800";
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

  if (plan.status === "forming") {
    return "bg-violet-50 text-violet-700";
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
  ownedIntentById,
  planById,
  sportCoverContextByIntentId,
  privatePresentationByPlanId,
}: {
  item: ExpiredActivityHistoryRow;
  ownedIntentById: Map<string, TimelineIntent>;
  planById: Map<string, TimelinePlan>;
  sportCoverContextByIntentId: Map<
    string,
    IntentSportCoverContext
  >;
  privatePresentationByPlanId: Map<
    string,
    VisiblePlanPresentation
  >;
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

  const effectiveSourceIntentId =
    item.source_intent_id ??
    (item.item_type === "intent"
      ? item.item_id
      : null);

  const sourceIntent =
    effectiveSourceIntentId
      ? ownedIntentById.get(
          effectiveSourceIntentId
        ) ?? null
      : null;

  const plan = item.plan_id
    ? planById.get(
        item.plan_id
      ) ?? null
    : null;

  const activity =
    getFirst(
      plan?.activities
    ) ??
    getFirst(
      sourceIntent?.activities
    );

  const category =
    getFirst(
      activity?.activity_categories
    );

  const sportCoverContext =
    effectiveSourceIntentId
      ? sportCoverContextByIntentId.get(
          effectiveSourceIntentId
        ) ?? null
      : null;

  const privatePresentation =
    item.plan_id
      ? privatePresentationByPlanId.get(
          item.plan_id
        ) ?? null
      : null;

  const resolvedCoverUrl =
    privatePresentation
      ?.signed_experience_cover_url ??
    privatePresentation
      ?.visible_cover_url ??
    sportCoverContext
      ?.context_cover_url ??
    activity?.default_cover_url ??
    category?.default_cover_url ??
    null;

  return (
    <TimelineExpiredPresentation
      itemType={
        item.item_type
      }
      title={
        privatePresentation?.custom_title ||
        item.title ||
        activity?.name ||
        item.activity_name ||
        "Expired Activity"
      }
      activityName={
        activity?.name ??
        item.activity_name
      }
      categoryName={
        category?.name ??
        item.category_name
      }
      coverUrl={
        resolvedCoverUrl
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
        effectiveSourceIntentId
      }
      canCreateAgain={
        item.can_create_again
      }
    />
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

  const requestedPage = parseTimelinePage(resolvedSearchParams.page);
  const selectedMoment: OpenMomentFilter =
    isOpenMomentFilter(resolvedSearchParams.moment)
      ? resolvedSearchParams.moment
      : "all";

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

  const { error: resolutionRefreshError } = await supabase.rpc(
    "refresh_my_intent_join_resolutions"
  );

  if (resolutionRefreshError) {
    console.warn(
      "Intent resolution refresh failed:",
      resolutionRefreshError.message
    );
  }

  const { error: lineageReconcileError } = await supabase.rpc(
    "reconcile_my_intent_plan_lineage"
  );

  if (lineageReconcileError) {
    console.warn(
      "Intent/Plan lineage reconciliation failed:",
      lineageReconcileError.message
    );
  }

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
    directMessageCountResult,
    managedProfilesResult,
    personalProfileResult,
    adminResult,
    activeMatchCountResult,
    activeSeedResult,
    intentResolutionResult,
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
        own_intent_id,
        target_intent_id,
        plan_id,
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
      "get_my_unread_update_notification_count"
    ),

    supabase.rpc(
      "get_my_unread_direct_message_count"
    ),

    supabase.rpc(
      "get_my_managed_profile_switcher"
    ),

    supabase
      .from("profiles")
      .select(
        "full_name, username, avatar_url, cover_url, bio, city, country, created_at"
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
      "get_my_active_matches"
    ),

    supabase.rpc("get_my_seeds_v2", {
      p_status: "active",
    }),

    supabase
      .from("intent_join_resolutions")
      .select(`
        id,
        source_intent_id,
        target_intent_id,
        plan_id,
        status,
        decision_reason,
        pending_join_request_count,
        pending_invitation_count,
        created_at
      `)
      .eq("user_id", currentUserId)
      .in("status", ["pending", "auto_resolved"])
      .order("created_at", { ascending: false }),
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

  if (activeSeedResult.error) {
    console.warn(
      "Growing Seeds timeline query failed:",
      activeSeedResult.error.message
    );
  }

  if (intentResolutionResult.error) {
    console.warn(
      "Intent resolution timeline query failed:",
      intentResolutionResult.error.message
    );
  }

  const joinRequests =
    (
      joinRequestResult.data ??
      []
    ) as {
      direction?: string;
      request_status?: string;
      intent_id?: string;
    }[];

  const activeOwnedIntentIds = new Set(
    ((ownedIntentResult.data ?? []) as TimelineIntent[])
      .filter(
        (intent) =>
          intent.status === "active" &&
          !intent.expired_at
      )
      .map((intent) => intent.id)
  );

  const pendingJoinRequestCount =
    joinRequests.filter(
      (request) =>
        request.direction ===
          "received" &&
        request.request_status ===
          "pending" &&
        Boolean(
          request.intent_id &&
          activeOwnedIntentIds.has(request.intent_id)
        )
    ).length;

  const unreadNotificationCount =
    Number(
      notificationCountResult.data ??
      0
    );

  const unreadDirectMessageCount =
    Number(
      directMessageCountResult.data ??
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
        cover_url: null,
        bio: null,
        city: null,
        country: null,
        created_at: user.created_at ?? null,
      }
    ) as {
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      bio: string | null;
      city: string | null;
      country: string | null;
      created_at: string | null;
    };

  const [
    profileFamilyResult,
    profileConnectionResult,
    profilePresenceResult,
    profileReputationResult,
    profileProfessionalResult,
    profileBadgeResult,
    profileCommunityMembershipResult,
    profileSavedReactionResult,
    profilePawedReactionResult,
    profileDisplayOrderResult,
  ] = await Promise.all([
    supabase.rpc("get_visible_profile_family", {
      p_profile_user_id: currentUserId,
    }),
    supabase.rpc("get_profile_connection_summary", {
      p_profile_user_id: currentUserId,
    }),
    supabase.rpc("get_public_profile_presence", {
      p_profile_user_id: currentUserId,
    }),
    supabase.rpc("get_public_reputation_summary", {
      p_user_id: currentUserId,
    }),
    personalProfile.username
      ? supabase.rpc("get_public_profile_professional_status", {
          p_username: personalProfile.username,
        })
      : Promise.resolve({ data: null, error: null }),
    supabase.rpc("get_public_profile_badges", {
      p_user_id: currentUserId,
    }),
    supabase.rpc("get_public_profile_community_memberships", {
      p_user_id: currentUserId,
    }),
    supabase.rpc("get_profile_visible_intent_reactions", {
      p_profile_user_id: currentUserId,
      p_reaction_type: "save",
      p_limit: 60,
      p_offset: 0,
    }),
    supabase.rpc("get_profile_visible_intent_reactions", {
      p_profile_user_id: currentUserId,
      p_reaction_type: "paw",
      p_limit: 60,
      p_offset: 0,
    }),
    supabase.rpc("get_visible_profile_display_order", {
      p_profile_user_id: currentUserId,
    }),
  ]);

  if (profileFamilyResult.error) {
    console.warn("Timeline profile family query failed:", profileFamilyResult.error.message);
  }
  if (profileConnectionResult.error) {
    console.warn("Timeline profile connections query failed:", profileConnectionResult.error.message);
  }
  if (profilePresenceResult.error) {
    console.warn("Timeline profile presence query failed:", profilePresenceResult.error.message);
  }
  if (profileReputationResult.error) {
    console.warn("Timeline profile reputation query failed:", profileReputationResult.error.message);
  }
  if (profileProfessionalResult.error) {
    console.warn("Timeline professional status query failed:", profileProfessionalResult.error.message);
  }
  if (profileBadgeResult.error) {
    console.warn("Timeline badge query failed:", profileBadgeResult.error.message);
  }
  if (profileCommunityMembershipResult.error) {
    console.warn("Timeline Community membership query failed:", profileCommunityMembershipResult.error.message);
  }
  if (profileSavedReactionResult.error) {
    console.warn("Timeline Saved Intent query failed:", profileSavedReactionResult.error.message);
  }
  if (profilePawedReactionResult.error) {
    console.warn("Timeline Pawed Intent query failed:", profilePawedReactionResult.error.message);
  }
  if (profileDisplayOrderResult.error) {
    console.warn("Timeline profile display-order query failed:", profileDisplayOrderResult.error.message);
  }

  const profileDisplayOrderRows =
    (profileDisplayOrderResult.data ?? []) as TimelineProfileDisplayOrderRow[];

  const profileOrderMap = {
    credential: new Map<string, number>(),
    badge: new Map<string, number>(),
  };

  for (const row of profileDisplayOrderRows) {
    if (row.item_type !== "credential" && row.item_type !== "badge") continue;
    const order = Number(row.sort_order);
    if (Number.isFinite(order)) {
      profileOrderMap[row.item_type].set(row.item_id, order);
    }
  }

  function sortProfileItems<Item>(
    items: Item[],
    getId: (item: Item) => string,
    orderMap: Map<string, number>
  ) {
    const fallbackStart = 1_000_000;
    return [...items].sort((left, right) => {
      const leftOrder = orderMap.get(getId(left));
      const rightOrder = orderMap.get(getId(right));
      return (leftOrder ?? fallbackStart) - (rightOrder ?? fallbackStart);
    });
  }

  const profileFamily =
    (profileFamilyResult.data ?? { children: [], relationships: [] }) as RawFamilyData;
  const profileConnections =
    (profileConnectionResult.data ?? null) as ProfileConnectionSummary | null;
  const profilePresence =
    (profilePresenceResult.data ?? { links: [], embeds: [] }) as {
      links: ProfileLink[];
      embeds: ProfileEmbed[];
    };
  const profileReputation =
    (profileReputationResult.data ?? {
      is_managed_minor: false,
      participation_count: 0,
      global: null,
      role_summaries: [],
      contexts: [],
    }) as PublicReputationSummary;

  const rawProfileProfessional =
    (profileProfessionalResult.data ?? {
      identity_verified: false,
      credentials: [],
    }) as PublicProfessionalStatus;
  const profileProfessional: PublicProfessionalStatus = {
    ...rawProfileProfessional,
    credentials: sortProfileItems(
      rawProfileProfessional.credentials,
      (credential) => credential.id,
      profileOrderMap.credential
    ),
  };

  const profileBadges = sortProfileItems(
    (profileBadgeResult.data ?? []) as PublicBadge[],
    (badge) => badge.id,
    profileOrderMap.badge
  );
  const profileCommunityMemberships =
    (profileCommunityMembershipResult.data ?? []) as PublicCommunityMembership[];

  const profileSavedReactionRows =
    (profileSavedReactionResult.data ?? []) as TimelineProfileIntentReactionRow[];
  const profilePawedReactionRows =
    (profilePawedReactionResult.data ?? []) as TimelineProfileIntentReactionRow[];
  const profileReactionIntentIds = Array.from(
    new Set(
      [...profileSavedReactionRows, ...profilePawedReactionRows].map(
        (row) => row.intent_id
      )
    )
  );

  const isAdmin =
    adminResult.data ===
      true;

  const activeMatchCount = Array.isArray(activeMatchCountResult.data)
    ? activeMatchCountResult.data.length
    : 0;


  const growingSeeds = ((activeSeedResult.data ?? []) as SeedRecord[])
    .filter((seed) => seed.status === "active")
    .sort((first, second) => {
      if (first.target_date && second.target_date) {
        return first.target_date.localeCompare(second.target_date);
      }
      if (first.target_date) return -1;
      if (second.target_date) return 1;
      return (second.updated_at ?? "").localeCompare(first.updated_at ?? "");
    });

  const ownedIntents =
    (
      ownedIntentResult.data ??
      []
    ) as unknown as TimelineIntent[];

  const plans =
    (
      planResult.data ??
      []
    ) as unknown as TimelinePlan[];

  const outcomeUnknownPlanIds = new Set(
    plans
      .filter((plan) => isOutcomeUnknownPlan(plan))
      .map((plan) => plan.id)
  );

  const expiredActivities =
    ((
      expiredActivityResult.data ??
      []
    ) as ExpiredActivityHistoryRow[]).filter(
      (item) => !item.plan_id || !outcomeUnknownPlanIds.has(item.plan_id)
    );

  const expiredSourceIntentIds =
    expiredActivities
      .map((item) =>
        item.source_intent_id ??
        (item.item_type === "intent"
          ? item.item_id
          : null)
      )
      .filter(
        (intentId): intentId is string =>
          typeof intentId === "string" &&
          intentId.length > 0
      );

  const ownedIntentById =
    new Map(
      ownedIntents.map((intent) => [
        intent.id,
        intent,
      ])
    );

  const planById =
    new Map(
      plans.map((plan) => [
        plan.id,
        plan,
      ])
    );

  type IntentJourneyCardSummary = {
    attemptCount: number;
    latestOutcome: string;
    reopened: boolean;
    latestPlanId: string;
    latestRoomPhase: "planning" | "activity";
  };

  const intentJourneySummaryByIntentId =
    new Map<string, IntentJourneyCardSummary>();

  ownedIntents.forEach((intent) => {
    const historicalAttempts = plans
      .filter((plan) =>
        (plan.plan_intents ?? []).some(
          (link) => link.intent_id === intent.id
        )
      )
      .filter(
        (plan) =>
          plan.status === "cancelled" ||
          plan.status === "completed" ||
          Boolean(plan.expired_at)
      )
      .sort((left, right) => {
        const leftTime = new Date(
          left.cancelled_at ??
            left.completed_at ??
            left.expired_at ??
            left.scheduled_start ??
            left.created_at
        ).getTime();
        const rightTime = new Date(
          right.cancelled_at ??
            right.completed_at ??
            right.expired_at ??
            right.scheduled_start ??
            right.created_at
        ).getTime();
        return rightTime - leftTime;
      });

    const latestAttempt = historicalAttempts[0];
    if (!latestAttempt) {
      return;
    }

    const latestIntentLink = (latestAttempt.plan_intents ?? []).find(
      (link) => link.intent_id === intent.id
    );

    const reopened =
      intent.status === "active" &&
      latestAttempt.status === "cancelled" &&
      latestIntentLink?.status === "detached";

    const latestRoomPhase: "planning" | "activity" =
      latestAttempt.cancellation_phase ??
      (latestAttempt.scheduled_start ? "activity" : "planning");

    const latestOutcome =
      latestAttempt.status === "cancelled"
        ? latestRoomPhase === "activity"
          ? "Activity cancelled"
          : "Plan cancelled"
        : latestAttempt.status === "completed"
          ? "Activity completed"
          : "Attempt expired";

    intentJourneySummaryByIntentId.set(intent.id, {
      attemptCount: historicalAttempts.length,
      latestOutcome,
      reopened,
      latestPlanId: latestAttempt.id,
      latestRoomPhase,
    });
  });

  const resolutionRows = (
    intentResolutionResult.data ?? []
  ) as IntentJoinResolutionRow[];

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const intentResolutionItems: IntentResolutionItem[] = resolutionRows
    .filter((row) => {
      if (row.status === "pending") return true;
      const createdAt = new Date(row.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt >= sevenDaysAgo;
    })
    .map((row) => {
      const sourceIntent = ownedIntentById.get(row.source_intent_id) ?? null;
      const sourceActivity = getFirst(sourceIntent?.activities);
      const plan = planById.get(row.plan_id) ?? null;
      const planActivity = getFirst(plan?.activities);
      const activityName =
        sourceActivity?.name ?? planActivity?.name ?? plan?.title ?? "this Activity";
      const planTitle = plan?.title || planActivity?.name || activityName;
      const planHref =
        plan?.status === "forming"
          ? withReturnContext(
              `/plans/${encodeURIComponent(row.plan_id)}/planning`,
              "/timeline",
              "Timeline"
            )
          : withReturnContext(
              `/plans/${encodeURIComponent(row.plan_id)}/activity`,
              "/timeline",
              "Timeline"
            );

      return {
        resolutionId: row.id,
        sourceIntentId: row.source_intent_id,
        activityName,
        planId: row.plan_id,
        planTitle,
        planHref,
        status: row.status as "pending" | "auto_resolved",
        decisionReason: row.decision_reason,
        pendingJoinRequestCount: Number(row.pending_join_request_count ?? 0),
        pendingInvitationCount: Number(row.pending_invitation_count ?? 0),
      };
    });

  const sportCoverIntentIds =
    Array.from(
      new Set([
        ...ownedIntents.map(
          (intent) =>
            intent.id
        ),
        ...expiredSourceIntentIds,
        ...profileReactionIntentIds,
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
      ])
    );

  const {
    data: sportCoverContextData,
    error: sportCoverContextError,
  } = sportCoverIntentIds.length > 0
    ? await supabase.rpc(
        "get_intent_sport_cover_context",
        {
          p_intent_ids:
            sportCoverIntentIds,
        }
      )
    : {
        data: [],
        error: null,
      };

  if (sportCoverContextError) {
    console.error(
      "Timeline sport cover context query failed:",
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

  const {
    data: privatePlanPresentationData,
    error: privatePlanPresentationError,
  } = plans.length > 0
    ? await supabase.rpc(
        "get_visible_plan_presentations",
        {
          p_plan_ids:
            plans.map(
              (plan) =>
                plan.id
            ),
        }
      )
    : {
        data: [],
        error: null,
      };

  if (privatePlanPresentationError) {
    console.error(
      "Private shared Activity presentation query failed:",
      privatePlanPresentationError
    );
  }

  const privatePlanPresentations =
    await hydrateVisiblePlanPresentations(
      supabase,
      (privatePlanPresentationData ?? []) as VisiblePlanPresentationRow[]
    );

  const privatePresentationByPlanId =
    new Map(
      privatePlanPresentations.map(
        (presentation) => [
          presentation.plan_id,
          presentation,
        ]
      )
    );

  let intentLinkRows:
    IntentLinkRpcRow[] =
    [];

  let intentCommunityRows:
    IntentCommunityContext[] =
    [];

  const visibleIntentIds =
    Array.from(
      new Set(
        [
          ...ownedIntents.map(
            (intent) =>
              intent.id
          ),
          ...expiredSourceIntentIds,
          ...profileReactionIntentIds,
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

    const [
      intentLinkResponse,
      intentCommunityResponse,
    ] = await Promise.all([
      supabase.rpc(
        "get_visible_intent_links",
        { p_intent_ids: intentIdBatch }
      ),
      supabase.rpc(
        "get_visible_intent_communities",
        { p_intent_ids: intentIdBatch }
      ),
    ]);

    if (intentLinkResponse.error) {
      console.error(
        "Intent related links query failed:",
        intentLinkResponse.error
      );
    } else {
      intentLinkRows.push(
        ...((intentLinkResponse.data ?? []) as IntentLinkRpcRow[])
      );
    }

    if (intentCommunityResponse.error) {
      console.error(
        "Intent Community query failed:",
        intentCommunityResponse.error
      );
    } else {
      intentCommunityRows.push(
        ...parseIntentCommunityRows(
          intentCommunityResponse.data
        )
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
    new Map<string, IntentCommunityContext[]>();

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


  function toProfileReactionItem(
    row: TimelineProfileIntentReactionRow
  ): ProfileIntentReactionItem {
    const sportContext = sportCoverContextByIntentId.get(row.intent_id) ?? null;

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
      sportName: sportContext?.sport_name ?? null,
      contextCoverUrl: sportContext?.context_cover_url ?? null,
      communities: intentCommunitiesByIntentId.get(row.intent_id) ?? [],
    };
  }

  const profileSavedReactionItems =
    profileSavedReactionRows.map(toProfileReactionItem);
  const profilePawedReactionItems =
    profilePawedReactionRows.map(toProfileReactionItem);

  const requests =
    (
      requestResult.data ??
      []
    ) as IntentRequestRow[];

  // plan_intents remains the durable provenance model, but older Match → Plan
  // rows can be missing one side of that link. Accepted Match requests are
  // deterministic evidence of the two Intent sources, so Timeline can still
  // explain the transformation immediately while reconciliation repairs the DB.
  const acceptedMatchSourceIntentIdsByPlanId = new Map<string, Set<string>>();
  const currentUserMatchSourceIntentIdByPlanId = new Map<string, string>();

  requests
    .filter(
      (request) =>
        request.status === "accepted" &&
        Boolean(request.plan_id)
    )
    .forEach((request) => {
      const planId = request.plan_id as string;
      const sourceIds =
        acceptedMatchSourceIntentIdsByPlanId.get(planId) ?? new Set<string>();

      if (request.own_intent_id) {
        sourceIds.add(request.own_intent_id);
      }
      if (request.target_intent_id) {
        sourceIds.add(request.target_intent_id);
      }

      acceptedMatchSourceIntentIdsByPlanId.set(planId, sourceIds);

      if (request.requester_id === currentUserId && request.own_intent_id) {
        currentUserMatchSourceIntentIdByPlanId.set(planId, request.own_intent_id);
      } else if (
        request.receiver_id === currentUserId &&
        request.target_intent_id
      ) {
        currentUserMatchSourceIntentIdByPlanId.set(planId, request.target_intent_id);
      }
    });

  const conversationSummaries =
    (
      conversationSummaryResult.data ??
      []
    ) as PlanConversationSummary[];

  const unreadRoomMessageCount =
    conversationSummaries.reduce(
      (total, summary) =>
        total +
        getUnreadCount(summary),
      0
    );

  const messageCenterUnreadCount =
    unreadDirectMessageCount +
    unreadRoomMessageCount;

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
    outcome_unknown: 0,
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

  const matchingEntries = timelineEntries
    .filter((entry) => getEntryView(entry) === selectedView)
    .sort((first, second) => {
      const firstTime = new Date(getTimelineEntrySortDate(first)).getTime();
      const secondTime = new Date(getTimelineEntrySortDate(second)).getTime();

      if (
        selectedView === "completed" ||
        selectedView === "cancelled" ||
        selectedView === "outcome_unknown"
      ) {
        return secondTime - firstTime;
      }

      return firstTime - secondTime;
    });

  const allOpenIntentEntries = timelineEntries.filter(
    (entry): entry is IntentTimelineEntry =>
      entry.kind === "intent" && getEntryView(entry) === "open"
  );

  const openMomentCounts: Record<OpenMomentFilter, number> = {
    all: allOpenIntentEntries.length,
    now: 0,
    upcoming: 0,
    future: 0,
  };

  allOpenIntentEntries.forEach((entry) => {
    openMomentCounts[getOpenIntentMoment(entry.intent, today)] += 1;
  });

  const filteredEntries =
    selectedView === "open" && selectedMoment !== "all"
      ? matchingEntries.filter(
          (entry) =>
            entry.kind === "intent" &&
            getOpenIntentMoment(entry.intent, today) === selectedMoment
        )
      : matchingEntries;

  const pageCount = Math.max(
    1,
    Math.ceil(filteredEntries.length / TIMELINE_PAGE_SIZE)
  );
  const safePage = Math.min(requestedPage, pageCount);
  const visibleEntries =
    selectedView === "expired"
      ? filteredEntries
      : filteredEntries.slice(
          (safePage - 1) * TIMELINE_PAGE_SIZE,
          safePage * TIMELINE_PAGE_SIZE
        );

  const visibleIntentEntries = visibleEntries.filter(
    (entry): entry is IntentTimelineEntry => entry.kind === "intent"
  );


  const comingUpEntries = planEntries
    .filter((entry) => {
      if (entry.plan.status === "forming") {
        return !isExpiredPlan(entry.plan);
      }

      return getEntryView(entry) === "planned";
    })
    .sort(
      (first, second) =>
        new Date(getTimelineEntrySortDate(first)).getTime() -
        new Date(getTimelineEntrySortDate(second)).getTime()
    )
    .slice(0, 4);

  const recentTimelineHistory = timelineEntries
    .filter((entry) => {
      const view = getEntryView(entry);
      return (
        view === "completed" ||
        view === "cancelled" ||
        view === "outcome_unknown"
      );
    })
    .sort(
      (first, second) =>
        new Date(getTimelineHistorySortDate(second)).getTime() -
        new Date(getTimelineHistorySortDate(first)).getTime()
    );

  const isIntentLifecycleView =
    INTENT_LIFECYCLE_VIEWS.has(
      selectedView
    );

  function getPlanIntentLineage(plan: TimelinePlan) {
    const activeSourceLinks = (plan.plan_intents ?? []).filter(
      (link) => link.status === "active"
    );

    const sourceIntentIds = new Set(
      activeSourceLinks.map((link) => link.intent_id)
    );

    (acceptedMatchSourceIntentIdsByPlanId.get(plan.id) ?? new Set<string>())
      .forEach((intentId) => sourceIntentIds.add(intentId));

    const linkedCurrentUserSourceId = activeSourceLinks.find((link) =>
      ownedIntentById.has(link.intent_id)
    )?.intent_id ?? null;

    const currentUserSourceIntentId =
      linkedCurrentUserSourceId ??
      currentUserMatchSourceIntentIdByPlanId.get(plan.id) ??
      null;

    const currentUserSourceIntent = currentUserSourceIntentId
      ? ownedIntentById.get(currentUserSourceIntentId) ?? null
      : null;

    const currentUserSourceActivity = getFirst(
      currentUserSourceIntent?.activities
    );

    return {
      sourceCount: sourceIntentIds.size,
      currentUserSourceIntent,
      currentUserSourceActivity,
      sourceIntentHref: currentUserSourceIntent
        ? withReturnContext(
            `/activities/${encodeURIComponent(currentUserSourceIntent.id)}`,
            buildTimelineHref(),
            "Timeline",
            "timeline"
          )
        : null,
    };
  }

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

      const sport =
        getFirst(
          intent.sports
        );


      const sportCoverContext =
        sportCoverContextByIntentId.get(
          intent.id
        ) ??
        null;

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

      const timelineReturnHref = buildTimelineHref();
      const intentViewHref = withReturnContext(
        `/activities/${encodeURIComponent(intent.id)}`,
        timelineReturnHref,
        "Timeline",
        "timeline"
      );
      const intentDetailToggleId = `timeline-intent-details-${intent.id}`;

      const journeySummary =
        intentJourneySummaryByIntentId.get(intent.id) ?? null;
      const journeySummaryText = journeySummary
        ? `${journeySummary.attemptCount} previous ${
            journeySummary.attemptCount === 1 ? "attempt" : "attempts"
          } · ${journeySummary.latestOutcome}${
            journeySummary.reopened ? " · Intent reopened" : ""
          }`
        : null;
      const journeySummaryHref = journeySummary
        ? withReturnContext(
            `/plans/${encodeURIComponent(journeySummary.latestPlanId)}/${
              journeySummary.latestRoomPhase === "activity"
                ? "activity"
                : "planning"
            }#journey`,
            timelineReturnHref,
            "Timeline",
            "timeline"
          )
        : null;

      return (
        <article
          key={`intent-${intent.id}`}
          className="relative flex h-[400px] min-w-0 flex-col overflow-visible rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <input
            id={intentDetailToggleId}
            type="checkbox"
            className="peer sr-only"
            aria-label={`Toggle details for ${activity?.name ?? "UIN Intent"}`}
          />
          <TimelineIntentPresentation
              detailToggleId={intentDetailToggleId}
              intentId={intent.id}
              title={
              activity?.name ??
              "Unknown Activity"
            }
            categoryName={
              category?.name ??
              "Unknown Category"
            }
            activityCoverUrl={
              sportCoverContext
                ?.context_cover_url ??
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
                        : intent.start_date >
                            today
                          ? "future"
                          : "open"
            }
            expiredAt={
              intent.expired_at
            }
            intentType={
              intent.intent_type
            }
            statusLabel={
              intent.status ===
                "active" &&
              intent.start_date >
                today
                ? "Future"
                : getIntentStatusLabel(
                    intent
                  )
            }
            statusClasses={
              intent.status ===
                "active" &&
              intent.start_date >
                today
                ? "bg-blue-100 text-blue-800"
                : getIntentStatusClasses(
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
              communities={
                intentCommunitiesByIntentId.get(
                  intent.id
                ) ?? []
              }
              sportName={
                sport?.name ??
                null
              }
              journeySummary={
                journeySummaryText
                  ? {
                      text: journeySummaryText,
                      href: journeySummaryHref,
                    }
                  : null
              }
              ownerName={personalProfile.full_name ?? personalProfile.username ?? "You"}
              ownerAvatarUrl={personalProfile.avatar_url}
              notes={intent.notes}
              createdAt={intent.created_at}
              copiedFromIntentId={intent.copied_from_intent_id}
            />

          <div className="flex h-[34px] shrink-0 items-center gap-1 border-t border-black/5 bg-white/95 px-1.5">
          <Link
            href={intentViewHref}
            title="Görüntüle"
            aria-label={`Görüntüle ${activity?.name ?? "UIN Intent"}`}
            className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:border-green-300 hover:text-green-700"
          >
            <EyeIcon />
          </Link>

          <TimelineShareButton
            title={`${activity?.name ?? "UIN Intent"} Intent`}
            text={`I have a ${activity?.name ?? "UIN"} Intent. Are you in?`}
            url={`/activities/${encodeURIComponent(intent.id)}`}
            className="!h-6 !min-h-0 !w-auto !min-w-[54px] !rounded-md !px-2 !text-[9.5px] !leading-none"
          />

          <details className="group relative">
            <summary className="flex h-6 w-[56px] cursor-pointer list-none items-center justify-center gap-1 rounded-md bg-gray-950 px-2 text-[9.5px] font-semibold text-white transition hover:bg-gray-800">
              Yönet <span className="text-[8px] transition group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute bottom-full right-0 z-50 mb-2 w-[290px] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
              <div className="grid gap-2">
                {requestCount > 0 && intent.status === "active" && (
                  <Link href="/requests" className="inline-flex h-7 w-full items-center justify-center rounded-md bg-green-600 px-2 text-[9.5px] font-semibold leading-none text-white transition hover:bg-green-700">
                    Review {requestCount} request{requestCount === 1 ? "" : "s"}
                  </Link>
                )}
                {intent.status === "active" && intent.recruitment_status === "open" && intent.end_date >= today && (
                  <IntentInvitePeopleButton intentId={intent.id} activityLabel={activity?.name ?? "UIN Activity"} compact />
                )}
                <Link href={`/intents/${encodeURIComponent(intent.id)}/visibility`} className="inline-flex h-7 w-full items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[9.5px] font-semibold leading-none text-indigo-700 transition hover:bg-indigo-100">
                  Manage Visibility
                </Link>
                <IntentActionButtons intentId={intent.id} status={intent.status} recruitmentStatus={intent.recruitment_status} compact />
              </div>
            </div>
          </details>

          <label
            htmlFor={intentDetailToggleId}
            className="ml-auto flex h-6 w-[56px] cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-[9.5px] font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700 after:ml-1 after:content-['▾'] peer-checked:after:content-['▴']"
          >
            Detaylar
          </label>
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
      ) &&
      !isOutcomeUnknownPlan(plan);

    const outcomeUnknownAt = plan.scheduled_end
      ? new Date(plan.scheduled_end).getTime() + PLANNED_OUTCOME_GRACE_MS
      : Number.NaN;

    const daysUntilOutcomeUnknown = Number.isFinite(outcomeUnknownAt)
      ? Math.max(
          0,
          Math.ceil((outcomeUnknownAt - Date.now()) / (24 * 60 * 60 * 1000))
        )
      : null;

    const planPeople =
      getTimelinePlanPeople(
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

    const planSportCoverContext =
      hostSourceIntentId
        ? sportCoverContextByIntentId.get(
            hostSourceIntentId
          ) ??
          null
        : null;

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
      plan.status === "forming"
        ? "Planlama Odası"
        : "Aktivite Odası";

    const timelineReturnHref = buildTimelineHref();
    const planViewHref = withReturnContext(
      `/activities/${encodeURIComponent(plan.id)}`,
      timelineReturnHref,
      "Timeline",
      "timeline"
    );
    const planRoomHref = withReturnContext(
      plan.status === "forming"
        ? `/plans/${encodeURIComponent(plan.id)}/planning`
        : `/plans/${encodeURIComponent(plan.id)}/activity`,
      timelineReturnHref,
      "Timeline",
      "timeline"
    );
    const planDetailToggleId = `timeline-plan-details-${plan.id}`;

    const privatePresentation =
      privatePresentationByPlanId.get(
        plan.id
      ) ??
      null;

    const canonicalActivityName =
      activity?.name ||
      plan.title ||
      "UIN Activity";

    const visiblePlanTitle =
      plan.status === "completed"
        ? canonicalActivityName
        : privatePresentation
            ?.custom_title ||
          plan.title ||
          canonicalActivityName;

    const {
      sourceCount,
      currentUserSourceIntent,
      currentUserSourceActivity,
      sourceIntentHref,
    } = getPlanIntentLineage(plan);

    const showIntentLineage = Boolean(
      currentUserSourceIntent &&
        sourceIntentHref &&
        (plan.status === "forming" || plan.status === "planned")
    );

    const cancellationActorProfile = plan.cancelled_by
      ? (plan.plan_members ?? [])
          .map((member) => getFirst(member.profiles))
          .find((profile) => profile?.id === plan.cancelled_by) ??
        (hostProfile?.id === plan.cancelled_by ? hostProfile : null)
      : null;

    const cancellationActorName =
      cancellationActorProfile?.full_name ??
      cancellationActorProfile?.username ??
      (plan.cancelled_by === plan.host_user_id ? hostProfile?.full_name : null) ??
      "Host / Co-host";

    const cancelledSourceLink =
      plan.status === "cancelled"
        ? (plan.plan_intents ?? []).find((link) =>
            ownedIntentById.has(link.intent_id)
          ) ?? null
        : null;

    const cancelledSourceIntent = cancelledSourceLink
      ? ownedIntentById.get(cancelledSourceLink.intent_id) ?? null
      : null;

    const cancelledSourceIntentReopened = Boolean(
      plan.status === "cancelled" &&
        cancelledSourceLink?.status === "detached" &&
        cancelledSourceIntent?.status === "active"
    );

    const cancelledSourceIntentHref = cancelledSourceIntent
      ? withReturnContext(
          `/activities/${encodeURIComponent(cancelledSourceIntent.id)}`,
          timelineReturnHref,
          "Timeline",
          "timeline"
        )
      : null;

    const laterAttempt =
      cancelledSourceIntent && plan.status === "cancelled"
        ? plans
            .filter((candidate) => candidate.id !== plan.id)
            .filter((candidate) =>
              (candidate.plan_intents ?? []).some(
                (link) => link.intent_id === cancelledSourceIntent.id
              )
            )
            .filter(
              (candidate) =>
                new Date(candidate.created_at).getTime() >
                new Date(plan.created_at).getTime()
            )
            .sort(
              (left, right) =>
                new Date(right.created_at).getTime() -
                new Date(left.created_at).getTime()
            )[0] ?? null
        : null;

    const laterAttemptHref = laterAttempt
      ? withReturnContext(
          laterAttempt.status === "forming"
            ? `/plans/${encodeURIComponent(laterAttempt.id)}/planning#journey`
            : `/plans/${encodeURIComponent(laterAttempt.id)}/activity#journey`,
          timelineReturnHref,
          "Timeline",
          "timeline"
        )
      : null;

    const laterAttemptLabel = laterAttempt
      ? laterAttempt.status === "forming"
        ? "New Planning Room in progress"
        : laterAttempt.status === "planned"
          ? "New Activity planned"
          : laterAttempt.status === "completed"
            ? "Later attempt completed"
            : "Later attempt cancelled"
      : null;

    const cancelledJourneyHref = withReturnContext(
      plan.cancellation_phase === "planning"
        ? `/plans/${encodeURIComponent(plan.id)}/planning#journey`
        : `/plans/${encodeURIComponent(plan.id)}/activity#journey`,
      timelineReturnHref,
      "Timeline",
      "timeline"
    );

    const attendanceLabel =
      plan.status === "completed"
        ? currentAttendance === "attended"
          ? "Katıldın"
          : currentAttendance === "no_show"
            ? "Katılmadın"
            : "Kayıt yok"
        : null;
    const attendanceClasses =
      currentAttendance === "attended"
        ? "bg-green-50 text-green-700"
        : currentAttendance === "no_show"
          ? "bg-red-50 text-red-700"
          : "bg-gray-100 text-gray-600";
    const primaryPlanActionHref =
      completionRequired && (relationship === "host" || relationship === "co_host")
        ? `/plans/${encodeURIComponent(plan.id)}/activity#attendance-review`
        : plan.status === "completed"
          ? `/plans/${encodeURIComponent(plan.id)}/activity#memory`
          : planRoomHref;
    const primaryPlanActionLabel =
      completionRequired && (relationship === "host" || relationship === "co_host")
        ? "Sonucu Gir"
        : plan.status === "completed"
          ? "Memory"
          : roomButtonLabel;

    return (
      <div
        key={`plan-${plan.id}`}
        className={`relative min-w-0 ${showIntentLineage ? "pb-14" : ""}`}
      >
        {showIntentLineage && currentUserSourceIntent && sourceIntentHref && (
          <Link
            href={sourceIntentHref}
            className="absolute inset-x-3 bottom-0 z-0 flex h-[74px] items-end justify-between gap-3 rounded-[22px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-4 pb-2.5 pt-6 transition hover:border-emerald-300 hover:from-emerald-100 hover:to-green-50"
          >
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                {sourceCount > 1
                  ? `${sourceCount} Intents matched → 1 Activity`
                  : "Your Intent → this Activity"}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-black text-gray-900">
                Your Intent · {currentUserSourceActivity?.name ?? canonicalActivityName}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-emerald-800 shadow-sm">
              Source ↗
            </span>
          </Link>
        )}

        <article
          className="relative z-10 flex h-[400px] min-w-0 flex-col overflow-visible rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
        <input
          id={planDetailToggleId}
          type="checkbox"
          className="peer sr-only"
          aria-label={`Toggle details for ${visiblePlanTitle}`}
        />
        <TimelinePlanPresentation
          detailToggleId={planDetailToggleId}
          planId={plan.id}
          title={visiblePlanTitle}
          canonicalActivityName={canonicalActivityName}
          categoryName={
            category?.name ??
            "Unknown Category"
          }
          coverUrl={
            privatePresentation
              ?.signed_experience_cover_url ??
            privatePresentation
              ?.visible_cover_url ??
            planSportCoverContext
              ?.context_cover_url ??
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
          activityLocationName={
            plan.activity_location_name
          }
          activityAddressText={
            plan.activity_address_text
          }
          latitude={
            plan.activity_latitude
          }
          longitude={
            plan.activity_longitude
          }
          mapUrl={
            plan.activity_map_url
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
          people={planPeople}
          currentUserId={currentUserId}
          activityHref={planViewHref}
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
          expiredAt={plan.expired_at}
          visibilityLabel={
            getActivityVisibilityLabel(
              plan.visibility
            )
          }
          recurrence={
            currentUserSourceIntent?.recurrence ?? "one-time"
          }
          relatedLinks={
            hostSourceIntentId
              ? intentLinksByIntentId.get(
                  hostSourceIntentId
                ) ?? []
              : []
          }
          communities={
            hostSourceIntentId
              ? intentCommunitiesByIntentId.get(
                  hostSourceIntentId
                ) ?? []
              : []
          }
          notes={plan.notes}
          meetingPoint={plan.meeting_point}
          meetingAddressText={plan.address_text}
          meetingLocationSameAsActivity={plan.meeting_location_same_as_activity}
          activityLocationVisibility={plan.activity_location_visibility}
          scheduleNotes={plan.schedule_notes}
          plannedAt={plan.planned_at}
          createdAt={plan.created_at}
          sourceIntentLabel={currentUserSourceActivity?.name ?? canonicalActivityName}
          sourceIntentHref={sourceIntentHref}
          attendanceLabel={attendanceLabel}
          attendanceClasses={attendanceClasses}
          detailExtra={
            <>
              {plan.status === "cancelled" && (
                <CancelledPlanHistorySummary
                  phase={plan.cancellation_phase ?? (plan.scheduled_start ? "activity" : "planning")}
                  cancelledAt={plan.cancelled_at}
                  cancelledByName={cancellationActorName}
                  reasonCode={plan.cancellation_reason_code}
                  reasonText={plan.cancellation_reason}
                  journeyHref={cancelledJourneyHref}
                  sourceIntentReopened={cancelledSourceIntentReopened}
                  sourceIntentHref={cancelledSourceIntentHref}
                  nextAttempt={
                    laterAttempt && laterAttemptHref && laterAttemptLabel
                      ? { label: laterAttemptLabel, href: laterAttemptHref }
                      : null
                  }
                />
              )}
              {completionRequired && (
                <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-amber-700">İşlem gerekli</p>
                  <p className="mt-0.5 text-[9.5px] font-semibold leading-4 text-amber-950">Onaylanan zaman sona erdi. Sonucu Activity Room içinde kaydet.</p>
                </div>
              )}
            </>
          }
        />

        {/* Lifecycle details now live behind the canonical Details face. */}

        <div className="flex h-[34px] shrink-0 items-center gap-1 border-t border-black/5 bg-white/95 px-1.5">
          <Link
            href={planViewHref}
            title="Görüntüle"
            aria-label={`Görüntüle ${visiblePlanTitle}`}
            className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:border-green-300 hover:text-green-700"
          >
            <EyeIcon />
          </Link>

          <TimelineShareButton
            title={`${plan.title || activity?.name || "UIN Activity"}`}
            text="See this Activity on UIN."
            url={`/activities/${encodeURIComponent(plan.id)}`}
            className="!h-6 !min-h-0 !w-auto !min-w-[54px] !rounded-md !px-2 !text-[9.5px] !leading-none"
          />

          <label
            htmlFor={planDetailToggleId}
            className="flex h-6 w-[56px] cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-[9.5px] font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700 after:ml-1 after:content-['▾'] peer-checked:after:content-['▴']"
          >
            Detaylar
          </label>

          <Link
            href={primaryPlanActionHref}
            className="ml-auto flex h-6 min-w-[78px] items-center justify-center rounded-md bg-gray-950 px-2 text-center text-[9.5px] font-semibold leading-none text-white transition hover:bg-gray-800"
          >
            {primaryPlanActionLabel}
          </Link>
        </div>
        </article>
      </div>
    );
  }

  function buildTimelineHref({
    view = selectedView,
    page = 1,
    moment = selectedMoment,
  }: {
    view?: TimelineView;
    page?: number;
    moment?: OpenMomentFilter;
  } = {}) {
    const params = new URLSearchParams();
    params.set("view", view);
    if (view === "open" && moment !== "all") {
      params.set("moment", moment);
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    return `/timeline?${params.toString()}`;
  }

  function getCompactPlanPresentation(entry: PlanTimelineEntry) {
    const { plan, relationship } = entry;
    const activity = getFirst(plan.activities);
    const category = getFirst(activity?.activity_categories);
    const location = getFirst(plan.locations);
    const presentation = privatePresentationByPlanId.get(plan.id) ?? null;

    // Keep compact Coming Up cards on exactly the same presentation chain as
    // the full Planned card. Otherwise a sport/community Activity can show a
    // generic catalogue cover here while the Planned view shows its real cover.
    const hostSourceIntentId =
      (plan.plan_intents ?? []).find(
        (link) =>
          link.relationship === "host_source" &&
          link.status === "active"
      )?.intent_id ?? null;

    const planSportCoverContext = hostSourceIntentId
      ? sportCoverContextByIntentId.get(hostSourceIntentId) ?? null
      : null;

    const canonicalActivityName =
      activity?.name || plan.title || "UIN Activity";

    const title =
      plan.status === "completed"
        ? canonicalActivityName
        : presentation?.custom_title ||
          plan.title ||
          canonicalActivityName;

    const coverUrl =
      presentation?.signed_experience_cover_url ??
      presentation?.visible_cover_url ??
      planSportCoverContext?.context_cover_url ??
      activity?.default_cover_url ??
      category?.default_cover_url ??
      null;

    const hasExactActivityLocation = Boolean(
      plan.activity_location_name || plan.activity_address_text
    );

    const locationLabel = hasExactActivityLocation
      ? [plan.activity_location_name, plan.activity_address_text]
          .filter(Boolean)
          .join(", ")
      : [location?.district, location?.city]
          .filter(Boolean)
          .join(", ");

    const lineage = getPlanIntentLineage(plan);

    return {
      title,
      coverUrl,
      activityName: activity?.name ?? null,
      categoryName: category?.name ?? "Activity",
      locationLabel,
      dateLabel: formatCompactTimelineDate(
        plan.scheduled_start ?? plan.window_start
      ),
      relationshipLabel:
        relationship === "host"
          ? "Primary Host"
          : relationship === "co_host"
            ? "Co-host"
            : "Plan Participant",
      relationshipClasses:
        relationship === "host"
          ? "bg-gray-950/90 text-white"
          : relationship === "co_host"
            ? "bg-purple-100 text-purple-800"
            : "bg-cyan-100 text-cyan-800",
      statusLabel: getPlanStatusLabel(plan, relationship),
      statusClasses: getPlanStatusClasses(plan, relationship),
      communities: hostSourceIntentId
        ? intentCommunitiesByIntentId.get(hostSourceIntentId) ?? []
        : [],
      sourceCount: lineage.sourceCount,
      sourceIntentName:
        lineage.currentUserSourceActivity?.name ??
        (lineage.currentUserSourceIntent ? canonicalActivityName : null),
      sourceIntentHref: lineage.sourceIntentHref,
      people: getTimelinePlanPeople(plan),
    };
  }

  const recentHistoryItems = [
    ...recentTimelineHistory.map((entry) => ({
      kind: "timeline" as const,
      key: `timeline-${entry.kind}-${
        entry.kind === "plan" ? entry.plan.id : entry.intent.id
      }`,
      sortDate: getTimelineHistorySortDate(entry),
      entry,
    })),
    ...expiredActivities.map((item) => ({
      kind: "expired" as const,
      key: `expired-${item.item_type}-${item.item_id}`,
      sortDate: item.expired_at,
      item,
    })),
  ]
    .sort(
      (first, second) =>
        new Date(second.sortDate).getTime() -
        new Date(first.sortDate).getTime()
    )
    .slice(0, 4);

  function renderTimelinePagination() {
    if (selectedView === "expired" || pageCount <= 1) {
      return null;
    }

    const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

    return (
      <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Timeline pages">
        <Link
          href={buildTimelineHref({ page: Math.max(1, safePage - 1) })}
          aria-disabled={safePage === 1}
          className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
            safePage === 1
              ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
              : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
          }`}
        >
          ←
        </Link>
        {pageNumbers.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={buildTimelineHref({ page: pageNumber })}
            className={`min-w-10 rounded-xl px-3.5 py-2 text-center text-sm font-black transition ${
              pageNumber === safePage
                ? "bg-gray-950 text-white"
                : "border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
            }`}
          >
            {pageNumber}
          </Link>
        ))}
        <Link
          href={buildTimelineHref({ page: Math.min(pageCount, safePage + 1) })}
          aria-disabled={safePage === pageCount}
          className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
            safePage === pageCount
              ? "pointer-events-none border-gray-100 bg-gray-100 text-gray-300"
              : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:text-green-700"
          }`}
        >
          →
        </Link>
      </nav>
    );
  }


  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-[1680px]">
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
          directMessageCount={
            messageCenterUnreadCount
          }
          unreadNotificationCount={
            unreadNotificationCount
          }
          isAdmin={
            isAdmin
          }
        />

        <TimelineProfileOverview
          profile={{
            fullName: personalProfile.full_name,
            username: personalProfile.username,
            avatarUrl: personalProfile.avatar_url,
            coverUrl: personalProfile.cover_url,
            bio: personalProfile.bio,
            city: personalProfile.city,
            country: personalProfile.country,
            createdAt: personalProfile.created_at,
          }}
          identityVerified={profileProfessional.identity_verified}
          badges={profileBadges}
          reputation={profileReputation}
          presence={profilePresence}
          connections={profileConnections}
          family={profileFamily}
        />

        <nav className="mt-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,2.35fr)] lg:gap-0">
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
                        className={`flex min-h-20 min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-3 text-center transition ${
                          isActive
                            ? tab.activeClasses
                            : tab.inactiveClasses
                        }`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {tab.label}
                        </span>

                        <span className="mt-1.5 text-xl font-bold">
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

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {ACTIVITY_TIMELINE_TABS.map(
                  (tab) => {
                    const isActive =
                      selectedView ===
                      tab.key;

                    return (
                      <Link
                        key={tab.key}
                        href={`/timeline?view=${tab.key}`}
                        className={`flex min-h-20 min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-3 text-center transition ${
                          isActive
                            ? tab.activeClasses
                            : tab.inactiveClasses
                        }`}
                      >
                        <span className="break-words text-[10px] font-semibold uppercase leading-3.5 tracking-[0.04em]">
                          {tab.label}
                        </span>

                        <span className="mt-1.5 text-xl font-bold">
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

        <IntentResolutionPanel items={intentResolutionItems} />

        {selectedView === "open" && (
          <>
            {comingUpEntries.length > 0 && (
              <section className="mt-8 rounded-[28px] border border-blue-100 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                      Coming up
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-gray-950">
                      Activities already becoming real
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Your nearest forming and planned Activities, ordered by what happens next.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {comingUpEntries.map(renderTimelineEntry)}
                </div>
              </section>
            )}

            <TimelineGrowingSeeds seeds={growingSeeds} />
          </>
        )}

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

                  {selectedView === "open" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {OPEN_MOMENT_FILTERS.map((item) => {
                        const active = selectedMoment === item.key;
                        return (
                          <Link
                            key={item.key}
                            href={buildTimelineHref({
                              view: "open",
                              moment: item.key,
                              page: 1,
                            })}
                            className={`rounded-full px-3.5 py-2 text-xs font-black transition ${
                              active
                                ? "bg-gray-950 text-white"
                                : "border border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:text-green-700"
                            }`}
                          >
                            {item.label}
                            <span
                              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                                active ? "bg-white/15" : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {openMomentCounts[item.key]}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {visibleIntentEntries.map(
                    renderTimelineEntry
                  )}

                  {visibleIntentEntries.length ===
                    0 && (
                    <div className="col-span-full rounded-3xl border border-gray-200 bg-white p-10 text-center">
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

                {renderTimelinePagination()}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {selectedView ===
                  "expired" &&
                  expiredActivityResult.error && (
                    <div className="col-span-full rounded-3xl border border-red-200 bg-red-50 p-6">
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
                        ownedIntentById={
                          ownedIntentById
                        }
                        planById={
                          planById
                        }
                        sportCoverContextByIntentId={
                          sportCoverContextByIntentId
                        }
                        privatePresentationByPlanId={
                          privatePresentationByPlanId
                        }
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
                    <div className="col-span-full rounded-3xl border border-gray-200 bg-white p-10 text-center">
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
                  <div className="col-span-full rounded-3xl border border-gray-200 bg-white p-10 text-center">
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

              {renderTimelinePagination()}
            </div>
          )}
        </section>

        {selectedView === "open" && recentHistoryItems.length > 0 && (
          <section className="mt-10 rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  Yakın geçmiş
                </p>
                <h2 className="mt-2 text-2xl font-black text-gray-950">
                  Yaşananlar ve süresi dolanlar
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Son tamamlanan, süresi dolan veya iptal edilen kayıtlar da normal Niyet / Aktivite kartı düzeninde kalır.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/timeline?view=completed"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-purple-200 hover:text-purple-700"
                >
                  Completed
                </Link>
                <Link
                  href="/timeline?view=expired"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-orange-200 hover:text-orange-700"
                >
                  Expired
                </Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recentHistoryItems.map((historyItem) =>
                historyItem.kind === "timeline" ? (
                  <div key={historyItem.key} className="min-w-0">
                    {renderTimelineEntry(historyItem.entry)}
                  </div>
                ) : (
                  <div key={historyItem.key} className="min-w-0">
                    <ExpiredActivityCard
                      item={historyItem.item}
                      ownedIntentById={ownedIntentById}
                      planById={planById}
                      sportCoverContextByIntentId={sportCoverContextByIntentId}
                      privatePresentationByPlanId={privatePresentationByPlanId}
                    />
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {selectedView === "open" && (
          <>
            <ProfileIntentReactions
              eyebrow="Saved Intents"
              title="Your private Intent shortlist"
              description="Only you can see the Intents you saved for later. The cards stay in their full profile presentation instead of being compressed into shortcuts."
              items={profileSavedReactionItems}
              emptyTitle="No Saved Intents yet"
              emptyDescription="Use the heart button in Discover or an Intent page to keep something here privately."
              privateSection
            />

            <ProfileIntentReactions
              eyebrow="Pawed Intents"
              title={`${personalProfile.full_name ?? personalProfile.username ?? "Your"} recommendations`}
              description="Intents you recommended with a Paw stay visible here as full cards, with the same visual information used on the profile."
              items={profilePawedReactionItems}
              emptyTitle="No Pawed Intents yet"
              emptyDescription="Paw an Intent to recommend it without sending a join request."
            />

            <PublicProfessionalCredentialsPanel
              status={profileProfessional}
              isOwner
            />

            <PublicCommunityMembershipsPanel
              memberships={profileCommunityMemberships}
              isOwner
            />
          </>
        )}
      </div>
    </main>
  );
}