import IntentForm from "@/components/onboarding/IntentForm";
import type { SeedGrowthCandidate, SeedGrowthContext } from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: OnboardingSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedSeedId = getParam(resolvedSearchParams, "seed");
  const requestedTargetId = getParam(resolvedSearchParams, "target");

  let seedContext: SeedGrowthContext | null = null;
  let seedCandidates: SeedGrowthCandidate[] = [];
  let targetContext: CommonTargetContext | null = null;

  if (requestedTargetId && isValidUuid(requestedTargetId)) {
    const supabase = await createClient();
    const result = await supabase.rpc("get_common_target_create_context_v38", { p_target_id: requestedTargetId });
    if (!result.error) targetContext = result.data as CommonTargetContext | null;
  }

  if (requestedSeedId && isValidUuid(requestedSeedId)) {
    const supabase = await createClient();
    const [contextResult, candidatesResult] = await Promise.all([
      supabase.rpc("get_my_seed_growth_context", { p_seed_id: requestedSeedId }),
      supabase.rpc("get_my_seed_growth_candidates", { p_primary_seed_id: requestedSeedId }),
    ]);

    if (contextResult.error) {
      console.warn("Seed growth context could not be loaded:", contextResult.error.message);
    } else {
      seedContext = ((contextResult.data ?? []) as SeedGrowthContext[])[0] ?? null;
    }

    if (candidatesResult.error) {
      console.warn("Seed growth candidates could not be loaded:", candidatesResult.error.message);
    } else {
      seedCandidates = (candidatesResult.data ?? []) as SeedGrowthCandidate[];
    }
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
