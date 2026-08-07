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
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default async function SeedDetailPage({
  params,
}: SeedDetailPageProps) {
  const { seedId } = await params;

  if (!isValidUuid(seedId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [detailResult, reactionResult] = await Promise.all([
    supabase.rpc("get_visible_seed_detail", {
      p_seed_id: seedId,
    }),
    supabase.rpc("get_visible_seed_reaction_context", {
      p_seed_ids: [seedId],
    }),
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
    />
  );
}
