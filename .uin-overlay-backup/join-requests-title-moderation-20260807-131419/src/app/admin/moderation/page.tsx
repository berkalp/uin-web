import Link from "next/link";

import ModerationActions from "@/components/admin/ModerationActions";
import ProfileNameLink from "@/components/profile/ProfileNameLink";
import {
  AdminRole,
  requireAdmin,
} from "@/utils/admin";

type AdminModerationPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

type ModerationStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "dismissed";

type ModerationPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type ModerationTargetType =
  | "user"
  | "intent"
  | "plan"
  | "message"
  | "request";

type ModerationSummary = {
  open_reports: number | string | null;
  under_review_reports: number | string | null;
  urgent_reports: number | string | null;
  active_restrictions: number | string | null;
  resolved_last_30_days: number | string | null;
  dismissed_last_30_days: number | string | null;
};

type ModerationReportRow = {
  report_id: string;

  reporter_user_id: string;
  reporter_full_name: string | null;
  reporter_username: string | null;
  reporter_avatar_url: string | null;
  reporter_email: string | null;

  reported_user_id: string | null;
  reported_full_name: string | null;
  reported_username: string | null;
  reported_avatar_url: string | null;
  reported_email: string | null;

  target_type: ModerationTargetType;
  target_id: string;
  target_label: string | null;

  reason: string;
  details: string | null;
  status: ModerationStatus;
  priority: ModerationPriority;

  assigned_admin_id: string | null;
  assigned_admin_full_name: string | null;
  assigned_admin_username: string | null;

  resolution_summary: string | null;

  resolved_by: string | null;
  resolved_by_full_name: string | null;
  resolved_by_username: string | null;

  active_restriction_count: number | string | null;

  created_at: string;
  updated_at: string;
  resolved_at: string | null;

  total_count: number | string | null;
};

type SummaryCardProps = {
  label: string;
  value: number;
  description: string;
  tone:
    | "gray"
    | "blue"
    | "amber"
    | "red"
    | "green"
    | "purple";
};

type UserIdentityProps = {
  label: string;
  userId: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  email: string | null;
};

