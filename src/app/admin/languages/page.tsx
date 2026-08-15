import Link from "next/link";

import LanguagesManager, {
  type AdminLanguage,
} from "@/components/admin/LanguagesManager";
import {
  type AdminRole,
  requireAdmin,
} from "@/utils/admin";

function getRoleLabel(
  role: AdminRole
) {
  if (
    role ===
    "owner"
  ) {
    return "Owner";
  }

  if (
    role ===
    "moderator"
  ) {
    return "Moderator";
  }

  if (
    role ===
    "support"
  ) {
    return "Support";
  }

  return "Administrator";
}

export default async function AdminLanguagesPage() {
  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_admin_languages"
  );

  if (error) {
    console.error(
      "Admin languages query failed:",
      error
    );
  }

  const languages =
    (
      data ??
      []
    ) as AdminLanguage[];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
                  UIN Administration
                </span>

                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                  {getRoleLabel(
                    role
                  )}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Languages
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Install languages and translate application text without editing source files.
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
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold text-red-800">
              Languages could not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        ) : (
          <section className="mt-6">
            <LanguagesManager
              languages={
                languages
              }
            />
          </section>
        )}
      </div>
    </main>
  );
}
