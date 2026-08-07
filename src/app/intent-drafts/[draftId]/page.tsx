import {
  notFound,
  redirect,
} from "next/navigation";

import IntentDraftReview, {
  type IntentDraftDetail,
  type IntentDraftLocation,
} from "@/components/intents/IntentDraftReview";
import { createClient } from "@/utils/supabase/server";

type IntentDraftPageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function IntentDraftPage({
  params,
}: IntentDraftPageProps) {
  const {
    draftId,
  } = await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    draftResult,
    locationsResult,
  ] = await Promise.all([
    supabase.rpc(
      "get_my_intent_draft",
      {
        p_draft_id:
          draftId,
      }
    ),

    supabase
      .from("locations")
      .select(
        "id, city, district"
      )
      .order("city", {
        ascending: true,
      })
      .order("district", {
        ascending: true,
      }),
  ]);

  if (draftResult.error) {
    console.error(
      "Intent draft query failed:",
      draftResult.error
    );
  }

  if (locationsResult.error) {
    console.error(
      "Intent draft locations query failed:",
      locationsResult.error
    );
  }

  if (
    draftResult.error ||
    !draftResult.data
  ) {
    notFound();
  }

  const draft =
    draftResult.data as
      IntentDraftDetail;

  const locations =
    (
      locationsResult.data ??
      []
    ) as IntentDraftLocation[];

  return (
    <IntentDraftReview
      initialData={draft}
      locations={locations}
    />
  );
}
