import { supabase } from "@/utils/supabase/client";
import type {
  FamilyVisibilityRow,
  ProfileConnectionsFamilySettings,
  ProfileSectionVisibility,
} from "@/utils/profileConnections";

export async function saveMyProfileConnectionsFamily(input: {
  connectionVisibility: {
    followers_count_visibility: ProfileSectionVisibility;
    following_count_visibility: ProfileSectionVisibility;
    friends_count_visibility: ProfileSectionVisibility;
    mutual_friends_visibility: ProfileSectionVisibility;
  };
  familyVisibility: FamilyVisibilityRow[];
}) {
  const { error } = await supabase.rpc(
    "save_my_profile_connections_family",
    {
      p_settings: input.connectionVisibility,
      p_items: input.familyVisibility,
    }
  );

  if (error) {
    throw error;
  }
}

export async function getMyProfileConnectionsFamilySettings() {
  const { data, error } = await supabase.rpc(
    "get_my_profile_connections_family_settings"
  );

  if (error) {
    throw error;
  }

  return data as ProfileConnectionsFamilySettings;
}
