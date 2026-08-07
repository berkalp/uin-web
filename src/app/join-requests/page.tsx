import Link from "next/link";
import { redirect } from "next/navigation";

import JoinRequestActions from "@/components/intents/JoinRequestActions";
import WithdrawJoinRequestButton from "@/components/intents/WithdrawJoinRequestButton";
import ReportCustomActivityTitleButton from "@/components/experiences/ReportCustomActivityTitleButton";
import { createClient } from "@/utils/supabase/server";
import {
  hydrateVisiblePlanPresentations,
  type VisiblePlanPresentationRow,
} from "@/utils/planPresentationVisibility";

type JoinRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn";

type JoinRequestRow = {
  request_id: string;
  direction: "received" | "sent";
  request_status: JoinRequestStatus;
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

type IntentLifecycleRow = {
  id: string;
  status: "active" | "planned" | "completed" | "cancelled";
  recruitment_status: "open" | "full" | "closed" | null;
  expired_at: string | null;
};

type PlanLifecycleRow = {
  id: string;
  status: "forming" | "planned" | "completed" | "cancelled";
  title: string | null;
};

type DecoratedRequest = JoinRequestRow & {
  intentStatus: IntentLifecycleRow["status"] | null;
  intentExpiredAt: string | null;
  planStatus: PlanLifecycleRow["status"] | null;
  displayTitle: string;
  canonicalTitle: string;
};

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function getStatusClasses(status: string) {
  if (status === "accepted" || status === "planned" || status === "completed") {
    return "bg-green-50 text-green-700";
  }

  if (status === "pending" || status === "forming") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "declined" || status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-gray-100 text-gray-600";
}

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getRequestPersonName(request: JoinRequestRow) {
  return (
    request.other_user_full_name ||
    request.other_user_username ||
    "UIN member"
  );
}

function isPendingAndRelevant(request: DecoratedRequest) {
  return (
    request.request_status === "pending" &&
    request.intentStatus === "active" &&
    !request.intentExpiredAt
  );
}

function getHistoryStatus(request: DecoratedRequest) {
  if (request.planStatus === "cancelled") return "cancelled";
  if (request.planStatus === "completed") return "completed";
  if (request.planStatus === "planned") return "planned";
  if (request.planStatus === "forming") return "accepted";
  if (request.intentStatus === "cancelled") return "cancelled";
  if (request.intentExpiredAt) return "expired";
  return request.request_status;
}

function getPlanHref(request: DecoratedRequest) {
  if (!request.plan_id) return null;

  if (request.planStatus === "forming") {
    return `/plans/${encodeURIComponent(request.plan_id)}/planning?returnTo=${encodeURIComponent("/join-requests")}&returnLabel=${encodeURIComponent("Join Requests")}`;
  }

  return `/plans/${encodeURIComponent(request.plan_id)}/activity?returnTo=${encodeURIComponent("/join-requests")}&returnLabel=${encodeURIComponent("Join Requests")}`;
}

function TitleBlock({ request }: { request: DecoratedRequest }) {
  const changed = request.displayTitle !== request.canonicalTitle;

  return (
    <div className="min-w-0">
      <h3 className="text-xl font-bold text-gray-950">
        {request.displayTitle}
      </h3>
      {changed && (
        <p className="mt-1 text-xs font-semibold text-gray-400">
          Original Activity · {request.canonicalTitle}
        </p>
      )}
    </div>
  );
}

function PersonIdentity({
  request,
  prefix,
}: {
  request: DecoratedRequest;
  prefix?: string;
}) {
  const name = getRequestPersonName(request);
  const profileHref = request.other_user_username
    ? `/u/${encodeURIComponent(request.other_user_username)}`
    : null;

  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      {request.other_user_avatar_url ? (
        <img
          src={request.other_user_avatar_url}
          alt={name}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500">
          {getInitial(name)}
        </div>
      )}
      <div className="min-w-0">
        {prefix && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            {prefix}
          </p>
        )}
        <p className="truncate text-sm font-bold text-gray-950">{name}</p>
        {request.other_user_username && (
          <p className="truncate text-xs text-gray-500">
            @{request.other_user_username}
          </p>
        )}
      </div>
    </div>
  );

  return profileHref ? (
    <Link
      href={profileHref}
      className="rounded-xl transition hover:bg-gray-50"
      title={`View ${name}'s profile`}
    >
      {identity}
    </Link>
  ) : (
    identity
  );
}

