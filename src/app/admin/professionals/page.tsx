import Link from "next/link";

import ProfessionalVerificationManager from "@/components/admin/ProfessionalVerificationManager";
import {
  type AdminRole,
  requireAdmin,
} from "@/utils/admin";
import type {
  AdminProfessionalCatalogue,
} from "@/utils/professionals";

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

export default async function AdminProfessionalsPage() {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_professional_catalogue"
  );

  if (error) {
    console.error(
      "Professional administration query failed:",
      error
    );
  }

  const catalogue =
    (
      data ?? {
        categories: [],
        activities: [],
        roles: [],
        credentials: [],
      }
    ) as AdminProfessionalCatalogue;

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
                Identity & Professionals
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Verify people, define contextual professional roles and review private qualification evidence. Verification, credentials, badges and reputation remain separate instead of becoming one decorative trust soup.
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
                href="/admin/badges"
                className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Profile Badges
              </Link>

              <Link
                href="/admin/reputation"
                className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-800 transition hover:bg-purple-100"
              >
                Reputation Questions
              </Link>

              <Link
                href="/admin"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-400 hover:text-blue-700"
              >
                ← Admin Dashboard
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Identity
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-900">
              Confirms that the profile belongs to a reviewed real person. It does not prove professional ability.
            </p>
          </article>

          <article className="rounded-3xl border border-green-100 bg-green-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Credential
            </p>
            <p className="mt-2 text-sm leading-6 text-green-900">
              Confirms a qualification for a specific category or exact Activity, with private evidence and an auditable admin decision.
            </p>
          </article>

          <article className="rounded-3xl border border-purple-100 bg-purple-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
              Reputation
            </p>
            <p className="mt-2 text-sm leading-6 text-purple-900">
              Still reflects real shared-Activity behaviour. A certificate does not guarantee that humans enjoyed dealing with its owner.
            </p>
          </article>
        </section>

        {error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-900">
              Professional administration could not be loaded.
            </p>
            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        ) : (
          <section className="mt-8">
            <ProfessionalVerificationManager
              initialCatalogue={catalogue}
            />
          </section>
        )}
      </div>
    </main>
  );
}
