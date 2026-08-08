import Link from "next/link";

import AdminRoleControl from "@/components/admin/AdminRoleControl";
import {
  AdminRole,
  getMyStaffCapabilitySet,
  requireAdmin,
} from "@/utils/admin";

type AdminUsersPageProps = {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
};

type AdminUserRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  profile_created_at: string;
  profile_updated_at: string;
  admin_role: AdminRole | null;
  active_intent_count:
    | number
    | string
    | null;
  hosted_plan_count:
    | number
    | string
    | null;
  joined_plan_count:
    | number
    | string
    | null;
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
  ).format(toNumber(value));
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
  ).format(new Date(value));
}

function getInitial(
  name: string | null
) {
  return (
    name
      ?.trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function getRoleLabel(
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

function getRoleClasses(
  role: AdminRole
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

  return "bg-blue-50 text-blue-700";
}

function buildPageHref(
  page: number,
  search: string
) {
  const parameters =
    new URLSearchParams();

  if (search) {
    parameters.set(
      "q",
      search
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
    ? `/admin/users?${queryString}`
    : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const myCapabilities = await getMyStaffCapabilitySet(supabase);
  // Owner permissions are authoritative from requireAdmin().
  // Do not hide owner controls if the optional capability RPC is unavailable
  // during a migration/deploy boundary. Backend RPCs still enforce access.
  const isOwner = role === "owner";
  const canMessageStaff = isOwner || myCapabilities.has("staff_messaging");
  const canMessageMembers = isOwner || myCapabilities.has("member_messaging");
  const canEditProfiles = isOwner || myCapabilities.has("edit_profiles");

  const resolvedSearchParams =
    await searchParams;

  const search =
    getSingleParameter(
      resolvedSearchParams.q
    )
      .trim()
      .slice(0, 80);

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

  const pageSize = 25;

  const offset =
    (currentPage - 1) *
    pageSize;

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_users",
    {
      p_search:
        search || null,
      p_limit: pageSize,
      p_offset: offset,
    }
  );

  if (error) {
    console.error(
      "Admin users query failed:",
      {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }
    );
  }

  const users =
    (
      data ?? []
    ) as unknown as AdminUserRow[];

  const totalUsers =
    users.length > 0
      ? toNumber(
          users[0].total_count
        )
      : 0;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalUsers /
          pageSize
      )
    );

  const startResult =
    totalUsers === 0
      ? 0
      : offset + 1;

  const endResult =
    Math.min(
      offset + users.length,
      totalUsers
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
                  {getRoleLabel(role)}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Users
              </h1>

              <p className="mt-3 max-w-2xl text-gray-500">
                Search profiles and review
                account activity across UIN.
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
            action="/admin/users"
            className="flex flex-col gap-3 md:flex-row"
          >
            <div className="flex-1">
              <label
                htmlFor="user-search"
                className="sr-only"
              >
                Search users
              </label>

              <input
                id="user-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={80}
                placeholder="Search by name, username, email, city, or country"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-gray-950 px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Search
            </button>

            {search && (
              <Link
                href="/admin/users"
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
              Users could not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              The admin user query returned
              an error.
            </p>
          </div>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                User Directory
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950">
                {search
                  ? `Results for “${search}”`
                  : "All users"}
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Showing {startResult}–
              {endResult} of{" "}
              {formatNumber(
                totalUsers
              )}
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      User
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Location
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Role
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Admin Access
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Active Intents
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Hosted Plans
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Active Joins
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Joined
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {users.map(
                    (profile) => {
                      const displayName =
                        profile.full_name ??
                        "UIN member";

                      const location = [
                        profile.city,
                        profile.country,
                      ]
                        .filter(Boolean)
                        .join(", ");

                      const adminDetailHref =
                        `/admin/users/${encodeURIComponent(
                          profile.username ??
                            profile.user_id
                        )}`;

                      const publicProfileHref =
                        profile.username
                          ? `/u/${encodeURIComponent(
                              profile.username
                            )}`
                          : null;

                      return (
                        <tr
                          key={
                            profile.user_id
                          }
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={
                                adminDetailHref
                              }
                              className="group flex w-fit items-center gap-3"
                            >
                              {profile.avatar_url ? (
                                <img
                                  src={
                                    profile.avatar_url
                                  }
                                  alt={
                                    displayName
                                  }
                                  className="h-11 w-11 shrink-0 rounded-full object-cover transition group-hover:ring-2 group-hover:ring-green-300"
                                />
                              ) : (
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500 transition group-hover:bg-green-100 group-hover:text-green-700">
                                  {getInitial(
                                    displayName
                                  )}
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="max-w-64 truncate font-semibold text-gray-900 transition group-hover:text-green-700 group-hover:underline group-hover:underline-offset-4">
                                  {displayName}
                                </p>

                                {profile.username && (
                                  <p className="mt-1 max-w-64 truncate text-sm text-gray-500">
                                    @
                                    {
                                      profile.username
                                    }
                                  </p>
                                )}

                                <p className="mt-1 max-w-64 truncate text-xs text-gray-400">
                                  {profile.email ??
                                    "No email"}
                                </p>
                              </div>
                            </Link>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                            {location ||
                              "Not provided"}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            {profile.admin_role ? (
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleClasses(
                                  profile.admin_role
                                )}`}
                              >
                                {getRoleLabel(
                                  profile.admin_role
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">
                                Member
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {role === "owner" ? (
                              <AdminRoleControl
                                userId={
                                  profile.user_id
                                }
                                currentRole={
                                  profile.admin_role
                                }
                              />
                            ) : (
                              <span className="text-xs font-semibold text-gray-400">
                                Owner access required
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                            {formatNumber(
                              profile.active_intent_count
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                            {formatNumber(
                              profile.hosted_plan_count
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                            {formatNumber(
                              profile.joined_plan_count
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                            {formatDate(
                              profile.profile_created_at
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {((profile.admin_role
                                ? canMessageStaff || canMessageMembers
                                : canMessageMembers) &&
                                profile.user_id !== user.id) && (
                                <Link
                                  href={`/messages/new?userId=${encodeURIComponent(profile.user_id)}`}
                                  className="whitespace-nowrap rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 transition hover:border-green-400 hover:bg-green-100"
                                >
                                  Message
                                </Link>
                              )}

                              {canEditProfiles && (
                                <Link
                                  href={`${adminDetailHref}/edit`}
                                  className="whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 transition hover:border-blue-400 hover:bg-blue-100"
                                >
                                  Edit
                                </Link>
                              )}

                              {publicProfileHref && (
                                <Link
                                  href={
                                    publicProfileHref
                                  }
                                  className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-green-500 hover:text-green-700"
                                >
                                  Public Profile
                                </Link>
                              )}

                              <Link
                                href={
                                  adminDetailHref
                                }
                                className="whitespace-nowrap rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                              >
                                Manage
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {users.length ===
                    0 &&
                    !error && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-16 text-center"
                        >
                          <h3 className="text-xl font-bold text-gray-900">
                            No users found.
                          </h3>

                          <p className="mt-2 text-gray-500">
                            No profile matches
                            the current search.
                          </p>
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
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
                    href={buildPageHref(
                      currentPage - 1,
                      search
                    )}
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
                    href={buildPageHref(
                      currentPage + 1,
                      search
                    )}
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