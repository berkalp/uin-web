import Link from "next/link";

import ProfileNameLink from "@/components/profile/ProfileNameLink";
import {
  AdminRole,
  requireAdmin,
} from "@/utils/admin";

type AdminIntentsPageProps = {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
};

type IntentStatus =
  | "active"
  | "planned"
  | "completed"
  | "cancelled";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type MatchingStatus =
  | "open"
  | "paused"
  | "matched"
  | "closed";

type Visibility =
  | "public"
  | "friends"
  | "close_friends"
  | "all_except_friends";

type AdminIntentRow = {
  intent_id: string;
  user_id: string;

  owner_full_name: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
  owner_email: string | null;

  activity_name: string | null;
  category_name: string | null;

  city: string | null;
  district: string | null;

  start_date: string;
  end_date: string;

  people: string;
  budget:
    | number
    | string
    | null;
  recurrence: string;
  visibility: Visibility;
  notes: string | null;
  intent_type: string;
  status: IntentStatus;
  recruitment_status: RecruitmentStatus;
  matching_status: MatchingStatus;
  max_participants: number | null;

  active_participant_count:
    | number
    | string
    | null;

  linked_plan_id: string | null;
  linked_plan_status: string | null;

  created_at: string;
  updated_at: string;

  total_count:
    | number
    | string
    | null;
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
    value === undefined
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
  ).format(
    toNumber(value)
  );
}

function formatBudget(
  value:
    | number
    | string
    | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return "Not set";
  }

  const parsedValue =
    toNumber(value);

  return `${new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(parsedValue)} TL`;
}

function formatDate(
  value: string
) {
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
  value: string
) {
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
      hourCycle: "h23",
    }
  ).format(
    new Date(value)
  );
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

function getStatusClasses(
  status: IntentStatus
) {
  if (status === "active") {
    return "bg-green-50 text-green-700";
  }

  if (status === "planned") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "completed") {
    return "bg-purple-50 text-purple-700";
  }

  return "bg-red-50 text-red-700";
}

function getRecruitmentClasses(
  status: RecruitmentStatus
) {
  if (status === "open") {
    return "bg-green-50 text-green-700";
  }

  if (status === "full") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-gray-100 text-gray-700";
}

function getMatchingClasses(
  status: MatchingStatus
) {
  if (status === "open") {
    return "bg-cyan-50 text-cyan-700";
  }

  if (status === "matched") {
    return "bg-purple-50 text-purple-700";
  }

  if (status === "paused") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-gray-100 text-gray-700";
}

