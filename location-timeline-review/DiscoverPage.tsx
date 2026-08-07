import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import DiscoverFiltersForm from "./DiscoverFiltersForm";
import DiscoverIntentCard, {
  type DiscoverIntentRow,
} from "@/components/discover/DiscoverIntentCard";
import {
  createClient,
} from "@/utils/supabase/server";
import {
  groupIntentLinksByIntentId,
  parseIntentLinkRows,
  type IntentLinkRpcRow,
} from "@/utils/intentLinks";

export const dynamic =
  "force-dynamic";

type DiscoveryCategory = {
  id: string;
  name: string;
};

type DiscoveryActivity = {
  id: string;
  category_id: string;
  name: string;
  category_name: string;
  requires_sport: boolean;
};

type DiscoveryLocation = {
  id: string;
  city: string;
  district: string;
};

type DiscoveryFilters = {
  categories:
    | DiscoveryCategory[]
    | null;
  activities:
    | DiscoveryActivity[]
    | null;
  locations:
    | DiscoveryLocation[]
    | null;
};

type DiscoverSearchParams =
  Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;

const PAGE_SIZE = 24;

const LIFECYCLE_OPTIONS = [
  {
    value: "all",
    label: "All lifecycle stages",
  },
  {
    value: "open",
    label: "Open now",
  },
  {
    value: "future",
    label: "Future Intents",
  },
  {
    value: "planned",
    label: "Planned Activities",
  },
  {
    value: "closed",
    label: "Closed Intents",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
  {
    value: "expired",
    label: "Expired / did not happen",
  },
  {
    value: "history",
    label: "All history",
  },
] as const;

const SCOPE_OPTIONS = [
  {
    value: "all",
    label: "Everyone",
  },
  {
    value: "mine",
    label: "Hosted by me",
  },
  {
    value: "friends",
    label: "My friends",
  },
  {
    value: "others",
    label: "Other people",
  },
] as const;

function getParam(
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

  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      ""
    );
  }

  return (
    value ??
    ""
  );
}

function getPageNumber(
  value: string
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isInteger(
      parsedValue
    ) ||
    parsedValue < 1
  ) {
    return 1;
  }

  return parsedValue;
}

function getLifecycle(
  value: string
) {
  return LIFECYCLE_OPTIONS.some(
    (option) =>
      option.value ===
      value
  )
    ? value
    : "all";
}

function getScope(
  value: string
) {
  return SCOPE_OPTIONS.some(
    (option) =>
      option.value ===
      value
  )
    ? value
    : "all";
}

