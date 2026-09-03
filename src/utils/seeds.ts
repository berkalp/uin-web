export type SeedVisibility =
  | "only_me"
  | "friends"
  | "everyone";

export type SeedStatus =
  | "active"
  | "completed"
  | "archived";

export type SeedOrigin = "planted" | "retrospective";

export type SeedScope = "library" | "private";

export type SeedCompletionPrecision =
  | "exact"
  | "year"
  | "unknown";

export type SeedLinkKind =
  | "resource"
  | "image"
  | "video";

export type SeedJournalAttachmentKind =
  | "link"
  | "image"
  | "video";

export type SeedTypeOption = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  sort_order: number;
  suggested_activity_id: string | null;
  suggested_activity_name: string | null;
  suggested_category_id: string | null;
  suggested_category_name: string | null;
};

export type SeedLink = {
  id?: string | null;
  url: string;
  label: string | null;
  description: string | null;
  kind: SeedLinkKind;
  sort_order: number;
};

export type SeedJournalAttachment = {
  url: string;
  kind: SeedJournalAttachmentKind;
  label: string | null;
  caption: string | null;
  sort_order: number;
};

export type SeedJournalEntry = {
  id: string;
  entry_kind: "update" | "reflection";
  body: string | null;
  key_takeaway: string | null;
  attachments: SeedJournalAttachment[];
  visibility: SeedVisibility;
  occurred_on: string;
  created_at: string;
  updated_at: string;
};

export type SeedIntentLink = {
  intent_id: string;
  activity_name: string | null;
  status: string;
  relationship: "spawned_from" | "inspired_by" | string;
  created_at: string;
};

export type SeedReactionFriendPreview = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type SeedReactionContext = {
  seed_id: string;
  save_count: number;
  water_count: number;
  viewer_saved: boolean;
  viewer_watered: boolean;
  friend_water_count: number;
  friend_water_preview: SeedReactionFriendPreview[];
  viewer_can_react: boolean;
  reaction_disabled_reason: string | null;
};

export type SeedRecord = {
  seed_id: string;
  seed_type_id: string;
  seed_type_name: string;
  seed_type_slug: string;
  seed_type_icon: string;
  title: string;
  subtitle: string | null;
  notes: string | null;
  cover_url: string | null;
  visibility: SeedVisibility;
  seed_scope: SeedScope;
  private_origin_title?: string | null;
  catalogue_status?: "active" | "pending" | "under_review" | "merged" | "rejected" | null;
  status: SeedStatus;
  target_date: string | null;
  completed_at: string | null;
  origin?: SeedOrigin;
  completed_date_precision?: SeedCompletionPrecision | null;
  completed_year?: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  links: SeedLink[];
  grown_intent_count: number | string;
  journal_count: number | string;
  key_takeaway: string | null;
  reaction_context?: SeedReactionContext | null;
};

export type PublicSeedRecord = {
  seed_id: string;
  seed_type_name: string;
  seed_type_slug: string;
  seed_type_icon: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  visibility: SeedVisibility;
  seed_scope?: SeedScope;
  status: Exclude<SeedStatus, "archived">;
  target_date: string | null;
  completed_at: string | null;
  origin?: SeedOrigin;
  completed_date_precision?: SeedCompletionPrecision | null;
  completed_year?: number | null;
  grown_intent_count: number | string;
  journal_count: number | string;
  key_takeaway: string | null;
  updated_at: string;
  reaction_context?: SeedReactionContext | null;
};

export type SeedDetailSeed = {
  seed_id: string;
  catalog_item_id: string | null;
  seed_type_id: string;
  seed_type_name: string;
  seed_type_slug: string;
  seed_type_icon: string;
  title: string;
  subtitle: string | null;
  notes: string | null;
  cover_url: string | null;
  visibility: SeedVisibility;
  seed_scope: SeedScope;
  private_origin_title?: string | null;
  status: SeedStatus;
  target_date: string | null;
  completed_at: string | null;
  origin: SeedOrigin;
  completed_date_precision: SeedCompletionPrecision | null;
  completed_year: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  owner_user_id: string;
  owner_full_name: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
};

