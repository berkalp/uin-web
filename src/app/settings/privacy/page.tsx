import Link from "next/link";
import { redirect } from "next/navigation";

import UserDiscoveryControlsManager, {
  type UserDiscoveryControlRow,
} from "@/components/privacy/UserDiscoveryControlsManager";
import { createClient } from "@/utils/supabase/server";

export default async function PrivacySettingsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_user_discovery_controls"
  );

  if (error) {
    console.error(
      "User discovery control query failed:",
      error
    );
  }

  const controls =
    (
      data ?? []
    ) as UserDiscoveryControlRow[];

  const ignoredCount =
    controls.filter(
      (item) =>
        item.control_type ===
        "ignore"
    ).length;

  const blockedCount =
    controls.filter(
      (item) =>
        item.control_type ===
        "block"
    ).length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/timeline"
          className="text-sm font-bold text-gray-600 transition hover:text-green-700"
        >
          ← Back to Timeline
        </Link>

        <header className="mt-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">
            Privacy & discovery
          </p>

          <h1 className="mt-3 text-4xl font-black text-gray-950">
            People you do not want in your discovery
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
            Control people you no longer want to see in UIN discovery.
          </p>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-amber-950">
                Ignored people
              </h2>

              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-amber-700 shadow-sm">
                {ignoredCount}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-amber-900">
              Ignored people disappear from your Discover, Matches, Intents and Seed discovery. They can still discover you.
            </p>
          </div>

          <div className="rounded-3xl border border-red-200 bg-red-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-red-950">
                Blocked people
              </h2>

              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-red-700 shadow-sm">
                {blockedCount}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-red-900">
              Blocked people cannot discover you, and you cannot discover them. Existing shared Activities are not deleted.
            </p>
          </div>
        </section>

        <section className="mt-6">
          {error ? (
            <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
              <p className="font-black text-red-900">
                Privacy controls could not be loaded.
              </p>

              <p className="mt-2 text-sm text-red-700">
                {error.message}
              </p>
            </div>
          ) : (
            <UserDiscoveryControlsManager
              controls={controls}
            />
          )}
        </section>
      </div>
    </main>
  );
}
