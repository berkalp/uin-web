import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import IntentForm from "@/components/onboarding/IntentForm";
import type { SeedGrowthCandidate, SeedGrowthContext } from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";

type OnboardingSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type CommonTargetContext = {
  target_id: string;
  title: string;
  category_id: string | null;
  activity_id: string | null;
  sport_id: string | null;
  community_id: string | null;
};

function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

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

function isCommonTargetContext(value: unknown): value is CommonTargetContext {
  if (!isRecord(value)) return false;

  return (
    typeof value.target_id === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.category_id) &&
    isNullableString(value.activity_id) &&
    isNullableString(value.sport_id) &&
    isNullableString(value.community_id)
  );
}

function isSeedGrowthContext(value: unknown): value is SeedGrowthContext {
  if (!isRecord(value)) return false;

  return (
    typeof value.seed_id === "string" &&
    typeof value.seed_title === "string" &&
    isNullableString(value.seed_notes) &&
    isNullableString(value.seed_external_url) &&
    typeof value.seed_type_id === "string" &&
    typeof value.seed_type_name === "string" &&
    typeof value.seed_type_icon === "string" &&
    (value.seed_scope === "library" || value.seed_scope === "private") &&
    isNullableString(value.catalog_item_id) &&
    isNullableString(value.suggested_activity_id) &&
    isNullableString(value.suggested_activity_name) &&
    isNullableString(value.suggested_category_id) &&
    isNullableString(value.suggested_category_name)
  );
}

function isSeedGrowthCandidate(value: unknown): value is SeedGrowthCandidate {
  if (!isRecord(value)) return false;

  return (
    typeof value.seed_id === "string" &&
    typeof value.seed_title === "string" &&
    typeof value.seed_type_name === "string" &&
    typeof value.seed_type_icon === "string" &&
    (value.seed_scope === "library" || value.seed_scope === "private") &&
    isNullableString(value.catalog_item_id) &&
    typeof value.is_primary === "boolean"
  );
}

function getRetryHref(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const suffix = query.toString();
  return suffix ? `/onboarding?${suffix}` : "/onboarding";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: OnboardingSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedSeedId = getParam(resolvedSearchParams, "seed");
  const requestedTargetId = getParam(resolvedSearchParams, "target");
  const retryHref = getRetryHref(resolvedSearchParams);
  const shouldLoadTarget = Boolean(
    requestedTargetId && isValidUuid(requestedTargetId),
  );
  const shouldLoadSeed = Boolean(
    requestedSeedId && isValidUuid(requestedSeedId),
  );

  if (
    (requestedTargetId && !shouldLoadTarget) ||
    (requestedSeedId && !shouldLoadSeed)
  ) {
    notFound();
  }
  const supabase =
    shouldLoadTarget || shouldLoadSeed ? await createClient() : null;
  const unavailable = (
    <PageDataUnavailable
      title="Niyet başlangıç bilgileri şu anda yüklenemedi"
      retryHref={retryHref}
      backHref="/ideas"
      backLabel="Kütüphaneye dön"
    />
  );

  let seedContext: SeedGrowthContext | null = null;
  let seedCandidates: SeedGrowthCandidate[] = [];
  let targetContext: CommonTargetContext | null = null;

  if (shouldLoadTarget && supabase) {
    const result = await supabase.rpc("get_common_target_create_context_v38", {
      p_target_id: requestedTargetId,
    });

    if (result.error) {
      console.error("Common target create context query failed:", result.error);
      return unavailable;
    }

    if (result.data === null) notFound();
    if (!isCommonTargetContext(result.data)) {
      console.error("Common target create context returned a malformed payload.");
      return unavailable;
    }

    targetContext = result.data;
    if (
      targetContext.target_id !== requestedTargetId ||
      !targetContext.title.trim()
    ) return unavailable;
  }

  if (shouldLoadSeed && supabase) {
    const [contextResult, candidatesResult] = await Promise.all([
      supabase.rpc("get_my_seed_growth_context", { p_seed_id: requestedSeedId }),
      supabase.rpc("get_my_seed_growth_candidates", { p_primary_seed_id: requestedSeedId }),
    ]);

    if (contextResult.error || candidatesResult.error) {
      console.error("Seed growth context queries failed:", {
        context: contextResult.error,
        candidates: candidatesResult.error,
      });
      return unavailable;
    }

    if (
      !Array.isArray(contextResult.data) ||
      !Array.isArray(candidatesResult.data)
    ) {
      console.error("Seed growth context queries returned an incomplete payload.");
      return unavailable;
    }

    if (contextResult.data.length === 0) notFound();
    if (
      contextResult.data.length !== 1 ||
      !contextResult.data.every(isSeedGrowthContext) ||
      !candidatesResult.data.every(isSeedGrowthCandidate)
    ) {
      console.error("Seed growth context queries returned malformed rows.");
      return unavailable;
    }

    seedContext = contextResult.data[0];
    seedCandidates = candidatesResult.data;
    if (
      seedContext.seed_id !== requestedSeedId ||
      !seedContext.seed_title.trim()
    ) return unavailable;
  }

  return (
    <IntentForm
      initialCategoryId={
        targetContext?.category_id || seedContext?.suggested_category_id ||
        getParam(resolvedSearchParams, "category")
      }
      initialActivityId={targetContext?.activity_id || seedContext?.suggested_activity_id || ""}
      initialSportId={targetContext?.sport_id || ""}
      initialCommunityId={targetContext?.community_id || getParam(resolvedSearchParams, "community")}
      initialNotes={seedContext?.seed_notes || ""}
      sourceSeed={seedContext}
      sourceSeedCandidates={seedCandidates}
      commonTargetId={targetContext?.target_id || ""}
      commonTargetTitle={targetContext?.title || ""}
    />
  );
}