function getVisibilityLabel(
  visibility: Visibility
) {
  if (
    visibility ===
    "close_friends"
  ) {
    return "Close Friends";
  }

  if (
    visibility ===
    "all_except_friends"
  ) {
    return "All Except Friends";
  }

  return visibility
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function buildPageHref({
  page,
  search,
  status,
  visibility,
  recruitmentStatus,
}: {
  page: number;
  search: string;
  status: string;
  visibility: string;
  recruitmentStatus: string;
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

  if (visibility) {
    parameters.set(
      "visibility",
      visibility
    );
  }

  if (recruitmentStatus) {
    parameters.set(
      "recruitment",
      recruitmentStatus
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
    ? `/admin/intents?${queryString}`
    : "/admin/intents";
}

export default async function AdminIntentsPage({
  searchParams,
}: AdminIntentsPageProps) {
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
    rawStatus === "active" ||
    rawStatus === "planned" ||
    rawStatus === "completed" ||
    rawStatus === "cancelled"
      ? rawStatus
      : "";

  const rawVisibility =
    getSingleParameter(
      resolvedSearchParams.visibility
    );

  const visibility =
    rawVisibility === "public" ||
    rawVisibility === "friends" ||
    rawVisibility ===
      "close_friends" ||
    rawVisibility ===
      "all_except_friends"
      ? rawVisibility
      : "";

  const rawRecruitmentStatus =
    getSingleParameter(
      resolvedSearchParams.recruitment
    );

  const recruitmentStatus =
    rawRecruitmentStatus ===
      "open" ||
    rawRecruitmentStatus ===
      "full" ||
    rawRecruitmentStatus ===
      "closed"
      ? rawRecruitmentStatus
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
    "get_admin_intents",
    {
      p_search:
        search || null,
      p_status:
        status || null,
      p_visibility:
        visibility || null,
      p_recruitment_status:
        recruitmentStatus || null,
      p_limit:
        pageSize,
      p_offset:
        offset,
    }
  );

  if (error) {
    console.error(
      "Admin Intents query failed:",
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

  const intents =
    (
      data ?? []
    ) as unknown as AdminIntentRow[];

  const totalIntents =
    intents.length > 0
      ? toNumber(
          intents[0].total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalIntents /
          pageSize
      )
    );

  const startResult =
    totalIntents === 0
      ? 0
      : offset + 1;

  const endResult =
    Math.min(
      offset +
        intents.length,
      totalIntents
    );

  const hasFilters =
    Boolean(
      search ||
      status ||
      visibility ||
      recruitmentStatus
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
                Intents
              </h1>

              <p className="mt-3 max-w-2xl text-gray-500">
                Review Intent ownership,
                visibility, recruitment,
                matching and linked Plan
                information.
              </p>

              <p className="mt-4 text-sm text-gray-500">
                Signed in as{" "}
                <span className="font-semibold text-gray-800">
                  {user.email ??
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
                href="/timeline"
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Timeline
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <form
            method="get"
            action="/admin/intents"
            className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_210px_210px_auto_auto]"
          >
            <div>
              <label
                htmlFor="intent-search"
                className="sr-only"
              >
                Search Intents
              </label>

              <input
                id="intent-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search owner, Activity, category, location, or notes"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="sr-only"
              >
                Intent status
              </label>

              <select
                id="status-filter"
                name="status"
                defaultValue={status}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="planned">
                  Planned
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="visibility-filter"
                className="sr-only"
              >
                Visibility
              </label>

              <select
                id="visibility-filter"
                name="visibility"
                defaultValue={
                  visibility
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All visibility
                </option>

                <option value="public">
                  Public
                </option>

                <option value="friends">
                  Friends
                </option>

                <option value="close_friends">
                  Close Friends
                </option>

                <option value="all_except_friends">
                  All Except Friends
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="recruitment-filter"
                className="sr-only"
              >
                Recruitment status
              </label>

              <select
                id="recruitment-filter"
                name="recruitment"
                defaultValue={
                  recruitmentStatus
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All recruitment
                </option>

                <option value="open">
                  Open
                </option>

                <option value="full">
                  Full
                </option>

                <option value="closed">
                  Closed
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
                href="/admin/intents"
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
              Intents could not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              The admin Intent query
              returned an error.
            </p>
          </div>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Intent Directory
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {search
                  ? `Results for “${search}”`
                  : "All Intents"}
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Showing {startResult}–
              {endResult} of{" "}
              {formatNumber(
                totalIntents
              )}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {intents.map(
              (intent) => {
                const ownerName =
                  intent.owner_full_name ??
                  "UIN member";

                const locationText = [
                  intent.district,
                  intent.city,
                ]
                  .filter(Boolean)
                  .join(", ");

                const participantLimit =
                  intent.max_participants ===
                  null
                    ? "Unlimited"
                    : String(
                        intent.max_participants
                      );

                return (
                  <article
                    key={
                      intent.intent_id
                    }
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <ProfileNameLink
                          username={
                            intent.owner_username
                          }
                          title={`View ${ownerName}'s profile`}
                          className="group flex w-fit shrink-0 items-center gap-3 rounded-2xl transition hover:bg-green-50"
                        >
                          {intent.owner_avatar_url ? (
                            <img
                              src={
                                intent.owner_avatar_url
                              }
                              alt={
                                ownerName
                              }
                              className="h-14 w-14 rounded-full object-cover transition group-hover:ring-2 group-hover:ring-green-300"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500 transition group-hover:bg-green-100 group-hover:text-green-700">
                              {getInitial(
                                ownerName
                              )}
                            </div>
                          )}

                          <div className="pr-3">
                            <p className="font-semibold text-gray-900 transition group-hover:text-green-700">
                              {ownerName}
                            </p>

                            {intent.owner_username && (
                              <p className="mt-1 text-sm text-gray-500">
                                @
                                {
                                  intent.owner_username
                                }
                              </p>
                            )}

                            <p className="mt-1 max-w-64 truncate text-xs text-gray-400">
                              {intent.owner_email ??
                                "Email unavailable"}
                            </p>
                          </div>
                        </ProfileNameLink>

                        <div className="sm:border-l sm:border-gray-200 sm:pl-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                            {
                              intent.intent_type
                            }
                          </p>

                          <h3 className="mt-2 text-2xl font-bold text-gray-950">
                            {intent.activity_name ??
                              "Unknown Activity"}
                          </h3>

                          <p className="mt-1 text-gray-500">
                            {intent.category_name ??
                              "Unknown Category"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                            intent.status
                          )}`}
                        >
                          {intent.status}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getRecruitmentClasses(
                            intent.recruitment_status
                          )}`}
                        >
                          Recruitment:{" "}
                          {
                            intent.recruitment_status
                          }
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getMatchingClasses(
                            intent.matching_status
                          )}`}
                        >
                          Matching:{" "}
                          {
                            intent.matching_status
                          }
                        </span>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {getVisibilityLabel(
                            intent.visibility
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                      <p>
                        📅{" "}
                        {formatDate(
                          intent.start_date
                        )}{" "}
                        →{" "}
                        {formatDate(
                          intent.end_date
                        )}
                      </p>

                      <p>
                        📍{" "}
                        {locationText ||
                          "Location unavailable"}
                      </p>

                      <p>
                        👥 Preference:{" "}
                        {intent.people}
                      </p>

                      <p>
                        🔁{" "}
                        {intent.recurrence}
                      </p>

                      <p>
                        💰{" "}
                        {formatBudget(
                          intent.budget
                        )}
                      </p>

                      <p>
                        👤 Capacity:{" "}
                        {participantLimit}
                      </p>

                      <p>
                        ✅ Active Participants:{" "}
                        {formatNumber(
                          intent.active_participant_count
                        )}
                      </p>

                      <p>
                        🕒 Created:{" "}
                        {formatDateTime(
                          intent.created_at
                        )}
                      </p>
                    </div>

                    {intent.notes && (
                      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Notes
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {intent.notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
                      <p className="font-mono text-xs text-gray-400">
                        Intent ID:{" "}
                        {intent.intent_id}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/users/${encodeURIComponent(
                            intent.owner_username ??
                              intent.user_id
                          )}`}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
                        >
                          Manage User
                        </Link>

                        {intent.linked_plan_id && (
                          <Link
                            href={`/plans/${intent.linked_plan_id}`}
                            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                          >
                            Open Linked Plan
                            {intent.linked_plan_status
                              ? ` · ${intent.linked_plan_status}`
                              : ""}
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              }
            )}

            {intents.length === 0 &&
              !error && (
                <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900">
                    No Intents found.
                  </h3>

                  <p className="mt-3 text-gray-500">
                    No Intent matches the
                    current search and
                    filters.
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
                      visibility,
                      recruitmentStatus,
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
                      visibility,
                      recruitmentStatus,
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