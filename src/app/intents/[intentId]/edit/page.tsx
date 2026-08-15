import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import EditIntentForm from "../../../../components/intents/EditIntentForm";
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
  city: string;
  district: string;
};

type PlanIntentRow = {
  plan_id: string;
};

export default async function EditIntentPage({
  params,
}: EditIntentPageProps) {
  const { intentId } = await params;

  if (!intentId) {
    console.error(
      "Intent route parameter is missing."
    );

    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

    notFound();
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

  const currentUserGender =
    normalizeProfileGender(
      profileGenderResult.data?.gender
    );

  const hasAcceptedParticipants =
    (acceptedParticipantResult.count ?? 0) > 0;

  const categories = (
    categoryResult.data ?? []
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
    activityResult.data ?? []
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
    locationResult.data ?? []
  ).map((location) => {
    const typedLocation =
      location as LocationRow;

    return {
      id: String(
        typedLocation.id
      ),
      city:
        typedLocation.city,
      district:
        typedLocation.district,
    };
  });

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