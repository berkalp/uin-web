export type ProfileContentVisibility =
  | "public"
  | "friends"
  | "private";

export type ProfileLinkPlatform =
  | "instagram"
  | "facebook"
  | "x"
  | "bluesky"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "github"
  | "website";

export type ProfileLink = {
  id?: string;
  platform: ProfileLinkPlatform;
  label: string | null;
  url: string;
  visibility: ProfileContentVisibility;
  sort_order: number;
};

export type ProfileEmbed = {
  id?: string;
  provider: "spotify" | "youtube";
  resource_type: string;
  resource_id: string;
  source_url: string;
  visibility: ProfileContentVisibility;
};

export const PROFILE_LINK_PLATFORMS: Array<{
  value: ProfileLinkPlatform;
  label: string;
}> = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X" },
  { value: "bluesky", label: "Bluesky" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "github", label: "GitHub" },
  { value: "website", label: "Website" },
];

export const PROFILE_VISIBILITY_OPTIONS: Array<{
  value: ProfileContentVisibility;
  label: string;
}> = [
  { value: "public", label: "Anyone" },
  { value: "friends", label: "Friends" },
  { value: "private", label: "Only me" },
];

export function getProfilePlatformLabel(
  platform: ProfileLinkPlatform
) {
  return (
    PROFILE_LINK_PLATFORMS.find(
      (item) => item.value === platform
    )?.label ?? platform
  );
}

export function getProfilePlatformMark(
  platform: ProfileLinkPlatform
) {
  const marks: Record<ProfileLinkPlatform, string> = {
    instagram: "IG",
    facebook: "f",
    x: "X",
    bluesky: "BS",
    linkedin: "in",
    tiktok: "TT",
    youtube: "YT",
    github: "GH",
    website: "↗",
  };

  return marks[platform];
}

export function buildSpotifyEmbedUrl(
  sourceUrl: string | null | undefined
) {
  if (!sourceUrl?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(sourceUrl.trim());

    if (parsed.hostname !== "open.spotify.com") {
      return null;
    }

    const [resourceType, resourceId] = parsed.pathname
      .split("/")
      .filter(Boolean);

    if (
      !resourceId ||
      ![
        "track",
        "album",
        "playlist",
        "episode",
        "show",
      ].includes(resourceType)
    ) {
      return null;
    }

    return `https://open.spotify.com/embed/${encodeURIComponent(
      resourceType
    )}/${encodeURIComponent(resourceId)}?utm_source=generator`;
  } catch {
    return null;
  }
}

export function getYouTubeVideoId(
  sourceUrl: string | null | undefined
) {
  if (!sourceUrl?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(sourceUrl.trim());
    const hostname = parsed.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (hostname !== "youtube.com" && hostname !== "m.youtube.com") {
      return null;
    }

    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }

    const pathParts = parsed.pathname.split("/").filter(Boolean);

    if (
      pathParts.length >= 2 &&
      (pathParts[0] === "shorts" || pathParts[0] === "embed")
    ) {
      return pathParts[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function buildYouTubeEmbedUrl(
  sourceUrl: string | null | undefined
) {
  const videoId = getYouTubeVideoId(sourceUrl);

  return videoId
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
        videoId
      )}`
    : null;
}

export function isHttpUrl(value: string) {
  if (!value.trim()) {
    return true;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
