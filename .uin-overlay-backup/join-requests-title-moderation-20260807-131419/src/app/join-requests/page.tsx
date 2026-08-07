import Link from "next/link";
import { redirect } from "next/navigation";

import JoinRequestActions from "@/components/intents/JoinRequestActions";
import { createClient } from "@/utils/supabase/server";

type JoinRequestRow = {
  request_id: string;
  direction:
    | "received"
    | "sent";
  request_status:
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn";
  request_message: string | null;
  request_prompt: string | null;
  response_reason: string | null;
  request_created_at: string;
  request_responded_at: string | null;

  intent_id: string;
  plan_id: string | null;
  activity_name: string;
  category_name: string;
  city: string;
  district: string;
  start_date: string;
  end_date: string;

  other_user_id: string;
  other_user_full_name: string | null;
  other_user_username: string | null;
  other_user_avatar_url: string | null;
};


type JoinRequestPromptRow = {
  request_id: string;
  prompt_snapshot: string | null;
};

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

function getStatusClasses(
  status: JoinRequestRow["request_status"]
) {
  if (status === "accepted") {
    return "bg-green-50 text-green-700";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "declined") {
    return "bg-red-50 text-red-700";
  }

  return "bg-gray-100 text-gray-600";
}

export default async function JoinRequestsPage() {
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
    requestResponse,
    promptResponse,
  ] = await Promise.all([
    supabase.rpc(
      "get_my_intent_join_requests"
    ),
    supabase.rpc(
      "get_my_intent_join_request_prompt_snapshots"
    ),
  ]);

  const promptRows =
    (promptResponse.data ?? []) as JoinRequestPromptRow[];

  const promptByRequestId =
    new Map(
      promptRows.map((row) => [
        row.request_id,
        row.prompt_snapshot,
      ] as const)
    );

  const requestRows =
    (requestResponse.data ?? []) as Array<
      Omit<JoinRequestRow, "request_prompt">
    >;

  const requests: JoinRequestRow[] =
    requestRows.map((row) => ({
      ...row,
      request_prompt:
        promptByRequestId.get(
          row.request_id
        ) ?? null,
    }));

  const error =
    requestResponse.error ??
    promptResponse.error;

  const received =
    requests.filter(
      (request) =>
        request.direction ===
        "received"
    );

  const sent =
    requests.filter(
      (request) =>
        request.direction ===
        "sent"
    );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            ← Back to Timeline
          </Link>

          <Link
            href="/intent-invitations"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            Direct Invitations
          </Link>
        </div>

        <header className="mt-8 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Participation
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-950 md:text-4xl">
            Join Requests
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Review people who want to
            join your public Intents and
            track requests you sent.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              {
                received.filter(
                  (item) =>
                    item.request_status ===
                    "pending"
                ).length
              }{" "}
              pending received
            </span>

            <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              {
                sent.filter(
                  (item) =>
                    item.request_status ===
                    "pending"
                ).length
              }{" "}
              pending sent
            </span>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            {error.message}
          </div>
        )}

        {!error && (
          <>
            <section className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Received
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Requests to your Intents
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {received.map(
                  (request) => {
                    const name =
                      request.other_user_full_name ||
                      request.other_user_username ||
                      "UIN member";

                    return (
                      <article
                        key={
                          request.request_id
                        }
                        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                      >
                        <div className="flex items-start gap-4">
                          {request.other_user_avatar_url ? (
                            <img
                              src={
                                request.other_user_avatar_url
                              }
                              alt={name}
                              className="h-14 w-14 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500">
                              {getInitial(
                                name
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="text-xl font-bold text-gray-950">
                              {
                                request.activity_name
                              }
                            </h3>

                            <p className="mt-1 text-sm text-gray-500">
                              {name}
                              {request.other_user_username
                                ? ` · @${request.other_user_username}`
                                : ""}
                            </p>

                            <span
                              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                                request.request_status
                              )}`}
                            >
                              {
                                request.request_status
                              }
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                          <p>
                            📅{" "}
                            {
                              request.start_date
                            }{" "}
                            →{" "}
                            {
                              request.end_date
                            }
                          </p>

                          <p className="mt-2">
                            📍{" "}
                            {
                              request.district
                            }
                            ,{" "}
                            {request.city}
                          </p>
                        </div>

                        {(
                          request.request_prompt ||
                          request.request_message
                        ) && (
                          <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4">
                            {request.request_prompt && (
                              <>
                                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                                  Question asked
                                </p>

                                <p className="mt-2 text-sm font-semibold leading-6 text-green-950">
                                  {request.request_prompt}
                                </p>
                              </>
                            )}

                            {request.request_message && (
                              <>
                                <p className={`${request.request_prompt ? "mt-4" : ""} text-xs font-semibold uppercase tracking-wide text-green-700`}>
                                  Answer
                                </p>

                                <p className="mt-2 text-sm leading-6 text-green-950">
                                  {request.request_message}
                                </p>
                              </>
                            )}
                          </div>
                        )}

                        {request.request_status ===
                          "pending" && (
                          <JoinRequestActions
                            requestId={
                              request.request_id
                            }
                            requesterName={
                              name
                            }
                          />
                        )}

                        {request.request_status ===
                          "accepted" &&
                          request.plan_id && (
                          <Link
                            href={`/plans/${encodeURIComponent(
                              request.plan_id
                            )}/planning`}
                            className="mt-5 block rounded-xl bg-green-600 px-5 py-3 text-center text-sm font-semibold text-white"
                          >
                            Open Shared Plan
                          </Link>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            </section>

            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sent
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Your participation requests
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {sent.map(
                  (request) => {
                    const name =
                      request.other_user_full_name ||
                      request.other_user_username ||
                      "UIN member";

                    return (
                      <article
                        key={
                          request.request_id
                        }
                        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-950">
                              {
                                request.activity_name
                              }
                            </h3>

                            <p className="mt-2 text-sm text-gray-500">
                              Hosted by{" "}
                              {name}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                              request.request_status
                            )}`}
                          >
                            {
                              request.request_status
                            }
                          </span>
                        </div>

                        {request.response_reason && (
                          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                            {
                              request.response_reason
                            }
                          </p>
                        )}

                        {request.plan_id && (
                          <Link
                            href={`/plans/${encodeURIComponent(
                              request.plan_id
                            )}/planning`}
                            className="mt-5 block rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-center text-sm font-semibold text-green-700"
                          >
                            Open Shared Plan
                          </Link>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
