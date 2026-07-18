import Link from "next/link";

import {
  AdminRole,
  requireAdmin,
} from "@/utils/admin";

type AdminAuditPageProps = {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
};

type AdminAuditRow = {
  log_id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<
    string,
    unknown
  > | null;
  created_at: string;

  actor_full_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  actor_email: string | null;

  target_full_name: string | null;
  target_username: string | null;
  target_avatar_url: string | null;
  target_email: string | null;

  previous_role: string | null;
  new_role: string | null;

  total_count:
    | number
    | string
    | null;
};

type AuditAction =
  | ""
  | "admin_role_changed"
  | "admin_role_removed";

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
  ).format(toNumber(value));
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

function getAuditActionLabel(
  action: string
) {
  if (
    action ===
    "admin_role_changed"
  ) {
    return "Administrator Role Changed";
  }

  if (
    action ===
    "admin_role_removed"
  ) {
    return "Administrator Access Removed";
  }

  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getAuditActionClasses(
  action: string
) {
  if (
    action ===
    "admin_role_removed"
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    action ===
    "admin_role_changed"
  ) {
    return "bg-purple-50 text-purple-700";
  }

  return "bg-gray-100 text-gray-700";
}

function getRoleLabel(
  role: string | null
) {
  if (!role) {
    return "None";
  }

  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Administrator";
  }

  if (role === "moderator") {
    return "Moderator";
  }

  if (role === "support") {
    return "Support";
  }

  if (role === "member") {
    return "Member";
  }

  return role;
}

function getRoleClasses(
  role: string | null
) {
  if (role === "owner") {
    return "bg-gray-950 text-white";
  }

  if (role === "admin") {
    return "bg-purple-50 text-purple-700";
  }

  if (role === "moderator") {
    return "bg-amber-50 text-amber-700";
  }

  if (role === "support") {
    return "bg-blue-50 text-blue-700";
  }

  if (role === "member") {
    return "bg-gray-100 text-gray-700";
  }

  return "bg-gray-100 text-gray-500";
}

