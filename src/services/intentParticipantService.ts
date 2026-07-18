import { supabase } from "@/utils/supabase/client";

export type ParticipantRemovalReason =
  | "participant_withdrew"
  | "plans_changed"
  | "no_response"
  | "group_changed"
  | "other";

export type ParticipationWithdrawalReason =
  | "plans_changed"
  | "unexpected_event"
  | "no_longer_available"
  | "joined_by_mistake"
  | "prefer_not_to_say";

export async function removeIntentParticipant(
  participantId: string,
  reason: ParticipantRemovalReason
) {
  const { data, error } = await supabase.rpc(
    "remove_intent_participant",
    {
      p_participant_id: participantId,
      p_reason: reason,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function withdrawIntentParticipation(
  participantId: string,
  reason: ParticipationWithdrawalReason
) {
  const { data, error } = await supabase.rpc(
    "withdraw_intent_participation",
    {
      p_participant_id: participantId,
      p_reason: reason,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}