import Link from "next/link";

import SportsManager, {
  type AdminSport,
} from "@/components/admin/SportsManager";
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

export default async function AdminSportsPage() {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_sports"
  );

  if (error) {
    console.error(
      "Sports catalogue query failed:",
      error
    );
  }

  const sports =
    (
      data ?? []
    ) as AdminSport[];

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
                  {getRoleLabel(
                    role
                  )}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Sports Catalogue
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Manage the canonical sports
                used by sport-related
                Activities and Communities.
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
                href="/admin/activity-catalogue"
                className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800 transition hover:border-green-400 hover:bg-green-100"
              >
                Activity Catalogue
              </Link>

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

        {error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Sports catalogue could not
              be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        )}

        {!error && (
          <section className="mt-6">
            <SportsManager
              sports={sports}
            />
          </section>
        )}
      </div>
    </main>
  );
}