function getSingleParameter(
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function toNumber(
  value: number | string | null | undefined
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

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function formatNumber(
  value: number | string | null
) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(toNumber(value));
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
      timeZone: "Europe/Istanbul",
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
  value: string | null | undefined
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

function getStatusLabel(
  status: ModerationStatus
) {
  if (status === "open") {
    return "Open";
  }

  if (status === "under_review") {
    return "Under Review";
  }

  if (status === "resolved") {
    return "Resolved";
  }

  return "Dismissed";
}

function getStatusClasses(
  status: ModerationStatus
) {
  if (status === "open") {
    return "bg-red-50 text-red-700";
  }

  if (status === "under_review") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "resolved") {
    return "bg-green-50 text-green-700";
  }

  return "bg-gray-100 text-gray-700";
}

function getPriorityLabel(
  priority: ModerationPriority
) {
  if (priority === "urgent") {
    return "Urgent";
  }

  if (priority === "high") {
    return "High";
  }

  if (priority === "normal") {
    return "Normal";
  }

  return "Low";
}

function getPriorityClasses(
  priority: ModerationPriority
) {
  if (priority === "urgent") {
    return "bg-red-600 text-white";
  }

  if (priority === "high") {
    return "bg-orange-50 text-orange-700";
  }

  if (priority === "normal") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-gray-100 text-gray-600";
}

function getReasonLabel(
  reason: string
) {
  if (reason === "spam") {
    return "Spam";
  }

  if (reason === "harassment") {
    return "Harassment";
  }

  if (reason === "hate_or_abuse") {
    return "Hate or Abuse";
  }

  if (reason === "sexual_content") {
    return "Sexual Content";
  }

  if (reason === "violence_or_threat") {
    return "Violence or Threat";
  }

  if (reason === "fraud_or_scam") {
    return "Fraud or Scam";
  }

  if (reason === "privacy") {
    return "Privacy";
  }

  if (reason === "impersonation") {
    return "Impersonation";
  }

  if (reason === "child_safety") {
    return "Child Safety";
  }

  if (reason === "self_harm") {
    return "Self-Harm";
  }

  if (reason === "illegal_activity") {
    return "Illegal Activity";
  }

  if (reason === "other") {
    return "Other";
  }

  return reason
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function getTargetTypeLabel(
  targetType: ModerationTargetType
) {
  if (targetType === "user") {
    return "User";
  }

  if (targetType === "intent") {
    return "Intent";
  }

  if (targetType === "plan") {
    return "Plan";
  }

  if (targetType === "message") {
    return "Room Message";
  }

  return "Participation Request";
}

function getTargetTypeClasses(
  targetType: ModerationTargetType
) {
  if (targetType === "user") {
    return "bg-purple-50 text-purple-700";
  }

  if (targetType === "intent") {
    return "bg-green-50 text-green-700";
  }

  if (targetType === "plan") {
    return "bg-blue-50 text-blue-700";
  }

  if (targetType === "message") {
    return "bg-cyan-50 text-cyan-700";
  }

  return "bg-amber-50 text-amber-700";
}

function getSummaryCardClasses(
  tone: SummaryCardProps["tone"]
) {
  if (tone === "blue") {
    return {
      wrapper:
        "border-blue-100 bg-blue-50",
      label:
        "text-blue-700",
      value:
        "text-blue-950",
    };
  }

  if (tone === "amber") {
    return {
      wrapper:
        "border-amber-100 bg-amber-50",
      label:
        "text-amber-700",
      value:
        "text-amber-950",
    };
  }

  if (tone === "red") {
    return {
      wrapper:
        "border-red-100 bg-red-50",
      label:
        "text-red-700",
      value:
        "text-red-950",
    };
  }

  if (tone === "green") {
    return {
      wrapper:
        "border-green-100 bg-green-50",
      label:
        "text-green-700",
      value:
        "text-green-950",
    };
  }

  if (tone === "purple") {
    return {
      wrapper:
        "border-purple-100 bg-purple-50",
      label:
        "text-purple-700",
      value:
        "text-purple-950",
    };
  }

  return {
    wrapper:
      "border-gray-200 bg-gray-50",
    label:
      "text-gray-600",
    value:
      "text-gray-950",
  };
}

function buildPageHref({
  page,
  search,
  status,
  priority,
  targetType,
}: {
  page: number;
  search: string;
  status: string;
  priority: string;
  targetType: string;
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

  if (priority) {
    parameters.set(
      "priority",
      priority
    );
  }

  if (targetType) {
    parameters.set(
      "target",
      targetType
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
    ? `/admin/moderation?${queryString}`
    : "/admin/moderation";
}

function getTargetHref(
  report: ModerationReportRow
) {
  if (report.target_type === "user") {
    const identifier =
      report.reported_username ||
      report.reported_user_id;

    if (!identifier) {
      return null;
    }

    return `/admin/users/${encodeURIComponent(
      identifier
    )}`;
  }

  if (report.target_type === "plan") {
    return `/plans/${report.target_id}`;
  }

  if (report.target_type === "intent") {
    return `/admin/intents?q=${encodeURIComponent(
      report.target_id
    )}`;
  }

  if (report.target_type === "request") {
    return `/admin/requests?q=${encodeURIComponent(
      report.target_id
    )}`;
  }

  return `/admin/plans?q=${encodeURIComponent(
    report.target_id
  )}`;
}

function SummaryCard({
  label,
  value,
  description,
  tone,
}: SummaryCardProps) {
  const classes =
    getSummaryCardClasses(tone);

  return (
    <article
      className={`rounded-3xl border p-5 ${classes.wrapper}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${classes.label}`}
      >
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-bold ${classes.value}`}
      >
        {formatNumber(value)}
      </p>

      <p className="mt-2 text-sm leading-6 text-gray-600">
        {description}
      </p>
    </article>
  );
}

function UserIdentity({
  label,
  userId,
  fullName,
  username,
  avatarUrl,
  email,
}: UserIdentityProps) {
  const displayName =
    fullName || "Unknown user";

  const managementIdentifier =
    username || userId;

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

          {managementIdentifier && (
            <Link
              href={`/admin/users/${encodeURIComponent(
                managementIdentifier
              )}`}
              className="mt-3 inline-flex text-xs font-semibold text-green-700 transition hover:text-green-800"
            >
              Manage User →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function AdminModerationPage({
  searchParams,
}: AdminModerationPageProps) {
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
    rawStatus === "open" ||
    rawStatus === "under_review" ||
    rawStatus === "resolved" ||
    rawStatus === "dismissed"
      ? rawStatus
      : "";

  const rawPriority =
    getSingleParameter(
      resolvedSearchParams.priority
    );

  const priority =
    rawPriority === "low" ||
    rawPriority === "normal" ||
    rawPriority === "high" ||
    rawPriority === "urgent"
      ? rawPriority
      : "";

  const rawTargetType =
    getSingleParameter(
      resolvedSearchParams.target
    );

  const targetType =
    rawTargetType === "user" ||
    rawTargetType === "intent" ||
    rawTargetType === "plan" ||
    rawTargetType === "message" ||
    rawTargetType === "request"
      ? rawTargetType
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

  const [
    summaryResponse,
    reportsResponse,
  ] = await Promise.all([
    supabase.rpc(
      "get_admin_moderation_summary"
    ),

    supabase.rpc(
      "get_admin_moderation_reports",
      {
        p_search:
          search || null,
        p_status:
          status || null,
        p_priority:
          priority || null,
        p_target_type:
          targetType || null,
        p_limit:
          pageSize,
        p_offset:
          offset,
      }
    ),
  ]);

  if (summaryResponse.error) {
    console.error(
      "Admin moderation summary query failed:",
      {
        message:
          summaryResponse.error.message,
        code:
          summaryResponse.error.code,
        details:
          summaryResponse.error.details,
        hint:
          summaryResponse.error.hint,
      }
    );
  }

  if (reportsResponse.error) {
    console.error(
      "Admin moderation reports query failed:",
      {
        message:
          reportsResponse.error.message,
        code:
          reportsResponse.error.code,
        details:
          reportsResponse.error.details,
        hint:
          reportsResponse.error.hint,
      }
    );
  }

  const summary =
    (
      (
        summaryResponse.data ?? []
      ) as ModerationSummary[]
    )[0] ?? null;

  const reports =
    (
      reportsResponse.data ?? []
    ) as unknown as ModerationReportRow[];

  const totalReports =
    reports.length > 0
      ? toNumber(
          reports[0].total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalReports /
          pageSize
      )
    );

  const startResult =
    totalReports === 0
      ? 0
      : offset + 1;

  const endResult =
    Math.min(
      offset + reports.length,
      totalReports
    );

  const hasFilters =
    Boolean(
      search ||
      status ||
      priority ||
      targetType
    );

  const canManageModeration =
    role === "owner" ||
    role === "admin" ||
    role === "moderator";

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

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    canManageModeration
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {canManageModeration
                    ? "Moderation Actions Enabled"
                    : "Read-Only Access"}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Moderation
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Review reports, priorities,
                affected users, target
                content and moderation
                outcomes across UIN.
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
                href="/admin/audit"
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Audit Log
              </Link>
            </div>
          </div>
        </header>

        {(summaryResponse.error ||
          reportsResponse.error) && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Moderation data could not
              be loaded completely.
            </p>

            <p className="mt-2 text-sm text-red-700">
              One or more moderation
              queries returned an error.
            </p>
          </div>
        )}

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Moderation Overview
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Current workload
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              label="Open Reports"
              value={toNumber(
                summary?.open_reports
              )}
              description="Reports waiting for initial review."
              tone="red"
            />

            <SummaryCard
              label="Under Review"
              value={toNumber(
                summary?.under_review_reports
              )}
              description="Reports currently assigned for investigation."
              tone="amber"
            />

            <SummaryCard
              label="Urgent Reports"
              value={toNumber(
                summary?.urgent_reports
              )}
              description="Urgent unresolved reports requiring attention."
              tone="red"
            />

            <SummaryCard
              label="Active Restrictions"
              value={toNumber(
                summary?.active_restrictions
              )}
              description="User restrictions currently being enforced."
              tone="blue"
            />

            <SummaryCard
              label="Resolved · 30 Days"
              value={toNumber(
                summary?.resolved_last_30_days
              )}
              description="Reports resolved during the last 30 days."
              tone="green"
            />

            <SummaryCard
              label="Dismissed · 30 Days"
              value={toNumber(
                summary?.dismissed_last_30_days
              )}
              description="Reports dismissed during the last 30 days."
              tone="gray"
            />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <form
            method="get"
            action="/admin/moderation"
            className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1fr)_190px_180px_190px_auto_auto]"
          >
            <div>
              <label
                htmlFor="moderation-search"
                className="sr-only"
              >
                Search reports
              </label>

              <input
                id="moderation-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search users, reasons, details, content, or resolution"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="sr-only"
              >
                Report status
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

                <option value="open">
                  Open
                </option>

                <option value="under_review">
                  Under Review
                </option>

                <option value="resolved">
                  Resolved
                </option>

                <option value="dismissed">
                  Dismissed
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="priority-filter"
                className="sr-only"
              >
                Priority
              </label>

              <select
                id="priority-filter"
                name="priority"
                defaultValue={priority}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All priorities
                </option>

                <option value="urgent">
                  Urgent
                </option>

                <option value="high">
                  High
                </option>

                <option value="normal">
                  Normal
                </option>

                <option value="low">
                  Low
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="target-filter"
                className="sr-only"
              >
                Target type
              </label>

              <select
                id="target-filter"
                name="target"
                defaultValue={
                  targetType
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All target types
                </option>

                <option value="user">
                  User
                </option>

                <option value="intent">
                  Intent
                </option>

                <option value="plan">
                  Plan
                </option>

                <option value="message">
                  Room Message
                </option>

                <option value="request">
                  Request
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
                href="/admin/moderation"
                className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-center font-semibold text-gray-700 transition hover:border-red-300 hover:text-red-700"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Report Queue
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {search
                  ? `Results for “${search}”`
                  : "All Moderation Reports"}
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Showing {startResult}–
              {endResult} of{" "}
              {formatNumber(
                totalReports
              )}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {reports.map(
              (report) => {
                const targetHref =
                  getTargetHref(
                    report
                  );

                const assignmentName =
                  report.assigned_admin_full_name ||
                  report.assigned_admin_username;

                const resolverName =
                  report.resolved_by_full_name ||
                  report.resolved_by_username;

                return (
                  <article
                    key={
                      report.report_id
                    }
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClasses(
                              report.priority
                            )}`}
                          >
                            {getPriorityLabel(
                              report.priority
                            )}{" "}
                            Priority
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              report.status
                            )}`}
                          >
                            {getStatusLabel(
                              report.status
                            )}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getTargetTypeClasses(
                              report.target_type
                            )}`}
                          >
                            {getTargetTypeLabel(
                              report.target_type
                            )}
                          </span>

                          {toNumber(
                            report.active_restriction_count
                          ) > 0 && (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                              {formatNumber(
                                report.active_restriction_count
                              )}{" "}
                              Active Restriction
                            </span>
                          )}
                        </div>

                        <h3 className="mt-4 text-2xl font-bold text-gray-950">
                          {getReasonLabel(
                            report.reason
                          )}
                        </h3>

                        <p className="mt-2 text-sm text-gray-500">
                          Reported{" "}
                          {formatDateTime(
                            report.created_at
                          )}{" "}
                          TRT
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        <p>
                          <span className="font-semibold text-gray-800">
                            Assigned:
                          </span>{" "}
                          {assignmentName ||
                            "Not assigned"}
                        </p>

                        {report.resolved_at && (
                          <p className="mt-1">
                            <span className="font-semibold text-gray-800">
                              Closed:
                            </span>{" "}
                            {formatDateTime(
                              report.resolved_at
                            )}{" "}
                            TRT
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_60px_minmax(0,1fr)] lg:items-center">
                      <UserIdentity
                        label="Reported by"
                        userId={
                          report.reporter_user_id
                        }
                        fullName={
                          report.reporter_full_name
                        }
                        username={
                          report.reporter_username
                        }
                        avatarUrl={
                          report.reporter_avatar_url
                        }
                        email={
                          report.reporter_email
                        }
                      />

                      <div className="hidden text-center text-2xl text-gray-300 lg:block">
                        →
                      </div>

                      <UserIdentity
                        label="Reported user"
                        userId={
                          report.reported_user_id
                        }
                        fullName={
                          report.reported_full_name
                        }
                        username={
                          report.reported_username
                        }
                        avatarUrl={
                          report.reported_avatar_url
                        }
                        email={
                          report.reported_email
                        }
                      />
                    </div>

                    <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Reported Target
                          </p>

                          <h4 className="mt-2 text-lg font-bold text-gray-900">
                            {report.target_label ||
                              getTargetTypeLabel(
                                report.target_type
                              )}
                          </h4>

                          <p className="mt-2 text-sm text-gray-500">
                            {getTargetTypeLabel(
                              report.target_type
                            )}
                          </p>
                        </div>

                        {targetHref ? (
                          <Link
                            href={targetHref}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
                          >
                            Review Target
                          </Link>
                        ) : (
                          <span className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-center text-sm font-semibold text-gray-400">
                            Target Unavailable
                          </span>
                        )}
                      </div>

                      <p className="mt-4 break-all border-t border-gray-200 pt-4 font-mono text-xs text-gray-400">
                        Target ID:{" "}
                        {report.target_id}
                      </p>
                    </div>

                    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Report Details
                      </p>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {report.details ||
                          "No additional details were provided."}
                      </p>
                    </div>

                    {report.resolution_summary && (
                      <div
                        className={`mt-5 rounded-2xl border p-5 ${
                          report.status ===
                          "resolved"
                            ? "border-green-100 bg-green-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            report.status ===
                            "resolved"
                              ? "text-green-700"
                              : "text-gray-600"
                          }`}
                        >
                          Resolution
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {
                            report.resolution_summary
                          }
                        </p>

                        <p className="mt-3 text-xs text-gray-500">
                          Resolved by{" "}
                          {resolverName ||
                            "Unknown administrator"}
                        </p>
                      </div>
                    )}

                    <ModerationActions
                      reportId={
                        report.report_id
                      }
                      reportedUserId={
                        report.reported_user_id
                      }
                      reportStatus={
                        report.status
                      }
                      canManage={
                        canManageModeration
                      }
                    />

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
                      <p className="break-all font-mono text-xs text-gray-400">
                        Report ID:{" "}
                        {report.report_id}
                      </p>

                      {report.reported_user_id && (
                        <Link
                          href={`/admin/users/${encodeURIComponent(
                            report.reported_username ||
                              report.reported_user_id
                          )}`}
                          className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                          Review Reported User
                        </Link>
                      )}
                    </div>
                  </article>
                );
              }
            )}

            {reports.length === 0 &&
              !reportsResponse.error && (
                <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900">
                    No moderation reports
                    found.
                  </h3>

                  <p className="mt-3 text-gray-500">
                    No report matches the
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
                      priority,
                      targetType,
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
                      priority,
                      targetType,
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