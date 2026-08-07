export type BadgeScopeType =
  | "global"
  | "category"
  | "activity";

export type BadgeAwardMode =
  | "manual"
  | "automatic"
  | "both";

export type BadgeCriteriaRole =
  | "combined"
  | "host"
  | "participant";

export type BadgeTone =
  | "green"
  | "blue"
  | "purple"
  | "amber"
  | "red"
  | "teal"
  | "gray";

export type BadgeIconKey =
  | "star"
  | "shield"
  | "trophy"
  | "medal"
  | "crown"
  | "sparkles"
  | "heart"
  | "handshake"
  | "compass"
  | "people"
  | "flame"
  | "leaf"
  | "ball"
  | "flag"
  | "check"
  | "lightning";

export type BadgeConfidence =
  | "low"
  | "medium"
  | "high";

export type PublicBadge = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: BadgeIconKey;
  icon_url: string | null;
  tone: BadgeTone;
  scope_type: BadgeScopeType;
  category_id: string | null;
  category_name: string | null;
  activity_id: string | null;
  activity_name: string | null;
  award_source:
    | "manual"
    | "automatic";
  awarded_at: string;
};

export type AdminBadgeCategory = {
  id: string;
  name: string;
  is_active: boolean;
};

export type AdminBadgeActivity = {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
};

export type AdminBadgeDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: BadgeIconKey;
  icon_url: string | null;
  tone: BadgeTone;
  scope_type: BadgeScopeType;
  category_id: string | null;
  activity_id: string | null;
  award_mode: BadgeAwardMode;
  criteria_role: BadgeCriteriaRole;
  minimum_activity_count: number | null;
  minimum_attendance_rate: number | null;
  minimum_feedback_count: number | null;
  minimum_would_join_again_rate: number | null;
  dimension_key: string | null;
  minimum_dimension_score: number | null;
  minimum_dimension_responses: number | null;
  minimum_overall_score: number | null;
  minimum_confidence: BadgeConfidence | null;
  is_public: boolean;
  allow_managed_minor: boolean;
  sort_order: number;
  is_active: boolean;
  active_assignment_count: number;
  manual_assignment_count: number;
  automatic_assignment_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminBadgeCatalogue = {
  categories: AdminBadgeCategory[];
  activities: AdminBadgeActivity[];
  badges: AdminBadgeDefinition[];
};

export type AdminBadgeUser = {
  user_id: string;
  full_name: string | null;
  username: string;
  email: string | null;
  avatar_url: string | null;
  active_badge_count: number;
};

export type AdminBadgeAssignment = {
  id: string;
  badge_id: string;
  badge_name: string;
  badge_slug: string;
  icon_key: BadgeIconKey;
  icon_url: string | null;
  tone: BadgeTone;
  source:
    | "manual"
    | "automatic";
  status:
    | "active"
    | "revoked";
  is_admin_override: boolean;
  award_note: string | null;
  revoke_reason: string | null;
  awarded_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
};

export type AdminBadgeUserAssignments = {
  profile: {
    id: string;
    full_name: string | null;
    username: string;
    email: string | null;
    avatar_url: string | null;
  } | null;
  assignments: AdminBadgeAssignment[];
};

export const BADGE_ICON_OPTIONS: Array<{
  value: BadgeIconKey;
  label: string;
}> = [
  { value: "star", label: "Star" },
  { value: "shield", label: "Shield" },
  { value: "trophy", label: "Trophy" },
  { value: "medal", label: "Medal" },
  { value: "crown", label: "Crown" },
  { value: "sparkles", label: "Sparkles" },
  { value: "heart", label: "Heart" },
  { value: "handshake", label: "Handshake" },
  { value: "compass", label: "Compass" },
  { value: "people", label: "People" },
  { value: "flame", label: "Flame" },
  { value: "leaf", label: "Leaf" },
  { value: "ball", label: "Ball" },
  { value: "flag", label: "Flag" },
  { value: "check", label: "Check" },
  { value: "lightning", label: "Lightning" },
];

export const BADGE_TONE_OPTIONS: Array<{
  value: BadgeTone;
  label: string;
}> = [
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
  { value: "teal", label: "Teal" },
  { value: "gray", label: "Gray" },
];

export function getBadgeToneClasses(
  tone: BadgeTone
) {
  if (tone === "blue") {
    return {
      wrapper:
        "border-blue-200 bg-blue-50 text-blue-900",
      icon:
        "bg-blue-600 text-white",
      subtle:
        "text-blue-700",
    };
  }

  if (tone === "purple") {
    return {
      wrapper:
        "border-purple-200 bg-purple-50 text-purple-900",
      icon:
        "bg-purple-600 text-white",
      subtle:
        "text-purple-700",
    };
  }

  if (tone === "amber") {
    return {
      wrapper:
        "border-amber-200 bg-amber-50 text-amber-950",
      icon:
        "bg-amber-500 text-white",
      subtle:
        "text-amber-700",
    };
  }

  if (tone === "red") {
    return {
      wrapper:
        "border-red-200 bg-red-50 text-red-950",
      icon:
        "bg-red-600 text-white",
      subtle:
        "text-red-700",
    };
  }

  if (tone === "teal") {
    return {
      wrapper:
        "border-teal-200 bg-teal-50 text-teal-950",
      icon:
        "bg-teal-600 text-white",
      subtle:
        "text-teal-700",
    };
  }

  if (tone === "gray") {
    return {
      wrapper:
        "border-gray-200 bg-gray-50 text-gray-950",
      icon:
        "bg-gray-700 text-white",
      subtle:
        "text-gray-600",
    };
  }

  return {
    wrapper:
      "border-green-200 bg-green-50 text-green-950",
    icon:
      "bg-green-600 text-white",
    subtle:
      "text-green-700",
  };
}

export function getBadgeScopeLabel({
  scopeType,
  categoryName,
  activityName,
}: {
  scopeType: BadgeScopeType;
  categoryName?: string | null;
  activityName?: string | null;
}) {
  if (
    scopeType === "activity" &&
    activityName
  ) {
    return activityName;
  }

  if (
    scopeType === "category" &&
    categoryName
  ) {
    return categoryName;
  }

  return "UIN-wide";
}

export function slugifyBadgeName(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
