import Link from "next/link";
import { redirect } from "next/navigation";

import AgeAndFamilyManager, {
  type FamilyCenterData,
} from "@/components/family/AgeAndFamilyManager";
import PublicFamilyManager, {
  type PublicFamilySettingsData,
} from "@/components/family/PublicFamilyManager";
import { createClient } from "@/utils/supabase/server";

export default async function FamilySettingsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    familyResponse,
    publicFamilyResponse,
  ] = await Promise.all([
    supabase.rpc(
      "get_my_family_center"
    ),

    supabase.rpc(
      "get_my_public_family_settings"
    ),
  ]);

  if (
    familyResponse.error ||
    !familyResponse.data
  ) {
    console.error(
      "Family center query failed:",
      familyResponse.error
    );

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>

          <section className="mt-8 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-950">
              Age and family settings could not be loaded
            </h1>

            <p className="mt-3 text-sm text-red-700">
              {
                familyResponse.error
                  ?.message
              }
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (
    publicFamilyResponse.error ||
    !publicFamilyResponse.data
  ) {
    console.error(
      "Public family settings query failed:",
      publicFamilyResponse.error
    );
  }

  const familyData =
    familyResponse.data as
      FamilyCenterData;

  const publicFamilyData =
    publicFamilyResponse.error ||
    !publicFamilyResponse.data
      ? null
      : publicFamilyResponse.data as PublicFamilySettingsData;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/timeline"
            className="text-sm font-semibold text-gray-600 transition hover:text-green-700"
          >
            <img src="/uin-logo.png" alt="uin? logo" className="h-9 w-auto" />
          </Link>

          <Link
            href={`/u/${encodeURIComponent(
              familyData.self.username
            )}`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            Open My Profile
          </Link>
        </div>

        <div className="mt-8">
          <AgeAndFamilyManager
            initialData={
              familyData
            }
          />
        </div>

        {!familyData.self
          .is_managed_minor && (
          <div className="mt-8">
            {publicFamilyData ? (
              <PublicFamilyManager
                initialData={
                  publicFamilyData
                }
              />
            ) : (
              <section role="alert" className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-950">
                  Herkese açık aile ilişkileri yüklenemedi
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Mevcut ilişkileri ve davetleri eksik göstermemek için bu bölüm geçici olarak gizlendi.
                </p>
                <Link href="/settings/family" className="mt-4 inline-flex rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white">
                  Yeniden dene
                </Link>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
