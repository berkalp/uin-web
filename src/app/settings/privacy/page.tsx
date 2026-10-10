import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import UserDiscoveryControlsManager, {
  type UserDiscoveryControlRow,
} from "@/components/privacy/UserDiscoveryControlsManager";
import { createClient } from "@/utils/supabase/server";

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isDiscoveryControl(value: unknown): value is UserDiscoveryControlRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;

  return typeof row.target_user_id === "string" &&
    isNullableString(row.target_full_name) &&
    isNullableString(row.target_username) &&
    isNullableString(row.target_avatar_url) &&
    (row.control_type === "ignore" || row.control_type === "block") &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string";
}

export default async function PrivacySettingsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Privacy settings session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Gizlilik ayarların şu anda yüklenemedi"
        retryHref="/settings/privacy"
        backHref="/timeline"
        backLabel="Ana sayfaya dön"
      />
    );
  }

  if (!user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_user_discovery_controls"
  );

  const readFailed = Boolean(
    error || !Array.isArray(data) || !data.every(isDiscoveryControl)
  );

  if (readFailed) {
    console.error(
      "User discovery control query failed:",
      error ?? "Incomplete privacy-control payload"
    );
  }

  const controls = readFailed ? [] : data as UserDiscoveryControlRow[];

  const serverIgnoredCount =
    error ? null : controls.filter(
      (item) => item.control_type === "ignore"
    ).length;
  const ignoredCount =
    readFailed ? null : serverIgnoredCount;

  const serverBlockedCount =
    error ? null : controls.filter(
      (item) => item.control_type === "block"
    ).length;
  const blockedCount =
    readFailed ? null : serverBlockedCount;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/timeline"
          className="text-sm font-bold text-gray-600 transition hover:text-green-700"
        >
          <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
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
                {ignoredCount ?? "—"}
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
                {blockedCount ?? "—"}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-red-900">
              Blocked people cannot discover you, and you cannot discover them. Existing shared Activities are not deleted.
            </p>
          </div>
        </section>

        <section className="mt-6">
          {readFailed ? (
            <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
              <p className="font-black text-red-900">
                Gizlilik tercihlerin yüklenemedi.
              </p>

              <p className="mt-2 text-sm text-red-700">
                Mevcut engelleme ve yok sayma listen hakkında eksik bilgi göstermemek için bu bölüm geçici olarak gizlendi.
              </p>

              <Link href="/settings/privacy" className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white">
                Yeniden dene
              </Link>
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