export type SeedDetailData = {
  seed: SeedDetailSeed;
  links: SeedLink[];
  journal: SeedJournalEntry[];
  intents: SeedIntentLink[];
};

export type SeedGrowthContext = {
  seed_id: string;
  seed_title: string;
  seed_notes: string | null;
  seed_external_url: string | null;
  seed_type_id: string;
  seed_type_name: string;
  seed_type_icon: string;
  seed_scope: SeedScope;
  catalog_item_id: string | null;
  suggested_activity_id: string | null;
  suggested_activity_name: string | null;
  suggested_category_id: string | null;
  suggested_category_name: string | null;
};

export type SeedGrowthCandidate = {
  seed_id: string;
  seed_title: string;
  seed_type_name: string;
  seed_type_icon: string;
  seed_scope: SeedScope;
  catalog_item_id: string | null;
  is_primary: boolean;
};

export const SEED_VISIBILITY_OPTIONS: Array<{
  value: SeedVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "everyone",
    label: "Herkese açık",
    description: "Profilinde ve uygun keşif alanlarında herkes görebilir.",
  },
  {
    value: "friends",
    label: "Arkadaşlarım",
    description: "Yalnızca kabul ettiğin arkadaşların görebilir.",
  },
  {
    value: "only_me",
    label: "Sadece ben",
    description: "Bu kayıt yalnızca sana görünür.",
  },
];

export const SEED_LINK_KIND_OPTIONS: Array<{
  value: SeedLinkKind;
  label: string;
  description: string;
}> = [
  {
    value: "resource",
    label: "Resource",
    description: "A webpage, article, product, place or result link.",
  },
  {
    value: "image",
    label: "Image",
    description: "A direct image URL shown in the Seed gallery.",
  },
  {
    value: "video",
    label: "Video",
    description: "A YouTube, Vimeo or other video page URL.",
  },
];

export function getSeedVisibilityLabel(
  visibility: SeedVisibility
) {
  return (
    SEED_VISIBILITY_OPTIONS.find(
      (option) => option.value === visibility
    )?.label ?? "Herkese açık"
  );
}

export function getSeedCompletionLabel(seed: {
  completed_at: string | null;
  completed_date_precision?: SeedCompletionPrecision | null;
  completed_year?: number | null;
}): string | null {
  if (seed.completed_date_precision === "unknown") {
    return "Date not remembered";
  }

  if (seed.completed_date_precision === "year") {
    return seed.completed_year ? String(seed.completed_year) : "Year not set";
  }

  if (!seed.completed_at) {
    return null;
  }

  const date = new Date(seed.completed_at);
  if (Number.isNaN(date.getTime())) {
    return seed.completed_at;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export type SeedDashboardStatus = SeedStatus | "past_due";

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSeedPastDue(
  seed: Pick<SeedRecord, "status" | "target_date">,
  today = getLocalDateKey()
) {
  return (
    seed.status === "active" &&
    Boolean(seed.target_date) &&
    String(seed.target_date) < today
  );
}

export function getSeedDashboardStatus(
  seed: Pick<SeedRecord, "status" | "target_date">,
  today = getLocalDateKey()
): SeedDashboardStatus {
  if (isSeedPastDue(seed, today)) {
    return "past_due";
  }

  return seed.status;
}

export function getSeedStatusLabel(
  status: SeedStatus,
  pastDue = false
) {
  if (pastDue) {
    return "Süresi geçti";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "archived") {
    return "Kapanmış";
  }

  return "Growing";
}

export function toSeedCount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function normalizeSeedOrigin(value: unknown): SeedOrigin {
  return value === "retrospective" ? "retrospective" : "planted";
}

function normalizeCompletionPrecision(
  value: unknown
): SeedCompletionPrecision | null {
  return value === "exact" || value === "year" || value === "unknown"
    ? value
    : null;
}

function normalizeSeedScope(value: unknown): SeedScope {
  return value === "library" ? "library" : "private";
}

function normalizeVisibility(value: unknown): SeedVisibility {
  return value === "friends" || value === "everyone"
    ? value
    : "only_me";
}

function normalizeSeedLinkKind(value: unknown): SeedLinkKind {
  return value === "image" || value === "video"
    ? value
    : "resource";
}

function normalizeAttachmentKind(
  value: unknown
): SeedJournalAttachmentKind {
  return value === "image" || value === "video"
    ? value
    : "link";
}

export function parseSeedLinks(value: unknown): SeedLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: SeedLink[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const row = item as Record<string, unknown>;
    const url = stringOrNull(row.url);

    if (!url) {
      return;
    }

    result.push({
      id: stringOrNull(row.id),
      url,
      label: stringOrNull(row.label),
      description: stringOrNull(row.description),
      kind: normalizeSeedLinkKind(row.kind),
      sort_order: toSeedCount(row.sort_order ?? index),
    });
  });

  return result.sort(
    (first, second) => first.sort_order - second.sort_order
  );
}

