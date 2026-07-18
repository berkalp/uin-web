import Link from "next/link";

import ProfileNameLink from "@/components/profile/ProfileNameLink";
import {
  AdminRole,
  requireAdmin,
} from "@/utils/admin";

type AdminRequestsPageProps = {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
};

type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected";

type ParticipationStatus =
  | "active"
  | "withdrawn"
  | "removed";

type ParticipationFilter =
  | ""
  | ParticipationStatus
  | "none";

type AdminRequestRow = {
  request_id: string;

  requester_id: string;
  requester_full_name: string | null;
  requester_username: string | null;
  requester_avatar_url: string | null;
  requester_email: string | null;

  receiver_id: string;
  receiver_full_name: string | null;
  receiver_username: string | null;
  receiver_avatar_url: string | null;
  receiver_email: string | null;

  own_intent_id: string;
  requester_activity_name: string | null;
  requester_category_name: string | null;
  requester_city: string | null;
  requester_district: string | null;
  requester_start_date: string | null;
  requester_end_date: string | null;

  target_intent_id: string;
  target_activity_name: string | null;
  target_category_name: string | null;
  target_city: string | null;
  target_district: string | null;
  target_start_date: string | null;
  target_end_date: string | null;

  request_status: RequestStatus;
  request_message: string | null;
  decline_reason: string | null;
  declined_at: string | null;

  participation_id: string | null;
  participation_status: ParticipationStatus | null;
  withdrawal_reason: string | null;
  withdrawn_at: string | null;
  removal_reason: string | null;
  removed_at: string | null;

  plan_id: string | null;
  plan_title: string | null;
  plan_status: string | null;

  created_at: string;
  updated_at: string;

  total_count:
    | number
    | string
    | null;
};

type UserIdentityProps = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  email: string | null;
  label: string;
};

type IntentSummaryProps = {
  label: string;
  intentId: string;
  activityName: string | null;
  categoryName: string | null;
  city: string | null;
  district: string | null;
  startDate: string | null;
  endDate: string | null;
};

function getSingleParameter(
  value:
    | string
    | string[]
    | undefined
) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function toNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function formatNumber(
  value:
    | number
    | string
    | null
) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(toNumber(value));
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(
      `${value}T12:00:00`
    )
  );
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Europe/Istanbul",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).format(new Date(value));
}

function getInitial(
  value:
    | string
    | null
    | undefined
) {
  return (
    value
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function getAdminRoleLabel(
  role: AdminRole
) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Administrator";
  }

  if (role === "moderator") {
    return "Moderator";
  }

  return "Support";
}

function getRequestStatusLabel(
  status: RequestStatus
) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "accepted") {
    return "Accepted";
  }

  return "Declined";
}

function getRequestStatusClasses(
  status: RequestStatus
) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "accepted") {
    return "bg-green-50 text-green-700";
  }

  return "bg-red-50 text-red-700";
}

function getParticipationStatusLabel(
  status: ParticipationStatus | null
) {
  if (status === "active") {
    return "Active Participant";
  }

  if (status === "withdrawn") {
    return "Withdrawn";
  }

  if (status === "removed") {
    return "Removed";
  }

  return "No Participation";
}

function getParticipationStatusClasses(
  status: ParticipationStatus | null
) {
  if (status === "active") {
    return "bg-green-50 text-green-700";
  }

  if (status === "withdrawn") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "removed") {
    return "bg-red-50 text-red-700";
  }

  return "bg-gray-100 text-gray-600";
}

function getPlanStatusClasses(
  status: string | null
) {
  if (status === "forming") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "planned") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "completed") {
    return "bg-purple-50 text-purple-700";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-gray-100 text-gray-600";
}

function getLocationText(
  district: string | null,
  city: string | null
) {
  return [district, city]
    .filter(Boolean)
    .join(", ");
}

function buildPageHref({
  page,
  search,
  status,
  participation,
}: {
  page: number;
  search: string;
  status: string;
  participation: ParticipationFilter;
}) {
  const parameters =
    new URLSearchParams();

  if (search) {
    parameters.set(
      "q",
      search
    );
  }

  if (status) {
    parameters.set(
      "status",
      status
    );
  }

  if (participation) {
    parameters.set(
      "participation",
      participation
    );
  }

  if (page > 1) {
    parameters.set(
      "page",
      String(page)
    );
  }

  const queryString =
    parameters.toString();

  return queryString
    ? `/admin/requests?${queryString}`
    : "/admin/requests";
}

