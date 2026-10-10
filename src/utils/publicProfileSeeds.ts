import type { PublicProfileSeedRecord } from "@/utils/seeds";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStringFields(
  value: unknown,
  fields: string[]
): value is Record<string, unknown> {
  return (
    isRecord(value) && fields.every((field) => typeof value[field] === "string")
  );
}

function nullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function nullableFiniteNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseableTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parsePublicProfileSeedLifeRow(
  value: unknown
): PublicProfileSeedRecord | null {
  if (!isRecord(value)) return null;

  if (
    !hasStringFields(value, [
      "seed_id",
      "title",
      "visibility",
      "seed_scope",
      "status",
      "relationship_status",
      "created_at",
      "updated_at",
    ]) ||
    !["only_me", "friends", "everyone"].includes(value.visibility as string) ||
    !["library", "private"].includes(value.seed_scope as string) ||
    !["active", "completed"].includes(value.status as string) ||
    !["want", "in_progress", "completed"].includes(
      value.relationship_status as string
    ) ||
    ![
      "catalog_item_id",
      "canonical_target_id",
      "seed_type_name",
      "seed_type_slug",
      "seed_type_icon",
      "subtitle",
      "cover_url",
      "personal_cover_url",
      "catalog_cover_url",
      "target_date",
      "key_takeaway",
      "experience_precision",
      "experience_date",
      "notes",
      "creator_name",
      "catalog_item_kind",
    ].every((field) => nullableString(value[field])) ||
    !nullableFiniteNumber(value.rating) ||
    !nullableFiniteNumber(value.experience_year) ||
    !nullableFiniteNumber(value.release_year) ||
    !parseableTimestamp(value.created_at) ||
    !parseableTimestamp(value.updated_at) ||
    ![null, "exact", "year", "unknown"].includes(
      value.experience_precision as null | string
    )
  ) {
    return null;
  }

  const rating = value.rating as number | null;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) {
    return null;
  }
  if (value.status !== "completed" && rating !== null) return null;
  if (
    value.status !== "completed" &&
    (value.experience_precision !== null ||
      value.experience_date !== null ||
      value.experience_year !== null)
  ) {
    return null;
  }
  if (
    (value.status === "completed") !==
    (value.relationship_status === "completed")
  ) {
    return null;
  }

  const experienceYear = value.experience_year as number | null;
  const releaseYear = value.release_year as number | null;
  if (
    (experienceYear !== null && !Number.isInteger(experienceYear)) ||
    (releaseYear !== null && !Number.isInteger(releaseYear))
  ) {
    return null;
  }

  return {
    seed_id: value.seed_id as string,
    catalog_item_id: value.catalog_item_id as string | null,
    canonical_target_id: value.canonical_target_id as string | null,
    seed_type_name: value.seed_type_name as string | null,
    seed_type_slug: value.seed_type_slug as string | null,
    seed_type_icon: value.seed_type_icon as string | null,
    title: value.title as string,
    subtitle: value.subtitle as string | null,
    cover_url:
      (value.personal_cover_url as string | null) ??
      (value.catalog_cover_url as string | null) ??
      (value.cover_url as string | null),
    visibility: value.visibility as "only_me" | "friends" | "everyone",
    seed_scope: value.seed_scope as "library" | "private",
    status: value.status as "active" | "completed",
    target_date: value.target_date as string | null,
    key_takeaway: value.key_takeaway as string | null,
    created_at: value.created_at as string,
    updated_at: value.updated_at as string,
    relationship_status: value.relationship_status as
      | "want"
      | "in_progress"
      | "completed",
    experience_precision: value.experience_precision as
      | "exact"
      | "year"
      | "unknown"
      | null,
    experience_date: value.experience_date as string | null,
    experience_year: experienceYear,
    personal_rating: value.status === "completed" ? rating : null,
    notes: value.notes as string | null,
    creator_name: value.creator_name as string | null,
    release_year: releaseYear,
    catalog_item_kind: value.catalog_item_kind as string | null,
  };
}

function validTimestamp(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function experienceTimestamp(seed: PublicProfileSeedRecord) {
  if (seed.experience_precision === "year" && seed.experience_year) {
    return Date.UTC(seed.experience_year, 0, 1);
  }

  return validTimestamp(seed.experience_date);
}

function shouldReplaceProfileSeed(
  current: PublicProfileSeedRecord,
  candidate: PublicProfileSeedRecord
) {
  if (candidate.status === "completed") {
    const currentExperience = experienceTimestamp(current);
    const candidateExperience = experienceTimestamp(candidate);
    if (candidateExperience !== currentExperience) {
      return candidateExperience > currentExperience;
    }
  }

  const currentUpdate = validTimestamp(current.updated_at);
  const candidateUpdate = validTimestamp(candidate.updated_at);
  if (candidateUpdate !== currentUpdate) return candidateUpdate > currentUpdate;

  return candidate.seed_id.localeCompare(current.seed_id) > 0;
}

/**
 * A person may have legacy duplicate Seeds for one canonical card. Collapse
 * duplicates only inside the same lifecycle/relationship group so an active
 * wish and a completed experience for the same card remain separate.
 */
export function normalizePublicProfileSeedLifeRows(
  rows: PublicProfileSeedRecord[]
) {
  const normalized = new Map<string, PublicProfileSeedRecord>();

  for (const row of rows) {
    const identity =
      row.canonical_target_id ?? row.catalog_item_id ?? row.seed_id;
    const key = `${row.status}:${row.relationship_status}:${identity}`;
    const current = normalized.get(key);

    if (!current || shouldReplaceProfileSeed(current, row)) {
      normalized.set(key, row);
    }
  }

  return Array.from(normalized.values());
}

/**
 * Parses the entire RPC payload atomically, then applies the same deterministic
 * canonical normalization used by both counters and sections. One malformed
 * row invalidates the collection, which prevents a public profile from
 * silently showing a partial count or list.
 */
export function parsePublicProfileSeedLifePayload(
  value: unknown
): PublicProfileSeedRecord[] | null {
  if (!Array.isArray(value)) return null;

  const rows: PublicProfileSeedRecord[] = [];
  for (const item of value) {
    const row = parsePublicProfileSeedLifeRow(item);
    if (!row) return null;
    rows.push(row);
  }

  return normalizePublicProfileSeedLifeRows(rows);
}
