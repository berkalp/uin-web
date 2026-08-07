"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";

export type AdminCatalogueCategory = {
  id: string;
  name: string;
  is_active: boolean;
  default_cover_url: string | null;
  activity_count:
    | number
    | string
    | null;
  active_activity_count:
    | number
    | string
    | null;
};

export type AdminCatalogueActivity = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order:
    | number
    | string
    | null;
  category_id: string;
  category_name: string;
  category_is_active: boolean;
  default_cover_url: string | null;
  category_cover_url: string | null;
  intent_count:
    | number
    | string
    | null;
  plan_count:
    | number
    | string
    | null;
  aliases: string[];
};

type ActivityCatalogueManagerProps = {
  categories: AdminCatalogueCategory[];
  activities: AdminCatalogueActivity[];
};

function toNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsedValue =
    Number(value ?? 0);

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function CategoryEditor({
  category,
}: {
  category: AdminCatalogueCategory;
}) {
  const router = useRouter();

  const [name, setName] =
    useState(category.name);

  const [isActive, setIsActive] =
    useState(
      category.is_active
    );

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setMessage(null);

    const { error } =
      await supabase.rpc(
        "admin_update_activity_category",
        {
          p_category_id:
            category.id,
          p_name:
            name,
          p_is_active:
            isActive,
        }
      );

    setIsSaving(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-950 outline-none focus:border-green-500"
        />

        <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) =>
              setIsActive(
                event.target.checked
              )
            }
            className="h-4 w-4"
          />
          Active
        </label>

        <button
          type="button"
          disabled={
            isSaving ||
            name.trim().length < 2
          }
          onClick={save}
          className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving
            ? "Saving..."
            : "Save"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>
          {toNumber(
            category.active_activity_count
          )}{" "}
          active /{" "}
          {toNumber(
            category.activity_count
          )}{" "}
          total Activities
        </p>

        {message && (
          <p
            className={
              message ===
              "Saved."
                ? "font-semibold text-green-700"
                : "font-semibold text-red-700"
            }
          >
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

function ActivityEditor({
  activity,
  categories,
}: {
  activity: AdminCatalogueActivity;
  categories: AdminCatalogueCategory[];
}) {
  const router = useRouter();

  const [name, setName] =
    useState(activity.name);

  const [
    categoryId,
    setCategoryId,
  ] = useState(
    activity.category_id
  );

  const [isActive, setIsActive] =
    useState(
      activity.is_active
    );

  const [
    sortOrder,
    setSortOrder,
  ] = useState(
    String(
      toNumber(
        activity.sort_order
      )
    )
  );

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setMessage(null);

    const parsedSortOrder =
      Number(sortOrder);

    if (
      !Number.isInteger(
        parsedSortOrder
      ) ||
      parsedSortOrder < 0
    ) {
      setIsSaving(false);
      setMessage(
        "Sort order must be zero or greater."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_update_catalogue_activity",
        {
          p_activity_id:
            activity.id,
          p_category_id:
            categoryId,
          p_name:
            name,
          p_is_active:
            isActive,
          p_sort_order:
            parsedSortOrder,
        }
      );

    setIsSaving(false);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)_120px_auto_auto] lg:items-center">
        <input
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          className="min-w-0 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-950 outline-none focus:border-green-500"
        />

        <select
          value={categoryId}
          onChange={(event) =>
            setCategoryId(
              event.target.value
            )
          }
          className="rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-500"
        >
          {categories.map(
            (category) => (
              <option
                key={
                  category.id
                }
                value={
                  category.id
                }
              >
                {
                  category.name
                }
                {category.is_active
                  ? ""
                  : " (inactive)"}
              </option>
            )
          )}
        </select>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Sort
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(
                event.target.value
              )
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-center font-semibold outline-none focus:border-green-500"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) =>
              setIsActive(
                event.target.checked
              )
            }
            className="h-4 w-4"
          />
          Active
        </label>

        <button
          type="button"
          disabled={
            isSaving ||
            name.trim().length < 2 ||
            !categoryId
          }
          onClick={save}
          className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving
            ? "Saving..."
            : "Save"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>
          {toNumber(
            activity.intent_count
          )}{" "}
          Intents ·{" "}
          {toNumber(
            activity.plan_count
          )}{" "}
          Plans · Sort{" "}
          {toNumber(
            activity.sort_order
          )}
          {activity.aliases.length >
          0
            ? ` · ${activity.aliases.length} search aliases`
            : ""}
        </p>

        {message && (
          <p
            className={
              message ===
              "Saved."
                ? "font-semibold text-green-700"
                : "font-semibold text-red-700"
            }
          >
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

export default function ActivityCatalogueManager({
  categories,
  activities,
}: ActivityCatalogueManagerProps) {
  const router = useRouter();

  const defaultCategoryId =
    categories.find(
      (category) =>
        category.is_active
    )?.id ??
    categories[0]?.id ??
    "";

  const [
    newCategoryName,
    setNewCategoryName,
  ] = useState("");

  const [
    newActivityName,
    setNewActivityName,
  ] = useState("");

  const [
    newActivitySortOrder,
    setNewActivitySortOrder,
  ] = useState("100");

  const [
    newActivityCategoryId,
    setNewActivityCategoryId,
  ] = useState(
    defaultCategoryId
  );

  const [
    categoryMessage,
    setCategoryMessage,
  ] = useState<string | null>(
    null
  );

  const [
    activityMessage,
    setActivityMessage,
  ] = useState<string | null>(
    null
  );

  const [
    isCreatingCategory,
    setIsCreatingCategory,
  ] = useState(false);

  const [
    isCreatingActivity,
    setIsCreatingActivity,
  ] = useState(false);

  const [
    selectedCategoryEditorId,
    setSelectedCategoryEditorId,
  ] = useState(
    defaultCategoryId
  );

  const [
    activityCategoryFilter,
    setActivityCategoryFilter,
  ] = useState(
    defaultCategoryId ||
      "all"
  );

  const [
    activityStatusFilter,
    setActivityStatusFilter,
  ] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [
    activitySearch,
    setActivitySearch,
  ] = useState("");

  const [
    selectedActivityId,
    setSelectedActivityId,
  ] = useState("");

  const selectedCategory =
    categories.find(
      (category) =>
        category.id ===
        selectedCategoryEditorId
    ) ?? null;

  const filteredActivities =
    useMemo(() => {
      const normalizedSearch =
        activitySearch
          .trim()
          .toLocaleLowerCase(
            "en-US"
          );

      return activities
        .filter(
          (activity) =>
            activityCategoryFilter ===
              "all" ||
            activity.category_id ===
              activityCategoryFilter
        )
        .filter(
          (activity) =>
            activityStatusFilter ===
              "all" ||
            (
              activityStatusFilter ===
                "active" &&
              activity.is_active
            ) ||
            (
              activityStatusFilter ===
                "inactive" &&
              !activity.is_active
            )
        )
        .filter(
          (activity) =>
            !normalizedSearch ||
            activity.name
              .toLocaleLowerCase(
                "en-US"
              )
              .includes(
                normalizedSearch
              ) ||
            activity.category_name
              .toLocaleLowerCase(
                "en-US"
              )
              .includes(
                normalizedSearch
              ) ||
            activity.aliases.some(
              (alias) =>
                alias
                  .toLocaleLowerCase(
                    "en-US"
                  )
                  .includes(
                    normalizedSearch
                  )
            )
        )
        .sort(
          (
            left,
            right
          ) => {
            const categoryComparison =
              left.category_name.localeCompare(
                right.category_name
              );

            if (
              activityCategoryFilter ===
                "all" &&
              categoryComparison !==
                0
            ) {
              return categoryComparison;
            }

            const orderComparison =
              toNumber(
                left.sort_order
              ) -
              toNumber(
                right.sort_order
              );

            if (
              orderComparison !==
              0
            ) {
              return orderComparison;
            }

            return left.name.localeCompare(
              right.name
            );
          }
        );
    }, [
      activities,
      activityCategoryFilter,
      activitySearch,
      activityStatusFilter,
    ]);

  useEffect(() => {
    const selectedStillVisible =
      filteredActivities.some(
        (activity) =>
          activity.id ===
          selectedActivityId
      );

    if (
      selectedStillVisible
    ) {
      return;
    }

    setSelectedActivityId(
      filteredActivities[0]?.id ??
        ""
    );
  }, [
    filteredActivities,
    selectedActivityId,
  ]);

  const selectedActivity =
    filteredActivities.find(
      (activity) =>
        activity.id ===
        selectedActivityId
    ) ?? null;

  async function createCategory() {
    setIsCreatingCategory(
      true
    );
    setCategoryMessage(null);

    const { error } =
      await supabase.rpc(
        "admin_create_activity_category",
        {
          p_name:
            newCategoryName,
          p_cover_url:
            null,
        }
      );

    setIsCreatingCategory(
      false
    );

    if (error) {
      setCategoryMessage(
        error.message
      );
      return;
    }

    setNewCategoryName("");
    setCategoryMessage(
      "Category created."
    );
    router.refresh();
  }

  async function createActivity() {
    setIsCreatingActivity(
      true
    );
    setActivityMessage(null);

    const parsedSortOrder =
      Number(
        newActivitySortOrder
      );

    if (
      !Number.isInteger(
        parsedSortOrder
      ) ||
      parsedSortOrder < 0
    ) {
      setIsCreatingActivity(
        false
      );
      setActivityMessage(
        "Sort order must be zero or greater."
      );
      return;
    }

    const { error } =
      await supabase.rpc(
        "admin_create_catalogue_activity",
        {
          p_category_id:
            newActivityCategoryId,
          p_name:
            newActivityName,
          p_cover_url:
            null,
          p_sort_order:
            parsedSortOrder,
        }
      );

    setIsCreatingActivity(
      false
    );

    if (error) {
      setActivityMessage(
        error.message
      );
      return;
    }

    setNewActivityName("");
    setNewActivitySortOrder(
      "100"
    );
    setActivityMessage(
      "Activity created."
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <details className="group rounded-3xl border border-gray-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
              Catalogue Structure
            </p>

            <h2 className="mt-2 text-2xl font-bold text-gray-950">
              Add a category or Activity
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Closed by default so the catalogue
              does not become a small bureaucratic
              country.
            </p>
          </div>

          <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition group-open:rotate-180">
            ↓
          </span>
        </summary>

        <div className="border-t border-gray-100 p-6 md:p-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
              <h3 className="font-bold text-green-950">
                New category
              </h3>

              <input
                value={
                  newCategoryName
                }
                onChange={(event) =>
                  setNewCategoryName(
                    event.target.value
                  )
                }
                placeholder="For example, Crafts & Making"
                className="mt-4 w-full rounded-xl border border-green-200 bg-white px-4 py-3 outline-none focus:border-green-500"
              />

              {categoryMessage && (
                <p className="mt-3 text-sm font-semibold text-green-800">
                  {
                    categoryMessage
                  }
                </p>
              )}

              <button
                type="button"
                disabled={
                  isCreatingCategory ||
                  newCategoryName.trim()
                    .length < 2
                }
                onClick={
                  createCategory
                }
                className="mt-4 w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
              >
                {isCreatingCategory
                  ? "Creating..."
                  : "Add Category"}
              </button>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="font-bold text-blue-950">
                New Activity
              </h3>

              <select
                value={
                  newActivityCategoryId
                }
                onChange={(event) =>
                  setNewActivityCategoryId(
                    event.target.value
                  )
                }
                className="mt-4 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  Select category
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.id
                      }
                    >
                      {
                        category.name
                      }
                      {category.is_active
                        ? ""
                        : " (inactive)"}
                    </option>
                  )
                )}
              </select>

              <input
                value={
                  newActivityName
                }
                onChange={(event) =>
                  setNewActivityName(
                    event.target.value
                  )
                }
                placeholder="For example, Wood Carving"
                className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
              />

              <label className="mt-3 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                  Sort order
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    newActivitySortOrder
                  }
                  onChange={(event) =>
                    setNewActivitySortOrder(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                />
              </label>

              {activityMessage && (
                <p className="mt-3 text-sm font-semibold text-blue-800">
                  {
                    activityMessage
                  }
                </p>
              )}

              <button
                type="button"
                disabled={
                  isCreatingActivity ||
                  !newActivityCategoryId ||
                  newActivityName.trim()
                    .length < 2
                }
                onClick={
                  createActivity
                }
                className="mt-4 w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                {isCreatingActivity
                  ? "Creating..."
                  : "Add Activity"}
              </button>
            </div>
          </div>
        </div>
      </details>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
            Category Management
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Select a category to edit
          </h2>
        </div>

        <select
          value={
            selectedCategoryEditorId
          }
          onChange={(event) =>
            setSelectedCategoryEditorId(
              event.target.value
            )
          }
          className="mt-5 w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold outline-none focus:border-green-500"
        >
          {categories.map(
            (category) => (
              <option
                key={
                  category.id
                }
                value={
                  category.id
                }
              >
                {
                  category.name
                }
                {category.is_active
                  ? ""
                  : " (inactive)"}
              </option>
            )
          )}
        </select>

        <div className="mt-4">
          {selectedCategory ? (
            <CategoryEditor
              key={
                selectedCategory.id
              }
              category={
                selectedCategory
              }
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No category is available.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Activity Management
          </p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            Find and edit one Activity
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Filter first, then only the selected
            Activity editor is shown.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Category
            </span>

            <select
              value={
                activityCategoryFilter
              }
              onChange={(event) =>
                setActivityCategoryFilter(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">
                All categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {
                      category.name
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </span>

            <select
              value={
                activityStatusFilter
              }
              onChange={(event) =>
                setActivityStatusFilter(
                  event.target.value as
                    | "all"
                    | "active"
                    | "inactive"
                )
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Search
            </span>

            <input
              type="search"
              value={
                activitySearch
              }
              onChange={(event) =>
                setActivitySearch(
                  event.target.value
                )
              }
              placeholder="Activity name, category or alias"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Activity
              </span>

              <select
                value={
                  selectedActivityId
                }
                onChange={(event) =>
                  setSelectedActivityId(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500"
              >
                {filteredActivities.length ===
                0 ? (
                  <option value="">
                    No matching Activity
                  </option>
                ) : (
                  filteredActivities.map(
                    (activity) => (
                      <option
                        key={
                          activity.id
                        }
                        value={
                          activity.id
                        }
                      >
                        {activityCategoryFilter ===
                        "all"
                          ? `${activity.category_name} · `
                          : ""}
                        {toNumber(
                          activity.sort_order
                        )}
                        {" · "}
                        {
                          activity.name
                        }
                        {activity.is_active
                          ? ""
                          : " (inactive)"}
                      </option>
                    )
                  )
                )}
              </select>
            </label>

            <p className="shrink-0 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-800">
              {filteredActivities.length} matching
            </p>
          </div>
        </div>

        <div className="mt-5">
          {selectedActivity ? (
            <ActivityEditor
              key={
                selectedActivity.id
              }
              activity={
                selectedActivity
              }
              categories={
                categories
              }
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No Activity matches the selected filters.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
