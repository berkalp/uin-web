export type CommunityIconKey =
  | "people"
  | "football"
  | "music"
  | "family"
  | "travel"
  | "book"
  | "gaming"
  | "technology"
  | "art"
  | "nature"
  | "local"
  | "star"
  | "flag";

export type CommunityScopeType =
  | "global"
  | "restricted";

export type CommunityOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconKey: CommunityIconKey;
  iconUrl: string | null;
  accentColor: string;
  secondaryColor: string | null;
  scopeType: CommunityScopeType;
  categoryId: string | null;
  categoryName: string;
  categoryIds: string[];
  categoryNames: string[];
  activityIds: string[];
  activityNames: string[];
  relevanceRank: number;
};

export type IntentCommunityContext = {
  intentId: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconKey: CommunityIconKey;
  iconUrl: string | null;
  accentColor: string;
  secondaryColor: string | null;
  scopeType: CommunityScopeType;
  categoryId: string | null;
  status: string;
  position: number;
  isPrimary: boolean;
};

export const DEFAULT_COMMUNITY_ACCENT =
  "#4F46E5";

export const COMMUNITY_ACCENT_PRESETS = [
  {
    label: "Indigo",
    value: "#4F46E5",
  },
  {
    label: "Green",
    value: "#059669",
  },
  {
    label: "Blue",
    value: "#2563EB",
  },
  {
    label: "Purple",
    value: "#7C3AED",
  },
  {
    label: "Yellow",
    value: "#FACC15",
  },
  {
    label: "Amber",
    value: "#D97706",
  },
  {
    label: "Red",
    value: "#DC2626",
  },
  {
    label: "Pink",
    value: "#DB2777",
  },
  {
    label: "Teal",
    value: "#0D9488",
  },
  {
    label: "Slate",
    value: "#334155",
  },
  {
    label: "White",
    value: "#FFFFFF",
  },
  {
    label: "Black",
    value: "#111111",
  },
] as const;

export function formatCommunityHexInput(
  value: string
) {
  const compact = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^#0-9A-Fa-f]/g, "")
    .toUpperCase();

  if (!compact) {
    return "";
  }

  const withoutHash = compact
    .replace(/^#+/, "")
    .slice(0, 6);

  return `#${withoutHash}`;
}

export function expandCommunityHexColor(
  value: string
): string | null {
  const formatted =
    formatCommunityHexInput(
      value
    );

  if (
    /^#[0-9A-F]{6}$/.test(
      formatted
    )
  ) {
    return formatted;
  }

  if (
    /^#[0-9A-F]{3}$/.test(
      formatted
    )
  ) {
    return `#${formatted[1]}${formatted[1]}${formatted[2]}${formatted[2]}${formatted[3]}${formatted[3]}`;
  }

  return null;
}

export const COMMUNITY_ICON_OPTIONS: {
  value: CommunityIconKey;
  label: string;
}[] = [
  {
    value: "people",
    label: "People",
  },
  {
    value: "football",
    label: "Football",
  },
  {
    value: "music",
    label: "Music",
  },
  {
    value: "family",
    label: "Family",
  },
  {
    value: "travel",
    label: "Travel",
  },
  {
    value: "book",
    label: "Books",
  },
  {
    value: "gaming",
    label: "Gaming",
  },
  {
    value: "technology",
    label: "Technology",
  },
  {
    value: "art",
    label: "Art",
  },
  {
    value: "nature",
    label: "Nature",
  },
  {
    value: "local",
    label: "Local",
  },
  {
    value: "star",
    label: "Star",
  },
  {
    value: "flag",
    label: "Flag",
  },
];

function parseStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string"
  );
}

