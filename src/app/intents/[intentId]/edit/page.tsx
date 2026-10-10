import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "../../../../components/common/PageDataUnavailable";
import EditIntentForm from "../../../../components/intents/EditIntentForm";
import SportFixtureEditor from "../../../../components/intents/SportFixtureEditor";
import type { SportFixtureOption } from "../../../../components/activities/SportActivityPlanningHero";
import { createClient } from "../../../../utils/supabase/server";
import {
  normalizeParticipantEligibility,
  normalizeProfileGender,
} from "../../../../utils/participationEligibility";

type EditIntentPageProps = {
  params: Promise<{
    intentId: string;
  }>;
};

type IntentRow = {
  id: string;
  user_id: string;
  activity_id: string | number;
  location_id: string | number;
  start_date: string;
  end_date: string;
  people: string;
  recurrence: string;
  visibility: string;
  budget: number | null;
  max_participants: number | null;
  participant_eligibility: "everyone" | "women_only" | "men_only";
  join_message_mode: "none" | "optional" | "required";
  join_message_prompt: string | null;
  notes: string | null;
  status: string;
  timing_mode: string;
};

type CategoryRow = {
  id: string | number;
  name: string;
};

type ActivityRow = {
  id: string | number;
  category_id: string | number;
  name: string;
};

type LocationRow = {
  id: string | number;
  city: string | null;
  district: string | null;
};

