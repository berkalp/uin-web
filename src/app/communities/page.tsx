import Link from "next/link";
import { redirect } from "next/navigation";

import CommunityDiscoveryCard, {
  type CommunityDiscoveryRow,
} from "@/components/communities/CommunityDiscoveryCard";
import CommunityDiscoveryFiltersForm, {
  type CommunityDiscoveryEligibilityFilter,
  type CommunityDiscoverySort,
} from "@/components/communities/CommunityDiscoveryFiltersForm";

import type { HierarchicalLocation } from "@/utils/location";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

const ELIGIBILITY_FILTERS: readonly CommunityDiscoveryEligibilityFilter[] = [
  "eligible",
  "everyone",
  "women_only",
  "men_only",
  "all",
];

const SORT_OPTIONS: readonly CommunityDiscoverySort[] = [
  "most_followed",
  "most_active",
  "most_experiences",
  "recently_active",
  "az",
];

type DiscoveryCategory = {
  id: string;
  name: string;
};

type DiscoveryActivity = {
  id: string;
  category_id: string;
  name: string;
  category_name: string;
};

type DiscoveryFilters = {
  categories: DiscoveryCategory[] | null;
  activities: DiscoveryActivity[] | null;
  locations: HierarchicalLocation[] | null;
};

type CommunitySearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type CommunityVerifiedMemberCountRow = {
  community_id: string;
  verified_member_count: number | string;
};