function UserIdentity({
  userId,
  fullName,
  username,
  avatarUrl,
  email,
  label,
}: UserIdentityProps) {
  const displayName =
    fullName || "UIN member";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <div className="mt-4 flex items-start gap-3">
        <ProfileNameLink
          username={username}
          title={`View ${displayName}'s profile`}
          className="group shrink-0"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-12 w-12 rounded-full object-cover transition group-hover:ring-2 group-hover:ring-green-300"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500 transition group-hover:bg-green-100 group-hover:text-green-700">
              {getInitial(
                displayName
              )}
            </div>
          )}
        </ProfileNameLink>

        <div className="min-w-0 flex-1">
          <ProfileNameLink
            username={username}
            title={`View ${displayName}'s profile`}
            className="font-semibold text-gray-900 transition hover:text-green-700"
          >
            {displayName}
          </ProfileNameLink>

          {username && (
            <p className="mt-1 truncate text-sm text-gray-500">
              @{username}
            </p>
          )}

          <p className="mt-1 truncate text-xs text-gray-400">
            {email ||
              "Email unavailable"}
          </p>

          <Link
            href={`/admin/users/${encodeURIComponent(
              username || userId
            )}`}
            className="mt-3 inline-flex text-xs font-semibold text-green-700 transition hover:text-green-800"
          >
            Manage User →
          </Link>
        </div>
      </div>
    </div>
  );
}

function IntentSummary({
  label,
  intentId,
  activityName,
  categoryName,
  city,
  district,
  startDate,
  endDate,
}: IntentSummaryProps) {
  const locationText =
    getLocationText(
      district,
      city
    );

  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <h4 className="mt-3 text-lg font-bold text-gray-900">
        {activityName ||
          "Unknown Activity"}
      </h4>

      <p className="mt-1 text-sm text-gray-500">
        {categoryName ||
          "Unknown Category"}
      </p>

      <div className="mt-4 space-y-2 text-sm text-gray-600">
        <p>
          📅 {formatDate(startDate)}{" "}
          → {formatDate(endDate)}
        </p>

        <p>
          📍{" "}
          {locationText ||
            "Location unavailable"}
        </p>
      </div>

      <p className="mt-4 break-all font-mono text-xs text-gray-400">
        Intent ID: {intentId}
      </p>
    </div>
  );
}

