import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import StaffPermissionControl from "@/components/admin/StaffPermissionControl";
import {
  AdminRole,
  getMyStaffCapabilitySet,
  requireAdmin,
} from "@/utils/admin";

type AdminUserDetailPageProps = {
  params: Promise<
    Record<string, string>
  >;
};

type AdminUserDetail = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  email: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  profile_created_at: string;
  profile_updated_at: string;
  admin_role: AdminRole | null;
  total_intent_count:
    | number
    | string
    | null;
  active_intent_count:
    | number
    | string
    | null;
  planned_intent_count:
    | number
    | string
    | null;
  completed_intent_count:
    | number
    | string
    | null;
  cancelled_intent_count:
    | number
    | string
    | null;
  hosted_plan_count:
    | number
    | string
    | null;
  active_joined_plan_count:
    | number
    | string
    | null;
  sent_request_count:
    | number
    | string
    | null;
  received_request_count:
    | number
    | string
    | null;
  message_count:
    | number
    | string
    | null;
};

type StaffOperationRow = {
  audit_id: string;
  actor_user_id: string | null;
  actor_full_name: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type StaffCapabilityRow = {
  capability: "staff_messaging" | "member_messaging" | "edit_profiles";
  enabled: boolean;
};

type StatisticCardProps = {
  label: string;
  value:
    | number
    | string
    | null;
  description: string;
};

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
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(new Date(value));
}

