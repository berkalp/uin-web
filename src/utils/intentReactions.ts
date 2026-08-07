export type IntentReactionType = "save" | "paw";

export type PawVisibility =
  | "only_me"
  | "friends"
  | "everyone";

export type IntentReactionFriendPreview = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type IntentReactionContext = {
  intent_id: string;
  save_count: number;
  paw_count: number;
  viewer_saved: boolean;
  viewer_pawed: boolean;
  viewer_paw_visibility: PawVisibility;
  friend_paw_count: number;
  friend_paw_preview: IntentReactionFriendPreview[];
  viewer_can_react: boolean;
  reaction_disabled_reason: string | null;
};

export type RawIntentReactionContext = {
  intent_id?: unknown;
  save_count?: unknown;
  paw_count?: unknown;
  viewer_saved?: unknown;
  viewer_pawed?: unknown;
  viewer_paw_visibility?: unknown;
  friend_paw_count?: unknown;
  friend_paw_preview?: unknown;
  viewer_can_react?: unknown;
  reaction_disabled_reason?: unknown;
};

export const PAW_VISIBILITY_OPTIONS: Array<{
  value: PawVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "only_me",
    label: "Only me",
    description: "Your Pawed Intents stay private.",
  },
  {
    value: "friends",
    label: "Friends",
    description: "Accepted friends can see the Intents you Paw.",
  },
  {
    value: "everyone",
    label: "Everyone",
    description: "Anyone who can view your profile and the Intent can see it.",
  },
];

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePawVisibility(value: unknown): PawVisibility {
  return value === "only_me" ||
    value === "everyone" ||
    value === "friends"
    ? value
    : "friends";
}

function parseFriendPreview(value: unknown): IntentReactionFriendPreview[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const userId = typeof row.user_id === "string" ? row.user_id : "";

      if (!userId) {
        return null;
      }

      return {
        user_id: userId,
        full_name: typeof row.full_name === "string" ? row.full_name : null,
        username: typeof row.username === "string" ? row.username : null,
        avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
      };
    })
    .filter((item): item is IntentReactionFriendPreview => item !== null);
}

export function parseIntentReactionContext(
  value: RawIntentReactionContext | null | undefined
): IntentReactionContext | null {
  if (!value || typeof value.intent_id !== "string") {
    return null;
  }

  return {
    intent_id: value.intent_id,
    save_count: toNumber(value.save_count),
    paw_count: toNumber(value.paw_count),
    viewer_saved: value.viewer_saved === true,
    viewer_pawed: value.viewer_pawed === true,
    viewer_paw_visibility: normalizePawVisibility(
      value.viewer_paw_visibility
    ),
    friend_paw_count: toNumber(value.friend_paw_count),
    friend_paw_preview: parseFriendPreview(value.friend_paw_preview),
    viewer_can_react: value.viewer_can_react === true,
    reaction_disabled_reason:
      typeof value.reaction_disabled_reason === "string"
        ? value.reaction_disabled_reason
        : null,
  };
}

export function parseIntentReactionContexts(
  value: unknown
): IntentReactionContext[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) =>
      parseIntentReactionContext(row as RawIntentReactionContext)
    )
    .filter((row): row is IntentReactionContext => row !== null);
}

export function emptyIntentReactionContext(
  intentId: string,
  overrides: Partial<IntentReactionContext> = {}
): IntentReactionContext {
  return {
    intent_id: intentId,
    save_count: 0,
    paw_count: 0,
    viewer_saved: false,
    viewer_pawed: false,
    viewer_paw_visibility: "friends",
    friend_paw_count: 0,
    friend_paw_preview: [],
    viewer_can_react: false,
    reaction_disabled_reason: null,
    ...overrides,
  };
}
