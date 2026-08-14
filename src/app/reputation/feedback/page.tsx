import Link from "next/link";
import { redirect } from "next/navigation";

import type {
  PendingReputationFeedback,
} from "@/utils/reputation";
import {
  createClient,
} from "@/utils/supabase/server";

type ReputationFeedbackPageProps = {
  searchParams: Promise<{
    submitted?: string;
  }>;
};

function getInitial(
  value: string
) {
  return (
    value.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }
  ).format(new Date(value));
}

export default async function ReputationFeedbackPage({
  searchParams,
}: ReputationFeedbackPageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_pending_reputation_feedback"
  );

  if (error) {
    console.error(
      "Pending reputation feedback query failed:",
      error
    );
  }

  const items =
    (data ?? []) as PendingReputationFeedback[];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline?view=action_required"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Action Required
          </Link>

          <Link
            href="/timeline"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            Timeline
          </Link>
        </div>

        <header className="mt-6 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Reputation
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-950">
            Activity feedback
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
            Feedback is contextual. A person can be excellent in Family Picnic and difficult in Basketball; UIN does not flatten those into one careless star rating.
          </p>
        </header>

        {params.submitted === "1" && (
          <section className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-5">
            <p className="font-bold text-green-950">
              Feedback submitted.
            </p>

            <p className="mt-2 text-sm text-green-800">
              The response keeps the question version and Activity context that were active at submission time.
            </p>
          </section>
        )}

        {error && (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-900">
              Feedback tasks could not be loaded.
            </p>
            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        )}

        {!error && items.length === 0 && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              No feedback tasks
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-500">
              Completed shared Activities with eligible people will appear here for seven days.
            </p>
          </section>
        )}

        {!error && items.length > 0 && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const targetName =
                item.target_full_name ||
                item.target_username;

              return (
                <article
                  key={`${item.plan_id}-${item.target_user_id}`}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    {item.target_avatar_url ? (
                      <img
                        src={item.target_avatar_url}
                        alt={targetName}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-lg font-bold text-purple-800">
                        {getInitial(targetName)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-gray-950">
                        {targetName}
                      </p>

                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
                        {item.target_role}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                    <p className="font-bold text-gray-950">
                      {item.plan_title}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {item.category_name} · {item.activity_name}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      Feedback closes {formatDateTime(item.feedback_deadline)}
                    </p>
                  </div>

                  <Link
                    href={`/reputation/feedback/${encodeURIComponent(
                      item.plan_id
                    )}/${encodeURIComponent(
                      item.target_user_id
                    )}?returnTo=${encodeURIComponent(
                      "/reputation/feedback?submitted=1"
                    )}`}
                    className="mt-5 block rounded-xl bg-purple-700 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-purple-800"
                  >
                    Give contextual feedback
                  </Link>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
