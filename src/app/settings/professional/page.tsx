import Link from "next/link";
import { redirect } from "next/navigation";

import ProfessionalSettingsClient from "@/components/professionals/ProfessionalSettingsClient";
import type {
  MyProfessionalProfile,
} from "@/utils/professionals";
import { createClient } from "@/utils/supabase/server";

export default async function ProfessionalSettingsPage() {
  const supabase =
    await createClient();

  const {
    data: authData,
  } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_professional_profile"
  );

  if (error) {
    console.error(
      "Professional profile query failed:",
      error
    );
  }

  const profile =
    (
      data ?? {
        identity: {
          status: "unverified",
          verified_at: null,
          expires_at: null,
        },
        roles: [],
        credentials: [],
      }
    ) as MyProfessionalProfile;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Account verification
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-950 md:text-4xl">
                Professional Profile
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
                Manage identity status and submit category- or Activity-specific qualifications for UIN review. Credentials are evidence of qualification, not a substitute for contextual reputation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings/profile"
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                Profile Settings
              </Link>

              <Link
                href="/timeline"
                className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                ← Timeline
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-900">
              Professional profile could not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        ) : (
          <div className="mt-6">
            <ProfessionalSettingsClient
              initialProfile={profile}
            />
          </div>
        )}
      </div>
    </main>
  );
}
