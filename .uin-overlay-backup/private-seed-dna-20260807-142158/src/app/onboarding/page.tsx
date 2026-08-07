import IntentForm from "@/components/onboarding/IntentForm";
import type { SeedGrowthContext } from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

type OnboardingSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

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

  let seedContext: SeedGrowthContext | null = null;

  if (requestedSeedId && isValidUuid(requestedSeedId)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_my_seed_growth_context",
      {
        p_seed_id: requestedSeedId,
      }
    );

    if (error) {
      console.warn("Seed growth context could not be loaded:", error.message);
    } else {
      seedContext = ((data ?? []) as SeedGrowthContext[])[0] ?? null;
    }
  }

  return (
    <IntentForm
      initialCategoryId={
        seedContext?.suggested_category_id ||
        getParam(resolvedSearchParams, "category")
      }
      initialActivityId={seedContext?.suggested_activity_id || ""}
      initialCommunityId={getParam(resolvedSearchParams, "community")}
      initialNotes={seedContext?.seed_notes || ""}
      sourceSeed={seedContext}
    />
  );
}
