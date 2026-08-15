import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

type IntentDraftListRow = {
  draft_id: string;
  draft_status:
    | "awaiting_activity_review"
    | "ready_to_publish"
    | "published"
    | "rejected"
    | "cancelled";
  proposed_activity_name: string;
  proposed_category_name: string | null;
  canonical_activity_name: string | null;
  canonical_category_name: string | null;
  review_note: string | null;
  start_date: string;
  end_date: string;
  city: string;
  district: string;
  created_at: string;
  updated_at: string;
};

function getStatusLabel(
  status: IntentDraftListRow["draft_status"]
) {
  if (
    status ===
    "awaiting_activity_review"
  ) {
    return "Awaiting review";
  }

  if (
    status ===
    "ready_to_publish"
  ) {
    return "Ready to publish";
  }

  if (status === "published") {
    return "Published";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Cancelled";
}

function getStatusClasses(
  status: IntentDraftListRow["draft_status"]
) {
  if (
    status ===
    "ready_to_publish"
  ) {
    return "bg-green-100 text-green-800";
  }

  if (
    status ===
    "awaiting_activity_review"
  ) {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "published") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-800";
  }

  return "bg-gray-100 text-gray-700";
}

export default async function IntentDraftsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_intent_drafts"
  );

  if (error) {
    console.error(
      "Intent drafts query failed:",
      error
    );
  }

  const drafts =
    (
      data ?? []
    ) as IntentDraftListRow[];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
                Activity Catalogue
              </p>

              <h1 className="mt-3 text-3xl font-bold text-gray-950">
                My Activity Requests
              </h1>

              <p className="mt-2 max-w-2xl text-gray-500">
                Track requested Activities,
                review the canonical
                classification and publish
                Intent drafts after approval.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Create New Intent
              </Link>

              <Link
                href="/timeline"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
              >
                <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Activity requests could not
              be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        )}

        {!error &&
          drafts.length === 0 && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              No Activity requests yet
            </h2>

            <p className="mt-3 text-gray-500">
              Requests appear here when an
              Activity is missing from the
              canonical catalogue.
            </p>
          </section>
        )}

        {!error &&
          drafts.length > 0 && (
          <section className="mt-6 space-y-4">
            {drafts.map(
              (draft) => (
                <Link
                  key={
                    draft.draft_id
                  }
                  href={`/intent-drafts/${encodeURIComponent(
                    draft.draft_id
                  )}`}
                  className="group block rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                        {draft
                          .canonical_activity_name
                          ? "Canonical Activity"
                          : "Requested Activity"}
                      </p>

                      <h2 className="mt-2 text-xl font-bold text-gray-950 transition group-hover:text-purple-800">
                        {draft
                          .canonical_activity_name ??
                          draft.proposed_activity_name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        {draft
                          .canonical_category_name ??
                          draft.proposed_category_name ??
                          "Category pending"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-4 py-2 text-xs font-semibold ${getStatusClasses(
                        draft.draft_status
                      )}`}
                    >
                      {getStatusLabel(
                        draft.draft_status
                      )}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                    <p>
                      Dates:{" "}
                      {
                        draft.start_date
                      }{" "}
                      →{" "}
                      {
                        draft.end_date
                      }
                    </p>

                    <p>
                      Area:{" "}
                      {
                        draft.district
                      }
                      ,{" "}
                      {
                        draft.city
                      }
                    </p>
                  </div>

                  {draft.review_note && (
                    <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                      {
                        draft.review_note
                      }
                    </p>
                  )}
                </Link>
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}
