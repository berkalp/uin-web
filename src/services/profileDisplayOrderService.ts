import { supabase } from "@/utils/supabase/client";

export type ProfileDisplayOrderItemType =
  | "seed"
  | "credential"
  | "badge";

export async function setMyProfileDisplayOrder(
  itemType: ProfileDisplayOrderItemType,
  itemIds: string[]
) {
  const { error } = await supabase.rpc(
    "set_my_profile_display_order",
    {
      p_item_type: itemType,
      p_item_ids: itemIds,
    }
  );

  if (error) {
    throw new Error(
      error.message || "The profile order could not be saved."
    );
  }
}