export function parseSeedJournalAttachments(
  value: unknown
): SeedJournalAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: SeedJournalAttachment[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const row = item as Record<string, unknown>;
    const url = stringOrNull(row.url);

    if (!url) {
      return;
    }

    result.push({
      url,
      kind: normalizeAttachmentKind(row.kind),
      label: stringOrNull(row.label),
      caption: stringOrNull(row.caption),
      sort_order: toSeedCount(row.sort_order ?? index),
    });
  });

  return result.sort(
    (first, second) => first.sort_order - second.sort_order
  );
}

export function parseSeedReactionContext(
  value: unknown
): SeedReactionContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const seedId = stringOrNull(row.seed_id);

  if (!seedId) {
    return null;
  }

  const preview = Array.isArray(row.friend_water_preview)
    ? row.friend_water_preview
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const person = item as Record<string, unknown>;
          const userId = stringOrNull(person.user_id);

          if (!userId) {
            return null;
          }

          return {
            user_id: userId,
            full_name: stringOrNull(person.full_name),
            username: stringOrNull(person.username),
            avatar_url: stringOrNull(person.avatar_url),
          } satisfies SeedReactionFriendPreview;
        })
        .filter(
          (item): item is SeedReactionFriendPreview => item !== null
        )
    : [];

  return {
    seed_id: seedId,
    save_count: toSeedCount(row.save_count),
    water_count: toSeedCount(row.water_count),
    viewer_saved: row.viewer_saved === true,
    viewer_watered: row.viewer_watered === true,
    friend_water_count: toSeedCount(row.friend_water_count),
    friend_water_preview: preview,
    viewer_can_react: row.viewer_can_react === true,
    reaction_disabled_reason: stringOrNull(
      row.reaction_disabled_reason
    ),
  };
}

export function parseSeedReactionContexts(
  value: unknown
): SeedReactionContext[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parseSeedReactionContext)
    .filter((item): item is SeedReactionContext => item !== null);
}

export function emptySeedReactionContext(
  seedId: string,
  overrides: Partial<SeedReactionContext> = {}
): SeedReactionContext {
  return {
    seed_id: seedId,
    save_count: 0,
    water_count: 0,
    viewer_saved: false,
    viewer_watered: false,
    friend_water_count: 0,
    friend_water_preview: [],
    viewer_can_react: false,
    reaction_disabled_reason: null,
    ...overrides,
  };
}

