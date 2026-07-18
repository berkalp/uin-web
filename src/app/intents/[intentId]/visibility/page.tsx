import Link from "next/link";
import { redirect } from "next/navigation";

import ActivityVisibilityManager from "@/components/visibility/ActivityVisibilityManager";
import {
  type ActivityVisibility,
} from "@/utils/activityVisibility";
import { createClient } from "@/utils/supabase/server";

type VisibilityPageProps = {
  params: Promise<{
    intentId: string;
  }>;
};

type VisibilityRow = {
  intent_id: string;
  plan_id: string | null;
  activity_name: string;
  category_name: string;
  current_visibility: ActivityVisibility;
  intent_status: string;
  plan_status: string | null;
  recruitment_status: string;
};

function isValidUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function loadVisibilitySettings(
  routeId: string
): Promise<{
  row: VisibilityRow | null;
  errorMessage: string | null;
}> {
  const supabase =
    await createClient();

  const directResponse =
    await supabase.rpc(
      "get_activity_visibility_settings",
      {
        p_intent_id:
          routeId,
      }
    );

  if (
    !directResponse.error &&
    Array.isArray(
      directResponse.data
    ) &&
    directResponse.data.length >
      0
  ) {
    return {
      row:
        directResponse
          .data[0] as VisibilityRow,

      errorMessage:
        null,
    };
  }

  const {
    data: linkedIntent,
    error: linkedIntentError,
  } = await supabase
    .from("plan_intents")
    .select(
      "intent_id"
    )
    .eq(
      "plan_id",
      routeId
    )
    .eq(
      "status",
      "active"
    )
    .limit(1)
    .maybeSingle();

  if (
    !linkedIntentError &&
    linkedIntent?.intent_id
  ) {
    const linkedResponse =
      await supabase.rpc(
        "get_activity_visibility_settings",
        {
          p_intent_id:
            linkedIntent.intent_id,
        }
      );

    if (
      !linkedResponse.error &&
      Array.isArray(
        linkedResponse.data
      ) &&
      linkedResponse.data.length >
        0
    ) {
      return {
        row:
          linkedResponse
            .data[0] as VisibilityRow,

        errorMessage:
          null,
      };
    }

    return {
      row:
        null,

      errorMessage:
        linkedResponse.error
          ?.message ??
        "Visibility settings could not be loaded for the linked Intent.",
    };
  }

  return {
    row:
      null,

    errorMessage:
      directResponse.error
        ?.message ??
      linkedIntentError
        ?.message ??
      "No editable Intent or Shared Plan was found for this address.",
  };
}

export default async function VisibilityPage({
  params,
}: VisibilityPageProps) {
  const {
    intentId: routeId,
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

  if (
    !routeId ||
    !isValidUuid(routeId)
  ) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Invalid Address
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-950">
              This visibility address is not valid
            </h1>

            <p className="mt-3 text-sm leading-7 text-gray-600">
              Return to the Timeline and
              open Manage Visibility from
              the Activity card again.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const {
    row,
    errorMessage,
  } =
    await loadVisibilitySettings(
      routeId
    );

  if (!row) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <section className="mt-8 rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Visibility Unavailable
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-950">
              Activity visibility could not be opened
            </h1>

            <p className="mt-3 text-sm leading-7 text-gray-600">
              The address exists, but no
              editable source Intent could
              be resolved for this
              Activity.
            </p>

            {errorMessage && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {errorMessage}
                </p>
              </div>
            )}

            <Link
              href="/timeline"
              className="mt-6 inline-flex rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Return to Timeline
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          {row.plan_id && (
            <Link
              href={`/plans/${encodeURIComponent(
                row.plan_id
              )}/planning`}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
            >
              Open Planning Room
            </Link>
          )}
        </div>

        <header className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            {row.category_name}
          </p>

          <h1 className="mt-2 text-2xl font-bold text-gray-950">
            {row.activity_name}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
              Intent:{" "}
              {
                row.intent_status
              }
            </span>

            {row.plan_status && (
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold capitalize text-purple-700">
                Plan:{" "}
                {
                  row.plan_status
                }
              </span>
            )}

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
              Recruitment:{" "}
              {
                row.recruitment_status
              }
            </span>
          </div>
        </header>

        <div className="mt-6">
          <ActivityVisibilityManager
            intentId={
              row.intent_id
            }
            initialVisibility={
              row.current_visibility
            }
            canEdit
          />
        </div>
      </div>
    </main>
  );
}
