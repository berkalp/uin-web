type CoverCandidate = {
  keywords: string[];
  url: string;
};

const COVER_CANDIDATES: CoverCandidate[] = [
  {
    keywords: [
      "technology",
      "tech",
      "software",
      "coding",
      "code",
      "computer",
      "digital",
      "artificial intelligence",
      "ai",
      "learning",
      "education",
      "course",
      "workshop",
    ],
    url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=82",
  },
  {
    keywords: [
      "walking",
      "running",
      "sport",
      "sports",
      "basketball",
      "football",
      "fitness",
      "hiking",
      "cycling",
      "outdoor",
    ],
    url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=82",
  },
  {
    keywords: [
      "culture",
      "cultural",
      "theatre",
      "theater",
      "cinema",
      "museum",
      "concert",
      "music",
      "art",
      "exhibition",
    ],
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82",
  },
  {
    keywords: [
      "volunteer",
      "volunteering",
      "community",
      "social",
      "solidarity",
      "charity",
      "support",
    ],
    url: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1600&q=82",
  },
];

const DEFAULT_SYSTEM_COVER =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82";

const RELIABLE_SYSTEM_COVER_FALLBACK =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=82";

function normalizeText(
  value: string | null | undefined
) {
  return (value ?? "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSystemActivityCover(
  categoryName: string | null | undefined,
  activityName: string | null | undefined
) {
  const haystack = `${normalizeText(
    categoryName
  )} ${normalizeText(
    activityName
  )}`;

  const match =
    COVER_CANDIDATES.find(
      (candidate) =>
        candidate.keywords.some(
          (keyword) =>
            haystack.includes(
              keyword
            )
        )
    );

  return (
    match?.url ??
    DEFAULT_SYSTEM_COVER
  );
}

export function getReliableSystemCoverFallback() {
  return RELIABLE_SYSTEM_COVER_FALLBACK;
}

export function resolveActivityCover({
  planCoverUrl,
  activityCoverUrl,
  categoryCoverUrl,
  categoryName,
  activityName,
}: {
  planCoverUrl?: string | null;
  activityCoverUrl?: string | null;
  categoryCoverUrl?: string | null;
  categoryName?: string | null;
  activityName?: string | null;
}) {
  return (
    planCoverUrl?.trim() ||
    activityCoverUrl?.trim() ||
    categoryCoverUrl?.trim() ||
    getSystemActivityCover(
      categoryName,
      activityName
    ) ||
    getReliableSystemCoverFallback()
  );
}
