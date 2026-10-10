import { notFound, redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import SeedForm from "@/components/seeds/SeedForm";
import {
  parseSeedLinks,
  type SeedRecord,
  type SeedTypeOption,
} from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

type EditSeedPageProps = {
  params: Promise<{
    seedId: string;
  }>;
  searchParams: Promise<{
    planted?: string | string[];
  }>;
};

type SeedCatalogueIdentity = {
  catalog_item_id: string;
  item_kind: string;
  canonical_title: string;
  creator_name: string | null;
  release_year: number | null;
  cover_url: string | null;
  catalogue_status: "active" | "pending" | "under_review" | "merged" | "rejected";
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCount(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isSeedRecord(value: unknown): value is SeedRecord {
  if (!isRecord(value)) return false;

  return (
    typeof value.seed_id === "string" &&
    isValidUuid(value.seed_id) &&
    typeof value.seed_type_id === "string" &&
    isValidUuid(value.seed_type_id) &&
    typeof value.seed_type_name === "string" &&
    Boolean(value.seed_type_name.trim()) &&
    typeof value.seed_type_slug === "string" &&
    Boolean(value.seed_type_slug.trim()) &&
    typeof value.seed_type_icon === "string" &&
    typeof value.title === "string" &&
    Boolean(value.title.trim()) &&
    isNullableString(value.subtitle) &&
    isNullableString(value.notes) &&
    isNullableString(value.cover_url) &&
    isNullableString(value.target_date) &&
    ["only_me", "friends", "everyone"].includes(String(value.visibility)) &&
    ["library", "private"].includes(String(value.seed_scope)) &&
    ["active", "completed", "archived"].includes(String(value.status)) &&
    isCount(value.grown_intent_count) &&
    isCount(value.journal_count) &&
    Array.isArray(value.links) &&
    value.links.every(
      (link) => isRecord(link) && typeof link.url === "string"
    )
  );
}

function isSeedTypeOption(value: unknown): value is SeedTypeOption {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isValidUuid(value.id) &&
    typeof value.name === "string" &&
    Boolean(value.name.trim()) &&
    typeof value.slug === "string" &&
    Boolean(value.slug.trim()) &&
    typeof value.icon === "string" &&
    isNullableString(value.description) &&
    typeof value.sort_order === "number" &&
    Number.isFinite(value.sort_order) &&
    isNullableString(value.suggested_activity_id) &&
    isNullableString(value.suggested_activity_name) &&
    isNullableString(value.suggested_category_id) &&
    isNullableString(value.suggested_category_name)
  );
}

function isSeedCatalogueIdentity(
  value: unknown
): value is SeedCatalogueIdentity {
  return (
    isRecord(value) &&
    typeof value.catalog_item_id === "string" &&
    isValidUuid(value.catalog_item_id) &&
    typeof value.item_kind === "string" &&
    Boolean(value.item_kind.trim()) &&
    typeof value.canonical_title === "string" &&
    Boolean(value.canonical_title.trim()) &&
    isNullableString(value.creator_name) &&
    (value.release_year === null ||
      (typeof value.release_year === "number" &&
        Number.isFinite(value.release_year))) &&
    isNullableString(value.cover_url) &&
    ["active", "pending", "under_review", "merged", "rejected"].includes(
      String(value.catalogue_status)
    )
  );
}

function isReminderPayload(
  value: unknown
): value is { seed_target_time: string | null; timezone: string | null } | null {
  return (
    value === null ||
    (isRecord(value) &&
      isNullableString(value.seed_target_time) &&
      isNullableString(value.timezone))
  );
}

export default async function EditSeedPage({
  params,
  searchParams,
}: EditSeedPageProps) {
  const [{ seedId }, query] = await Promise.all([params, searchParams]);
  const planted = Array.isArray(query.planted)
    ? query.planted[0] === "1"
    : query.planted === "1";

  if (!isValidUuid(seedId)) {
    notFound();
  }

  const editPath = `/seeds/${encodeURIComponent(seedId)}/edit`;
  const retryHref = planted ? `${editPath}?planted=1` : editPath;
  const unavailable = (
    <PageDataUnavailable
      title="Seed düzenleme bilgileri şu anda yüklenemedi"
      retryHref={retryHref}
      backHref="/seeds"
      backLabel="Seed'lere dön"
    />
  );
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Seed edit session query failed:", userError);
    return unavailable;
  }

  if (!user) {
    redirect("/");
  }

  const [seedResult, seedTypeResult, catalogueIdentityResult, reminderResult] =
    await Promise.all([
      supabase.rpc("get_my_seed_v2", {
        p_seed_id: seedId,
      }),
      supabase.rpc("get_active_seed_types"),
      supabase.rpc("get_my_seed_catalog_identity", {
        p_seed_id: seedId,
      }),
      supabase
        .from("user_resource_reminder_settings")
        .select("seed_target_time, timezone")
        .eq("resource_type", "seed")
        .eq("resource_id", seedId)
        .maybeSingle(),
    ]);

  const readError =
    seedResult.error ??
    seedTypeResult.error ??
    catalogueIdentityResult.error ??
    reminderResult.error;

  if (readError) {
    console.error("Seed edit queries failed:", {
      seed: seedResult.error,
      seedTypes: seedTypeResult.error,
      catalogueIdentity: catalogueIdentityResult.error,
      reminder: reminderResult.error,
    });
    return unavailable;
  }

  if (!Array.isArray(seedResult.data)) {
    console.error("Seed edit query returned an incomplete payload.");
    return unavailable;
  }

  if (seedResult.data.length === 0) {
    notFound();
  }

  if (seedResult.data.length !== 1 || !isSeedRecord(seedResult.data[0])) {
    console.error("Seed edit query returned a malformed Seed.");
    return unavailable;
  }

  const rawSeed = seedResult.data[0];
  if (rawSeed.seed_id !== seedId) {
    console.error("Seed edit query returned a mismatched Seed.");
    return unavailable;
  }

  if (
    !Array.isArray(seedTypeResult.data) ||
    seedTypeResult.data.length === 0 ||
    !seedTypeResult.data.every(isSeedTypeOption)
  ) {
    console.error("Seed Type query returned an incomplete payload.");
    return unavailable;
  }

  if (
    !Array.isArray(catalogueIdentityResult.data) ||
    catalogueIdentityResult.data.length > 1 ||
    !catalogueIdentityResult.data.every(isSeedCatalogueIdentity)
  ) {
    console.error("Seed catalogue identity query returned an incomplete payload.");
    return unavailable;
  }

  if (!isReminderPayload(reminderResult.data)) {
    console.error("Seed reminder query returned an incomplete payload.");
    return unavailable;
  }

  const seed = {
    ...rawSeed,
    links: parseSeedLinks(rawSeed.links),
  };
  const seedTypes = seedTypeResult.data;
  const catalogueIdentity =
    catalogueIdentityResult.data[0] ?? null;

  if (seed.status === "completed") {
    redirect(`/seeds/${encodeURIComponent(seed.seed_id)}?editExperience=1`);
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1450px]">
        <SeedForm
          seedTypes={seedTypes}
          seed={seed}
          catalogueIdentity={catalogueIdentity}
          reminderTargetTime={
            typeof reminderResult.data?.seed_target_time === "string"
              ? reminderResult.data.seed_target_time.slice(0, 5)
              : "09:00"
          }
          reminderTimezone={
            typeof reminderResult.data?.timezone === "string"
              ? reminderResult.data.timezone
              : "Europe/Istanbul"
          }
          notice={
            planted
              ? "Seed planted. The shared subject stays fixed; add only your personal context below."
              : null
          }
        />
      </div>
    </main>
  );
}
