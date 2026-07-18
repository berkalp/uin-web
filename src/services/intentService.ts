import { supabase } from "@/utils/supabase/client";

type CreateIntentInput = {
  userId: string;
  startDate: string;
  endDate: string;
  people: string;
  locationId: string;
  activityId: string;
  budget: string;
  recurrence: string;
  visibility: string;
  notes: string;
  intentType: string;
  maxParticipants: string;
  copiedFromIntentId?: string | null;
};

function parseBudget(value: string) {
  const cleanedValue =
    value.trim();

  if (!cleanedValue) {
    return null;
  }

  const numericValue =
    Number(cleanedValue);

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    throw new Error(
      "Budget must be a valid non-negative number."
    );
  }

  return numericValue;
}

function parseMaxParticipants(
  value: string
) {
  if (value === "unlimited") {
    return null;
  }

  const numericValue =
    Number(value);

  if (
    !Number.isInteger(
      numericValue
    ) ||
    numericValue < 1
  ) {
    throw new Error(
      "Participant capacity must be a positive whole number."
    );
  }

  return numericValue;
}

export async function createIntent(
  input: CreateIntentInput
) {
  const budgetValue =
    parseBudget(input.budget);

  const maxParticipantsValue =
    parseMaxParticipants(
      input.maxParticipants
    );

  const {
    data,
    error,
  } = await supabase
    .from("intents")
    .insert({
      user_id: input.userId,
      start_date: input.startDate,
      end_date: input.endDate,
      people: input.people,
      location_id: input.locationId,
      activity_id: input.activityId,
      budget: budgetValue,
      recurrence: input.recurrence,
      visibility: input.visibility,
      notes:
        input.notes.trim() ||
        null,
      intent_type: input.intentType,
      max_participants:
        maxParticipantsValue,
      recruitment_status: "open",
      matching_status: "open",
      status: "active",
      expired_at: null,
      copied_from_intent_id:
        input.copiedFromIntentId ??
        null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}