function buildPageHref({
  page,
  search,
  action,
}: {
  page: number;
  search: string;
  action: AuditAction;
}) {
  const parameters =
    new URLSearchParams();

  if (search) {
    parameters.set(
      "q",
      search
    );
  }

  if (action) {
    parameters.set(
      "action",
      action
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
    ? `/admin/audit?${queryString}`
    : "/admin/audit";
}

function UserIdentity({
  userId,
  fullName,
  username,
  avatarUrl,
  email,
}: {
  userId: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  email: string | null;
}) {
  const displayName =
    fullName ??
    "Unknown user";

  const identifier =
    username ??
    userId;

  const content = (
    <>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
          {getInitial(
            displayName
          )}
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">
          {displayName}
        </p>

        {username && (
          <p className="mt-0.5 truncate text-xs text-gray-500">
            @{username}
          </p>
        )}

        <p className="mt-0.5 max-w-56 truncate text-xs text-gray-400">
          {email ??
            "Email unavailable"}
        </p>
      </div>
    </>
  );

  if (!identifier) {
    return (
      <div className="flex items-center gap-3">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/admin/users/${encodeURIComponent(
        identifier
      )}`}
      className="group flex w-fit items-center gap-3 rounded-xl transition hover:bg-green-50"
    >
      {content}
    </Link>
  );
}

export default async function AdminAuditPage({
  searchParams,
}: AdminAuditPageProps) {
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

  const rawAction =
    getSingleParameter(
      resolvedSearchParams.action
    );

  const action: AuditAction =
    rawAction ===
      "admin_role_changed" ||
    rawAction ===
      "admin_role_removed"
      ? rawAction
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
    "get_admin_audit_logs",
    {
      p_search:
        search || null,
      p_action:
        action || null,
      p_limit:
        pageSize,
      p_offset:
        offset,
    }
  );

  if (error) {
    console.error(
      "Admin audit query failed:",
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

  const logs =
    (
      data ?? []
    ) as unknown as AdminAuditRow[];

  const totalLogs =
    logs.length > 0
      ? toNumber(
          logs[0].total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalLogs /
          pageSize
      )
    );

  const startResult =
    totalLogs === 0
      ? 0
      : offset + 1;

  const endResult =
    Math.min(
      offset + logs.length,
      totalLogs
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
                Audit Log
              </h1>

              <p className="mt-3 max-w-2xl text-gray-500">
                Review administrative
                actions and role changes
                across UIN.
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
                href="/admin/users"
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Users
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <form
            method="get"
            action="/admin/audit"
            className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto_auto]"
          >
            <div>
              <label
                htmlFor="audit-search"
                className="sr-only"
              >
                Search audit records
              </label>

              <input
                id="audit-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search administrators, users, emails, actions, or metadata"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="action-filter"
                className="sr-only"
              >
                Filter by action
              </label>

              <select
                id="action-filter"
                name="action"
                defaultValue={action}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All actions
                </option>

                <option value="admin_role_changed">
                  Role changed
                </option>

                <option value="admin_role_removed">
                  Admin access removed
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-gray-950 px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Apply Filters
            </button>

            {(search ||
              action) && (
              <Link
                href="/admin/audit"
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
              Audit records could not
              be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              The audit query returned
              an error.
            </p>
          </div>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                Administrative History
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {search
                  ? `Results for “${search}”`
                  : "Recent actions"}
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Showing {startResult}–
              {endResult} of{" "}
              {formatNumber(
                totalLogs
              )}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {logs.map((log) => {
              const actorName =
                log.actor_full_name ??
                "Unknown administrator";

              const targetName =
                log.target_full_name ??
                "Unknown user";

              return (
                <article
                  key={log.log_id}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getAuditActionClasses(
                          log.action
                        )}`}
                      >
                        {getAuditActionLabel(
                          log.action
                        )}
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                        {log.entity_type}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500">
                      {formatDateTime(
                        log.created_at
                      )}{" "}
                      TRT
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] lg:items-center">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Performed by
                      </p>

                      <UserIdentity
                        userId={
                          log.admin_user_id
                        }
                        fullName={
                          log.actor_full_name
                        }
                        username={
                          log.actor_username
                        }
                        avatarUrl={
                          log.actor_avatar_url
                        }
                        email={
                          log.actor_email
                        }
                      />
                    </div>

                    <div className="hidden text-center text-2xl text-gray-300 lg:block">
                      →
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Target user
                      </p>

                      <UserIdentity
                        userId={
                          log.entity_id
                        }
                        fullName={
                          log.target_full_name
                        }
                        username={
                          log.target_username
                        }
                        avatarUrl={
                          log.target_avatar_url
                        }
                        email={
                          log.target_email
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Previous Role
                      </p>

                      <span
                        className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleClasses(
                          log.previous_role
                        )}`}
                      >
                        {getRoleLabel(
                          log.previous_role
                        )}
                      </span>
                    </div>

                    <div className="hidden text-center text-xl text-gray-400 sm:block">
                      →
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        New Role
                      </p>

                      <span
                        className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleClasses(
                          log.new_role
                        )}`}
                      >
                        {getRoleLabel(
                          log.new_role
                        )}
                      </span>
                    </div>
                  </div>

                  {log.metadata && (
                    <details className="mt-5 rounded-2xl border border-gray-200 bg-gray-50">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700">
                        Technical details
                      </summary>

                      <pre className="overflow-x-auto border-t border-gray-200 p-4 text-xs leading-6 text-gray-600">
                        {JSON.stringify(
                          log.metadata,
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  )}
                </article>
              );
            })}

            {logs.length === 0 &&
              !error && (
                <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900">
                    No audit records found.
                  </h3>

                  <p className="mt-3 text-gray-500">
                    No administrative action
                    matches the current
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
                      action,
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
                      action,
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