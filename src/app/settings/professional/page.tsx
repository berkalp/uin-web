import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import PageDataUnavailable from "@/components/common/PageDataUnavailable";
import ProfessionalSettingsClient from "@/components/professionals/ProfessionalSettingsClient";
import type {
  MyProfessionalProfile,
} from "@/utils/professionals";
import { createClient } from "@/utils/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isProfessionalRole(value: unknown) {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.description) &&
    (value.scope_type === "category" || value.scope_type === "activity") &&
    typeof value.category_id === "string" &&
    isNullableString(value.activity_id) &&
    typeof value.requires_identity_verification === "boolean";
}

function isProfessionalCredential(value: unknown) {
  if (!isRecord(value)) return false;
  const statuses = ["pending", "approved", "rejected", "revoked", "expired", "withdrawn"];
  return typeof value.id === "string" &&
    typeof value.professional_role_id === "string" &&
    typeof value.role_name === "string" &&
    typeof value.category_name === "string" &&
    isNullableString(value.activity_name) &&
    isNullableString(value.professional_title) &&
    typeof value.credential_type === "string" &&
    typeof value.issuer === "string" &&
    isNullableString(value.credential_number) &&
    isNullableString(value.issued_at) &&
    isNullableString(value.expires_at) &&
    isNullableString(value.evidence_path) &&
    statuses.includes(String(value.status)) &&
    isNullableString(value.review_note) &&
    isNullableString(value.approved_at) &&
    typeof value.created_at === "string";
}

function isProfessionalProfile(value: unknown): value is MyProfessionalProfile {
  if (!isRecord(value) || !isRecord(value.identity)) return false;
  const identityStatuses = ["unverified", "pending", "approved", "rejected", "revoked", "expired"];
  return identityStatuses.includes(String(value.identity.status)) &&
    isNullableString(value.identity.verified_at) &&
    isNullableString(value.identity.expires_at) &&
    Array.isArray(value.roles) &&
    value.roles.every(isProfessionalRole) &&
    Array.isArray(value.credentials) &&
    value.credentials.every(isProfessionalCredential);
}

export default async function ProfessionalSettingsPage() {
  const supabase =
    await createClient();

  const {
    data: authData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("Professional settings session query failed:", userError);
    return (
      <PageDataUnavailable
        title="Profesyonel profilin şu anda yüklenemedi"
        retryHref="/settings/professional"
        backHref="/settings/profile"
        backLabel="Profil ayarlarına dön"
      />
    );
  }

  if (!authData.user) {
    redirect("/");
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_my_professional_profile"
  );

  const readFailed = Boolean(error || !isProfessionalProfile(data));

  if (readFailed) {
    console.error(
      "Professional profile query failed:",
      error ?? "Incomplete professional-profile payload"
    );
  }

  const profile = readFailed ? null : data;

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
                <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        {readFailed ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-900">
              Profesyonel profilin yüklenemedi.
            </p>

            <p className="mt-2 text-sm text-red-700">
              Doğrulama ve yetkinlik bilgilerinin tamamı doğrulanana kadar mevcut kayıtlar gizleniyor.
            </p>
            <Link href="/settings/professional" className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white">
              Tekrar dene
            </Link>
          </section>
        ) : (
          <div className="mt-6">
            <ProfessionalSettingsClient
              initialProfile={profile as MyProfessionalProfile}
            />
          </div>
        )}
      </div>
    </main>
  );
}
