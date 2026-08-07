"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import LocationHierarchySelect from "@/components/locations/LocationHierarchySelect";

import type { HierarchicalLocation } from "@/utils/location";
import type { ParticipantEligibility } from "@/utils/participationEligibility";

export type CommunityDiscoveryEligibilityFilter =
  | "eligible"
  | ParticipantEligibility
  | "all";

export type CommunityDiscoverySort =
  | "most_followed"
  | "most_active"
  | "most_experiences"
  | "recently_active"
  | "az";

type FilterCategory = {
  id: string;
  name: string;
};

type FilterActivity = {
  id: string;
  category_id: string;
  name: string;
  category_name: string;
};

type CommunityDiscoveryFiltersFormProps = {
  query: string;
  categoryId: string;
  activityId: string;
  locationId: string;
  eligibility: CommunityDiscoveryEligibilityFilter;
  sort: CommunityDiscoverySort;
  scope: "all" | "following";
  categories: FilterCategory[];
  activities: FilterActivity[];
  locations: HierarchicalLocation[];
};

export default function CommunityDiscoveryFiltersForm({
  query,
  categoryId,
  activityId,
  locationId,
  eligibility,
  sort,
  scope,
  categories,
  activities,
  locations,
}: CommunityDiscoveryFiltersFormProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId);
  const [selectedActivityId, setSelectedActivityId] = useState(activityId);
  const [selectedLocationId, setSelectedLocationId] = useState(locationId);

  const visibleActivities = useMemo(
    () =>
      selectedCategoryId
        ? activities.filter(
            (activity) => activity.category_id === selectedCategoryId
          )
        : activities,
    [activities, selectedCategoryId]
  );

  const clearHref =
    scope === "following"
      ? "/communities?scope=following"
      : "/communities";

  function handleCategoryChange(nextCategoryId: string) {
    setSelectedCategoryId(nextCategoryId);

    if (!nextCategoryId) {
      return;
    }

    const selectedActivity = activities.find(
      (activity) => activity.id === selectedActivityId
    );

    if (
      selectedActivity &&
      selectedActivity.category_id !== nextCategoryId
    ) {
      setSelectedActivityId("");
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
          Search Communities
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Find Community context by name, Activity or location. Date filters live inside each Community, where they filter actual Intents rather than Communities themselves.
        </p>
      </div>

      <form
        method="get"
        action="/communities"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12"
      >
        <input type="hidden" name="apply" value="1" />

        {scope === "following" && (
          <input type="hidden" name="scope" value="following" />
        )}

        <label className="xl:col-span-5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Search
          </span>

          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Community name, sport, category or Activity"
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="xl:col-span-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Category
          </span>

          <select
            name="category"
            value={selectedCategoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="">All categories</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Activity
          </span>

          <select
            name="activity"
            value={selectedActivityId}
            onChange={(event) => setSelectedActivityId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="">
              {selectedCategoryId
                ? "All Activities in category"
                : "All Activities"}
            </option>

            {visibleActivities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Participant Eligibility
          </span>

          <select
            name="eligibility"
            defaultValue={eligibility}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-fuchsia-500"
          >
            <option value="eligible">Eligible for me</option>
            <option value="everyone">Open to Everyone</option>
            <option value="women_only">Women Only</option>
            <option value="men_only">Men Only</option>
            <option value="all">All eligibility rules</option>
          </select>
        </label>

        <div className="xl:col-span-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Approximate location
          </span>

          <div className="mt-2">
            <LocationHierarchySelect
              locations={locations}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              name="location"
              allowEmpty
              emptyLabel="All locations"
              variant="filter"
            />
          </div>
        </div>

        <label className="xl:col-span-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Sort by
          </span>

          <select
            name="sort"
            defaultValue={sort}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500"
          >
            <option value="most_followed">Most Followed</option>
            <option value="most_active">Most Active</option>
            <option value="most_experiences">Most Experiences</option>
            <option value="recently_active">Recently Active</option>
            <option value="az">A–Z</option>
          </select>
        </label>

        <div className="flex items-end gap-3 xl:col-span-2">
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Search
          </button>

          <Link
            href={clearHref}
            className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-semibold text-gray-700 transition hover:border-gray-400"
          >
            Clear
          </Link>
        </div>
      </form>
    </section>
  );
}
