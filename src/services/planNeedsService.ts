import { supabase } from "@/utils/supabase/client";

export type PlanNeedImportance =
  | "required"
  | "optional";

export type PlanNeedFulfillmentMode =
  | "shared"
  | "per_participant";

export type PlanNeedContributor = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  quantity: number;
};

export type PlanNeed = {
  id: string;
  planId: string;
  need: string;
  quantity: number;
  importance: PlanNeedImportance;
  fulfillmentMode: PlanNeedFulfillmentMode;
  contributedQuantity: number;
  remainingQuantity: number;
  contributorCount: number;
  activeParticipantCount: number;
  remainingParticipantCount: number;
  isFulfilled: boolean;
  viewerQuantity: number;
  canManage: boolean;
  contributors: PlanNeedContributor[];
  createdAt: string;
  updatedAt: string;
};

type RawPlanNeedContributor = {
  user_id?: unknown;
  full_name?: unknown;
  username?: unknown;
  avatar_url?: unknown;
  quantity?: unknown;
};

type RawPlanNeed = {
  need_id?: unknown;
  plan_id?: unknown;
  need?: unknown;
  quantity?: unknown;
  importance?: unknown;
  fulfillment_mode?: unknown;
  contributed_quantity?: unknown;
  remaining_quantity?: unknown;
  contributor_count?: unknown;
  active_participant_count?: unknown;
  remaining_participant_count?: unknown;
  is_fulfilled?: unknown;
  viewer_quantity?: unknown;
  can_manage?: unknown;
  contributors?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function toNumber(
  value: unknown,
  fallback = 0
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function toNullableString(
  value: unknown
) {
  return typeof value === "string"
    ? value
    : null;
}

function normalizeContributor(
  value: RawPlanNeedContributor
): PlanNeedContributor | null {
  const userId =
    toNullableString(value.user_id);

  if (!userId) {
    return null;
  }

  return {
    userId,
    fullName:
      toNullableString(value.full_name),
    username:
      toNullableString(value.username),
    avatarUrl:
      toNullableString(value.avatar_url),
    quantity: Math.max(
      1,
      Math.trunc(
        toNumber(value.quantity, 1)
      )
    ),
  };
}

function normalizePlanNeed(
  value: RawPlanNeed
): PlanNeed | null {
  const id =
    toNullableString(value.need_id);
  const planId =
    toNullableString(value.plan_id);
  const need =
    toNullableString(value.need);

  if (
    !id ||
    !planId ||
    !need
  ) {
    return null;
  }

  const importance:
    PlanNeedImportance =
      value.importance === "optional"
        ? "optional"
        : "required";

  const fulfillmentMode:
    PlanNeedFulfillmentMode =
      value.fulfillment_mode ===
      "per_participant"
        ? "per_participant"
        : "shared";

  const contributors =
    Array.isArray(value.contributors)
      ? value.contributors
          .map((contributor) =>
            normalizeContributor(
              contributor as RawPlanNeedContributor
            )
          )
          .filter(
            (
              contributor
            ): contributor is PlanNeedContributor =>
              contributor !== null
          )
      : [];

  const quantity = Math.max(
    1,
    Math.trunc(
      toNumber(value.quantity, 1)
    )
  );

  const contributedQuantity =
    Math.max(
      0,
      Math.trunc(
        toNumber(
          value.contributed_quantity
        )
      )
    );

  const contributorCount =
    Math.max(
      0,
      Math.trunc(
        toNumber(
          value.contributor_count,
          contributors.length
        )
      )
    );

  const activeParticipantCount =
    Math.max(
      0,
      Math.trunc(
        toNumber(
          value.active_participant_count
        )
      )
    );

  return {
    id,
    planId,
    need,
    quantity,
    importance,
    fulfillmentMode,
    contributedQuantity,
    remainingQuantity:
      Math.max(
        0,
        Math.trunc(
          toNumber(
            value.remaining_quantity,
            quantity -
              contributedQuantity
          )
        )
      ),
    contributorCount,
    activeParticipantCount,
    remainingParticipantCount:
      Math.max(
        0,
        Math.trunc(
          toNumber(
            value.remaining_participant_count,
            activeParticipantCount -
              contributorCount
          )
        )
      ),
    isFulfilled:
      value.is_fulfilled === true,
    viewerQuantity:
      Math.max(
        0,
        Math.trunc(
          toNumber(
            value.viewer_quantity
          )
        )
      ),
    canManage:
      value.can_manage === true,
    contributors,
    createdAt:
      toNullableString(
        value.created_at
      ) ?? "",
    updatedAt:
      toNullableString(
        value.updated_at
      ) ?? "",
  };
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

export async function getPlanNeeds(
  planId: string
) {
  if (!planId) {
    throw new Error(
      "Plan information is missing."
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_plan_needs",
    {
      p_plan_id: planId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Plan needs could not be loaded."
      )
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  )
    .map((item) =>
      normalizePlanNeed(
        item as RawPlanNeed
      )
    )
    .filter(
      (
        item
      ): item is PlanNeed =>
        item !== null
    );
}

export async function createPlanNeed({
  planId,
  need,
  quantity,
  importance,
  fulfillmentMode,
}: {
  planId: string;
  need: string;
  quantity: number | null;
  importance: PlanNeedImportance;
  fulfillmentMode: PlanNeedFulfillmentMode;
}) {
  const cleanedNeed =
    need.trim();

  if (!cleanedNeed) {
    throw new Error(
      "Need is required."
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "create_plan_need",
    {
      p_plan_id: planId,
      p_need: cleanedNeed,
      p_quantity: quantity,
      p_importance: importance,
      p_fulfillment_mode:
        fulfillmentMode,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "The Need could not be created."
      )
    );
  }

  return data as string;
}

export async function updatePlanNeed({
  needId,
  need,
  quantity,
  importance,
  fulfillmentMode,
}: {
  needId: string;
  need: string;
  quantity: number | null;
  importance: PlanNeedImportance;
  fulfillmentMode: PlanNeedFulfillmentMode;
}) {
  const cleanedNeed =
    need.trim();

  if (!cleanedNeed) {
    throw new Error(
      "Need is required."
    );
  }

  const {
    error,
  } = await supabase.rpc(
    "update_plan_need",
    {
      p_need_id: needId,
      p_need: cleanedNeed,
      p_quantity: quantity,
      p_importance: importance,
      p_fulfillment_mode:
        fulfillmentMode,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "The Need could not be updated."
      )
    );
  }
}

export async function deletePlanNeed(
  needId: string
) {
  const {
    error,
  } = await supabase.rpc(
    "delete_plan_need",
    {
      p_need_id: needId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "The Need could not be deleted."
      )
    );
  }
}

export async function setMyPlanNeedContribution({
  needId,
  quantity,
}: {
  needId: string;
  quantity: number;
}) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error(
      "Contribution quantity must be at least 1."
    );
  }

  const {
    error,
  } = await supabase.rpc(
    "set_my_plan_need_contribution",
    {
      p_need_id: needId,
      p_quantity: quantity,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Your contribution could not be saved."
      )
    );
  }
}

export async function withdrawMyPlanNeedContribution(
  needId: string
) {
  const {
    error,
  } = await supabase.rpc(
    "withdraw_my_plan_need_contribution",
    {
      p_need_id: needId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Your contribution could not be withdrawn."
      )
    );
  }
}
