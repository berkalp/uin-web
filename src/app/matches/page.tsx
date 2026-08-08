import Link from "next/link";
import { redirect } from "next/navigation";

import MatchOpportunityActions from "@/components/matches/MatchOpportunityActions";
import { createClient } from "@/utils/supabase/server";

type ActiveMatchRow = {
  own_intent_id: string;
  own_start_date: string;
  own_end_date: string;
  target_intent_id: string;
  target_user_id: string;
  target_full_name: string | null;
  target_username: string;
  target_avatar_url: string | null;
  activity_name: string;
  category_name: string;
  city: string;
  district: string;
  target_start_date: string;
  target_end_date: string;
  target_people: string;
  target_budget:
    | number
    | string
    | null;
  target_recurrence: string;
  target_visibility: string;
  target_notes: string | null;
  target_max_participants: number | null;
  target_created_at: string;
};

function formatDate(
  value: string
) {
  const date =
    new Date(
      `${value}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function getInitial(
  value: string
) {
  return (
    value
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

export default async function MatchesPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { error: lineageReconcileError } = await supabase.rpc(
    "reconcile_my_intent_plan_lineage"
  );

  if (lineageReconcileError) {
    console.warn(
      "Intent/Plan lineage reconciliation failed:",
      lineageReconcileError.message
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_active_matches"
  );

  if (error) {
    console.error(
      "Active Match query failed:",
      error
    );
  }

  const matches =
    (
      data ??
      []
    ) as ActiveMatchRow[];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/timeline"
              className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
            >
              ← Back to Timeline
            </Link>

            <Link
              href="/discover"
              className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
            >
              Discover Intents
            </Link>
          </div>

          <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
            {matches.length} active
          </span>
        </div>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            Match Opportunities
          </p>

          <h1 className="mt-3 text-4xl font-bold text-gray-950">
            Matches
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            The counter remains active
            until you Ignore the
            opportunity, send a Request,
            form a Shared Plan or the
            underlying Intents stop
            matching.
          </p>
        </header>

        {error ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h2 className="font-bold text-red-900">
              Matches could not be loaded
            </h2>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        ) : matches.length >
          0 ? (
          <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {matches.map(
              (match) => {
                const targetName =
                  match.target_full_name ||
                  match.target_username;

                return (
                  <article
                    key={`${match.own_intent_id}-${match.target_intent_id}`}
                    className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                          {
                            match.category_name
                          }
                        </p>

                        <h2 className="mt-2 text-2xl font-bold text-gray-950">
                          {
                            match.activity_name
                          }
                        </h2>
                      </div>

                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        Active Match
                      </span>
                    </div>

                    <Link
                      href={`/u/${encodeURIComponent(
                        match.target_username
                      )}`}
                      className="mt-5 flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:bg-gray-100"
                    >
                      {match.target_avatar_url ? (
                        <img
                          src={
                            match.target_avatar_url
                          }
                          alt={
                            targetName
                          }
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-bold text-green-700">
                          {getInitial(
                            targetName
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-950">
                          {targetName}
                        </p>

                        <p className="mt-1 truncate text-sm text-gray-500">
                          @
                          {
                            match.target_username
                          }
                        </p>
                      </div>

                      <span className="text-gray-300">
                        →
                      </span>
                    </Link>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Their dates
                        </p>

                        <p className="mt-2 text-sm font-bold text-gray-950">
                          {formatDate(
                            match.target_start_date
                          )}
                          {" → "}
                          {formatDate(
                            match.target_end_date
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Your dates
                        </p>

                        <p className="mt-2 text-sm font-bold text-gray-950">
                          {formatDate(
                            match.own_start_date
                          )}
                          {" → "}
                          {formatDate(
                            match.own_end_date
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Location
                        </p>

                        <p className="mt-2 text-sm font-bold text-gray-950">
                          {
                            match.district
                          }
                          ,{" "}
                          {
                            match.city
                          }
                        </p>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Capacity
                        </p>

                        <p className="mt-2 text-sm font-bold text-gray-950">
                          {match.target_max_participants ===
                          null
                            ? "Unlimited"
                            : match.target_max_participants}
                        </p>
                      </div>
                    </div>

                    {match.target_notes && (
                      <p className="mt-5 line-clamp-3 text-sm leading-7 text-gray-600">
                        {
                          match.target_notes
                        }
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/activities/${encodeURIComponent(
                          match.target_intent_id
                        )}`}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                      >
                        View Activity
                      </Link>
                    </div>

                    <MatchOpportunityActions
                      ownIntentId={
                        match.own_intent_id
                      }
                      targetIntentId={
                        match.target_intent_id
                      }
                    />
                  </article>
                );
              }
            )}
          </section>
        ) : (
          <section className="mt-8 rounded-[28px] border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              No active Match opportunities
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-500">
              New compatible Intents will
              appear here automatically.
              Opening this page never
              changes the counter.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
