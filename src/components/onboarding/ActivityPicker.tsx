"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ActivityCatalogueItem,
  ActivityCategory,
} from "@/services/activityService";

export type ActivityRequestDetails = {
  selectedCategoryId: string;
  proposedActivityName: string;
  description: string;
};

type ActivityPickerProps = {
  categories: ActivityCategory[];
  activities: ActivityCatalogueItem[];
  categoryId: string;
  activityId: string;
  onCategoryChange: (
    value: string
  ) => void;
  onActivityChange: (
    value: string
  ) => void;
  onRequestActivity: (
    details: ActivityRequestDetails
  ) => Promise<void>;
  requestDisabled: boolean;
  requestDisabledMessage: string;
  isRequesting: boolean;
};

function normalizeSearchValue(
  value: string
) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSimilarityScore(
  activity: ActivityCatalogueItem,
  query: string
) {
  const normalizedQuery =
    normalizeSearchValue(query);

  if (!normalizedQuery) {
    return 0;
  }

  const normalizedName =
    normalizeSearchValue(
      activity.name
    );

  const normalizedAliases =
    (activity.aliases ?? []).map(
      normalizeSearchValue
    );

  if (
    normalizedName ===
      normalizedQuery ||
    normalizedAliases.includes(
      normalizedQuery
    )
  ) {
    return 100;
  }

  if (
    normalizedName.includes(
      normalizedQuery
    ) ||
    normalizedQuery.includes(
      normalizedName
    )
  ) {
    return 70;
  }

  const queryTokens =
    new Set(
      normalizedQuery
        .split(" ")
        .filter(Boolean)
    );

  const activityTokens =
    new Set(
      [
        normalizedName,
        ...normalizedAliases,
      ]
        .join(" ")
        .split(" ")
        .filter(Boolean)
    );

  let overlap = 0;

  queryTokens.forEach(
    (token) => {
      if (
        activityTokens.has(
          token
        )
      ) {
        overlap += 1;
      }
    }
  );

  return overlap * 20;
}

