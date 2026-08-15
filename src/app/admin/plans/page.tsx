import Link from "next/link";

import ProfileNameLink from "@/components/profile/ProfileNameLink";
import {
  AdminRole,
  requireAdmin,
} from "@/utils/admin";

type AdminPlansPageProps = {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
};

type PlanStatus =
  | "forming"
  | "planned"
  | "completed"
  | "cancelled";

type RecruitmentStatus =
  | "open"
  | "full"
  | "closed";

type CreationMode =
  | "matched"
  | "scheduled_direct";

type AdminPlanRow = {
  plan_id: string;

  host_user_id: string;
  host_full_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  host_email: string | null;

  title: string | null;
  activity_name: string | null;
  category_name: string | null;

  city: string | null;
  district: string | null;

  window_start: string;
  window_end: string;

  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string | null;
  meeting_point: string | null;
  schedule_notes: string | null;

  creation_mode: CreationMode;
  status: PlanStatus;
  recruitment_status: RecruitmentStatus;
  visibility: string;

  target_budget:
    | number
    | string
    | null;

  legacy_budget:
    | number
    | string
    | null;

  max_participants:
    | number
    | string
    | null;

  active_member_count:
    | number
    | string
    | null;

  active_participant_count:
    | number
    | string
    | null;

  withdrawn_member_count:
    | number
    | string
    | null;

  removed_member_count:
    | number
    | string
    | null;

  committed_budget:
    | number
    | string
    | null;

  actual_budget:
    | number
    | string
    | null;

  message_count:
    | number
    | string
    | null;

  planning_message_count:
    | number
    | string
    | null;

  activity_message_count:
    | number
    | string
    | null;

  planned_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
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

function toNullableNumber(
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
    return null;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : null;
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

function formatCurrency(
  value:
    | number
    | string
    | null
) {
  const parsedValue =
    toNullableNumber(value);

  if (parsedValue === null) {
    return "Not set";
  }

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
  value: string,
  timezone = "Europe/Istanbul"
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

function getStatusClasses(
  status: PlanStatus
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

function getCreationModeLabel(
  mode: CreationMode
) {
  if (
    mode ===
    "scheduled_direct"
  ) {
    return "Scheduled Direct";
  }

  return "Matched Intent";
}

function getCreationModeClasses(
  mode: CreationMode
) {
  if (
    mode ===
    "scheduled_direct"
  ) {
    return "bg-cyan-50 text-cyan-700";
  }

  return "bg-green-50 text-green-700";
}

function getBudgetProgress(
  target:
    | number
    | string
    | null,
  committed:
    | number
    | string
    | null
) {
  const targetValue =
    toNullableNumber(target);

  const committedValue =
    toNumber(committed);

  if (
    targetValue === null ||
    targetValue <= 0
  ) {
    return null;
  }

  return Math.min(
    Math.max(
      (committedValue /
        targetValue) *
        100,
      0
    ),
    100
  );
}

function buildPageHref({
  page,
  search,
  status,
  recruitmentStatus,
  creationMode,
}: {
  page: number;
  search: string;
  status: string;
  recruitmentStatus: string;
  creationMode: string;
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

  if (recruitmentStatus) {
    parameters.set(
      "recruitment",
      recruitmentStatus
    );
  }

  if (creationMode) {
    parameters.set(
      "mode",
      creationMode
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
    ? `/admin/plans?${queryString}`
    : "/admin/plans";
}

export default async function AdminPlansPage({
  searchParams,
}: AdminPlansPageProps) {
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
    rawStatus === "forming" ||
    rawStatus === "planned" ||
    rawStatus === "completed" ||
    rawStatus === "cancelled"
      ? rawStatus
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

  const rawCreationMode =
    getSingleParameter(
      resolvedSearchParams.mode
    );

  const creationMode =
    rawCreationMode ===
      "matched" ||
    rawCreationMode ===
      "scheduled_direct"
      ? rawCreationMode
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
    "get_admin_plans",
    {
      p_search:
        search || null,
      p_status:
        status || null,
      p_recruitment_status:
        recruitmentStatus ||
        null,
      p_creation_mode:
        creationMode || null,
      p_limit:
        pageSize,
      p_offset:
        offset,
    }
  );

  if (error) {
    console.error(
      "Admin Plans query failed:",
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

  const plans =
    (
      data ?? []
    ) as unknown as AdminPlanRow[];

  const totalPlans =
    plans.length > 0
      ? toNumber(
          plans[0].total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalPlans /
          pageSize
      )
    );

  const startResult =
    totalPlans === 0
      ? 0
      : offset + 1;

  const endResult =
    Math.min(
      offset + plans.length,
      totalPlans
    );

  const hasFilters =
    Boolean(
      search ||
      status ||
      recruitmentStatus ||
      creationMode
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
                Plans and Activities
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Review forming Plans,
                confirmed Activities,
                membership, budgets and
                room activity across UIN.
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
                <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <form
            method="get"
            action="/admin/plans"
            className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_210px_210px_auto_auto]"
          >
            <div>
              <label
                htmlFor="plan-search"
                className="sr-only"
              >
                Search Plans
              </label>

              <input
                id="plan-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search title, host, Activity, location, meeting point, or notes"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="sr-only"
              >
                Plan status
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

                <option value="forming">
                  Forming
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

            <div>
              <label
                htmlFor="creation-mode-filter"
                className="sr-only"
              >
                Creation mode
              </label>

              <select
                id="creation-mode-filter"
                name="mode"
                defaultValue={
                  creationMode
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All creation modes
                </option>

                <option value="matched">
                  Matched Intent
                </option>

                <option value="scheduled_direct">
                  Scheduled Direct
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
                href="/admin/plans"
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
              Plans could not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              The admin Plan query
              returned an error.
            </p>
          </div>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Plan Directory
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {search
                  ? `Results for “${search}”`
                  : "All Plans and Activities"}
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Showing {startResult}–
              {endResult} of{" "}
              {formatNumber(
                totalPlans
              )}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {plans.map((plan) => {
              const hostName =
                plan.host_full_name ??
                "UIN member";

              const title =
                plan.title ||
                plan.activity_name ||
                "UIN Activity";

              const locationText = [
                plan.district,
                plan.city,
              ]
                .filter(Boolean)
                .join(", ");

              const timezone =
                plan.timezone ||
                "Europe/Istanbul";

              const participantLimit =
                plan.max_participants ===
                null
                  ? "Unlimited"
                  : formatNumber(
                      plan.max_participants
                    );

              const targetBudget =
                toNullableNumber(
                  plan.target_budget
                );

              const committedBudget =
                toNumber(
                  plan.committed_budget
                );

              const remainingBudget =
                targetBudget === null
                  ? null
                  : targetBudget -
                    committedBudget;

              const progress =
                getBudgetProgress(
                  plan.target_budget,
                  plan.committed_budget
                );

              return (
                <article
                  key={plan.plan_id}
                  className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <ProfileNameLink
                        username={
                          plan.host_username
                        }
                        title={`View ${hostName}'s profile`}
                        className="group flex w-fit shrink-0 items-center gap-3 rounded-2xl transition hover:bg-green-50"
                      >
                        {plan.host_avatar_url ? (
                          <img
                            src={
                              plan.host_avatar_url
                            }
                            alt={hostName}
                            className="h-14 w-14 rounded-full object-cover transition group-hover:ring-2 group-hover:ring-green-300"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500 transition group-hover:bg-green-100 group-hover:text-green-700">
                            {getInitial(
                              hostName
                            )}
                          </div>
                        )}

                        <div className="pr-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Hosted by
                          </p>

                          <p className="mt-1 font-semibold text-gray-900 transition group-hover:text-green-700">
                            {hostName}
                          </p>

                          {plan.host_username && (
                            <p className="mt-1 text-sm text-gray-500">
                              @
                              {
                                plan.host_username
                              }
                            </p>
                          )}

                          <p className="mt-1 max-w-64 truncate text-xs text-gray-400">
                            {plan.host_email ??
                              "Email unavailable"}
                          </p>
                        </div>
                      </ProfileNameLink>

                      <div className="sm:border-l sm:border-gray-200 sm:pl-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                          {plan.activity_name ??
                            "Unknown Activity"}
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-gray-950">
                          {title}
                        </h3>

                        <p className="mt-1 text-gray-500">
                          {plan.category_name ??
                            "Unknown Category"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                          plan.status
                        )}`}
                      >
                        {plan.status}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getRecruitmentClasses(
                          plan.recruitment_status
                        )}`}
                      >
                        Recruitment:{" "}
                        {
                          plan.recruitment_status
                        }
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getCreationModeClasses(
                          plan.creation_mode
                        )}`}
                      >
                        {getCreationModeLabel(
                          plan.creation_mode
                        )}
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                        {plan.visibility}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                    <p>
                      📅 Availability:{" "}
                      {formatDate(
                        plan.window_start
                      )}{" "}
                      →{" "}
                      {formatDate(
                        plan.window_end
                      )}
                    </p>

                    <p>
                      📍 Area:{" "}
                      {locationText ||
                        "Location unavailable"}
                    </p>

                    <p>
                      👥 Members:{" "}
                      {formatNumber(
                        plan.active_member_count
                      )}
                    </p>

                    <p>
                      👤 Participants:{" "}
                      {formatNumber(
                        plan.active_participant_count
                      )}{" "}
                      / {participantLimit}
                    </p>

                    <p>
                      ↩ Withdrawn:{" "}
                      {formatNumber(
                        plan.withdrawn_member_count
                      )}
                    </p>

                    <p>
                      ⛔ Removed:{" "}
                      {formatNumber(
                        plan.removed_member_count
                      )}
                    </p>

                    <p>
                      💬 Messages:{" "}
                      {formatNumber(
                        plan.message_count
                      )}
                    </p>

                    <p>
                      🕒 Created:{" "}
                      {formatDateTime(
                        plan.created_at,
                        timezone
                      )}
                    </p>
                  </div>

                  {plan.scheduled_start &&
                    plan.scheduled_end && (
                      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Confirmed Schedule
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
                          <p>
                            🕒{" "}
                            {formatDateTime(
                              plan.scheduled_start,
                              timezone
                            )}{" "}
                            →{" "}
                            {formatDateTime(
                              plan.scheduled_end,
                              timezone
                            )}
                          </p>

                          <p>
                            📍{" "}
                            {plan.meeting_point ??
                              "Meeting point not set"}
                          </p>

                          <p>
                            🌍 {timezone}
                          </p>

                          {plan.planned_at && (
                            <p>
                              ✅ Confirmed:{" "}
                              {formatDateTime(
                                plan.planned_at,
                                timezone
                              )}
                            </p>
                          )}
                        </div>

                        {plan.schedule_notes && (
                          <p className="mt-4 whitespace-pre-wrap border-t border-blue-100 pt-4 text-sm leading-6 text-gray-700">
                            {
                              plan.schedule_notes
                            }
                          </p>
                        )}
                      </div>
                    )}

                  <div className="mt-5 rounded-2xl border border-gray-200 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                          Activity Budget
                        </p>

                        <h4 className="mt-1 text-lg font-bold text-gray-900">
                          Budget Summary
                        </h4>
                      </div>

                      <p className="text-xs text-gray-400">
                        Member commitments are
                        estimates, not collected
                        payments.
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Target
                        </p>

                        <p className="mt-2 font-bold text-gray-900">
                          {formatCurrency(
                            plan.target_budget
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-green-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                          Committed
                        </p>

                        <p className="mt-2 font-bold text-green-900">
                          {formatCurrency(
                            plan.committed_budget
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Remaining
                        </p>

                        <p className="mt-2 font-bold text-amber-900">
                          {remainingBudget ===
                          null
                            ? "Not available"
                            : formatCurrency(
                                remainingBudget
                              )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-purple-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                          Actual
                        </p>

                        <p className="mt-2 font-bold text-purple-900">
                          {formatCurrency(
                            plan.actual_budget
                          )}
                        </p>
                      </div>
                    </div>

                    {progress !== null && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
                          <span>
                            Commitment Progress
                          </span>

                          <span>
                            {Math.round(
                              progress
                            )}
                            %
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-green-600"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Planning Messages
                      </p>

                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        {formatNumber(
                          plan.planning_message_count
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Activity Messages
                      </p>

                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        {formatNumber(
                          plan.activity_message_count
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Total Messages
                      </p>

                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        {formatNumber(
                          plan.message_count
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
                    <p className="font-mono text-xs text-gray-400">
                      Plan ID: {plan.plan_id}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/users/${encodeURIComponent(
                          plan.host_username ??
                            plan.host_user_id
                        )}`}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
                      >
                        Manage Host
                      </Link>

                      <Link
                        href={`/plans/${plan.plan_id}`}
                        className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                      >
                        {plan.status ===
                        "forming"
                          ? "Open Planning Room"
                          : "Open Activity Room"}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}

            {plans.length === 0 &&
              !error && (
                <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900">
                    No Plans found.
                  </h3>

                  <p className="mt-3 text-gray-500">
                    No Plan matches the
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
                      recruitmentStatus,
                      creationMode,
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
                      recruitmentStatus,
                      creationMode,
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