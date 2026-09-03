import { notFound } from "next/navigation";

import SeedDetailView from "@/components/seeds/SeedDetailView";
import {
  parseSeedDetailData,
  parseSeedReactionContexts,
} from "@/utils/seeds";
import { createClient } from "@/utils/supabase/server";

type SeedDetailPageProps = {
  params: Promise<{
    seedId: string;
  }>;
  searchParams: Promise<{ editExperience?: string | string[] }>;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default async function SeedDetailPage({
  params,
  searchParams,
}: SeedDetailPageProps) {
  const [{ seedId }, query] = await Promise.all([params, searchParams]);

  if (!isValidUuid(seedId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [detailResult, reactionResult, reminderResult] = await Promise.all([
    supabase.rpc("get_visible_seed_detail", {
      p_seed_id: seedId,
    }),
    supabase.rpc("get_visible_seed_reaction_context", {
      p_seed_ids: [seedId],
    }),
    user
      ? supabase
          .from("user_resource_reminder_settings")
          .select("seed_target_time, timezone")
          .eq("resource_type", "seed")
          .eq("resource_id", seedId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (detailResult.error) {
    console.error("Seed detail query failed:", detailResult.error);
  }

  const detail = parseSeedDetailData(detailResult.data);

  if (!detail) {
    notFound();
  }

  if (reactionResult.error) {
    console.warn(
      "Seed reaction context is temporarily unavailable:",
      reactionResult.error.message
    );
  }

  const reactionContext = parseSeedReactionContexts(
    reactionResult.data
  )[0] ?? null;

  return (
    <SeedDetailView
      detail={detail}
      reactionContext={reactionContext}
      isAuthenticated={Boolean(user)}
      reminderTargetTime={
        detail.seed.is_owner && typeof reminderResult.data?.seed_target_time === "string"
          ? reminderResult.data.seed_target_time.slice(0, 5)
          : null
      }
      reminderTimezone={
        detail.seed.is_owner && typeof reminderResult.data?.timezone === "string"
          ? reminderResult.data.timezone
          : null
      }
      editExperience={(Array.isArray(query.editExperience) ? query.editExperience[0] : query.editExperience) === "1"}
    />
  );
}