function getInitial(
  name: string
) {
  return (
    name
      .trim()
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

function StatisticCard({
  label,
  value,
  description,
}: StatisticCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-gray-950">
        {formatNumber(value)}
      </p>

      <p className="mt-2 text-sm leading-6 text-gray-500">
        {description}
      </p>
    </article>
  );
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const resolvedParams =
    await params;

  const userId =
    resolvedParams.userId ??
    resolvedParams.UserId ??
    resolvedParams.UsersId ??
    Object.values(
      resolvedParams
    )[0];

  if (!userId) {
    notFound();
  }

  const {
    supabase,
    user: adminUser,
    role,
  } = await requireAdmin();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_user_detail",
    {
      p_user_id: userId,
    }
  );

  if (error) {
    console.error(
      "Admin user detail query failed:",
      {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }
    );

    notFound();
  }

  const profile =
    (
      (
        data ?? []
      ) as unknown as AdminUserDetail[]
    )[0] ?? null;

  if (!profile) {
    notFound();
  }

  const displayName =
    profile.full_name ??
    "UIN member";

  const locationText = [
    profile.city,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");

  const isCurrentAdmin =
    adminUser.id ===
    profile.user_id;

  const myCapabilities = await getMyStaffCapabilitySet(supabase);
  const canMessageStaff = myCapabilities.has("staff_messaging");
  const canMessageMembers = myCapabilities.has("member_messaging");
  const canMessageTarget = profile.admin_role
    ? canMessageStaff || canMessageMembers
    : canMessageMembers;
  const canEditProfiles = myCapabilities.has("edit_profiles");

  const [targetCapabilityResponse, staffAuditResponse] = await Promise.all([
    role === "owner" && profile.admin_role
      ? supabase.rpc("get_staff_capabilities_for_user", {
          p_target_user_id: profile.user_id,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("get_staff_operations_for_user", {
      p_user_id: profile.user_id,
      p_limit: 12,
    }),
  ]);

  const targetCapabilities = (
    (targetCapabilityResponse.data ?? []) as unknown as StaffCapabilityRow[]
  ).reduce(
    (result, row) => ({
      ...result,
      [row.capability]: Boolean(row.enabled),
    }),
    {
      staff_messaging: false,
      member_messaging: false,
      edit_profiles: false,
    } as Record<
      "staff_messaging" | "member_messaging" | "edit_profiles",
      boolean
    >
  );

  const staffOperations =
    (staffAuditResponse.data ?? []) as unknown as StaffOperationRow[];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/users"
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
          >
            ← Back to Users
          </Link>

          <div className="flex flex-wrap gap-3">
            {profile.username && (
              <Link
                href={`/u/${encodeURIComponent(
                  profile.username
                )}`}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
              >
                View Public Profile
              </Link>
            )}

            {canMessageTarget && !isCurrentAdmin && (
              <Link
                href={`/messages/new?userId=${encodeURIComponent(profile.user_id)}`}
                className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800 transition hover:border-green-400 hover:bg-green-100"
              >
                Message
              </Link>
            )}

            {canEditProfiles && (
              <Link
                href={`/admin/users/${encodeURIComponent(profile.username ?? profile.user_id)}/edit`}
                className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-800 transition hover:border-blue-400 hover:bg-blue-100"
              >
                Edit Profile
              </Link>
            )}

            <Link
              href="/admin"
              className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="relative h-56 bg-gradient-to-r from-green-100 via-emerald-50 to-cyan-50">
            {profile.cover_url && (
              <img
                src={profile.cover_url}
                alt={`${displayName} cover`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>

          <div className="grid grid-cols-1 gap-6 px-6 pb-8 md:grid-cols-[190px_minmax(0,1fr)] md:px-8">
            <div className="relative z-10 -mt-20">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-40 w-40 rounded-full border-4 border-white bg-white object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-white bg-gray-100 text-5xl font-bold text-gray-500 shadow-lg">
                  {getInitial(
                    displayName
                  )}
                </div>
              )}
            </div>

            <div className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold text-gray-950">
                      {displayName}
                    </h1>

                    {isCurrentAdmin && (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        You
                      </span>
                    )}
                  </div>

                  {profile.username && (
                    <p className="mt-2 text-lg text-gray-500">
                      @{profile.username}
                    </p>
                  )}
                </div>

                {profile.admin_role ? (
                  <span
                    className={`w-fit rounded-full px-4 py-2 text-xs font-semibold ${getRoleClasses(
                      profile.admin_role
                    )}`}
                  >
                    {getRoleLabel(
                      profile.admin_role
                    )}
                  </span>
                ) : (
                  <span className="w-fit rounded-full bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600">
                    Member
                  </span>
                )}
              </div>

              {profile.bio ? (
                <p className="mt-6 max-w-3xl whitespace-pre-wrap leading-7 text-gray-700">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-6 text-gray-400">
                  No bio has been added.
                </p>
              )}

              {locationText && (
                <p className="mt-5 text-sm font-semibold text-gray-600">
                  📍 {locationText}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
              User Activity
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Platform summary
            </h2>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatisticCard
              label="Total Intents"
              value={
                profile.total_intent_count
              }
              description="All Intent records created by this user."
            />

            <StatisticCard
              label="Active Intents"
              value={
                profile.active_intent_count
              }
              description="Intentions currently active."
            />

            <StatisticCard
              label="Planned Intents"
              value={
                profile.planned_intent_count
              }
              description="Intentions connected to planned Activities."
            />

            <StatisticCard
              label="Completed Intents"
              value={
                profile.completed_intent_count
              }
              description="Intentions completed by the user."
            />

            <StatisticCard
              label="Cancelled Intents"
              value={
                profile.cancelled_intent_count
              }
              description="Intentions cancelled by the user."
            />

            <StatisticCard
              label="Hosted Plans"
              value={
                profile.hosted_plan_count
              }
              description="Plans hosted by this user."
            />

            <StatisticCard
              label="Active Joins"
              value={
                profile.active_joined_plan_count
              }
              description="Plans where the user is an active participant."
            />

            <StatisticCard
              label="Room Messages"
              value={
                profile.message_count
              }
              description="Messages sent in Planning and Activity Rooms."
            />

            <StatisticCard
              label="Sent Requests"
              value={
                profile.sent_request_count
              }
              description="Participation requests sent by the user."
            />

            <StatisticCard
              label="Received Requests"
              value={
                profile.received_request_count
              }
              description="Participation requests received by the user."
            />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
              Account Information
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Profile record
            </h2>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email
              </dt>

              <dd className="mt-2 break-all font-semibold text-gray-900">
                {profile.email ??
                  "Not available"}
              </dd>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Username
              </dt>

              <dd className="mt-2 font-semibold text-gray-900">
                {profile.username
                  ? `@${profile.username}`
                  : "Not available"}
              </dd>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Profile Created
              </dt>

              <dd className="mt-2 font-semibold text-gray-900">
                {formatDateTime(
                  profile.profile_created_at
                )}
              </dd>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Profile Update
              </dt>

              <dd className="mt-2 font-semibold text-gray-900">
                {formatDateTime(
                  profile.profile_updated_at
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {canMessageTarget && !isCurrentAdmin && (
              <Link
                href={`/messages/new?userId=${encodeURIComponent(profile.user_id)}`}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Open Conversation
              </Link>
            )}

            {canEditProfiles && (
              <Link
                href={`/admin/users/${encodeURIComponent(profile.username ?? profile.user_id)}/edit`}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-400 hover:text-blue-700"
              >
                Edit Public Profile
              </Link>
            )}
          </div>
        </section>

        {role === "owner" && profile.admin_role && !isCurrentAdmin && (
          <section className="mt-8 rounded-3xl border border-purple-200 bg-purple-50/30 p-6 shadow-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
              Owner-controlled permissions
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Staff capabilities
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
              Role and capability are separate. A Moderator can exist without messaging or profile-edit access until you explicitly enable it here.
            </p>
            <div className="mt-6">
              <StaffPermissionControl
                userId={profile.user_id}
                initial={targetCapabilities}
              />
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Staff operations
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Recent audited actions
          </h2>

          {staffOperations.length === 0 ? (
            <p className="mt-5 text-sm text-gray-500">No staff operations recorded for this account yet.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {staffOperations.map((operation) => (
                <article
                  key={operation.audit_id}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">
                      {operation.action.replaceAll("_", " ")}
                    </p>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(operation.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {operation.actor_full_name || "UIN staff"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}