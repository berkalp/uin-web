import Link from "next/link";

import {
  AdminRole,
  requireAdmin,
} from "@/utils/admin";

type AdminDashboardSummary = {
  total_users: number | string | null;
  active_intents: number | string | null;
  forming_plans: number | string | null;
  planned_activities: number | string | null;
  completed_activities: number | string | null;
  cancelled_activities: number | string | null;
  pending_requests: number | string | null;
  total_messages: number | string | null;
};

type DashboardCardProps = {
  label: string;
  value: number;
  description: string;
  tone:
    | "green"
    | "blue"
    | "amber"
    | "purple"
    | "red"
    | "gray";
};

type AdminModuleCardProps = {
  title: string;
  description: string;
  href: string;
  available?: boolean;
  badge?: string | null;
};

function toNumber(
  value: number | string | null | undefined
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
  value: number
) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(value);
}

function getRoleLabel(
  role: AdminRole
) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "moderator") {
    return "Moderator";
  }

  if (role === "support") {
    return "Support";
  }

  return "Administrator";
}

function getCardClasses(
  tone: DashboardCardProps["tone"]
) {
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

  return {
    wrapper:
      "border-gray-200 bg-gray-50",
    label:
      "text-gray-600",
    value:
      "text-gray-950",
  };
}

function DashboardCard({
  label,
  value,
  description,
  tone,
}: DashboardCardProps) {
  const classes =
    getCardClasses(tone);

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

function AdminModuleCard({
  title,
  description,
  href,
  available = false,
  badge = null,
}: AdminModuleCardProps) {
  if (!available) {
    return (
      <article className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              {description}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
            Coming next
          </span>
        </div>
      </article>
    );
  }

  return (
    <Link
      href={href}
      className="group rounded-3xl border border-gray-200 bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 transition group-hover:text-green-700">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
              {badge}
            </span>
          )}

          <span className="text-xl text-gray-400 transition group-hover:translate-x-1 group-hover:text-green-600">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const [
    summaryResult,
    pendingActivitySuggestionResult,
    pendingCommunitySuggestionResult,
    seedCatalogueCountsResult,
  ] = await Promise.all([
    supabase.rpc(
      "get_admin_dashboard_summary"
    ),

    supabase.rpc(
      "get_admin_pending_activity_suggestion_count"
    ),

    supabase.rpc(
      "get_admin_pending_community_suggestion_count"
    ),

    supabase.rpc(
      "get_admin_seed_catalog_counts"
    ),
  ]);

  const {
    data: summaryData,
    error: summaryError,
  } = summaryResult;

  if (
    pendingActivitySuggestionResult.error
  ) {
    console.error(
      "Pending Activity suggestion count query failed:",
      pendingActivitySuggestionResult.error
    );
  }

  if (
    pendingCommunitySuggestionResult.error
  ) {
    console.error(
      "Pending Community suggestion count query failed:",
      pendingCommunitySuggestionResult.error
    );
  }

  if (seedCatalogueCountsResult.error) {
    console.error(
      "Seed Catalogue count query failed:",
      seedCatalogueCountsResult.error
    );
  }

  if (summaryError) {
    console.error(
      "Admin dashboard summary query failed:",
      {
        message:
          summaryError.message,
        code:
          summaryError.code,
        details:
          summaryError.details,
        hint:
          summaryError.hint,
      }
    );
  }

  const summary =
    (
      (
        summaryData ?? []
      ) as AdminDashboardSummary[]
    )[0] ?? null;

  const totalUsers =
    toNumber(
      summary?.total_users
    );

  const activeIntents =
    toNumber(
      summary?.active_intents
    );

  const formingPlans =
    toNumber(
      summary?.forming_plans
    );

  const plannedActivities =
    toNumber(
      summary?.planned_activities
    );

  const completedActivities =
    toNumber(
      summary?.completed_activities
    );

  const cancelledActivities =
    toNumber(
      summary?.cancelled_activities
    );

  const pendingRequests =
    toNumber(
      summary?.pending_requests
    );

  const totalMessages =
    toNumber(
      summary?.total_messages
    );

  const pendingActivitySuggestions =
    toNumber(
      pendingActivitySuggestionResult.data
    );

  const pendingCommunitySuggestions =
    toNumber(
      pendingCommunitySuggestionResult.data
    );

  const seedCatalogueCounts = (seedCatalogueCountsResult.data ?? {}) as {
    pending?: number | string | null;
    under_review?: number | string | null;
  };
  const pendingSeedSuggestions = toNumber(seedCatalogueCounts.pending);
  const reportedSeedSubjects = toNumber(seedCatalogueCounts.under_review);
  const seedItemsNeedingAttention = pendingSeedSuggestions + reportedSeedSubjects;

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
                Admin Dashboard
              </h1>

              <p className="mt-3 max-w-2xl text-gray-500">
                Review users, Intents,
                Activities, requests and
                moderation data across UIN.
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
                href="/timeline"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
              >
                Back to Timeline
              </Link>

              <Link
                href="/settings/profile"
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                My Profile
              </Link>
            </div>
          </div>
        </header>

        {seedItemsNeedingAttention > 0 && (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">Seed Library curation</p>
                <h2 className="mt-1 text-xl font-black text-amber-950">
                  {formatNumber(seedItemsNeedingAttention)} Seed Library item{seedItemsNeedingAttention === 1 ? "" : "s"} need attention
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  {formatNumber(pendingSeedSuggestions)} suggestion{pendingSeedSuggestions === 1 ? "" : "s"} waiting · {formatNumber(reportedSeedSubjects)} reported subject{reportedSeedSubjects === 1 ? "" : "s"}
                </p>
              </div>
              <Link
                href={pendingSeedSuggestions > 0 ? "/admin/seed-catalogue?status=pending" : "/admin/seed-catalogue?status=under_review"}
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700"
              >
                Review Seed Library
              </Link>
            </div>
          </section>
        )}

        {summaryError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Dashboard statistics could
              not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              The admin route is available,
              but the summary function
              returned an error.
            </p>
          </div>
        )}

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Platform Overview
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Current activity
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              label="Users"
              value={totalUsers}
              description="Registered UIN profiles."
              tone="gray"
            />

            <DashboardCard
              label="Active Intents"
              value={activeIntents}
              description="Intentions currently active."
              tone="green"
            />

            <DashboardCard
              label="Forming Plans"
              value={formingPlans}
              description="Plans still being coordinated."
              tone="amber"
            />

            <DashboardCard
              label="Planned Activities"
              value={plannedActivities}
              description="Activities with confirmed schedules."
              tone="blue"
            />

            <DashboardCard
              label="Completed Activities"
              value={completedActivities}
              description="Activities marked as completed."
              tone="purple"
            />

            <DashboardCard
              label="Cancelled Activities"
              value={cancelledActivities}
              description="Plans or Activities cancelled."
              tone="red"
            />

            <DashboardCard
              label="Pending Requests"
              value={pendingRequests}
              description="Requests awaiting a response."
              tone="amber"
            />

            <DashboardCard
              label="Room Messages"
              value={totalMessages}
              description="Planning and Activity Room messages."
              tone="gray"
            />
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Administration
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Management areas
          </h2>

          <p className="mt-2 text-gray-500">
            Each area has role-based
            access and audit history.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AdminModuleCard
              title="Users"
              description="Search profiles, review account status and inspect user activity."
              href="/admin/users"
              available
            />

            <AdminModuleCard
              title="Intents"
              description="Review active, closed, completed and cancelled Intents."
              href="/admin/intents"
              available
            />

            <AdminModuleCard
              title="Plans and Activities"
              description="Inspect forming Plans, confirmed Activities and member participation."
              href="/admin/plans"
              available
            />

            <AdminModuleCard
              title="Requests"
              description="Review pending, accepted and declined participation requests."
              href="/admin/requests"
              available
            />

            <AdminModuleCard
              title="Activity Catalogue"
              description="Create, rename, move, deactivate and present canonical Activity categories and Activities."
              href="/admin/activity-catalogue"
              available
            />

            <AdminModuleCard
              title="Seed Types"
              description="Manage the stable personal Seed vocabulary and map each type to suggested social Activities."
              href="/admin/seed-types"
              available
            />

            <AdminModuleCard
              title="Seed Catalogue"
              description="Curate shared Seed subjects, review suggestions and reports, merge real duplicates and complete type-specific metadata."
              href="/admin/seed-catalogue"
              badge={
                seedItemsNeedingAttention > 0
                  ? `${formatNumber(seedItemsNeedingAttention)} need review`
                  : null
              }
              available
            />

            <AdminModuleCard
              title="Sports Catalogue"
              description="Create, rename, reorder, deactivate and delete unused sports used by sport-related Activities."
              href="/admin/sports"
              available
            />

            <AdminModuleCard
              title="Community Sports"
              description="Choose which sports each Community belongs to and manage sport-specific covers."
              href="/admin/community-sports"
              available
            />

            <AdminModuleCard
              title="Languages"
              description="Install languages, translate application text and choose the default locale."
              href="/admin/languages"
              available
            />

            <AdminModuleCard
              title="Activity Requests"
              description="Classify user-submitted Activity requests and release approved Intent drafts for publication."
              href="/admin/activity-suggestions"
              badge={
                pendingActivitySuggestions > 0
                  ? `${formatNumber(
                      pendingActivitySuggestions
                    )} pending`
                  : null
              }
              available
            />

            <AdminModuleCard
              title="Communities"
              description="Curate broad Intent contexts, review user suggestions and merge duplicates before they reach Discover."
              href="/admin/communities"
              badge={
                pendingCommunitySuggestions > 0
                  ? `${formatNumber(
                      pendingCommunitySuggestions
                    )} pending`
                  : null
              }
              available
            />

            <AdminModuleCard
              title="Profile Badges"
              description="Define icon badges, automatic contextual criteria and manual awards for people."
              href="/admin/badges"
              available
            />

            <AdminModuleCard
              title="Identity & Professionals"
              description="Verify identities, define category- and Activity-specific professional roles, and review private credential evidence."
              href="/admin/professionals"
              available
            />

            <AdminModuleCard
              title="Reputation Questions"
              description="Create and version global, category and Activity-specific reputation questions."
              href="/admin/reputation"
              available
            />

            <AdminModuleCard
              title="Moderation"
              description="Handle reports, restrictions and content moderation decisions."
              href="/admin/moderation"
              available
            />

            <AdminModuleCard
              title="Reported Activity Titles"
              description="Review custom Activity titles that were hidden immediately after a user report."
              href="/admin/moderation/titles"
              available
            />

            <AdminModuleCard
              title="Audit Log"
              description="Track administrative actions and changes across the platform."
              href="/admin/audit"
              available
            />
          </div>
        </section>
      </div>
    </main>
  );
}