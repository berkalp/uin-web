import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanPresentationVisibility =
  | "participants"
  | "friends"
  | "everyone"
  | "only_me";

export const PLAN_PRESENTATION_VISIBILITY_OPTIONS: ReadonlyArray<{
  value: PlanPresentationVisibility;
  label: string;
  helper: string;
}> = [
  {
    value: "participants",
    label: "Participants only",
    helper: "Primary Host, Co-hosts and accepted participants.",
  },
  {
    value: "friends",
    label: "Friends",
    helper: "Plan members and accepted friends of the Primary Host.",
  },
  {
    value: "everyone",
    label: "Everyone",
    helper: "Anyone who is allowed to view this Activity.",
  },
  {
    value: "only_me",
    label: "Only me",
    helper: "Only the Primary Host.",
  },
];

export function normalizePlanPresentationVisibility(
  value: unknown
): PlanPresentationVisibility {
  return value === "friends" ||
    value === "everyone" ||
    value === "only_me"
    ? value
    : "participants";
}

export type VisiblePlanPresentationRow = {
  plan_id: string;
  custom_title: string | null;
  custom_cover_external_url: string | null;
  custom_cover_storage_path: string | null;
  title_visibility: PlanPresentationVisibility;
  cover_visibility: PlanPresentationVisibility;
  viewer_can_see_title: boolean;
  viewer_can_see_cover: boolean;
  experience_cover_storage_path: string | null;
};

export type VisiblePlanPresentation = VisiblePlanPresentationRow & {
  signed_custom_cover_url: string | null;
  signed_experience_cover_url: string | null;
  visible_cover_url: string | null;
};

async function signPath(
  supabase: SupabaseClient,
  bucket: string,
  path: string | null
) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.warn(`Could not sign ${bucket} media:`, error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

export async function hydrateVisiblePlanPresentations(
  supabase: SupabaseClient,
  rows: VisiblePlanPresentationRow[]
): Promise<VisiblePlanPresentation[]> {
  return Promise.all(
    rows.map(async (row) => {
      const [signedCustomCoverUrl, signedExperienceCoverUrl] =
        await Promise.all([
          signPath(
            supabase,
            "plan-presentation-covers",
            row.custom_cover_storage_path
          ),
          signPath(
            supabase,
            "experience-media",
            row.experience_cover_storage_path
          ),
        ]);

      return {
        ...row,
        title_visibility: normalizePlanPresentationVisibility(
          row.title_visibility
        ),
        cover_visibility: normalizePlanPresentationVisibility(
          row.cover_visibility
        ),
        signed_custom_cover_url: signedCustomCoverUrl,
        signed_experience_cover_url: signedExperienceCoverUrl,
        visible_cover_url:
          signedCustomCoverUrl || row.custom_cover_external_url || null,
      };
    })
  );
}
