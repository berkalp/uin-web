import { supabase } from "@/utils/supabase/client";
import {
  serializeIntentLinks,
  type IntentLinkInput,
} from "@/utils/intentLinks";

export type UpdateIntentInput = {
  intentId: string;
  activityId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  people: string;
  recurrence: string;
  visibility: string;
  budget: number | null;
  maxParticipants: number | null;
  notes: string | null;
  relatedLinks: IntentLinkInput[];
};

export async function updateIntent({
  intentId,
  activityId,
  locationId,
  startDate,
  endDate,
  people,
  recurrence,
  visibility,
  budget,
  maxParticipants,
  notes,
  relatedLinks,
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
      "Budget cannot be negative."
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

  const cleanedNotes =
    notes?.trim() || null;

  const {
    data,
    error,
  } = await supabase.rpc(
    "update_my_intent_with_links",
    {
      p_intent_id:
        intentId,
      p_activity_id:
        activityId,
      p_location_id:
        locationId,
      p_start_date:
        startDate,
      p_end_date:
        endDate,
      p_people:
        people,
      p_recurrence:
        recurrence,
      p_visibility:
        visibility,
      p_budget:
        budget,
      p_max_participants:
        maxParticipants,
      p_notes:
        cleanedNotes,
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

  if (
    typeof data !==
    "string"
  ) {
    throw new Error(
      "The Intent could not be updated."
    );
  }

  return data;
}
