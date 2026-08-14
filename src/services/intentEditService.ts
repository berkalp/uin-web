import {
  serializeIntentLinks,
  type IntentLinkInput,
} from "@/utils/intentLinks";
import { supabase } from "@/utils/supabase/client";
import type { ParticipantEligibility } from "@/utils/participationEligibility";
import {
  isJoinMessageSettingsValid,
  type JoinMessageMode,
} from "@/utils/joinRequestMessage";

export type UpdateIntentInput = {
  intentId: string;
  activityId: string;
  sportId?: string | null;
  locationId: string;
  startDate: string;
  endDate: string;
  people: string;
  recurrence: string;
  visibility: string;
  budget: number | null;
  maxParticipants: number | null;
  participantEligibility: ParticipantEligibility;
  joinMessageMode: JoinMessageMode;
  joinMessagePrompt: string;
  notes: string | null;
  communityIds?: string[];
  relatedLinks?: IntentLinkInput[];
};

export async function updateIntent({
  intentId,
  activityId,
  sportId = null,
  locationId,
  startDate,
  endDate,
  people,
  recurrence,
  visibility,
  budget,
  maxParticipants,
  participantEligibility,
  joinMessageMode,
  joinMessagePrompt,
  notes,
  communityIds = [],
  relatedLinks = [],
}: UpdateIntentInput) {
  if (!intentId) {
    throw new Error(
      "Intent information is missing."
    );
  }

  if (!activityId) {
    throw new Error(
      "Activity is required."
    );
  }

  if (!locationId) {
    throw new Error(
      "Location is required."
    );
  }

  if (!startDate || !endDate) {
    throw new Error(
      "Start and end dates are required."
    );
  }

  if (endDate < startDate) {
    throw new Error(
      "End date cannot be earlier than start date."
    );
  }

  if (!people) {
    throw new Error(
      "Participation preference is required."
    );
  }

  if (!recurrence) {
    throw new Error(
      "Recurrence is required."
    );
  }

  if (!visibility) {
    throw new Error(
      "Visibility is required."
    );
  }

  if (
    budget !== null &&
    budget < 0
  ) {
    throw new Error(
      "Estimated cost per person cannot be negative."
    );
  }

  if (
    maxParticipants !== null &&
    maxParticipants < 1
  ) {
    throw new Error(
      "Participant capacity must be at least 1."
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

  const cleanedNotes =
    notes?.trim() || null;

  const normalizedCommunityIds =
    Array.from(
      new Set(
        communityIds.filter(Boolean)
      )
    ).slice(0, sportId ? 1 : 3);

  const { data, error } =
    await supabase.rpc(
      "update_my_intent_with_communities_eligibility_and_join_settings",
      {
        p_intent_id: intentId,
        p_activity_id: activityId,
        p_sport_id: sportId,
        p_location_id: locationId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_people: people,
        p_recurrence: recurrence,
        p_visibility: visibility,
        p_budget: budget,
        p_max_participants:
          maxParticipants,
        p_participant_eligibility:
          participantEligibility,
        p_join_message_mode:
          joinMessageMode,
        p_join_message_prompt:
          joinMessageMode === "none"
            ? null
            : joinMessagePrompt.trim(),
        p_notes: cleanedNotes,
        p_community_ids:
          normalizedCommunityIds,
        p_links:
          serializeIntentLinks(
            relatedLinks
          ),
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The Intent could not be updated."
    );
  }

  if (typeof data !== "string") {
    throw new Error(
      "The Intent could not be updated."
    );
  }

  return data;
}
