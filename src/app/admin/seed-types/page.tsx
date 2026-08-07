import Link from "next/link";

import SeedTypesManager, {
  type AdminSeedType,
  type SeedActivityOption,
} from "@/components/admin/SeedTypesManager";
import type { AdminCatalogueActivity } from "@/components/admin/ActivityCatalogueManager";
import { requireAdmin } from "@/utils/admin";

type AdminActivityCatalogueData = {
  activities: AdminCatalogueActivity[] | null;
};

export default async function AdminSeedTypesPage() {
  const { supabase, user, role } = await requireAdmin();

  const [seedTypeResult, catalogueResult] = await Promise.all([
    supabase.rpc("get_admin_seed_types"),
    supabase.rpc("get_admin_activity_catalogue"),
  ]);

  if (seedTypeResult.error) {
    console.error("Admin Seed Type query failed:", seedTypeResult.error);
  }

  if (catalogueResult.error) {
    console.error("Admin Activity catalogue query failed:", catalogueResult.error);
  }

  const seedTypes = (seedTypeResult.data ?? []) as AdminSeedType[];
  const catalogue = (catalogueResult.data ?? { activities: [] }) as AdminActivityCatalogueData;
  const activities: SeedActivityOption[] = (catalogue.activities ?? []).map(
    (activity) => ({
      id: activity.id,
      name: activity.name,
      category_name: activity.category_name,
      is_active: activity.is_active,
    })
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white">
                  UIN Administration
                </span>
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                  {role}
                </span>
              </div>
              <h1 className="mt-5 text-4xl font-black text-gray-950">
                Seed Types
              </h1>
              <p className="mt-3 max-w-3xl text-gray-500">
                Manage the small, stable vocabulary users choose before writing a flexible personal Seed. The catalogue stays controlled while individual Seed titles remain open and expressive.
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Signed in as <span className="font-semibold text-gray-800">{user.email ?? "Administrator"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/activity-catalogue"
                className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-800 transition hover:bg-violet-100"
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
                href="/seeds"
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                My Seeds
              </Link>
            </div>
          </div>
        </header>

        {(seedTypeResult.error || catalogueResult.error) && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            Seed Types could not be loaded. Run migration 032 before opening this page.
          </section>
        )}

        {!seedTypeResult.error && !catalogueResult.error && (
          <section className="mt-6">
            <SeedTypesManager seedTypes={seedTypes} activities={activities} />
          </section>
        )}
      </div>
    </main>
  );
}