export default async function JoinRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const historyMode = Array.isArray(resolvedSearchParams.history)
    ? resolvedSearchParams.history[0]
    : resolvedSearchParams.history;
  const showAllHistory = historyMode === "all";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [requestResponse, promptResponse] = await Promise.all([
    supabase.rpc("get_my_intent_join_requests"),
    supabase.rpc("get_my_intent_join_request_prompt_snapshots"),
  ]);

  const promptRows = (promptResponse.data ?? []) as JoinRequestPromptRow[];
  const promptByRequestId = new Map(
    promptRows.map((row) => [row.request_id, row.prompt_snapshot] as const)
  );

  const requestRows = (requestResponse.data ?? []) as Array<
    Omit<JoinRequestRow, "request_prompt">
  >;

  const requests: JoinRequestRow[] = requestRows.map((row) => ({
    ...row,
    request_prompt: promptByRequestId.get(row.request_id) ?? null,
  }));

  const intentIds = [...new Set(requests.map((item) => item.intent_id).filter(Boolean))];
  const planIds = [
    ...new Set(
      requests
        .map((item) => item.plan_id)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const [intentResponse, planResponse, presentationResponse] = await Promise.all([
    intentIds.length
      ? supabase
          .from("intents")
          .select("id,status,recruitment_status,expired_at")
          .in("id", intentIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? supabase.from("plans").select("id,status,title").in("id", planIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? supabase.rpc("get_visible_plan_presentations", { p_plan_ids: planIds })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const hydratedPresentations = await hydrateVisiblePlanPresentations(
    supabase,
    (presentationResponse.data ?? []) as VisiblePlanPresentationRow[]
  );

  const intentById = new Map(
    ((intentResponse.data ?? []) as IntentLifecycleRow[]).map((item) => [item.id, item])
  );
  const planById = new Map(
    ((planResponse.data ?? []) as PlanLifecycleRow[]).map((item) => [item.id, item])
  );
  const presentationByPlanId = new Map(
    hydratedPresentations.map((item) => [item.plan_id, item])
  );

  const decorated: DecoratedRequest[] = requests.map((request) => {
    const intent = intentById.get(request.intent_id) ?? null;
    const plan = request.plan_id ? planById.get(request.plan_id) ?? null : null;
    const presentation = request.plan_id
      ? presentationByPlanId.get(request.plan_id) ?? null
      : null;
    const canonicalTitle = request.activity_name || "UIN Activity";
    const customTitle = presentation?.custom_title?.trim() || null;

    return {
      ...request,
      intentStatus: intent?.status ?? null,
      intentExpiredAt: intent?.expired_at ?? null,
      planStatus: plan?.status ?? null,
      canonicalTitle,
      displayTitle: customTitle || canonicalTitle,
    };
  });

  const pendingReceived = decorated.filter(
    (request) => request.direction === "received" && isPendingAndRelevant(request)
  );
  const pendingSent = decorated.filter(
    (request) => request.direction === "sent" && isPendingAndRelevant(request)
  );
  const history = decorated
    .filter((request) => !isPendingAndRelevant(request))
    .sort((left, right) => {
      const leftTime = new Date(left.request_responded_at || left.request_created_at).getTime();
      const rightTime = new Date(right.request_responded_at || right.request_created_at).getTime();
      return rightTime - leftTime;
    });

  const error =
    requestResponse.error ??
    promptResponse.error ??
    intentResponse.error ??
    planResponse.error ??
    presentationResponse.error;

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
            Active requests stay action-focused. Accepted, declined, withdrawn,
            planned, completed, cancelled and expired records move to history.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              {pendingReceived.length} waiting for you
            </span>
            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              {pendingSent.length} waiting for a host
            </span>
            <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              {history.length} in history
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
                Needs your response
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Requests to your Intents
              </h2>

              {pendingReceived.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
                  No join request currently needs your response.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {pendingReceived.map((request) => {
                    const name = getRequestPersonName(request);

                    return (
                      <article
                        key={request.request_id}
                        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                      >
                        <TitleBlock request={request} />
                        <div className="mt-4">
                          <PersonIdentity request={request} prefix="Request from" />
                        </div>

                        <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                          <p>📅 {request.start_date} → {request.end_date}</p>
                          <p className="mt-2">📍 {request.district}, {request.city}</p>
                        </div>

                        {(request.request_prompt || request.request_message) && (
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

                        <JoinRequestActions
                          requestId={request.request_id}
                          requesterName={name}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Your pending requests
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                Waiting for a host
              </h2>

              {pendingSent.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
                  You have no pending participation requests.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {pendingSent.map((request) => {
                    const profileHref = request.other_user_username
                      ? `/u/${encodeURIComponent(request.other_user_username)}`
                      : null;

                    return (
                      <article
                        key={request.request_id}
                        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <TitleBlock request={request} />
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Pending
                          </span>
                        </div>

                        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                          <PersonIdentity request={request} prefix="Hosted by" />
                        </div>

                        <p className="mt-4 text-xs text-gray-400">
                          Requested {formatDate(request.request_created_at)}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <Link
                            href={`/activities/${encodeURIComponent(request.intent_id)}?returnTo=${encodeURIComponent("/join-requests")}&returnLabel=${encodeURIComponent("Join Requests")}`}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                          >
                            View Intent
                          </Link>
                          {profileHref && (
                            <Link
                              href={profileHref}
                              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                            >
                              View Host Profile
                            </Link>
                          )}
                          <WithdrawJoinRequestButton requestId={request.request_id} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Request history
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-gray-950">
                    No longer waiting for action
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400">
                    {showAllHistory
                      ? `${history.length} records`
                      : `Latest ${Math.min(history.length, 10)} shown`}
                  </span>
                  {history.length > 10 && (
                    <Link
                      href={showAllHistory ? "/join-requests" : "/join-requests?history=all"}
                      className="text-xs font-semibold text-green-700"
                    >
                      {showAllHistory ? "Show recent only" : "View all history"}
                    </Link>
                  )}
                </div>
              </div>

              {history.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
                  Request history will appear here after requests are resolved.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {(showAllHistory ? history : history.slice(0, 10)).map((request) => {
                    const lifecycleStatus = getHistoryStatus(request);
                    const planHref = getPlanHref(request);
                    const directionLabel =
                      request.direction === "received" ? "Requested by" : "Hosted by";

                    return (
                      <article
                        key={request.request_id}
                        className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <TitleBlock request={request} />
                            {request.direction === "sent" &&
                              request.plan_id &&
                              request.displayTitle !== request.canonicalTitle && (
                                <ReportCustomActivityTitleButton
                                  planId={request.plan_id}
                                  customTitle={request.displayTitle}
                                  canonicalTitle={request.canonicalTitle}
                                />
                              )}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(lifecycleStatus)}`}
                          >
                            {lifecycleStatus.replaceAll("_", " ")}
                          </span>
                        </div>

                        <div className="mt-4">
                          <PersonIdentity request={request} prefix={directionLabel} />
                        </div>

                        {request.response_reason && (
                          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                            {request.response_reason}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/activities/${encodeURIComponent(request.intent_id)}?returnTo=${encodeURIComponent("/join-requests")}&returnLabel=${encodeURIComponent("Join Requests")}`}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700"
                          >
                            View original Intent
                          </Link>
                          {planHref && (
                            <Link
                              href={planHref}
                              className="rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-semibold text-white"
                            >
                              {request.planStatus === "forming"
                                ? "Open Shared Plan"
                                : request.planStatus === "planned"
                                  ? "Open Activity Room"
                                  : "Open Activity record"}
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
