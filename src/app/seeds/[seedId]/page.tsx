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

  const reactionContext =
    parseSeedReactionContexts(reactionResult.data)[0] ?? null;

  let subjectSnapshot: {
    item_kind: string;
    canonical_title: string;
    creator_name: string | null;
    release_year: number | null;
    metadata: Record<string, unknown>;
  } | null = null;

  const contextResult = await supabase.rpc(
    detail.seed.is_owner
      ? "get_my_seed_v17_context"
      : "get_visible_seed_v17_context",
    {
      p_seed_id: seedId,
    }
  );

  if (
    !contextResult.error &&
    contextResult.data &&
    typeof contextResult.data === "object"
  ) {
    const root = contextResult.data as Record<string, unknown>;

    const rawCatalog =
      root.catalog &&
      typeof root.catalog === "object" &&
      !Array.isArray(root.catalog)
        ? (root.catalog as Record<string, unknown>)
        : null;

    if (rawCatalog) {
      subjectSnapshot = {
        item_kind:
          typeof rawCatalog.item_kind === "string"
            ? rawCatalog.item_kind
            : "generic",

        canonical_title:
          typeof rawCatalog.title === "string"
            ? rawCatalog.title
            : detail.seed.title,

        creator_name:
          typeof rawCatalog.creator_name === "string"
            ? rawCatalog.creator_name
            : null,

        release_year:
          typeof rawCatalog.release_year === "number"
            ? rawCatalog.release_year
            : null,

        metadata:
          rawCatalog.metadata &&
          typeof rawCatalog.metadata === "object" &&
          !Array.isArray(rawCatalog.metadata)
            ? (rawCatalog.metadata as Record<string, unknown>)
            : {},
      };
    }
  }

  // Eski kayıtlar için katalog ID üzerinden fallback.
  if (!subjectSnapshot && detail.seed.catalog_item_id) {
    const { data: catalogDetail, error: catalogError } =
      await supabase.rpc("get_seed_catalog_detail", {
        p_catalog_item_id: detail.seed.catalog_item_id,
      });

    if (
      !catalogError &&
      catalogDetail &&
      typeof catalogDetail === "object"
    ) {
      const root = catalogDetail as Record<string, unknown>;

      const rawSubject =
        root.subject &&
        typeof root.subject === "object" &&
        !Array.isArray(root.subject)
          ? (root.subject as Record<string, unknown>)
          : null;

      if (rawSubject) {
        subjectSnapshot = {
          item_kind:
            typeof rawSubject.item_kind === "string"
              ? rawSubject.item_kind
              : "generic",

          canonical_title:
            typeof rawSubject.canonical_title === "string"
              ? rawSubject.canonical_title
              : detail.seed.title,

          creator_name:
            typeof rawSubject.creator_name === "string"
              ? rawSubject.creator_name
              : null,

          release_year:
            typeof rawSubject.release_year === "number"
              ? rawSubject.release_year
              : null,

          metadata:
            rawSubject.metadata &&
            typeof rawSubject.metadata === "object" &&
            !Array.isArray(rawSubject.metadata)
              ? (rawSubject.metadata as Record<string, unknown>)
              : {},
        };
      }
    }
  }
  return (
    <SeedDetailView
      detail={detail}
      subjectSnapshot={subjectSnapshot}
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
