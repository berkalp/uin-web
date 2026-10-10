import {
  notFound,
  redirect,
} from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import IntentDraftReview, {
  type IntentDraftDetail,
} from "@/components/intents/IntentDraftReview";
import { createClient } from "@/utils/supabase/server";

type IntentDraftPageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIntentDraftDetail(value: unknown): value is IntentDraftDetail {
  return isRecord(value) &&
    isRecord(value.draft) &&
    typeof value.draft.id === "string" &&
    typeof value.draft.start_date === "string" &&
    typeof value.draft.end_date === "string" &&
    isRecord(value.suggestion) &&
    typeof value.suggestion.id === "string" &&
    isRecord(value.location) &&
    typeof value.location.id === "string";
}

type IntentDraftLocationRow = {
  id: string;
  city: string | null;
  district: string | null;
};

function isIntentDraftLocation(value: unknown): value is IntentDraftLocationRow {
  return isRecord(value) &&
    typeof value.id === "string" &&
    (value.city === null || typeof value.city === "string") &&
    (value.district === null || typeof value.district === "string");
}

export default async function IntentDraftPage({
  params,
}: IntentDraftPageProps) {
  const {
    draftId,
  } = await params;

  if (!isValidUuid(draftId)) {
    notFound();
  }

  const retryHref = `/intent-drafts/${encodeURIComponent(draftId)}`;
  const unavailable = (
    <PageDataUnavailable
      title="Aktivite isteği şu anda yüklenemedi"
      retryHref={retryHref}
      backHref="/intent-drafts"
      backLabel="Aktivite isteklerine dön"
    />
  );

  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Intent draft session query failed:", userError);
    return unavailable;
  }

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

  if (draftResult.error || locationsResult.error) {
    return unavailable;
  }

  if (draftResult.data === null) {
    notFound();
  }

  if (
    !isIntentDraftDetail(draftResult.data) ||
    !Array.isArray(locationsResult.data) ||
    !locationsResult.data.every(isIntentDraftLocation)
  ) {
    console.error("Intent draft queries returned malformed payloads.");
    return unavailable;
  }

  const draft = draftResult.data;
  const locations = locationsResult.data.map((location) => ({
    id: location.id,
    city: location.city ?? "",
    district: location.district ?? "",
  }));

  return (
    <IntentDraftReview
      initialData={draft}
      locations={locations}
    />
  );
}
