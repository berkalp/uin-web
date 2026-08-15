import Link from "next/link";

import CommunityAdminManager, {
  type CommunityAdminCatalogue,
} from "@/components/admin/CommunityAdminManager";

import {
  requireAdmin,
} from "@/utils/admin";

type AdminCommunitiesSearchParams =
  Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;

function getSearchParam(
  searchParams:
    Record<
      string,
      string |
      string[] |
      undefined
    >,
  key: string
) {
  const value =
    searchParams[key];

  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams:
    AdminCommunitiesSearchParams;
}) {
  const resolvedSearchParams =
    await searchParams;

  const initialEditCommunityId =
    getSearchParam(
      resolvedSearchParams,
      "edit"
    ).trim() || null;

  const {
    supabase,
    user,
    role,
  } = await requireAdmin();

  const [
    catalogueResponse,
    coverResponse,
    accessResponse,
  ] = await Promise.all([
    supabase.rpc(
      "get_admin_community_catalogue"
    ),
    supabase.rpc(
      "get_admin_community_cover_presentations"
    ),
    supabase.rpc(
      "get_admin_community_access_catalogue"
    ),
  ]);

  const error =
    catalogueResponse.error ??
    coverResponse.error;

  if (catalogueResponse.error) {
    console.error(
      "Admin Community catalogue failed:",
      catalogueResponse.error
    );
  }

  if (coverResponse.error) {
    console.error(
      "Admin Community cover catalogue failed:",
      coverResponse.error
    );
  }

  if (accessResponse.error) {
    console.warn(
      "Admin Community membership access catalogue is unavailable; using open access defaults until the membership migration is applied:",
      accessResponse.error
    );
  }

  const rawCatalogue =
    (
      catalogueResponse.data ?? {
        categories: [],
        activities: [],
        communities: [],
        suggestions: [],
      }
    ) as CommunityAdminCatalogue;

  const coverByCommunityId =
    new Map(
      (
        (coverResponse.data ?? []) as Array<{
          community_id: string;
          cover_image_url: string | null;
          cover_position_x: number | string;
          cover_position_y: number | string;
        }>
      ).map((row) => [
        row.community_id,
        row,
      ])
    );

  const accessByCommunityId =
    new Map(
      (
        (accessResponse.error
          ? []
          : accessResponse.data ?? []) as Array<{
          community_id: string;
          intent_access_mode: string;
          active_member_count: number | string;
        }>
      ).map((row) => [
        row.community_id,
        row,
      ])
    );

  const catalogue: CommunityAdminCatalogue = {
    ...rawCatalogue,
    communities:
      (rawCatalogue.communities ?? []).map(
        (community) => ({
          ...community,
          cover_image_url:
            coverByCommunityId.get(community.id)?.cover_image_url ?? null,
          cover_position_x:
            Number(coverByCommunityId.get(community.id)?.cover_position_x ?? 50),
          cover_position_y:
            Number(coverByCommunityId.get(community.id)?.cover_position_y ?? 50),
          intent_access_mode:
            accessByCommunityId.get(
              community.id
            )?.intent_access_mode ===
            "verified_members"
              ? "verified_members"
              : "open",
          active_member_count:
            accessByCommunityId.get(
              community.id
            )?.active_member_count ?? 0,
        })
      ),
  };

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

                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold capitalize text-indigo-700">
                  {role}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold text-gray-950">
                Communities
              </h1>

              <p className="mt-3 max-w-3xl text-gray-500">
                Curate broad Intent contexts,
                review user suggestions and
                prevent duplicate hashtag-like
                taxonomy from leaking into the
                core product.
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
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-indigo-400 hover:text-indigo-700"
              >
                ← Admin Dashboard
              </Link>

              <Link
                href="/discover"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                View Discover
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Context, not identity
            </p>

            <p className="mt-2 text-sm leading-6 text-indigo-950">
              A Community gives an Intent
              broader meaning. It never becomes
              an account or posting identity.
            </p>
          </article>

          <article className="rounded-2xl border border-green-100 bg-green-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Curated
            </p>

            <p className="mt-2 text-sm leading-6 text-green-950">
              People suggest. Administrators
              approve, merge or reject before
              the context appears in the
              product.
            </p>
          </article>

          <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Match-safe
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-950">
              Intents with different Community
              contexts do not match merely
              because Activity, place and dates
              overlap.
            </p>
          </article>
        </section>

        {error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Community administration could
              not be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error.message}
            </p>
          </section>
        )}

        {!error && (
          <div className="mt-7">
            <CommunityAdminManager
              initialEditCommunityId={
                initialEditCommunityId
              }
              initialCatalogue={{
                categories:
                  catalogue.categories ??
                  [],
                activities:
                  catalogue.activities ??
                  [],
                communities:
                  catalogue.communities ??
                  [],
                suggestions:
                  catalogue.suggestions ??
                  [],
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
