"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import LocationHierarchySelect from "@/components/locations/LocationHierarchySelect";

import type {
  CommunityOption,
} from "@/utils/communities";

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

type DiscoverySport = {
  id: string;
  name: string;
  slug?: string | null;
};

type DiscoveryLocation = {
  id: string;
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  district?: string | null;
  scope?: string | null;
};

type DiscoverFiltersFormProps = {
  query: string;
  categoryId: string;
  activityId: string;
  sportId: string;
  communityId: string;
  communityScope: string;
  locationId: string;
  startDate: string;
  endDate: string;
  lifecycle: string;
  scope: string;
  eligibility: string;
  view: "cards" | "map" | "split";
  categories: DiscoveryCategory[];
  activities: DiscoveryActivity[];
  sports: DiscoverySport[];
  communities: CommunityOption[];
  locations: DiscoveryLocation[];
};

export default function DiscoverFiltersForm({
  query,
  categoryId,
  activityId,
  sportId,
  communityId,
  communityScope,
  locationId,
  startDate,
  endDate,
  lifecycle,
  scope,
  eligibility,
  view,
  categories,
  activities,
  sports,
  communities,
  locations,
}: DiscoverFiltersFormProps) {
  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState(
    categoryId
  );

  const [
    selectedActivityId,
    setSelectedActivityId,
  ] = useState(
    activityId
  );

  const [
    selectedSportId,
    setSelectedSportId,
  ] = useState(() => {
    const initialActivity =
      activities.find(
        (activity) =>
          activity.id ===
          activityId
      ) ?? null;

    return initialActivity
      ?.requires_sport === true
      ? sportId
      : "";
  });

  const [
    selectedCommunityId,
    setSelectedCommunityId,
  ] = useState(
    communityId
  );

  const [
    selectedLocationId,
    setSelectedLocationId,
  ] = useState(
    locationId
  );

  const [
    isExpanded,
    setIsExpanded,
  ] = useState(
    view === "cards"
  );

  useEffect(() => {
    setIsExpanded(view === "cards");
  }, [view]);

  const activeFilterCount = [
    query.trim(),
    categoryId,
    activityId,
    sportId,
    communityId,
    locationId,
    startDate,
    endDate,
    eligibility !== "eligible" ? eligibility : "",
  ].filter(Boolean).length;

  const clearSearchHref =
    useMemo(() => {
      const params =
        new URLSearchParams();

      if (
        lifecycle !==
        "current"
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

      if (
        eligibility !==
        "eligible"
      ) {
        params.set(
          "eligibility",
          eligibility
        );
      }

      if (view !== "cards") {
        params.set("view", view);
      }

      const queryString =
        params.toString();

      return queryString
        ? `/discover?${queryString}`
        : "/discover";
    }, [
      lifecycle,
      scope,
      eligibility,
      view,
    ]);

  const selectedActivity =
    activities.find(
      (activity) =>
        activity.id ===
        selectedActivityId
    ) ?? null;

  const selectedActivityRequiresSport =
    selectedActivity?.requires_sport ===
    true;

  const visibleActivities =
    useMemo(
      () =>
        selectedCategoryId
          ? activities.filter(
              (activity) =>
                activity.category_id ===
                selectedCategoryId
            )
          : activities,
      [
        activities,
        selectedCategoryId,
      ]
    );

  const visibleCommunities =
    useMemo(
      () =>
        selectedCategoryId
          ? communities.filter(
              (community) =>
                community.scopeType ===
                  "global" ||
                community.categoryIds.includes(
                  selectedCategoryId
                )
            )
          : communities,
      [
        communities,
        selectedCategoryId,
      ]
    );

  function handleCategoryChange(
    nextCategoryId: string
  ) {
    setSelectedCategoryId(
      nextCategoryId
    );

    setSelectedSportId("");

    const selectedActivity =
      activities.find(
        (activity) =>
          activity.id ===
          selectedActivityId
      );

    if (
      selectedActivityId &&
      nextCategoryId &&
      selectedActivity
        ?.category_id !==
        nextCategoryId
    ) {
      setSelectedActivityId("");
    }

    const selectedCommunity =
      communities.find(
        (community) =>
          community.id ===
          selectedCommunityId
      );

    if (
      selectedCommunityId &&
      nextCategoryId &&
      selectedCommunity &&
      selectedCommunity.scopeType !==
        "global" &&
      !selectedCommunity.categoryIds.includes(
        nextCategoryId
      )
    ) {
      setSelectedCommunityId("");
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            Search & filters
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {isExpanded
              ? "Refine the visible Intent results."
              : view === "cards"
                ? "Filters are collapsed."
                : "Hidden to leave more room for the map."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            isExpanded
              ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          <span aria-hidden="true">{isExpanded ? "▴" : "▾"}</span>
          {isExpanded
            ? "Hide filters"
            : `Show filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`}
        </button>
      </div>

      <form
        method="get"
        action="/discover"
        className={`mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 ${
          isExpanded ? "" : "hidden"
        }`}
      >
        {communityScope ===
          "following" && (
          <input
            type="hidden"
            name="community_scope"
            value="following"
          />
        )}

        <input
          type="hidden"
          name="lifecycle"
          value={lifecycle}
        />

        <input
          type="hidden"
          name="scope"
          value={scope}
        />

        {view !== "cards" && (
          <input type="hidden" name="view" value={view} />
        )}

        <label className="xl:col-span-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Search
          </span>

          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Activity, sport, Community, category or district"
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Category
          </span>

          <select
            name="category"
            value={
              selectedCategoryId
            }
            onChange={(event) =>
              handleCategoryChange(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="">
              All categories
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              )
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Activity
          </span>

          <select
            name="activity"
            value={
              selectedActivityId
            }
            onChange={(event) => {
              const nextActivityId =
                event.target.value;

              setSelectedActivityId(
                nextActivityId
              );

              const nextActivity =
                activities.find(
                  (activity) =>
                    activity.id ===
                    nextActivityId
                ) ?? null;

              if (
                nextActivity
                  ?.requires_sport !==
                true
              ) {
                setSelectedSportId("");
              }
            }}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="">
              {selectedCategoryId
                ? "All Activities in category"
                : "All Activities"}
            </option>

            {visibleActivities.map(
              (activity) => (
                <option
                  key={activity.id}
                  value={activity.id}
                >
                  {activity.name}
                </option>
              )
            )}
          </select>
        </label>

        {selectedActivityRequiresSport && (
          <label className="xl:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Sport
            </span>

            <select
              name="sport"
              value={
                selectedSportId
              }
              onChange={(event) =>
                setSelectedSportId(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-green-500"
            >
              <option value="">
                All Sports
              </option>

              {sports.map(
                (sport) => (
                  <option
                    key={sport.id}
                    value={sport.id}
                  >
                    {sport.name}
                  </option>
                )
              )}
            </select>
          </label>
        )}

        <label
          className={
            selectedActivityRequiresSport
              ? "xl:col-span-2"
              : "xl:col-span-4"
          }
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Community
          </span>

          <select
            name="community"
            value={
              selectedCommunityId
            }
            onChange={(event) =>
              setSelectedCommunityId(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-indigo-500"
          >
            <option value="">
              {selectedCategoryId
                ? "All Communities in category"
                : "All Communities"}
            </option>

            {visibleCommunities.map(
              (community) => (
                <option
                  key={
                    community.id
                  }
                  value={
                    community.id
                  }
                >
                  {community.name}
                </option>
              )
            )}
          </select>
        </label>

        <label className="xl:col-span-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Participant Eligibility
          </span>

          <select
            name="eligibility"
            defaultValue={eligibility}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-fuchsia-500"
          >
            <option value="eligible">
              Eligible for me
            </option>
            <option value="everyone">
              Open to Everyone
            </option>
            <option value="women_only">
              Women Only
            </option>
            <option value="men_only">
              Men Only
            </option>
            <option value="all">
              All eligibility rules
            </option>
          </select>
        </label>

        <div className="xl:col-span-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Approximate location
          </span>

          <div className="mt-2">
            <LocationHierarchySelect
              locations={
                locations
              }
              value={
                selectedLocationId
              }
              onChange={
                setSelectedLocationId
              }
              name="location"
              allowEmpty
              emptyLabel="All locations"
              variant="filter"
            />
          </div>
        </div>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            From
          </span>

          <input
            type="date"
            name="start"
            defaultValue={
              startDate
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          />
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Until
          </span>

          <input
            type="date"
            name="end"
            min={
              startDate ||
              undefined
            }
            defaultValue={
              endDate
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          />
        </label>

        <div className="flex items-end gap-3 xl:col-span-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Search
          </button>

          <Link
            href={
              clearSearchHref
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Clear
          </Link>
        </div>
      </form>
    </section>
  );
}
