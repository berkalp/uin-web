import Link from "next/link";

import BadgeManager from "@/components/admin/BadgeManager";
import {
  type AdminBadgeCatalogue,
} from "@/utils/badges";
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

export default async function AdminBadgesPage() {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_badge_catalogue"
  );

  if (error) {
    console.error(
      "Admin badge catalogue query failed:",
      error
    );
  }

  const catalogue =
    (
      data ?? {
        categories: [],
        activities: [],
        badges: [],
      }
    ) as AdminBadgeCatalogue;

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

                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {getRoleLabel(role)}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Profile Badges
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Define contextual badge icons, automatic reputation criteria and manual UIN recognitions. Badges appear above Reputation on public profiles.
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
                href="/admin/reputation"
                className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-800 transition hover:bg-purple-100"
              >
                Reputation Questions
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
              Earned
            </p>
            <p className="mt-2 text-sm leading-6 text-green-900">
              Automatic badges use verified global, category or exact Activity reputation summaries.
            </p>
          </article>

          <article className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Awarded
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Administrators can manually recognise a person, set an expiry and keep a private award note.
            </p>
          </article>

          <article className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Contextual
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              A Basketball badge and a Family Picnic badge remain separate instead of becoming one vague human score.
            </p>
          </article>
        </section>

        {error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-900">
              Badge configuration could not be loaded.
            </p>
            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        ) : (
          <section className="mt-8">
            <BadgeManager
              catalogue={catalogue}
            />
          </section>
        )}
      </div>
    </main>
  );
}