type PlanIntentRow = {
  plan_id: string;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCategoryRow(value: unknown): value is CategoryRow {
  return isRecord(value) &&
    (typeof value.id === "string" || typeof value.id === "number") &&
    typeof value.name === "string";
}

function isActivityRow(value: unknown): value is ActivityRow {
  return isRecord(value) &&
    (typeof value.id === "string" || typeof value.id === "number") &&
    (typeof value.category_id === "string" || typeof value.category_id === "number") &&
    typeof value.name === "string";
}

function isLocationRow(value: unknown): value is LocationRow {
  return isRecord(value) &&
    (typeof value.id === "string" || typeof value.id === "number") &&
    (value.city === null || typeof value.city === "string") &&
    (value.district === null || typeof value.district === "string");
}

function isSportFixtureOption(value: unknown): value is SportFixtureOption {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.match_name === "string" &&
    typeof value.match_date === "string" &&
    (value.venue === null || typeof value.venue === "string") &&
    typeof value.selected === "boolean";
}

export default async function EditIntentPage({
  params,
}: EditIntentPageProps) {
  const { intentId } = await params;

  if (!intentId || !isValidUuid(intentId)) {
    console.error(
      "Intent route parameter is missing."
    );

    notFound();
  }

  const retryHref = `/intents/${encodeURIComponent(intentId)}/edit`;
  const unavailable = (
    <PageDataUnavailable
      title="Niyet düzenleme bilgileri şu anda yüklenemedi"
      retryHref={retryHref}
      backHref="/timeline"
      backLabel="Niyetlere dön"
    />
  );

  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Intent edit session query failed:", userError);
    return unavailable;
  }

  if (!user) {
    redirect("/");
  }

  const {
    data: intentData,
    error: intentError,
  } = await supabase
    .from("intents")
    .select(`
      id,
      user_id,
      activity_id,
      location_id,
      start_date,
      end_date,
      people,
      recurrence,
      visibility,
      budget,
      max_participants,
      participant_eligibility,
      join_message_mode,
      join_message_prompt,
      notes,
      status,
      timing_mode
    `)
    .eq("id", intentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (intentError) {
    console.error(
      "Intent edit query failed:",
      {
        message: intentError.message,
        code: intentError.code,
        details: intentError.details,
        hint: intentError.hint,
      }
    );

    return unavailable;
  }

  if (!intentData) {
    notFound();
  }

  const intent =
    intentData as IntentRow;

  const {
    data: linkedPlanData,
    error: linkedPlanError,
  } = await supabase
    .from("plan_intents")
    .select("plan_id")
    .eq("intent_id", intent.id)
    .eq("status", "active")
    .maybeSingle();

  if (linkedPlanError) {
    console.error(
      "Linked Plan query failed:",
      {
        message:
          linkedPlanError.message,
        code:
          linkedPlanError.code,
        details:
          linkedPlanError.details,
        hint:
          linkedPlanError.hint,
      }
    );
    return unavailable;
  }

  const linkedPlan =
    linkedPlanData as PlanIntentRow | null;

  if (linkedPlan) {
    redirect(
      `/plans/${encodeURIComponent(
        linkedPlan.plan_id
      )}`
    );
  }

  if (intent.status !== "active") {
    redirect("/timeline");
  }

  const [
    categoryResult,
    activityResult,
    locationResult,
  ] = await Promise.all([
    supabase
      .from("activity_categories")
      .select("id, name")
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("activities")
      .select(`
        id,
        category_id,
        name
      `)
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("locations")
      .select(`
        id,
        city,
        district
      `)
      .order("city", {
        ascending: true,
      })
      .order("district", {
        ascending: true,
      }),
  ]);

  if (categoryResult.error) {
    console.error(
      "Categories query failed:",
      categoryResult.error
    );
  }

  if (activityResult.error) {
    console.error(
      "Activities query failed:",
      activityResult.error
    );
  }

  if (locationResult.error) {
    console.error(
      "Locations query failed:",
      locationResult.error
    );
  }

  if (
    categoryResult.error ||
    activityResult.error ||
    locationResult.error ||
    !Array.isArray(categoryResult.data) ||
    !categoryResult.data.every(isCategoryRow) ||
    !Array.isArray(activityResult.data) ||
    !activityResult.data.every(isActivityRow) ||
    !Array.isArray(locationResult.data) ||
    !locationResult.data.every(isLocationRow)
  ) {
    console.error("Intent edit option queries failed or returned malformed payloads.");
    return unavailable;
  }

  const [
    profileGenderResult,
    acceptedParticipantResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("gender")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("intent_participants")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("intent_id", intent.id)
      .neq("user_id", user.id),
  ]);

  if (profileGenderResult.error) {
    console.error(
      "Profile gender query failed:",
      profileGenderResult.error
    );
  }

  if (acceptedParticipantResult.error) {
    console.error(
      "Intent participant count query failed:",
      acceptedParticipantResult.error
    );
  }

  if (
    profileGenderResult.error ||
    acceptedParticipantResult.error ||
    typeof acceptedParticipantResult.count !== "number" ||
    !Number.isInteger(acceptedParticipantResult.count) ||
    acceptedParticipantResult.count < 0
  ) {
    console.error("Intent edit eligibility queries failed or returned malformed payloads.");
    return unavailable;
  }

  const currentUserGender =
    normalizeProfileGender(
      profileGenderResult.data?.gender
    );

  const hasAcceptedParticipants = acceptedParticipantResult.count > 0;

  const categories = (
    categoryResult.data
  ).map((category) => {
    const typedCategory =
      category as CategoryRow;

    return {
      id: String(
        typedCategory.id
      ),
      name:
        typedCategory.name,
    };
  });

  const activities = (
    activityResult.data
  ).map((activity) => {
    const typedActivity =
      activity as ActivityRow;

    return {
      id: String(
        typedActivity.id
      ),
      categoryId: String(
        typedActivity.category_id
      ),
      name:
        typedActivity.name,
    };
  });

  const locations = (
    locationResult.data
  ).map((location) => {
    const typedLocation =
      location as LocationRow;

    return {
      id: String(
        typedLocation.id
      ),
      city:
        typedLocation.city ?? "",
      district:
        typedLocation.district ?? "",
    };
  });

  const currentActivityName =
    activities.find((activity) => activity.id === String(intent.activity_id))?.name ?? "";
  const isLiveSportIntent =
    currentActivityName.toLocaleLowerCase("tr-TR").includes("spor") &&
    currentActivityName.toLocaleLowerCase("tr-TR").includes("yerinde");
  const fixtureResult = isLiveSportIntent
    ? await supabase.rpc("get_intent_match_options_v50", {
        p_intent_id: intent.id,
      })
    : { data: [], error: null };
  if (
    fixtureResult.error ||
    !Array.isArray(fixtureResult.data) ||
    !fixtureResult.data.every(isSportFixtureOption)
  ) {
    console.error("Intent fixture query failed or returned a malformed payload.");
    return unavailable;
  }
  const fixtures = fixtureResult.data;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/timeline"
            className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="border-b border-gray-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
              Edit Intent
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Update your Intent
            </h1>

            <p className="mt-3 text-gray-500">
              Changes are immediately
              reflected in matching results
              and pending requests.
            </p>
          </div>

          <div className="mt-7">
            {isLiveSportIntent && (
              <SportFixtureEditor intentId={intent.id} fixtures={fixtures} />
            )}
            <EditIntentForm
              intent={{
                id:
                  intent.id,
                activityId: String(
                  intent.activity_id
                ),
                locationId: String(
                  intent.location_id
                ),
                startDate:
                  intent.start_date,
                endDate:
                  intent.end_date,
                people:
                  intent.people,
                recurrence:
                  intent.recurrence,
                visibility:
                  intent.visibility,
                budget:
                  intent.budget,
                maxParticipants:
                  intent.max_participants,
                participantEligibility:
                  normalizeParticipantEligibility(
                    intent.participant_eligibility
                  ),
                joinMessageMode:
                  intent.join_message_mode ??
                  "optional",
                joinMessagePrompt:
                  intent.join_message_prompt,
                notes:
                  intent.notes,
              }}
              categories={categories}
              activities={activities}
              locations={locations}
              currentUserGender={
                currentUserGender
              }
              hasAcceptedParticipants={
                hasAcceptedParticipants
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}
