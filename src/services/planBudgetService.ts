import { supabase } from "@/utils/supabase/client";

export async function updatePlanTargetBudget(
  planId: string,
  targetBudget: number | null
) {
  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  if (
    targetBudget !== null &&
    (
      !Number.isFinite(targetBudget) ||
      targetBudget < 0
    )
  ) {
    throw new Error(
      "Target budget must be zero or greater."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "update_plan_target_budget",
      {
        p_plan_id: planId,
        p_target_budget: targetBudget,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "The target budget could not be updated."
    );
  }

  return data as string;
}

export async function updateMyPlanBudgetCommitment(
  planId: string,
  budgetCommitment: number
) {
  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  if (
    !Number.isFinite(
      budgetCommitment
    ) ||
    budgetCommitment < 0
  ) {
    throw new Error(
      "Budget commitment must be zero or greater."
    );
  }

  const { data, error } =
    await supabase.rpc(
      "update_my_plan_budget_commitment",
      {
        p_plan_id: planId,
        p_budget_commitment:
          budgetCommitment,
      }
    );

  if (error) {
    throw new Error(
      error.message ||
        "Your budget commitment could not be updated."
    );
  }

  return data as string;
}