export function parseSeedDetailData(
  value: unknown
): SeedDetailData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const root = value as Record<string, unknown>;
  const rawSeed = root.seed;

  if (!rawSeed || typeof rawSeed !== "object") {
    return null;
  }

  const seedRow = rawSeed as Record<string, unknown>;
  const seedId = stringOrNull(seedRow.seed_id);
  const ownerUserId = stringOrNull(seedRow.owner_user_id);
  const title = stringOrNull(seedRow.title);

  if (!seedId || !ownerUserId || !title) {
    return null;
  }

  const status: SeedStatus =
    seedRow.status === "completed" || seedRow.status === "archived"
      ? seedRow.status
      : "active";

  const journal = Array.isArray(root.journal)
    ? root.journal
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const row = item as Record<string, unknown>;
          const id = stringOrNull(row.id);
          const occurredOn = stringOrNull(row.occurred_on);
          const createdAt = stringOrNull(row.created_at);
          const updatedAt = stringOrNull(row.updated_at);

          if (!id || !occurredOn || !createdAt || !updatedAt) {
            return null;
          }

          return {
            id,
            entry_kind:
              row.entry_kind === "reflection" ? "reflection" : "update",
            body: stringOrNull(row.body),
            key_takeaway: stringOrNull(row.key_takeaway),
            attachments: parseSeedJournalAttachments(row.attachments),
            visibility: normalizeVisibility(row.visibility),
            occurred_on: occurredOn,
            created_at: createdAt,
            updated_at: updatedAt,
          } satisfies SeedJournalEntry;
        })
        .filter((item): item is SeedJournalEntry => item !== null)
    : [];

  const intents = Array.isArray(root.intents)
    ? root.intents
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const row = item as Record<string, unknown>;
          const intentId = stringOrNull(row.intent_id);
          const createdAt = stringOrNull(row.created_at);

          if (!intentId || !createdAt) {
            return null;
          }

          return {
            intent_id: intentId,
            activity_name: stringOrNull(row.activity_name),
            status: stringOrNull(row.status) ?? "active",
            relationship:
              stringOrNull(row.relationship) ?? "spawned_from",
            created_at: createdAt,
          } satisfies SeedIntentLink;
        })
        .filter((item): item is SeedIntentLink => item !== null)
    : [];

  return {
    seed: {
      seed_id: seedId,
      catalog_item_id: stringOrNull(seedRow.catalog_item_id),
      seed_type_id: stringOrNull(seedRow.seed_type_id) ?? "",
      seed_type_name: stringOrNull(seedRow.seed_type_name) ?? "Seed",
      seed_type_slug: stringOrNull(seedRow.seed_type_slug) ?? "seed",
      seed_type_icon: stringOrNull(seedRow.seed_type_icon) ?? "🌱",
      title,
      subtitle: stringOrNull(seedRow.subtitle),
      notes: stringOrNull(seedRow.notes),
      cover_url: stringOrNull(seedRow.cover_url),
      visibility: normalizeVisibility(seedRow.visibility),
      seed_scope: normalizeSeedScope(seedRow.seed_scope),
      private_origin_title: stringOrNull(seedRow.private_origin_title),
      status,
      target_date: stringOrNull(seedRow.target_date),
      completed_at: stringOrNull(seedRow.completed_at),
      origin: normalizeSeedOrigin(seedRow.origin),
      completed_date_precision: normalizeCompletionPrecision(
        seedRow.completed_date_precision
      ),
      completed_year:
        typeof seedRow.completed_year === "number"
          ? seedRow.completed_year
          : null,
      archived_at: stringOrNull(seedRow.archived_at),
      created_at: stringOrNull(seedRow.created_at) ?? "",
      updated_at: stringOrNull(seedRow.updated_at) ?? "",
      is_owner: seedRow.is_owner === true,
      owner_user_id: ownerUserId,
      owner_full_name: stringOrNull(seedRow.owner_full_name),
      owner_username: stringOrNull(seedRow.owner_username),
      owner_avatar_url: stringOrNull(seedRow.owner_avatar_url),
    },
    links: parseSeedLinks(root.links),
    journal,
    intents,
  };
}
