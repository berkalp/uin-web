import { supabase } from "@/utils/supabase/client";

export async function startPlanningFromIntent(
  intentId: string
) {
  if (!intentId) {
    throw new Error(
      "Intent information is missing."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "start_planning_from_intent",
      {
        p_intent_id: intentId,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The Planning Room could not be created."
    );
  }

  if (!data) {
    throw new Error(
      "The Planning Room could not be created."
    );
  }

  return data as string;
}