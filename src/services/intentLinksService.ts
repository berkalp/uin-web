import { supabase } from "@/utils/supabase/client";
import {
  parseIntentLinkRows,
  serializeIntentLinks,
  type IntentLinkInput,
  type IntentLinkRpcRow,
  type IntentLinkView,
} from "@/utils/intentLinks";

type CreateIntentWithLinksInput = {
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
  relatedLinks: IntentLinkInput[];
};

function parseOptionalNumber(
  value: string
) {
  const trimmedValue =
    value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue =
    Number(
      trimmedValue
    );

  if (
    !Number.isFinite(
      parsedValue
    ) ||
    parsedValue < 0
  ) {
    throw new Error(
      "Enter a valid non-negative number."
    );
  }

  return parsedValue;
}

function parseCapacity(
  value: string
) {
  if (
    value ===
    "unlimited"
  ) {
    return null;
  }

  const parsedValue =
    Number(value);

  if (
    !Number.isInteger(
      parsedValue
    ) ||
    parsedValue < 1
  ) {
    throw new Error(
      "Participant capacity must be a positive whole number."
    );
  }

  return parsedValue;
}

export async function createIntentWithLinks(
  input: CreateIntentWithLinksInput
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "create_intent_with_links",
    {
      p_start_date:
        input.startDate,
      p_end_date:
        input.endDate,
      p_people:
        input.people,
      p_location_id:
        input.locationId,
      p_activity_id:
        input.activityId,
      p_budget:
        parseOptionalNumber(
          input.budget
        ),
      p_recurrence:
        input.recurrence,
      p_visibility:
        input.visibility,
      p_notes:
        input.notes.trim() ||
        null,
      p_intent_type:
        input.intentType,
      p_max_participants:
        parseCapacity(
          input.maxParticipants
        ),
      p_links:
        serializeIntentLinks(
          input.relatedLinks
        ),
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "Could not create Intent."
    );
  }

  if (
    typeof data !==
    "string"
  ) {
    throw new Error(
      "Intent could not be created."
    );
  }

  return data;
}

export async function getVisibleIntentLinks(
  intentIds: string[]
): Promise<IntentLinkView[]> {
  if (
    intentIds.length ===
    0
  ) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_visible_intent_links",
    {
      p_intent_ids:
        intentIds,
    }
  );

  if (error) {
    throw new Error(
      error.message ||
        "Intent links could not be loaded."
    );
  }

  return parseIntentLinkRows(
    (
      data ??
      []
    ) as IntentLinkRpcRow[]
  );
}