function parseNumber(
  value: unknown,
  fallback = 3
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

export function normalizeCommunityAccent(
  value: unknown
) {
  if (
    typeof value === "string"
  ) {
    return (
      expandCommunityHexColor(
        value
      ) ??
      DEFAULT_COMMUNITY_ACCENT
    );
  }

  return DEFAULT_COMMUNITY_ACCENT;
}

export function normalizeCommunitySecondary(
  value: unknown
): string | null {
  return typeof value === "string"
    ? expandCommunityHexColor(
        value
      )
    : null;
}

function getCommunityColorLuminance(
  color: string
) {
  const normalized =
    normalizeCommunityAccent(
      color
    );

  const red = parseInt(
    normalized.slice(1, 3),
    16
  );

  const green = parseInt(
    normalized.slice(3, 5),
    16
  );

  const blue = parseInt(
    normalized.slice(5, 7),
    16
  );

  return (
    0.2126 * red +
    0.7152 * green +
    0.0722 * blue
  ) / 255;
}

export function getCommunityVisibleBorder(
  primaryColor: string,
  secondaryColor?: string | null
) {
  const secondary =
    normalizeCommunitySecondary(
      secondaryColor
    );

  const candidate =
    secondary ??
    normalizeCommunityAccent(
      primaryColor
    );

  return getCommunityColorLuminance(
    candidate
  ) > 0.92
    ? "#CBD5E1"
    : candidate;
}

export function getCommunityBrandSurface(
  primaryColor: string,
  secondaryColor?: string | null,
  alpha = 0.08
) {
  const primary =
    normalizeCommunityAccent(
      primaryColor
    );

  const secondary =
    normalizeCommunitySecondary(
      secondaryColor
    );

  if (!secondary) {
    return communityAccentWithAlpha(
      primary,
      alpha
    );
  }

  return `linear-gradient(135deg, ${communityAccentWithAlpha(
    primary,
    alpha
  )}, ${communityAccentWithAlpha(
    secondary,
    Math.min(
      1,
      alpha + 0.08
    )
  )})`;
}

export function communityAccentWithAlpha(
  accentColor: string,
  alpha: number
) {
  const normalized =
    normalizeCommunityAccent(
      accentColor
    );

  const red = parseInt(
    normalized.slice(1, 3),
    16
  );

  const green = parseInt(
    normalized.slice(3, 5),
    16
  );

  const blue = parseInt(
    normalized.slice(5, 7),
    16
  );

  const safeAlpha = Math.max(
    0,
    Math.min(1, alpha)
  );

  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

export function getCommunityAccentForeground(
  accentColor: string
) {
  const normalized =
    normalizeCommunityAccent(
      accentColor
    );

  const luminance =
    getCommunityColorLuminance(
      normalized
    );

  return luminance > 0.62
    ? "#111827"
    : "#FFFFFF";
}

export function parseCommunityOptions(
  value: unknown
): CommunityOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return [];
      }

      const row =
        item as Record<
          string,
          unknown
        >;

      if (
        typeof row.community_id !==
          "string" ||
        typeof row.community_name !==
          "string" ||
        typeof row.community_slug !==
          "string"
      ) {
        return [];
      }

      const scopeType =
        row.community_scope_type ===
        "global"
          ? "global"
          : "restricted";

      return [
        {
          id:
            row.community_id,
          name:
            row.community_name,
          slug:
            row.community_slug,
          description:
            typeof row.community_description ===
            "string"
              ? row.community_description
              : null,
          iconKey:
            (
              typeof row.community_icon_key ===
              "string"
                ? row.community_icon_key
                : "people"
            ) as CommunityIconKey,
          iconUrl:
            typeof row.community_icon_url ===
            "string"
              ? row.community_icon_url
              : null,
          accentColor:
            normalizeCommunityAccent(
              row.community_accent_color
            ),
          secondaryColor:
            normalizeCommunitySecondary(
              row.community_secondary_color
            ),
          scopeType,
          categoryId:
            typeof row.category_id ===
            "string"
              ? row.category_id
              : null,
          categoryName:
            typeof row.category_name ===
            "string"
              ? row.category_name
              : scopeType === "global"
                ? "All Activities"
                : "Selected Activities",
          categoryIds:
            parseStringArray(
              row.category_ids
            ),
          categoryNames:
            parseStringArray(
              row.category_names
            ),
          activityIds:
            parseStringArray(
              row.activity_ids
            ),
          activityNames:
            parseStringArray(
              row.activity_names
            ),
          relevanceRank:
            parseNumber(
              row.relevance_rank
            ),
        },
      ];
    }
  );
}

export function parseIntentCommunityRows(
  value: unknown
): IntentCommunityContext[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return [];
      }

      const row =
        item as Record<
          string,
          unknown
        >;

      if (
        typeof row.intent_id !==
          "string" ||
        typeof row.community_id !==
          "string" ||
        typeof row.community_name !==
          "string" ||
        typeof row.community_slug !==
          "string"
      ) {
        return [];
      }

      const scopeType: CommunityScopeType =
        row.community_scope_type ===
        "global"
          ? "global"
          : "restricted";

      return [
        {
          intentId:
            row.intent_id,
          id:
            row.community_id,
          name:
            row.community_name,
          slug:
            row.community_slug,
          description:
            typeof row.community_description ===
            "string"
              ? row.community_description
              : null,
          iconKey:
            (
              typeof row.community_icon_key ===
              "string"
                ? row.community_icon_key
                : "people"
            ) as CommunityIconKey,
          iconUrl:
            typeof row.community_icon_url ===
            "string"
              ? row.community_icon_url
              : null,
          accentColor:
            normalizeCommunityAccent(
              row.community_accent_color
            ),
          secondaryColor:
            normalizeCommunitySecondary(
              row.community_secondary_color
            ),
          scopeType,
          categoryId:
            typeof row.category_id ===
            "string"
              ? row.category_id
              : null,
          status:
            typeof row.community_status ===
            "string"
              ? row.community_status
              : "active",
          position:
            parseNumber(
              row.community_position,
              0
            ),
          isPrimary:
            row.is_primary === true ||
            parseNumber(
              row.community_position,
              0
            ) === 0,
        },
      ];
    }
  ).sort(
    (left, right) =>
      left.intentId.localeCompare(
        right.intentId
      ) ||
      left.position -
        right.position ||
      left.name.localeCompare(
        right.name
      )
  );
}

export function slugifyCommunityName(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "en-US"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
