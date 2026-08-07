import { notFound, redirect } from "next/navigation";

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
  catalogue_status: "active" | "pending" | "merged" | "rejected";
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [seedResult, seedTypeResult, catalogueIdentityResult] =
    await Promise.all([
      supabase.rpc("get_my_seed_v2", {
        p_seed_id: seedId,
      }),
      supabase.rpc("get_active_seed_types"),
      supabase.rpc("get_my_seed_catalog_identity", {
        p_seed_id: seedId,
      }),
    ]);

  if (seedResult.error) {
    console.error("Seed edit query failed:", seedResult.error);
  }

  if (seedTypeResult.error) {
    console.error("Seed Type query failed:", seedTypeResult.error);
  }

  if (catalogueIdentityResult.error) {
    console.error(
      "Seed catalogue identity query failed:",
      catalogueIdentityResult.error
    );
  }

  const rawSeed = ((seedResult.data ?? []) as SeedRecord[])[0] ?? null;
  const seed = rawSeed
    ? {
        ...rawSeed,
        links: parseSeedLinks(rawSeed.links),
      }
    : null;
  const seedTypes = (seedTypeResult.data ?? []) as SeedTypeOption[];
  const catalogueIdentity =
    ((catalogueIdentityResult.data ?? []) as SeedCatalogueIdentity[])[0] ??
    null;

  if (!seed) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1450px]">
        <SeedForm
          seedTypes={seedTypes}
          seed={seed}
          catalogueIdentity={catalogueIdentity}
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
