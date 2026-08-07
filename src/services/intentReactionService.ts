import { supabase } from "@/utils/supabase/client";
import {
  parseIntentReactionContexts,
  type IntentReactionContext,
  type IntentReactionType,
  type PawVisibility,
} from "@/utils/intentReactions";

export async function setMyIntentReaction({
  intentId,
  reactionType,
  active,
}: {
  intentId: string;
  reactionType: IntentReactionType;
  active: boolean;
}): Promise<IntentReactionContext> {
  const { data, error } = await supabase.rpc("set_my_intent_reaction", {
    p_intent_id: intentId,
    p_reaction_type: reactionType,
    p_active: active,
  });

  if (error) {
    throw new Error(error.message || "The Intent reaction could not be saved.");
  }

  const context = parseIntentReactionContexts(data)[0];

  if (!context) {
    throw new Error("The updated Intent reaction could not be loaded.");
  }

  return context;
}

export async function setMyPawProfileVisibility(
  visibility: PawVisibility
) {
  const { data, error } = await supabase.rpc(
    "set_my_paw_profile_visibility",
    {
      p_visibility: visibility,
    }
  );

  if (error) {
    throw new Error(
      error.message || "Paw profile visibility could not be saved."
    );
  }

  return (data as PawVisibility | null) ?? visibility;
}