function toCount(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function buildDiscoverHref({
  query,
  categoryId,
  activityId,
  locationId,
  startDate,
  endDate,
  lifecycle,
  scope,
  page,
}: {
  query: string;
  categoryId: string;
  activityId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  lifecycle: string;
  scope: string;
  page: number;
}) {
  const params =
    new URLSearchParams();

  if (query) {
    params.set(
      "q",
      query
    );
  }

  if (categoryId) {
    params.set(
      "category",
      categoryId
    );
  }

  if (activityId) {
    params.set(
      "activity",
      activityId
    );
  }

  if (locationId) {
    params.set(
      "location",
      locationId
    );
  }

  if (startDate) {
    params.set(
      "start",
      startDate
    );
  }

  if (endDate) {
    params.set(
      "end",
      endDate
    );
  }

  if (
    lifecycle !==
    "all"
  ) {
    params.set(
      "lifecycle",
      lifecycle
    );
  }

  if (
    scope !==
    "all"
  ) {
    params.set(
      "scope",
      scope
    );
  }

  if (page > 1) {
    params.set(
      "page",
      String(page)
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/discover?${queryString}`
    : "/discover";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams:
    DiscoverSearchParams;
}) {
  const resolvedSearchParams =
    await searchParams;

  const query =
    getParam(
      resolvedSearchParams,
      "q"
    ).trim();

  const categoryId =
    getParam(
      resolvedSearchParams,
      "category"
    );

  const activityId =
    getParam(
      resolvedSearchParams,
      "activity"
    );

  const locationId =
    getParam(
      resolvedSearchParams,
      "location"
    );

  const startDate =
    getParam(
      resolvedSearchParams,
      "start"
    );

  const endDate =
    getParam(
      resolvedSearchParams,
      "end"
    );

  const lifecycle =
    getLifecycle(
      getParam(
        resolvedSearchParams,
        "lifecycle"
      )
    );

  const scope =
    getScope(
      getParam(
        resolvedSearchParams,
        "scope"
      )
    );

  const page =
    getPageNumber(
      getParam(
        resolvedSearchParams,
        "page"
      )
    );

  const hasActiveFilters =
    Boolean(
      query ||
      categoryId ||
      activityId ||
      locationId ||
      startDate ||
      endDate ||
      lifecycle !== "all" ||
      scope !== "all"
    );

  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    filterResponse,
    searchResponse,
  ] =
    await Promise.all([
      supabase.rpc(
        "get_intent_discovery_filters"
      ),

      supabase.rpc(
        "search_visible_intents",
        {
          p_query:
            query ||
            null,

          p_category_id:
            categoryId ||
            null,

          p_activity_id:
            activityId ||
            null,

          p_location_id:
            locationId ||
            null,

          p_start_date:
            startDate ||
            null,

          p_end_date:
            endDate ||
            null,

          p_lifecycle:
            lifecycle,

          p_scope:
            scope,

          p_limit:
            PAGE_SIZE,

          p_offset:
            (
              page -
              1
            ) *
            PAGE_SIZE,
        }
      ),
    ]);

  if (
    filterResponse.error
  ) {
    console.error(
      "Intent discovery filters failed:",
      filterResponse.error
    );
  }

  if (
    searchResponse.error
  ) {
    console.error(
      "Intent discovery search failed:",
      searchResponse.error
    );
  }

  const filters =
    (
      filterResponse.data ?? {
        categories: [],
        activities: [],
        locations: [],
      }
    ) as DiscoveryFilters;

  const categories =
    filters.categories ??
    [];

  const activities =
    filters.activities ??
    [];

  const locations =
    filters.locations ??
    [];

  const results =
    (
      searchResponse.data ??
      []
    ) as DiscoverIntentRow[];

  let intentLinkRows:
    IntentLinkRpcRow[] =
    [];

  if (
    results.length >
    0
  ) {
    const {
      data:
        intentLinkData,
      error:
        intentLinkError,
    } = await supabase.rpc(
      "get_visible_intent_links",
      {
        p_intent_ids:
          results.map(
            (intent) =>
              intent.intent_id
          ),
      }
    );

    if (
      intentLinkError
    ) {
      console.error(
        "Intent related links query failed:",
        intentLinkError
      );
    } else {
      intentLinkRows =
        (
          intentLinkData ??
          []
        ) as IntentLinkRpcRow[];
    }
  }

  const intentLinksByIntentId =
    groupIntentLinksByIntentId(
      parseIntentLinkRows(
        intentLinkRows
      )
    );

  const totalCount =
    toCount(
      results[0]?.total_count
    );

  const totalPages =
    Math.max(
      Math.ceil(
        totalCount /
          PAGE_SIZE
      ),
      1
    );

  const hasPrevious =
    page > 1;

  const hasNext =
    page <
    totalPages;

  const lifecycleLabel =
    LIFECYCLE_OPTIONS.find(
      (option) =>
        option.value ===
        lifecycle
    )?.label ??
    "All lifecycle stages";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1680px]">
        <header className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Intent Discovery
              </p>

              <h1 className="mt-2 text-3xl font-bold text-gray-950">
                Discover Intents
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
                Browse current, future and
                historical Intents. Your
                own records are included
                and marked as hosted by
                you. Leave every field
                empty to see everything
                visible to your account.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/timeline"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-green-400 hover:text-green-700"
              >
                ← Timeline
              </Link>

              <Link
                href="/onboarding"
                className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Create New Intent
              </Link>
            </div>
          </div>
        </header>

        <DiscoverFiltersForm
          query={query}
          categoryId={categoryId}
          activityId={activityId}
          locationId={locationId}
          startDate={startDate}
          endDate={endDate}
          lifecycle={lifecycle}
          scope={scope}
          categories={categories}
          activities={activities}
          locations={locations}
          lifecycleOptions={LIFECYCLE_OPTIONS}
          scopeOptions={SCOPE_OPTIONS}
        />

        {(filterResponse.error ||
          searchResponse.error) && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Intent discovery could not
              be loaded.
            </p>

            <p className="mt-2 text-sm text-red-700">
              {searchResponse.error?.message ??
                filterResponse.error?.message}
            </p>
          </section>
        )}

        {!searchResponse.error && (
          <>
            <section className="mt-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  {hasActiveFilters
                    ? lifecycleLabel
                    : "All visible Intents"}
                </p>

                <h2 className="mt-1 text-2xl font-bold text-gray-950">
                  {totalCount} Intent
                  {totalCount ===
                  1
                    ? ""
                    : "s"}
                </h2>
              </div>

              {totalCount >
                0 && (
                <p className="text-sm text-gray-500">
                  Page {page} of{" "}
                  {
                    totalPages
                  }
                </p>
              )}
            </section>

            {results.length >
            0 ? (
              <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {results.map(
                  (intent) => (
                    <DiscoverIntentCard
                      key={
                        intent.intent_id
                      }
                      intent={
                        intent
                      }
                      currentUserId={
                        user.id
                      }
                      relatedLinks={
                        intentLinksByIntentId.get(
                          intent.intent_id
                        ) ?? []
                      }
                    />
                  )
                )}
              </section>
            ) : (
              <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-bold text-gray-950">
                  No Intents found
                </h2>

                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500">
                  Broaden the Activity,
                  lifecycle, ownership,
                  location or date filters.
                  Private records remain
                  visible only to their
                  owners and eligible
                  members.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/discover"
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    Clear filters
                  </Link>

                  <Link
                    href="/onboarding"
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Create an Intent
                  </Link>
                </div>
              </section>
            )}

            {totalPages >
              1 && (
              <nav
                aria-label="Intent discovery pagination"
                className="mt-8 flex items-center justify-center gap-3"
              >
                {hasPrevious ? (
                  <Link
                    href={buildDiscoverHref({
                      query,
                      categoryId,
                      activityId,
                      locationId,
                      startDate,
                      endDate,
                      lifecycle,
                      scope,
                      page:
                        page -
                        1,
                    })}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="rounded-xl border border-gray-100 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                    ← Previous
                  </span>
                )}

                <span className="rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white">
                  {page} /{" "}
                  {
                    totalPages
                  }
                </span>

                {hasNext ? (
                  <Link
                    href={buildDiscoverHref({
                      query,
                      categoryId,
                      activityId,
                      locationId,
                      startDate,
                      endDate,
                      lifecycle,
                      scope,
                      page:
                        page +
                        1,
                    })}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="rounded-xl border border-gray-100 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400">
                    Next →
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