export default function ActivityPicker({
  categories,
  activities,
  categoryId,
  activityId,
  onCategoryChange,
  onActivityChange,
  onRequestActivity,
  requestDisabled,
  requestDisabledMessage,
  isRequesting,
}: ActivityPickerProps) {
  const selectedCategory =
    categories.find(
      (category) =>
        category.id ===
        categoryId
    ) ?? null;

  const categoryActivities =
    useMemo(
      () =>
        activities.filter(
          (activity) =>
            activity.category_id ===
            categoryId
        ),
      [
        activities,
        categoryId,
      ]
    );

  const selectedActivity =
    categoryActivities.find(
      (activity) =>
        activity.id ===
        activityId
    ) ?? null;

  const [query, setQuery] =
    useState("");

  const [isFocused, setIsFocused] =
    useState(false);

  const [requestOpen, setRequestOpen] =
    useState(false);

  const [proposedActivityName, setProposedActivityName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [localMessage, setLocalMessage] =
    useState<string | null>(null);

  useEffect(() => {
    setQuery(
      selectedActivity?.name ?? ""
    );
  }, [selectedActivity]);

  useEffect(() => {
    setQuery("");
    setRequestOpen(false);
    setProposedActivityName("");
    setDescription("");
    setLocalMessage(null);
  }, [categoryId]);

  const normalizedQuery =
    normalizeSearchValue(query);

  const filteredActivities =
    useMemo(() => {
      if (!normalizedQuery) {
        return categoryActivities;
      }

      return categoryActivities.filter(
        (activity) => {
          const haystack = [
            activity.name,
            ...(activity.aliases ?? []),
          ]
            .map(
              normalizeSearchValue
            )
            .join(" ");

          return haystack.includes(
            normalizedQuery
          );
        }
      );
    }, [
      categoryActivities,
      normalizedQuery,
    ]);

  const similarActivities =
    useMemo(() => {
      const source =
        proposedActivityName.trim() ||
        query.trim();

      if (
        source.length < 2
      ) {
        return [];
      }

      return categoryActivities
        .map((activity) => ({
          activity,
          score:
            getSimilarityScore(
              activity,
              source
            ),
        }))
        .filter(
          (entry) =>
            entry.score > 0
        )
        .sort(
          (first, second) =>
            second.score -
            first.score
        )
        .slice(0, 5)
        .map(
          (entry) =>
            entry.activity
        );
    }, [
      categoryActivities,
      proposedActivityName,
      query,
    ]);

  const showResults =
    Boolean(categoryId) &&
    isFocused &&
    !selectedActivity;

  const canOfferRequest =
    Boolean(categoryId) &&
    (
      normalizedQuery.length >= 2 ||
      categoryActivities.length === 0
    );

  function selectActivity(
    activity: ActivityCatalogueItem
  ) {
    onActivityChange(
      activity.id
    );
    setQuery(
      activity.name
    );
    setIsFocused(false);
    setRequestOpen(false);
    setLocalMessage(null);
  }

  function openRequestPanel() {
    if (!categoryId) {
      setLocalMessage(
        "Select an Activity category first."
      );
      return;
    }

    setProposedActivityName(
      query.trim()
    );
    setRequestOpen(true);
    setIsFocused(false);
    setLocalMessage(null);
  }

  async function handleRequest() {
    const activityName =
      proposedActivityName.trim();

    const requestDescription =
      description.trim();

    if (!categoryId) {
      setLocalMessage(
        "Select an Activity category first."
      );
      return;
    }

    if (
      activityName.length < 3
    ) {
      setLocalMessage(
        "Enter an Activity name with at least 3 characters."
      );
      return;
    }

    if (
      requestDescription.length <
      30
    ) {
      setLocalMessage(
        "Explain the requested Activity in at least 30 characters."
      );
      return;
    }

    if (requestDisabled) {
      setLocalMessage(
        requestDisabledMessage
      );
      return;
    }

    setLocalMessage(null);

    await onRequestActivity({
      selectedCategoryId:
        categoryId,
      proposedActivityName:
        activityName,
      description:
        requestDescription,
    });
  }

  return (
    <section className="md:col-span-2">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-600">
            Activity category
            <span
              aria-hidden="true"
              className="ml-1 text-red-600"
            >
              *
            </span>
          </span>

          <select
            value={categoryId}
            required
            onChange={(event) => {
              onCategoryChange(
                event.target.value
              );
              onActivityChange("");
            }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-500"
          >
            <option value="">
              Select a category
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

        <div className="relative">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-600">
              Activity
            <span
              aria-hidden="true"
              className="ml-1 text-red-600"
            >
              *
            </span>
            </span>

            <div className="flex items-center rounded-xl border border-gray-200 bg-white focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
              <input
                value={query}
                aria-required="true"
                disabled={!categoryId}
                onFocus={() =>
                  setIsFocused(true)
                }
                onBlur={() =>
                  setIsFocused(false)
                }
                onChange={(event) => {
                  setQuery(
                    event.target.value
                  );

                  if (activityId) {
                    onActivityChange("");
                  }
                }}
                placeholder={
                  categoryId
                    ? "Search or select an Activity"
                    : "Select a category first"
                }
                className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 outline-none disabled:bg-gray-100 disabled:text-gray-400"
              />

              {selectedActivity && (
                <button
                  type="button"
                  onClick={() => {
                    onActivityChange("");
                    setQuery("");
                    setIsFocused(true);
                  }}
                  className="mr-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  Clear
                </button>
              )}
            </div>
          </label>

          {showResults && (
            <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
              {filteredActivities.length >
              0 ? (
                <div className="space-y-1">
                  {filteredActivities.map(
                    (activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          selectActivity(
                            activity
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-green-50"
                      >
                        <span className="font-semibold text-gray-950">
                          {activity.name}
                        </span>

                        <span className="text-sm font-semibold text-green-700">
                          Select
                        </span>
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm text-gray-500">
                  No Activity matched in {selectedCategory?.name ?? "this category"}.
                </p>
              )}

              {canOfferRequest ? (
                <button
                  type="button"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={openRequestPanel}
                  className="mt-2 w-full rounded-xl border border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-left text-sm font-semibold text-purple-800 transition hover:border-purple-500 hover:bg-purple-100"
                >
                  Can&apos;t find it in {selectedCategory?.name}? Request a new Activity
                </button>
              ) : (
                <p className="mt-2 px-4 py-3 text-xs leading-5 text-gray-400">
                  Search inside this category first. The request option appears after you enter at least 2 characters.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedActivity && (
        <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Selected canonical Activity
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-950">
              {selectedActivity.name}
            </span>

            <span className="text-sm text-gray-500">
              under {selectedActivity.category_name}
            </span>
          </div>
        </div>
      )}

      {canOfferRequest &&
        !selectedActivity &&
        !requestOpen && (
          <button
            type="button"
            onClick={openRequestPanel}
            className="mt-3 text-sm font-semibold text-purple-700 transition hover:text-purple-900 hover:underline"
          >
            Can&apos;t find the Activity in {selectedCategory?.name}? Request it
          </button>
        )}

      {requestOpen && (
        <section className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                Activity request
              </p>

              <h3 className="mt-1 font-bold text-purple-950">
                Request a missing Activity in {selectedCategory?.name}
              </h3>

              <p className="mt-2 text-sm leading-6 text-purple-800">
                Your wording is used only for administrator review. The published Intent will use the canonical Activity selected or created by the administrator.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setRequestOpen(false);
                setLocalMessage(null);
              }}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
            >
              Close
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-purple-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
              Selected category
            </p>

            <p className="mt-1 font-bold text-purple-950">
              {selectedCategory?.name}
            </p>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-purple-950">
                Activity you could not find
              </span>

              <input
                value={proposedActivityName}
                onChange={(event) =>
                  setProposedActivityName(
                    event.target.value
                  )
                }
                placeholder="For example, wood carving"
                maxLength={120}
                className="mt-2 w-full rounded-xl border border-purple-200 bg-white px-4 py-3 outline-none focus:border-purple-500"
              />
            </label>

            {similarActivities.length >
              0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Similar Activities already in this category
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {similarActivities.map(
                    (activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() =>
                          selectActivity(
                            activity
                          )
                        }
                        className="rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:border-green-400 hover:text-green-700"
                      >
                        Use {activity.name}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-purple-950">
                What do you mean by this Activity?
              </span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Describe the real-world Activity clearly. For example: carving and shaping small pieces of wood by hand with knives and small tools."
                maxLength={2000}
                className="mt-2 h-28 w-full resize-none rounded-xl border border-purple-200 bg-white px-4 py-3 outline-none focus:border-purple-500"
              />

              <span className="mt-2 block text-xs text-purple-600">
                Minimum 30 characters. This explanation helps the administrator classify the request correctly.
              </span>
            </label>
          </div>

          {requestDisabled && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {requestDisabledMessage}
            </p>
          )}

          {localMessage && (
            <p className="mt-4 text-sm font-semibold text-red-700">
              {localMessage}
            </p>
          )}

          <button
            type="button"
            disabled={
              isRequesting ||
              requestDisabled
            }
            onClick={handleRequest}
            className="mt-5 w-full rounded-xl bg-purple-700 px-5 py-3.5 font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:bg-purple-300"
          >
            {isRequesting
              ? "Saving request..."
              : "None of these fit — Send Activity Request & Save Intent Draft"}
          </button>

          <p className="mt-3 text-center text-xs leading-5 text-purple-600">
            Identical pending requests are grouped. One administrator item can represent many users waiting for the same Activity.
          </p>
        </section>
      )}
    </section>
  );
}
