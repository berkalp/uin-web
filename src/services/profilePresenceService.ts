import { supabase } from "@/utils/supabase/client";
import type {
  ProfileContentVisibility,
  ProfileLink,
} from "@/utils/profilePresence";

export type SaveProfilePresenceInput = {
  links: ProfileLink[];
  spotifyUrl: string;
  spotifyVisibility: ProfileContentVisibility;
  youtubeUrl: string;
  youtubeVisibility: ProfileContentVisibility;
};

export async function saveMyProfilePresence(
  input: SaveProfilePresenceInput
) {
  const { data, error } = await supabase.rpc(
    "save_my_profile_presence",
    {
      p_links: input.links.map((link, index) => ({
        platform: link.platform,
        label: link.label?.trim() || null,
        url: link.url.trim(),
        visibility: link.visibility,
        sort_order: index,
      })),
      p_spotify_url: input.spotifyUrl.trim() || null,
      p_spotify_visibility: input.spotifyVisibility,
      p_youtube_url: input.youtubeUrl.trim() || null,
      p_youtube_visibility: input.youtubeVisibility,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}
