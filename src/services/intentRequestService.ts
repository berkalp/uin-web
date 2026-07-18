import { supabase } from "@/utils/supabase/client";

export type DeclineReason =
  | "plans_changed"
  | "capacity_complete"
  | "dates_incompatible"
  | "group_format"
  | "accepted_another"
  | "prefer_not_to_say";

type CreateIntentRequestInput = {
  requesterId: string;
  receiverId: string;
  ownIntentId: string;
  targetIntentId: string;
  message?: string;
};

export async function createIntentRequest(
  input: CreateIntentRequestInput
) {
  const { data, error } = await supabase
    .from("intent_requests")
    .insert({
      requester_id: input.requesterId,
      receiver_id: input.receiverId,
      own_intent_id: input.ownIntentId,
      target_intent_id: input.targetIntentId,
      message: input.message || null,
      status: "pending",
      decline_reason: null,
      declined_at: null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateIntentRequestStatus(
  requestId: string,
  status: "accepted" | "rejected",
  declineReason?: DeclineReason
) {
  if (
    status === "rejected" &&
    !declineReason
  ) {
    throw new Error(
      "Please select a reason before declining the request."
    );
  }

  const updateData =
    status === "rejected"
      ? {
          status,
          decline_reason: declineReason,
          declined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          status,
          decline_reason: null,
          declined_at: null,
          updated_at: new Date().toISOString(),
        };

  const { data, error } = await supabase
    .from("intent_requests")
    .update(updateData)
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}