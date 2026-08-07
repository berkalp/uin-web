import type { IntentLinkInput } from "@/utils/intentLinks";
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

  const { data, error } =
    await supabase
      .from("intents")
      .update({
        activity_id: activityId,
        sport_id: sportId,
        location_id: locationId,
        start_date: startDate,
        end_date: endDate,
        people,
        recurrence,
        visibility,
        budget,
        max_participants:
          maxParticipants,
        participant_eligibility:
          participantEligibility,
        join_message_mode:
          joinMessageMode,
        join_message_prompt:
          joinMessageMode === "none"
            ? null
            : joinMessagePrompt.trim(),
        notes: cleanedNotes,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", intentId)
      .select("id")
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "The Intent could not be updated."
    );
  }

  return data.id as string;
}
