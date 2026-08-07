export type ReputationLevel =
  | "new"
  | "developing"
  | "reliable"
  | "highly_reliable"
  | "mixed";

export type ReputationConfidence =
  | "low"
  | "medium"
  | "high";

export type ReputationDimensionScore = {
  score: number;
  responses: number;
};

export type ReputationContextSummary = {
  id: string;
  user_id: string;
  context_key: string;
  context_type:
    | "global"
    | "category"
    | "activity";
  category_id: string | null;
  activity_id: string | null;
  role:
    | "combined"
    | "host"
    | "participant";
  activity_count: number;
  attendance_observation_count: number;
  attended_count?: number;
  no_show_count?: number;
  feedback_count: number;
  would_join_again_count: number | null;
  attendance_rate: number | null;
  would_join_again_rate: number | null;
  dimension_scores: Record<
    string,
    ReputationDimensionScore
  >;
  overall_score?: number | null;
  reputation_level: ReputationLevel;
  confidence_level: ReputationConfidence;
  algorithm_version: number;
  calculated_at: string;
  category_name?: string | null;
  activity_name?: string | null;
};

export type PublicReputationSummary = {
  is_managed_minor: boolean;
  participation_count: number;
  global: ReputationContextSummary | null;
  role_summaries: ReputationContextSummary[];
  contexts: ReputationContextSummary[];
};

export type ContextualReputation = {
  is_managed_minor: boolean;
  source_context:
    | "activity"
    | "category"
    | "global"
    | "minor";
  summary: ReputationContextSummary | null;
};

export type ReputationFeedbackTarget = {
  plan_id: string;
  plan_title: string;
  activity_name: string;
  completed_at: string | null;
  feedback_deadline: string;
  target_user_id: string;
  target_full_name: string | null;
  target_username: string;
  target_avatar_url: string | null;
  target_role: "host" | "participant";
  existing_feedback_id: string | null;
  can_feedback: boolean;
};

export type PendingReputationFeedback = {
  plan_id: string;
  plan_title: string;
  activity_name: string;
  category_name: string;
  completed_at: string | null;
  feedback_deadline: string;
  target_user_id: string;
  target_full_name: string | null;
  target_username: string;
  target_avatar_url: string | null;
  target_role: "host" | "participant";
};

export type ReputationFeedbackQuestion = {
  id: string;
  version_id: string;
  scope_type:
    | "global"
    | "category"
    | "activity";
  dimension: string;
  prompt: string;
  response_type:
    | "yes_no"
    | "scale_5";
  is_required: boolean;
  weight: number;
  options: {
    low_label?: string;
    high_label?: string;
  };
};

export type ReputationFeedbackFormData = {
  plan: {
    id: string;
    title: string;
    activity_id: string;
    category_id: string;
    completed_at: string | null;
    feedback_deadline: string;
  };
  target: {
    id: string;
    full_name: string | null;
    username: string;
    avatar_url: string | null;
    role: "host" | "participant";
  };
  existing_feedback_id: string | null;
  questions: ReputationFeedbackQuestion[];
};

export function getReputationLevelLabel(
  level: ReputationLevel
) {
  if (level === "highly_reliable") {
    return "Highly reliable";
  }

  if (level === "reliable") {
    return "Reliable";
  }

  if (level === "developing") {
    return "Developing history";
  }

  if (level === "mixed") {
    return "Mixed experience";
  }

  return "New in this context";
}

export function getReputationLevelClasses(
  level: ReputationLevel
) {
  if (level === "highly_reliable") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (level === "reliable") {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (level === "developing") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (level === "mixed") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

export function formatReputationDimension(
  dimension: string
) {
  const labels: Record<string, string> = {
    reliable: "Reliable",
    respectful: "Respectful",
    clear_communication: "Clear communication",
    sportsmanship: "Sportsmanship",
    safe_play: "Safe participation",
    team_oriented: "Team-oriented",
    prepared: "Prepared",
    time_respect: "Respects time",
    family_friendly: "Family-friendly",
  };

  return (
    labels[dimension] ??
    dimension
      .split("_")
      .map(
        (part) =>
          part.charAt(0).toUpperCase() +
          part.slice(1)
      )
      .join(" ")
  );
}
