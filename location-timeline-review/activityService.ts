import { supabase } from "@/utils/supabase/client";
import {
  serializeIntentLinks,
  type IntentLinkInput,
} from "@/utils/intentLinks";

export type ActivityCategory = {
  id: string;
  name: string;
};

export type Activity = {
  id: string;
  category_id: string;
  name: string;
};

export type ActivityCatalogueItem = {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  default_cover_url: string | null;
  category_cover_url: string | null;
  aliases: string[];
};

export type ActivityCatalogue = {
  categories: ActivityCategory[];
  activities: ActivityCatalogueItem[];
};

export type ActivityRequestDraftInput = {
  selectedCategoryId: string;
  proposedActivityName: string;
  description: string;
  startDate: string;
  endDate: string;
  people: string;
  locationId: string;
  budget: string;
  recurrence: string;
  visibility: string;
  notes: string;
  intentType: string;
  maxParticipants: string;
  timingMode?: "flexible" | "scheduled";
  relatedLinks: IntentLinkInput[];
};

type ActivityPickerCatalogueResponse = {
  categories:
    | ActivityCategory[]
    | null;
  activities:
    | ActivityCatalogueItem[]
    | null;
};

function parseOptionalInteger(
  value: string
) {
  const trimmedValue =
    value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue =
    Number(trimmedValue);

  if (
    !Number.isInteger(
      parsedValue
    )
  ) {
    throw new Error(
      "Expected an integer value."
    );
  }

  return parsedValue;
}

export async function getActivityCategories() {
  const { data, error } = await supabase
    .from("activity_categories")
    .select("id, name")
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data as ActivityCategory[];
}

export async function getActivitiesByCategory(
  categoryId: string
) {
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, category_id, name"
    )
    .eq(
      "category_id",
      categoryId
    )
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data as Activity[];
}

export async function getActivityCatalogue(): Promise<ActivityCatalogue> {
  const { data, error } =
    await supabase.rpc(
      "get_activity_picker_catalogue"
    );

  if (error) {
    throw error;
  }

  const catalogue =
    (
      data ?? {
        categories: [],
        activities: [],
      }
    ) as ActivityPickerCatalogueResponse;

  return {
    categories:
      catalogue.categories ?? [],
    activities:
      (
        catalogue.activities ?? []
      ).map((activity) => ({
        ...activity,
        aliases:
          activity.aliases ?? [],
      })),
  };
}

export async function submitActivityRequestDraft(
  input: ActivityRequestDraftInput
) {
  const maxParticipants =
    input.maxParticipants ===
    "unlimited"
      ? null
      : parseOptionalInteger(
          input.maxParticipants
        );

  const budget =
    parseOptionalInteger(
      input.budget
    );

  const {
    data,
    error,
  } = await supabase.rpc(
    "submit_activity_request_draft_with_links",
    {
      p_selected_category_id:
        input.selectedCategoryId,
      p_proposed_activity_name:
        input.proposedActivityName,
      p_description:
        input.description,
      p_start_date:
        input.startDate,
      p_end_date:
        input.endDate,
      p_people:
        input.people,
      p_location_id:
        input.locationId,
      p_budget:
        budget,
      p_recurrence:
        input.recurrence,
      p_visibility:
        input.visibility,
      p_notes:
        input.notes || null,
      p_intent_type:
        input.intentType,
      p_max_participants:
        maxParticipants,
      p_timing_mode:
        input.timingMode ??
        "flexible",
      p_related_links:
        serializeIntentLinks(
          input.relatedLinks
        ),
    }
  );

  if (error) {
    throw error;
  }

  if (
    typeof data !== "string"
  ) {
    throw new Error(
      "Activity request draft could not be created."
    );
  }

  return data;
}