function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getPageNumber(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getEligibilityFilter(
  value: string
): CommunityDiscoveryEligibilityFilter {
  return ELIGIBILITY_FILTERS.includes(
    value as CommunityDiscoveryEligibilityFilter
  )
    ? (value as CommunityDiscoveryEligibilityFilter)
    : "all";
}

function getSort(value: string): CommunityDiscoverySort {
  return SORT_OPTIONS.includes(value as CommunityDiscoverySort)
    ? (value as CommunityDiscoverySort)
    : "most_followed";
}

function getScope(value: string): "all" | "following" {
  return value === "following" ? "following" : "all";
}

function toCount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCommunitiesHref({
  query,
  categoryId,
  activityId,
  locationId,
  eligibility,
  sort,
  scope,
  applied,
  page,
}: {
  query: string;
  categoryId: string;
  activityId: string;
  locationId: string;
  eligibility: CommunityDiscoveryEligibilityFilter;
  sort: CommunityDiscoverySort;
  scope: "all" | "following";
  applied: boolean;
  page: number;
}) {
  const params = new URLSearchParams();

  if (query) params.set("q", query);
  if (categoryId) params.set("category", categoryId);
  if (activityId) params.set("activity", activityId);
  if (locationId) params.set("location", locationId);
  if (applied || eligibility !== "all") {
    params.set("eligibility", eligibility);
  }
  if (sort !== "most_followed") params.set("sort", sort);
  if (scope === "following") params.set("scope", "following");
  if (applied) params.set("apply", "1");
  if (page > 1) params.set("page", String(page));

  const queryString = params.toString();
  return queryString ? `/communities?${queryString}` : "/communities";
}

function buildCommunityDetailHref({
  slug,
  categoryId,
  activityId,
  locationId,
  eligibility,
  applied,
}: {
  slug: string;
  categoryId: string;
  activityId: string;
  locationId: string;
  eligibility: CommunityDiscoveryEligibilityFilter;
  applied: boolean;
}) {
  const params = new URLSearchParams();

  if (applied && categoryId) params.set("category", categoryId);
  if (applied && activityId) params.set("activity", activityId);
  if (applied && locationId) params.set("location", locationId);
  if (applied) params.set("eligibility", eligibility);

  const queryString = params.toString();
  const baseHref = `/communities/${encodeURIComponent(slug)}`;
  return queryString ? `${baseHref}?${queryString}` : baseHref;
}

function Pagination({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <span className="text-sm font-semibold text-gray-600">
        Page {page} of {totalPages}
      </span>

      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={previousHref}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
          >
            ← Previous
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-xl border border-gray-100 px-4 py-2 text-sm font-semibold text-gray-300">
            ← Previous
          </span>
        )}

        {page < totalPages ? (
          <Link
            href={nextHref}
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Next →
          </Link>
        ) : (
          <span className="cursor-not-allowed rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-300">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: CommunitySearchParams;
}) {
  const resolvedSearchParams = await searchParams;

  const query = getParam(resolvedSearchParams, "q").trim();
  const categoryId = getParam(resolvedSearchParams, "category");
  const activityId = getParam(resolvedSearchParams, "activity");
  const locationId = getParam(resolvedSearchParams, "location");
  const eligibility = getEligibilityFilter(
    getParam(resolvedSearchParams, "eligibility")
  );
  const sort = getSort(getParam(resolvedSearchParams, "sort"));
  const scope = getScope(getParam(resolvedSearchParams, "scope"));
  const applied = getParam(resolvedSearchParams, "apply") === "1";
  const page = getPageNumber(getParam(resolvedSearchParams, "page"));

  const hasIntentFilters = Boolean(
    locationId || eligibility !== "all"
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [filterResponse, communityResponse] = await Promise.all([
    supabase.rpc("get_intent_discovery_filters"),
    supabase.rpc("search_communities_v2", {
      p_query: query || null,
      p_category_id: categoryId || null,
      p_activity_id: activityId || null,
      p_location_id: locationId || null,
      p_eligibility: eligibility,
      p_following_only: scope === "following",
      p_require_intent_match: applied && hasIntentFilters,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  if (filterResponse.error) {
    console.warn("Community discovery filters failed:", filterResponse.error);
  }

  if (communityResponse.error) {
    console.warn("Community discovery search failed:", communityResponse.error);
  }

  const filters = (filterResponse.data ?? {
    categories: [],
    activities: [],
    locations: [],
  }) as DiscoveryFilters;

  const rawCommunities = (communityResponse.data ?? []) as CommunityDiscoveryRow[];

  let verifiedMemberCountByCommunityId = new Map<string, number>();

  if (rawCommunities.length > 0) {
    const verifiedMemberCountResponse = await supabase.rpc(
      "get_public_community_verified_member_counts",
      {
        p_community_ids: rawCommunities.map((community) => community.community_id),
      }
    );

    if (verifiedMemberCountResponse.error) {
      console.warn(
        "Community verified member counts failed; hiding verified member metrics until the public member directory migration is applied:",
        verifiedMemberCountResponse.error
      );
    } else {
      verifiedMemberCountByCommunityId = new Map(
        ((verifiedMemberCountResponse.data ?? []) as CommunityVerifiedMemberCountRow[]).map(
          (row) => [row.community_id, toCount(row.verified_member_count)]
        )
      );
    }
  }

  const communities = rawCommunities.map((community) => ({
    ...community,
    verified_member_count:
      verifiedMemberCountByCommunityId.get(community.community_id) ?? 0,
  }));

  const totalCount = toCount(rawCommunities[0]?.total_count);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const currentHref = (nextPage: number) =>
    buildCommunitiesHref({
      query,
      categoryId,
      activityId,
      locationId,
      eligibility,
      sort,
      scope,
      applied,
      page: nextPage,
    });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1680px]">
        <header className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
                Community Discovery
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-950">
                Discover Communities
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
                Find and follow the teams, interests, genres and cultures that shape the Intents you want to discover.
              </p>

              <p className="mt-2 text-xs leading-5 text-gray-400">
                Following personalises Discover. It is private and does not make you a member.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/timeline"
                aria-label="UIN Timeline"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 transition hover:border-green-400"
              >
                <img src="/uin-logo.png" alt="uin? logo" className="h-8 w-auto" />
              </Link>

              <Link
                href="/communities/suggest"
                className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Suggest a Community
              </Link>
            </div>
          </div>
        </header>

        <CommunityDiscoveryFiltersForm
          query={query}
          categoryId={categoryId}
          activityId={activityId}
          locationId={locationId}
          eligibility={eligibility}
          sort={sort}
          scope={scope}
          categories={filters.categories ?? []}
          activities={filters.activities ?? []}
          locations={filters.locations ?? []}
        />

        {(filterResponse.error || communityResponse.error) && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Community discovery could not be loaded.
            </p>
            <p className="mt-2 text-sm text-red-700">
              {communityResponse.error?.message ||
                filterResponse.error?.message ||
                "Unknown database error."}
            </p>
          </section>
        )}

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
                Community results
              </p>

              <h2 className="mt-2 text-2xl font-black text-gray-950">
                {totalCount} Communities
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Ranked by {sort === "most_followed"
                  ? "follower count"
                  : sort === "most_active"
                    ? "current activity"
                    : sort === "most_experiences"
                      ? "completed experiences"
                      : sort === "recently_active"
                        ? "recent activity"
                        : "name"}.
              </p>
            </div>

            <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <Link
                href={buildCommunitiesHref({
                  query,
                  categoryId,
                  activityId,
                  locationId,
                  eligibility,
                  sort,
                  scope: "all",
                  applied,
                  page: 1,
                })}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  scope === "all"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                All Communities
              </Link>

              <Link
                href={buildCommunitiesHref({
                  query,
                  categoryId,
                  activityId,
                  locationId,
                  eligibility,
                  sort,
                  scope: "following",
                  applied,
                  page: 1,
                })}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  scope === "following"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Following
              </Link>
            </div>
          </div>

          {communities.length > 0 ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {communities.map((community) => (
                  <CommunityDiscoveryCard
                    key={community.community_id}
                    community={community}
                    showMatchingCount={applied && hasIntentFilters}
                    openHref={buildCommunityDetailHref({
                      slug: community.community_slug,
                      categoryId,
                      activityId,
                      locationId,
                      eligibility,
                      applied,
                    })}
                  />
                ))}
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                previousHref={currentHref(Math.max(1, page - 1))}
                nextHref={currentHref(Math.min(totalPages, page + 1))}
              />
            </>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="text-xl font-black text-gray-950">
                No Communities found
              </h3>

              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500">
                Try clearing one or more filters. Communities are remarkably bad at appearing where the criteria exclude them.
              </p>

              <Link
                href={scope === "following" ? "/communities?scope=following" : "/communities"}
                className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Clear filters
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
