import type { CommunityIconKey } from "@/utils/communities";

export type PublicCommunityMembership = {
  community_id: string;
  community_name: string;
  community_slug: string;
  community_description: string | null;
  community_icon_key: CommunityIconKey;
  community_icon_url: string | null;
  community_accent_color: string;
  community_secondary_color: string | null;
  member_label: string;
  verified_at: string;
  expires_at: string | null;
};
