import { supabase } from "@/utils/supabase/client";

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

  const { data, error } =
    await supabase
      .from("intents")
      .update({
        activity_id: activityId,
        location_id: locationId,
        start_date: startDate,
        end_date: endDate,
        people,
        recurrence,
        visibility,
        budget,
        max_participants:
          maxParticipants,
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