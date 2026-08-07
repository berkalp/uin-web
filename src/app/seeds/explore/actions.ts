"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSafeReturnTo(formData: FormData): string {
  const requested = getText(formData, "return_to");

  if (!requested.startsWith("/seeds/")) {
    return "/seeds/explore";
  }

  return requested;
}


function kindForSeedTypeSlug(slug: string): string {
  switch (slug) {
    case "read": return "book";
    case "watch": return "movie";
    case "listen": return "album";
    case "visit": return "place";
    case "try": return "restaurant";
    case "learn": return "course";
    case "play": return "game";
    case "practice": return "skill";
    default: return "generic";
  }
}

function appendNotice(
  path: string,
  key: "error" | "planted" | "suggested",
  value: string
): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

export async function plantSeedFromCatalogue(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const catalogItemId = getText(formData, "catalog_item_id");
  const inspiredBySeedId = getText(formData, "inspired_by_seed_id");

  if (!catalogItemId) {
    redirect(appendNotice(returnTo, "error", "Catalogue item is missing."));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc(
    "plant_seed_from_catalog",
    {
      p_catalog_item_id: catalogItemId,
      p_visibility: "only_me",
      p_note: null,
      p_target_date: null,
      p_custom_title: null,
      p_catalog_edition_id: null,
      p_inspired_by_seed_id: inspiredBySeedId || null,
    }
  );

  if (error) {
    redirect(appendNotice(returnTo, "error", error.message));
  }

  const seedId = typeof data === "string" ? data : "";

  if (!seedId) {
    redirect(appendNotice(returnTo, "error", "Seed could not be created."));
  }

  redirect(`/seeds/${encodeURIComponent(seedId)}/edit?planted=1`);
}

export async function connectPrivateSeedToCatalogue(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const seedId = getText(formData, "source_seed_id");
  const catalogItemId = getText(formData, "catalog_item_id");

  if (!seedId || !catalogItemId) {
    redirect(appendNotice(returnTo, "error", "Seed or Library subject is missing."));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { error } = await supabase.rpc("connect_my_private_seed_to_catalog", {
    p_seed_id: seedId,
    p_catalog_item_id: catalogItemId,
  });

  if (error) redirect(appendNotice(returnTo, "error", error.message));
  redirect(`/seeds/${encodeURIComponent(seedId)}/edit?planted=1`);
}

export async function suggestAndPlantSeedSubject(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const sourceSeedId = getText(formData, "source_seed_id");
  const seedTypeId = getText(formData, "seed_type_id");
  const canonicalTitle = getText(formData, "canonical_title");
  const creatorName = getText(formData, "creator_name");
  const releaseYearRaw = getText(formData, "release_year");
  const coverUrl = getText(formData, "cover_url");
  const referenceUrl = getText(formData, "reference_url");
  const releaseYear = releaseYearRaw ? Number.parseInt(releaseYearRaw, 10) : null;

  if (!seedTypeId || !canonicalTitle) {
    redirect(appendNotice(returnTo, "error", "Seed Type and subject title are required."));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: seedTypes, error: typeError } = await supabase.rpc("get_active_seed_types");
  if (typeError) redirect(appendNotice(returnTo, "error", typeError.message));
  const selectedType = (seedTypes ?? []).find((row: { id?: string }) => row.id === seedTypeId) as { slug?: string } | undefined;
  const itemKind = kindForSeedTypeSlug(selectedType?.slug ?? "");

  if (sourceSeedId) {
    const { error } = await supabase.rpc("suggest_and_connect_my_private_seed", {
      p_seed_id: sourceSeedId,
      p_seed_type_id: seedTypeId,
      p_item_kind: itemKind,
      p_canonical_title: canonicalTitle,
      p_creator_name: creatorName || null,
      p_release_year: releaseYear !== null && Number.isFinite(releaseYear) ? releaseYear : null,
      p_cover_url: coverUrl || null,
      p_reference_url: referenceUrl || null,
    });
    if (error) redirect(appendNotice(returnTo, "error", error.message));
    redirect(`/seeds/${encodeURIComponent(sourceSeedId)}/edit?planted=1`);
  }

  const metadata = referenceUrl ? { reference_url: referenceUrl } : {};
  const { data: catalogItemId, error: suggestionError } = await supabase.rpc("suggest_seed_catalog_item", {
    p_seed_type_id: seedTypeId,
    p_item_kind: itemKind,
    p_canonical_title: canonicalTitle,
    p_creator_name: creatorName || null,
    p_original_title: null,
    p_release_year: releaseYear !== null && Number.isFinite(releaseYear) ? releaseYear : null,
    p_cover_url: coverUrl || null,
    p_language_code: null,
    p_metadata: metadata,
  });

  if (suggestionError || !catalogItemId) {
    redirect(appendNotice(returnTo, "error", suggestionError?.message || "Subject could not be suggested."));
  }

  const { data: seedId, error: plantError } = await supabase.rpc("plant_seed_from_catalog", {
    p_catalog_item_id: catalogItemId,
    p_visibility: "only_me",
    p_note: null,
    p_target_date: null,
    p_custom_title: null,
    p_catalog_edition_id: null,
    p_inspired_by_seed_id: null,
  });

  if (plantError) redirect(appendNotice(returnTo, "error", plantError.message));
  const createdSeedId = typeof seedId === "string" ? seedId : "";
  if (!createdSeedId) redirect(appendNotice(returnTo, "error", "Seed could not be created."));
  redirect(`/seeds/${encodeURIComponent(createdSeedId)}/edit?planted=1`);
}

export async function setSeedExperienceReaction(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const seedId = getText(formData, "seed_id");
  const reactionType = getText(formData, "reaction_type");
  const active = getText(formData, "active") === "true";

  if (!seedId || !["save", "inspired"].includes(reactionType)) {
    redirect(appendNotice(returnTo, "error", "Experience reaction is invalid."));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { error } = await supabase.rpc(
    "set_my_seed_experience_reaction",
    {
      p_seed_id: seedId,
      p_reaction_type: reactionType,
      p_active: active,
    }
  );

  if (error) {
    redirect(appendNotice(returnTo, "error", error.message));
  }

  redirect(returnTo);
}

export async function addSeedExperienceComment(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const seedId = getText(formData, "seed_id");
  const body = getText(formData, "body");
  const commentKind = getText(formData, "comment_kind") || "comment";
  const parentCommentId = getText(formData, "parent_comment_id");

  if (!seedId || body.length < 2) {
    redirect(
      appendNotice(
        returnTo,
        "error",
        "Write at least two characters before posting."
      )
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { error } = await supabase.rpc(
    "add_seed_experience_comment",
    {
      p_seed_id: seedId,
      p_body: body,
      p_comment_kind: commentKind,
      p_parent_comment_id: parentCommentId || null,
    }
  );

  if (error) {
    redirect(appendNotice(returnTo, "error", error.message));
  }

  redirect(returnTo);
}

export async function setSeedExperienceCommentPolicy(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const seedId = getText(formData, "seed_id");
  const policy = getText(formData, "comment_policy");

  if (
    !seedId ||
    !["everyone", "friends", "same_seed", "off"].includes(policy)
  ) {
    redirect(appendNotice(returnTo, "error", "Comment policy is invalid."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "set_my_seed_experience_comment_policy",
    {
      p_seed_id: seedId,
      p_policy: policy,
    }
  );

  if (error) {
    redirect(appendNotice(returnTo, "error", error.message));
  }

  redirect(returnTo);
}

export async function addPastSeedExperience(
  formData: FormData
): Promise<void> {
  const returnTo = getSafeReturnTo(formData);
  const catalogItemId = getText(formData, "catalog_item_id");
  const completionPrecision = getText(formData, "completion_precision") || "unknown";
  const completedOn = getText(formData, "completed_on");
  const completedYearText = getText(formData, "completed_year");
  const reflection = getText(formData, "reflection");
  const keyTakeaway = getText(formData, "key_takeaway");
  const visibility = getText(formData, "visibility") || "only_me";
  const completedYear = completedYearText
    ? Number.parseInt(completedYearText, 10)
    : null;

  if (!catalogItemId) {
    redirect(appendNotice(returnTo, "error", "Catalogue item is missing."));
  }

  if (!["exact", "year", "unknown"].includes(completionPrecision)) {
    redirect(appendNotice(returnTo, "error", "Completion timing is invalid."));
  }

  if (completionPrecision === "exact" && !completedOn) {
    redirect(appendNotice(returnTo, "error", "Choose the completion date."));
  }

  if (
    completionPrecision === "year" &&
    (completedYear === null || !Number.isInteger(completedYear))
  ) {
    redirect(appendNotice(returnTo, "error", "Choose the completion year."));
  }

  if (!["only_me", "friends", "everyone"].includes(visibility)) {
    redirect(appendNotice(returnTo, "error", "Visibility is invalid."));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc(
    "add_past_seed_experience_from_catalog",
    {
      p_catalog_item_id: catalogItemId,
      p_completed_on: completedOn || null,
      p_completed_date_precision: completionPrecision,
      p_completed_year: completedYear,
      p_reflection: reflection || null,
      p_key_takeaway: keyTakeaway || null,
      p_visibility: visibility,
    }
  );

  if (error) {
    redirect(appendNotice(returnTo, "error", error.message));
  }

  const seedId = typeof data === "string" ? data : "";

  if (!seedId) {
    redirect(appendNotice(returnTo, "error", "Past experience could not be added."));
  }

  redirect(`/seeds/${encodeURIComponent(seedId)}?past=1`);
}
