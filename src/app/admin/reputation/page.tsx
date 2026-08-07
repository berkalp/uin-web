import Link from "next/link";

import ReputationQuestionManager, {
  type AdminReputationCatalogue,
} from "@/components/admin/ReputationQuestionManager";
import {
  type AdminRole,
  requireAdmin,
} from "@/utils/admin";

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

export default async function AdminReputationPage() {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_reputation_catalogue"
  );

  if (error) {
    console.error(
      "Admin reputation catalogue query failed:",
      error
    );
  }

  const catalogue =
    (
      data ?? {
        categories: [],
        activities: [],
        questions: [],
      }
    ) as AdminReputationCatalogue;

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

                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                  {getRoleLabel(role)}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Reputation Questions
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Manage global, category and Activity-specific feedback questions. Question versions preserve the meaning of historical answers.
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
                href="/admin/activity-catalogue"
                className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-800 transition hover:bg-purple-100"
              >
                Activity Catalogue
              </Link>

              <Link
                href="/admin"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-500 hover:text-green-700"
              >
                ← Admin Dashboard
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-green-100 bg-green-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Global
            </p>
            <p className="mt-2 text-sm leading-6 text-green-900">
              Reliability, respect and communication across every shared Activity.
            </p>
          </article>

          <article className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Category
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              Behaviour shared by similar Activities, such as sportsmanship in Sport Activity.
            </p>
          </article>

          <article className="rounded-3xl border border-purple-100 bg-purple-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
              Activity
            </p>
            <p className="mt-2 text-sm leading-6 text-purple-900">
              Exact context such as Basketball or Family Picnic, without contaminating unrelated contexts.
            </p>
          </article>
        </section>

        {error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-900">
              Reputation configuration could not be loaded.
            </p>
            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        ) : (
          <section className="mt-8">
            <ReputationQuestionManager
              catalogue={catalogue}
            />
          </section>
        )}
      </div>
    </main>
  );
}