export default async function AdminRequestsPage({
  searchParams,
}: AdminRequestsPageProps) {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const resolvedSearchParams =
    await searchParams;

  const search =
    getSingleParameter(
      resolvedSearchParams.q
    )
      .trim()
      .slice(0, 100);

  const rawStatus =
    getSingleParameter(
      resolvedSearchParams.status
    );

  const status =
    rawStatus === "pending" ||
    rawStatus === "accepted" ||
    rawStatus === "rejected"
      ? rawStatus
      : "";

  const rawParticipation =
    getSingleParameter(
      resolvedSearchParams.participation
    );

  const participation: ParticipationFilter =
    rawParticipation === "active" ||
    rawParticipation === "withdrawn" ||
    rawParticipation === "removed" ||
    rawParticipation === "none"
      ? rawParticipation
      : "";

  const rawPage =
    Number(
      getSingleParameter(
        resolvedSearchParams.page
      )
    );

  const currentPage =
    Number.isInteger(rawPage) &&
    rawPage > 0
      ? rawPage
      : 1;

  const pageSize = 50;

  const offset =
    (currentPage - 1) *
    pageSize;

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_requests",
    {
      p_search:
        search || null,
      p_status:
        status || null,
      p_participation_status:
        participation || null,
      p_limit:
        pageSize,
      p_offset:
        offset,
    }
  );

  if (error) {
    console.error(
      "Admin Requests query failed:",
      {
        message:
          error.message,
        code:
          error.code,
        details:
          error.details,
        hint:
          error.hint,
      }
    );
  }

  const requests =
    (
      data ?? []
    ) as unknown as AdminRequestRow[];

  const totalRequests =
    requests.length > 0
      ? toNumber(
          requests[0].total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalRequests /
          pageSize
      )
    );

  const startResult =
    totalRequests === 0
      ? 0
      : offset + 1;

  const endResult =
    Math.min(
      offset +
        requests.length,
      totalRequests
    );

  const hasFilters =
    Boolean(
      search ||
      status ||
      participation
    );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
                  UIN Administration
                </span>

                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {getAdminRoleLabel(
                    role
                  )}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Requests
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Review participation requests,
                linked Intents, request decisions
                and later participation outcomes.
              </p>

              <p className="mt-4 text-sm text-gray-500">
                Signed in as{" "}
                <span className="font-semibold text-gray-800">
                  {user.email ||
                    "Unknown administrator"}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
              >
                ← Admin Dashboard
              </Link>

              <Link
                href="/requests"
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                My Requests
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <form
            method="get"
            action="/admin/requests"
            className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(300px,1fr)_210px_240px_auto_auto]"
          >
            <div>
              <label
                htmlFor="request-search"
                className="sr-only"
              >
                Search Requests
              </label>

              <input
                id="request-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search users, Activities, locations, messages, reasons, or Plans"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="sr-only"
              >
                Request status
              </label>

              <select
                id="status-filter"
                name="status"
                defaultValue={status}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All request statuses
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="accepted">
                  Accepted
                </option>

                <option value="rejected">
                  Declined
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="participation-filter"
                className="sr-only"
              >
                Participation status
              </label>

              <select
                id="participation-filter"
                name="participation"
                defaultValue={
                  participation
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All participation states
                </option>

                <option value="active">
                  Active Participant
                </option>

                <option value="withdrawn">
                  Withdrawn
                </option>

                <option value="removed">
                  Removed
                </option>

                <option value="none">
                  No Participation
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-gray-950 px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Apply
            </button>

            {hasFilters && (
              <Link
                href="/admin/requests"
                className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-center font-semibold text-gray-700 transition hover:border-red-300 hover:text-red-700"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Requests could not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              The admin Request query returned
              an error.
            </p>
          </div>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Request Directory
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {search
                  ? `Results for “${search}”`
                  : "All Requests"}
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Showing {startResult}–
              {endResult} of{" "}
              {formatNumber(
                totalRequests
              )}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {requests.map(
              (request) => {
                const requesterName =
                  request.requester_full_name ||
                  "UIN member";

                const receiverName =
                  request.receiver_full_name ||
                  "UIN member";

                const participationReason =
                  request.participation_status ===
                    "withdrawn"
                    ? request.withdrawal_reason
                    : request.participation_status ===
                        "removed"
                      ? request.removal_reason
                      : null;

                const participationActionTime =
                  request.participation_status ===
                    "withdrawn"
                    ? request.withdrawn_at
                    : request.participation_status ===
                        "removed"
                      ? request.removed_at
                      : null;

                return (
                  <article
                    key={
                      request.request_id
                    }
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                          Participation Request
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-gray-950">
                          {requesterName}{" "}
                          <span className="font-normal text-gray-300">
                            →
                          </span>{" "}
                          {receiverName}
                        </h3>

                        <p className="mt-2 text-sm text-gray-500">
                          Created{" "}
                          {formatDateTime(
                            request.created_at
                          )}{" "}
                          TRT
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getRequestStatusClasses(
                            request.request_status
                          )}`}
                        >
                          Request:{" "}
                          {getRequestStatusLabel(
                            request.request_status
                          )}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getParticipationStatusClasses(
                            request.participation_status
                          )}`}
                        >
                          {getParticipationStatusLabel(
                            request.participation_status
                          )}
                        </span>

                        {request.plan_status && (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getPlanStatusClasses(
                              request.plan_status
                            )}`}
                          >
                            Plan:{" "}
                            {
                              request.plan_status
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_60px_minmax(0,1fr)] lg:items-center">
                      <UserIdentity
                        userId={
                          request.requester_id
                        }
                        fullName={
                          request.requester_full_name
                        }
                        username={
                          request.requester_username
                        }
                        avatarUrl={
                          request.requester_avatar_url
                        }
                        email={
                          request.requester_email
                        }
                        label="Requester"
                      />

                      <div className="hidden text-center text-2xl text-gray-300 lg:block">
                        →
                      </div>

                      <UserIdentity
                        userId={
                          request.receiver_id
                        }
                        fullName={
                          request.receiver_full_name
                        }
                        username={
                          request.receiver_username
                        }
                        avatarUrl={
                          request.receiver_avatar_url
                        }
                        email={
                          request.receiver_email
                        }
                        label="Receiver"
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <IntentSummary
                        label="Requester Intent"
                        intentId={
                          request.own_intent_id
                        }
                        activityName={
                          request.requester_activity_name
                        }
                        categoryName={
                          request.requester_category_name
                        }
                        city={
                          request.requester_city
                        }
                        district={
                          request.requester_district
                        }
                        startDate={
                          request.requester_start_date
                        }
                        endDate={
                          request.requester_end_date
                        }
                      />

                      <IntentSummary
                        label="Target Intent"
                        intentId={
                          request.target_intent_id
                        }
                        activityName={
                          request.target_activity_name
                        }
                        categoryName={
                          request.target_category_name
                        }
                        city={
                          request.target_city
                        }
                        district={
                          request.target_district
                        }
                        startDate={
                          request.target_start_date
                        }
                        endDate={
                          request.target_end_date
                        }
                      />
                    </div>

                    {request.request_message && (
                      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Request Message
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {
                            request.request_message
                          }
                        </p>
                      </div>
                    )}

                    {request.request_status ===
                      "rejected" && (
                      <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                          Decline Details
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {request.decline_reason ||
                            "No decline reason was provided."}
                        </p>

                        {request.declined_at && (
                          <p className="mt-3 text-xs text-red-600">
                            Declined{" "}
                            {formatDateTime(
                              request.declined_at
                            )}{" "}
                            TRT
                          </p>
                        )}
                      </div>
                    )}

                    {(request.participation_status ===
                      "withdrawn" ||
                      request.participation_status ===
                        "removed") && (
                      <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Participation Outcome
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {participationReason ||
                            "No reason was provided."}
                        </p>

                        {participationActionTime && (
                          <p className="mt-3 text-xs text-amber-700">
                            Updated{" "}
                            {formatDateTime(
                              participationActionTime
                            )}{" "}
                            TRT
                          </p>
                        )}
                      </div>
                    )}

                    {request.plan_id && (
                      <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                              Linked Plan
                            </p>

                            <h4 className="mt-2 text-lg font-bold text-gray-900">
                              {request.plan_title ||
                                "UIN Plan"}
                            </h4>

                            <p className="mt-1 text-sm capitalize text-gray-600">
                              Status:{" "}
                              {request.plan_status ||
                                "Unknown"}
                            </p>
                          </div>

                          <Link
                            href={`/plans/${request.plan_id}`}
                            className="rounded-xl bg-gray-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                          >
                            {request.plan_status ===
                            "forming"
                              ? "Open Planning Room"
                              : "Open Activity Room"}
                          </Link>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 md:grid-cols-2">
                      <p className="break-all font-mono text-xs text-gray-400">
                        Request ID:{" "}
                        {request.request_id}
                      </p>

                      {request.participation_id && (
                        <p className="break-all font-mono text-xs text-gray-400 md:text-right">
                          Participation ID:{" "}
                          {
                            request.participation_id
                          }
                        </p>
                      )}
                    </div>
                  </article>
                );
              }
            )}

            {requests.length === 0 &&
              !error && (
                <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900">
                    No Requests found.
                  </h3>

                  <p className="mt-3 text-gray-500">
                    No participation request
                    matches the current search
                    and filters.
                  </p>
                </div>
              )}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                Page {currentPage} of{" "}
                {totalPages}
              </p>

              <div className="flex gap-3">
                {currentPage > 1 ? (
                  <Link
                    href={buildPageHref({
                      page:
                        currentPage -
                        1,
                      search,
                      status,
                      participation,
                    })}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                    ← Previous
                  </span>
                )}

                {currentPage <
                totalPages ? (
                  <Link
                    href={buildPageHref({
                      page:
                        currentPage +
                        1,
                      search,
                      status,
                      participation,
                    })}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                    Next →
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}