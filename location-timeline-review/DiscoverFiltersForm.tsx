"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";

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

type FilterOption = {
  value: string;
  label: string;
};

type DiscoverFiltersFormProps = {
  query: string;
  categoryId: string;
  activityId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  lifecycle: string;
  scope: string;
  categories: DiscoveryCategory[];
  activities: DiscoveryActivity[];
  locations: DiscoveryLocation[];
  lifecycleOptions: readonly FilterOption[];
  scopeOptions: readonly FilterOption[];
};

export default function DiscoverFiltersForm({
  query,
  categoryId,
  activityId,
  locationId,
  startDate,
  endDate,
  lifecycle,
  scope,
  categories,
  activities,
  locations,
  lifecycleOptions,
  scopeOptions,
}: DiscoverFiltersFormProps) {
  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState(categoryId);

  const [
    selectedActivityId,
    setSelectedActivityId,
  ] = useState(activityId);

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

  function handleCategoryChange(
    nextCategoryId: string
  ) {
    setSelectedCategoryId(
      nextCategoryId
    );

    const selectedActivity =
      activities.find(
        (activity) =>
          activity.id ===
          selectedActivityId
      );

    if (
      selectedActivityId &&
      nextCategoryId &&
      selectedActivity?.category_id !==
        nextCategoryId
    ) {
      setSelectedActivityId("");
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <form
        method="get"
        action="/discover"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12"
      >
        <label className="xl:col-span-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Search
          </span>

          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Activity, alias, category or district"
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Lifecycle
          </span>

          <select
            name="lifecycle"
            defaultValue={lifecycle}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            {lifecycleOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Ownership
          </span>

          <select
            name="scope"
            defaultValue={scope}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            {scopeOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Category
          </span>

          <select
            name="category"
            value={selectedCategoryId}
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
            value={selectedActivityId}
            onChange={(event) =>
              setSelectedActivityId(
                event.target.value
              )
            }
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

        <label className="xl:col-span-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Approximate location
          </span>

          <select
            name="location"
            defaultValue={locationId}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="">
              All locations
            </option>

            {locations.map(
              (location) => (
                <option
                  key={location.id}
                  value={location.id}
                >
                  {location.district},{" "}
                  {location.city}
                </option>
              )
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            From
          </span>

          <input
            type="date"
            name="start"
            defaultValue={startDate}
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
            min={startDate || undefined}
            defaultValue={endDate}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none transition focus:border-blue-500"
          />
        </label>

        <div className="flex items-end gap-3 xl:col-span-4">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Search
          </button>

          <Link
            href="/discover"
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Reset
          </Link>
        </div>
      </form>
    </section>
  );
}
