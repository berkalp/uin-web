import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import RestrictionActions from "@/components/admin/RestrictionActions";
import { createClient } from "@/utils/supabase/server";

type AdminRole =
  | "owner"
  | "admin"
  | "moderator"
  | "support";

type RestrictionsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    type?: string | string[];
    page?: string | string[];
  }>;
};

type RestrictionRow = {
  restriction_id: string;

  user_id: string;
  user_full_name: string | null;
  user_username: string | null;
  user_avatar_url: string | null;
  user_email: string | null;

  restriction_type: string;
  stored_status: string;
  effective_status: string;

  reason: string;
  internal_notes: string | null;

  source_report_id: string | null;

  created_by: string;
  created_by_full_name: string | null;
  created_by_username: string | null;

  starts_at: string;
  ends_at: string | null;

  revoked_at: string | null;
  revoked_by: string | null;
  revoked_by_full_name: string | null;
  revoked_by_username: string | null;
  revocation_reason: string | null;

  created_at: string;
  updated_at: string;

  total_count:
    | number
    | string;
};

function getFirstValue(
  value:
    | string
    | string[]
    | undefined
) {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parsePage(
  value: string
) {
  const parsedValue =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      parsedValue
    ) ||
    parsedValue < 1
  ) {
    return 1;
  }

  return parsedValue;
}

