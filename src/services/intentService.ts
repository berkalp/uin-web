import {
  type ProfessionalRequirement,
} from "@/utils/professionals";
import { supabase } from "@/utils/supabase/client";
import type { ParticipantEligibility } from "@/utils/participationEligibility";
import {
  isJoinMessageSettingsValid,
  type JoinMessageMode,
} from "@/utils/joinRequestMessage";

type CreateIntentInput = {
  userId: string;
  startDate: string;
  endDate: string;
  people: string;
  locationId: string;
  activityId: string;
  sportId?: string | null;
  budget: string;
  recurrence: string;
  visibility: string;
  notes: string;
  intentType: string;
  maxParticipants: string;
  participantEligibility: ParticipantEligibility;
  joinMessageMode: JoinMessageMode;
  joinMessagePrompt: string;
  communityIds?: string[];
  professionalRequirement?: ProfessionalRequirement;
  professionalRoleId?: string | null;
};

function parseOptionalBudget(
  value: string
) {
  if (!value.trim()) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      "Estimated cost per person must be a valid non-negative number."
    );
  }

  return parsed;
}

function parseCapacity(
  value: string
) {
  if (value === "unlimited") {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    throw new Error(
      "Participant capacity must be at least 1."
    );
  }

  return parsed;
}

export async function createIntent({
  userId,
  startDate,
  endDate,
  people,
  locationId,
  activityId,
  sportId = null,
  budget,
  recurrence,
  visibility,
  notes,
  intentType,
  maxParticipants,
  participantEligibility,
  joinMessageMode,
  joinMessagePrompt,
  communityIds = [],
  professionalRequirement = "none",
  professionalRoleId = null,
}: CreateIntentInput) {
  if (!userId) {
    throw new Error(
      "You must be signed in to create an Intent."
    );
  }

  if (
    !startDate ||
    !endDate ||
    endDate < startDate
  ) {
    throw new Error(
      "Enter a valid start and end date."
    );
  }

  if (
    !activityId ||
    !locationId
  ) {
    throw new Error(
      "Activity and location are required."
    );
  }

  if (
    professionalRequirement !==
      "none" &&
    !professionalRoleId
  ) {
    throw new Error(
      "Select the verified professional role you need."
    );
  }

  if (
    !isJoinMessageSettingsValid(
      joinMessageMode,
      joinMessagePrompt
    )
  ) {
    throw new Error(
      "Enter the question participants should answer."
    );
  }

  const normalizedRequirement =
    professionalRequirement ===
    "none"
      ? "none"
      : professionalRequirement;

  const normalizedPeople =
    normalizedRequirement ===
    "none"
      ? people
      : "professionals";

  const normalizedCommunityIds =
    Array.from(
      new Set(
        communityIds.filter(Boolean)
      )
    ).slice(
      0,
      sportId
        ? 1
        : 3
    );

  const { data, error } =
    await supabase.rpc(
      "create_my_intent_with_communities_eligibility_and_join_settings",
      {
        p_start_date: startDate,
        p_end_date: endDate,
        p_people: normalizedPeople,
        p_location_id: locationId,
        p_activity_id: activityId,
        p_sport_id: sportId || null,
        p_budget: parseOptionalBudget(budget),
        p_recurrence: recurrence,
        p_visibility: visibility,
        p_notes: notes.trim() || null,
        p_intent_type: intentType,
        p_max_participants: parseCapacity(maxParticipants),
        p_community_ids: normalizedCommunityIds,
        p_participant_eligibility:
          participantEligibility,
        p_join_message_mode:
          joinMessageMode,
        p_join_message_prompt:
          joinMessageMode === "none"
            ? null
            : joinMessagePrompt.trim(),
        p_professional_requirement: normalizedRequirement,
        p_professional_role_id:
          normalizedRequirement === "none"
            ? null
            : professionalRoleId,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The Intent could not be created."
    );
  }

  if (typeof data !== "string") {
    throw new Error(
      "The Intent could not be created."
    );
  }

  return data;
}
