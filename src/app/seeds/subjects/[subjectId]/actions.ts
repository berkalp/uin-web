"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  const keys = [
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
  const result: Record<string, string | number | null> = {};
  for (const key of keys) {
    const formKey = `meta_${key}`;
    if (formData.has(formKey)) result[key] = text(formData, formKey) || null;
  }
  if (formData.has("meta_runtime_minutes")) {
    const runtime = text(formData, "meta_runtime_minutes");
    result.runtime_minutes = runtime ? Number(runtime) : null;
  }
  return result;
}

export async function reportSeedLibrarySubject(formData: FormData): Promise<void> {
  const catalogItemId = text(formData, "catalog_item_id");
  const reason = text(formData, "reason");
  const details = text(formData, "details");

  if (!catalogItemId || !reason) {
    redirect(`/seeds/explore?error=${encodeURIComponent("Choose a report reason.")}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { error } = await supabase.rpc("report_seed_catalog_item", {
    p_catalog_item_id: catalogItemId,
    p_reason: reason,
    p_details: details || null,
  });

  if (error) {
    redirect(`/seeds/explore?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/seeds/explore?reported=1");
}

function subjectReturnTo(formData: FormData): string {
  const value = text(formData, "return_to");
  return value.startsWith("/seeds/subjects/")
    ? value
    : "/seeds/explore";
}

function withSubjectNotice(
  path: string,
  key: "error" | "admin_updated",
  value: string
): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function adminUpdateSeedLibrarySubject(
  formData: FormData
): Promise<void> {
  const returnTo = subjectReturnTo(formData);
  const catalogItemId = text(formData, "catalog_item_id");
  const canonicalTitle = text(formData, "canonical_title");
  const creatorName = text(formData, "creator_name");
  const originalTitle = text(formData, "original_title");
  const releaseYear = nullableInteger(formData, "release_year");
  const coverUrl = text(formData, "cover_url");
  const languageCode = text(formData, "language_code");
  const latitude = nullableNumber(formData, "place_latitude");
  const longitude = nullableNumber(formData, "place_longitude");
  const metadata = buildMetadata(formData);

  if (!catalogItemId || !canonicalTitle) {
    redirect(withSubjectNotice(returnTo, "error", "Catalogue subject details are incomplete."));
  }

  if (
    releaseYear !== null &&
    (!Number.isInteger(releaseYear) || releaseYear < 1 || releaseYear > 3000)
  ) {
    redirect(withSubjectNotice(returnTo, "error", "Release year is invalid."));
  }

  if ((latitude === null) !== (longitude === null)) {
    redirect(withSubjectNotice(returnTo, "error", "Latitude and longitude must be entered together."));
  }
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    redirect(withSubjectNotice(returnTo, "error", "Latitude is invalid."));
  }
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    redirect(withSubjectNotice(returnTo, "error", "Longitude is invalid."));
  }

  const runtime = metadata.runtime_minutes;
  if (
    runtime !== undefined &&
    runtime !== null &&
    (typeof runtime !== "number" || !Number.isInteger(runtime) || runtime < 1 || runtime > 100000)
  ) {
    redirect(withSubjectNotice(returnTo, "error", "Runtime is invalid."));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: adminRole } = await supabase.rpc("get_admin_role");
  if (!adminRole) {
    redirect(withSubjectNotice(returnTo, "error", "Admin access is required."));
  }

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
    redirect(withSubjectNotice(returnTo, "error", error.message));
  }

  redirect(withSubjectNotice(returnTo, "admin_updated", "details"));
}

export async function adminReviewSeedLibrarySubject(
  formData: FormData
): Promise<void> {
  const returnTo = subjectReturnTo(formData);
  const catalogItemId = text(formData, "catalog_item_id");
  const reviewAction = text(formData, "review_action");

  if (!catalogItemId || !["approve", "reject"].includes(reviewAction)) {
    redirect(withSubjectNotice(returnTo, "error", "Admin review request is invalid."));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: adminRole } = await supabase.rpc("get_admin_role");
  if (!adminRole) {
    redirect(withSubjectNotice(returnTo, "error", "Admin access is required."));
  }

  const { error } = await supabase.rpc("admin_review_seed_catalog_item", {
    p_catalog_item_id: catalogItemId,
    p_action: reviewAction,
    p_target_catalog_item_id: null,
  });

  if (error) {
    redirect(withSubjectNotice(returnTo, "error", error.message));
  }

  if (reviewAction === "reject") {
    redirect("/admin/seed-catalogue?status=rejected&updated=rejected");
  }

  redirect(withSubjectNotice(returnTo, "admin_updated", reviewAction));
}