function formatDateTime(
  value:
    | string
    | null
) {
  if (!value) {
    return "Not set";
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

function getRestrictionTypeLabel(
  value: string
) {
  if (value === "requests") {
    return "Participation Requests";
  }

  if (value === "messaging") {
    return "Messaging";
  }

  if (
    value === "intent_creation"
  ) {
    return "Intent Creation";
  }

  if (
    value === "plan_creation"
  ) {
    return "Plan Creation";
  }

  if (
    value === "account_access"
  ) {
    return "Account Access";
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function getStatusClasses(
  value: string
) {
  if (value === "active") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value === "expired") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-gray-200 bg-gray-100 text-gray-700";
}

function getTypeClasses(
  value: string
) {
  if (
    value === "account_access"
  ) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (
    value === "messaging"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (
    value === "requests"
  ) {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (
    value === "intent_creation"
  ) {
    return "border-green-200 bg-green-50 text-green-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function buildPageUrl({
  search,
  status,
  restrictionType,
  page,
}: {
  search: string;
  status: string;
  restrictionType: string;
  page: number;
}) {
  const params =
    new URLSearchParams();

  if (search) {
    params.set(
      "q",
      search
    );
  }

  if (status) {
    params.set(
      "status",
      status
    );
  }

  if (restrictionType) {
    params.set(
      "type",
      restrictionType
    );
  }

  if (page > 1) {
    params.set(
      "page",
      String(page)
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/admin/moderation/restrictions?${queryString}`
    : "/admin/moderation/restrictions";
}

export default async function AdminRestrictionsPage({
  searchParams,
}: RestrictionsPageProps) {
  const resolvedSearchParams =
    await searchParams;

  const search =
    getFirstValue(
      resolvedSearchParams.q
    ).trim();

  const status =
    getFirstValue(
      resolvedSearchParams.status
    )
      .trim()
      .toLowerCase();

  const restrictionType =
    getFirstValue(
      resolvedSearchParams.type
    )
      .trim()
      .toLowerCase();

  const currentPage =
    parsePage(
      getFirstValue(
        resolvedSearchParams.page
      )
    );

  const pageSize = 25;

  const offset =
    (
      currentPage - 1
    ) * pageSize;

  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data: roleData,
    error: roleError,
  } = await supabase.rpc(
    "get_admin_role"
  );

  if (
    roleError ||
    !roleData
  ) {
    redirect("/timeline");
  }

  const adminRole =
    roleData as AdminRole;

  const canManage =
    adminRole === "owner" ||
    adminRole === "admin" ||
    adminRole === "moderator";

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_user_restrictions",
    {
      p_search:
        search || null,
      p_status:
        status || null,
      p_restriction_type:
        restrictionType ||
        null,
      p_limit:
        pageSize,
      p_offset:
        offset,
    }
  );

  if (error) {
    console.error(
      "Admin restriction query failed:",
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

  const restrictions =
    (
      data ?? []
    ) as RestrictionRow[];

  const totalCount =
    restrictions.length > 0
      ? Number(
          restrictions[0]
            .total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalCount /
          pageSize
      )
    );

  const previousPageUrl =
    buildPageUrl({
      search,
      status,
      restrictionType,
      page:
        Math.max(
          1,
          currentPage - 1
        ),
    });

  const nextPageUrl =
    buildPageUrl({
      search,
      status,
      restrictionType,
      page:
        Math.min(
          totalPages,
          currentPage + 1
        ),
    });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/admin/moderation"
              className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
            >
              ← Back to Moderation
            </Link>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-red-600">
              Moderation
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-950 md:text-4xl">
              User Restrictions
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
              Review active, expired and
              revoked restrictions applied
              to UIN accounts.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Administrator Role
            </p>

            <p className="mt-2 font-bold capitalize text-gray-900">
              {adminRole}
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <form
            method="get"
            className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_240px_auto]"
          >
            <div>
              <label
                htmlFor="restriction-search"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Search
              </label>

              <input
                id="restriction-search"
                type="search"
                name="q"
                defaultValue={
                  search
                }
                placeholder="Name, username, email or reason"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="restriction-status"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Status
              </label>

              <select
                id="restriction-status"
                name="status"
                defaultValue={
                  status
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All Statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="expired">
                  Expired
                </option>

                <option value="revoked">
                  Revoked
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="restriction-type"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Restriction Type
              </label>

              <select
                id="restriction-type"
                name="type"
                defaultValue={
                  restrictionType
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  All Types
                </option>

                <option value="requests">
                  Participation Requests
                </option>

                <option value="messaging">
                  Messaging
                </option>

                <option value="intent_creation">
                  Intent Creation
                </option>

                <option value="plan_creation">
                  Plan Creation
                </option>

                <option value="account_access">
                  Account Access
                </option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Apply
              </button>

              <Link
                href="/admin/moderation/restrictions"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-900">
                {
                  restrictions.length
                }
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900">
                {totalCount}
              </span>{" "}
              restrictions
            </p>

            <p className="text-sm text-gray-500">
              Page{" "}
              <span className="font-semibold text-gray-900">
                {currentPage}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900">
                {totalPages}
              </span>
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">
                Restrictions could not be
                loaded.
              </p>

              <p className="mt-2 text-sm text-red-700">
                {error.message}
              </p>
            </div>
          )}

          <div className="mt-5 space-y-5">
            {restrictions.map(
              (restriction) => {
                const displayName =
                  restriction.user_full_name ||
                  restriction.user_username ||
                  restriction.user_email ||
                  "UIN member";

                const creatorName =
                  restriction.created_by_full_name ||
                  restriction.created_by_username ||
                  "Administrator";

                const revokerName =
                  restriction.revoked_by_full_name ||
                  restriction.revoked_by_username ||
                  "Administrator";

                return (
                  <article
                    key={
                      restriction.restriction_id
                    }
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        {restriction.user_avatar_url ? (
                          <img
                            src={
                              restriction.user_avatar_url
                            }
                            alt={
                              displayName
                            }
                            className="h-14 w-14 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-500">
                            {getInitial(
                              displayName
                            )}
                          </div>
                        )}

                        <div className="min-w-0">
                          {restriction.user_username ? (
                            <Link
                              href={`/u/${encodeURIComponent(
                                restriction.user_username
                              )}`}
                              className="block truncate text-lg font-bold text-gray-950 transition hover:text-green-700"
                            >
                              {displayName}
                            </Link>
                          ) : (
                            <p className="truncate text-lg font-bold text-gray-950">
                              {displayName}
                            </p>
                          )}

                          {restriction.user_username && (
                            <p className="mt-1 truncate text-sm text-gray-500">
                              @
                              {
                                restriction.user_username
                              }
                            </p>
                          )}

                          {restriction.user_email && (
                            <p className="mt-1 truncate text-xs text-gray-400">
                              {
                                restriction.user_email
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getTypeClasses(
                            restriction.restriction_type
                          )}`}
                        >
                          {getRestrictionTypeLabel(
                            restriction.restriction_type
                          )}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                            restriction.effective_status
                          )}`}
                        >
                          {
                            restriction.effective_status
                          }
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                      <div>
                        <div className="rounded-2xl bg-gray-50 p-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Restriction Reason
                          </p>

                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                            {
                              restriction.reason
                            }
                          </p>
                        </div>

                        {restriction.internal_notes && (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                              Internal Notes
                            </p>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-amber-900">
                              {
                                restriction.internal_notes
                              }
                            </p>
                          </div>
                        )}

                        {restriction.revocation_reason && (
                          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                              Revocation Reason
                            </p>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-green-900">
                              {
                                restriction.revocation_reason
                              }
                            </p>

                            <p className="mt-3 text-xs text-green-700">
                              Revoked by{" "}
                              <span className="font-semibold">
                                {revokerName}
                              </span>{" "}
                              on{" "}
                              {formatDateTime(
                                restriction.revoked_at
                              )}{" "}
                              TRT
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Restriction Details
                          </p>

                          <dl className="mt-4 space-y-4 text-sm">
                            <div>
                              <dt className="text-gray-500">
                                Starts
                              </dt>

                              <dd className="mt-1 font-semibold text-gray-900">
                                {formatDateTime(
                                  restriction.starts_at
                                )}{" "}
                                TRT
                              </dd>
                            </div>

                            <div>
                              <dt className="text-gray-500">
                                Ends
                              </dt>

                              <dd className="mt-1 font-semibold text-gray-900">
                                {restriction.ends_at
                                  ? `${formatDateTime(
                                      restriction.ends_at
                                    )} TRT`
                                  : "Indefinite"}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-gray-500">
                                Created by
                              </dt>

                              <dd className="mt-1 font-semibold text-gray-900">
                                {
                                  creatorName
                                }
                              </dd>
                            </div>

                            <div>
                              <dt className="text-gray-500">
                                Created
                              </dt>

                              <dd className="mt-1 font-semibold text-gray-900">
                                {formatDateTime(
                                  restriction.created_at
                                )}{" "}
                                TRT
                              </dd>
                            </div>

                            {restriction.source_report_id && (
                              <div>
                                <dt className="text-gray-500">
                                  Source Report
                                </dt>

                                <dd className="mt-1 break-all font-mono text-xs text-gray-700">
                                  {
                                    restriction.source_report_id
                                  }
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>

                        <RestrictionActions
                          restrictionId={
                            restriction.restriction_id
                          }
                          canManage={
                            canManage
                          }
                          effectiveStatus={
                            restriction.effective_status
                          }
                        />
                      </div>
                    </div>
                  </article>
                );
              }
            )}

            {!error &&
              restrictions.length ===
                0 && (
                <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900">
                    No restrictions found.
                  </h2>

                  <p className="mt-3 text-sm text-gray-500">
                    No user restrictions
                    match the current
                    filters.
                  </p>
                </div>
              )}
          </div>

          {totalPages > 1 && (
            <div className="mt-7 flex items-center justify-between">
              {currentPage > 1 ? (
                <Link
                  href={
                    previousPageUrl
                  }
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-xl border border-gray-100 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                  ← Previous
                </span>
              )}

              {currentPage <
              totalPages ? (
                <Link
                  href={
                    nextPageUrl
                  }
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-xl border border-gray-100 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                  Next →
                </span>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}