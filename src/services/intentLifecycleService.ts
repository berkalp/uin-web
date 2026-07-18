import { supabase } from "@/utils/supabase/client";

export type IntentLifecycleAction =
  | "close_recruitment"
  | "reopen_recruitment"
  | "mark_planned"
  | "return_to_open"
  | "mark_completed"
  | "cancel";

export async function manageIntentLifecycle(
  intentId: string,
  action: IntentLifecycleAction
) {
  if (!intentId) {
    throw new Error(
      "Intent information is missing."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "manage_intent_lifecycle",
      {
        p_intent_id: intentId,
        p_action: action,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The Intent could not be updated."
    );
  }

  return data as string;
}

export async function closeIntentRecruitment(
  intentId: string
) {
  return manageIntentLifecycle(
    intentId,
    "close_recruitment"
  );
}

export async function reopenIntentRecruitment(
  intentId: string
) {
  return manageIntentLifecycle(
    intentId,
    "reopen_recruitment"
  );
}

export async function markIntentPlanned(
  intentId: string
) {
  return manageIntentLifecycle(
    intentId,
    "mark_planned"
  );
}

export async function returnIntentToOpen(
  intentId: string
) {
  return manageIntentLifecycle(
    intentId,
    "return_to_open"
  );
}

export async function markIntentCompleted(
  intentId: string
) {
  return manageIntentLifecycle(
    intentId,
    "mark_completed"
  );
}

export async function cancelIntent(
  intentId: string
) {
  return manageIntentLifecycle(
    intentId,
    "cancel"
  );
}