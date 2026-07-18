import { supabase } from "@/utils/supabase/client";

export type SendPlanMessageInput = {
  planId: string;
  body: string;
};

export async function sendPlanMessage({
  planId,
  body,
}: SendPlanMessageInput) {
  const cleanedBody = body.trim();

  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  if (!cleanedBody) {
    throw new Error(
      "Message cannot be empty."
    );
  }

  if (cleanedBody.length > 2000) {
    throw new Error(
      "Message cannot exceed 2000 characters."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "send_plan_message",
      {
        p_plan_id: planId,
        p_body: cleanedBody,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The message could not be sent."
    );
  }

  return data as string;
}

export async function markPlanConversationRead(
  planId: string
) {
  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "mark_plan_conversation_read",
      {
        p_plan_id: planId,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The conversation could not be marked as read."
    );
  }

  return data as string;
}