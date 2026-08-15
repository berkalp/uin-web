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
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = [
    query.trim(),
    categoryId,
    activityId,
    locationId,
    eligibility !== "all" ? eligibility : "",
    sort !== "most_followed" ? sort : "",
  ].filter(Boolean).length;

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
    <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
            Search Communities
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {isExpanded
              ? "Refine Community results by context, eligibility and location."
              : activeFilterCount > 0
                ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}.`
                : "Open filters only when you need them."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            isExpanded
              ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
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
        action="/communities"
        className={`mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 ${
          isExpanded ? "" : "hidden"
        }`}
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

        <div className="xl:col-span-4 xl:self-end">
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
