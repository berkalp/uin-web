"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnTo(formData: FormData): string {
  const value = text(formData, "return_to");
  return value.startsWith("/admin/seed-catalogue")
    ? value
    : "/admin/seed-catalogue";
}

function withNotice(
  path: string,
  key: "error" | "updated",
  value: string
): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(
    value
  )}`;
}

function nullableInteger(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function nullableNumber(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildMetadata(formData: FormData): Record<string, string | number | null> {
  const stringKeys = [
    "description",
    "reference_url",
    "isbn",
    "publisher",
    "director",
    "platform",
    "artist",
    "audio_format",
    "developer",
    "platforms",
    "provider",
    "level",
    "context",
    "external_id",
  ];

  const metadata: Record<string, string | number | null> = {};
  for (const key of stringKeys) {
    const formKey = `meta_${key}`;
    if (formData.has(formKey)) {
      metadata[key] = text(formData, formKey) || null;
    }
  }

  if (formData.has("meta_runtime_minutes")) {
    const runtimeText = text(formData, "meta_runtime_minutes");
    metadata.runtime_minutes = runtimeText ? Number(runtimeText) : null;
  }

  return metadata;
}

function validateMetadata(metadata: Record<string, string | number | null>): string | null {
  const runtime = metadata.runtime_minutes;
  if (
    runtime !== undefined &&
    runtime !== null &&
    (typeof runtime !== "number" || !Number.isInteger(runtime) || runtime < 1 || runtime > 100000)
  ) {
    return "Runtime is invalid.";
  }
  return null;
}

export async function reviewSeedCatalogueItem(
  formData: FormData
): Promise<void> {
  const returnTo = safeReturnTo(formData);
  const catalogItemId = text(formData, "catalog_item_id");
  const action = text(formData, "review_action");
  const targetCatalogItemId = text(formData, "target_catalog_item_id");

  if (!catalogItemId || !["approve", "reject", "merge"].includes(action)) {
    redirect(withNotice(returnTo, "error", "Catalogue review request is invalid."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_seed_catalog_item", {
    p_catalog_item_id: catalogItemId,
    p_action: action,
    p_target_catalog_item_id: targetCatalogItemId || null,
  });

  if (error) {
    redirect(withNotice(returnTo, "error", error.message));
  }

  redirect(withNotice(returnTo, "updated", action));
}

export async function updateSeedCatalogueItem(
  formData: FormData
): Promise<void> {
  const returnTo = safeReturnTo(formData);
  const catalogItemId = text(formData, "catalog_item_id");
  const canonicalTitle = text(formData, "canonical_title");
  const creatorName = text(formData, "creator_name");
  const originalTitle = text(formData, "original_title");
  const releaseYear = nullableInteger(formData, "release_year");
  const coverUrl = text(formData, "cover_url");
  const languageCode = text(formData, "language_code");
  const metadata = buildMetadata(formData);
  const latitude = nullableNumber(formData, "place_latitude");
  const longitude = nullableNumber(formData, "place_longitude");

  if (!catalogItemId || !canonicalTitle) {
    redirect(withNotice(returnTo, "error", "Catalogue subject details are incomplete."));
  }

  if (
    releaseYear !== null &&
    (!Number.isInteger(releaseYear) || releaseYear < 1 || releaseYear > 3000)
  ) {
    redirect(withNotice(returnTo, "error", "Release year is invalid."));
  }

  if ((latitude === null) !== (longitude === null)) {
    redirect(withNotice(returnTo, "error", "Latitude and longitude must be entered together."));
  }
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    redirect(withNotice(returnTo, "error", "Latitude is invalid."));
  }
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    redirect(withNotice(returnTo, "error", "Longitude is invalid."));
  }

  const metadataError = validateMetadata(metadata);
  if (metadataError) {
    redirect(withNotice(returnTo, "error", metadataError));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_seed_catalog_item_v3", {
    p_catalog_item_id: catalogItemId,
    p_canonical_title: canonicalTitle,
    p_creator_name: creatorName || null,
    p_original_title: originalTitle || null,
    p_release_year: releaseYear,
    p_cover_url: coverUrl || null,
    p_language_code: languageCode || null,
    p_metadata: metadata,
    p_place_country: text(formData, "place_country") || null,
    p_place_region: text(formData, "place_region") || null,
    p_place_city: text(formData, "place_city") || null,
    p_place_address_text: text(formData, "place_address_text") || null,
    p_place_latitude: latitude,
    p_place_longitude: longitude,
    p_place_map_url: text(formData, "place_map_url") || null,
    p_place_external_id: text(formData, "place_external_id") || null,
  });

  if (error) {
    redirect(withNotice(returnTo, "error", error.message));
  }

  redirect(withNotice(returnTo, "updated", "subject-details"));
}

export async function createSeedCatalogueItem(
  formData: FormData
): Promise<void> {
  const returnTo = safeReturnTo(formData);
  const seedTypeId = text(formData, "seed_type_id");
  const itemKind = text(formData, "item_kind") || "generic";
  const canonicalTitle = text(formData, "canonical_title");
  const originalTitle = text(formData, "original_title");
  const creatorName = text(formData, "creator_name");
  const releaseYear = nullableInteger(formData, "release_year");
  const coverUrl = text(formData, "cover_url");
  const languageCode = text(formData, "language_code");
  const aliasesText = text(formData, "aliases");
  const aliases = aliasesText
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
  const metadata = buildMetadata(formData);
  const latitude = nullableNumber(formData, "place_latitude");
  const longitude = nullableNumber(formData, "place_longitude");

  if (!seedTypeId || !canonicalTitle) {
    redirect(
      withNotice(
        returnTo,
        "error",
        "Seed Type and canonical title are required."
      )
    );
  }

  if (
    releaseYear !== null &&
    (!Number.isInteger(releaseYear) || releaseYear < 1 || releaseYear > 3000)
  ) {
    redirect(withNotice(returnTo, "error", "Release year is invalid."));
  }
  if ((latitude === null) !== (longitude === null)) {
    redirect(withNotice(returnTo, "error", "Latitude and longitude must be entered together."));
  }
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    redirect(withNotice(returnTo, "error", "Latitude is invalid."));
  }
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    redirect(withNotice(returnTo, "error", "Longitude is invalid."));
  }

  const metadataError = validateMetadata(metadata);
  if (metadataError) {
    redirect(withNotice(returnTo, "error", metadataError));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_seed_catalog_item_v3", {
    p_seed_type_id: seedTypeId,
    p_item_kind: itemKind,
    p_canonical_title: canonicalTitle,
    p_original_title: originalTitle || null,
    p_creator_name: creatorName || null,
    p_release_year: releaseYear,
    p_cover_url: coverUrl || null,
    p_language_code: languageCode || null,
    p_aliases: aliases,
    p_metadata: metadata,
    p_place_country: text(formData, "place_country") || null,
    p_place_region: text(formData, "place_region") || null,
    p_place_city: text(formData, "place_city") || null,
    p_place_address_text: text(formData, "place_address_text") || null,
    p_place_latitude: latitude,
    p_place_longitude: longitude,
    p_place_map_url: text(formData, "place_map_url") || null,
    p_place_external_id: text(formData, "place_external_id") || null,
  });

  if (error) {
    redirect(withNotice(returnTo, "error", error.message));
  }

  if (typeof data !== "string" || !data) {
    redirect(withNotice(returnTo, "error", "Library subject could not be created."));
  }

  redirect(withNotice("/admin/seed-catalogue?status=active", "updated", "created"));
}
